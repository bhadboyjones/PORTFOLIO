import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from fastapi import APIRouter
from api.schemas import ArchetypeResponse
from src.config import SITE_ARCHETYPES, NETWORK_CONFIG_NEC_HV

router = APIRouter()

_DISPLAY_NAMES = {
    "small_office":       "Small Commercial",
    "medium_industrial":  "Mid-Size Industrial",
    "large_industrial":   "Large Industrial",
}

_ARCHETYPE_ORDER = ["small_office", "medium_industrial", "large_industrial"]


@router.get("/archetypes", response_model=list[ArchetypeResponse])
def get_archetypes():
    result = []
    for archetype_id in _ARCHETYPE_ORDER:
        params = SITE_ARCHETYPES[archetype_id]
        result.append(ArchetypeResponse(
            id=archetype_id,
            display_name=_DISPLAY_NAMES[archetype_id],
            description=params["description"],
            peak_mw=params["peak_mw"],
            base_mw=params["base_mw"],
            offpeak_mw=params["offpeak_mw"],
            contracted_kva=params["contracted_kva"],
            pv_kwp=params["pv_kwp"],
            chp_kw=params["chp_kw"],
            has_pv=params["pv_kwp"] > 0,
            has_chp=params["chp_kw"] > 0,
            dno=NETWORK_CONFIG_NEC_HV["dno"],
            tariff=NETWORK_CONFIG_NEC_HV["tariff"],
        ))
    return result
