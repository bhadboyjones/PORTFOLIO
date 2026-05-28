"""
DUoS/GDUoS rate table — 6 DNOs, LV and HV, 2026/27 charge year.

All rates sourced from LC14 statements (April 2026 effective).
Dict stores values in source units (p/kWh, p/day, p/kVA/day).
Call convert_rates_to_model_units() to get model-ready £/MWh and £/day values.

Annual update process (each Dec/Jan when DNOs publish):
  1. Pull LC14 Annex 1 from each DNO's landing page
  2. Update DUOS_RATES below — bump charge_year and effective_from
  3. Commit and redeploy
"""

# CHARGE YEAR VERSIONING — V2
# Current structure: single dict entry for 2026/27.
# When 2027/28 LC14 statements publish (expected late March / early April 2027):
#   1. Add a new top-level key "2027-28" alongside "2026-27" — do not overwrite.
#   2. Key structure: DUOS_RATES = {"2026-27": {...}, "2027-28": {...}}
#   3. Update GET /duos-rates/{dno}/{voltage} to accept optional ?charge_year= param.
#      Default = current charge year. Return 404 if year not in dict.
#   4. Add a "Tariff year" dropdown to CsvConfigPage.jsx (default = current year).
#      Pass selected year to /duos-rates endpoint and to run_csv payload.
#   5. Backend uses selected charge_year to look up rates — not hardcoded to latest.
# Until a second year exists, no UI change is needed.

DUOS_RATES = {
    "charge_year": "2026-27",
    "effective_from": "2026-04-01",
    "dnos": {

        "UKPN": {
            # Average of EPN + LPN + SPN — all confirmed from LC14 statements.
            # LPN has seasonal summer Red shift (Jun-Aug 11:00-14:00) — ignored in avg.
            # Users on London sites should override rates in the Advanced section.
            "LV": {
                "duos_red_p_kwh":         7.949,
                "duos_amber_p_kwh":       0.496,
                "duos_green_p_kwh":       0.084,
                "gduos_red_p_kwh":        9.698,
                "gduos_amber_p_kwh":      0.696,
                "gduos_green_p_kwh":      0.109,
                "fixed_p_per_day":        33.75,
                "capacity_p_per_kva_day": 7.95,
                "gduos_fixed_p_per_day":  0.00,
                "rag_schedule": {
                    "red":   {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:00"], ["19:00", "23:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":         4.762,
                "duos_amber_p_kwh":       0.299,
                "duos_green_p_kwh":       0.034,
                "gduos_red_p_kwh":        5.522,
                "gduos_amber_p_kwh":      0.363,
                "gduos_green_p_kwh":      0.044,
                "fixed_p_per_day":        159.36,
                "capacity_p_per_kva_day": 7.05,
                "gduos_fixed_p_per_day":  11.30,
                "rag_schedule": {
                    "red":   {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:00"], ["19:00", "23:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "NGED": {
            # Average of East Midlands + West Midlands + South West + South Wales.
            # SW/WA red starts 17:00 — EM/WM 16:00 used as representative.
            "LV": {
                "duos_red_p_kwh":         10.503,
                "duos_amber_p_kwh":       0.960,
                "duos_green_p_kwh":       0.119,
                "gduos_red_p_kwh":        10.548,
                "gduos_amber_p_kwh":      1.032,
                "gduos_green_p_kwh":      0.129,
                "fixed_p_per_day":        132.79,
                "capacity_p_per_kva_day": 10.25,
                "gduos_fixed_p_per_day":  0.00,
                "rag_schedule": {
                    "red":   {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:30", "16:00"], ["19:00", "21:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":         4.449,
                "duos_amber_p_kwh":       0.273,
                "duos_green_p_kwh":       0.036,
                "gduos_red_p_kwh":        5.327,
                "gduos_amber_p_kwh":      0.400,
                "gduos_green_p_kwh":      0.050,
                "fixed_p_per_day":        114.43,
                "capacity_p_per_kva_day": 9.58,
                "gduos_fixed_p_per_day":  71.62,
                "rag_schedule": {
                    "red":   {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:30", "16:00"], ["19:00", "21:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "NPG": {
            # Northern Powergrid — Yorkshire rates confirmed; used for both NE and Yorkshire.
            "LV": {
                "duos_red_p_kwh":         5.829,
                "duos_amber_p_kwh":       1.528,
                "duos_green_p_kwh":       0.172,
                "gduos_red_p_kwh":        4.895,
                "gduos_amber_p_kwh":      1.312,
                "gduos_green_p_kwh":      0.153,
                "fixed_p_per_day":        293.65,
                "capacity_p_per_kva_day": 3.82,
                "gduos_fixed_p_per_day":  0.00,
                "rag_schedule": {
                    "red":   {"weekday": [["16:00", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["08:00", "16:00"], ["19:30", "22:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":         2.514,
                "duos_amber_p_kwh":       0.588,
                "duos_green_p_kwh":       0.052,
                "gduos_red_p_kwh":        2.826,
                "gduos_amber_p_kwh":      0.702,
                "gduos_green_p_kwh":      0.071,
                "fixed_p_per_day":        421.64,
                "capacity_p_per_kva_day": 3.78,
                "gduos_fixed_p_per_day":  93.70,
                "rag_schedule": {
                    "red":   {"weekday": [["16:00", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["08:00", "16:00"], ["19:30", "22:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "ENWL": {
            # Electricity North West. Unit rates confirmed from LC14.
            # RAG schedule UNVERIFIED — source docx embeds schedule as WMF image.
            # Placeholder schedule used. Verify against ENWL LC14 before production use.
            "LV": {
                "duos_red_p_kwh":         7.317,
                "duos_amber_p_kwh":       0.425,
                "duos_green_p_kwh":       0.024,
                "gduos_red_p_kwh":        9.968,
                "gduos_amber_p_kwh":      1.578,
                "gduos_green_p_kwh":      0.092,
                "fixed_p_per_day":        0.00,
                "capacity_p_per_kva_day": 6.92,
                "gduos_fixed_p_per_day":  0.00,
                "rag_schedule": {
                    "_warning": "UNVERIFIED — placeholder only, verify against ENWL LC14 docx",
                    "red":   {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:00"], ["19:00", "23:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":         4.919,
                "duos_amber_p_kwh":       0.587,
                "duos_green_p_kwh":       0.038,
                "gduos_red_p_kwh":        5.982,
                "gduos_amber_p_kwh":      0.814,
                "gduos_green_p_kwh":      0.050,
                "fixed_p_per_day":        225.05,
                "capacity_p_per_kva_day": 7.79,
                "gduos_fixed_p_per_day":  15.15,
                "rag_schedule": {
                    "_warning": "UNVERIFIED — placeholder only, verify against ENWL LC14 docx",
                    "red":   {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:00"], ["19:00", "23:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "SPEN": {
            # SP Energy Networks — SPD confirmed; used for both SPD and SPM.
            # Weekend Red 16:00-20:00 confirmed. No weekend Amber.
            "LV": {
                "duos_red_p_kwh":         10.798,
                "duos_amber_p_kwh":       1.103,
                "duos_green_p_kwh":       0.029,
                "gduos_red_p_kwh":        9.415,
                "gduos_amber_p_kwh":      1.024,
                "gduos_green_p_kwh":      0.026,
                "fixed_p_per_day":        608.00,
                "capacity_p_per_kva_day": 5.34,
                "gduos_fixed_p_per_day":  0.00,
                "rag_schedule": {
                    "red":   {"weekday": [["16:30", "19:30"]], "weekend": [["16:00", "20:00"]]},
                    "amber": {"weekday": [["08:00", "16:30"], ["19:30", "22:30"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":         4.377,
                "duos_amber_p_kwh":       0.322,
                "duos_green_p_kwh":       0.010,
                "gduos_red_p_kwh":        5.194,
                "gduos_amber_p_kwh":      0.430,
                "gduos_green_p_kwh":      0.013,
                "fixed_p_per_day":        159.79,
                "capacity_p_per_kva_day": 8.99,
                "gduos_fixed_p_per_day":  116.68,
                "rag_schedule": {
                    "red":   {"weekday": [["16:30", "19:30"]], "weekend": [["16:00", "20:00"]]},
                    "amber": {"weekday": [["08:00", "16:30"], ["19:30", "22:30"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "SSEN": {
            # SSEN Southern confirmed; used for both SSEN South and SSEN North.
            # Weekend Amber 09:30-21:30 confirmed for SSEN South.
            "LV": {
                "duos_red_p_kwh":         6.243,
                "duos_amber_p_kwh":       0.509,
                "duos_green_p_kwh":       0.028,
                "gduos_red_p_kwh":        8.447,
                "gduos_amber_p_kwh":      1.124,
                "gduos_green_p_kwh":      0.057,
                "fixed_p_per_day":        0.00,
                "capacity_p_per_kva_day": 10.63,
                "gduos_fixed_p_per_day":  0.00,
                "rag_schedule": {
                    "red":   {"weekday": [["16:30", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:30"], ["19:30", "22:00"]],
                              "weekend": [["09:30", "21:30"]]},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":         4.198,
                "duos_amber_p_kwh":       0.288,
                "duos_green_p_kwh":       0.012,
                "gduos_red_p_kwh":        5.239,
                "gduos_amber_p_kwh":      0.404,
                "gduos_green_p_kwh":      0.017,
                "fixed_p_per_day":        243.69,
                "capacity_p_per_kva_day": 10.06,
                "gduos_fixed_p_per_day":  471.07,
                "rag_schedule": {
                    "red":   {"weekday": [["16:30", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:30"], ["19:30", "22:00"]],
                              "weekend": [["09:30", "21:30"]]},
                    "green": "remainder",
                },
            },
        },
    },
}

VALID_DNOS = list(DUOS_RATES["dnos"].keys())
VALID_VOLTAGE_LEVELS = ["LV", "HV"]


def get_duos_rates(dno_key: str, voltage_level: str) -> dict:
    """
    Return the raw rate dict (p/kWh, p/day) for a given DNO and voltage level.

    Raises KeyError with a descriptive message if the combination is not found.
    Call convert_rates_to_model_units() on the result before passing to the model.
    """
    if dno_key not in DUOS_RATES["dnos"]:
        raise KeyError(
            f"DNO '{dno_key}' not found. Valid options: {VALID_DNOS}"
        )
    dno_entry = DUOS_RATES["dnos"][dno_key]
    if voltage_level not in dno_entry:
        raise KeyError(
            f"Voltage level '{voltage_level}' not found for DNO '{dno_key}'. "
            f"Valid options: {VALID_VOLTAGE_LEVELS}"
        )
    return dno_entry[voltage_level]


def convert_rates_to_model_units(rates: dict) -> dict:
    """
    Convert raw LC14 rates to model units and return a new dict.

    Conversions applied:
      p/kWh  → £/MWh  : multiply × 10
      p/day  → £/day  : divide ÷ 100
      p/kVA/day → £/kVA/day : divide ÷ 100

    GDUoS volumetric rates are negated to match the model's sign convention:
      gduos_gbp_mwh is stored as a NEGATIVE number (e.g. Red = -107.98 £/MWh)
      so that export_rate = price - gduos_stored adds the credit correctly.

    rag_schedule is passed through unchanged.
    Keys in the returned dict use _gbp_mwh, _gbp_per_day, _gbp_per_kva_day suffixes.
    """
    return {
        "duos_red_gbp_mwh":           rates["duos_red_p_kwh"]         * 10,
        "duos_amber_gbp_mwh":         rates["duos_amber_p_kwh"]       * 10,
        "duos_green_gbp_mwh":         rates["duos_green_p_kwh"]       * 10,
        # GDUoS negated — model convention: negative = credit on export
        "gduos_red_gbp_mwh":         -rates["gduos_red_p_kwh"]        * 10,
        "gduos_amber_gbp_mwh":       -rates["gduos_amber_p_kwh"]      * 10,
        "gduos_green_gbp_mwh":       -rates["gduos_green_p_kwh"]      * 10,
        "fixed_gbp_per_day":          rates["fixed_p_per_day"]         / 100,
        "capacity_gbp_per_kva_day":   rates["capacity_p_per_kva_day"]  / 100,
        "gduos_fixed_gbp_per_day":    rates["gduos_fixed_p_per_day"]   / 100,
        "rag_schedule":               rates["rag_schedule"],
    }


def duos_rates_to_charges_config(rates: dict) -> dict:
    """
    Convert a raw get_duos_rates() dict into the config format expected by
    build_network_charges() in charges.py.

    Handles:
      - p/kWh  → £/MWh  for volumetric rates (× 10)
      - GDUoS negated to match model sign convention (negative = credit)
      - rag_schedule weekday HH:MM strings → (start_mins, end_mins) tuples
      - Standing charges passed through in pence (data_builder converts to £)
    """
    def _to_mins(hhmm: str) -> int:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)

    sched = rates["rag_schedule"]
    rag_bands = {
        "red":   [(_to_mins(w[0]), _to_mins(w[1])) for w in sched["red"]["weekday"]],
        "amber": [(_to_mins(w[0]), _to_mins(w[1])) for w in sched["amber"]["weekday"]],
    }

    return {
        "dduos_gbp_per_mwh": {
            "red":   rates["duos_red_p_kwh"]   * 10,
            "amber": rates["duos_amber_p_kwh"]  * 10,
            "green": rates["duos_green_p_kwh"]  * 10,
        },
        "gduos_gbp_per_mwh": {
            "red":   -rates["gduos_red_p_kwh"]   * 10,
            "amber": -rates["gduos_amber_p_kwh"]  * 10,
            "green": -rates["gduos_green_p_kwh"]  * 10,
        },
        "rag_bands":                    rag_bands,
        "weekends_are_green":           True,
        "bank_holidays_are_green":      True,
        "dduos_fixed_p_per_day":        rates["fixed_p_per_day"],
        "dduos_capacity_p_per_kva_day": rates["capacity_p_per_kva_day"],
        "gduos_fixed_p_per_day":        rates["gduos_fixed_p_per_day"],
    }
