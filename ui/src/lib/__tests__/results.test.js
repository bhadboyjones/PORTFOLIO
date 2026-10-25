import { describe, expect, it } from "vitest";
import {
  billRows, averageDay, bandRuns, aggregateDaily, dailyCumulative,
  coverageDays, finding, labelOf,
} from "../results";
import { MINUS } from "../../format";

// One scenario with hand-checkable settlement figures (GBP over the period).
// net settlement = 300 + 20 − 100 − 5 − 10 = 205
// site cost without = import 1000 + standing 200 − export 50 = 1150
const S = {
  scenario_label: "1MW / 2MWh", export_limit_mw: 0.5, power_mw: 1, capacity_mwh: 2,
  baseline_import_cost_gbp: 1000, dis1_saving_gbp: 300, charge2_cost_gbp: 100,
  baseline_export_rev_gbp: 50, dis2_revenue_gbp: 20, charge1_opp_cost_gbp: 5,
  baseline_thermal_cost_gbp: 0, total_standing_gbp: 200, deg_cost_gbp: 10,
  net_benefit_gbp: 205, site_cost_wo_bess_gbp: 1150, site_cost_w_bess_gbp: 945,
};
const row = (rows, part) => rows.find((r) => r.part === part);

describe("billRows", () => {
  const rows = billRows(S, 1);

  it("splits the bill into components, without and with the battery", () => {
    expect(row(rows, "Imports")).toMatchObject({ without: 1000, with: 800 });  // 1000 − 300 + 100
    expect(row(rows, "Export")).toMatchObject({ without: 50, with: 65 });      // 50 + 20 − 5
    expect(row(rows, "Standing")).toMatchObject({ without: 200, with: 200 });
    expect(row(rows, "Wear")).toMatchObject({ without: 0, with: 10 });
    expect(row(rows, "Net bill")).toMatchObject({ without: 1150, with: 945 });
  });

  it("components add up to the net bill on both sides", () => {
    for (const side of ["without", "with"]) {
      const sum = row(rows, "Imports")[side] + row(rows, "Standing")[side] + row(rows, "Wear")[side] - row(rows, "Export")[side];
      expect(sum).toBeCloseTo(row(rows, "Net bill")[side], 9);
    }
  });

  it("net saving equals the settlement benefit", () => {
    const net = row(rows, "Net bill");
    expect(net.without - net.with).toBeCloseTo(S.net_benefit_gbp, 9);
  });

  it("labels each pair with its % change", () => {
    expect(row(rows, "Imports").changeLabel).toBe(`${MINUS}20%`);
    expect(row(rows, "Export").changeLabel).toBe("+30%");
    expect(row(rows, "Wear").changeLabel).toBe("new");
  });

  it("scales every figure to a year", () => {
    const yearly = billRows(S, 365 / 60);
    expect(row(yearly, "Net bill").without).toBeCloseTo(1150 * 365 / 60, 6);
  });

  it("drops the export row when the site never exports", () => {
    const noExport = billRows({ ...S, baseline_export_rev_gbp: 0, dis2_revenue_gbp: 0, charge1_opp_cost_gbp: 0 }, 1);
    expect(row(noExport, "Export")).toBeUndefined();
  });
});

describe("averageDay", () => {
  const ts = [
    { startTime: "2024-01-01 00:00:00", dis1_mw: 1, dis2_mw: 0, charge1_mw: 0, charge2_mw: 0 },
    { startTime: "2024-01-01 00:30:00", dis1_mw: 0, dis2_mw: 0, charge1_mw: 0, charge2_mw: 0.6 },
    { startTime: "2024-01-02 00:00:00", dis1_mw: 0, dis2_mw: 0, charge1_mw: 0, charge2_mw: 0 },
    { startTime: "2024-01-02 00:30:00", dis1_mw: 0, dis2_mw: 0, charge1_mw: 0.2, charge2_mw: 0 },
  ];
  it("averages each time slot across days", () => {
    const [a, b] = averageDay(ts);
    expect(a).toMatchObject({ time: "00:00", discharge: 0.5, charge: 0, net: 0.5 });
    expect(b.time).toBe("00:30");
    expect(b.charge).toBeCloseTo(0.4, 9);
    expect(b.net).toBeCloseTo(-0.4, 9);
  });
});

describe("bandRuns", () => {
  it("merges neighbouring periods of the same band into minute ranges", () => {
    const bands = [...Array(16).fill("green"), ...Array(16).fill("amber"), ...Array(16).fill("red")];
    expect(bandRuns(bands)).toEqual([
      { band: "green", start: 0, end: 480 },
      { band: "amber", start: 480, end: 960 },
      { band: "red", start: 960, end: 1440 },
    ]);
  });
});

describe("daily series", () => {
  const ts = [
    { startTime: "2024-01-01 17:00:00", dis1_saving_gbp: 10, dis2_revenue_gbp: 2, charge2_cost_gbp: 4, charge1_opp_cost_gbp: 1, deg_cost_gbp: 0.5, cumulative_pnl_gbp: 6.5 },
    { startTime: "2024-01-01 17:30:00", dis1_saving_gbp: 5, dis2_revenue_gbp: 0, charge2_cost_gbp: 0, charge1_opp_cost_gbp: 0, deg_cost_gbp: 0.5, cumulative_pnl_gbp: 11 },
    { startTime: "2024-01-02 17:00:00", dis1_saving_gbp: 3, dis2_revenue_gbp: 0, charge2_cost_gbp: 0, charge1_opp_cost_gbp: 0, deg_cost_gbp: 0, cumulative_pnl_gbp: 14 },
  ];
  it("sums value above zero and cost below, with the net", () => {
    const [d1] = aggregateDaily(ts);
    expect(d1).toMatchObject({ date: "2024-01-01", demand: 15, export: 2, gridCharge: -4, surplus: -1, wear: -1 });
    expect(d1.net).toBeCloseTo(11, 9);
  });
  it("keeps the last cumulative figure of each day", () => {
    expect(dailyCumulative(ts)).toEqual([
      { date: "2024-01-01", cumulative: 11 },
      { date: "2024-01-02", cumulative: 14 },
    ]);
  });
});

describe("coverageDays", () => {
  it("uses the backend's coverage when sent", () => {
    expect(coverageDays({ coverage_days: 60 }, [])).toBe(60);
  });
  it("derives coverage from rows × interval otherwise (archetype runs)", () => {
    const ts = Array.from({ length: 96 }, (_, i) => ({
      startTime: new Date(Date.UTC(2024, 0, 1, 0, 30 * i)).toISOString().replace("T", " ").slice(0, 19),
    }));
    expect(coverageDays(null, [{ dispatch_timeseries: ts }])).toBeCloseTo(2, 9);
  });
  it("returns null with too little data", () => {
    expect(coverageDays(null, [{ dispatch_timeseries: [] }])).toBeNull();
  });
});

describe("finding", () => {
  it("says no size pays when the best NPV is negative", () => {
    expect(finding(S, { npv_gbp: -340270 }, 15)).toBe(
      `No size pays back over 15 years at these assumptions. The closest, 1 MW / 2 MWh, 0.5 MW export, has an NPV of ${MINUS}£340,270.`,
    );
  });
  it("gives payback and NPV when it pays", () => {
    expect(finding(S, { npv_gbp: 120000, payback_yrs: 6.24 }, 15)).toBe(
      "1 MW / 2 MWh, 0.5 MW export pays back in 6.2 years, with an NPV of £120,000.",
    );
  });
  it("names the scenario in a readable form", () => {
    expect(labelOf({ scenario_label: "1MW_2h", export_limit_mw: 0 })).toBe("1 MW / 2 MWh, 0 MW export");
  });
});
