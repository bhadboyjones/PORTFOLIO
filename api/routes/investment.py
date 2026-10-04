"""
POST /investment/evaluate — stateless investment appraisal.

Deliberately stateless: the caller sends scenario benefits (from a completed
run's results payload) plus assumptions, and gets metrics back. That lets the
results page re-evaluate live as the user moves assumption sliders, without
touching job state or re-running the optimiser. Maths: api/investment.py;
teaching reference: docs/investment_case.md.
"""

from fastapi import APIRouter

from api.investment import evaluate_scenario
from api.schemas import InvestmentEvaluateRequest

router = APIRouter()

# Below ~10 months the annualisation cannot see a full seasonal cycle
# (winter demand shape, red-band exposure, price spreads).
_SEASONAL_WARNING_DAYS = 300


def _round_or_none(value, decimals):
    return round(value, decimals) if value is not None else None


@router.post("/investment/evaluate")
def evaluate_investment(req: InvestmentEvaluateRequest):
    a = req.assumptions

    warnings = []
    if req.n_days < _SEASONAL_WARNING_DAYS:
        warnings.append(
            f"Annual figures are scaled up from {req.n_days:.0f} days of data — a period "
            "this short may not be seasonally representative. Treat them as indicative."
        )

    scenarios_out = []
    for s in req.scenarios:
        m = evaluate_scenario(
            power_mw=s.power_mw,
            capacity_mwh=s.capacity_mwh,
            period_benefit_gbp=s.period_benefit_gbp,
            n_days=req.n_days,
            capex_gbp_per_kw=a.capex_gbp_per_kw,
            capex_gbp_per_kwh=a.capex_gbp_per_kwh,
            capex_fixed_gbp=a.capex_fixed_gbp,
            opex_frac_of_capex=a.opex_pct_of_capex / 100.0,
            lifetime_yrs=a.lifetime_yrs,
            discount_rate=a.discount_rate_pct / 100.0,
            fade_rate=a.fade_pct_yr / 100.0,
            escalation_rate=a.escalation_pct_yr / 100.0,
            dispatch_efficiency=a.dispatch_efficiency_pct / 100.0,
            period_wear_cost_gbp=s.period_wear_cost_gbp,
        )
        scenarios_out.append({
            "scenario_label":          s.scenario_label,
            "export_limit_mw":         s.export_limit_mw,
            "capex_gbp":               round(m["capex_gbp"], 2),
            "annual_benefit_yr1_gbp":  round(m["annual_benefit_yr1_gbp"], 2),
            "annual_benefit_ceiling_yr1_gbp": round(m["annual_benefit_ceiling_yr1_gbp"], 2),
            "annual_opex_yr1_gbp":     round(m["annual_opex_yr1_gbp"], 2),
            "npv_gbp":                 round(m["npv_gbp"], 2),
            "npv_ceiling_gbp":         round(m["npv_ceiling_gbp"], 2),
            "irr_pct":                 _round_or_none(
                m["irr"] * 100.0 if m["irr"] is not None else None, 2
            ),
            "payback_yrs":             _round_or_none(m["payback_yrs"], 2),
            "discounted_payback_yrs":  _round_or_none(m["discounted_payback_yrs"], 2),
            "benefit_cost_ratio":      _round_or_none(m["benefit_cost_ratio"], 3),
            "cashflows":               [round(v, 2) for v in m["cashflows"]],
            "cumulative_discounted":   [round(v, 2) for v in m["cumulative_discounted"]],
        })

    return {"scenarios": scenarios_out, "warnings": warnings}
