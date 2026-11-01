import { useEffect, useState } from "react";
import { fetchLivePrices, linePoints, LIVE_REFRESH_MS, todayStats } from "../lib/livePrice";
import { gbp } from "../format";

const W = 1440, H = 400;
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

// The last 24 hours of the GB market price, drawn across the bottom of the landing page, behind the cards.
// The line is decorative (aria-hidden); the caption carries the figure.
export function usePrices() {
  const [points, setPoints] = useState(null);
  useEffect(() => {
    let live = true;
    const load = () => fetchLivePrices().then((p) => { if (live) setPoints(p); }).catch(() => {});
    load();
    const id = setInterval(load, LIVE_REFRESH_MS);
    return () => { live = false; clearInterval(id); };
  }, []);
  return points;
}

export function LivePriceBackground({ points }) {
  const line = points ? linePoints(points, W, H) : "";
  if (!line) return null;
  return (
    <svg aria-hidden="true" className="live-bg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polygon points={`0,${H} ${line} ${W},${H}`} className="live-bg-area" />
      <polyline points={line} pathLength="1" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function LivePriceCaption({ points }) {
  const day = todayStats(points);
  if (!day) return null;
  const at = (p) => clock.format(new Date(p.time));
  return (
    <p className="tnum" style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)" }}>
      GB market price today, £/MWh: highest {gbp(day.high.price)} at {at(day.high)}, average {gbp(day.average)}, cheapest {gbp(day.low.price)} at {at(day.low)}. Source: Elexon. Chart shows the last 24 hours.
    </p>
  );
}
