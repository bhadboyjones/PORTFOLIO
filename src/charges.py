"""
Network charges: DUoS and GDUoS tagging for half-hourly data.

Assigns RAG bands (red/amber/green) based on time of day
and applies DNO-specific tariff rates.
"""

import numpy as np
import pandas as pd

from .config import NETWORK_CONFIG_NEC_HV, UK_BANK_HOLIDAYS


def get_bank_holidays_set(years):
    """Convert bank holidays dict to a set of timestamps for fast lookup."""
    dates = set()
    for year in years:
        if year in UK_BANK_HOLIDAYS:
            dates.update(pd.Timestamp(d) for d in UK_BANK_HOLIDAYS[year])
    return dates


def assign_rag_band(local_time, rag_config, weekends_green=True, bank_holidays_green=True):
    """
    Assign red/amber/green band to each timestamp.
    
    Args:
        local_time: Series of UK local timestamps
        rag_config: Dict with 'red' and 'amber' time windows as (start_mins, end_mins)
        weekends_green: Weekends always green?
        bank_holidays_green: Bank holidays always green?
    
    Returns:
        Series of 'red', 'amber', or 'green'
    """
    mins = local_time.dt.hour * 60 + local_time.dt.minute
    is_weekend = local_time.dt.dayofweek >= 5
    
    # Bank holiday lookup
    years = local_time.dt.year.unique().tolist()
    bank_hols = get_bank_holidays_set(years)
    is_bank_hol = local_time.dt.normalize().isin(bank_hols)
    
    # Off-peak days = weekends and/or bank holidays
    is_offpeak_day = (weekends_green & is_weekend) | (bank_holidays_green & is_bank_hol)
    
    def in_windows(mins_series, windows):
        mask = pd.Series(False, index=mins_series.index)
        for start, end in windows:
            mask |= (mins_series >= start) & (mins_series < end)
        return mask
    
    red_mask = (~is_offpeak_day) & in_windows(mins, rag_config.get("red", []))
    amber_mask = (~is_offpeak_day) & in_windows(mins, rag_config.get("amber", []))
    
    return pd.Series(
        np.select([red_mask, amber_mask], ["red", "amber"], default="green"),
        index=local_time.index,
    )


def build_network_charges(start_utc, end_utc, config=NETWORK_CONFIG_NEC_HV):
    """
    Build half-hourly network charges for a time window.
    
    Args:
        start_utc: Start timestamp (UTC)
        end_utc: End timestamp (UTC)
        config: Network config dict (default: Northern Powergrid NE HV)
    
    Returns:
        DataFrame with startTime, time_band, dduos_gbp_per_mwh, gduos_gbp_per_mwh, etc.
    """
    # Build HH index
    idx = pd.date_range(start_utc, end_utc, freq="30min", inclusive="left")
    df = pd.DataFrame({"startTime": idx})
    
    # Convert to UK local for RAG banding
    local = df["startTime"].dt.tz_convert("Europe/London")
    
    # Assign RAG band
    df["time_band"] = assign_rag_band(
        local,
        config["rag_bands"],
        weekends_green=config.get("weekends_are_green", True),
        bank_holidays_green=config.get("bank_holidays_are_green", True),
    )
    
    # Map rates
    df["dduos_gbp_per_mwh"] = df["time_band"].map(config["dduos_gbp_per_mwh"])
    df["gduos_gbp_per_mwh"] = df["time_band"].map(config["gduos_gbp_per_mwh"])
    
    # Fixed charges (per SP for convenience — divide by 48 when summing daily)
    df["dduos_fixed_p_per_day"] = config.get("dduos_fixed_p_per_day", 0)
    df["dduos_capacity_p_per_kva_day"] = config.get("dduos_capacity_p_per_kva_day", 0)
    df["gduos_fixed_p_per_day"] = config.get("gduos_fixed_p_per_day", 0)
    
    return df