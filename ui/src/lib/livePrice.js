// Live GB wholesale price for the landing page, from Elexon's public API
// (open, with CORS). Decoration with a real number in it: any failure means
// nothing is drawn.

const URL_BASE = "https://data.elexon.co.uk/bmrs/api/v1/balancing/pricing/market-index";
export const LIVE_REFRESH_MS = 30 * 60 * 1000;

/** Oldest first, APX only. Zero-volume periods carry a price of 0, not a real one. */
export function pricePoints(rows) {
  return (rows ?? [])
    .filter((r) => r.dataProvider === "APXMIDP" && r.volume > 0 && Number.isFinite(r.price))
    .map((r) => ({ time: r.startTime, price: r.price }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** SVG points string, scaled to fill width × height. Higher price is higher up. */
export function linePoints(points, width, height, pad = 8) {
  if (points.length < 2) return "";
  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const span = hi - lo || 1;
  return points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = pad + (1 - (p.price - lo) / span) * (height - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const ukDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });

/** Highest, average and cheapest half-hour of the current UK day so far, or null. */
export function todayStats(points, now = new Date()) {
  const today = ukDay.format(now);
  const rows = (points ?? []).filter((p) => ukDay.format(new Date(p.time)) === today);
  if (!rows.length) return null;
  const high = rows.reduce((a, b) => (b.price > a.price ? b : a));
  const low = rows.reduce((a, b) => (b.price < a.price ? b : a));
  const average = rows.reduce((sum, p) => sum + p.price, 0) / rows.length;
  return { high, low, average };
}

export async function fetchLivePrices(now = new Date()) {
  const from = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const url = `${URL_BASE}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(now.toISOString())}&dataProviders=APXMIDP`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Elexon ${res.status}`);
  return pricePoints((await res.json()).data);
}
