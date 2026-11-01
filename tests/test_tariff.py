"""Tariff structures: rates a site really pays, and what a battery can earn."""

import numpy as np
import pandas as pd
import pytest

from src.optimiser import calculate_baseline, calculate_settlement, run_optimiser
from src.tariff import apply_tariff, has_time_signal, normalise_tariff

F, A = "da_forecast_gbp", "da_actual_gbp"


def _frame(n=96):
    # Starts at midnight UTC in January, so UK local time equals the index.
    idx = pd.date_range("2025-01-06", periods=n, freq="30min", tz="UTC")
    price = np.where(np.arange(n) % 48 < 14, 40.0, np.where(np.arange(n) % 48 >= 34, 90.0, 60.0))
    price = price.astype(float)
    red = (np.arange(n) % 48 >= 32) & (np.arange(n) % 48 < 38)
    return pd.DataFrame({
        "startTime": idx, "net_demand_mw": 0.8, "net_demand_mwh": 0.4,
        "duos_gbp_mwh": np.where(red, 58.29, 1.72), "gduos_gbp_mwh": np.where(red, -48.95, -1.53),
        "nec_gbp_mwh": 103.75,
        "dduos_fixed_gbp_per_sp": 0.05, "dduos_capacity_gbp_per_sp": 0.1, "gduos_fixed_gbp_per_sp": 0.01,
        F: price, A: price, "imb_forecast_gbp": price + 5, "imb_actual_gbp": price + 5,
        "thermal_gen_mw": 0.0,
    })


def _apply(**t):
    return apply_tariff(_frame(), normalise_tariff(t), F, A)


def test_default_leaves_rates_unchanged():
    base, out = _frame(), _apply()
    assert out[A].equals(base[A]) and out["export_actual_gbp"].equals(base[A])
    assert out["duos_gbp_mwh"].equals(base["duos_gbp_mwh"])


@pytest.mark.parametrize("t,expected", [
    (dict(energy_type="percent", energy_percent=105.0), 42.0),   # 40 × 1.05
    (dict(energy_type="adder", energy_adder_gbp_mwh=5.0), 45.0),  # 40 + 5
    (dict(energy_type="flat", energy_flat_gbp_mwh=150.0), 150.0),
])
def test_energy_rate_at_a_40_pound_price(t, expected):
    assert _apply(**t)[A].iloc[0] == pytest.approx(expected)


def test_time_bands_and_the_rate_outside_them():
    out = _apply(energy_type="time_bands", energy_other_gbp_mwh=131.6,
                 energy_bands=[{"start": "07:00", "end": "23:00", "rate_gbp_mwh": 181.4}])
    assert out[A].iloc[0] == 131.6       # 00:00
    assert out[A].iloc[20] == 181.4      # 10:00
    assert out[A].iloc[47] == 131.6      # 23:30


def test_band_crossing_midnight():
    out = _apply(energy_type="time_bands", energy_other_gbp_mwh=100.0,
                 energy_bands=[{"start": "23:00", "end": "07:00", "rate_gbp_mwh": 80.0}])
    assert out[A].iloc[0] == 80.0 and out[A].iloc[46] == 80.0 and out[A].iloc[20] == 100.0


@pytest.mark.parametrize("t,expected", [
    (dict(export_type="percent", export_percent=95.0), 38.0),
    (dict(export_type="fee", export_fee_gbp_mwh=5.0), 35.0),
    (dict(export_type="fixed", export_fixed_gbp_mwh=60.0), 60.0),
    (dict(export_type="system"), 45.0),
])
def test_export_rate_at_a_40_pound_price(t, expected):
    assert _apply(**t)["export_actual_gbp"].iloc[0] == pytest.approx(expected)


def test_export_uses_wholesale_even_on_a_flat_import():
    out = _apply(energy_type="flat", energy_flat_gbp_mwh=150.0, export_type="percent", export_percent=100.0)
    assert out["export_actual_gbp"].iloc[0] == 40.0


def test_bundled_charges_are_not_added_again():
    out = _apply(duos_bundled=True, capacity_bundled=True, policy_bundled=True)
    assert (out["duos_gbp_mwh"] == 0).all() and (out["nec_gbp_mwh"] == 0).all()
    assert (out["dduos_capacity_gbp_per_sp"] == 0).all() and (out["dduos_fixed_gbp_per_sp"] == 0).all()


def test_capacity_can_stay_a_separate_line():
    out = _apply(duos_bundled=True, policy_bundled=True)
    assert (out["dduos_capacity_gbp_per_sp"] == 0.1).all()


def test_gduos_switch_is_independent_of_import():
    out = _apply(gduos_passed_on=False)
    assert (out["gduos_gbp_mwh"] == 0).all() and (out["duos_gbp_mwh"] > 0).all()


def test_flat_all_inclusive_has_no_time_signal():
    flat = dict(energy_type="flat", energy_flat_gbp_mwh=150.0, duos_bundled=True, policy_bundled=True)
    assert not has_time_signal(_apply(**flat), A)
    assert has_time_signal(_apply(), A)
    assert has_time_signal(_apply(energy_type="flat", energy_flat_gbp_mwh=100.0), A)  # DUoS still varies


def _net(tariff):
    e = 0.9 ** 0.5
    bess = dict(power_mw=0.5, capacity_mwh=1.0, soc_min=0.05, soc_max=0.95, soc_initial=0.5,
                charge_efficiency=e, discharge_efficiency=e, deg_cost_gbp_mwh=8.0,
                max_cycles_per_day=1.5, export_limit_mw=0.0, contracted_kva=2000.0)
    df = apply_tariff(_frame(), normalise_tariff(tariff), F, A)
    df = calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=0.0, actual_price_col=A)
    out = run_optimiser(df, bess, forecast_price_col=F, actual_price_col=A)
    return out, calculate_settlement(out, bess, actual_price_col=A)


def test_flat_all_inclusive_battery_never_recharges():
    # It may spend some opening charge inside the end-of-chunk tolerance, but a
    # cycle loses money, so it never buys energy back.
    out, _ = _net(dict(energy_type="flat", energy_flat_gbp_mwh=150.0, duos_bundled=True, policy_bundled=True))
    assert out["total_charge_mw"].sum() < 1e-6


def test_flat_energy_with_passed_through_duos_still_trades():
    out, st = _net(dict(energy_type="flat", energy_flat_gbp_mwh=100.0))
    assert out["total_dis_mw"].sum() > 0 and st["net_settlement_gbp"].sum() > 0


def test_settlement_prices_export_on_the_export_contract():
    e = 0.9 ** 0.5
    bess = dict(power_mw=0.5, capacity_mwh=1.0, soc_min=0.05, soc_max=0.95, soc_initial=0.5,
                charge_efficiency=e, discharge_efficiency=e, deg_cost_gbp_mwh=8.0,
                max_cycles_per_day=1.5, export_limit_mw=0.5, contracted_kva=2000.0)
    df = apply_tariff(_frame(), normalise_tariff(dict(export_type="fixed", export_fixed_gbp_mwh=60.0, gduos_passed_on=False)), F, A)
    df = calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=0.5, actual_price_col=A)
    st = calculate_settlement(run_optimiser(df, bess, forecast_price_col=F, actual_price_col=A), bess, actual_price_col=A)
    assert (st["export_rate_gbp"] == 60.0).all()


def test_bad_tariff_rejected():
    for bad in (dict(energy_type="magic"), dict(export_type="x"), dict(nope=1), dict(energy_percent=0),
                dict(energy_type="time_bands"), dict(energy_bands=[{"start": "99:00", "end": "07:00", "rate_gbp_mwh": 1}])):
        with pytest.raises(ValueError):
            normalise_tariff(bad)
