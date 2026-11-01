"""MIC sheets in the XLSX report."""

from openpyxl import Workbook, load_workbook

from src.report import _write_mic_sheets

SWEEP = {
    "scenario_label": "1MW / 2MWh", "current_kva": 1500.0, "peak_kva": 1098.3, "best_mic_kva": 1098.0,
    "rows": [dict(mic_kva=1098.0, reduction_kva=402.0, capacity_saved_gbp=5603.81,
                  dispatch_change_gbp=-3423.39, excess_gbp=5.54, excess_change_gbp=5.54,
                  value_gbp=2174.88, months_breached=1)],
}
BREACHES = [dict(scenario="1MW / 2MWh", export_limit_mw=0.0, month="2025-01", days=31, mic_kva=1000.0,
                 worst_wo_bess_kva=1200.0, worst_w_bess_kva=1000.0,
                 excess_wo_bess_gbp=620.0, excess_w_bess_gbp=0.0)]


def _sheets(tmp_path, *args):
    wb = Workbook(write_only=True)
    wb.create_sheet("Summary")
    _write_mic_sheets(wb, *args)
    path = tmp_path / "r.xlsx"
    wb.save(path)
    return load_workbook(path)


def test_sheets_written_with_values(tmp_path):
    wb = _sheets(tmp_path, SWEEP, BREACHES)
    rows = list(wb["MIC sweep"].values)
    assert ("Best MIC (kVA)", 1098.0) == rows[4][:2]
    assert rows[-1][6] == 2174.88
    assert list(wb["Months over MIC"].values)[1][7] == 620.0


def test_no_mic_no_sheets(tmp_path):
    assert _sheets(tmp_path, None, []).sheetnames == ["Summary"]
