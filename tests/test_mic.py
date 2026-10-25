"""MIC resolution for CSV runs: import cap (kW) and billing kVA per unit."""

import pandas as pd
import pytest
from fastapi import HTTPException

from api.routes.run_csv import _resolve_mic

DEMAND = pd.Series([0.5, 1.08, -0.2])   # MW; peak import 1,080 kW


def test_kva_mic_cap_is_kva_times_pf():
    cap_kw, kva, source, warning = _resolve_mic(DEMAND, 1200.0, "kva", 0.9)
    assert abs(cap_kw - 1080.0) < 1e-9
    assert kva == 1200.0
    assert (source, warning) == ("user", None)


def test_kw_mic_used_as_cap_without_pf():
    # A kW MIC is already real power: the cap is the number written, PF unused.
    cap_kw, kva, _, _ = _resolve_mic(DEMAND, 1080.0, "kw", 0.9)
    assert cap_kw == 1080.0
    assert abs(kva - 1200.0) < 1e-9   # billing kVA only (unverified rule)


def test_mw_mic_converts_to_kw():
    cap_kw, kva, _, _ = _resolve_mic(DEMAND, 1.5, "mw", 1.0)
    assert cap_kw == 1500.0
    assert kva == 1500.0


def test_blank_mic_falls_back_to_peak():
    cap_kw, kva, source, warning = _resolve_mic(DEMAND, None, "kva", 0.9)
    assert abs(cap_kw - 1080.0) < 1e-9
    assert abs(kva - 1200.0) < 1e-9
    assert source == "assumed_peak"
    assert "1,080 kW" in warning


def _params(**kw):
    """Build CsvRunParams with plain values (FastAPI Form defaults bypassed)."""
    from api.schemas import CsvRunParams
    base = dict(
        dno_key="NPG", voltage_level="HV",
        bess_configs_json='[{"power_mw": 1, "capacity_mwh": 2}]', export_limits_json="[0]",
        bess_rte_pct=90.0, bess_max_cycles=1.5, bess_charge_eff_pct=None,
        bess_discharge_eff_pct=None, bess_soc_min_pct=5.0, bess_soc_max_pct=95.0,
        bess_deg_cost_gbp_mwh=8.0, contracted_kva=None, mic_unit="kva", power_factor=1.0,
        chp_toggle=False, input_unit="mw", price_exposure="da", chp_mc_gbp_mwh=70.0,
        nec_gbp_mwh=103.75, rag_red_start="16:00", rag_red_end="19:00",
        rag_amber_morning_start="07:00", rag_amber_morning_end="16:00",
        rag_amber_evening_start="19:00", rag_amber_evening_end="23:00",
        rag_weekend_amber_start="", rag_weekend_amber_end="",
        duos_red_gbp_mwh=None, duos_amber_gbp_mwh=None, duos_green_gbp_mwh=None,
        gduos_red_gbp_mwh=None, gduos_amber_gbp_mwh=None, gduos_green_gbp_mwh=None,
        fixed_gbp_per_day=None, capacity_gbp_per_kva_day=None, gduos_fixed_gbp_per_day=None,
    )
    base.update(kw)
    return CsvRunParams(**base)


def test_schema_keeps_mic_as_written():
    p = _params(contracted_kva=1080.0, mic_unit="kw", power_factor=0.9)
    assert (p.contracted_kva, p.mic_unit, p.power_factor) == (1080.0, "kw", 0.9)


@pytest.mark.parametrize("bad", [dict(mic_unit="amps"), dict(power_factor=1.2),
                                 dict(power_factor=0.3), dict(contracted_kva=-5.0)])
def test_schema_rejects_bad_inputs(bad):
    with pytest.raises(HTTPException):
        _params(**{"contracted_kva": 1000.0, **bad})


def test_only_user_warnings_reach_the_user():
    # A job's warning capture also records other jobs' library warnings;
    # only flexiq's own UserWarnings, deduplicated, may reach the results.
    import warnings as w
    from api.routes.run_csv import _user_warnings

    with w.catch_warnings(record=True) as caught:
        w.simplefilter("always")
        w.warn("Constructing LpVariable(name, ...) directly is deprecated", DeprecationWarning)
        w.warn("12 NaN values in DA price filled with 0.0.", UserWarning)
        w.warn("12 NaN values in DA price filled with 0.0.", UserWarning)
        w.warn("something else", FutureWarning)
    assert _user_warnings(caught) == ["12 NaN values in DA price filled with 0.0."]
    assert _user_warnings(caught, already=["12 NaN values in DA price filled with 0.0."]) == []
