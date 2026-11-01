import { describe, expect, it } from "vitest";
import { linePoints, pricePoints, todayStats } from "../livePrice";

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

describe("todayStats", () => {
  const now = new Date("2026-11-01T20:30:00Z");
  const pts = [
    { time: "2026-10-31T23:30:00Z", price: 999 },  // yesterday, so ignored
    { time: "2026-11-01T04:00:00Z", price: 40 },
    { time: "2026-11-01T17:30:00Z", price: 200 },
    { time: "2026-11-01T20:00:00Z", price: 90 },
  ];
  it("finds the day's high, average and cheapest half-hour", () => {
    const d = todayStats(pts, now);
    expect(d.high.price).toBe(200);
    expect(d.low.time).toBe("2026-11-01T04:00:00Z");
    expect(d.average).toBeCloseTo(110);   // (40 + 200 + 90) ÷ 3
  });
  it("uses the UK day, not UTC", () => {
    // 23:30 UTC on 30 June is 00:30 on 1 July in BST.
    const d = todayStats([{ time: "2026-06-30T23:30:00Z", price: 50 }], new Date("2026-07-01T10:00:00Z"));
    expect(d.average).toBe(50);
  });
  it("is null with nothing for today", () => expect(todayStats([pts[0]], now)).toBeNull());
});
