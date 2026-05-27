"""
CSV upload pipeline for BTM BESS optimisation.

Handles real site meter data uploads as an alternative to synthetic archetypes.
CSV input is MW throughout — no unit conversion applied.

Expected CSV columns:
    timestamp         half-hourly or hourly, Europe/London timezone
    net_demand_mw     grid boundary (positive = importing, negative = exporting)
                      already net of all on-site generation (PV + thermal)
    thermal_gen_mw    required only when thermal_gen_toggle=True
                      covers any dispatchable thermal asset (CHP, genset, gas engine,
                      fuel cell); used for baseline fuel cost only — not used by MILP

Call order for CSV mode:
    load_and_validate_csv()        validate and clean the uploaded file
    build_csv_optimiser_input()    join prices + DUoS, produce MILP-ready DataFrame
    calculate_baseline_csv()       per-SP baseline cost without BESS
    run_optimiser()                MILP dispatch (unchanged from archetype mode)
    calculate_settlement()         BESS P&L (unchanged from archetype mode)
"""

import warnings
from typing import Optional

import numpy as np
import pandas as pd

from .duos_rates import get_duos_rates, convert_rates_to_model_units
from .prices import build_price_df
from .config import TOTAL_IMPORT_LEVIES_GBP_PER_MWH


# ---------------------------------------------------------------------------
# CSV load and validation
# ---------------------------------------------------------------------------

def load_and_validate_csv(
    filepath: str,
    chp_toggle: bool = False,
) -> tuple[pd.DataFrame, list[str], float, int]:
    """
    Load and validate a site meter CSV or XLSX file.

    Required columns: timestamp, net_demand_mw
    Conditional column: thermal_gen_mw (required if chp_toggle=True)

    Validation checks:
    - Required columns present
    - timestamp parseable; resolution detected from median gap
    - Resolution must be 30-minute or hourly (raises ValueError otherwise)
    - No all-NaN blocks in net_demand_mw
    - thermal_gen_mw present and non-negative if chp_toggle=True

    NaN values in numeric columns are filled with 0.0.
    Missing SPs (gaps in the timestamp sequence) are reported as warnings
    but not inserted — the caller's left-join will handle them naturally.

    Returns:
        (df, warns, sp_duration_hrs, n_sps_per_day) where
        df has columns: timestamp (UTC tz-aware), net_demand_mw, thermal_gen_mw.
        warns is a list of human-readable warning strings (may be empty).
        sp_duration_hrs is 0.5 for 30-min data, 1.0 for hourly data.
        n_sps_per_day is 48 for 30-min data, 24 for hourly data.
    """
    warns: list[str] = []

    # --- Load file ---
    fp = str(filepath).lower()
    if fp.endswith((".xlsx", ".xls")):
        raw = pd.read_excel(filepath)
    else:
        raw = pd.read_csv(filepath)

    raw.columns = [c.strip().lower().replace(" ", "_") for c in raw.columns]

    # --- Required columns ---
    if "timestamp" not in raw.columns:
        raise ValueError(
            "Missing required column: 'timestamp'. "
            "Expected column headers: timestamp, net_demand_mw"
            + (", thermal_gen_mw" if chp_toggle else "")
        )
    if "net_demand_mw" not in raw.columns:
        raise ValueError(
            "Missing required column: 'net_demand_mw'. "
            "Expected column headers: timestamp, net_demand_mw"
            + (", thermal_gen_mw" if chp_toggle else "")
        )
    if chp_toggle and "thermal_gen_mw" not in raw.columns:
        raise ValueError(
            "Thermal generation is enabled but 'thermal_gen_mw' column is missing "
            "from the upload."
        )

    # --- Parse timestamp ---
    try:
        ts = pd.to_datetime(raw["timestamp"], utc=False)
    except Exception as e:
        raise ValueError(f"Could not parse 'timestamp' column: {e}")

    # Localise to Europe/London if naive, then convert to UTC
    if ts.dt.tz is None:
        ts = ts.dt.tz_localize("Europe/London", ambiguous="infer", nonexistent="shift_forward")
    ts = ts.dt.tz_convert("UTC")

    df = pd.DataFrame({"timestamp": ts})
    df = df.sort_values("timestamp").reset_index(drop=True)

    # --- Resolution detection ---
    if len(df) < 2:
        raise ValueError(
            "Too few rows to detect data resolution. "
            "Please provide at least 2 settlement periods."
        )
    median_gap = df["timestamp"].diff().dropna().median()
    if median_gap == pd.Timedelta("30min"):
        sp_duration_hrs = 0.5
        n_sps_per_day   = 48
    elif median_gap == pd.Timedelta("60min"):
        sp_duration_hrs = 1.0
        n_sps_per_day   = 24
    else:
        raise ValueError(
            f"Unsupported data resolution ({median_gap}). "
            "flexiq accepts 30-minute or hourly interval data only."
        )

    # --- Interval regularity check ---
    expected_gap = pd.Timedelta(f"{int(sp_duration_hrs * 60)}min")
    diffs = df["timestamp"].diff().dropna()
    irregular = diffs[diffs != expected_gap]
    if not irregular.empty:
        warns.append(
            f"{len(irregular)} timestamp gaps or irregular intervals detected "
            f"(expected {expected_gap} spacing). Results may be affected."
        )

    # --- net_demand_mw ---
    df["net_demand_mw"] = pd.to_numeric(raw["net_demand_mw"], errors="coerce")

    nan_count = df["net_demand_mw"].isna().sum()
    if nan_count == len(df):
        raise ValueError("'net_demand_mw' column contains no valid numeric values.")
    if nan_count > 0:
        warns.append(f"{nan_count} NaN values in net_demand_mw filled with 0.0.")
        df["net_demand_mw"] = df["net_demand_mw"].fillna(0.0)

    # --- thermal_gen_mw ---
    if chp_toggle:
        df["thermal_gen_mw"] = pd.to_numeric(raw["thermal_gen_mw"], errors="coerce")
        thm_nan = df["thermal_gen_mw"].isna().sum()
        if thm_nan > 0:
            warns.append(f"{thm_nan} NaN values in thermal_gen_mw filled with 0.0.")
            df["thermal_gen_mw"] = df["thermal_gen_mw"].fillna(0.0)
        if (df["thermal_gen_mw"] < 0).any():
            warns.append(
                "thermal_gen_mw contains negative values — these have been clipped to 0.0."
            )
            df["thermal_gen_mw"] = df["thermal_gen_mw"].clip(lower=0.0)
    else:
        df["thermal_gen_mw"] = 0.0

    # --- Check for gaps in the SP sequence ---
    if len(df) > 1:
        full_range = pd.date_range(
            df["timestamp"].iloc[0],
            df["timestamp"].iloc[-1],
            freq=f"{int(sp_duration_hrs * 60)}min",
            tz="UTC",
        )
        n_expected = len(full_range)
        n_actual   = len(df)
        if n_actual < n_expected:
            warns.append(
                f"{n_expected - n_actual} settlement periods missing from upload "
                f"(expected {n_expected}, got {n_actual}). "
                f"Missing SPs are excluded from the optimisation."
            )

    return df, warns, sp_duration_hrs, n_sps_per_day


# ---------------------------------------------------------------------------
# RAG band mapping
# ---------------------------------------------------------------------------

def _parse_hhmm(s: str) -> int:
    """Convert 'HH:MM' string to minutes from midnight."""
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def map_rag_bands(
    df: pd.DataFrame,
    red_windows: dict,
    amber_windows: dict,
    timestamp_col: str = "timestamp",
) -> pd.Series:
    """
    Assign each SP to 'red', 'amber', or 'green' DUoS band.

    red_windows and amber_windows must be from the DNO's rag_schedule dict:
        {"weekday": [["HH:MM", "HH:MM"], ...], "weekend": [...]}

    Green = remainder (everything not matched by red or amber windows).

    Handles:
    - Europe/London timezone (DST-safe via tz_convert)
    - Separate weekday and weekend windows per band
    - DNOs with no weekend Red or no weekend Amber (pass empty list for those)

    Returns:
        pd.Series of "red"/"amber"/"green" aligned to df.index.
    """
    ts = df[timestamp_col]
    if ts.dt.tz is None:
        raise ValueError("timestamp column must be timezone-aware (UTC expected).")

    local = ts.dt.tz_convert("Europe/London")
    mins = local.dt.hour * 60 + local.dt.minute
    is_weekend = local.dt.dayofweek >= 5  # 5=Sat, 6=Sun

    def _in_windows(mins_series: pd.Series, is_wknd: pd.Series, windows: dict) -> pd.Series:
        """Return boolean mask: True where SP falls inside any window for its day type."""
        mask = pd.Series(False, index=mins_series.index)

        weekday_wins = windows.get("weekday", [])
        for start_str, end_str in weekday_wins:
            s, e = _parse_hhmm(start_str), _parse_hhmm(end_str)
            mask |= (~is_wknd) & (mins_series >= s) & (mins_series < e)

        weekend_wins = windows.get("weekend", [])
        for start_str, end_str in weekend_wins:
            s, e = _parse_hhmm(start_str), _parse_hhmm(end_str)
            mask |= is_wknd & (mins_series >= s) & (mins_series < e)

        return mask

    red_mask   = _in_windows(mins, is_weekend, red_windows)
    amber_mask = _in_windows(mins, is_weekend, amber_windows)

    # Red takes priority over amber where windows overlap
    return pd.Series(
        np.select([red_mask, amber_mask], ["red", "amber"], default="green"),
        index=df.index,
        name="rag_band",
    )


# ---------------------------------------------------------------------------
# Build optimiser input DataFrame (CSV mode)
# ---------------------------------------------------------------------------

def build_csv_optimiser_input(
    csv_df: pd.DataFrame,
    dno_key: str,
    voltage_level: str,
    contracted_kva: float,
    price_exposure: str = "da",
    nec_gbp_mwh: Optional[float] = None,
    rate_overrides: Optional[dict] = None,
    force_refresh: bool = False,
    rag_red_windows: Optional[dict] = None,
    rag_amber_windows: Optional[dict] = None,
    sp_duration_hrs: float = 0.5,
    n_sps_per_day: int = 48,
) -> pd.DataFrame:
    """
    Build the full MILP-ready input DataFrame from validated CSV demand data.

    Produces the same column contract as data_builder.build_optimiser_input()
    so run_optimiser() and calculate_settlement() work identically in CSV mode.

    sp_duration_hrs and n_sps_per_day are returned by load_and_validate_csv()
    and must be threaded through from the caller.

    Args:
        csv_df          : output of load_and_validate_csv() — columns:
                          timestamp (UTC tz-aware), net_demand_mw, thermal_gen_mw
        dno_key         : one of VALID_DNOS (e.g. "NPG", "NGED")
        voltage_level   : "LV" or "HV"
        contracted_kva  : site contracted capacity in kVA
        price_exposure  : "da" or "imbalance"
        nec_gbp_mwh     : NEC levy (£/MWh); defaults to config TOTAL_IMPORT_LEVIES_GBP_PER_MWH
        rate_overrides  : optional dict of converted rates to override DNO defaults
        force_refresh   : bypass Elexon price cache
        rag_red_windows / rag_amber_windows : optional RAG band overrides
        sp_duration_hrs : SP duration in hours (0.5 for HH, 1.0 for hourly)
        n_sps_per_day   : settlement periods per day (48 for HH, 24 for hourly)
    """
    if nec_gbp_mwh is None:
        nec_gbp_mwh = TOTAL_IMPORT_LEVIES_GBP_PER_MWH

    # --- Load and convert DNO rates ---
    raw_rates = get_duos_rates(dno_key, voltage_level)
    rates = convert_rates_to_model_units(raw_rates)
    if rate_overrides:
        rates.update(rate_overrides)

    rag_schedule = rates["rag_schedule"]

    # Warn if ENWL placeholder schedule is in use
    if "_warning" in rag_schedule:
        warnings.warn(
            f"DNO '{dno_key}': {rag_schedule['_warning']}",
            UserWarning,
            stacklevel=2,
        )

    # --- Map RAG bands ---
    df = csv_df.copy().rename(columns={"timestamp": "startTime"})
    df["rag_band"] = map_rag_bands(
        df,
        red_windows=rag_red_windows if rag_red_windows is not None else rag_schedule["red"],
        amber_windows=rag_amber_windows if rag_amber_windows is not None else rag_schedule["amber"],
        timestamp_col="startTime",
    )

    # --- Apply volumetric DUoS/GDUoS rates ---
    duos_map = {
        "red":   rates["duos_red_gbp_mwh"],
        "amber": rates["duos_amber_gbp_mwh"],
        "green": rates["duos_green_gbp_mwh"],
    }
    gduos_map = {
        "red":   rates["gduos_red_gbp_mwh"],    # negative
        "amber": rates["gduos_amber_gbp_mwh"],   # negative
        "green": rates["gduos_green_gbp_mwh"],   # negative
    }
    df["duos_gbp_mwh"]  = df["rag_band"].map(duos_map)
    df["gduos_gbp_mwh"] = df["rag_band"].map(gduos_map)

    # --- Standing charges converted to £/SP ---
    df["dduos_fixed_gbp_per_sp"]    = rates["fixed_gbp_per_day"] / n_sps_per_day
    df["dduos_capacity_gbp_per_sp"] = rates["capacity_gbp_per_kva_day"] * contracted_kva / n_sps_per_day
    df["gduos_fixed_gbp_per_sp"]    = rates["gduos_fixed_gbp_per_day"] / n_sps_per_day

    # --- NEC ---
    df["nec_gbp_mwh"] = nec_gbp_mwh

    # --- net_demand_mwh ---
    df["net_demand_mwh"] = df["net_demand_mw"] * sp_duration_hrs

    # --- Pull wholesale prices ---
    start_date = df["startTime"].min().date()
    end_date   = df["startTime"].max().date()
    df_prices  = build_price_df(
        start_date=start_date,
        end_date=end_date,
        force_refresh=force_refresh,
    )

    # Left join: keep only SPs present in the CSV
    df = pd.merge(df, df_prices, on="startTime", how="left")

    # Fill any price NaNs (very rare — Elexon gaps) with 0 and warn
    price_nan_da  = df["da_price_gbp"].isna().sum()
    price_nan_imb = df["imb_price_gbp"].isna().sum()
    if price_nan_da > 0:
        warnings.warn(
            f"{price_nan_da} NaN values in DA price filled with 0.0 — "
            "check Elexon data coverage for the selected date range.",
            UserWarning,
            stacklevel=2,
        )
        df["da_price_gbp"] = df["da_price_gbp"].fillna(0.0)
    if price_nan_imb > 0:
        warnings.warn(
            f"{price_nan_imb} NaN values in imbalance price filled with 0.0 — "
            "check Elexon data coverage for the selected date range.",
            UserWarning,
            stacklevel=2,
        )
        df["imb_price_gbp"] = df["imb_price_gbp"].fillna(0.0)

    # Rename to model column names and create forecast = actual (perfect foresight)
    df = df.rename(columns={
        "da_price_gbp":  "da_actual_gbp",
        "imb_price_gbp": "imb_actual_gbp",
    })
    df["da_forecast_gbp"]  = df["da_actual_gbp"]
    df["imb_forecast_gbp"] = df["imb_actual_gbp"]

    df = df.drop(columns=["rag_band"], errors="ignore")
    df = df.sort_values("startTime").reset_index(drop=True)

    return df


# ---------------------------------------------------------------------------
# Baseline cost (CSV mode) — returns per-SP DataFrame, not a dict
# ---------------------------------------------------------------------------

def calculate_baseline_csv(
    df: pd.DataFrame,
    thermal_mc_gbp_mwh: float,
    actual_price_col: str = "da_actual_gbp",
    sp_duration_hrs: float = 0.5,
) -> pd.DataFrame:
    """
    Calculate per-SP baseline site cost without any BESS dispatch.

    Must be called on the raw output of build_csv_optimiser_input().

    Appends four per-SP columns to df and returns the modified DataFrame.
    Standing charges (dduos_fixed_gbp_per_sp, gduos_fixed_gbp_per_sp) are
    already on df and accumulate correctly via calculate_settlement() — not
    recomputed here.

    Args:
        df                 : output of build_csv_optimiser_input()
        thermal_mc_gbp_mwh : marginal fuel cost for on-site thermal generation (£/MWh)
        actual_price_col   : price column to use for import/export rates
        sp_duration_hrs    : SP duration in hours (0.5 for HH, 1.0 for hourly)

    Returns:
        df with baseline columns appended:
            baseline_import_cost_gbp    import cost per SP
            baseline_export_rev_gbp     export revenue per SP
            baseline_thermal_cost_gbp   thermal fuel cost per SP
            baseline_net_gbp            net baseline cost per SP
                                        = import_cost + thermal_cost - export_rev
    """
    required = [
        "net_demand_mwh",
        "thermal_gen_mw",
        "duos_gbp_mwh",
        "gduos_gbp_mwh",
        "nec_gbp_mwh",
        actual_price_col,
    ]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(
            f"calculate_baseline_csv() missing columns: {missing}. "
            "Ensure build_csv_optimiser_input() was called first."
        )

    df = df.copy()
    price = df[actual_price_col]

    # Import rate: price + DUoS + NEC (£/MWh, positive)
    import_rate = price + df["duos_gbp_mwh"] + df["nec_gbp_mwh"]

    # Export rate: price - GDUoS (GDUoS stored negative — subtract adds credit)
    # e.g. price=50, gduos=-88 → export_rate = 138 £/MWh
    export_rate = price - df["gduos_gbp_mwh"]

    # Import cost — only where site is net importing (net_demand_mwh > 0)
    df["baseline_import_cost_gbp"] = df["net_demand_mwh"].clip(lower=0) * import_rate

    # Export revenue — only where site has surplus (net_demand_mwh < 0)
    df["baseline_export_rev_gbp"] = df["net_demand_mwh"].clip(upper=0).abs() * export_rate

    # Thermal generation fuel cost — thermal_gen_mw × duration × MC
    df["baseline_thermal_cost_gbp"] = (
        df["thermal_gen_mw"] * sp_duration_hrs * thermal_mc_gbp_mwh
    )

    # Net baseline cost per SP
    df["baseline_net_gbp"] = (
        df["baseline_import_cost_gbp"]
        + df["baseline_thermal_cost_gbp"]
        - df["baseline_export_rev_gbp"]
    )

    return df
