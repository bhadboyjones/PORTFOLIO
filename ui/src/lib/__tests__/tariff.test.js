import { describe, expect, it } from "vitest";
import { DEFAULT_TARIFF_FORM as D, bandRuns, energyOptions, tariffNote, tariffPayload, tariffProblem } from "../tariff";

describe("tariffPayload", () => {
  it("default is plain pass-through", () => {
    expect(tariffPayload(D)).toEqual({
      energy_type: "indexed", duos_bundled: false, capacity_bundled: false, policy_bundled: false,
      export_type: "indexed", gduos_passed_on: true,
    });
  });
  it("converts p/kWh to £/MWh", () => {
    const p = tariffPayload({ ...D, energyType: "flat", energyFlat: "14.48" });
    expect(p.energy_flat_gbp_mwh).toBeCloseTo(144.8);
  });
  it("sends bands and the rate outside them", () => {
    const p = tariffPayload({ ...D, energyType: "time_bands", otherRate: "13", bands: [{ start: "07:00", end: "19:00", rate: "18" }] });
    expect(p.energy_bands).toEqual([{ start: "07:00", end: "19:00", rate_gbp_mwh: 180 }]);
    expect(p.energy_other_gbp_mwh).toBe(130);
  });
  it("drops a stale input from another type", () => {
    expect(tariffPayload({ ...D, energyFlat: "99" }).energy_flat_gbp_mwh).toBeUndefined();
  });
});

describe("tariffProblem", () => {
  it("passes the default", () => expect(tariffProblem(D)).toBeNull());
  it("asks for a flat rate", () => expect(tariffProblem({ ...D, energyType: "flat" })).toMatch(/flat rate/));
  it("asks for every band rate", () => expect(tariffProblem({ ...D, energyType: "time_bands", otherRate: "1" })).toMatch(/each time band/));
});

describe("tariffNote", () => {
  it("says a flat all-inclusive rate has nothing to trade", () => {
    expect(tariffNote({ ...D, energyType: "flat", duosBundled: true, policyBundled: true })).toMatch(/nothing to trade/);
  });
  it("stays quiet on pass-through", () => expect(tariffNote(D)).toBeNull());
});

describe("bandRuns", () => {
  const t = { otherRate: "13", bands: [{ start: "07:00", end: "12:00", rate: "18" }, { start: "12:00", end: "19:00", rate: "20" }] };
  it("matches the worked example half-hour by half-hour", () => {
    const { slots } = bandRuns(t);
    expect(slots[13]).toBe(13);  // 06:30
    expect(slots[14]).toBe(18);  // 07:00
    expect(slots[23]).toBe(18);  // 11:30
    expect(slots[24]).toBe(20);  // 12:00
    expect(slots[38]).toBe(13);  // 19:00
  });
  it("lists the hours each rate applies, adding to 24", () => {
    const { runs } = bandRuns(t);
    expect(runs.map((r) => [r.start, r.end, r.hours, r.rate])).toEqual([
      ["00:00", "07:00", 7, 13], ["07:00", "12:00", 5, 18], ["12:00", "19:00", 7, 20], ["19:00", "24:00", 5, 13],
    ]);
    expect(runs.reduce((s, r) => s + r.hours, 0)).toBe(24);
  });
  it("handles a band over midnight", () => {
    const { slots } = bandRuns({ otherRate: "20", bands: [{ start: "23:00", end: "07:00", rate: "10" }] });
    expect(slots[0]).toBe(10);
    expect(slots[46]).toBe(10);
    expect(slots[20]).toBe(20);
  });
  it("shows which rates are still missing", () => {
    expect(bandRuns({ otherRate: "", bands: [{ start: "07:00", end: "19:00", rate: "" }] }).runs[0].rate).toBeNull();
  });
  it("gives the earlier band the overlap", () => {
    const { slots } = bandRuns({ otherRate: "1", bands: [{ start: "07:00", end: "12:00", rate: "18" }, { start: "10:00", end: "14:00", rate: "20" }] });
    expect(slots[20]).toBe(18);
    expect(slots[25]).toBe(20);
  });
});

describe("labels", () => {
  it("name the chosen price signal", () => {
    expect(energyOptions("Imbalance")[2].label).toBe("Imbalance plus a margin");
  });
});

describe("band rules", () => {
  it("rejects a band that starts when it ends", () => {
    const bands = [{ start: "07:00", end: "07:00", rate: "1" }];
    expect(tariffProblem({ ...D, energyType: "time_bands", otherRate: "1", bands })).toMatch(/same time/);
  });
});
