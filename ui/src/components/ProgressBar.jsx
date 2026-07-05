import ChargingSld from "./ChargingSld";
import useCountUp from "../hooks/useCountUp";

export default function ProgressBar({ pct }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const shown = useCountUp(clamped);
  return (
    <div
      style={{ width: "100%" }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Optimisation progress"
    >
      <ChargingSld pct={clamped} />
      <div
        className="tnum"
        style={{ textAlign: "right", fontSize: "0.8rem", color: "var(--text-sec)", marginTop: "0.4rem", fontWeight: 600 }}
      >
        {Math.round(shown)}%
      </div>
    </div>
  );
}
