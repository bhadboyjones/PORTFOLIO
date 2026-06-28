"""Baseline cost — export revenue is capped at the connection export limit."""

import pandas as pd

from src.optimiser import calculate_baseline


def _surplus_frame(n=48):
    idx = pd.date_range("2025-06-01", periods=n, freq="30min", tz="UTC")
    return pd.DataFrame({
        "startTime": idx,
        "net_demand_mwh": -1.0,   # 1 MWh surplus per SP (= 2 MW over 0.5 h)
        "thermal_gen_mw": 0.0,
        "duos_gbp_mwh": 10.0, "gduos_gbp_mwh": -5.0, "nec_gbp_mwh": 100.0,
        "da_actual_gbp": 50.0,
    })


def test_export_cap_limits_baseline_revenue():
    df = _surplus_frame()
    uncapped = calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=10.0)
    capped   = calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=0.5)
    zero     = calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=0.0)

    # Larger export limit credits more surplus; zero credits nothing (curtailed).
    assert uncapped["baseline_export_rev_gbp"].sum() > capped["baseline_export_rev_gbp"].sum()
    assert zero["baseline_export_rev_gbp"].sum() == 0.0
