export default function ProgressBar({ pct }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          height: 6,
          background: "#1e3352",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          className="progress-fill"
          style={{
            height: "100%",
            width: `${clamped}%`,
            borderRadius: 999,
          }}
        />
      </div>
      <div style={{ textAlign: "right", fontSize: "0.8rem", color: "#7ba0c8", marginTop: "0.4rem", fontWeight: 600 }}>
        {clamped}%
      </div>
    </div>
  );
}
