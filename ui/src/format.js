// One place for every figure on screen (Intl-based, en-GB).
// Negatives use a true minus sign before the currency: −£340,270.

const MINUS = "−";
const DASH = "–"; // en dash: a missing value

const cache = new Map();
function nf(min, max) {
  const key = `${min}-${max}`;
  if (!cache.has(key)) {
    cache.set(key, new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    }));
  }
  return cache.get(key);
}

const missing = (v) => v == null || typeof v !== "number" || !Number.isFinite(v);

/** £12,345 · −£340,270 · +£1,200 (sign: true adds + on positives). */
export function gbp(v, { decimals = 0, sign = false } = {}) {
  if (missing(v)) return DASH;
  const body = `£${nf(decimals, decimals).format(Math.abs(v))}`;
  if (v < 0 && Math.abs(v) >= 0.5 * 10 ** -decimals) return `${MINUS}${body}`;
  if (sign && v > 0) return `+${body}`;
  return body;
}

/** Plain number with fixed decimals; true minus on negatives. */
export function num(v, decimals = 0, { sign = false } = {}) {
  if (missing(v)) return DASH;
  const body = nf(decimals, decimals).format(Math.abs(v));
  if (v < 0 && Math.abs(v) >= 0.5 * 10 ** -decimals) return `${MINUS}${body}`;
  if (sign && v > 0) return `+${body}`;
  return body;
}

/** Percentage from a percent value (12.3 → "12.3%"). */
export function pct(v, decimals = 1, opts) {
  if (missing(v)) return DASH;
  return `${num(v, decimals, opts)}%`;
}

/** Compact £ for axis ticks: £340k, −£1.2m. */
export function gbpCompact(v) {
  if (missing(v)) return DASH;
  const a = Math.abs(v);
  const s = v < 0 ? MINUS : "";
  if (a >= 1e6) return `${s}£${nf(0, 1).format(a / 1e6)}m`;
  if (a >= 1e3) return `${s}£${nf(0, 0).format(a / 1e3)}k`;
  return `${s}£${nf(0, 0).format(a)}`;
}

/** 1 Jan 2024 */
export function date(isoOrDate) {
  if (!isoOrDate) return DASH;
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return DASH;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export { DASH, MINUS };
