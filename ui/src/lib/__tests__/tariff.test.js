import { describe, expect, it } from "vitest";
import { DEFAULT_TARIFF_FORM as D, tariffNote, tariffPayload, tariffProblem } from "../tariff";

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
