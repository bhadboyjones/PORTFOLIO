"""Licence-area rate table: checks against the 2026/27 statements."""

from types import SimpleNamespace

import pytest

from api.routes.run_csv import _rag_windows
from src.duos_rates import DUOS_RATES, VALID_DNOS, excess_rate_gbp_per_kva_day, get_duos_rates

AREAS = ["EPN", "LPN", "SPN", "EMID", "WMID", "SWEST", "SWALES",
         "NPGN", "NPGY", "ENWL", "SEPD", "SHEPD", "SPD", "SPM"]


def test_every_area_in_the_table():
    assert sorted(VALID_DNOS) == sorted(AREAS)


@pytest.mark.parametrize("area,lv,hv", [
    ("EPN", 8.04, 5.31), ("WMID", 10.66, 9.26), ("EMID", 7.68, 8.57),
    ("SWALES", 10.49, 10.43), ("SWEST", 12.18, 10.06),
    ("SPD", 5.34, 8.99), ("SPM", 6.87, 10),
])
def test_capacity_matches_the_statement(area, lv, hv):
    assert get_duos_rates(area, "LV")["capacity_p_per_kva_day"] == lv
    assert get_duos_rates(area, "HV")["capacity_p_per_kva_day"] == hv


@pytest.mark.parametrize("area", AREAS)
@pytest.mark.parametrize("voltage", ["LV", "HV"])
def test_excess_equals_capacity_in_verified_areas(area, voltage):
    r = get_duos_rates(area, voltage)
    assert r["excess_capacity_p_per_kva_day"] == r["capacity_p_per_kva_day"]


def test_excess_defaults_to_capacity_when_absent():
    r = dict(get_duos_rates("SPD", "LV"))
    del r["excess_capacity_p_per_kva_day"]
    assert excess_rate_gbp_per_kva_day(r) == r["capacity_p_per_kva_day"] / 100


def test_sp_has_weekend_red():
    assert get_duos_rates("SPM", "HV")["rag_schedule"]["red"]["weekend"] == [["16:00", "20:00"]]


def test_northeast_and_yorkshire_are_separate():
    assert get_duos_rates("NPGN", "LV")["duos_red_p_kwh"] == 8.522
    assert get_duos_rates("NPGY", "LV")["duos_red_p_kwh"] == 5.829


def _form(area, **changes):
    s = get_duos_rates(area, "LV")["rag_schedule"]
    red, amber = s["red"]["weekday"], s["amber"]["weekday"]
    base = dict(dno_key=area, voltage_level="LV",
                rag_red_start=red[0][0], rag_red_end=red[0][1],
                rag_amber_morning_start=amber[0][0], rag_amber_morning_end=amber[0][1],
                rag_amber_evening_start=amber[1][0], rag_amber_evening_end=amber[1][1],
                rag_weekend_amber_start="", rag_weekend_amber_end="")
    return SimpleNamespace(**{**base, **changes})


def test_untouched_form_keeps_londons_second_red_window():
    assert _rag_windows(_form("LPN")) == (None, None)
    assert len(get_duos_rates("LPN", "LV")["rag_schedule"]["red"]["weekday"]) == 2


def test_edited_form_overrides_the_schedule():
    red, _ = _rag_windows(_form("EPN", rag_red_start="15:00"))
    assert red["weekday"] == [["15:00", "19:00"]]
