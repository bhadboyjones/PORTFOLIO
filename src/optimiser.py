"""
optimiser.py
============
MILP BESS dispatch optimiser — PuLP/HiGHS backend.

Designed for single-site runs. Call run_optimiser() once per site/scenario,
then call calculate_settlement() on the output to get P&L.

Column names are verified against data_builder.build_optimiser_input() output:

    Forecast (optimiser signal):
        da_forecast_gbp     MID day-ahead forecast price (£/MWh)
        imb_forecast_gbp    system sell price forecast (£/MWh)

    Actual (settlement signal):
        da_actual_gbp       MID day-ahead actual price (£/MWh)
        imb_actual_gbp      system sell price actual (£/MWh)

    Network:
        duos_gbp_mwh        DUoS rate — positive, cost on import
        gduos_gbp_mwh       GDUoS rate — NEGATIVE, credit on export
        nec_gbp_mwh         non-energy charges — positive column, cost on import

    Standing charges (pre-converted to £/SP by data_builder):
        dduos_fixed_gbp_per_sp        DUoS fixed standing charge
        dduos_capacity_gbp_per_sp     DUoS capacity charge (contracted_kva dependent)
        gduos_fixed_gbp_per_sp        GDUoS fixed standing charge

    Demand:
        net_demand_mw       net site demand MW; negative = on-site surplus
        net_demand_mwh      net site demand MWh per SP (net_demand_mw * 0.5)
        chp_gen_mw          CHP generation MW per SP

GDUoS sign convention
---------------------
gduos_gbp_mwh is stored as a NEGATIVE number (e.g. Red band = -88.0).
Export rate = price - gduos_stored → e.g. 50 - (-88.0) = 138.0 £/MWh.

Price signal is fully independent between optimiser and settlement:

    DA-optimised, DA-settled (default):
        run_optimiser(..., forecast_price_col="da_forecast_gbp")
        calculate_settlement(..., actual_price_col="da_actual_gbp")

    Imb-optimised, imb-settled:
        run_optimiser(..., forecast_price_col="imb_forecast_gbp")
        calculate_settlement(..., actual_price_col="imb_actual_gbp")

Call order
----------
    build_optimiser_input()     # data_builder
    calculate_baseline()        # baseline site cost without BESS
    run_optimiser()             # BESS dispatch
    calculate_settlement()      # BESS P&L + standing charges

bess_params keys (all required — no defaults)
---------------------------------------------
    power_mw             float  max charge and discharge power (MW)
    capacity_mwh         float  usable storage capacity (MWh)
    soc_min              float  minimum SOC as fraction of capacity (e.g. 0.05)
    soc_max              float  maximum SOC as fraction (e.g. 0.95)
    soc_initial          float  starting SOC fraction; also end-of-chunk target
    charge_efficiency    float  one-way charge efficiency (e.g. sqrt(0.9))
    discharge_efficiency float  one-way discharge efficiency
    deg_cost_gbp_mwh     float  degradation cost per MWh of throughput
    export_limit_mw      float  scenario export cap (0.0 = BTM only)
    max_cycles_per_day   float  throughput cap in full cycles per day (e.g. 1.5)
"""

import logging
import math
from typing import Any, Dict, List

import pandas as pd
import pulp

logger = logging.getLogger(__name__)

from .config import NETWORK_CONFIG_NEC_HV, TOTAL_IMPORT_LEVIES_GBP_PER_MWH, CHP_MARGINAL_COST_GBP_PER_MWH

# ---------------------------------------------------------------------------
# Module constants
# ---------------------------------------------------------------------------
CHUNK_DAYS: int    = 3
SPS_PER_DAY: int   = 48
SPS_PER_CHUNK: int = CHUNK_DAYS * SPS_PER_DAY  # 48

# Columns always required regardless of price signal chosen
_REQUIRED_BASE_COLS: List[str] = [
    "net_demand_mw",
    "duos_gbp_mwh",
    "gduos_gbp_mwh",
    "nec_gbp_mwh",
    "dduos_fixed_gbp_per_sp",
    "dduos_capacity_gbp_per_sp",
    "gduos_fixed_gbp_per_sp",
]

_REQUIRED_BESS_KEYS: List[str] = [
    "power_mw",
    "capacity_mwh",
    "soc_min",
    "soc_max",
    "soc_initial",
    "charge_efficiency",
    "discharge_efficiency",
    "deg_cost_gbp_mwh",
    "export_limit_mw",
    "max_cycles_per_day",
]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def _validate_bess_params(bess_params: Dict[str, Any]) -> None:
    """Raise ValueError if any required bess_params key is absent."""
    missing = [k for k in _REQUIRED_BESS_KEYS if k not in bess_params]
    if missing:
        raise ValueError(
            f"bess_params missing required keys: {missing}\n"
        )


def _validate_input_df(
    df: pd.DataFrame,
    forecast_price_col: str,
    actual_price_col: str,
) -> None:
    """
    Raise ValueError if base columns or the requested price columns are absent.
    Validates the passed column names directly rather than a hardcoded price list,
    so any forecast/actual pair from data_builder can be used.
    """
    if df.empty:
        raise ValueError("Input dataframe is empty.")

    missing_base = [c for c in _REQUIRED_BASE_COLS if c not in df.columns]
    if missing_base:
        raise ValueError(
            f"Input dataframe missing required columns: {missing_base}\n"
            "These should all be present in data_builder.build_optimiser_input() output."
        )

    if forecast_price_col not in df.columns:
        raise ValueError(
            f"Forecast price column '{forecast_price_col}' not found.\n"
            f"Available columns: {list(df.columns)}"
        )

    if actual_price_col not in df.columns:
        raise ValueError(
            f"Actual price column '{actual_price_col}' not found.\n"
            f"Available columns: {list(df.columns)}"
        )


# ---------------------------------------------------------------------------
# Core MILP solver — one chunk
# ---------------------------------------------------------------------------

def _solve_chunk(
    chunk: pd.DataFrame,
    bess_params: Dict[str, Any],
    forecast_price_col: str,
    soc_start_mwh: float,
    chunk_idx: int,
    sp_duration_hrs: float = 0.5,
    n_sps_per_day: int = SPS_PER_DAY,
) -> pd.DataFrame:
    """
    Solve a single 3-day MILP chunk and return it with dispatch columns appended.

    Each call creates a completely fresh docplex Model — no variable leakage
    between chunks (avoids the "Cannot mix objects from different models" error).

    Args:
        chunk              : row-slice of the full input df (up to 144 rows)
        bess_params        : validated BESS parameter dict
        forecast_price_col : column name used as optimiser price signal
        soc_start_mwh      : SOC (MWh) carried in from previous chunk
        chunk_idx          : 1-based index for logging only

    Returns:
        chunk copy with columns: charge1_mw, charge2_mw, dis1_mw, dis2_mw, soc_mwh
    """
    n = len(chunk)

    # Unpack bess_params
    power_mw        = float(bess_params["power_mw"])
    capacity_mwh    = float(bess_params["capacity_mwh"])
    soc_min_mwh     = float(bess_params["soc_min"])     * capacity_mwh
    soc_max_mwh     = float(bess_params["soc_max"])     * capacity_mwh
    soc_target_mwh  = float(bess_params["soc_initial"]) * capacity_mwh
    eta_c           = float(bess_params["charge_efficiency"])
    eta_d           = float(bess_params["discharge_efficiency"])
    deg_cost        = float(bess_params["deg_cost_gbp_mwh"])
    export_limit_mw = float(bess_params["export_limit_mw"])
    max_cycles      = float(bess_params["max_cycles_per_day"])

    soc_tol_mwh        = 0.10 * capacity_mwh
    n_days             = n / n_sps_per_day
    max_throughput_mwh = max_cycles * capacity_mwh * n_days * 2

    nd_mw = chunk["net_demand_mw"].values  # negative = on-site surplus

    # -----------------------------------------------------------------------
    # Build model — fresh object every call
    # -----------------------------------------------------------------------
    prob = pulp.LpProblem(name=f"BESS_chunk_{chunk_idx}", sense=pulp.LpMaximize)

    chr1, chr2, dis1, dis2, soc_var = {}, {}, {}, {}, {}

    for i in range(n):
        # charge1: absorb on-site surplus — zero when site is net importing
        ub_chr1 = min(float(max(-nd_mw[i], 0.0)), power_mw)
        chr1[i] = pulp.LpVariable(f"chr1_{i}", lowBound=0.0, upBound=ub_chr1)

        # charge2: import from grid — headroom left after chr1
        ub_chr2 = power_mw - ub_chr1
        chr2[i] = pulp.LpVariable(f"chr2_{i}", lowBound=0.0, upBound=ub_chr2)

        # dis1: offset site demand — zero when site has surplus
        ub_dis1 = min(float(max(nd_mw[i], 0.0)), power_mw)
        dis1[i] = pulp.LpVariable(f"dis1_{i}", lowBound=0.0, upBound=ub_dis1)

        # dis2: export to grid — headroom left after dis1 capped at export limit
        ub_dis2 = min(export_limit_mw, power_mw - ub_dis1)
        dis2[i] = pulp.LpVariable(f"dis2_{i}", lowBound=0.0, upBound=ub_dis2)

        # SOC at each period (end-of-period state)
        soc_var[i] = pulp.LpVariable(f"soc_{i}", lowBound=soc_min_mwh, upBound=soc_max_mwh)

    def total_chr(i): return chr1[i] + chr2[i]
    def total_dis(i): return dis1[i] + dis2[i]

    # -----------------------------------------------------------------------
    # Constraints
    # -----------------------------------------------------------------------

    # C1: Opening SOC pinned to carried-in value
    prob += (soc_var[0] == soc_start_mwh, "soc_init")

    # C2: SOC balance — MWh = MW × sp_duration_hrs × efficiency
    for i in range(1, n):
        prob += (
            soc_var[i]
            == soc_var[i - 1]
            + total_chr(i - 1) * sp_duration_hrs * eta_c
            - total_dis(i - 1) * sp_duration_hrs / eta_d,
            f"soc_bal_{i}",
        )

    # C3: Power limit per period
    for i in range(n):
        prob += (total_chr(i) + total_dis(i) <= power_mw, f"pwr_{i}")

    # C4: End-of-chunk SOC target (±10% of capacity)
    prob += (soc_var[n - 1] >= soc_target_mwh - soc_tol_mwh, "soc_end_lo")
    prob += (soc_var[n - 1] <= soc_target_mwh + soc_tol_mwh, "soc_end_hi")

    # C5: Throughput cap
    prob += (
        pulp.lpSum((total_chr(i) + total_dis(i)) * sp_duration_hrs for i in range(n))
        <= max_throughput_mwh,
        "cycle_cap",
    )

    # -----------------------------------------------------------------------
    # Objective
    # -----------------------------------------------------------------------
    terms = []
    for i in range(n):
        price = chunk[forecast_price_col].iloc[i]
        duos  = chunk["duos_gbp_mwh"].iloc[i]
        gduos = chunk["gduos_gbp_mwh"].iloc[i]   # stored negative
        nec   = chunk["nec_gbp_mwh"].iloc[i]

        import_rate = price + duos + nec
        export_rate = price - gduos

        terms.append( import_rate * dis1[i] * sp_duration_hrs)
        terms.append( export_rate * dis2[i] * sp_duration_hrs)
        terms.append(-import_rate * chr2[i] * sp_duration_hrs)
        terms.append(-export_rate * chr1[i] * sp_duration_hrs)
        terms.append(-deg_cost * (total_chr(i) + total_dis(i)) * sp_duration_hrs)

    prob += pulp.lpSum(terms)

    # -----------------------------------------------------------------------
    # Solve
    # -----------------------------------------------------------------------
    prob.solve(pulp.HiGHS(msg=False))

    chunk = chunk.copy()

    if prob.status != pulp.LpStatusOptimal:
        logger.warning(
            "Chunk %d: HiGHS returned no optimal solution — filling with zeros.", chunk_idx
        )
        chunk["charge1_mw"] = 0.0
        chunk["charge2_mw"] = 0.0
        chunk["dis1_mw"]    = 0.0
        chunk["dis2_mw"]    = 0.0
        chunk["soc_mwh"]    = soc_start_mwh
        return chunk

    def _sv(var_dict, i):
        v = pulp.value(var_dict[i])
        if v is None or v < 1e-9:
            return 0.0
        return round(v, 6)

    chunk["charge1_mw"] = [_sv(chr1,    i) for i in range(n)]
    chunk["charge2_mw"] = [_sv(chr2,    i) for i in range(n)]
    chunk["dis1_mw"]    = [_sv(dis1,    i) for i in range(n)]
    chunk["dis2_mw"]    = [_sv(dis2,    i) for i in range(n)]
    chunk["soc_mwh"]    = [_sv(soc_var, i) for i in range(n)]

    logger.info(
        "Chunk %d solved — objective £%.2f, end SOC %.3f MWh",
        chunk_idx,
        pulp.value(prob.objective),
        chunk["soc_mwh"].iloc[-1],
    )

    return chunk


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def calculate_baseline(
    df: pd.DataFrame,
    actual_price_col: str = "da_actual_gbp",
) -> pd.DataFrame:
    """
    Calculate per-SP baseline site cost without any BESS dispatch.

    Must be called on the raw output of data_builder.build_optimiser_input()
    before run_optimiser() is called — uses net_demand_mw as-is with no
    BESS influence.

    Baseline cost model:
        import cost  : where net_demand_mw > 0 → net_demand_mwh × (price + DUoS + NEC)
        export rev   : where net_demand_mw < 0 → abs(net_demand_mwh) × (price - GDUoS)
        CHP fuel cost: chp_gen_mwh × CHP_MARGINAL_COST_GBP_PER_MWH
        PV           : free — already embedded in net_demand_mw, no cost applied

    Assumptions:
        CHP_MARGINAL_COST_GBP_PER_MWH = £70/MWh (config.py benchmark)
        In production replace with actual gas price + heat rate per site.

    Args:
        df               : output of data_builder.build_optimiser_input()
        actual_price_col : price column to use for import/export cost calculation
                           default "da_actual_gbp"

    Returns:
        df with baseline columns appended:
            baseline_import_cost_gbp   import cost per SP (zero where net_demand_mw <= 0)
            baseline_export_rev_gbp    export revenue per SP (zero where net_demand_mw >= 0)
            baseline_chp_cost_gbp      CHP fuel cost per SP
            baseline_net_gbp           net baseline cost per SP
                                       = import_cost + chp_cost - export_rev
    """
    required = [
        "net_demand_mw",
        "net_demand_mwh",
        "thermal_gen_mw",
        "duos_gbp_mwh",
        "gduos_gbp_mwh",
        "nec_gbp_mwh",
    ]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            f"calculate_baseline() missing required columns: {missing}\n"
            "Ensure site_params was passed to build_optimiser_input()."
        )

    if actual_price_col not in df.columns:
        raise ValueError(
            f"Price column '{actual_price_col}' not found.\n"
            f"Available columns: {list(df.columns)}"
        )

    df = df.copy()

    # Import rate and export rate — same convention as calculate_settlement()
    import_rate = df[actual_price_col] + df["duos_gbp_mwh"] + df["nec_gbp_mwh"]
    export_rate = df[actual_price_col] - df["gduos_gbp_mwh"]

    # Import cost — only where site is net importing (net_demand_mw > 0)
    df["baseline_import_cost_gbp"] = (
        df["net_demand_mwh"].clip(lower=0) * import_rate
    )

    # Export revenue — only where site has surplus (net_demand_mw < 0)
    # net_demand_mwh is negative in surplus periods — abs() gives positive MWh
    df["baseline_export_rev_gbp"] = (
        df["net_demand_mwh"].clip(upper=0).abs() * export_rate
    )

    # Thermal generation fuel cost — all SPs where thermal gen is running
    df["baseline_thermal_cost_gbp"] = (
        df["thermal_gen_mw"] * 0.5 * CHP_MARGINAL_COST_GBP_PER_MWH
    )

    # Net baseline cost per SP
    # Positive = net cost, negative = net earner (site exporting more than it imports)
    df["baseline_net_gbp"] = (
        df["baseline_import_cost_gbp"]
        + df["baseline_thermal_cost_gbp"]
        - df["baseline_export_rev_gbp"]
    )

    return df


def run_optimiser(
    df: pd.DataFrame,
    bess_params: Dict[str, Any],
    forecast_price_col: str = "da_forecast_gbp",
    actual_price_col: str = "da_actual_gbp",
    sp_duration_hrs: float = 0.5,
    n_sps_per_day: int = SPS_PER_DAY,
) -> pd.DataFrame:
    """
    Run chunked MILP optimisation for a single site over its full time-series.

    Splits into 3-day chunks (144 SPs). Closing SOC of each chunk becomes the
    opening SOC of the next.

    Args:
        df                 : output of data_builder.build_optimiser_input()
        bess_params        : BESS parameter dict — all keys required, no defaults
        forecast_price_col : price column the optimiser uses to make decisions
                             default "da_forecast_gbp"
        actual_price_col   : corresponding actual price column for settlement
                             default "da_actual_gbp"

    Returns:
        df with dispatch columns appended:
            charge1_mw       MW absorbed from on-site surplus
            charge2_mw       MW imported from grid to charge
            dis1_mw          MW discharged to offset site demand
            dis2_mw          MW exported to grid
            soc_mwh          battery SOC in MWh (end-of-period)
            total_charge_mw  charge1 + charge2
            total_dis_mw     dis1 + dis2
    """
    _validate_bess_params(bess_params)
    _validate_input_df(df, forecast_price_col, actual_price_col)

    df = df.copy().reset_index(drop=True)

    n_rows        = len(df)
    sps_per_chunk = CHUNK_DAYS * n_sps_per_day
    n_chunks      = math.ceil(n_rows / sps_per_chunk)
    soc_carry     = float(bess_params["soc_initial"]) * float(bess_params["capacity_mwh"])

    chunks_solved: List[pd.DataFrame] = []

    for idx in range(n_chunks):
        start = idx * sps_per_chunk
        end   = min(start + sps_per_chunk, n_rows)

        solved = _solve_chunk(
            chunk=df.iloc[start:end].copy(),
            bess_params=bess_params,
            forecast_price_col=forecast_price_col,
            soc_start_mwh=soc_carry,
            chunk_idx=idx + 1,
            sp_duration_hrs=sp_duration_hrs,
            n_sps_per_day=n_sps_per_day,
        )

        chunks_solved.append(solved)
        soc_carry = float(solved["soc_mwh"].iloc[-1])

        print(f"Completed chunk {idx + 1}/{n_chunks}")

    out = pd.concat(chunks_solved, ignore_index=True)

    out["total_charge_mw"] = out["charge1_mw"] + out["charge2_mw"]
    out["total_dis_mw"]    = out["dis1_mw"]    + out["dis2_mw"]

    out.attrs["actual_price_col"]   = actual_price_col
    out.attrs["forecast_price_col"] = forecast_price_col

    return out


def calculate_settlement(
    df: pd.DataFrame,
    bess_params: Dict[str, Any],
    actual_price_col: str = None,
    sp_duration_hrs: float = 0.5,
) -> pd.DataFrame:
    """
    Calculate per-SP settlement P&L using actual price columns.

    Must be called after run_optimiser() — expects dispatch columns in df.

    P&L is split into two distinct layers:

        BESS P&L (dispatch-driven — what the BESS earns/saves):
            import_rate_gbp          price + DUoS + NEC (£/MWh)
            export_rate_gbp          price - GDUoS (£/MWh)
            dis1_saving_gbp          avoided demand cost per SP
            dis2_revenue_gbp         grid export revenue per SP
            charge2_cost_gbp         cost of grid import to charge per SP
            charge1_opp_cost_gbp     foregone export revenue from absorbing surplus
            deg_cost_gbp             degradation cost on total throughput per SP
            net_settlement_gbp       BESS contribution to bill — sum of above

        Standing charges (sunk costs — paid regardless of BESS dispatch):
            dduos_fixed_gbp          DUoS fixed standing charge per SP
            dduos_capacity_gbp       DUoS capacity charge per SP
            gduos_fixed_gbp          GDUoS fixed standing charge per SP
            total_standing_gbp       sum of three above per SP

    Standing charges are separate from net_settlement_gbp — BESS P&L stays
    clean and legible. Combined at reporting stage:

        site_cost_wo_bess  = baseline_net_gbp.sum() + total_standing_gbp.sum()
        site_cost_w_bess   = site_cost_wo_bess - net_settlement_gbp.sum()
        bess_net_benefit   = net_settlement_gbp.sum()

    actual_price_col resolution order:
        1. Explicit argument if passed
        2. df.attrs["actual_price_col"] set by run_optimiser()
        3. ValueError if neither available

    Args:
        df               : output of run_optimiser()
        bess_params      : same dict passed to run_optimiser()
        actual_price_col : actual price column to settle against

    Note on charge1:
        No import cost — absorbed on-site surplus carries no grid charge.
        Opportunity cost applies — energy could have been exported instead.
        Degradation still applies because the cells cycle regardless.
    """
    _validate_bess_params(bess_params)

    # ------------------------------------------------------------------
    # Resolve actual price column
    # ------------------------------------------------------------------
    if actual_price_col is None:
        actual_price_col = df.attrs.get("actual_price_col", None)
    if actual_price_col is None:
        raise ValueError(
            "actual_price_col not provided and not found in df.attrs.\n"
            "Either pass it explicitly or ensure run_optimiser() was called first."
        )
    if actual_price_col not in df.columns:
        raise ValueError(
            f"Actual price column '{actual_price_col}' not found.\n"
            f"Available columns: {list(df.columns)}"
        )

    # ------------------------------------------------------------------
    # Validate dispatch columns
    # ------------------------------------------------------------------
    dispatch_cols = ["charge1_mw", "charge2_mw", "dis1_mw", "dis2_mw"]
    missing = [c for c in dispatch_cols if c not in df.columns]
    if missing:
        raise ValueError(
            f"Dispatch columns missing — run run_optimiser() first. Missing: {missing}"
        )

    # ------------------------------------------------------------------
    # Validate standing charge columns (written by data_builder)
    # ------------------------------------------------------------------
    standing_cols = [
        "dduos_fixed_gbp_per_sp",
        "dduos_capacity_gbp_per_sp",
        "gduos_fixed_gbp_per_sp",
    ]
    missing_standing = [c for c in standing_cols if c not in df.columns]
    if missing_standing:
        raise ValueError(
            f"Standing charge columns missing from df: {missing_standing}\n"
            "These should be present from data_builder.build_optimiser_input()."
        )

    df = df.copy()
    deg = float(bess_params["deg_cost_gbp_mwh"])

    # ------------------------------------------------------------------
    # BESS P&L — dispatch driven
    # ------------------------------------------------------------------

    # Import rate: price + DUoS + NEC (£/MWh)
    df["import_rate_gbp"] = (
        df[actual_price_col]
        + df["duos_gbp_mwh"]
        + df["nec_gbp_mwh"]
    )

    # Export rate: price - GDUoS (GDUoS stored negative — subtract adds the credit)
    # e.g. price=50, gduos=-88 → export_rate = 138 £/MWh
    df["export_rate_gbp"] = (
        df[actual_price_col]
        - df["gduos_gbp_mwh"]
    )

    # P&L per SP — MW × sp_duration_hrs = MWh
    df["dis1_saving_gbp"]      = df["dis1_mw"]    * sp_duration_hrs * df["import_rate_gbp"]
    df["dis2_revenue_gbp"]     = df["dis2_mw"]    * sp_duration_hrs * df["export_rate_gbp"]
    df["charge2_cost_gbp"]     = df["charge2_mw"] * sp_duration_hrs * df["import_rate_gbp"]
    df["charge1_opp_cost_gbp"] = df["charge1_mw"] * sp_duration_hrs * df["export_rate_gbp"]
    df["deg_cost_gbp"]         = (
        (df["charge1_mw"] + df["charge2_mw"] + df["dis1_mw"] + df["dis2_mw"])
        * sp_duration_hrs
        * deg
    )

    df["net_settlement_gbp"] = (
        df["dis1_saving_gbp"]
        + df["dis2_revenue_gbp"]
        - df["charge2_cost_gbp"]
        - df["charge1_opp_cost_gbp"]
        - df["deg_cost_gbp"]
    )

    # ------------------------------------------------------------------
    # Standing charges — sunk costs, pre-converted to £/SP by data_builder
    # Accrue every SP regardless of BESS dispatch
    # ------------------------------------------------------------------
    df["dduos_fixed_gbp"]    = df["dduos_fixed_gbp_per_sp"]
    df["dduos_capacity_gbp"] = df["dduos_capacity_gbp_per_sp"]
    df["gduos_fixed_gbp"]    = df["gduos_fixed_gbp_per_sp"]

    df["total_standing_gbp"] = (
        df["dduos_fixed_gbp"]
        + df["dduos_capacity_gbp"]
        + df["gduos_fixed_gbp"]
    )

    return df