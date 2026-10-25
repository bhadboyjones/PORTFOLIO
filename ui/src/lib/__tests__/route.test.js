import { describe, expect, it } from "vitest";
import { parseHash, formatHash } from "../route";
import { pickPrune } from "../resultsCache";

describe("parseHash", () => {
  it("maps every screen", () => {
    expect(parseHash("")).toEqual({ view: "landing" });
    expect(parseHash("#/")).toEqual({ view: "landing" });
    expect(parseHash("#/upload")).toEqual({ view: "config", mode: "csv" });
    expect(parseHash("#/archetype/")).toEqual({ view: "config", mode: "archetype" });
    expect(parseHash("#/run/20261025_165746_8202")).toEqual({ view: "progress", jobId: "20261025_165746_8202" });
    expect(parseHash("#/results/20261025_165746_8202")).toEqual({ view: "results", jobId: "20261025_165746_8202" });
  });
  it("sends unknown or unsafe paths to the landing page", () => {
    expect(parseHash("#/nope")).toEqual({ view: "landing" });
    expect(parseHash("#/results/../../etc")).toEqual({ view: "landing" });
    expect(parseHash("#/results/<script>")).toEqual({ view: "landing" });
  });
});

describe("formatHash", () => {
  it("round-trips with parseHash", () => {
    for (const h of ["#/", "#/upload", "#/archetype", "#/run/abc_123", "#/results/abc_123"]) {
      expect(formatHash(parseHash(h))).toBe(h);
    }
  });
});

describe("pickPrune", () => {
  it("keeps the newest entries and drops the rest", () => {
    const entries = [1, 5, 3, 2, 4, 6].map((t) => ({ jobId: `j${t}`, savedAt: t }));
    expect(pickPrune(entries, 3).sort()).toEqual(["j1", "j2", "j3"]);
  });
  it("drops nothing under the limit", () => {
    expect(pickPrune([{ jobId: "a", savedAt: 1 }], 5)).toEqual([]);
  });
});

import { uniqueWarnings } from "../../components/WarningsNotice";
describe("uniqueWarnings", () => {
  it("keeps one copy of each message and drops blanks", () => {
    const flood = Array(1153).fill("Constructing LpVariable is deprecated");
    expect(uniqueWarnings([...flood, "MIC assumed", "", null])).toEqual(["Constructing LpVariable is deprecated", "MIC assumed"]);
  });
});
