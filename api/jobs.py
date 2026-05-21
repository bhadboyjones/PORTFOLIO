import threading
from typing import Any, Dict, Optional

_jobs: Dict[str, Dict[str, Any]] = {}
_lock = threading.Lock()


def create_job(job_id: str, scenarios_total: int) -> None:
    with _lock:
        _jobs[job_id] = {
            "status": "pending",
            "progress_pct": 0,
            "scenarios_complete": 0,
            "scenarios_total": scenarios_total,
            "current_scenario": None,
            "results": None,
            "dataframes": None,   # list of settled DataFrames for XLSX export
            "error": None,
        }


def update_job(job_id: str, **kwargs) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id].update(kwargs)


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None
