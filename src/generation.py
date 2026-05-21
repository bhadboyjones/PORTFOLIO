"""
Site profiles: Demand, PV, and CHP generation.

Generates synthetic half-hourly profiles for BTM analysis.
"""

import numpy as np
import pandas as pd

from .config import SITE_ARCHETYPES


def generate_pv_profile(timestamps, pv_kwp, seed=None):
    """
    Generate synthetic PV output for half-hourly timestamps.
    
    Simple model:
    - Bell curve peaking at solar noon
    - Seasonal variation (more in summer)
    - Random cloud noise
    
    Args:
        timestamps: DatetimeIndex (UTC)
        pv_kwp: Installed capacity in kWp
        seed: Random seed for reproducibility
    
    Returns:
        numpy array of PV output in kW
    """
    if pv_kwp == 0:
        return np.zeros(len(timestamps))
    
    if seed is not None:
        np.random.seed(seed)
    
    # Convert to UK local time
    local = timestamps.tz_convert("Europe/London")
    
    output = np.zeros(len(timestamps))
    
    for i, lt in enumerate(local):
        hour = lt.hour + lt.minute / 60
        doy = lt.dayofyear  # Day of year (1-365)
        
        # Seasonal factor: peaks in summer (day 172 = June 21)
        seasonal = 0.6 + 0.4 * np.cos(2 * np.pi * (doy - 172) / 365)
        
        # Day length (longer in summer)
        day_length = 12 + 5 * np.cos(2 * np.pi * (doy - 172) / 365)
        sunrise = 12 - day_length / 2
        sunset = 12 + day_length / 2
        
        # Daily curve: bell shape, zero outside daylight
        if sunrise <= hour <= sunset:
            noon = 12
            day_progress = (hour - noon) / (day_length / 2)
            daily = np.cos(day_progress * np.pi / 2) ** 2
        else:
            daily = 0
        
        # Cloud noise (0.6 to 1.0 multiplier)
        cloud = 1.0 - np.random.uniform(0, 0.4)
        
        output[i] = pv_kwp * seasonal * daily * cloud
    
    return output


def generate_chp_profile(timestamps, chp_kw, availability=0.95, seed=None):
    """
    Generate synthetic CHP output.
    
    CHP runs as baseload with occasional outages.
    
    Args:
        timestamps: DatetimeIndex (UTC)
        chp_kw: Capacity in kW
        availability: Fraction of time running (0.95 = 95%)
        seed: Random seed
    
    Returns:
        numpy array of CHP output in kW
    """
    if chp_kw == 0:
        return np.zeros(len(timestamps))
    
    if seed is not None:
        np.random.seed(seed)
    
    n = len(timestamps)
    
    # Base output with small noise (±5%)
    noise = np.random.uniform(0.95, 1.05, n)
    output = chp_kw * noise
    
    # Random outages
    running = np.random.random(n) < availability
    output = output * running
    
    return output


def generate_demand_profile(start_utc, end_utc, peak_mw, base_mw, offpeak_mw):
    """
    Generate synthetic demand profile with daily shape.
    
    Weekdays:
    - 00:00-06:00: offpeak
    - 06:00-09:00: ramp to base
    - 09:00-12:00: ramp to peak
    - 12:00-17:00: peak
    - 17:00-20:00: ramp down to base
    - 20:00-00:00: ramp to offpeak
    
    Weekends: flat at offpeak
    
    Returns:
        DataFrame with startTime, demand_mw, demand_mwh
    """
    idx = pd.date_range(start_utc, end_utc, freq="30min", inclusive="left")
    df = pd.DataFrame({"startTime": idx})
    
    local = df["startTime"].dt.tz_convert("Europe/London")
    hour = local.dt.hour + local.dt.minute / 60
    is_weekend = local.dt.dayofweek >= 5
    
    demand = np.zeros(len(df))
    
    for i in range(len(df)):
        h = hour.iloc[i]
        
        if is_weekend.iloc[i]:
            demand[i] = offpeak_mw
        else:
            if h < 6:
                demand[i] = offpeak_mw
            elif h < 9:
                demand[i] = offpeak_mw + (base_mw - offpeak_mw) * (h - 6) / 3
            elif h < 12:
                demand[i] = base_mw + (peak_mw - base_mw) * (h - 9) / 3
            elif h < 17:
                demand[i] = peak_mw
            elif h < 20:
                demand[i] = peak_mw - (peak_mw - base_mw) * (h - 17) / 3
            else:
                demand[i] = base_mw - (base_mw - offpeak_mw) * (h - 20) / 4
    
    # Add ±10% noise
    np.random.seed(42)
    noise = np.random.uniform(0.9, 1.1, len(demand))
    df["demand_mw"] = demand * noise
    df["demand_mwh"] = df["demand_mw"] * 0.5
    
    return df


def generate_site_profile(start_utc, end_utc, site_params, pv_seed=None, chp_seed=None):
    """
    Generate complete site profile: demand + PV + CHP.
    
    Args:
        start_utc: Start timestamp (UTC)
        end_utc: End timestamp (UTC)
        site_params: Dict from SITE_ARCHETYPES
        pv_seed, chp_seed: Random seeds
    
    Returns:
        DataFrame with demand, generation, and net demand columns
    """
    # Generate demand
    df = generate_demand_profile(
        start_utc, end_utc,
        site_params["peak_mw"],
        site_params["base_mw"],
        site_params["offpeak_mw"],
    )
    
    timestamps = pd.DatetimeIndex(df["startTime"])
    
    # Generate PV (kW -> MW)
    pv_kw = generate_pv_profile(timestamps, site_params.get("pv_kwp", 0), seed=pv_seed)
    df["pv_gen_mw"] = pv_kw / 1000
    df["pv_gen_mwh"] = df["pv_gen_mw"] * 0.5
    
    # Generate CHP (kW -> MW)
    chp_kw = generate_chp_profile(timestamps, site_params.get("chp_kw", 0), seed=chp_seed)
    df["chp_gen_mw"] = chp_kw / 1000
    df["chp_gen_mwh"] = df["chp_gen_mw"] * 0.5
    
    # Totals
    df["total_gen_mw"] = df["pv_gen_mw"] + df["chp_gen_mw"]
    df["net_demand_mw"] = df["demand_mw"] - df["total_gen_mw"]  # Negative = surplus
    df["net_demand_mwh"] = df["net_demand_mw"] * 0.5
    
    return df


def generate_all_site_profiles(start_utc, end_utc, archetypes=SITE_ARCHETYPES):
    """
    Generate profiles for all site archetypes.
    
    Returns:
        Dict of {site_name: DataFrame}
    """
    profiles = {}
    for i, (name, params) in enumerate(archetypes.items()):
        profiles[name] = generate_site_profile(
            start_utc, end_utc, params,
            pv_seed=100 + i,
            chp_seed=200 + i,
        )
        print(f"Generated: {name} ({len(profiles[name])} rows)")
    return profiles


def generate_all_site_profiles_combined(start_utc, end_utc, archetypes=SITE_ARCHETYPES):
    """
    Generate profiles for all sites in one DataFrame with site_type column.
    
    Returns:
        Single DataFrame with all sites stacked
    """
    profiles = generate_all_site_profiles(start_utc, end_utc, archetypes)
    
    all_sites = []
    for name, df in profiles.items():
        df = df.copy()
        df["site_type"] = name
        all_sites.append(df)
    
    return pd.concat(all_sites, ignore_index=True)
build_generation_df = generate_site_profile