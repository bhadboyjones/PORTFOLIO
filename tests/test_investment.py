"""Hand-checkable tests for api/investment.py.

Every expected value below can be verified with a calculator — the worked
example mirrors docs/investment_case.md so code, doc and tests agree.
"""

import pytest

from api.investment import (
    annualise_benefit,
    build_cashflows,
    evaluate_scenario,
    irr,
    npv,
    payback_years,
    total_capex_gbp,
)


# ---------------------------------------------------------------------------
# NPV
# ---------------------------------------------------------------------------

def test_npv_hand_calc():
    # -100 + 60/1.1 + 60/1.21 = -100 + 54.5455 + 49.5868 = 4.1322
    assert npv(0.10, [-100, 60, 60]) == pytest.approx(4.1322, abs=1e-4)


def test_npv_zero_rate_is_plain_sum():
    assert npv(0.0, [-100, 30, 30, 30]) == pytest.approx(-10.0)


def test_npv_rejects_rate_at_or_below_minus_100pct():
    with pytest.raises(ValueError):
        npv(-1.0, [-100, 60])


# ---------------------------------------------------------------------------
# IRR
# ---------------------------------------------------------------------------

def test_irr_one_year_exact():
    # -100 now, 110 in a year: the return is exactly 10%.
    assert irr([-100, 110]) == pytest.approx(0.10, abs=1e-6)


def test_irr_two_year_quadratic():
    # -100 + 60x + 60x^2 = 0 with x = 1/(1+r)
    # => x = (-60 + sqrt(3600 + 24000)) / 120 = 0.884438 => r = 13.066%
    assert irr([-100, 60, 60]) == pytest.approx(0.13066, abs=1e-4)


def test_irr_none_when_never_profitable():
    # Opex exceeds benefit every year — no rate makes NPV zero.
    assert irr([-100, -5, -5, -5]) is None


def test_irr_negative_but_defined():
    # Recovers only 80 of 100 undiscounted — IRR exists but is negative.
    r = irr([-100, 40, 40])
    assert r is not None and -0.5 < r < 0.0
    assert npv(r, [-100, 40, 40]) == pytest.approx(0.0, abs=1e-4)


# ---------------------------------------------------------------------------
# Payback
# ---------------------------------------------------------------------------

def test_simple_payback_interpolated():
    # Cumulative: -100, -60, -20, +20 -> crosses during year 3 at 2.5y
    assert payback_years([-100, 40, 40, 40]) == pytest.approx(2.5)


def test_payback_none_when_beyond_profile():
    assert payback_years([-100, 10, 10]) is None


def test_discounted_payback_is_later_than_simple():
    cf = [-100, 40, 40, 40, 40]
    assert payback_years(cf, rate=0.10) > payback_years(cf)


# ---------------------------------------------------------------------------
# Cashflow construction
# ---------------------------------------------------------------------------

def test_fade_erodes_benefit_geometrically():
    # B=100, fade 10%, no escalation, no opex: years are 100, 90, 81.
    cf = build_cashflows(100.0, 500.0, 0.0, 3, fade_rate=0.10, escalation_rate=0.0)
    assert cf == pytest.approx([-500.0, 100.0, 90.0, 81.0])


def test_escalation_grows_benefit_and_opex():
    # B=100, opex=10, esc 5%: year 2 = (100 - 10) * 1.05 = 94.5
    cf = build_cashflows(100.0, 500.0, 10.0, 2, fade_rate=0.0, escalation_rate=0.05)
    assert cf[1] == pytest.approx(90.0)
    assert cf[2] == pytest.approx(94.5)


def test_annualise_scales_linearly():
    # £100 over 73 days -> 100 * 365/73 = £500/yr
    assert annualise_benefit(100.0, 73) == pytest.approx(500.0)


def test_capex_two_part_plus_fixed():
    # 1MW * £150/kW + 2MWh * £250/kWh + £50k = 150k + 500k + 50k
    assert total_capex_gbp(1.0, 2.0, 150.0, 250.0, 50_000.0) == pytest.approx(700_000.0)


# ---------------------------------------------------------------------------
# Worked example — mirrors docs/investment_case.md
# ---------------------------------------------------------------------------

def test_worked_example_duos_arbitrage_alone_is_npv_negative():
    result = evaluate_scenario(
        power_mw=1.0,
        capacity_mwh=2.0,
        period_benefit_gbp=40_000.0,
        n_days=365,
        capex_gbp_per_kw=150.0,
        capex_gbp_per_kwh=250.0,
        capex_fixed_gbp=0.0,
        opex_frac_of_capex=0.015,
        lifetime_yrs=15,
        discount_rate=0.08,
        fade_rate=0.0,
        escalation_rate=0.0,
    )
    assert result["capex_gbp"] == pytest.approx(650_000.0)
    assert result["annual_benefit_yr1_gbp"] == pytest.approx(40_000.0)
    assert result["annual_opex_yr1_gbp"] == pytest.approx(9_750.0)

    # NPV = 30,250 * annuity(8%, 15y) - 650,000; annuity factor = 8.559479
    annuity = (1 - 1.08 ** -15) / 0.08
    assert result["npv_gbp"] == pytest.approx(30_250 * annuity - 650_000, rel=1e-9)
    assert result["npv_gbp"] < 0  # the honest Phase-1 headline

    # Simple payback 650,000 / 30,250 = 21.5y — beyond 15y life.
    assert result["payback_yrs"] is None
    assert result["irr"] is not None and result["irr"] < 0
    assert result["benefit_cost_ratio"] == pytest.approx((30_250 * annuity) / 650_000, rel=1e-9)

    # Breakeven curve: starts at -capex, ends at NPV, monotone rising here.
    curve = result["cumulative_discounted"]
    assert curve[0] == pytest.approx(-650_000.0)
    assert curve[-1] == pytest.approx(result["npv_gbp"], rel=1e-9)
    assert all(b > a for a, b in zip(curve, curve[1:]))


def test_evaluate_rejects_bad_period():
    with pytest.raises(ValueError):
        annualise_benefit(100.0, 0)


# ---------------------------------------------------------------------------
# Dispatch-efficiency haircut
# ---------------------------------------------------------------------------

def _base_kwargs(**overrides):
    kw = dict(
        power_mw=1.0, capacity_mwh=2.0, period_benefit_gbp=40_000.0, n_days=365,
        capex_gbp_per_kw=150.0, capex_gbp_per_kwh=250.0, capex_fixed_gbp=0.0,
        opex_frac_of_capex=0.015, lifetime_yrs=15, discount_rate=0.08,
        fade_rate=0.0, escalation_rate=0.0,
    )
    kw.update(overrides)
    return kw


def test_efficiency_1_reproduces_ceiling():
    # At 100% foresight the realistic case and the ceiling are identical.
    r = evaluate_scenario(**_base_kwargs(dispatch_efficiency=1.0))
    assert r["annual_benefit_yr1_gbp"] == pytest.approx(r["annual_benefit_ceiling_yr1_gbp"])
    assert r["npv_gbp"] == pytest.approx(r["npv_ceiling_gbp"])


def test_haircut_scales_only_the_benefit_not_capex_or_opex():
    full = evaluate_scenario(**_base_kwargs(dispatch_efficiency=1.0))
    cut = evaluate_scenario(**_base_kwargs(dispatch_efficiency=0.85))
    # Benefit is haircut; capex and opex are untouched.
    assert cut["annual_benefit_yr1_gbp"] == pytest.approx(0.85 * full["annual_benefit_yr1_gbp"])
    assert cut["annual_opex_yr1_gbp"] == pytest.approx(full["annual_opex_yr1_gbp"])
    assert cut["capex_gbp"] == pytest.approx(full["capex_gbp"])
    # Ceiling is preserved regardless of the haircut.
    assert cut["npv_ceiling_gbp"] == pytest.approx(full["npv_gbp"])
    # Realistic NPV is worse (less benefit, same costs).
    assert cut["npv_gbp"] < cut["npv_ceiling_gbp"]


def test_default_efficiency_is_full_foresight():
    # Omitting the arg must not silently apply a haircut.
    r = evaluate_scenario(**_base_kwargs())
    assert r["dispatch_efficiency"] == 1.0
    assert r["npv_gbp"] == pytest.approx(r["npv_ceiling_gbp"])


def test_efficiency_out_of_range_rejected():
    for bad in (-0.1, 1.5):
        with pytest.raises(ValueError):
            evaluate_scenario(**_base_kwargs(dispatch_efficiency=bad))


# ---------------------------------------------------------------------------
# Wear accrual add-back — capex already pays for the battery
# ---------------------------------------------------------------------------

def test_wear_cost_added_back_to_benefit():
    # Optimiser benefit is £40k net of a £5k wear accrual; the cashflow should
    # see £45k, because charging wear on top of capex double-counts the asset.
    r = evaluate_scenario(**_base_kwargs(period_wear_cost_gbp=5_000.0))
    assert r["annual_benefit_ceiling_yr1_gbp"] == pytest.approx(45_000.0)
    assert r["annual_benefit_yr1_gbp"] == pytest.approx(45_000.0)


def test_wear_add_back_then_haircut_order():
    # Haircut applies to the add-back-corrected benefit: (40k + 5k) × 0.85.
    r = evaluate_scenario(**_base_kwargs(period_wear_cost_gbp=5_000.0, dispatch_efficiency=0.85))
    assert r["annual_benefit_yr1_gbp"] == pytest.approx(45_000.0 * 0.85)


def test_fractional_coverage_days():
    # 59.5 days of coverage annualises by 365/59.5, not truncated to an int.
    assert annualise_benefit(1000.0, 59.5) == pytest.approx(1000.0 * 365 / 59.5)
