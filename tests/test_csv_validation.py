"""CSV ingestion — day-first parsing, dedup, unit and thousands-separator handling."""

from src.csv_pipeline import load_and_validate_csv


def _write_csv(tmp_path, rows, header="timestamp,net_demand_mw"):
    p = tmp_path / "meter.csv"
    p.write_text(header + "\n" + "\n".join(rows) + "\n")
    return str(p)


def test_dayfirst_parsing(tmp_path):
    # DD/MM/YYYY — the 13th proves day-first (13 can't be a month).
    rows = ["13/01/2025 00:00,1.0", "13/01/2025 00:30,1.0", "13/01/2025 01:00,1.0"]
    df, warns, dur, n = load_and_validate_csv(_write_csv(tmp_path, rows))
    first_local = df["timestamp"].iloc[0].tz_convert("Europe/London")
    assert (first_local.day, first_local.month) == (13, 1)


def test_duplicate_timestamps_removed(tmp_path):
    rows = ["2025-01-01 00:00,1.0", "2025-01-01 00:30,2.0",
            "2025-01-01 00:30,9.0", "2025-01-01 01:00,3.0"]
    df, warns, dur, n = load_and_validate_csv(_write_csv(tmp_path, rows))
    assert len(df) == 3
    assert any("duplicate" in w.lower() for w in warns)


def test_unit_magnitude_warning(tmp_path):
    rows = [f"2025-01-01 {h:02d}:00,1500" for h in range(3)]  # 1500 "MW" → likely kW
    df, warns, dur, n = load_and_validate_csv(_write_csv(tmp_path, rows))
    assert any("kW" in w for w in warns)


def test_comma_thousands_separator(tmp_path):
    rows = ['2025-01-01 00:00,"1,234.5"', '2025-01-01 00:30,"1,200.0"',
            '2025-01-01 01:00,"1,100.0"']
    df, warns, dur, n = load_and_validate_csv(_write_csv(tmp_path, rows))
    assert abs(df["net_demand_mw"].iloc[0] - 1234.5) < 1e-6


# ---------------------------------------------------------------------------
# input_unit conversion — meters export energy per interval; model wants MW
# ---------------------------------------------------------------------------

import pytest

HH_ROWS = ["2025-01-01 00:00,0.5", "2025-01-01 00:30,0.5", "2025-01-01 01:00,0.5"]
HOURLY_ROWS = ["2025-01-01 00:00,0.5", "2025-01-01 01:00,0.5", "2025-01-01 02:00,0.5"]


def test_default_unit_is_mw_unchanged(tmp_path):
    df, *_ = load_and_validate_csv(_write_csv(tmp_path, HH_ROWS))
    assert df["net_demand_mw"].iloc[0] == pytest.approx(0.5)


def test_mwh_per_half_hour_becomes_double_mw(tmp_path):
    # 0.5 MWh in 30 min = 1.0 MW average; × 0.5 h later gives back 0.5 MWh.
    df, warns, dur, n = load_and_validate_csv(_write_csv(tmp_path, HH_ROWS), input_unit="mwh")
    assert dur == 0.5
    assert df["net_demand_mw"].iloc[0] == pytest.approx(1.0)
    assert df["net_demand_mw"].iloc[0] * dur == pytest.approx(0.5)  # round trip


def test_kwh_per_half_hour(tmp_path):
    rows = ["2025-01-01 00:00,500", "2025-01-01 00:30,500", "2025-01-01 01:00,500"]
    df, *_ = load_and_validate_csv(_write_csv(tmp_path, rows), input_unit="kwh")
    assert df["net_demand_mw"].iloc[0] == pytest.approx(1.0)  # 500 kWh / 30 min = 1 MW


def test_mwh_per_hour_equals_mw(tmp_path):
    df, warns, dur, n = load_and_validate_csv(_write_csv(tmp_path, HOURLY_ROWS), input_unit="mwh")
    assert dur == 1.0
    assert df["net_demand_mw"].iloc[0] == pytest.approx(0.5)


def test_kw_average_power(tmp_path):
    rows = ["2025-01-01 00:00,750", "2025-01-01 00:30,750", "2025-01-01 01:00,750"]
    df, *_ = load_and_validate_csv(_write_csv(tmp_path, rows), input_unit="kw")
    assert df["net_demand_mw"].iloc[0] == pytest.approx(0.75)


def test_thermal_column_converted_too(tmp_path):
    rows = ["2025-01-01 00:00,0.5,0.2", "2025-01-01 00:30,0.5,0.2", "2025-01-01 01:00,0.5,0.2"]
    path = _write_csv(tmp_path, rows, header="timestamp,net_demand_mw,thermal_gen_mw")
    df, *_ = load_and_validate_csv(path, chp_toggle=True, input_unit="mwh")
    assert df["thermal_gen_mw"].iloc[0] == pytest.approx(0.4)


def test_invalid_unit_rejected(tmp_path):
    with pytest.raises(ValueError):
        load_and_validate_csv(_write_csv(tmp_path, HH_ROWS), input_unit="gwh")
