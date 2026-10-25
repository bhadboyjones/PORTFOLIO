import { describe, expect, it } from "vitest";
import { parseCsvMeta, peakKw } from "../csvMeta";

const file = (name, text) => ({ name, text: async () => text });

describe("parseCsvMeta", () => {
  // 00:00, 00:30, then 01:30: one half-hour (01:00) is missing.
  const csv = "timestamp,net_demand_mw\n2024-01-01 00:00,0.5\n2024-01-01 00:30,1.2\n2024-01-01 01:30,-0.3\n";

  it("reads rows, period, resolution and columns", async () => {
    const m = await parseCsvMeta(file("site.csv", csv));
    expect(m.rows).toBe(3);
    expect(m.headers).toEqual(["timestamp", "net_demand_mw"]);
    expect(m.dateRange).toEqual({ start: "2024-01-01", end: "2024-01-01" });
    expect(m.resolution).toMatchObject({ valid: true });
    expect(m.intervalMin).toBe(30);
  });

  it("counts missing intervals and covered days", async () => {
    const m = await parseCsvMeta(file("site.csv", csv));
    expect(m.gaps).toBe(1);                      // expected 4 slots, 3 present
    expect(m.coverageDays).toBeCloseTo(3 * 30 / 1440, 9);
  });

  it("finds the peak import in the file's own unit", async () => {
    const m = await parseCsvMeta(file("site.csv", csv));
    expect(m.peakRaw).toBe(1.2);
  });

  it("flags unsupported intervals", async () => {
    const m = await parseCsvMeta(file("site.csv", "timestamp,net_demand_mw\n2024-01-01 00:00,1\n2024-01-01 00:15,1\n2024-01-01 00:30,1\n"));
    expect(m.resolution.valid).toBe(false);
  });

  it("leaves XLSX to the server", async () => {
    const m = await parseCsvMeta(file("site.xlsx", ""));
    expect(m.rows).toBeNull();
  });
});

describe("peakKw", () => {
  const meta = { peakRaw: 1.2, intervalMin: 30 };
  it("converts the peak to kW for each upload unit", () => {
    expect(peakKw(meta, "mw")).toBe(1200);
    expect(peakKw(meta, "kw")).toBe(1.2);
    expect(peakKw(meta, "mwh")).toBeCloseTo(2400, 9); // 1.2 MWh per half-hour = 2.4 MW
    expect(peakKw(meta, "kwh")).toBeCloseTo(2.4, 9);
  });
  it("returns null without a peak or interval", () => {
    expect(peakKw({ peakRaw: null, intervalMin: 30 }, "mw")).toBeNull();
    expect(peakKw({ peakRaw: 1, intervalMin: null }, "mw")).toBeNull();
  });
});

import { dataIssues, toKwFactor } from "../csvMeta";
describe("dataIssues", () => {
  const base = { intervalMin: 30, peakRaw: 1.1, absMaxRaw: 1.1, p99AbsRaw: 1.0, absMaxTs: "2024-01-03 10:00" };
  it("passes a normal site", () => {
    expect(dataIssues(base, "mw", false)).toEqual([]);
  });
  it("flags kW read as MW and MW read as kW", () => {
    expect(dataIssues({ ...base, peakRaw: 1100, absMaxRaw: 1100, p99AbsRaw: 1000 }, "mw", false)[0].code).toBe("data_check");
    expect(dataIssues(base, "kw", false)[0].text).toContain("1 kW in the selected unit");
  });
  it("flags a single spike before the range rule", () => {
    const [issue] = dataIssues({ ...base, absMaxRaw: 99.999, peakRaw: 99.999, p99AbsRaw: 0.8 }, "mw", false);
    expect(issue.text).toContain("99,999 kW at 2024-01-03 10:00");
    expect(issue.text).toContain("800 kW");
  });
  it("asks for a MIC when the site never imports", () => {
    const issues = dataIssues({ ...base, peakRaw: -0.2, absMaxRaw: 0.8, p99AbsRaw: 0.7 }, "mw", false);
    expect(issues.map((i) => i.code)).toEqual(["mic_required"]);
    expect(dataIssues({ ...base, peakRaw: -0.2, absMaxRaw: 0.8, p99AbsRaw: 0.7 }, "mw", true)).toEqual([]);
  });
  it("converts energy units with the interval", () => {
    expect(toKwFactor("kwh", 30)).toBe(2);
    expect(toKwFactor("mwh", 60)).toBe(1000);
  });
});
