import useReducedMotion from "../hooks/useReducedMotion";

// Charging single-line diagram: grid busbar → transformer → BESS.
// The battery fill level IS the optimisation progress. Dash-flow and
// completion-pulse styles live in index.css under "Charging SLD".

const BATT = { x: 356, y: 20, w: 124, h: 44 };
const INNER = { x: BATT.x + 4, y: BATT.y + 4, w: BATT.w - 8, h: BATT.h - 8 };

export default function ChargingSld({ pct }) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  const full = clamped >= 100;
  const flowing = !full && !reduced;

  const label = {
    fontFamily: "var(--font-body)",
    fontSize: 9,
    letterSpacing: "0.12em",
    fill: "var(--text-dim)",
  };

  return (
    <svg
      viewBox="0 0 520 96"
      width="100%"
      aria-hidden="true"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* grid busbar */}
      <line x1="24" y1="18" x2="24" y2="66" stroke="var(--text-dim)" strokeWidth="3" strokeLinecap="round" />
      <text x="24" y="86" textAnchor="middle" style={label}>GRID</text>

      {/* connection line, interrupted by the transformer */}
      <line
        className={flowing ? "sld-flow" : undefined}
        x1="24" y1="42" x2="137" y2="42"
        stroke="var(--signal)" strokeWidth="2"
      />
      {/* transformer — two overlapping circles */}
      <circle cx="150" cy="42" r="12" fill="none" stroke="var(--text-dim)" strokeWidth="2" />
      <circle cx="166" cy="42" r="12" fill="none" stroke="var(--text-dim)" strokeWidth="2" />
      <line
        className={flowing ? "sld-flow" : undefined}
        x1="179" y1="42" x2={BATT.x} y2="42"
        stroke="var(--signal)" strokeWidth="2"
      />

      {/* battery */}
      <g className={full ? "sld-complete" : undefined}>
        <rect
          x={BATT.x} y={BATT.y} width={BATT.w} height={BATT.h} rx="6"
          fill="var(--bg-surface)" stroke={full ? "var(--signal)" : "var(--border-bright)"} strokeWidth="2"
        />
        {/* terminal nub */}
        <rect x={BATT.x + BATT.w} y={BATT.y + 12} width="6" height="20" rx="2" fill="var(--border-bright)" />
        {/* fill — scaleX driven by pct, eased by CSS */}
        <rect
          x={INNER.x} y={INNER.y} width={INNER.w} height={INNER.h} rx="3"
          fill="var(--signal)"
          opacity="0.85"
          style={{
            transform: `scaleX(${clamped / 100})`,
            transformOrigin: "0 50%",
            transformBox: "fill-box",
            transition: "transform var(--dur-slow) var(--ease-flex)",
          }}
        />
        {/* cell dividers */}
        {[1, 2, 3].map((k) => (
          <line
            key={k}
            x1={INNER.x + (INNER.w / 4) * k} y1={INNER.y}
            x2={INNER.x + (INNER.w / 4) * k} y2={INNER.y + INNER.h}
            stroke="var(--bg-surface)" strokeWidth="2"
          />
        ))}
      </g>
      <text x={BATT.x + BATT.w / 2} y="86" textAnchor="middle" style={label}>BESS</text>
    </svg>
  );
}
