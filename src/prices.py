"""
Price data pulls from Elexon BMRS API.

Pulls:
- System prices (imbalance) from DISEBSP endpoint
- Market Index Data (MID) as day-ahead proxy

All functions return DataFrames with startTime as UTC timestamp.
"""

import time
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import requests
import pandas as pd

from .config import ELEXON_BASE_URL
from .utils import get_json, extract_data, get_trailing_date_range


# ============================================================
# CACHE SETUP
# ============================================================

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# SYSTEM PRICES (IMBALANCE)
# ============================================================

def pull_system_prices(start_date=None, end_date=None, months_back=12, force_refresh=False):
    """
    Pull system sell prices (imbalance) from BMRS.
    
    Args:
        start_date: Explicit start date (date object or string)
        end_date: Explicit end date (date object or string)
        months_back: Fallback if no explicit dates (trailing from yesterday)
        force_refresh: Bypass cache
    
    Returns DataFrame with:
    - startTime: UTC timestamp
    - settlementDate, settlementPeriod
    - imb_price_gbp: System sell price (£/MWh)
    """
    # Determine date range
    if start_date is not None and end_date is not None:
        start = pd.Timestamp(start_date).date()
        end = pd.Timestamp(end_date).date()
    else:
        start, end = get_trailing_date_range(months_back)
    
    cache_file = CACHE_DIR / f"system_prices_{start}_{end}.parquet"
    if cache_file.exists() and not force_refresh:
        print(f"Loading cached: {cache_file.name}")
        return pd.read_parquet(cache_file)
    
    print(f"Pulling system prices: {start} → {end}")
    
    rows = []
    with requests.Session() as session:
        current = start
        while current <= end:
            url = f"{ELEXON_BASE_URL}/balancing/settlement/system-prices/{current}"
            data = get_json(session, url)
            rows.extend(extract_data(data))
            current += timedelta(days=1)
            time.sleep(0.05)
    
    df = pd.DataFrame(rows)
    
    if df.empty:
        print("No system price data returned")
        return df
    
    if "settlementDate" in df.columns:
        df["settlementDate"] = pd.to_datetime(df["settlementDate"]).dt.date
    if "settlementPeriod" in df.columns:
        df["settlementPeriod"] = pd.to_numeric(df["settlementPeriod"]).astype("Int64")
    if "startTime" in df.columns:
        df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    
    if "systemSellPrice" in df.columns:
        df = df.rename(columns={"systemSellPrice": "imb_price_gbp"})
    
    df.to_parquet(cache_file, index=False)
    print(f"Cached: {cache_file.name} ({len(df):,} rows)")
    
    return df


# ============================================================
# MID PRICES (DAY-AHEAD PROXY)
# ============================================================

def pull_mid_prices(start_date=None, end_date=None, months_back=12, force_refresh=False):
    """
    Pull Market Index Data (MID) prices from BMRS.
    
    Args:
        start_date: Explicit start date (date object or string)
        end_date: Explicit end date (date object or string)
        months_back: Fallback if no explicit dates (trailing from yesterday)
        force_refresh: Bypass cache
    
    Returns DataFrame with:
    - startTime: UTC timestamp
    - da_price_gbp: MID price (£/MWh)
    """
    # Determine date range
    if start_date is not None and end_date is not None:
        start = pd.Timestamp(start_date).date()
        end = pd.Timestamp(end_date).date()
    else:
        start, end = get_trailing_date_range(months_back)
    
    cache_file = CACHE_DIR / f"mid_prices_{start}_{end}.parquet"
    if cache_file.exists() and not force_refresh:
        print(f"Loading cached: {cache_file.name}")
        return pd.read_parquet(cache_file)
    
    print(f"Pulling MID prices: {start} → {end}")
    
    all_records = []
    current = pd.Timestamp(start)
    final = pd.Timestamp(end)
    chunk_days = 14
    
    while current < final:
        chunk_end = min(current + timedelta(days=chunk_days), final)
        
        url = f"{ELEXON_BASE_URL}/datasets/MID/stream"
        params = {"from": current.strftime("%Y-%m-%d"), "to": chunk_end.strftime("%Y-%m-%d")}
        
        print(f"  {current.date()} → {chunk_end.date()}...")
        resp = requests.get(url, params=params, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        
        if isinstance(data, list):
            all_records.extend(data)
        elif isinstance(data, dict) and "data" in data:
            all_records.extend(data["data"])
        
        current = chunk_end
    
    df = pd.DataFrame(all_records)
    
    if df.empty:
        print("No MID data returned")
        return df
    
    # Build timestamp from settlement date + period
    df["settlement_date"] = pd.to_datetime(df["settlementDate"])
    df["settlement_period"] = df["settlementPeriod"].astype(int)
    
    # Sort before DST handling
    df = df.sort_values(["settlement_date", "settlement_period"]).reset_index(drop=True)
    
    # Build UTC timestamp directly (avoids DST issues)
    df["startTime"] = build_utc_timestamp(df["settlement_date"], df["settlement_period"])
    
    # Filter to APX (most common reference)
    if "dataProvider" in df.columns:
        df_apx = df[df["dataProvider"] == "APXMIDP"]
        if not df_apx.empty:
            df = df_apx
    
    # Clean up
    df = df[["startTime", "price"]].copy()
    df = df.rename(columns={"price": "da_price_gbp"})
    df = df.sort_values("startTime").drop_duplicates("startTime").reset_index(drop=True)
    
    df.to_parquet(cache_file, index=False)
    print(f"Cached: {cache_file.name} ({len(df):,} rows)")
    
    return df


def build_utc_timestamp(settlement_dates, settlement_periods):
    """
    Build UTC timestamps from settlement date and period.
    
    Handles DST correctly by working out the UTC offset for each date.
    - UK is UTC+0 in winter (last Sun Oct to last Sun Mar)
    - UK is UTC+1 in summer (last Sun Mar to last Sun Oct)
    
    Settlement periods:
    - Normal day: 48 SPs (SP1 = 00:00, SP48 = 23:30 local)
    - March clock forward: 46 SPs (no 01:00-02:00 local)
    - October clock back: 50 SPs (01:00-02:00 local happens twice)
    """
    results = []
    
    for date_val, sp in zip(settlement_dates, settlement_periods):
        date_val = pd.Timestamp(date_val)
        year = date_val.year
        
        # Last Sunday of March (clocks forward)
        mar_last = pd.Timestamp(year=year, month=3, day=31)
        while mar_last.dayofweek != 6:
            mar_last -= timedelta(days=1)
        
        # Last Sunday of October (clocks back)
        oct_last = pd.Timestamp(year=year, month=10, day=31)
        while oct_last.dayofweek != 6:
            oct_last -= timedelta(days=1)
        
        # Determine UTC offset and minute calculation
        if date_val.date() == mar_last.date():
            # Clock forward day: 46 SPs
            # SPs 1-2 (00:00-01:00) are GMT, then clocks jump to 02:00 BST
            # SPs 3-46 are BST (02:00-23:30 local)
            if sp <= 2:
                minutes_from_midnight = (sp - 1) * 30
                utc_offset = 0
            else:
                # SP3 = 02:00 local BST = 01:00 UTC
                minutes_from_midnight = (sp + 1) * 30  # +2 SPs worth to skip missing hour
                utc_offset = 1
                
        elif date_val.date() == oct_last.date():
            # Clock back day: 50 SPs
            # SPs 1-4 (00:00-02:00) are BST
            # SPs 5-6 are the repeated 01:00-02:00 in GMT
            # SPs 7-50 (02:00-23:30) are GMT
            if sp <= 4:
                minutes_from_midnight = (sp - 1) * 30
                utc_offset = 1
            elif sp <= 6:
                # Repeated hour: SP5 = 01:00 GMT, SP6 = 01:30 GMT
                minutes_from_midnight = (sp - 5) * 30 + 60  # 01:00 + offset
                utc_offset = 0
            else:
                # After repeated hour: SP7 = 02:00 GMT
                minutes_from_midnight = (sp - 7) * 30 + 120  # 02:00 + offset
                utc_offset = 0
                
        elif mar_last.date() < date_val.date() < oct_last.date():
            # Normal BST day
            minutes_from_midnight = (sp - 1) * 30
            utc_offset = 1
        else:
            # Normal GMT day
            minutes_from_midnight = (sp - 1) * 30
            utc_offset = 0
        
        # Build UTC time
        local_time = pd.Timestamp(date_val.date()) + timedelta(minutes=minutes_from_midnight)
        utc_time = local_time - timedelta(hours=utc_offset)
        utc_time = utc_time.tz_localize("UTC")
        
        results.append(utc_time)
    
    return pd.Series(results)

def build_price_df(start_date=None, end_date=None, force_refresh=False):
    """
    Build combined price dataframe for optimiser input.

    Merges DA (MID) and imbalance (system) prices into one df.
    SP1-4 return null from Elexon MID stream — forward filled from
    previous day's last known DA price.

    Args:
        start_date: Start date (date object or string)
        end_date: End date (date object or string)
        force_refresh: Bypass cache

    Returns:
        DataFrame with:
        - startTime: UTC timestamp
        - da_price_gbp: MID day-ahead price (£/MWh)
        - imb_price_gbp: System sell price (£/MWh)
    """
    # Pull both series
    df_da = pull_mid_prices(
        start_date=start_date,
        end_date=end_date,
        force_refresh=force_refresh
    )

    df_imb = pull_system_prices(
        start_date=start_date,
        end_date=end_date,
        force_refresh=force_refresh
    )

    # Keep only what we need from system prices
    df_imb = df_imb[["startTime", "imb_price_gbp"]].copy()

    # Merge on startTime — outer so we keep all SPs from both series
    df = pd.merge(df_da, df_imb, on="startTime", how="outer")

    # Forward fill SP1-4 nulls in DA price
    df = df.sort_values("startTime").reset_index(drop=True)
    df["da_price_gbp"] = df["da_price_gbp"].ffill()

    return df