"""
Investment appraisal for BESS scenarios — pure maths, no I/O.

The dispatch optimiser answers "what does the battery earn per year?";
this module answers "is that worth paying for?". Full derivation, input
rationale and caveats: docs/investment_case.md.

Cashflow model per scenario:

    Year 0:      -capex
    Year n >= 1: benefit_1 * (1 - fade)^(n-1) * (1 + esc)^(n-1)
                 - opex_1 * (1 + esc)^(n-1)

Conventions:
- All rates are decimal fractions (0.08 = 8%). The API layer converts
  from the percentage fields the UI exposes.
- cashflows[0] is year 0 (capex outflow, negative); cashflows[n] is the
  net cashflow of year n, treated as arriving at the end of year n.
- Cashflows are nominal, so the discount rate must be nominal too.
"""

DAYS_PER_YEAR = 365


def annualise_benefit(period_benefit_gbp: float, n_days: float) -> float:
    """Scale a benefit observed over n_days of data to a calendar year.

    Linear scaling assumes the data period is seasonally representative —
    the caller is responsible for warning when it is short (< ~10 months).
    """
    if n_days <= 0:
        raise ValueError(f"n_days must be positive, got {n_days}")
    return period_benefit_gbp * DAYS_PER_YEAR / n_days


def total_capex_gbp(
    power_mw: float,
    capacity_mwh: float,
    capex_gbp_per_kw: float,
    capex_gbp_per_kwh: float,
    capex_fixed_gbp: float,
) -> float:
    """Two-part capex: power-related (PCS/connection) + energy-related (cells)
    + fixed (site works). The split is what lets the scenario matrix price
    different power:energy ratios sensibly."""
    return (
        power_mw * 1000.0 * capex_gbp_per_kw
        + capacity_mwh * 1000.0 * capex_gbp_per_kwh
        + capex_fixed_gbp
    )


def build_cashflows(
    annual_benefit_gbp: float,
    capex_gbp: float,
    annual_opex_gbp: float,
    lifetime_yrs: int,
    fade_rate: float,
    escalation_rate: float,
) -> list:
    """Year-0..N nominal cashflows.

    Benefit erodes with capacity fade and grows with price escalation;
    opex only escalates (a smaller battery does not get cheaper to insure).
    """
    if lifetime_yrs < 1:
        raise ValueError(f"lifetime_yrs must be >= 1, got {lifetime_yrs}")
    cashflows = [-capex_gbp]
    for n in range(1, lifetime_yrs + 1):
        growth = (1.0 + escalation_rate) ** (n - 1)
        benefit = annual_benefit_gbp * (1.0 - fade_rate) ** (n - 1) * growth
        opex = annual_opex_gbp * growth
        cashflows.append(benefit - opex)
    return cashflows


def npv(rate: float, cashflows: list) -> float:
    """Net present value: sum of cashflows[n] / (1+rate)^n."""
    if rate <= -1.0:
        raise ValueError(f"rate must be > -100%, got {rate}")
    return sum(cf / (1.0 + rate) ** n for n, cf in enumerate(cashflows))


def irr(cashflows: list, lo: float = -0.99, hi: float = 10.0, tol: float = 1e-7) -> float:
    """Internal rate of return by bisection; None if no root in (lo, hi).

    Our profiles have one sign change (outflow, then net inflows), so when a
    root exists it is unique and NPV(rate) is decreasing through it — bisection
    is safe. Returns None when the project never breaks even at any rate
    (annual net cashflow <= 0), where IRR is meaningless.
    """
    f_lo, f_hi = npv(lo, cashflows), npv(hi, cashflows)
    if f_lo * f_hi > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2.0
        f_mid = npv(mid, cashflows)
        if abs(f_mid) < tol or (hi - lo) / 2.0 < tol:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2.0


def payback_years(cashflows: list, rate: float = 0.0) -> float:
    """Years until cumulative (optionally discounted) cashflow reaches zero.

    rate=0 gives simple payback; rate=discount_rate gives discounted payback.
    Interpolates within the crossing year (cashflow assumed to accrue evenly
    through the year). None if never repaid within the profile.
    """
    if cashflows[0] >= 0:
        return 0.0
    cumulative = cashflows[0]
    for n in range(1, len(cashflows)):
        inflow = cashflows[n] / (1.0 + rate) ** n
        if inflow > 0 and cumulative + inflow >= 0:
            return (n - 1) + (-cumulative) / inflow
        cumulative += inflow
    return None


def evaluate_scenario(
    *,
    power_mw: float,
    capacity_mwh: float,
    period_benefit_gbp: float,
    n_days: float,
    capex_gbp_per_kw: float,
    capex_gbp_per_kwh: float,
    capex_fixed_gbp: float,
    opex_frac_of_capex: float,
    lifetime_yrs: int,
    discount_rate: float,
    fade_rate: float,
    escalation_rate: float,
    dispatch_efficiency: float = 1.0,
    period_wear_cost_gbp: float = 0.0,
) -> dict:
    """Full appraisal of one optimiser scenario. Returns unrounded values;
    the API layer handles presentation rounding.

    dispatch_efficiency is the foresight haircut (see docs/investment_case.md
    §4.3). The optimiser dispatches with perfect price foresight, so its benefit
    is a ceiling no real operator reaches. dispatch_efficiency (0..1) scales that
    ceiling to a realistic central estimate; 1.0 reproduces the raw backtest.
    Every headline metric below is the realistic (haircut) case. The 100%-
    foresight ceiling is returned alongside so the UI can show a range without a
    second evaluation.

    period_wear_cost_gbp is the optimiser's degradation wear accrual over the
    period, which net_settlement_gbp has already subtracted. It is a non-cash
    charge for consuming the battery, whose full cost is already capex in year
    0, so it is added back here to avoid charging for the asset twice. The
    optimiser keeps the wear cost in its objective as a dispatch signal; only
    the investment cashflow drops it. See docs/investment_case.md §6.
    """
    if not 0.0 <= dispatch_efficiency <= 1.0:
        raise ValueError(f"dispatch_efficiency must be in [0, 1], got {dispatch_efficiency}")

    capex = total_capex_gbp(
        power_mw, capacity_mwh, capex_gbp_per_kw, capex_gbp_per_kwh, capex_fixed_gbp
    )
    annual_opex = capex * opex_frac_of_capex

    # Ceiling = raw perfect-foresight backtest; realistic = ceiling × efficiency.
    ceiling_benefit = annualise_benefit(period_benefit_gbp + period_wear_cost_gbp, n_days)
    annual_benefit = ceiling_benefit * dispatch_efficiency

    cashflows = build_cashflows(
        annual_benefit, capex, annual_opex, lifetime_yrs, fade_rate, escalation_rate
    )
    cashflows_ceiling = build_cashflows(
        ceiling_benefit, capex, annual_opex, lifetime_yrs, fade_rate, escalation_rate
    )

    npv_gbp = npv(discount_rate, cashflows)
    npv_ceiling_gbp = npv(discount_rate, cashflows_ceiling)

    # Cumulative discounted position at the end of each year — the breakeven
    # curve the UI charts. cumulative[0] = -capex.
    cumulative_discounted = []
    running = 0.0
    for n, cf in enumerate(cashflows):
        running += cf / (1.0 + discount_rate) ** n
        cumulative_discounted.append(running)

    return {
        "capex_gbp": capex,
        "annual_benefit_yr1_gbp": annual_benefit,
        "annual_benefit_ceiling_yr1_gbp": ceiling_benefit,
        "annual_opex_yr1_gbp": annual_opex,
        "dispatch_efficiency": dispatch_efficiency,
        "npv_gbp": npv_gbp,
        "npv_ceiling_gbp": npv_ceiling_gbp,
        "irr": irr(cashflows),
        "payback_yrs": payback_years(cashflows),
        "discounted_payback_yrs": payback_years(cashflows, rate=discount_rate),
        # PV of operating benefits per £ of capex; > 1 <=> NPV > 0.
        "benefit_cost_ratio": (npv_gbp + capex) / capex if capex > 0 else None,
        "cashflows": cashflows,
        "cumulative_discounted": cumulative_discounted,
    }
