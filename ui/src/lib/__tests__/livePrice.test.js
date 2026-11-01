import { describe, expect, it } from "vitest";
import { linePoints, pricePoints } from "../livePrice";

const row = (startTime, price, volume = 100) => ({ startTime, price, volume, dataProvider: "APXMIDP" });

describe("pricePoints", () => {
  it("sorts oldest first and drops zero-volume periods", () => {
    const p = pricePoints([row("2026-11-01T01:00:00Z", 50), row("2026-11-01T00:30:00Z", 0, 0), row("2026-11-01T00:00:00Z", 40)]);
    expect(p.map((x) => x.price)).toEqual([40, 50]);
  });
  it("handles nothing", () => expect(pricePoints(undefined)).toEqual([]));
});

describe("linePoints", () => {
  it("puts the highest price at the top and spans the width", () => {
    expect(linePoints([{ price: 10 }, { price: 20 }], 100, 50, 0)).toBe("0.0,50.0 100.0,0.0");
  });
  it("draws nothing for one point", () => expect(linePoints([{ price: 10 }], 100, 50)).toBe(""));
  it("survives a flat price", () => expect(linePoints([{ price: 5 }, { price: 5 }], 100, 50)).not.toContain("NaN"));
});
