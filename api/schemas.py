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
