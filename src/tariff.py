"""
Tariff structures: turn wholesale prices and network charges into the rates a
site really pays. See docs/tariff_types.md.

Network and policy charges always exist. Each is either a separate line, or
already inside the rate the site entered, in which case it must not be added
again. Export is a separate contract from import.

The default tariff leaves a run exactly as it was: full pass-through at the
wholesale price.
"""

from typing import Any, Dict, Optional

import pandas as pd

ENERGY_TYPES = ("indexed", "percent", "adder", "time_bands", "flat")
EXPORT_TYPES = ("indexed", "percent", "fee", "fixed", "system")
MAX_BANDS = 3

DEFAULT_TARIFF: Dict[str, Any] = {
    "energy_type": "indexed",
    "energy_percent": 100.0,
    "energy_adder_gbp_mwh": 0.0,
    "energy_flat_gbp_mwh": 0.0,
    "energy_bands": [],          # [{"start": "HH:MM", "end": "HH:MM", "rate_gbp_mwh": x}]
    "energy_other_gbp_mwh": 0.0, # every period outside energy_bands
    "duos_bundled": False,
    "capacity_bundled": False,
    "policy_bundled": False,
    "export_type": "indexed",
    "export_percent": 100.0,
    "export_fee_gbp_mwh": 0.0,
    "export_fixed_gbp_mwh": 0.0,
    "gduos_passed_on": True,
}

EXPORT_FORECAST_COL = "export_forecast_gbp"
EXPORT_ACTUAL_COL = "export_actual_gbp"


def normalise_tariff(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Fill defaults and validate. Raises ValueError with a readable message."""
    unknown = set(raw or {}) - set(DEFAULT_TARIFF)
    if unknown:
        raise ValueError(f"Unknown tariff fields: {sorted(unknown)}")
    t = {**DEFAULT_TARIFF, **(raw or {})}
    if t["energy_type"] not in ENERGY_TYPES:
        raise ValueError(f"energy_type must be one of {list(ENERGY_TYPES)}")
    if t["export_type"] not in EXPORT_TYPES:
        raise ValueError(f"export_type must be one of {list(EXPORT_TYPES)}")
    if not 0 < float(t["energy_percent"]) <= 300:
        raise ValueError("energy_percent must be above 0 and at most 300")
    if not 0 <= float(t["export_percent"]) <= 300:
        raise ValueError("export_percent must be between 0 and 300")
    if len(t["energy_bands"]) > MAX_BANDS:
        raise ValueError(f"At most {MAX_BANDS} time bands")
    if t["energy_type"] == "time_bands" and not t["energy_bands"]:
        raise ValueError("Time bands need at least one band")
    for b in t["energy_bands"]:
        _minutes(b["start"]), _minutes(b["end"])
        float(b["rate_gbp_mwh"])
    return t


def _minutes(hhmm: str) -> int:
    h, m = str(hhmm).split(":")
    h, m = int(h), int(m)
    if not (0 <= h <= 24 and 0 <= m < 60):
        raise ValueError(f"Bad time: {hhmm}")
    return h * 60 + m


def _band_rates(start_time: pd.Series, t: Dict[str, Any]) -> pd.Series:
    """Fixed rate per period from UK local time. Earlier bands win overlaps."""
    times = pd.to_datetime(start_time)
    if times.dt.tz is not None:
        times = times.dt.tz_convert("Europe/London")
    mins = times.dt.hour * 60 + times.dt.minute
    rate = pd.Series(float(t["energy_other_gbp_mwh"]), index=start_time.index)
    for b in reversed(t["energy_bands"]):
        s, e = _minutes(b["start"]), _minutes(b["end"])
        inside = (mins >= s) & (mins < e) if s < e else (mins >= s) | (mins < e)
        rate[inside] = float(b["rate_gbp_mwh"])
    return rate


def _energy(price: pd.Series, start_time: pd.Series, t: Dict[str, Any]) -> pd.Series:
    kind = t["energy_type"]
    if kind == "percent":
        return price * float(t["energy_percent"]) / 100.0
    if kind == "adder":
        return price + float(t["energy_adder_gbp_mwh"])
    if kind == "time_bands":
        return _band_rates(start_time, t)
    if kind == "flat":
        return pd.Series(float(t["energy_flat_gbp_mwh"]), index=price.index)
    return price


def _export(price: pd.Series, system: pd.Series, t: Dict[str, Any]) -> pd.Series:
    kind = t["export_type"]
    if kind == "percent":
        return price * float(t["export_percent"]) / 100.0
    if kind == "fee":
        return price - float(t["export_fee_gbp_mwh"])
    if kind == "fixed":
        return pd.Series(float(t["export_fixed_gbp_mwh"]), index=price.index)
    if kind == "system":
        return system
    return price


def apply_tariff(
    df: pd.DataFrame, tariff: Dict[str, Any], forecast_col: str, actual_col: str,
) -> pd.DataFrame:
    """
    Rewrite an optimiser input frame to the rates this tariff pays.

    forecast_col and actual_col become the site's import energy rate. Export
    energy goes in its own two columns, which the optimiser uses when present.
    Bundled charges are zeroed, because they are already inside the entered rate.
    """
    df = df.copy()
    t = tariff
    # Export first: it needs the wholesale price before import overwrites it.
    df[EXPORT_FORECAST_COL] = _export(df[forecast_col], df["imb_forecast_gbp"], t)
    df[EXPORT_ACTUAL_COL] = _export(df[actual_col], df["imb_actual_gbp"], t)
    if forecast_col == actual_col:
        raise ValueError("forecast_col and actual_col must differ")
    df[forecast_col] = _energy(df[forecast_col], df["startTime"], t)
    df[actual_col] = _energy(df[actual_col], df["startTime"], t)

    if t["duos_bundled"]:
        df["duos_gbp_mwh"] = 0.0
        df["dduos_fixed_gbp_per_sp"] = 0.0
    if t["capacity_bundled"]:
        df["dduos_capacity_gbp_per_sp"] = 0.0
    if t["policy_bundled"]:
        df["nec_gbp_mwh"] = 0.0
    if not t["gduos_passed_on"]:
        df["gduos_gbp_mwh"] = 0.0
        df["gduos_fixed_gbp_per_sp"] = 0.0
    return df


def has_time_signal(df: pd.DataFrame, actual_col: str) -> bool:
    """False when the site pays one import rate all year, so nothing to arbitrage."""
    rate = df[actual_col] + df["duos_gbp_mwh"] + df["nec_gbp_mwh"]
    return float(rate.max() - rate.min()) > 0.01
