import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional

_jobs: Dict[str, Dict[str, Any]] = {}
_lock = threading.Lock()


def generate_job_id() -> str:
    """
    Generate a unique job ID for an optimisation run.

    Format: YYYYMMDD_HHMMSS_{4-char-hex}
    Example: 20260526_143022_a3f9

    The hex fragment is taken from os.urandom to avoid collisions between
    jobs started within the same second.
    """
    now = datetime.now(tz=timezone.utc)
    hex_fragment = os.urandom(2).hex()  # 4 hex chars
    return now.strftime("%Y%m%d_%H%M%S") + f"_{hex_fragment}"


def create_job(job_id: str, scenarios_total: int) -> None:
    with _lock:
        _jobs[job_id] = {
            "status": "pending",
            "progress_pct": 0,
            "scenarios_complete": 0,
            "scenarios_total": scenarios_total,
            "current_scenario": None,
            "results": None,
            "xlsx_path": None,    # path to pre-built XLSX temp file
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
