"""
MIC sweep: how far can a site cut its agreed import capacity, and what is it worth?

Candidates are anchored on the site's natural peak, stepped down by shares of
the battery's power. 0% is the natural peak: existing headroom, no battery needed.
A battery can't usefully take more than MAX_CUT_SHARE off the peak in this sweep,
so an oversized battery gets finer steps rather than candidates near zero.
"""

from typing import Any, Dict, List

SWEEP_SHARES = (0.0, 0.25, 0.5, 0.75, 1.0)
MAX_CUT_SHARE = 0.4


def mic_candidates(
    peak_kva: float, power_mw: float, power_factor: float, current_kva: float,
) -> List[Dict[str, float]]:
    """Candidate MICs below the current one, as {"share", "mic_kva"}, highest first."""
    span_kva = min(power_mw * 1000.0 / power_factor, peak_kva * MAX_CUT_SHARE)
    out = []
    for share in SWEEP_SHARES:
        kva = round(peak_kva - share * span_kva)
        if 0 < kva < current_kva:
            out.append({"share": share, "mic_kva": float(kva)})
    return out


def mic_value(
    current: Dict[str, float],
    candidate: Dict[str, float],
    capacity_rate_gbp_per_kva_day: float,
    coverage_days: float,
) -> Dict[str, Any]:
    """
    Value of moving from the current MIC to a candidate, over the data period.

    value = capacity saved + change in dispatch value − change in excess paid

    Both dicts hold mic_kva, dispatch_gbp (battery value before excess) and
    excess_gbp (excess paid with the battery).
    """
    reduction = current["mic_kva"] - candidate["mic_kva"]
    capacity_saved = reduction * capacity_rate_gbp_per_kva_day * coverage_days
    dispatch_change = candidate["dispatch_gbp"] - current["dispatch_gbp"]
    excess_change = candidate["excess_gbp"] - current["excess_gbp"]
    return {
        "mic_kva": candidate["mic_kva"],
        "share": candidate.get("share"),
        "reduction_kva": round(reduction, 1),
        "capacity_saved_gbp": round(capacity_saved, 2),
        "dispatch_change_gbp": round(dispatch_change, 2),
        "excess_gbp": round(candidate["excess_gbp"], 2),
        "excess_change_gbp": round(excess_change, 2),
        "value_gbp": round(capacity_saved + dispatch_change - excess_change, 2),
        "months_breached": candidate.get("months_breached", 0),
    }
