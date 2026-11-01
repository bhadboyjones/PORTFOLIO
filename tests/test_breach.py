"""Peak shaving slice 2: breach pricing, monthly carry, excess settlement."""

import numpy as np
import pandas as pd

from src.optimiser import (
    apply_excess_capacity, calculate_baseline, calculate_settlement, run_optimiser,
)

RATE = 0.10   # £/kVA/day


def _frame(demand, start="2025-01-06"):
    n = len(demand)
    price = np.full(n, 60.0)
    return pd.DataFrame({
        "startTime": pd.date_range(start, periods=n, freq="30min", tz="UTC"),
        "net_demand_mw": demand, "net_demand_mwh": np.asarray(demand) * 0.5,
        "duos_gbp_mwh": 0.0, "gduos_gbp_mwh": 0.0, "nec_gbp_mwh": 0.0,
        "dduos_fixed_gbp_per_sp": 0.0, "dduos_capacity_gbp_per_sp": 0.0,
        "gduos_fixed_gbp_per_sp": 0.0,
        "da_forecast_gbp": price, "da_actual_gbp": price,
        "imb_forecast_gbp": price, "imb_actual_gbp": price,
        "thermal_gen_mw": 0.0,
    })


def _bess(**extra):
    e = 0.9 ** 0.5
    return dict(power_mw=0.5, capacity_mwh=2.0, soc_min=0.05, soc_max=0.95, soc_initial=0.5,
                charge_efficiency=e, discharge_efficiency=e, deg_cost_gbp_mwh=8.0,
                max_cycles_per_day=1.5, export_limit_mw=0.0, contracted_kva=1000.0,
                import_cap_kw=1000.0, **extra)


def _run(demand, **extra):
    df = calculate_baseline(_frame(demand), thermal_mc_gbp_mwh=70.0, export_limit_mw=0.0)
    return run_optimiser(df, _bess(**extra), forecast_price_col="da_forecast_gbp",
                         actual_price_col="da_actual_gbp")


def _meter(out):
    return out["net_demand_mw"].clip(lower=0) - out["dis1_mw"] + out["charge2_mw"]


def _peaky():
    d = np.full(96, 0.6)
    d[34:38] = 1.2   # 4 half-hours, 200 kW over a 1,000 kW MIC
    return d


def test_without_a_rate_nothing_makes_the_battery_shave():
    # Slice 1 behaviour is untouched when breach pricing is off.
    assert _meter(_run(_peaky())).max() > 1.1


def test_breach_pricing_makes_the_battery_hold_the_mic():
    out = _run(_peaky(), excess_rate_gbp_per_kva_day=RATE, power_factor=1.0)
    assert _meter(out).max() <= 1.0 + 1e-6


def test_margin_holds_the_meter_below_the_mic():
    out = _run(_peaky(), excess_rate_gbp_per_kva_day=RATE, mic_margin_pct=5.0, power_factor=1.0)
    assert _meter(out).max() <= 0.95 + 1e-6


def test_grid_charging_does_not_cause_a_breach_for_arbitrage():
    out = _run(_peaky(), excess_rate_gbp_per_kva_day=RATE, power_factor=1.0)
    assert _meter(out)[out["charge2_mw"] > 0].max() <= 1.0 + 1e-6


def test_unshaveable_peak_pays_once_and_is_carried_across_chunks():
    # 1.8 MW against a 1.0 MW cap with a 0.5 MW battery leaves a 0.3 MW breach
    # the battery can't remove. A second, smaller peak in the next 3-day chunk
    # is already paid for, so the battery doesn't need to discharge for it.
    d = np.full(288, 0.6)
    d[30:32] = 1.8
    d[174:176] = 1.2
    out = _run(d, excess_rate_gbp_per_kva_day=RATE, power_factor=1.0)
    assert _meter(out).max() <= 1.3 + 1e-6
    assert out["dis1_mw"].iloc[174:176].sum() < 1e-6


def _settled(demand, **extra):
    df = calculate_baseline(_frame(demand), thermal_mc_gbp_mwh=70.0, export_limit_mw=0.0)
    bess = _bess(**extra)
    out = run_optimiser(df, bess, forecast_price_col="da_forecast_gbp", actual_price_col="da_actual_gbp")
    return calculate_settlement(out, bess, actual_price_col="da_actual_gbp")


def test_excess_settlement_worked_number():
    # January: 1,200 kVA worst half-hour, 1,000 kVA MIC, 31 days, £0.10.
    # 200 × 31 × 0.10 = £620 without the battery; the battery holds the MIC.
    s = _settled(_peaky(), excess_rate_gbp_per_kva_day=RATE, power_factor=1.0)
    before = s["net_settlement_gbp"].sum()
    base_before = s["baseline_net_gbp"].sum()
    out, rows = apply_excess_capacity(s, 1000.0, RATE)
    assert len(rows) == 1
    assert rows[0]["worst_wo_bess_kva"] == 1200.0
    assert abs(rows[0]["excess_wo_bess_gbp"] - 620.0) < 1e-6
    assert rows[0]["excess_w_bess_gbp"] < 1e-6
    assert abs(out["net_settlement_gbp"].sum() - before - 620.0) < 1e-6
    assert abs(out["baseline_net_gbp"].sum() - base_before - 620.0) < 1e-6


def test_power_factor_turns_kw_into_kva():
    # 1.2 MW at PF 0.8 is 1,500 kVA: 500 kVA over.
    s = _settled(_peaky())
    _, rows = apply_excess_capacity(s, 1000.0, RATE, power_factor=0.8)
    assert rows[0]["worst_wo_bess_kva"] == 1500.0


def test_excess_is_per_calendar_month():
    d = np.full(96, 0.6)
    d[40] = 1.2
    df = _frame(d, start="2025-01-30 12:00")   # runs across into February
    df = calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=0.0)
    for c in ("dis1_mw", "charge2_mw"):
        df[c] = 0.0
    df["net_settlement_gbp"] = 0.0
    _, rows = apply_excess_capacity(df, 1000.0, RATE)
    assert [r["month"] for r in rows] == ["2025-01", "2025-02"]
