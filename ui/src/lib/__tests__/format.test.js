import { describe, expect, it } from "vitest";
import { gbp, num, pct, gbpCompact, date, DASH, MINUS } from "../../format";

describe("gbp", () => {
  it("puts a true minus before the currency on negatives", () => {
    expect(gbp(-340270)).toBe(`${MINUS}£340,270`);
    expect(gbp(-340270)).not.toContain("£-");
  });
  it("adds thousands separators and fixed decimals", () => {
    expect(gbp(1234567)).toBe("£1,234,567");
    expect(gbp(12.5, { decimals: 2 })).toBe("£12.50");
  });
  it("shows + only when asked", () => {
    expect(gbp(1200, { sign: true })).toBe("+£1,200");
    expect(gbp(1200)).toBe("£1,200");
  });
  it("never prints a minus on a value that rounds to zero", () => {
    expect(gbp(-0.4)).toBe("£0");
  });
  it("prints an en dash for missing values", () => {
    for (const v of [null, undefined, NaN, Infinity, "12"]) expect(gbp(v)).toBe(DASH);
  });
});

describe("num and pct", () => {
  it("formats with a true minus", () => {
    expect(num(-14.53, 1)).toBe(`${MINUS}14.5`);
    expect(num(2.5, 1, { sign: true })).toBe("+2.5");
  });
  it("formats percentages from percent values", () => {
    expect(pct(12.34)).toBe("12.3%");
    expect(pct(null)).toBe(DASH);
  });
});

describe("gbpCompact", () => {
  it("abbreviates thousands and millions for axis ticks", () => {
    expect(gbpCompact(340000)).toBe("£340k");
    expect(gbpCompact(-1234567)).toBe(`${MINUS}£1.2m`);
    expect(gbpCompact(950)).toBe("£950");
  });
});

describe("date", () => {
  it("formats ISO dates in en-GB", () => {
    expect(date("2024-01-01")).toBe("1 Jan 2024");
    expect(date("not a date")).toBe(DASH);
  });
});

import { count } from "../../format";
describe("count", () => {
  it("agrees the noun with the number as shown", () => {
    expect(count(1, "day")).toBe("1 day");
    expect(count(60, "day")).toBe("60 days");
    expect(count(1.04, "year", 1)).toBe("1.0 years");
    expect(count(0.6, "year")).toBe("1 year");
  });
});
