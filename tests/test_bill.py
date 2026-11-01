"""Modelled site bill: lines tie back to the settlement."""

import numpy as np
import pandas as pd
import pytest

from src.bill import VAT_RATE, build_bill, tnuos_band
from src.optimiser import (
    apply_excess_capacity, calculate_baseline, calculate_settlement, run_optimiser,
)
from src.tariff import apply_tariff, normalise_tariff

F, A = "da_forecast_gbp", "da_actual_gbp"
DAYS = 2.0


def _frame():
    n = 96
    slot = np.arange(n) % 48
    price = np.where(slot < 14, 40.0, np.where(slot >= 34, 90.0, 60.0))
    red = (slot >= 32) & (slot < 38)
    nd = np.where((slot >= 20) & (slot < 26), -0.3, 0.8)
    return pd.DataFrame({
        "startTime": pd.date_range("2025-01-06", periods=n, freq="30min", tz="UTC"),
        "net_demand_mw": nd, "net_demand_mwh": nd * 0.5,
        "rag_band": np.where(red, "red", np.where(slot >= 14, "amber", "green")),
        "duos_gbp_mwh": np.where(red, 58.29, 1.72), "gduos_gbp_mwh": np.where(red, -48.95, -1.53),
        "nec_gbp_mwh": 104.01,
        "dduos_fixed_gbp_per_sp": 0.05, "dduos_capacity_gbp_per_sp": 0.1, "gduos_fixed_gbp_per_sp": 0.01,
        F: price, A: price, "imb_forecast_gbp": price, "imb_actual_gbp": price, "thermal_gen_mw": 0.0,
    })


def _run(export=0.5, mic=1000.0, excess=False, **t):
    tariff = normalise_tariff(t)
    e = 0.9 ** 0.5
    bess = dict(power_mw=0.5, capacity_mwh=1.0, soc_min=0.05, soc_max=0.95, soc_initial=0.5,
                charge_efficiency=e, discharge_efficiency=e, deg_cost_gbp_mwh=8.0,
                max_cycles_per_day=1.5, export_limit_mw=export, contracted_kva=mic)
    df = apply_tariff(_frame(), tariff, F, A)
    df = calculate_baseline(df, thermal_mc_gbp_mwh=70.0, export_limit_mw=export, actual_price_col=A)
    st = calculate_settlement(run_optimiser(df, bess, forecast_price_col=F, actual_price_col=A), bess, actual_price_col=A)
    months = []
    if excess:
        st, months = apply_excess_capacity(st, 700.0, 0.1)
    st["export_limit_mw"] = export
    return st, build_bill(st, A, tariff, "LV", mic, DAYS, 0.5, months), tariff


@pytest.mark.parametrize("kw", [
    dict(), dict(export=0.0), dict(energy_type="flat", energy_flat_gbp_mwh=150.0),
    dict(duos_bundled=True, policy_bundled=True, energy_type="flat", energy_flat_gbp_mwh=150.0),
    dict(gduos_passed_on=False, export_type="fixed", export_fixed_gbp_mwh=60.0),
    dict(energy_type="time_bands", energy_other_gbp_mwh=130.0,
         energy_bands=[{"start": "07:00", "end": "19:00", "rate_gbp_mwh": 180.0}]),
    dict(excess=True),
])
def test_bill_ties_back_to_the_settlement(kw):
    st, b, _ = _run(**kw)
    wo = st["baseline_net_gbp"].sum() + st["total_standing_gbp"].sum()
    assert b["total_wo_gbp"] - b["tnuos_gbp"] == pytest.approx(wo, abs=0.1)
    # Bill change plus wear is the battery's net benefit.
    change = b["total_wo_gbp"] - b["total_w_gbp"] - b["battery"]["wear_gbp"]
    assert change == pytest.approx(st["net_settlement_gbp"].sum(), abs=0.1)


def test_battery_panel_adds_up():
    _, b, _ = _run(excess=True)
    x = b["battery"]
    assert x["saved_gbp"] - x["charging_gbp"] + x["excess_saved_gbp"] - x["wear_gbp"] == pytest.approx(x["net_gbp"], abs=0.02)


def test_bundled_charges_show_as_inside_the_rate():
    _, b, _ = _run(duos_bundled=True, capacity_bundled=True, policy_bundled=True)
    labels = {l["label"]: l for s in b["sections"] for l in s["lines"]}
    assert labels["DUoS and TNUoS"]["included"] and labels["Policy and system charges"]["included"]
    assert b["tnuos_gbp"] == 0


def test_capacity_line_is_kva_days():
    _, b, _ = _run(mic=1000.0)
    line = next(l for s in b["sections"] for l in s["lines"] if l["label"] == "Capacity")
    assert line["qty_wo"] == 2000.0 and line["unit"] == "kVA-days"


def test_time_bands_get_one_energy_line_per_rate():
    _, b, _ = _run(energy_type="time_bands", energy_other_gbp_mwh=130.0,
                   energy_bands=[{"start": "07:00", "end": "19:00", "rate_gbp_mwh": 180.0}])
    assert [l["label"] for l in b["sections"][0]["lines"]] == ["Energy at 13.00p/kWh", "Energy at 18.00p/kWh"]


@pytest.mark.parametrize("v,kva,band,rate", [
    ("LV", 90, "LV1", 5.7974), ("LV", 91, "LV2", 11.5118), ("LV", 1000, "LV4", 38.1801),
    ("HV", 1100, "HV2", 117.1528), ("HV", 1101, "HV3", 185.4185), ("unknown", 100, "LV2", 11.5118),
])
def test_tnuos_band(v, kva, band, rate):
    assert tnuos_band(v, kva) == {"band": band, "gbp_per_day": rate}


def test_vat_rate():
    assert VAT_RATE == 0.20


def test_pipeline_keeps_the_band_column_the_bill_needs():
    # The bill groups lines by band, and a CSV run failed when this column was dropped.
    import inspect
    from src import csv_pipeline
    assert 'drop(columns=["rag_band"]' not in inspect.getsource(csv_pipeline)
