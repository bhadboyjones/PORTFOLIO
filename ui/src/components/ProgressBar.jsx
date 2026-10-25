// A plain progress track: 8px, the fill at the true ratio, figure beside it.
export default function ProgressBar({ pct }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Optimisation progress"
        style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--raised)", overflow: "hidden" }}
      >
        <div style={{
          width: `${clamped}%`, height: "100%", borderRadius: 999, background: "var(--data)",
          transition: "width var(--dur-med) var(--ease-flex)",
        }} />
      </div>
      <span className="tnum" style={{ minWidth: 40, textAlign: "right", fontSize: 14 }}>{Math.round(clamped)}%</span>
    </div>
  );
}
