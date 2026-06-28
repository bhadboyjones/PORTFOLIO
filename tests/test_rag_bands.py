"""RAG band assignment — weekday, weekend, bank holiday, midnight-crossing."""

import pandas as pd

from src.csv_pipeline import map_rag_bands
from src.duos_rates import get_duos_rates, convert_rates_to_model_units


def _bands(times, dno="SPEN", voltage="HV"):
    sched = convert_rates_to_model_units(get_duos_rates(dno, voltage))["rag_schedule"]
    ts = pd.to_datetime(times).tz_localize("Europe/London").tz_convert("UTC")
    df = pd.DataFrame({"startTime": ts})
    return list(map_rag_bands(df, sched["red"], sched["amber"], "startTime"))


def test_spen_weekend_red():
    # SPEN carries a confirmed weekend Red window 16:00–20:00.
    assert _bands(["2026-05-02 17:00"]) == ["red"]    # Saturday evening
    assert _bands(["2026-05-02 10:00"]) == ["green"]  # Saturday morning


def test_weekday_red():
    assert _bands(["2026-05-01 17:00"]) == ["red"]    # Friday in the red window


def test_bank_holiday_is_green():
    # 2026-05-04 is the early May bank holiday (Monday) — Green despite the
    # weekday red window; the following Tuesday is back to Red.
    assert _bands(["2026-05-04 17:00"]) == ["green"]
    assert _bands(["2026-05-05 17:00"]) == ["red"]


def test_midnight_crossing_window():
    ts = pd.to_datetime(
        ["2026-05-05 23:30", "2026-05-05 01:00", "2026-05-05 12:00"]
    ).tz_localize("Europe/London").tz_convert("UTC")
    df = pd.DataFrame({"startTime": ts})
    red = {"weekday": [["22:00", "02:00"]], "weekend": []}   # crosses midnight
    amber = {"weekday": [], "weekend": []}
    assert list(map_rag_bands(df, red, amber, "startTime")) == ["red", "red", "green"]
