import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import json
import math
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date

from fastapi import APIRouter, HTTPException

from api.schemas import RunRequest, RunStatusResponse
from api.jobs import create_job, update_job, get_job
from src.config import SITE_ARCHETYPES, BESS_SCENARIOS

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=2)

_DISPLAY_NAMES = {
    "small_office":      "Small Commercial",
    "medium_industrial": "Mid-Size Industrial",
    "large_industrial":  "Large Industrial",
}

_PRICE_COLUMNS = {
    "da":         ("da_forecast_gbp",  "da_actual_gbp"),
    "imbalance":  ("imb_forecast_gbp", "imb_actual_gbp"),
}


def _validate_run_request(req: RunRequest) -> str | None:
    if not req.archetypes:
        return "Select at least one archetype."
    for a in req.archetypes:
        if a not in SITE_ARCHETYPES:
            return f"Unknown archetype: {a}"
    if not req.bess_selections:
        return "Select at least one BESS configuration."
    if not req.export_selections:
        return "Select at least one export limit."
    if req.price_exposure not in _PRICE_COLUMNS:
        return "price_exposure must be 'da' or 'imbalance'."
    try:
        start = date.fromisoformat(req.start_date)
        end = date.fromisoformat(req.end_date)
    except ValueError:
        return "Invalid date format — use YYYY-MM-DD."
    if end <= start:
        return "End date must be after start date."
    return None


def _find_bess_scenario(mw: float, duration_h: int):
    target_mwh = mw * duration_h
    for s in BESS_SCENARIOS:
        if abs(s["max_mw"] - mw) < 1e-9 and abs(s["max_mwh"] - target_mwh) < 1e-9:
            return s
    return None


def _build_bess_params(scenario: dict, export_limit: float) -> dict:
    eta = scenario["eta_roundtrip"] ** 0.5
    return {
        "power_mw":             scenario["max_mw"],
        "capacity_mwh":         scenario["max_mwh"],
        "soc_min":              scenario["min_soc"],
        "soc_max":              scenario["max_soc"],
        "soc_initial":          scenario["initial_soc"],
        "charge_efficiency":    eta,
        "discharge_efficiency": eta,
        "deg_cost_gbp_mwh":     scenario["deg_cost_gbp_per_mwh"],
        "max_cycles_per_day":   scenario["max_cycles_per_day"],
        "export_limit_mw":      export_limit,
    }


def _f(value: float, decimals: int) -> float:
    """Round a float; return 0.0 if NaN/Inf."""
    if math.isnan(value) or math.isinf(value):
        return 0.0
    return round(value, decimals)


def _serialise_scenario(settled, scenario_label: str, export_limit: float) -> dict:
    """Compute summary stats and timeseries for one settled scenario."""
    net_benefit_gbp      = float(settled["net_settlement_gbp"].sum())
    baseline_net_gbp     = float(settled["baseline_net_gbp"].sum())
    total_standing_gbp   = float(settled["total_standing_gbp"].sum())
    site_cost_wo_bess    = baseline_net_gbp + total_standing_gbp
    site_cost_w_bess     = site_cost_wo_bess - net_benefit_gbp
    total_throughput_mwh = float((settled["dis1_mw"] + settled["dis2_mw"]).sum() * 0.5)
    peak_dispatch_mw     = float((settled["dis1_mw"] + settled["dis2_mw"]).max())
    gbp_per_kwh          = (net_benefit_gbp / (total_throughput_mwh * 1000)
                            if total_throughput_mwh > 0 else 0.0)

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
    # Strip timezone so JSON serialisation is clean
    if ts["startTime"].dt.tz is not None:
        ts["startTime"] = ts["startTime"].dt.tz_localize(None)
    ts["startTime"] = ts["startTime"].astype(str)

    # pandas to_json converts NaN → null; json.loads gives us Python None
    timeseries = json.loads(ts.to_json(orient="records"))

    return {
        "scenario_label":        scenario_label,
        "export_limit_mw":       export_limit,
        "net_benefit_gbp":       _f(net_benefit_gbp, 2),
        "baseline_net_gbp":      _f(baseline_net_gbp, 2),
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


def _run_background(job_id: str, req: RunRequest) -> None:
    import tempfile
    from src.data_builder import build_optimiser_input
    from src.optimiser import calculate_baseline, run_optimiser, calculate_settlement
    from src.report import build_report

    try:
        update_job(job_id, status="running")

        start_utc = req.start_date + "T00:00:00Z"
        end_utc   = req.end_date   + "T00:00:00Z"
        forecast_col, actual_col = _PRICE_COLUMNS[req.price_exposure]

        total_scenarios = (
            len(req.archetypes) *
            len(req.bess_selections) *
            len(req.export_selections)
        )
        scenarios_complete = 0
        all_results = {}
        scenario_paths = []   # paths to per-scenario pickle files on disk

        tmp_dir = tempfile.mkdtemp()

        for archetype_id in req.archetypes:
            site_params = SITE_ARCHETYPES[archetype_id]

            df = build_optimiser_input(
                start_utc=start_utc,
                end_utc=end_utc,
                site_params=site_params,
                site_name=archetype_id,
                force_refresh=True,
            )
            df_baseline = calculate_baseline(df, actual_price_col=actual_col)
            del df

            archetype_scenarios = []

            for sel in req.bess_selections:
                mw, duration_h = sel.mw, sel.duration
                scenario = _find_bess_scenario(mw, duration_h)
                if scenario is None:
                    raise ValueError(f"No BESS scenario for {mw} MW / {duration_h}h")

                for export_limit in req.export_selections:
                    current = f"{scenario['label']} | {_DISPLAY_NAMES.get(archetype_id, archetype_id)} | Export {export_limit} MW"
                    update_job(job_id, current_scenario=current)

                    bess_params = _build_bess_params(scenario, export_limit)
                    results_df  = run_optimiser(df_baseline, bess_params,
                                                forecast_price_col=forecast_col,
                                                actual_price_col=actual_col)
                    settled     = calculate_settlement(results_df, bess_params,
                                                      actual_price_col=actual_col)
                    del results_df

                    settled = settled.copy()
                    settled["scenario_label"] = scenario["label"]
                    settled["export_limit_mw"] = export_limit
                    settled["site_name"] = archetype_id

                    archetype_scenarios.append(
                        _serialise_scenario(settled, scenario["label"], export_limit)
                    )

                    # Persist to disk immediately — frees this DF from memory
                    pkl_path = os.path.join(tmp_dir, f"scenario_{len(scenario_paths)}.pkl")
                    settled.to_pickle(pkl_path)
                    scenario_paths.append(pkl_path)
                    del settled

                    scenarios_complete += 1
                    progress_pct = int(scenarios_complete / total_scenarios * 100)
                    update_job(
                        job_id,
                        scenarios_complete=scenarios_complete,
                        scenarios_total=total_scenarios,
                        progress_pct=progress_pct,
                    )

            all_results[archetype_id] = archetype_scenarios
            del df_baseline

        # Build XLSX — build_report loads one scenario at a time from disk
        xlsx_path = os.path.join(tmp_dir, "bess_scenarios.xlsx")
        build_report(scenario_paths, xlsx_path)

        # Per-scenario pickles no longer needed
        for p in scenario_paths:
            os.unlink(p)

        update_job(
            job_id,
            status="complete",
            progress_pct=100,
            scenarios_complete=total_scenarios,
            scenarios_total=total_scenarios,
            results=all_results,
            xlsx_path=xlsx_path,
        )

    except Exception as exc:
        update_job(job_id, status="failed", error=str(exc))


@router.post("/run")
def post_run(req: RunRequest):
    error = _validate_run_request(req)
    if error:
        raise HTTPException(status_code=422, detail=error)

    total_scenarios = (
        len(req.archetypes) *
        len(req.bess_selections) *
        len(req.export_selections)
    )

    job_id = str(uuid.uuid4())
    create_job(job_id, scenarios_total=total_scenarios)
    _executor.submit(_run_background, job_id, req)
    return {"job_id": job_id}


@router.get("/run/{job_id}", response_model=RunStatusResponse)
def get_run_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return RunStatusResponse(
        status=job["status"],
        progress_pct=job["progress_pct"],
        scenarios_complete=job["scenarios_complete"],
        scenarios_total=job["scenarios_total"],
        current_scenario=job.get("current_scenario"),
        results=job["results"],
        error=job["error"],
    )
