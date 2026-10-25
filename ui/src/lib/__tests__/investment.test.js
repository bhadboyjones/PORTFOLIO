import { describe, expect, it } from "vitest";
import { scenarioDims, sizeLabel, scenarioKey } from "../../hooks/useInvestment";

describe("scenarioDims", () => {
  it("prefers explicit power and capacity", () => {
    expect(scenarioDims({ power_mw: 1, capacity_mwh: 2, scenario_label: "x" })).toEqual({ power_mw: 1, capacity_mwh: 2 });
  });
  it("reads CSV labels", () => {
    expect(scenarioDims({ scenario_label: "2MW / 4MWh" })).toEqual({ power_mw: 2, capacity_mwh: 4 });
  });
  it("reads archetype labels as power × duration", () => {
    expect(scenarioDims({ scenario_label: "1MW_2h" })).toEqual({ power_mw: 1, capacity_mwh: 2 });
    expect(scenarioDims({ scenario_label: "0.5MW_4h" })).toEqual({ power_mw: 0.5, capacity_mwh: 2 });
  });
  it("returns null for labels it cannot read", () => {
    expect(scenarioDims({ scenario_label: "big battery" })).toBeNull();
  });
});

describe("sizeLabel and scenarioKey", () => {
  it("prints one format whatever the source label", () => {
    expect(sizeLabel({ scenario_label: "1MW_2h" })).toBe("1 MW / 2 MWh");
    expect(sizeLabel({ scenario_label: "2MW / 4MWh" })).toBe("2 MW / 4 MWh");
  });
  it("keys a scenario by label and export limit", () => {
    expect(scenarioKey({ scenario_label: "1MW / 2MWh", export_limit_mw: 0.5 })).toBe("1MW / 2MWh|0.5");
  });
});

import { validateAssumptions, defaultInvestmentForm } from "../../hooks/useInvestment";
describe("validateAssumptions", () => {
  it("accepts the defaults", () => {
    expect(validateAssumptions(defaultInvestmentForm())).toEqual({});
  });
  it("rejects what the server would reject", () => {
    const errs = validateAssumptions({ ...defaultInvestmentForm(), capex_gbp_per_kwh: "", capex_gbp_per_kw: "-250", lifetime_yrs: "2.5", discount_rate_pct: "31" });
    expect(errs).toEqual({
      capex_gbp_per_kwh: "Enter a number",
      capex_gbp_per_kw: "Between 0 and 1,000,000",
      lifetime_yrs: "Whole years only",
      discount_rate_pct: "Between 0 and 30",
    });
  });
});
