"""
Utility functions: HTTP helpers and date calculations.

These are shared across multiple modules (prices, charges, etc.)
"""

import time
from datetime import date, timedelta
import calendar
import requests


# ============================================================
# HTTP HELPERS
# ============================================================

def get_json(session, url, params=None, retries=5, backoff_s=1.0):
    """
    GET JSON from URL with retry logic and exponential backoff.
    
    Why retries? APIs sometimes return 429 (rate limit) or have
    transient errors. This handles that gracefully.
    """
    last_err = None
    for i in range(retries):
        try:
            r = session.get(url, params=params, timeout=60)
            if r.status_code == 429:  # Rate limited
                time.sleep(backoff_s * (2 ** i))  # Exponential backoff
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
            time.sleep(backoff_s * (2 ** i))
    
    raise RuntimeError(f"Failed after {retries} tries: {url}\nLast error: {last_err}")


def extract_data(payload):
    """
    Extract data array from BMRS API response.
    
    BMRS returns different shapes depending on endpoint:
    - {'data': [...]}
    - [...]
    - {'items': [...]}
    
    This normalises them all to just the list.
    """
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    if isinstance(payload, list):
        return payload
    for key in ("items", "results"):
        if isinstance(payload, dict) and key in payload:
            return payload[key]
    
    raise ValueError(f"Unexpected payload shape: {type(payload)}")


# ============================================================
# DATE HELPERS
# ============================================================

def get_trailing_date_range(months_back=12):
    """
    Get start and end dates for trailing X months.
    
    Returns (start_date, end_date) where:
    - end_date = yesterday (last fully settled day)
    - start_date = end_date minus months_back
    
    Why yesterday? Today's SPs may not be fully settled yet.
    """
    end = date.today() - timedelta(days=1)
    
    # Calculate start date (handle month wraparound)
    target_month = end.month - (months_back % 12)
    target_year = end.year - (months_back // 12)
    if target_month <= 0:
        target_month += 12
        target_year -= 1
    
    # Clamp day for short months (e.g., 31 Mar -> 28 Feb)
    max_day = calendar.monthrange(target_year, target_month)[1]
    start = date(target_year, target_month, min(end.day, max_day))
    
    return start, end