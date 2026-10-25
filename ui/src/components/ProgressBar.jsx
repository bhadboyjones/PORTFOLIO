import ChargingSld from "./ChargingSld";

// Progress shown as a grid charging a battery; the figure sits under it.
export default function ProgressBar({ pct }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Optimisation progress"
    >
      <ChargingSld pct={clamped} />
      <div className="tnum" style={{ textAlign: "right", fontSize: 14, marginTop: 4 }}>
        {Math.round(clamped)}%
      </div>
    </div>
  );
}
