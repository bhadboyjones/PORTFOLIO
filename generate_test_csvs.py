"""
generate_test_csvs.py
=====================
Generates synthetic site meter CSVs for CSV upload mode testing.

Produces 4 files in outputs/test_data/:
  - small_office_hh.csv          30-min (HH), no thermal
  - small_office_hourly.csv      60-min, no thermal
  - medium_industrial_hh.csv     30-min (HH), with thermal_gen_mw
  - medium_industrial_hourly.csv 60-min, with thermal_gen_mw

Date range: 2024-01-01 → 2024-03-01 (2 months, 60 days)
Seeds match archetype mode so results can be cross-checked.

Run from project root:
    python generate_test_csvs.py
"""

import os
import sys
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))

from src.generation import generate_site_profile
from src.config import SITE_ARCHETYPES

START = "2024-01-01T00:00:00Z"
END   = "2024-03-01T00:00:00Z"

OUT_DIR = os.path.join(os.path.dirname(__file__), "outputs", "test_data")
os.makedirs(OUT_DIR, exist_ok=True)


def to_hourly(df_hh):
    """Resample HH DataFrame to hourly by averaging power (MW) values."""
    df = df_hh.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.floor("h")
    num_cols = [c for c in df.columns if c != "timestamp"]
    return df.groupby("timestamp")[num_cols].mean().reset_index()


def make_small_office():
    params = SITE_ARCHETYPES["small_office"]
    df = generate_site_profile(START, END, params, pv_seed=100, chp_seed=200)

    out = df[["startTime", "net_demand_mw"]].copy()
    out = out.rename(columns={"startTime": "timestamp"})
    out["timestamp"] = pd.to_datetime(out["timestamp"]).dt.strftime("%Y-%m-%dT%H:%M:%S")

    hh_path = os.path.join(OUT_DIR, "small_office_hh.csv")
    out.to_csv(hh_path, index=False)
    print(f"Saved {hh_path}  ({len(out)} rows, HH)")

    hourly = to_hourly(out)
    hourly["timestamp"] = pd.to_datetime(hourly["timestamp"]).dt.strftime("%Y-%m-%dT%H:%M:%S")
    h_path = os.path.join(OUT_DIR, "small_office_hourly.csv")
    hourly.to_csv(h_path, index=False)
    print(f"Saved {h_path}  ({len(hourly)} rows, hourly)")


def make_medium_industrial():
    params = SITE_ARCHETYPES["medium_industrial"]
    df = generate_site_profile(START, END, params, pv_seed=101, chp_seed=201)

    out = df[["startTime", "net_demand_mw", "chp_gen_mw"]].copy()
    out = out.rename(columns={"startTime": "timestamp", "chp_gen_mw": "thermal_gen_mw"})
    out["timestamp"] = pd.to_datetime(out["timestamp"]).dt.strftime("%Y-%m-%dT%H:%M:%S")

    hh_path = os.path.join(OUT_DIR, "medium_industrial_hh.csv")
    out.to_csv(hh_path, index=False)
    print(f"Saved {hh_path}  ({len(out)} rows, HH)")

    hourly = to_hourly(out)
    hourly["timestamp"] = pd.to_datetime(hourly["timestamp"]).dt.strftime("%Y-%m-%dT%H:%M:%S")
    h_path = os.path.join(OUT_DIR, "medium_industrial_hourly.csv")
    hourly.to_csv(h_path, index=False)
    print(f"Saved {h_path}  ({len(hourly)} rows, hourly)")


if __name__ == "__main__":
    print(f"Generating test CSVs for {START} → {END}\n")
    make_small_office()
    print()
    make_medium_industrial()
    print("\nDone. Files saved to outputs/test_data/")
