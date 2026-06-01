import logging
import math
import json
import os
import shutil
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from api.jobs import create_job, generate_job_id, get_job, update_job
from api.schemas import CsvRunParams
from src.config import _BESS_BASE

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=2)

_PRICE_COLUMNS = {
    "da":        ("da_forecast_gbp",  "da_actual_gbp"),
    "imbalance": ("imb_forecast_gbp", "imb_actual_gbp"),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _f(value: float, decimals: int) -> float:
    """Round a float; return 0.0 if NaN/Inf."""
    if math.isnan(value) or math.isinf(value):
        return 0.0
    return round(value, decimals)


def _build_bess_params(
    power_mw: float,
    capacity_mwh: float,
    rte_pct: float,
    max_cycles: float,
    export_limit_mw: float,
    charge_eff_pct: float = None,
    discharge_eff_pct: float = None,
    soc_min_pct: float = 5.0,
    soc_max_pct: float = 95.0,
    deg_cost_gbp_mwh: float = 8.0,
) -> dict:
    """Build BESS parameter dict. Charge/discharge eff default to sqrt(RTE) if not supplied."""
    fallback = math.sqrt(rte_pct / 100)
    return {
        "power_mw":             power_mw,
        "capacity_mwh":         capacity_mwh,
        "soc_min":              soc_min_pct / 100,
        "soc_max":              soc_max_pct / 100,
        "soc_initial":          _BESS_BASE["initial_soc"],
        "charge_efficiency":    (charge_eff_pct / 100) if charge_eff_pct is not None else fallback,
        "discharge_efficiency": (discharge_eff_pct / 100) if discharge_eff_pct is not None else fallback,
        "deg_cost_gbp_mwh":     deg_cost_gbp_mwh,
        "max_cycles_per_day":   max_cycles,
        "export_limit_mw":      export_limit_mw,
    }


def _serialise_scenario(settled, scenario_label: str, export_limit_mw: float, sp_duration_hrs: float = 0.5) -> dict:
    """Build summary stats and SP-level timeseries for one settled scenario."""
    net_benefit_gbp      = float(settled["net_settlement_gbp"].sum())
    baseline_net_gbp     = float(settled["baseline_net_gbp"].sum())
    total_standing_gbp   = float(settled["total_standing_gbp"].sum())
    site_cost_wo_bess    = baseline_net_gbp + total_standing_gbp
    site_cost_w_bess     = site_cost_wo_bess - net_benefit_gbp
    total_throughput_mwh = float((settled["dis1_mw"] + settled["dis2_mw"]).sum() * sp_duration_hrs)
    peak_dispatch_mw     = float((settled["dis1_mw"] + settled["dis2_mw"]).max())
    gbp_per_kwh          = (
        net_benefit_gbp / (total_throughput_mwh * 1000)
        if total_throughput_mwh > 0 else 0.0
    )

    settled = settled.copy()
    settled["cumulative_pnl_gbp"] = settled["net_settlement_gbp"].cumsum()

    timeseries_cols = [
        "startTime",
        "dis1_mw", "dis2_mw", "charge1_mw", "charge2_mw", "soc_mwh",
        "net_settlement_gbp", "cumulative_pnl_gbp", "baseline_net_gbp",
        "dis1_saving_gbp", "dis2_revenue_gbp",
        "charge2_cost_gbp", "charge1_opp_cost_gbp", "deg_cost_gbp",
    ]
    ts = settled[timeseries_cols].copy()
    if ts["startTime"].dt.tz is not None:
        ts["startTime"] = ts["startTime"].dt.tz_localize(None)
    ts["startTime"] = ts["startTime"].astype(str)
    timeseries = json.loads(ts.to_json(orient="records"))

    return {
        "scenario_label":        scenario_label,
        "export_limit_mw":       export_limit_mw,
        "net_benefit_gbp":       _f(net_benefit_gbp, 2),
        "baseline_net_gbp":      _f(baseline_net_gbp, 2),
        "baseline_import_cost_gbp": _f(float(settled["baseline_import_cost_gbp"].sum()), 2),
        "baseline_export_rev_gbp":  _f(float(settled["baseline_export_rev_gbp"].sum()), 2),
        "baseline_thermal_cost_gbp": _f(float(settled["baseline_thermal_cost_gbp"].sum()), 2),
        "site_cost_wo_bess_gbp": _f(site_cost_wo_bess, 2),
        "site_cost_w_bess_gbp":  _f(site_cost_w_bess, 2),
        "dis1_saving_gbp":       _f(float(settled["dis1_saving_gbp"].sum()), 2),
        "dis2_revenue_gbp":      _f(float(settled["dis2_revenue_gbp"].sum()), 2),
        "charge2_cost_gbp":      _f(float(settled["charge2_cost_gbp"].sum()), 2),
        "charge1_opp_cost_gbp":  _f(float(settled["charge1_opp_cost_gbp"].sum()), 2),
        "deg_cost_gbp":          _f(float(settled["deg_cost_gbp"].sum()), 2),
        "total_standing_gbp":    _f(total_standing_gbp, 2),
        "total_throughput_mwh":  _f(total_throughput_mwh, 2),
        "peak_dispatch_mw":      _f(peak_dispatch_mw, 3),
        "gbp_per_kwh":           _f(gbp_per_kwh, 4),
        "dispatch_timeseries":   timeseries,
    }


# ---------------------------------------------------------------------------
# Background task
# ---------------------------------------------------------------------------

def _run_csv_background(job_id: str, csv_path: str, params: CsvRunParams) -> None:
    from src.csv_pipeline import load_and_validate_csv, build_csv_optimiser_input, calculate_baseline_csv
    from src.optimiser import run_optimiser, calculate_settlement
    from src.report import build_report

    try:
        update_job(job_id, status="running")

        forecast_col, actual_col = _PRICE_COLUMNS[params.price_exposure]

        # 1. Load and validate CSV — unlink temp file immediately after reading
        try:
            csv_df, warnings, sp_duration_hrs, n_sps_per_day = load_and_validate_csv(csv_path, chp_toggle=params.chp_toggle)
            for w in warnings:
                logger.warning("[job %s] CSV validation: %s", job_id, w)
        finally:
            try:
                os.unlink(csv_path)
            except OSError:
                pass

        # Derive contracted_kva from peak positive demand if not provided
        contracted_kva = params.contracted_kva
        if contracted_kva is None:
            contracted_kva = float(csv_df["net_demand_mw"].clip(lower=0).max()) * 1000

        tmp_dir = tempfile.mkdtemp()

        # Build RAG override dicts from the eight request params.
        # Frontend always sends these pre-populated from DNO defaults,
        # so the backend never needs to fall back to guessing.
        rag_red_windows = {
            "weekday": [[params.rag_red_start, params.rag_red_end]],
            "weekend": [],
        }
        rag_amber_windows = {
            "weekday": [
                [params.rag_amber_morning_start, params.rag_amber_morning_end],
                [params.rag_amber_evening_start, params.rag_amber_evening_end],
            ],
            "weekend": (
                [[params.rag_weekend_amber_start, params.rag_weekend_amber_end]]
                if params.rag_weekend_amber_start and params.rag_weekend_amber_end
                else []
            ),
        }

        # 2. Build full MILP-ready input DataFrame
        df = build_csv_optimiser_input(
            csv_df=csv_df,
            dno_key=params.dno_key,
            voltage_level=params.voltage_level,
            contracted_kva=contracted_kva,
            nec_gbp_mwh=params.nec_gbp_mwh,
            rate_overrides=params.rate_overrides,
            force_refresh=False,
            rag_red_windows=rag_red_windows,
            rag_amber_windows=rag_amber_windows,
            sp_duration_hrs=sp_duration_hrs,
            n_sps_per_day=n_sps_per_day,
        )
        del csv_df

        # 3. Baseline — uses actual MC directly, returns per-SP DataFrame
        df_baseline = calculate_baseline_csv(
            df,
            thermal_mc_gbp_mwh=params.chp_mc_gbp_mwh,
            actual_price_col=actual_col,
            sp_duration_hrs=sp_duration_hrs,
        )
        del df

        total_scenarios = len(params.bess_configs) * len(params.export_limits)
        update_job(
            job_id,
            scenarios_total=total_scenarios,
            scenarios_complete=0,
            progress_pct=30,
            validation_warnings=warnings if warnings else None,
        )

        # 4. Multi-scenario BESS loop: configs × export limits
        all_results = []
        pkl_paths = []
        scenario_idx = 0

        for bess_cfg in params.bess_configs:
            for export_lim in params.export_limits:
                label = f"{bess_cfg['power_mw']:g}MW / {bess_cfg['capacity_mwh']:g}MWh"
                update_job(job_id, current_scenario=f"{label} | Export {export_lim:g} MW")

                bess_params = _build_bess_params(
                    bess_cfg["power_mw"],
                    bess_cfg["capacity_mwh"],
                    params.bess_rte_pct,
                    params.bess_max_cycles,
                    export_lim,
                    charge_eff_pct=params.bess_charge_eff_pct,
                    discharge_eff_pct=params.bess_discharge_eff_pct,
                    soc_min_pct=params.bess_soc_min_pct,
                    soc_max_pct=params.bess_soc_max_pct,
                    deg_cost_gbp_mwh=params.bess_deg_cost_gbp_mwh,
                )

                results_df = run_optimiser(
                    df_baseline,
                    bess_params,
                    forecast_price_col=forecast_col,
                    actual_price_col=actual_col,
                    sp_duration_hrs=sp_duration_hrs,
                    n_sps_per_day=n_sps_per_day,
                )
                settled = calculate_settlement(
                    results_df,
                    bess_params,
                    actual_price_col=actual_col,
                    sp_duration_hrs=sp_duration_hrs,
                )
                del results_df

                settled = settled.copy()
                settled["scenario_label"]  = label
                settled["export_limit_mw"] = export_lim

                all_results.append(_serialise_scenario(settled, label, export_lim, sp_duration_hrs=sp_duration_hrs))

                pkl_path = os.path.join(tmp_dir, f"scenario_{scenario_idx}.pkl")
                settled.to_pickle(pkl_path)
                pkl_paths.append(pkl_path)
                del settled

                scenario_idx += 1
                progress = 30 + int(60 * scenario_idx / total_scenarios)
                update_job(job_id, scenarios_complete=scenario_idx, progress_pct=min(progress, 90))

        del df_baseline

        # 5. Build XLSX
        xlsx_path = os.path.join(tmp_dir, "bess_csv_results.xlsx")
        xlsx_path = build_report(pkl_paths, xlsx_path, job_id=job_id)
        for p in pkl_paths:
            os.unlink(p)

        update_job(
            job_id,
            status="complete",
            progress_pct=100,
            scenarios_complete=total_scenarios,
            scenarios_total=total_scenarios,
            results={"csv_run": all_results},
            xlsx_path=xlsx_path,
            mode="csv",
        )

    except Exception as exc:
        update_job(job_id, status="failed", error=str(exc))


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/run/csv")
async def post_run_csv(
    file: UploadFile = File(..., description="Site meter CSV or XLSX file"),
    params: CsvRunParams = Depends(CsvRunParams),
):
    """
    Upload a site meter CSV and run the BTM BESS optimisation.

    Accepts multipart/form-data with the file plus CsvRunParams fields.
    Returns job_id immediately. Poll GET /run/{job_id} for status.
    Download XLSX via GET /export/{job_id} when status == 'complete'.
    """
    suffix = ".xlsx" if (file.filename or "").lower().endswith((".xlsx", ".xls")) else ".csv"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        csv_path = tmp.name
    file.file.close()

    if os.path.getsize(csv_path) == 0:
        os.unlink(csv_path)
        raise HTTPException(status_code=422, detail="Uploaded file is empty.")

    job_id = generate_job_id()
    create_job(job_id, scenarios_total=len(params.bess_configs) * len(params.export_limits))
    _executor.submit(_run_csv_background, job_id, csv_path, params)

    return {"job_id": job_id}
