import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from api.jobs import get_job

router = APIRouter()


@router.get("/export/{job_id}")
def export_xlsx(job_id: str):
    job = get_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job["status"] != "complete":
        raise HTTPException(status_code=404, detail="Job not complete — results not yet available.")

    xlsx_path = job.get("xlsx_path")
    if not xlsx_path or not os.path.exists(xlsx_path):
        raise HTTPException(status_code=404, detail="Export file not available for this job.")

    return FileResponse(
        path=xlsx_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="bess_scenarios.xlsx",
    )
