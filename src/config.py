"""
Configuration: Constants and defaults for BTM BESS optimisation.

This file contains things that rarely change:
- API endpoints
- Bank holidays
- Site archetypes
- BESS scenario matrix
- Export scenarios
- Network charge configs
- Import levies
"""

# ======================================================
# API CONFIG
# ======================================================

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"

# ============================================================
# UK BANK HOLIDAYS (England & Wales)
# ============================================================

# Note: For production, pull from GOV.UK API. Hardcoded for portfolio project.
UK_BANK_HOLIDAYS = {
    2024: [
        "2024-01-01", "2024-03-29", "2024-04-01", "2024-05-06",
        "2024-05-27", "2024-08-26", "2024-12-25", "2024-12-26",
    ],
    2025: [
        "2025-01-01", "2025-04-18", "2025-04-21", "2025-05-05",
        "2025-05-26", "2025-08-25", "2025-12-25", "2025-12-26",
    ],
    2026: [
        "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04",
        "2026-05-25", "2026-08-31", "2026-12-25", "2026-12-28",
    ],
}

# ============================================================
# SITE ARCHETYPES
# ============================================================

# Synthetic starting points — replaced with real meter data in production.
# contracted_kva derived from peak_mw x 1000 (unity power factor assumption).
# In production, sourced from site DNO connection agreement.

SITE_ARCHETYPES = {
    "small_office": {
        "peak_mw":        1.0,
        "base_mw":        0.6,
        "offpeak_mw":     0.2,
        "description":    "Small office/retail",
        "chp_kw":         0,
        "pv_kwp":         400,
        "contracted_kva": 1000,   # peak_mw x 1000, unity PF assumption
    },
    "medium_industrial": {
        "peak_mw":        2.0,
        "base_mw":        1.4,
        "offpeak_mw":     0.8,
        "description":    "Manufacturing site",
        "chp_kw":         500,
        "pv_kwp":         600,
        "contracted_kva": 2000,   # peak_mw x 1000, unity PF assumption
    },
    "large_industrial": {
        "peak_mw":        3.0,
        "base_mw":        2.2,
        "offpeak_mw":     1.2,
        "description":    "Heavy industry",
        "chp_kw":         1000,
        "pv_kwp":         800,
        "contracted_kva": 3000,   # peak_mw x 1000, unity PF assumption
    },
}

# ============================================================
# BESS SCENARIOS
# ============================================================

# 9 configs: 3 power ratings (0.5, 1, 2 MW) x 3 durations (1h, 2h, 4h)
#
# max_mwh = max_mw x duration_hours
#   e.g. 0.5MW 2hr = can deliver 0.5MW for 2 hours = 1.0MWh storage
#
# All other params held constant across scenarios.
# Scenario runner caps max_mw at site peak_mw to avoid oversizing.

_BESS_BASE = {
    "min_soc":              0.05,   # Don't discharge below 5%
    "max_soc":              0.95,   # Don't charge above 95%
    "eta_roundtrip":        0.90,   # 90% round-trip efficiency (split as sqrt for charge/discharge)
    "initial_soc":          0.5,    # Start half full
    "deg_cost_gbp_per_mwh": 8.0,   # Degradation cost per MWh throughput
    "max_cycles_per_day":   1.5,    # Max charge+discharge cycles per day
}

BESS_SCENARIOS = [
    # 0.5MW
    {**_BESS_BASE, "label": "0.5MW_1h", "max_mw": 0.5, "max_mwh": 0.5},
    {**_BESS_BASE, "label": "0.5MW_2h", "max_mw": 0.5, "max_mwh": 1.0},
    {**_BESS_BASE, "label": "0.5MW_4h", "max_mw": 0.5, "max_mwh": 2.0},
    # 1MW
    {**_BESS_BASE, "label": "1MW_1h",   "max_mw": 1.0, "max_mwh": 1.0},
    {**_BESS_BASE, "label": "1MW_2h",   "max_mw": 1.0, "max_mwh": 2.0},
    {**_BESS_BASE, "label": "1MW_4h",   "max_mw": 1.0, "max_mwh": 4.0},
    # 2MW
    {**_BESS_BASE, "label": "2MW_1h",   "max_mw": 2.0, "max_mwh": 2.0},
    {**_BESS_BASE, "label": "2MW_2h",   "max_mw": 2.0, "max_mwh": 4.0},
    {**_BESS_BASE, "label": "2MW_4h",   "max_mw": 2.0, "max_mwh": 8.0},
]

# ============================================================
# EXPORT SCENARIOS
# ============================================================

# Export limit in MW — varies by site DNO connection agreement.
# 0.0 = no export (most common for older BTM connections).
# Combined with BESS_SCENARIOS gives 9 x 4 = 36 scenarios per site archetype.
# 3 archetypes x 36 = 108 total scenarios.

EXPORT_SCENARIOS = [0.0, 0.25, 0.5, 1.0]  # MW

# ============================================================
# NETWORK CHARGES (Northern Powergrid NE - HV)
# ============================================================

# RAG bands defined in minutes from midnight (local UK time).
# Red = peak, Amber = shoulder, Green = off-peak.
# Weekends and bank holidays always green.

NETWORK_CONFIG_NEC_HV = {
    "dno":        "Northern Powergrid (Northeast)",
    "tariff":     "HV Site Specific",
    "valid_from": "2025-04-01",

    "rag_bands": {
        "red":   [(16 * 60, 19 * 60)],
        "amber": [(7 * 60, 16 * 60), (19 * 60, 23 * 60)],
        # green = everything else (23:00-07:00)
    },
    "weekends_are_green":     True,
    "bank_holidays_are_green": True,

    # Volumetric rates £/MWh — apply to imports (dduos) and exports (gduos)
    "dduos_gbp_per_mwh": {"red": 88.0,  "amber": 5.0,  "green": 0.5},
    "gduos_gbp_per_mwh": {"red": -88.0, "amber": -5.0, "green": -0.5},

    # Standing charges — pence/day, independent of consumption or dispatch
    # dduos_capacity rate requires contracted_kva from site archetype to compute £
    "dduos_fixed_p_per_day":        229.53,
    "dduos_capacity_p_per_kva_day":   4.49,
    "gduos_fixed_p_per_day":          15.91,
}

# ============================================================
# IMPORT LEVIES
# ============================================================

# Apply to grid imports only — not exports.
# Values are indicative placeholders, replace with actual supplier quotes.

IMPORT_CHARGES = {
    "bsuos_gbp_per_mwh":    5.0,    # Balancing Services Use of System
    "cfd_levy_gbp_per_mwh": 15.0,   # Contracts for Difference
    "ro_levy_gbp_per_mwh":  10.0,   # Renewables Obligation
    "cm_levy_gbp_per_mwh":   2.0,   # Capacity Market
    "fit_levy_gbp_per_mwh":  1.0,   # Feed-in Tariff
}

# Single total used in optimiser and settlement calculations
TOTAL_IMPORT_LEVIES_GBP_PER_MWH = sum(IMPORT_CHARGES.values())

# ============================================================
# SITE OPERATING COST ASSUMPTIONS
# ============================================================

# CHP marginal fuel cost — used in baseline cost calculation.
# Benchmark assumption for pre-feasibility modelling.
# In production, replace with actual gas price + heat rate for each site.
CHP_MARGINAL_COST_GBP_PER_MWH = 70.0