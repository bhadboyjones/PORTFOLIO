"""
CSV upload pipeline for BTM BESS optimisation.

Handles real site meter data uploads as an alternative to synthetic archetypes.
CSV input is MW throughout — no unit conversion applied.

Expected CSV columns:
    timestamp         half-hourly or hourly, Europe/London timezone
    net_demand_mw     grid boundary (positive = importing, negative = exporting)
                      already net of all on-site generation (PV + thermal)
    thermal_gen_mw    required only when thermal_gen_toggle=True
                      covers any dispatchable thermal asset (CHP, genset, gas engine,
                      fuel cell); used for baseline fuel cost only — not used by MILP

Call order for CSV mode:
    load_and_validate_csv()        validate and clean the uploaded file
    build_csv_optimiser_input()    join prices + DUoS, produce MILP-ready DataFrame
    calculate_baseline()           per-SP baseline cost without BESS (optimiser.py)
    run_optimiser()                MILP dispatch (unchanged from archetype mode)
    calculate_settlement()         BESS P&L (unchanged from archetype mode)
"""

import warnings
from typing import Optional

import numpy as np
import pandas as pd

from .duos_rates import get_duos_rates, convert_rates_to_model_units
from .prices import build_price_df
from .config import TOTAL_IMPORT_LEVIES_GBP_PER_MWH, UK_BANK_HOLIDAYS


# ---------------------------------------------------------------------------
# CSV load and validation
# ---------------------------------------------------------------------------

def load_and_validate_csv(
    filepath: str,
    chp_toggle: bool = False,
) -> tuple[pd.DataFrame, list[str], float, int]:
    """
    Load and validate a site meter CSV or XLSX file.

    Required columns: timestamp, net_demand_mw
    Conditional column: thermal_gen_mw (required if chp_toggle=True)

    Validation checks:
    - Required columns present
    - timestamp parseable; resolution detected from median gap
    - Resolution must be 30-minute or hourly (raises ValueError otherwise)
    - No all-NaN blocks in net_demand_mw
    - thermal_gen_mw present and non-negative if chp_toggle=True

    NaN values in numeric columns are filled with 0.0.
    Missing SPs (gaps in the timestamp sequence) are reported as warnings
    but not inserted — the caller's left-join will handle them naturally.

    Returns:
        (df, warns, sp_duration_hrs, n_sps_per_day) where
        df has columns: timestamp (UTC tz-aware), net_demand_mw, thermal_gen_mw.
        warns is a list of human-readable warning strings (may be empty).
        sp_duration_hrs is 0.5 for 30-min data, 1.0 for hourly data.
        n_sps_per_day is 48 for 30-min data, 24 for hourly data.
    """
    warns: list[str] = []

    # --- Load file ---
    fp = str(filepath).lower()
    if fp.endswith((".xlsx", ".xls")):
        raw = pd.read_excel(filepath)
    else:
        raw = pd.read_csv(filepath)

    raw.columns = [c.strip().lower().replace(" ", "_") for c in raw.columns]

    # --- Required columns ---
    if "timestamp" not in raw.columns:
        raise ValueError(
            "Missing required column: 'timestamp'. "
            "Expected column headers: timestamp, net_demand_mw"
            + (", thermal_gen_mw" if chp_toggle else "")
        )
    if "net_demand_mw" not in raw.columns:
        raise ValueError(
            "Missing required column: 'net_demand_mw'. "
            "Expected column headers: timestamp, net_demand_mw"
            + (", thermal_gen_mw" if chp_toggle else "")
        )
    if chp_toggle and "thermal_gen_mw" not in raw.columns:
        raise ValueError(
            "Thermal generation is enabled but 'thermal_gen_mw' column is missing "
            "from the upload."
        )

    # --- Parse timestamp ---
    # Try ISO-8601 first; fall back to day-first (UK meter exports are usually
    # DD/MM/YYYY). Never let pandas silently guess month-first on UK data.
    try:
        ts = pd.to_datetime(raw["timestamp"], format="ISO8601", utc=False)
    except (ValueError, TypeError):
        try:
            ts = pd.to_datetime(raw["timestamp"], dayfirst=True, utc=False)
            warns.append(
                "timestamp parsed as day-first (DD/MM/YYYY). If your data is "
                "month-first, re-export in ISO format (YYYY-MM-DD) and re-upload."
            )
        except Exception as e:
            raise ValueError(f"Could not parse 'timestamp' column: {e}")

    # Localise to Europe/London if naive, then convert to UTC. DST-invalid and
    # ambiguous local times become NaT (dropped below) instead of being shifted
    # onto a neighbouring SP, which would manufacture duplicate periods.
    if ts.dt.tz is None:
        ts = ts.dt.tz_localize("Europe/London", ambiguous="NaT", nonexistent="NaT")
    ts = ts.dt.tz_convert("UTC")

    # --- Build frame with all columns aligned to the source rows ---
    # ts, net_demand, thermal all carry raw's index, so they stay row-aligned
    # through the sort/dedup below (assigning net_demand after a sort would not).
    # Strip thousands separators before coercion so "1,234.5" doesn't silently
    # become NaN (which would otherwise be filled as 0.0 demand).
    nd = pd.to_numeric(
        raw["net_demand_mw"].astype(str).str.replace(",", "", regex=False).str.strip(),
        errors="coerce",
    )
    df = pd.DataFrame({"timestamp": ts, "net_demand_mw": nd})
    if chp_toggle:
        df["thermal_gen_mw"] = pd.to_numeric(
            raw["thermal_gen_mw"].astype(str).str.replace(",", "", regex=False).str.strip(),
            errors="coerce",
        )
    else:
        df["thermal_gen_mw"] = 0.0

    # --- Drop DST-invalid / unparseable timestamps ---
    n_bad_ts = int(df["timestamp"].isna().sum())
    if n_bad_ts > 0:
        warns.append(
            f"{n_bad_ts} rows had invalid or ambiguous timestamps "
            f"(e.g. the DST clock-change hour) and were dropped."
        )
        df = df[df["timestamp"].notna()]

    # --- Sort, then drop duplicate timestamps (keep first occurrence) ---
    df = df.sort_values("timestamp")
    dup = df["timestamp"].duplicated()
    if dup.any():
        warns.append(
            f"{int(dup.sum())} duplicate timestamps removed "
            f"(kept the first occurrence of each time interval)."
        )
        df = df[~dup]
    df = df.reset_index(drop=True)

    # --- Resolution detection ---
    if len(df) < 2:
        raise ValueError(
            "Too few rows to detect data resolution. "
            "Please provide at least 2 time intervals."
        )
    median_gap = df["timestamp"].diff().dropna().median()
    if median_gap == pd.Timedelta("30min"):
        sp_duration_hrs = 0.5
        n_sps_per_day   = 48
    elif median_gap == pd.Timedelta("60min"):
        sp_duration_hrs = 1.0
        n_sps_per_day   = 24
    else:
        raise ValueError(
            f"Unsupported data resolution ({median_gap}). "
            "flexiq accepts 30-minute or hourly interval data only."
        )

    # --- Interval regularity check ---
    expected_gap = pd.Timedelta(f"{int(sp_duration_hrs * 60)}min")
    diffs = df["timestamp"].diff().dropna()
    irregular = diffs[diffs != expected_gap]
    if not irregular.empty:
        warns.append(
            f"{len(irregular)} timestamp gaps or irregular intervals detected "
            f"(expected {expected_gap} spacing). Results may be affected."
        )

    # --- net_demand_mw NaN handling ---
    nan_count = int(df["net_demand_mw"].isna().sum())
    if nan_count == len(df):
        raise ValueError("'net_demand_mw' column contains no valid numeric values.")
    if nan_count > 0:
        warns.append(f"{nan_count} NaN values in net_demand_mw filled with 0.0.")
        df["net_demand_mw"] = df["net_demand_mw"].fillna(0.0)

    # --- Unit-magnitude sanity check ---
    p99 = df["net_demand_mw"].abs().quantile(0.99)
    if p99 > 50:
        warns.append(
            f"net_demand_mw 99th percentile is {p99:.1f} MW — values may be in kW "
            f"rather than MW. If so, divide by 1000 before uploading."
        )

    # --- thermal_gen_mw NaN / negative handling ---
    if chp_toggle:
        thm_nan = int(df["thermal_gen_mw"].isna().sum())
        if thm_nan > 0:
            warns.append(f"{thm_nan} NaN values in thermal_gen_mw filled with 0.0.")
            df["thermal_gen_mw"] = df["thermal_gen_mw"].fillna(0.0)
        if (df["thermal_gen_mw"] < 0).any():
            warns.append(
                "thermal_gen_mw contains negative values — these have been clipped to 0.0."
            )
            df["thermal_gen_mw"] = df["thermal_gen_mw"].clip(lower=0.0)

    # Remind the user that net_demand_mw must already be net of thermal output.
    # (The column is always present — set to 0.0 when thermal is disabled — so a
    # non-zero sum is the real signal that thermal data was supplied and used.)
    if df["thermal_gen_mw"].abs().sum() > 0:
        warns.append(
            "thermal_gen_mw detected — net_demand_mw is treated as the metered "
            "boundary flow, so on-site thermal generation must already be reflected "
            "in it. flexiq uses thermal_gen_mw only for baseline fuel cost, never to "
            "adjust net demand. If thermal output was not subtracted when preparing "
            "net_demand_mw, results will be incorrect."
        )

    # --- Check for gaps in the interval sequence ---
    if len(df) > 1:
        full_range = pd.date_range(
            df["timestamp"].iloc[0],
            df["timestamp"].iloc[-1],
            freq=f"{int(sp_duration_hrs * 60)}min",
            tz="UTC",
        )
        n_expected = len(full_range)
        n_actual   = len(df)
        if n_actual < n_expected:
            warns.append(
                f"{n_expected - n_actual} time intervals missing from upload "
                f"(expected {n_expected}, got {n_actual}). "
                f"Missing intervals are excluded from the optimisation."
            )

    return df, warns, sp_duration_hrs, n_sps_per_day


# ---------------------------------------------------------------------------
# RAG band mapping
# ---------------------------------------------------------------------------

def _parse_hhmm(s: str) -> int:
    """Convert 'HH:MM' string to minutes from midnight."""
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def _bank_holiday_dates(years) -> set:
    """Return the set of England & Wales bank-holiday `date` objects for given years."""
    out = set()
    for y in years:
        for d in UK_BANK_HOLIDAYS.get(y, []):
            out.add(pd.Timestamp(d).date())
    return out


def _window_mask(mins: pd.Series, s: int, e: int) -> pd.Series:
    """Boolean mask for minutes inside [s, e); handles windows that cross midnight (s > e)."""
    if s < e:
        return (mins >= s) & (mins < e)
    # crosses midnight, e.g. 22:00–02:00
    return (mins >= s) | (mins < e)


def map_rag_bands(
    df: pd.DataFrame,
    red_windows: dict,
    amber_windows: dict,
    timestamp_col: str = "timestamp",
) -> pd.Series:
    """
    Assign each SP to 'red', 'amber', or 'green' DUoS band.

    red_windows and amber_windows must be from the DNO's rag_schedule dict:
        {"weekday": [["HH:MM", "HH:MM"], ...], "weekend": [...]}

    Green = remainder (everything not matched by red or amber windows).

    Handles:
    - Europe/London timezone (DST-safe via tz_convert)
    - Separate weekday and weekend windows per band (e.g. SPEN weekend Red,
      SSEN weekend Amber)
    - Windows that cross midnight (start > end)
    - England & Wales bank holidays — charged Green (off-peak), overriding both
      weekday and weekend bands

    Returns:
        pd.Series of "red"/"amber"/"green" aligned to df.index.
    """
    ts = df[timestamp_col]
    if ts.dt.tz is None:
        raise ValueError("timestamp column must be timezone-aware (UTC expected).")

    local      = ts.dt.tz_convert("Europe/London")
    mins       = local.dt.hour * 60 + local.dt.minute
    is_weekend = local.dt.dayofweek >= 5  # 5=Sat, 6=Sun

    # Bank holidays → forced Green. (Years absent from UK_BANK_HOLIDAYS are simply
    # not flagged — band assignment still proceeds on weekday/weekend rules.)
    hols       = _bank_holiday_dates(local.dt.year.unique().tolist())
    is_holiday = (
        local.dt.date.isin(hols) if hols else pd.Series(False, index=df.index)
    )

    def _in_windows(windows: dict) -> pd.Series:
        """True where SP falls inside any window for its day type."""
        mask = pd.Series(False, index=df.index)
        for start_str, end_str in windows.get("weekday", []):
            s, e = _parse_hhmm(start_str), _parse_hhmm(end_str)
            mask |= (~is_weekend) & _window_mask(mins, s, e)
        for start_str, end_str in windows.get("weekend", []):
            s, e = _parse_hhmm(start_str), _parse_hhmm(end_str)
            mask |= is_weekend & _window_mask(mins, s, e)
        return mask

    red_mask   = (~is_holiday) & _in_windows(red_windows)
    amber_mask = (~is_holiday) & _in_windows(amber_windows)

    # Red takes priority over amber where windows overlap
    return pd.Series(
        np.select([red_mask, amber_mask], ["red", "amber"], default="green"),
        index=df.index,
        name="rag_band",
    )


# ---------------------------------------------------------------------------
# Build optimiser input DataFrame (CSV mode)
# ---------------------------------------------------------------------------

def build_csv_optimiser_input(
    csv_df: pd.DataFrame,
    dno_key: str,
    voltage_level: str,
    contracted_kva: float,
    price_exposure: str = "da",
    nec_gbp_mwh: Optional[float] = None,
    rate_overrides: Optional[dict] = None,
    force_refresh: bool = False,
    rag_red_windows: Optional[dict] = None,
    rag_amber_windows: Optional[dict] = None,
    sp_duration_hrs: float = 0.5,
    n_sps_per_day: int = 48,
) -> pd.DataFrame:
    """
    Build the full MILP-ready input DataFrame from validated CSV demand data.

    Produces the same column contract as data_builder.build_optimiser_input()
    so run_optimiser() and calculate_settlement() work identically in CSV mode.

    sp_duration_hrs and n_sps_per_day are returned by load_and_validate_csv()
    and must be threaded through from the caller.

    Args:
        csv_df          : output of load_and_validate_csv() — columns:
                          timestamp (UTC tz-aware), net_demand_mw, thermal_gen_mw
        dno_key         : one of VALID_DNOS (e.g. "NPG", "NGED")
        voltage_level   : "LV" or "HV"
        contracted_kva  : site contracted capacity in kVA
        price_exposure  : "da" or "imbalance"
        nec_gbp_mwh     : NEC levy (£/MWh); defaults to config TOTAL_IMPORT_LEVIES_GBP_PER_MWH
        rate_overrides  : optional dict of converted rates to override DNO defaults
        force_refresh   : bypass Elexon price cache
        rag_red_windows / rag_amber_windows : optional RAG band overrides
        sp_duration_hrs : SP duration in hours (0.5 for HH, 1.0 for hourly)
        n_sps_per_day   : time intervals per day (48 for HH, 24 for hourly)
    """
    if nec_gbp_mwh is None:
        nec_gbp_mwh = TOTAL_IMPORT_LEVIES_GBP_PER_MWH

    # --- Load and convert DNO rates ---
    raw_rates = get_duos_rates(dno_key, voltage_level)
    rates = convert_rates_to_model_units(raw_rates)
    if rate_overrides:
        rates.update(rate_overrides)

    # Guard against rate inversion (export rate exceeding import rate), which would
    # let the optimiser "buy and sell" within a single SP. Inversion is a property
    # of the rates, not the price level, so a reference price suffices.
    _ref_price = 100.0
    for band in ("red", "amber", "green"):
        import_rate = _ref_price + rates[f"duos_{band}_gbp_mwh"] + nec_gbp_mwh
        export_rate = _ref_price - rates[f"gduos_{band}_gbp_mwh"]
        if export_rate > import_rate:
            raise ValueError(
                f"Rate inversion in {band} band: export £{export_rate:.2f} > import "
                f"£{import_rate:.2f}/MWh. Check the DUoS/GDUoS rate overrides."
            )

    rag_schedule = rates["rag_schedule"]

    # Warn if ENWL placeholder schedule is in use
    if "_warning" in rag_schedule:
        warnings.warn(
            f"DNO '{dno_key}': {rag_schedule['_warning']}",
            UserWarning,
            stacklevel=2,
        )

    # --- Map RAG bands ---
    # Weekday windows respect UI overrides (pre-populated from DNO, editable);
    # weekend windows always come from the canonical DNO schedule unless the UI
    # explicitly supplies a non-empty weekend window. This keeps DNO-specific
    # weekend bands (e.g. SPEN weekend Red 16:00–20:00) from being silently lost.
    def _merge_windows(ui_windows, canonical):
        if ui_windows is None:
            return canonical
        return {
            "weekday": ui_windows.get("weekday") or canonical.get("weekday", []),
            "weekend": ui_windows["weekend"] if ui_windows.get("weekend") else canonical.get("weekend", []),
        }

    df = csv_df.copy().rename(columns={"timestamp": "startTime"})
    df["rag_band"] = map_rag_bands(
        df,
        red_windows=_merge_windows(rag_red_windows, rag_schedule["red"]),
        amber_windows=_merge_windows(rag_amber_windows, rag_schedule["amber"]),
        timestamp_col="startTime",
    )

    # --- Apply volumetric DUoS/GDUoS rates ---
    duos_map = {
        "red":   rates["duos_red_gbp_mwh"],
        "amber": rates["duos_amber_gbp_mwh"],
        "green": rates["duos_green_gbp_mwh"],
    }
    gduos_map = {
        "red":   rates["gduos_red_gbp_mwh"],    # negative
        "amber": rates["gduos_amber_gbp_mwh"],   # negative
        "green": rates["gduos_green_gbp_mwh"],   # negative
    }
    df["duos_gbp_mwh"]  = df["rag_band"].map(duos_map)
    df["gduos_gbp_mwh"] = df["rag_band"].map(gduos_map)

    # --- Standing charges converted to £/SP ---
    df["dduos_fixed_gbp_per_sp"]    = rates["fixed_gbp_per_day"] / n_sps_per_day
    df["dduos_capacity_gbp_per_sp"] = rates["capacity_gbp_per_kva_day"] * contracted_kva / n_sps_per_day
    df["gduos_fixed_gbp_per_sp"]    = rates["gduos_fixed_gbp_per_day"] / n_sps_per_day

    # --- NEC ---
    df["nec_gbp_mwh"] = nec_gbp_mwh

    # --- net_demand_mwh ---
    df["net_demand_mwh"] = df["net_demand_mw"] * sp_duration_hrs

    # --- Pull wholesale prices ---
    start_date = df["startTime"].min().date()
    end_date   = df["startTime"].max().date()
    df_prices  = build_price_df(
        start_date=start_date,
        end_date=end_date,
        force_refresh=force_refresh,
    )

    # Hourly data: average the two half-hourly prices within each hour so the
    # full hour isn't settled at the on-the-hour price (the HH:30 price would
    # otherwise be silently discarded by the left-join below).
    if sp_duration_hrs == 1.0:
        df_prices = (
            df_prices.set_index("startTime")
            .resample("1h").mean()
            .reset_index()
        )

    # Left join: keep only SPs present in the CSV
    df = pd.merge(df, df_prices, on="startTime", how="left")

    # Price NaNs (Elexon gaps). Above a small threshold, refuse to run rather than
    # silently settle a chunk of the period against £0; below it, fill and warn.
    n_rows = len(df)
    for col, label in [("da_price_gbp", "DA"), ("imb_price_gbp", "imbalance")]:
        nan_count = int(df[col].isna().sum())
        if nan_count == 0:
            continue
        if n_rows and nan_count / n_rows > 0.05:
            raise ValueError(
                f"{nan_count} of {n_rows} intervals ({nan_count / n_rows:.0%}) have no "
                f"{label} price — too many to fill safely. Check Elexon data "
                "coverage for the selected date range."
            )
        warnings.warn(
            f"{nan_count} NaN values in {label} price filled with 0.0 — "
            "check Elexon data coverage for the selected date range.",
            UserWarning,
            stacklevel=2,
        )
        df[col] = df[col].fillna(0.0)

    # Rename to model column names and create forecast = actual (perfect foresight)
    df = df.rename(columns={
        "da_price_gbp":  "da_actual_gbp",
        "imb_price_gbp": "imb_actual_gbp",
    })
    df["da_forecast_gbp"]  = df["da_actual_gbp"]
    df["imb_forecast_gbp"] = df["imb_actual_gbp"]

    df = df.drop(columns=["rag_band"], errors="ignore")
    df = df.sort_values("startTime").reset_index(drop=True)

    # Tag contiguity groups: a new group starts wherever there's a gap larger
    # than 1.5× the expected spacing. run_optimiser resets SOC at each group so
    # state never carries across a multi-hour/day hole as if it were one SP.
    expected_delta = pd.Timedelta(hours=sp_duration_hrs)
    df["chunk_group"] = (df["startTime"].diff() > expected_delta * 1.5).cumsum()

    return df


# Baseline cost is computed by the single shared engine optimiser.calculate_baseline()
# for both archetype and CSV modes — see src/optimiser.py.
