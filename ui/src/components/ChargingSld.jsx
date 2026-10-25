import useReducedMotion from "../hooks/useReducedMotion";

// Charging single-line diagram: grid busbar → transformer → battery.
// The battery's fill IS the optimisation progress. Power flows along the
// line as moving dashes while the run is going; at 100% the flow stops and
// the battery reads full. Dash-flow style lives in index.css ("Charging SLD").
// Ledger palette: ink and grey for the network, the one data blue for the
// energy stored.

const BATT = { x: 356, y: 20, w: 124, h: 44 };
const INNER = { x: BATT.x + 4, y: BATT.y + 4, w: BATT.w - 8, h: BATT.h - 8 };
const INK = "#141414";
const GREY = "#8a8a8a";
const DATA = "#1d5fbf";

export default function ChargingSld({ pct }) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  const full = clamped >= 100;
  const flowing = !full && !reduced;

  const label = { fontFamily: "var(--font-body)", fontSize: 12, fill: "#5f6368" };

  return (
    <svg
      viewBox="0 0 520 100"
      width="100%"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* grid busbar */}
      <line x1="24" y1="18" x2="24" y2="66" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <text x="24" y="90" textAnchor="middle" style={label}>Grid</text>

      {/* connection, interrupted by the transformer */}
      <line className={flowing ? "sld-flow" : undefined} x1="24" y1="42" x2="137" y2="42"
        stroke={flowing ? DATA : GREY} strokeWidth="2" />
      {/* transformer: two overlapping windings */}
      <circle cx="150" cy="42" r="12" fill="none" stroke={INK} strokeWidth="1.5" />
      <circle cx="166" cy="42" r="12" fill="none" stroke={INK} strokeWidth="1.5" />
      <text x="158" y="90" textAnchor="middle" style={label}>Transformer</text>
      <line className={flowing ? "sld-flow" : undefined} x1="179" y1="42" x2={BATT.x} y2="42"
        stroke={flowing ? DATA : GREY} strokeWidth="2" />

      {/* battery */}
      <rect x={BATT.x} y={BATT.y} width={BATT.w} height={BATT.h} rx="6"
        fill="#ffffff" stroke={INK} strokeWidth="1.5" />
      <rect x={BATT.x + BATT.w} y={BATT.y + 13} width="5" height="18" rx="1.5" fill={INK} />
      {/* fill: scaleX driven by pct */}
      <rect
        x={INNER.x} y={INNER.y} width={INNER.w} height={INNER.h} rx="3"
        fill={DATA}
        style={{
          transform: `scaleX(${clamped / 100})`,
          transformOrigin: "0 50%",
          transformBox: "fill-box",
          transition: "transform var(--dur-med) var(--ease-flex)",
        }}
      />
      {/* cell dividers */}
      {[1, 2, 3].map((k) => (
        <line key={k}
          x1={INNER.x + (INNER.w / 4) * k} y1={INNER.y}
          x2={INNER.x + (INNER.w / 4) * k} y2={INNER.y + INNER.h}
          stroke="#ffffff" strokeWidth="2" />
      ))}
      <text x={BATT.x + BATT.w / 2} y="90" textAnchor="middle" style={label}>
        {full ? "Battery full" : "Battery"}
      </text>
    </svg>
  );
}
