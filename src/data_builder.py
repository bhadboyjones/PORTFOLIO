import numpy as np
import pandas as pd

from .charges import build_network_charges
from .prices import build_price_df
from .generation import build_generation_df
from .config import NETWORK_CONFIG_NEC_HV, TOTAL_IMPORT_LEVIES_GBP_PER_MWH



def build_optimiser_input(
    start_utc,
    end_utc,
    site_params=None,
    site_name=None,
    network_config=None,
    force_refresh=False,
    perfect_foresight=True,
):
    """
    Build optimiser input dataframe with FULLY SEPARATED price stack.

    No baked-in import/export rates.

    Returns:
        DataFrame with:
        - Energy prices (DA + imbalance)
        - Network charges (DUoS / GDUoS)
        - Policy costs (NEC)
        - Site load/generation
    """

    if network_config is None:
        network_config = NETWORK_CONFIG_NEC_HV

    start_ts = pd.Timestamp(start_utc)
    end_ts = pd.Timestamp(end_utc)

    # ================================================================
    # 1. NETWORK CHARGES
    # ================================================================
    df_charges = build_network_charges(start_utc, end_utc, config=network_config)

    df_charges = df_charges.rename(columns={
        "dduos_gbp_per_mwh": "duos_gbp_mwh",
        "gduos_gbp_per_mwh": "gduos_gbp_mwh",
    })

    # Convert standing charges from p/day to £/SP
    # contracted_kva from site_params (unity PF assumption — see config.py)
    contracted_kva = site_params.get("contracted_kva", 0) if site_params else 0

    dduos_fixed_p    = network_config.get("dduos_fixed_p_per_day", 0)
    dduos_cap_p      = network_config.get("dduos_capacity_p_per_kva_day", 0)
    gduos_fixed_p    = network_config.get("gduos_fixed_p_per_day", 0)

    df_charges["dduos_fixed_gbp_per_sp"]    = dduos_fixed_p / 100 / 48
    df_charges["dduos_capacity_gbp_per_sp"] = dduos_cap_p * contracted_kva / 100 / 48
    df_charges["gduos_fixed_gbp_per_sp"]    = gduos_fixed_p / 100 / 48

    df_charges = df_charges[
        ["startTime", "time_band", "duos_gbp_mwh", "gduos_gbp_mwh", "dduos_fixed_gbp_per_sp", "dduos_capacity_gbp_per_sp", "gduos_fixed_gbp_per_sp"]
    ].copy()

    # ================================================================
    # 2. PRICES
    # ================================================================
    df_prices = build_price_df(
        start_date=start_ts.date(),
        end_date=end_ts.date(),
        force_refresh=force_refresh
    )

    df = pd.merge(df_charges, df_prices, on="startTime", how="left")

    # ================================================================
    # 3. SITE GENERATION / DEMAND
    # ================================================================
    if site_params is not None:
        df_gen = build_generation_df(start_utc, end_utc, site_params)
        df_gen = df_gen.rename(columns={"chp_gen_mw": "thermal_gen_mw"})

        gen_cols = [
            "startTime",
            "demand_mw",
            "demand_mwh",
            "pv_gen_mw",
            "thermal_gen_mw",
            "net_demand_mw",
            "net_demand_mwh"
        ]

        df_gen = df_gen[gen_cols].copy()
        df = pd.merge(df, df_gen, on="startTime", how="left")

        missing = df["net_demand_mw"].isna().sum()
        if missing > 0:
            print(f"Warning: {missing} SPs missing site load")

    # ================================================================
    # 4. SITE TAG
    # ================================================================
    if site_name is not None:
        df["site_name"] = site_name

    # ================================================================
    # 5. NON-ENERGY COSTS (KEPT SEPARATE)
    # ================================================================
    df["nec_gbp_mwh"] = TOTAL_IMPORT_LEVIES_GBP_PER_MWH

    # ================================================================
    # 6. ACTUAL PRICES (SETTLEMENT VIEW)
    # ================================================================
    df["da_actual_gbp"] = df["da_price_gbp"]
    df["imb_actual_gbp"] = df["imb_price_gbp"]

    # ================================================================
    # 7. FORECAST PRICES (DECISION VIEW)
    # ================================================================
    if perfect_foresight:
        df["da_forecast_gbp"] = df["da_actual_gbp"]
        df["imb_forecast_gbp"] = df["imb_actual_gbp"]
    else:
        df["da_forecast_gbp"] = pd.NA
        df["imb_forecast_gbp"] = pd.NA
        print("Warning: No forecasts provided")

    # ================================================================
    # 8. CLEANUP
    # ================================================================
    df = df.drop(columns=["da_price_gbp", "imb_price_gbp"])
    df = df.sort_values("startTime").reset_index(drop=True)

    # ================================================================
    # 9. SUMMARY
    # ================================================================
    print(f"\nOptimiser input ready: {len(df):,} SPs")
    print(f"  Window: {df['startTime'].min()} → {df['startTime'].max()}")

    if df["da_actual_gbp"].notna().any():
        print(f"  DA range: £{df['da_actual_gbp'].min():.2f} → £{df['da_actual_gbp'].max():.2f}/MWh")

    if site_params is not None:
        print(f"  Net demand: {df['net_demand_mw'].min():.2f} → {df['net_demand_mw'].max():.2f} MW")

    if site_name:
        print(f"  Site: {site_name}")

    print("  Pricing model: UNBUNDLED (no baked-in rates)")

    return df