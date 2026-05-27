import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from fastapi import APIRouter, HTTPException

from src.duos_rates import get_duos_rates, VALID_DNOS, VALID_VOLTAGE_LEVELS

router = APIRouter()


def _flatten_rag(rag_schedule: dict) -> dict:
    """
    Flatten the nested RAG schedule dict into the eight HH:MM string fields
    the frontend expects. Handles DNOs with zero, one, or two amber windows
    and optional weekend windows.
    """
    red_wd   = rag_schedule.get("red",   {}).get("weekday", [])
    amber_wd = rag_schedule.get("amber", {}).get("weekday", [])
    amber_we = rag_schedule.get("amber", {}).get("weekend", [])

    return {
        "rag_red_start":           red_wd[0][0]   if red_wd              else "",
        "rag_red_end":             red_wd[0][1]   if red_wd              else "",
        "rag_amber_morning_start": amber_wd[0][0] if len(amber_wd) > 0  else "",
        "rag_amber_morning_end":   amber_wd[0][1] if len(amber_wd) > 0  else "",
        "rag_amber_evening_start": amber_wd[1][0] if len(amber_wd) > 1  else "",
        "rag_amber_evening_end":   amber_wd[1][1] if len(amber_wd) > 1  else "",
        "rag_weekend_amber_start": amber_we[0][0] if amber_we           else "",
        "rag_weekend_amber_end":   amber_we[0][1] if amber_we           else "",
    }


@router.get("/duos-rates/{dno}/{voltage}")
def get_duos_rate_defaults(dno: str, voltage: str):
    """
    Return raw LC14 rates (p/kWh, p/day) plus flattened RAG band windows
    for a given DNO and voltage level.

    The frontend applies conversions on load:
      p/kWh × 10  → £/MWh
      p/day ÷ 100 → £/day

    RAG band windows are returned as plain HH:MM strings — no conversion.
    """
    dno_upper     = dno.upper()
    voltage_upper = voltage.upper()

    if dno_upper not in VALID_DNOS:
        raise HTTPException(
            status_code=404,
            detail=f"DNO '{dno}' not found. Valid options: {VALID_DNOS}",
        )
    if voltage_upper not in VALID_VOLTAGE_LEVELS:
        raise HTTPException(
            status_code=404,
            detail=f"Voltage '{voltage}' not found. Valid options: {VALID_VOLTAGE_LEVELS}",
        )

    try:
        rates = get_duos_rates(dno_upper, voltage_upper)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    rag_schedule = rates["rag_schedule"]
    rag_warning  = rag_schedule.get("_warning")

    result = {
        "duos_red_p_kwh":             rates["duos_red_p_kwh"],
        "duos_amber_p_kwh":           rates["duos_amber_p_kwh"],
        "duos_green_p_kwh":           rates["duos_green_p_kwh"],
        "gduos_red_p_kwh":            rates["gduos_red_p_kwh"],
        "gduos_amber_p_kwh":          rates["gduos_amber_p_kwh"],
        "gduos_green_p_kwh":          rates["gduos_green_p_kwh"],
        "fixed_p_per_day":            rates["fixed_p_per_day"],
        "capacity_p_per_kva_day":     rates["capacity_p_per_kva_day"],
        "gduos_fixed_p_per_day":      rates["gduos_fixed_p_per_day"],
        **_flatten_rag(rag_schedule),
    }

    if rag_warning:
        result["rag_warning"] = rag_warning

    return result
