"""
report.py
=========
Excel report generation for BTM BESS scenario results.

Expects a list of scenario DataFrames that have been through the full
pipeline:

    build_optimiser_input()   — data_builder
    calculate_baseline()      — baseline site cost without BESS
    run_optimiser()           — BESS dispatch
    calculate_settlement()    — BESS P&L + standing charges

Each DataFrame in all_results must contain:
    scenario_label      str column — BESS config label (e.g. "1MW_2h")
    export_limit_mw     float column — export cap for this scenario
    site_name           str column — site archetype name (optional)
    All baseline_*, net_settlement_gbp, total_standing_gbp, dispatch columns

Call:
    from src.report import build_report
    build_report(all_results, "../outputs/bess_scenarios_pnl.xlsx")
"""

import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


# ---------------------------------------------------------------------------
# Style constants
# ---------------------------------------------------------------------------

_HEADER_FONT     = Font(name="Arial", bold=True, color="FFFFFF", size=10)
_SUBHEADER_FONT  = Font(name="Arial", bold=True, color="FFFFFF", size=10)
_BODY_FONT       = Font(name="Arial", size=10)

_FILL_DARK_BLUE  = PatternFill("solid", start_color="1F4E79")  # header
_FILL_MID_BLUE   = PatternFill("solid", start_color="2E75B6")  # section subheader
_FILL_LIGHT_BLUE = PatternFill("solid", start_color="D6E4F0")  # baseline section
_FILL_GREEN      = PatternFill("solid", start_color="E2EFDA")  # BESS P&L section
_FILL_AMBER      = PatternFill("solid", start_color="FFF2CC")  # standing charges

_CENTER = Alignment(horizontal="center")
_RIGHT  = Alignment(horizontal="right")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_header_row(ws, col_names, row=1, fill=None, font=None, col_widths=None):
    """Write a styled header row to a worksheet."""
    fill = fill or _FILL_DARK_BLUE
    font = font or _HEADER_FONT
    for col_idx, name in enumerate(col_names, start=1):
        cell = ws.cell(row=row, column=col_idx, value=name)
        cell.font      = font
        cell.fill      = fill
        cell.alignment = _CENTER
        if col_widths:
            ws.column_dimensions[get_column_letter(col_idx)].width = col_widths[col_idx - 1]
        else:
            ws.column_dimensions[get_column_letter(col_idx)].width = 26


def _safe_float(value):
    """Round floats for Excel; pass strings and ints through unchanged."""
    if isinstance(value, float):
        return round(value, 2)
    return value


# ---------------------------------------------------------------------------
# Summary sheet
# ---------------------------------------------------------------------------

def _build_summary_rows(all_results):
    """
    Build one summary row per scenario with full P&L stack:
        - Site identification
        - Baseline cost (without BESS)
        - Standing charges (sunk, both scenarios)
        - BESS P&L components
        - Site cost with BESS
        - Net benefit
    """
    rows = []
    for scenario in all_results:
        baseline_net      = scenario["baseline_net_gbp"].sum()
        total_standing    = scenario["total_standing_gbp"].sum()
        net_settlement    = scenario["net_settlement_gbp"].sum()

        site_cost_wo_bess = baseline_net + total_standing
        site_cost_w_bess  = site_cost_wo_bess - net_settlement
        bess_net_benefit  = net_settlement   # = site_cost_wo_bess - site_cost_w_bess

        rows.append({
            # Identification
            "site_name":                    scenario["site_name"].iloc[0] if "site_name" in scenario.columns else "",
            "scenario_label":               scenario["scenario_label"].iloc[0],
            "export_limit_mw":              scenario["export_limit_mw"].iloc[0],

            # Baseline (without BESS)
            "baseline_import_cost_gbp":     scenario["baseline_import_cost_gbp"].sum(),
            "baseline_export_rev_gbp":      scenario["baseline_export_rev_gbp"].sum(),
            "baseline_chp_cost_gbp":        scenario["baseline_chp_cost_gbp"].sum(),
            "baseline_net_gbp":             baseline_net,

            # Standing charges (same in both scenarios)
            "dduos_fixed_gbp":              scenario["dduos_fixed_gbp"].sum(),
            "dduos_capacity_gbp":           scenario["dduos_capacity_gbp"].sum(),
            "gduos_fixed_gbp":              scenario["gduos_fixed_gbp"].sum(),
            "total_standing_gbp":           total_standing,

            # BESS P&L components
            "dis1_saving_gbp":              scenario["dis1_saving_gbp"].sum(),
            "dis2_revenue_gbp":             scenario["dis2_revenue_gbp"].sum(),
            "charge2_cost_gbp":             scenario["charge2_cost_gbp"].sum(),
            "charge1_opp_cost_gbp":         scenario["charge1_opp_cost_gbp"].sum(),
            "deg_cost_gbp":                 scenario["deg_cost_gbp"].sum(),
            "net_settlement_gbp":           net_settlement,

            # Comparison
            "site_cost_wo_bess_gbp":        site_cost_wo_bess,
            "site_cost_w_bess_gbp":         site_cost_w_bess,
            "bess_net_benefit_gbp":         bess_net_benefit,
        })

    return pd.DataFrame(rows).sort_values("bess_net_benefit_gbp", ascending=False)


def _write_summary_sheet(wb, summary_df):
    """Write the summary sheet with colour-coded column sections."""
    ws = wb.create_sheet(title="Summary", index=0)

    # Section labels on row 1, column headers on row 2
    sections = {
        # (start_col, end_col, label, fill)
        "identification": (1,  3,  "Site",              _FILL_DARK_BLUE),
        "baseline":       (4,  7,  "Baseline (no BESS)", _FILL_MID_BLUE),
        "standing":       (8,  11, "Standing Charges",   _FILL_MID_BLUE),
        "bess_pnl":       (12, 17, "BESS P&L",           _FILL_MID_BLUE),
        "comparison":     (18, 20, "Comparison",         _FILL_MID_BLUE),
    }

    for key, (start, end, label, fill) in sections.items():
        cell = ws.cell(row=1, column=start, value=label)
        cell.font      = _HEADER_FONT
        cell.fill      = fill
        cell.alignment = _CENTER
        if end > start:
            ws.merge_cells(
                start_row=1, start_column=start,
                end_row=1, end_column=end
            )

    # Column headers on row 2
    col_names = list(summary_df.columns)
    _write_header_row(ws, col_names, row=2, fill=_FILL_DARK_BLUE)

    # Set column widths
    for col_idx in range(1, len(col_names) + 1):
        ws.column_dimensions[get_column_letter(col_idx)].width = 26

    # Data rows from row 3
    for row_idx, row in enumerate(summary_df.itertuples(index=False), start=3):
        for col_idx, value in enumerate(row, start=1):
            ws.cell(row=row_idx, column=col_idx, value=_safe_float(value))

    # Freeze top two rows
    ws.freeze_panes = "A3"


# ---------------------------------------------------------------------------
# Detail sheets
# ---------------------------------------------------------------------------

_DETAIL_COLS = [
    # Timestamp
    "startTime",
    # Site demand
    "net_demand_mw",
    "net_demand_mwh",
    # Baseline
    "baseline_import_cost_gbp",
    "baseline_export_rev_gbp",
    "baseline_chp_cost_gbp",
    "baseline_net_gbp",
    # Standing charges
    "dduos_fixed_gbp",
    "dduos_capacity_gbp",
    "gduos_fixed_gbp",
    "total_standing_gbp",
    # BESS dispatch
    "charge1_mw",
    "charge2_mw",
    "dis1_mw",
    "dis2_mw",
    "soc_mwh",
    # BESS P&L
    "dis1_saving_gbp",
    "dis2_revenue_gbp",
    "charge2_cost_gbp",
    "charge1_opp_cost_gbp",
    "deg_cost_gbp",
    "net_settlement_gbp",
    # Rates (useful for audit)
    "import_rate_gbp",
    "export_rate_gbp",
]


def _write_detail_sheet(wb, scenario):
    """Write one SP-level detail sheet per scenario."""
    label        = scenario["scenario_label"].iloc[0]
    export_limit = scenario["export_limit_mw"].iloc[0]
    site         = scenario["site_name"].iloc[0] if "site_name" in scenario.columns else ""
    sheet_name   = f"{site}_{label}_exp{export_limit}".replace(".", "p")[:31]

    # Strip timezone from startTime for Excel compatibility
    scenario = scenario.copy()
    scenario["startTime"] = pd.to_datetime(scenario["startTime"]).dt.tz_localize(None)

    ws   = wb.create_sheet(title=sheet_name)
    cols = [c for c in _DETAIL_COLS if c in scenario.columns]

    _write_header_row(ws, cols, row=1, fill=_FILL_DARK_BLUE)

    for row_idx, row in enumerate(scenario[cols].itertuples(index=False), start=2):
        for col_idx, value in enumerate(row, start=1):
            ws.cell(row=row_idx, column=col_idx, value=_safe_float(value))

    ws.freeze_panes = "A2"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_report(all_results, output_path):
    """
    Build and save the full BESS scenario Excel report.

    Args:
        all_results  : list of scenario DataFrames — each must have been through
                       calculate_baseline(), run_optimiser(), calculate_settlement()
        output_path  : file path for the saved .xlsx

    Output sheets:
        Summary      : one row per scenario, full P&L stack, sorted by net benefit
        <scenario>   : one SP-level detail sheet per scenario

    Example:
        from src.report import build_report
        build_report(all_results, "../outputs/bess_scenarios_pnl.xlsx")
    """
    if not all_results:
        raise ValueError("all_results is empty — nothing to report.")

    wb = Workbook()
    wb.remove(wb.active)  # remove default blank sheet

    # Summary first
    summary_df = _build_summary_rows(all_results)
    _write_summary_sheet(wb, summary_df)

    # One detail sheet per scenario
    for scenario in all_results:
        _write_detail_sheet(wb, scenario)

    wb.save(output_path)
    print(f"Report saved — summary + {len(all_results)} detail sheets → {output_path}")