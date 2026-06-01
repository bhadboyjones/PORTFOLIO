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

    Multi-scenario BESS fields:
      bess_configs_json    — JSON array of {power_mw, capacity_mwh} objects (≥1 entry)
      export_limits_json   — JSON array of export limit values in MW (≥1 entry)
      bess_rte_pct         — Round-trip efficiency (%, default 90)
      bess_max_cycles      — Max charge+discharge cycles/day (default 1.5)
      Total scenarios (configs × export limits) must be ≤ 12.

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
        # --- BESS matrix (multi-scenario) ---
        bess_configs_json: str = Form(..., description="JSON array of {power_mw, capacity_mwh} objects"),
        export_limits_json: str = Form(..., description="JSON array of export limit values (MW, must be > 0)"),
        bess_rte_pct: float = Form(90.0, description="Round-trip efficiency (%) — fallback if charge/discharge eff not provided"),
        bess_max_cycles: float = Form(1.5, description="Max charge+discharge cycles per day"),
        bess_charge_eff_pct: Optional[float] = Form(None, description="One-way charge efficiency (%). Defaults to sqrt(RTE)."),
        bess_discharge_eff_pct: Optional[float] = Form(None, description="One-way discharge efficiency (%). Defaults to sqrt(RTE)."),
        bess_soc_min_pct: float = Form(5.0, description="Minimum SOC (% of capacity). Default 5%."),
        bess_soc_max_pct: float = Form(95.0, description="Maximum SOC (% of capacity). Default 95%."),
        bess_deg_cost_gbp_mwh: float = Form(8.0, description="Degradation cost (£/MWh throughput)."),
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
        # --- Validate BESS configs ---
        try:
            raw_configs = _json.loads(bess_configs_json)
        except Exception:
            raise HTTPException(status_code=422, detail="bess_configs_json must be valid JSON.")
        if not isinstance(raw_configs, list) or len(raw_configs) == 0:
            raise HTTPException(status_code=422, detail="bess_configs_json must be a non-empty JSON array.")
        for cfg in raw_configs:
            pw = float(cfg.get("power_mw", 0))
            cap = float(cfg.get("capacity_mwh", 0))
            if pw <= 0:
                raise HTTPException(status_code=422, detail=f"bess_configs: power_mw must be > 0, got {pw}.")
            if cap <= 0:
                raise HTTPException(status_code=422, detail=f"bess_configs: capacity_mwh must be > 0, got {cap}.")
            dur = cap / pw
            if not (0.5 <= dur <= 6.0):
                raise HTTPException(
                    status_code=422,
                    detail=f"BESS duration {dur:.2f}h for {pw:g}MW/{cap:g}MWh is outside the 0.5–6.0h range.",
                )
        # --- Validate export limits ---
        try:
            raw_limits = _json.loads(export_limits_json)
        except Exception:
            raise HTTPException(status_code=422, detail="export_limits_json must be valid JSON.")
        if not isinstance(raw_limits, list) or len(raw_limits) == 0:
            raise HTTPException(status_code=422, detail="export_limits_json must be a non-empty JSON array.")
        parsed_limits: list[float] = []
        for v in raw_limits:
            fv = float(v)
            if fv <= 0:
                raise HTTPException(status_code=422, detail=f"All export limits must be > 0, got {fv}.")
            parsed_limits.append(fv)
        total_scenarios = len(raw_configs) * len(parsed_limits)
        if total_scenarios > 12:
            raise HTTPException(
                status_code=422,
                detail=f"Too many scenarios ({total_scenarios}). Maximum is 12.",
            )

        self.dno_key        = dno_key
        self.voltage_level  = voltage_level

        self.bess_configs = [
            {"power_mw": float(c["power_mw"]), "capacity_mwh": float(c["capacity_mwh"])}
            for c in raw_configs
        ]
        self.export_limits = parsed_limits

        self.bess_rte_pct           = bess_rte_pct
        self.bess_max_cycles        = bess_max_cycles
        self.bess_charge_eff_pct    = bess_charge_eff_pct
        self.bess_discharge_eff_pct = bess_discharge_eff_pct
        self.bess_soc_min_pct       = bess_soc_min_pct
        self.bess_soc_max_pct       = bess_soc_max_pct
        self.bess_deg_cost_gbp_mwh  = bess_deg_cost_gbp_mwh

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
