from pydantic import BaseModel
from typing import Optional


class ArchetypeResponse(BaseModel):
    id: str
    display_name: str
    description: str
    peak_mw: float
    base_mw: float
    offpeak_mw: float
    contracted_kva: int
    pv_kwp: int
    chp_kw: int
    has_pv: bool
    has_chp: bool
    dno: str
    tariff: str


class ScenarioOptionsResponse(BaseModel):
    mw_options: list[float]
    duration_options: list[int]
    export_options: list[float]


class BessSelection(BaseModel):
    mw: float
    duration: int


class RunRequest(BaseModel):
    archetypes: list[str]
    bess_selections: list[BessSelection]
    export_selections: list[float]
    start_date: str       # YYYY-MM-DD
    end_date: str         # YYYY-MM-DD
    price_exposure: str   # "da" or "imbalance"


class RunStatusResponse(BaseModel):
    status: str
    progress_pct: int
    scenarios_complete: int
    scenarios_total: int
    current_scenario: Optional[str] = None
    results: Optional[dict] = None
    error: Optional[str] = None
