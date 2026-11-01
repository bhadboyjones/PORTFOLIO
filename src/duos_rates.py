"""
DUoS/GDUoS rate table — GB licence areas, LV and HV, 2026/27 charge year.

All rates are from each area's LC14 statement or schedule of charges, Annex 1,
Site Specific Band 2 and Generation Site Specific rows, read 2026-11-01. Excess
capacity is the published rate, equal to capacity in all 12 areas read.
SP Distribution and SP Manweb could not be read: "SPEN" holds older figures for
both, and every run on it carries a warning.
Dict stores values in source units (p/kWh, p/day, p/kVA/day).
Call convert_rates_to_model_units() to get model-ready £/MWh and £/day values.

Annual update process (each Dec/Jan when DNOs publish):
  1. Pull LC14 Annex 1 from each DNO's landing page
  2. Update DUOS_RATES below — bump charge_year and effective_from
  3. Commit and redeploy
"""

# CHARGE YEAR VERSIONING — V2
# Current structure: single dict entry for 2026/27.
# 2027/28 statements are already published (DNOs publish ~15 months ahead):
#   1. Add a new top-level key "2027-28" alongside "2026-27" — do not overwrite.
#   2. Key structure: DUOS_RATES = {"2026-27": {...}, "2027-28": {...}}
#   3. Update GET /duos-rates/{dno}/{voltage} to accept optional ?charge_year= param.
#      Default = current charge year. Return 404 if year not in dict.
#   4. Add a "Tariff year" dropdown to CsvConfigPage.jsx (default = current year).
#      Pass selected year to /duos-rates endpoint and to run_csv payload.
#   5. Backend uses selected charge_year to look up rates — not hardcoded to latest.
# Until a second year exists, no UI change is needed.

SP_UNVERIFIED = (
    "SP Energy Networks rates are unverified: its 2026/27 statements could not be "
    "read, so one set of older figures covers SP Distribution and SP Manweb."
)

DUOS_RATES = {
    "charge_year": "2026-27",
    "effective_from": "2026-04-01",
    "dnos": {

        "EPN": {
            # Eastern Power Networks. V1.5.
            # https://media.umbraco.io/ukpn-cms/fr2evo4j/eastern-power-networks-lc14-statement-2026-v1-5.pdf
            "LV": {
                "duos_red_p_kwh":                   8.149,
                "duos_amber_p_kwh":                 0.937,
                "duos_green_p_kwh":                 0.108,
                "gduos_red_p_kwh":                  9.135,
                "gduos_amber_p_kwh":                1.124,
                "gduos_green_p_kwh":                0.144,
                "fixed_p_per_day":                  33.09,
                "capacity_p_per_kva_day":           8.04,
                "excess_capacity_p_per_kva_day":    8.04,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:00"], ["19:00", "23:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   4.837,
                "duos_amber_p_kwh":                 0.457,
                "duos_green_p_kwh":                 0.038,
                "gduos_red_p_kwh":                  5.466,
                "gduos_amber_p_kwh":                0.559,
                "gduos_green_p_kwh":                0.052,
                "fixed_p_per_day":                  305.47,
                "capacity_p_per_kva_day":           5.31,
                "excess_capacity_p_per_kva_day":    5.31,
                "gduos_fixed_p_per_day":            12.88,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:00"], ["19:00", "23:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "LPN": {
            # London Power Networks. V1.3.
            # https://media.umbraco.io/ukpn-cms/bqthjnqt/london-power-networks-lc14-statement-2026-v1-3.pdf
            "LV": {
                "duos_red_p_kwh":                   4.388,
                "duos_amber_p_kwh":                 0.162,
                "duos_green_p_kwh":                 0.024,
                "gduos_red_p_kwh":                  7.578,
                "gduos_amber_p_kwh":                0.516,
                "gduos_green_p_kwh":                0.043,
                "fixed_p_per_day":                  2.35,
                "capacity_p_per_kva_day":           7.23,
                "excess_capacity_p_per_kva_day":    7.23,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["11:00", "14:00"], ["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "11:00"], ["14:00", "16:00"], ["19:00", "23:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   0.009,
                "duos_amber_p_kwh":                 0.0,
                "duos_green_p_kwh":                 0.0,
                "gduos_red_p_kwh":                  4.094,
                "gduos_amber_p_kwh":                0.313,
                "gduos_green_p_kwh":                0.01,
                "fixed_p_per_day":                  0.0,
                "capacity_p_per_kva_day":           9.19,
                "excess_capacity_p_per_kva_day":    9.19,
                "gduos_fixed_p_per_day":            8.55,
                "rag_schedule": {
                    "red": {"weekday": [["11:00", "14:00"], ["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "11:00"], ["14:00", "16:00"], ["19:00", "23:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "SPN": {
            # South Eastern Power Networks. V1.3.
            # https://media.umbraco.io/ukpn-cms/m2aj0zfs/south-eastern-power-networks-lc14-statement-2026-v1-3.pdf
            "LV": {
                "duos_red_p_kwh":                   11.311,
                "duos_amber_p_kwh":                 0.389,
                "duos_green_p_kwh":                 0.121,
                "gduos_red_p_kwh":                  12.382,
                "gduos_amber_p_kwh":                0.448,
                "gduos_green_p_kwh":                0.139,
                "fixed_p_per_day":                  65.81,
                "capacity_p_per_kva_day":           8.57,
                "excess_capacity_p_per_kva_day":    8.57,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:00"], ["19:00", "23:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   6.01,
                "duos_amber_p_kwh":                 0.177,
                "duos_green_p_kwh":                 0.056,
                "gduos_red_p_kwh":                  7.007,
                "gduos_amber_p_kwh":                0.218,
                "gduos_green_p_kwh":                0.069,
                "fixed_p_per_day":                  636.85,
                "capacity_p_per_kva_day":           6.66,
                "excess_capacity_p_per_kva_day":    6.66,
                "gduos_fixed_p_per_day":            12.47,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:00"], ["19:00", "23:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "EMID": {
            # NGED East Midlands. 0.1.
            # https://commercial.nationalgrid.co.uk/downloads-view-reciteme/684677
            "LV": {
                "duos_red_p_kwh":                   7.777,
                "duos_amber_p_kwh":                 0.958,
                "duos_green_p_kwh":                 0.054,
                "gduos_red_p_kwh":                  7.711,
                "gduos_amber_p_kwh":                0.998,
                "gduos_green_p_kwh":                0.06,
                "fixed_p_per_day":                  85.08,
                "capacity_p_per_kva_day":           7.68,
                "excess_capacity_p_per_kva_day":    7.68,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:30", "16:00"], ["19:00", "21:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   2.837,
                "duos_amber_p_kwh":                 0.257,
                "duos_green_p_kwh":                 0.009,
                "gduos_red_p_kwh":                  3.958,
                "gduos_amber_p_kwh":                0.431,
                "gduos_green_p_kwh":                0.021,
                "fixed_p_per_day":                  866.35,
                "capacity_p_per_kva_day":           8.57,
                "excess_capacity_p_per_kva_day":    8.57,
                "gduos_fixed_p_per_day":            61.51,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:30", "16:00"], ["19:00", "21:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "WMID": {
            # NGED West Midlands. 0.1.
            # https://commercial.nationalgrid.co.uk/downloads-view-reciteme/684676
            "LV": {
                "duos_red_p_kwh":                   6.515,
                "duos_amber_p_kwh":                 0.827,
                "duos_green_p_kwh":                 0.1,
                "gduos_red_p_kwh":                  7.093,
                "gduos_amber_p_kwh":                0.909,
                "gduos_green_p_kwh":                0.124,
                "fixed_p_per_day":                  219.77,
                "capacity_p_per_kva_day":           10.66,
                "excess_capacity_p_per_kva_day":    10.66,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:30", "16:00"], ["19:00", "21:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   1.764,
                "duos_amber_p_kwh":                 0.205,
                "duos_green_p_kwh":                 0.011,
                "gduos_red_p_kwh":                  2.752,
                "gduos_amber_p_kwh":                0.339,
                "gduos_green_p_kwh":                0.024,
                "fixed_p_per_day":                  2275.43,
                "capacity_p_per_kva_day":           9.26,
                "excess_capacity_p_per_kva_day":    9.26,
                "gduos_fixed_p_per_day":            66.24,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:30", "16:00"], ["19:00", "21:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "SWEST": {
            # NGED South West. 0.1.
            # https://commercial.nationalgrid.co.uk/downloads-view-reciteme/684674
            "LV": {
                "duos_red_p_kwh":                   14.833,
                "duos_amber_p_kwh":                 1.065,
                "duos_green_p_kwh":                 0.114,
                "gduos_red_p_kwh":                  14.503,
                "gduos_amber_p_kwh":                1.156,
                "gduos_green_p_kwh":                0.126,
                "fixed_p_per_day":                  60.79,
                "capacity_p_per_kva_day":           12.18,
                "excess_capacity_p_per_kva_day":    12.18,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["17:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:30", "17:00"], ["19:00", "21:30"]], "weekend": [["16:30", "19:30"]]},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   7.242,
                "duos_amber_p_kwh":                 0.302,
                "duos_green_p_kwh":                 0.028,
                "gduos_red_p_kwh":                  7.786,
                "gduos_amber_p_kwh":                0.412,
                "gduos_green_p_kwh":                0.041,
                "fixed_p_per_day":                  525.1,
                "capacity_p_per_kva_day":           10.06,
                "excess_capacity_p_per_kva_day":    10.06,
                "gduos_fixed_p_per_day":            78.08,
                "rag_schedule": {
                    "red": {"weekday": [["17:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:30", "17:00"], ["19:00", "21:30"]], "weekend": [["16:30", "19:30"]]},
                    "green": "remainder",
                },
            },
        },

        "SWALES": {
            # NGED South Wales. 0.1.
            # https://commercial.nationalgrid.co.uk/downloads-view-reciteme/684675
            "LV": {
                "duos_red_p_kwh":                   12.885,
                "duos_amber_p_kwh":                 0.989,
                "duos_green_p_kwh":                 0.206,
                "gduos_red_p_kwh":                  12.886,
                "gduos_amber_p_kwh":                1.063,
                "gduos_green_p_kwh":                0.204,
                "fixed_p_per_day":                  165.52,
                "capacity_p_per_kva_day":           10.49,
                "excess_capacity_p_per_kva_day":    10.49,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["17:00", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["07:30", "17:00"], ["19:30", "22:00"]], "weekend": [["12:00", "13:00"], ["16:00", "21:00"]]},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   5.953,
                "duos_amber_p_kwh":                 0.327,
                "duos_green_p_kwh":                 0.096,
                "gduos_red_p_kwh":                  6.811,
                "gduos_amber_p_kwh":                0.419,
                "gduos_green_p_kwh":                0.112,
                "fixed_p_per_day":                  1590.95,
                "capacity_p_per_kva_day":           10.43,
                "excess_capacity_p_per_kva_day":    10.43,
                "gduos_fixed_p_per_day":            80.63,
                "rag_schedule": {
                    "red": {"weekday": [["17:00", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["07:30", "17:00"], ["19:30", "22:00"]], "weekend": [["12:00", "13:00"], ["16:00", "21:00"]]},
                    "green": "remainder",
                },
            },
        },

        "NPGN": {
            # Northern Powergrid Northeast. 0.2.
            # https://www.northernpowergrid.com/sites/default/files/assets/Northern%20Powergrid%20(Northeast)%20-%20%202026-27%20LC14%20Charging%20Statement%20-%20v0.2.pdf
            "LV": {
                "duos_red_p_kwh":                   8.522,
                "duos_amber_p_kwh":                 1.255,
                "duos_green_p_kwh":                 0.179,
                "gduos_red_p_kwh":                  7.736,
                "gduos_amber_p_kwh":                1.171,
                "gduos_green_p_kwh":                0.165,
                "fixed_p_per_day":                  129.89,
                "capacity_p_per_kva_day":           5.48,
                "excess_capacity_p_per_kva_day":    5.48,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["08:00", "16:00"], ["19:30", "22:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   3.403,
                "duos_amber_p_kwh":                 0.427,
                "duos_green_p_kwh":                 0.066,
                "gduos_red_p_kwh":                  3.884,
                "gduos_amber_p_kwh":                0.525,
                "gduos_green_p_kwh":                0.078,
                "fixed_p_per_day":                  1316.4,
                "capacity_p_per_kva_day":           5.6,
                "excess_capacity_p_per_kva_day":    5.6,
                "gduos_fixed_p_per_day":            70.64,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["08:00", "16:00"], ["19:30", "22:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "NPGY": {
            # Northern Powergrid Yorkshire. 0.2.
            # https://www.northernpowergrid.com/sites/default/files/assets/Northern%20Powergrid%20(Yorkshire)%20-%20%202026-27%20LC14%20Charging%20Statement%20-%20v0.2.pdf
            "LV": {
                "duos_red_p_kwh":                   5.829,
                "duos_amber_p_kwh":                 1.528,
                "duos_green_p_kwh":                 0.172,
                "gduos_red_p_kwh":                  4.895,
                "gduos_amber_p_kwh":                1.312,
                "gduos_green_p_kwh":                0.153,
                "fixed_p_per_day":                  293.65,
                "capacity_p_per_kva_day":           3.82,
                "excess_capacity_p_per_kva_day":    3.82,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["08:00", "16:00"], ["19:30", "22:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   2.514,
                "duos_amber_p_kwh":                 0.588,
                "duos_green_p_kwh":                 0.052,
                "gduos_red_p_kwh":                  2.826,
                "gduos_amber_p_kwh":                0.702,
                "gduos_green_p_kwh":                0.071,
                "fixed_p_per_day":                  2908.28,
                "capacity_p_per_kva_day":           3.78,
                "excess_capacity_p_per_kva_day":    3.78,
                "gduos_fixed_p_per_day":            93.7,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["08:00", "16:00"], ["19:30", "22:00"]], "weekend": []},
                    "green": "remainder",
                },
            },
        },

        "ENWL": {
            # Electricity North West. statement 1.0 (31/1/2025); schedule v1.1.
            # https://enwl.co.uk/globalassets/about-us/regulatory-information/documents/current-charging-information/26-27/enwl-lc14-statement-2026-27_v1.0-final.docx
            "LV": {
                "duos_red_p_kwh":                   7.317,
                "duos_amber_p_kwh":                 0.425,
                "duos_green_p_kwh":                 0.024,
                "gduos_red_p_kwh":                  9.968,
                "gduos_amber_p_kwh":                1.578,
                "gduos_green_p_kwh":                0.092,
                "fixed_p_per_day":                  0.0,
                "capacity_p_per_kva_day":           6.92,
                "excess_capacity_p_per_kva_day":    6.92,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["09:00", "16:00"], ["19:00", "20:30"]], "weekend": [["16:00", "19:00"]]},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   0.64,
                "duos_amber_p_kwh":                 0.0,
                "duos_green_p_kwh":                 0.0,
                "gduos_red_p_kwh":                  5.982,
                "gduos_amber_p_kwh":                0.814,
                "gduos_green_p_kwh":                0.05,
                "fixed_p_per_day":                  0.0,
                "capacity_p_per_kva_day":           7.79,
                "excess_capacity_p_per_kva_day":    7.79,
                "gduos_fixed_p_per_day":            15.15,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["09:00", "16:00"], ["19:00", "20:30"]], "weekend": [["16:00", "19:00"]]},
                    "green": "remainder",
                },
            },
        },

        "SEPD": {
            # SSEN Southern. V1.2.
            # https://www.ssen.co.uk/globalassets/library/charging-statements-sepd/202627/sepd-duos-charges-2026-27_v1.2.pdf
            "LV": {
                "duos_red_p_kwh":                   6.243,
                "duos_amber_p_kwh":                 0.509,
                "duos_green_p_kwh":                 0.028,
                "gduos_red_p_kwh":                  8.447,
                "gduos_amber_p_kwh":                1.124,
                "gduos_green_p_kwh":                0.057,
                "fixed_p_per_day":                  0.0,
                "capacity_p_per_kva_day":           10.63,
                "excess_capacity_p_per_kva_day":    10.63,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["16:30", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:30"], ["19:30", "22:00"]], "weekend": [["09:30", "21:30"]]},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   0.377,
                "duos_amber_p_kwh":                 0.0,
                "duos_green_p_kwh":                 0.0,
                "gduos_red_p_kwh":                  5.239,
                "gduos_amber_p_kwh":                0.404,
                "gduos_green_p_kwh":                0.017,
                "fixed_p_per_day":                  0.0,
                "capacity_p_per_kva_day":           10.06,
                "excess_capacity_p_per_kva_day":    10.06,
                "gduos_fixed_p_per_day":            471.07,
                "rag_schedule": {
                    "red": {"weekday": [["16:30", "19:30"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:30"], ["19:30", "22:00"]], "weekend": [["09:30", "21:30"]]},
                    "green": "remainder",
                },
            },
        },

        "SHEPD": {
            # SSEN North Scotland. V1.2.
            # https://www.ssen.co.uk/globalassets/library/charging-statements-shepd/202627/shepd-duos-charges-2026-27_v1.2.pdf
            "LV": {
                "duos_red_p_kwh":                   8.049,
                "duos_amber_p_kwh":                 2.321,
                "duos_green_p_kwh":                 0.299,
                "gduos_red_p_kwh":                  8.397,
                "gduos_amber_p_kwh":                2.929,
                "gduos_green_p_kwh":                0.629,
                "fixed_p_per_day":                  0.0,
                "capacity_p_per_kva_day":           13.83,
                "excess_capacity_p_per_kva_day":    13.83,
                "gduos_fixed_p_per_day":            0.0,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:00"], ["19:00", "21:00"]], "weekend": [["12:00", "20:00"]]},
                    "green": "remainder",
                },
            },
            "HV": {
                "duos_red_p_kwh":                   1.463,
                "duos_amber_p_kwh":                 0.018,
                "duos_green_p_kwh":                 0.0,
                "gduos_red_p_kwh":                  3.372,
                "gduos_amber_p_kwh":                0.857,
                "gduos_green_p_kwh":                0.339,
                "fixed_p_per_day":                  0.0,
                "capacity_p_per_kva_day":           20.1,
                "excess_capacity_p_per_kva_day":    20.1,
                "gduos_fixed_p_per_day":            1073.07,
                "rag_schedule": {
                    "red": {"weekday": [["16:00", "19:00"]], "weekend": []},
                    "amber": {"weekday": [["07:00", "16:00"], ["19:00", "21:00"]], "weekend": [["12:00", "20:00"]]},
                    "green": "remainder",
                },
            },
        },

        "SPEN": {
            # SP Energy Networks: older figures, not re-read on 2026-11-01 (site
            # blocked). One set covers SPD and SPM, and weekend red is unconfirmed.
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
                    "_warning": SP_UNVERIFIED,
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
                    "_warning": SP_UNVERIFIED,
                    "red":   {"weekday": [["16:30", "19:30"]], "weekend": [["16:00", "20:00"]]},
                    "amber": {"weekday": [["08:00", "16:30"], ["19:30", "22:30"]], "weekend": []},
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


def excess_rate_gbp_per_kva_day(rates: dict) -> float:
    """Excess capacity rate from a raw rate dict; defaults to the capacity rate,
    which is what every statement checked so far publishes."""
    p = rates.get("excess_capacity_p_per_kva_day", rates["capacity_p_per_kva_day"])
    return p / 100


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
