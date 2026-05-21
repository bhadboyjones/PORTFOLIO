export default function ProgressBar({ pct }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          height: 20,
          background: "#e5e7eb",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${clamped}%`,
            background: "#2563eb",
            borderRadius: 10,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <div style={{ textAlign: "right", fontSize: "0.875rem", color: "#374151", marginTop: "0.35rem" }}>
        {clamped}%
      </div>
    </div>
  );
}
