import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

import tempfile
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from api.jobs import get_job
from src.report import build_report

router = APIRouter()


@router.get("/export/{job_id}")
def export_xlsx(job_id: str):
    job = get_job(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job["status"] != "complete":
        raise HTTPException(status_code=404, detail="Job not complete — results not yet available.")

    dataframes = job.get("dataframes")
    if not dataframes:
        raise HTTPException(status_code=404, detail="No DataFrames stored for this job.")

    tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
    tmp.close()

    build_report(dataframes, tmp.name)

    return FileResponse(
        path=tmp.name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="bess_scenarios.xlsx",
    )
