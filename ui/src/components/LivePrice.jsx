import { useEffect, useState } from "react";
import { fetchLivePrices, linePoints, LIVE_REFRESH_MS } from "../lib/livePrice";
import { gbp } from "../format";

const W = 392, H = 104;
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

// The last 24 hours of the GB market price, drawn behind the landing title.
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

export function LivePriceLine({ points }) {
  const line = points ? linePoints(points, W, H) : "";
  if (!line) return null;
  return (
    <svg aria-hidden="true" className="live-line" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={line} pathLength="1" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function LivePriceCaption({ points }) {
  const last = points?.at(-1);
  if (!last) return null;
  return (
    <p className="tnum" style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)" }}>
      GB market price {gbp(last.price)}/MWh at {clock.format(new Date(last.time))}. Elexon market index, last 24 hours shown.
    </p>
  );
}
