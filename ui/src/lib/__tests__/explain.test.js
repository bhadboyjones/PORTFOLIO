import { describe, expect, it } from "vitest";
import { opexAnnuity, breakeven, redBandShare, explain } from "../explain";
import { MINUS } from "../../format";

const A0 = { opex_pct_of_capex: 0, discount_rate_pct: 0, escalation_pct_yr: 0, lifetime_yrs: 10, dispatch_efficiency_pct: 85 };

describe("opexAnnuity", () => {
  it("is the life in years with no discounting or escalation", () => {
    expect(opexAnnuity(0, 0, 10)).toBe(10);
  });
  it("discounts year n by (1+r)^n", () => {
    expect(opexAnnuity(0.1, 0, 2)).toBeCloseTo(1 / 1.1 + 1 / 1.21, 12);
  });
  it("escalates from year 2", () => {
    expect(opexAnnuity(0, 0.1, 2)).toBeCloseTo(1 + 1.1, 12);
  });
});

describe("breakeven", () => {
  // £100 capex, £5/yr for 10 years, no opex, no discounting:
  // PV savings 50, NPV −50 → breaks even at £50 capex or 2× the saving.
  it("solves the capex and saving that make NPV zero", () => {
    const be = breakeven({ capex_gbp: 100, npv_gbp: -50 }, A0);
    expect(be.pvSavings).toBeCloseTo(50, 9);
    expect(be.capex).toBeCloseTo(50, 9);
    expect(be.savingsMultiplier).toBeCloseTo(2, 9);
  });
  // Opex 1% of capex for 10 years: PV costs 110, NPV = 50 − 110 = −60.
  it("scales opex with capex", () => {
    const be = breakeven({ capex_gbp: 100, npv_gbp: -60 }, { ...A0, opex_pct_of_capex: 1 });
    expect(be.pvSavings).toBeCloseTo(50, 9);
    expect(be.capex).toBeCloseTo(50 / 1.1, 9);
    expect(be.savingsMultiplier).toBeCloseTo(110 / 50, 9);
  });
});

// 2 days of half-hours: discharge 1 MW at 17:00 (red) and 1 MW at 12:00 (amber).
const ts = [];
for (let d = 1; d <= 2; d++) {
  for (let i = 0; i < 48; i++) {
    const h = String(Math.floor(i / 2)).padStart(2, "0"), m = i % 2 ? "30" : "00";
    ts.push({ startTime: `2024-01-0${d} ${h}:${m}:00`, dis1_mw: (i === 34 || i === 24) ? 1 : 0, dis2_mw: 0, charge1_mw: 0, charge2_mw: 0 });
  }
}
const bands = Array.from({ length: 48 }, (_, i) => (i >= 32 && i < 38 ? "red" : i >= 14 ? "amber" : "green"));

describe("redBandShare", () => {
  it("is the share of discharge energy in red-band slots", () => {
    expect(redBandShare(ts, bands)).toBeCloseTo(50, 9);
  });
  it("is null when the battery never discharges", () => {
    expect(redBandShare(ts.map((r) => ({ ...r, dis1_mw: 0 })), bands)).toBeNull();
  });
});

describe("explain", () => {
  const best = { dispatch_timeseries: ts, dis1_saving_gbp: 900, dis2_revenue_gbp: 100 };
  const a = { opex_pct_of_capex: 1.5, discount_rate_pct: 8, escalation_pct_yr: 2, lifetime_yrs: 15, dispatch_efficiency_pct: 85 };

  it("explains a scenario that doesn't pay, with its breakeven", () => {
    const inv = { capex_gbp: 400000, npv_gbp: -340270, annual_benefit_yr1_gbp: 14130, annual_opex_yr1_gbp: 6000, payback_yrs: null };
    const lines = explain({ best, inv, assumptions: a, nDays: 60, dataPeriod: { start: "2024-01-01", end: "2024-02-29" }, bands });
    expect(lines.map((l) => l.key)).toEqual(["source", "pays", "change", "data"]);
    expect(lines[0].text).toContain("50% of the battery's discharge falls in the red DUoS band");
    expect(lines[1].text).toBe("It doesn't pay: capex of £400,000 against £8,130/yr of saving after opex would take about 49 years to repay at year-1 rates, longer than the 15-year life.");
    expect(lines[2].text).toMatch(/^It breaks even if capex falls to about £[\d,]+ \(\d+% of today's\), or if the saving is [\d.]+ times larger\.$/);
    expect(lines[3].text).toContain("60 days of data (January to February)");
  });

  it("says when the saving can't even cover opex", () => {
    const inv = { capex_gbp: 400000, npv_gbp: -500000, annual_benefit_yr1_gbp: 5000, annual_opex_yr1_gbp: 6000 };
    const [, pays] = explain({ best, inv, assumptions: a, nDays: 365, bands });
    expect(pays.text).toContain("does not cover opex of £6,000");
  });

  it("gives headroom when it pays", () => {
    const inv = { capex_gbp: 100000, npv_gbp: 50000, annual_benefit_yr1_gbp: 30000, annual_opex_yr1_gbp: 1500, payback_yrs: 3.6 };
    const lines = explain({ best, inv, assumptions: a, nDays: 365, bands });
    expect(lines[1].text).toBe("It pays: capex of £100,000 is repaid in 3.6 years, leaving an NPV of £50,000 over 15 years.");
    expect(lines[2].text).toMatch(/^Capex could rise to about £[\d,]+ before the NPV turns negative\.$/);
    expect(lines.join(" ")).not.toContain(MINUS);
  });

  it("mentions exports when they are a fifth of the value or more", () => {
    const inv = { capex_gbp: 100000, npv_gbp: -1, annual_benefit_yr1_gbp: 9000, annual_opex_yr1_gbp: 1500 };
    const [source] = explain({ best: { ...best, dis1_saving_gbp: 600, dis2_revenue_gbp: 400 }, inv, assumptions: a, nDays: 365, bands });
    expect(source.text).toContain("40% of the battery's gross value is export revenue");
  });
});
