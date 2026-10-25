// "Why this result": three or four plain sentences computed from the figures
// on screen. No text generation, so the words always match the numbers.
import { gbp, num, count } from "../format";
import { averageDay, bandRuns } from "./results";
import { DEFAULT_WEEKDAY_BANDS } from "../components/dayTapeBands";

/**
 * Present value of £1/yr of opex, escalating, over the life:
 * A = Σ_{n=1..N} (1+e)^(n−1) / (1+r)^n   (matches api/investment.py build_cashflows)
 */
export function opexAnnuity(discountRate, escalationRate, lifetimeYrs) {
  let a = 0;
  for (let n = 1; n <= lifetimeYrs; n++) {
    a += (1 + escalationRate) ** (n - 1) / (1 + discountRate) ** n;
  }
  return a;
}

/**
 * Breakeven from the investment result. Opex is a share of capex, so every
 * cost scales with capex:
 *   PV costs   = capex × (1 + opexFrac × A)
 *   PV savings = NPV + PV costs
 *   breakeven capex   = PV savings / (1 + opexFrac × A)
 *   savings multiplier = PV costs / PV savings
 */
export function breakeven(inv, a) {
  const k = 1 + (a.opex_pct_of_capex / 100) * opexAnnuity(a.discount_rate_pct / 100, a.escalation_pct_yr / 100, a.lifetime_yrs);
  const pvCosts = inv.capex_gbp * k;
  const pvSavings = inv.npv_gbp + pvCosts;
  return {
    pvSavings,
    pvCosts,
    capex: pvSavings > 0 ? pvSavings / k : 0,
    savingsMultiplier: pvSavings > 0 ? pvCosts / pvSavings : null,
  };
}

/** Share (%) of discharge energy that falls in red-band time slots. */
export function redBandShare(ts, bands) {
  const days = averageDay(ts);
  const runs = bandRuns(bands && bands.length ? bands : DEFAULT_WEEKDAY_BANDS).filter((r) => r.band === "red");
  const total = days.reduce((s, d) => s + d.discharge, 0);
  if (!(total > 0)) return null;
  const inRed = days.filter((d) => runs.some((r) => d.mins >= r.start && d.mins < r.end)).reduce((s, d) => s + d.discharge, 0);
  return (inRed / total) * 100;
}

const months = (start, end) => {
  if (!start || !end) return null;
  const f = new Intl.DateTimeFormat("en-GB", { month: "long" });
  const a = f.format(new Date(start)), b = f.format(new Date(end));
  return a === b ? a : `${a} to ${b}`;
};

/**
 * @returns {{ key: string, text: string }[]}
 */
export function explain({ best, inv, assumptions, nDays, dataPeriod, bands }) {
  if (!best || !inv || !assumptions) return [];
  const out = [];

  // 1. Where the saving comes from
  const red = redBandShare(best.dispatch_timeseries ?? [], bands);
  const gross = (best.dis1_saving_gbp ?? 0) + (best.dis2_revenue_gbp ?? 0);
  const exportShare = gross > 0 ? ((best.dis2_revenue_gbp ?? 0) / gross) * 100 : 0;
  if (red != null) {
    let t = `Most of the value comes from serving the site's own demand at peak: ${num(red, 0)}% of the battery's discharge falls in the red DUoS band, when imports cost most.`;
    if (exportShare >= 20) t = `The value is split between avoided imports and exports: ${num(exportShare, 0)}% of the battery's gross value is export revenue, and ${num(red, 0)}% of its discharge falls in the red DUoS band.`;
    out.push({ key: "source", text: t });
  }

  // 2. Why it does or doesn't pay
  const net1 = inv.annual_benefit_yr1_gbp - inv.annual_opex_yr1_gbp;
  const life = assumptions.lifetime_yrs;
  if (inv.npv_gbp >= 0 && inv.capex_gbp <= 0) {
    out.push({ key: "pays", text: `It pays from day one: there is no capex to repay, so the NPV of ${gbp(inv.npv_gbp)} over ${count(life, "year")} is all saving.` });
  } else if (inv.npv_gbp >= 0) {
    out.push({
      key: "pays",
      text: `It pays: capex of ${gbp(inv.capex_gbp)} is repaid in ${inv.payback_yrs != null ? count(inv.payback_yrs, "year", 1) : "the design life"}, leaving an NPV of ${gbp(inv.npv_gbp)} over ${count(life, "year")}.`,
    });
  } else if (net1 <= 0) {
    out.push({
      key: "pays",
      text: `It cannot pay: the year-1 saving of ${gbp(inv.annual_benefit_yr1_gbp)} does not cover opex of ${gbp(inv.annual_opex_yr1_gbp)}, before any capex is repaid.`,
    });
  } else {
    out.push({
      key: "pays",
      text: `It doesn't pay: capex of ${gbp(inv.capex_gbp)} against ${gbp(net1)}/yr of saving after opex would take about ${count(inv.capex_gbp / net1, "year")} to repay at year-1 rates, longer than the ${life}-year life.`,
    });
  }

  // 3. What would change the answer
  const be = breakeven(inv, assumptions);
  const sharePct = inv.capex_gbp > 0 ? (be.capex / inv.capex_gbp) * 100 : null;
  if (net1 <= 0 && inv.npv_gbp < 0) {
    out.push({ key: "change", text: "No capex level makes it pay: the saving doesn't cover opex. A larger saving, or lower running costs, would have to come first." });
  } else if (inv.npv_gbp < 0 && be.savingsMultiplier != null) {
    out.push({
      key: "change",
      text: `It breaks even if capex falls to about ${gbp(be.capex, { decimals: 0 })} (${sharePct != null && sharePct < 1 ? "under 1%" : `${num(sharePct, 0)}%`} of today's), or if the saving is ${num(be.savingsMultiplier, 1)} times larger.`,
    });
  } else if (inv.npv_gbp >= 0 && inv.capex_gbp <= 0) {
    out.push({ key: "change", text: "With no capex, only a saving below opex would make it fail." });
  } else if (inv.npv_gbp >= 0) {
    out.push({
      key: "change",
      text: `Capex could rise to about ${gbp(be.capex, { decimals: 0 })} before the NPV turns negative.`,
    });
  } else {
    out.push({ key: "change", text: "No capex level makes it pay: the saving after opex is negative." });
  }

  // 4. What the result rests on
  if (nDays != null && nDays < 300) {
    const m = months(dataPeriod?.start, dataPeriod?.end);
    out.push({
      key: "data",
      text: `This rests on ${count(nDays, "day")} of data${m ? ` (${m})` : ""}, scaled to a year, and on a perfect-foresight backtest cut to ${num(assumptions.dispatch_efficiency_pct, 0)}%. A full year of data would show the seasons.`,
    });
  } else {
    out.push({
      key: "data",
      text: `This rests on a perfect-foresight backtest cut to ${num(assumptions.dispatch_efficiency_pct, 0)}% for forecast error, and on the placeholder capex in the assumptions panel.`,
    });
  }
  return out;
}
