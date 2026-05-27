import json as _json
from typing import Optional

from fastapi import Depends, Form, HTTPException
from pydantic import BaseModel

from src.duos_rates import VALID_DNOS, VALID_VOLTAGE_LEVELS


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
    mode: Optional[str] = None
    validation_warnings: Optional[list[str]] = None


class CsvRunParams:
    """
    Dependency class for POST /run/csv multipart/form-data.

    Inject with Depends(CsvRunParams) in the route handler.
    Raises HTTPException 422 on validation failure.

    BESS fields:
      bess_power_mw        — BESS rated power (MW)
      bess_capacity_mwh    — BESS energy capacity (MWh)
      bess_rte_pct         — Round-trip efficiency (%, default 90)
      bess_max_cycles      — Max charge+discharge cycles/day (default 1.5)

    RAG band overrides (all optional with sensible defaults):
      Frontend always sends these explicitly (pre-populated from DNO defaults)
      so the backend never needs to infer them.

    Advanced rate overrides (all optional):
      duos_*_gbp_mwh       — volumetric DUoS import rates (£/MWh, positive)
      gduos_*_gbp_mwh      — GDUoS export credits (£/MWh, NEGATIVE per model convention)
      fixed_gbp_per_day    — DUoS fixed daily charge (£/day)
      capacity_gbp_per_kva_day — DUoS capacity rate (£/kVA/day)
      gduos_fixed_gbp_per_day  — GDUoS fixed daily credit (£/day)
    """

    def __init__(
        self,
        # --- Core fields ---
        dno_key: str = Form(..., description="DNO identifier, e.g. 'NPG', 'NGED'"),
        voltage_level: str = Form("LV", description="'LV' or 'HV'. Defaults to LV."),
        export_limit_mw: float = Form(..., description="Site export limit (MW). Must be > 0."),
        # --- BESS ---
        bess_power_mw: float = Form(..., description="BESS rated power (MW)"),
        bess_capacity_mwh: float = Form(..., description="BESS energy capacity (MWh)"),
        bess_rte_pct: float = Form(90.0, description="Round-trip efficiency (%)"),
        bess_max_cycles: float = Form(1.5, description="Max charge+discharge cycles per day"),
        # --- Site ---
        contracted_kva: Optional[float] = Form(
            None, description="Contracted capacity (kVA). Defaults to peak CSV demand at unity PF.",
        ),
        chp_toggle: bool = Form(False, description="True if site has CHP generation."),
        price_exposure: str = Form("da", description="'da' or 'imbalance'"),
        chp_mc_gbp_mwh: float = Form(70.0, description="CHP marginal fuel cost (£/MWh)."),
        nec_gbp_mwh: float = Form(103.75, description="Non-energy charges (£/MWh)."),
        # --- RAG band time overrides ---
        rag_red_start: str = Form("16:00"),
        rag_red_end: str = Form("19:00"),
        rag_amber_morning_start: str = Form("07:00"),
        rag_amber_morning_end: str = Form("16:00"),
        rag_amber_evening_start: str = Form("19:00"),
        rag_amber_evening_end: str = Form("23:00"),
        rag_weekend_amber_start: str = Form(""),
        rag_weekend_amber_end: str = Form(""),
        # --- Advanced rate overrides ---
        duos_red_gbp_mwh: Optional[float] = Form(None),
        duos_amber_gbp_mwh: Optional[float] = Form(None),
        duos_green_gbp_mwh: Optional[float] = Form(None),
        gduos_red_gbp_mwh: Optional[float] = Form(None),
        gduos_amber_gbp_mwh: Optional[float] = Form(None),
        gduos_green_gbp_mwh: Optional[float] = Form(None),
        fixed_gbp_per_day: Optional[float] = Form(None),
        capacity_gbp_per_kva_day: Optional[float] = Form(None),
        gduos_fixed_gbp_per_day: Optional[float] = Form(None),
    ):
        # --- Validate enumerations ---
        if dno_key not in VALID_DNOS:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown DNO '{dno_key}'. Valid options: {VALID_DNOS}",
            )
        if voltage_level not in VALID_VOLTAGE_LEVELS:
            raise HTTPException(
                status_code=422,
                detail=f"voltage_level must be 'LV' or 'HV', got '{voltage_level}'.",
            )
        if price_exposure not in ("da", "imbalance"):
            raise HTTPException(
                status_code=422,
                detail="price_exposure must be 'da' or 'imbalance'.",
            )
        if export_limit_mw <= 0:
            raise HTTPException(
                status_code=422,
                detail="export_limit_mw must be greater than 0.",
            )
        if bess_power_mw <= 0:
            raise HTTPException(
                status_code=422,
                detail="bess_power_mw must be greater than 0.",
            )
        if bess_capacity_mwh <= 0:
            raise HTTPException(
                status_code=422,
                detail="bess_capacity_mwh must be greater than 0.",
            )
        duration_h = bess_capacity_mwh / bess_power_mw
        if not (0.5 <= duration_h <= 6.0):
            raise HTTPException(
                status_code=422,
                detail=(
                    f"BESS duration (capacity / power = {duration_h:.2f} hr) must be "
                    "between 0.5 and 6.0 hours."
                ),
            )

        self.dno_key        = dno_key
        self.voltage_level  = voltage_level
        self.export_limit_mw = export_limit_mw

        self.bess_power_mw    = bess_power_mw
        self.bess_capacity_mwh = bess_capacity_mwh
        self.bess_rte_pct     = bess_rte_pct
        self.bess_max_cycles  = bess_max_cycles

        self.contracted_kva  = contracted_kva
        self.chp_toggle      = chp_toggle
        self.price_exposure  = price_exposure
        self.chp_mc_gbp_mwh  = chp_mc_gbp_mwh
        self.nec_gbp_mwh     = nec_gbp_mwh

        self.rag_red_start            = rag_red_start
        self.rag_red_end              = rag_red_end
        self.rag_amber_morning_start  = rag_amber_morning_start
        self.rag_amber_morning_end    = rag_amber_morning_end
        self.rag_amber_evening_start  = rag_amber_evening_start
        self.rag_amber_evening_end    = rag_amber_evening_end
        self.rag_weekend_amber_start  = rag_weekend_amber_start
        self.rag_weekend_amber_end    = rag_weekend_amber_end

        # Collect only the rate overrides the caller actually supplied
        overrides: dict = {}
        for key, val in [
            ("duos_red_gbp_mwh",         duos_red_gbp_mwh),
            ("duos_amber_gbp_mwh",        duos_amber_gbp_mwh),
            ("duos_green_gbp_mwh",        duos_green_gbp_mwh),
            ("gduos_red_gbp_mwh",         gduos_red_gbp_mwh),
            ("gduos_amber_gbp_mwh",       gduos_amber_gbp_mwh),
            ("gduos_green_gbp_mwh",       gduos_green_gbp_mwh),
            ("fixed_gbp_per_day",         fixed_gbp_per_day),
            ("capacity_gbp_per_kva_day",  capacity_gbp_per_kva_day),
            ("gduos_fixed_gbp_per_day",   gduos_fixed_gbp_per_day),
        ]:
            if val is not None:
                overrides[key] = val
        self.rate_overrides = overrides if overrides else None
