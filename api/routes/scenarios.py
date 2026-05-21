import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from fastapi import APIRouter
from api.schemas import ScenarioOptionsResponse
from src.config import BESS_SCENARIOS, EXPORT_SCENARIOS

router = APIRouter()


@router.get("/scenarios/options", response_model=ScenarioOptionsResponse)
def get_scenario_options():
    mw_options = sorted(set(s["max_mw"] for s in BESS_SCENARIOS))
    duration_options = sorted(set(
        int(s["max_mwh"] / s["max_mw"]) for s in BESS_SCENARIOS
    ))
    return ScenarioOptionsResponse(
        mw_options=mw_options,
        duration_options=duration_options,
        export_options=EXPORT_SCENARIOS,
    )
