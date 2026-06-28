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
