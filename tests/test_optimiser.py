"""Optimiser invariants — SOC conservation and export-limit feasibility."""

import numpy as np
import pandas as pd

from src.optimiser import run_optimiser, calculate_baseline, calculate_settlement


def _frame(n=240, surplus=False):
    idx = pd.date_range("2025-01-06", periods=n, freq="30min", tz="UTC")
    price = 60 + 40 * np.sin(np.arange(n) * 2 * np.pi / 48)
    nd = np.full(n, -2.5) if surplus else 0.8 + 0.3 * np.sin(np.arange(n) * 2 * np.pi / 48)
    df = pd.DataFrame({
        "startTime": idx,
        "net_demand_mw": nd,
        "duos_gbp_mwh": 10.0, "gduos_gbp_mwh": -5.0, "nec_gbp_mwh": 100.0,
        "dduos_fixed_gbp_per_sp": 0.05, "dduos_capacity_gbp_per_sp": 0.1,
        "gduos_fixed_gbp_per_sp": 0.01,
        "da_forecast_gbp": price, "da_actual_gbp": price,
        "imb_forecast_gbp": price, "imb_actual_gbp": price,
        "thermal_gen_mw": 0.0,
    })
    df["net_demand_mwh"] = df["net_demand_mw"] * 0.5
    return df


def _bess(export_limit=0.5, contracted_kva=2000.0):
    e = 0.9 ** 0.5
    return dict(power_mw=1.0, capacity_mwh=2.0, soc_min=0.05, soc_max=0.95,
                soc_initial=0.5, charge_efficiency=e, discharge_efficiency=e,
                deg_cost_gbp_mwh=8.0, max_cycles_per_day=1.5,
                export_limit_mw=export_limit, contracted_kva=contracted_kva)


def test_soc_conserved_across_chunk_boundary():
    # 240 SPs > 144 (one 3-day chunk), so this spans a chunk boundary — the
    # exact place the old formulation handed out free dispatch in the last SP.
    df = _frame(n=240)
    bess = _bess()
    dfb = calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=bess["export_limit_mw"])
    out = run_optimiser(dfb, bess, forecast_price_col="da_forecast_gbp", actual_price_col="da_actual_gbp")

    e = 0.9 ** 0.5
    soc = bess["soc_initial"] * bess["capacity_mwh"]
    for i in range(len(out)):
        soc += (out["charge1_mw"][i] + out["charge2_mw"][i]) * 0.5 * e \
             - (out["dis1_mw"][i] + out["dis2_mw"][i]) * 0.5 / e
        assert abs(soc - out["soc_mwh"][i]) < 1e-5, f"SOC balance violated at row {i}"


def test_zero_export_feasible_and_no_grid_export():
    # Constant 2.5 MW surplus exceeds the 1 MW battery; with export_limit=0 the
    # curtailment slack keeps the model feasible and forbids any grid export.
    df = _frame(n=96, surplus=True)
    bess = _bess(export_limit=0.0, contracted_kva=3000.0)
    dfb = calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=0.0)
    out = run_optimiser(dfb, bess, forecast_price_col="da_forecast_gbp", actual_price_col="da_actual_gbp")
    assert out["dis2_mw"].sum() < 1e-6
    assert dfb["baseline_export_rev_gbp"].sum() < 1e-6


def _surplus_then_demand_frame(n=48):
    idx = pd.date_range("2025-06-02", periods=n, freq="30min", tz="UTC")
    nd = np.full(n, 0.1)
    nd[20:28] = -1.5   # midday PV surplus
    nd[34:44] = 1.2    # evening demand peak
    price = np.full(n, 60.0)
    df = pd.DataFrame({
        "startTime": idx, "net_demand_mw": nd,
        "duos_gbp_mwh": 10.0, "gduos_gbp_mwh": -5.0, "nec_gbp_mwh": 100.0,
        "dduos_fixed_gbp_per_sp": 0.0, "dduos_capacity_gbp_per_sp": 0.0,
        "gduos_fixed_gbp_per_sp": 0.0,
        "da_forecast_gbp": price, "da_actual_gbp": price,
        "imb_forecast_gbp": price, "imb_actual_gbp": price,
        "thermal_gen_mw": 0.0,
    })
    df["net_demand_mwh"] = df["net_demand_mw"] * 0.5
    return df


def test_charge1_opp_cost_respects_export_limit():
    # Charging from surplus that could never be exported (export_limit=0) must
    # carry zero opportunity cost; the same charging when export is unconstrained
    # carries the full foregone-export cost.
    df = _surplus_then_demand_frame()

    b0 = _bess(export_limit=0.0, contracted_kva=3000.0)
    b0["deg_cost_gbp_mwh"] = 2.0
    s0 = calculate_settlement(
        run_optimiser(calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=0.0),
                      b0, forecast_price_col="da_forecast_gbp", actual_price_col="da_actual_gbp"),
        b0, actual_price_col="da_actual_gbp")

    b5 = _bess(export_limit=5.0, contracted_kva=3000.0)
    b5["deg_cost_gbp_mwh"] = 2.0
    s5 = calculate_settlement(
        run_optimiser(calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=5.0),
                      b5, forecast_price_col="da_forecast_gbp", actual_price_col="da_actual_gbp"),
        b5, actual_price_col="da_actual_gbp")

    assert s0["charge1_mw"].sum() > 0                         # battery uses the free surplus
    assert s0["charge1_opp_cost_gbp"].sum() < 1e-6           # but pays no opp cost
    assert s5["charge1_opp_cost_gbp"].sum() > 1.0            # exportable surplus does cost
