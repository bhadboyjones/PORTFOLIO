function fmt(value, decimals = 0) {
  if (value == null || isNaN(value)) return "—";
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function Card({ title, value, sub, highlight }) {
  return (
    <div
      style={{
        padding: "1.1rem 1.25rem",
        background: highlight ? "#eff6ff" : "#fff",
        border: highlight ? "1px solid #bfdbfe" : "1px solid #e5e7eb",
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: "0.78rem", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.5rem" }}>
        {title}
      </div>
      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: highlight ? "#1d4ed8" : "#111827", lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: "0.35rem" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function KpiCards({ topScenario }) {
  if (!topScenario) return null;

  const label = `${topScenario.scenario_label} · ${topScenario.export_limit_mw} MW export`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.75rem",
      }}
    >
      <Card
        title="Best Net Benefit"
        value={`£${fmt(topScenario.net_benefit_gbp)}`}
        sub={label}
        highlight
      />
      <Card
        title="Site Cost (no BESS)"
        value={`£${fmt(topScenario.site_cost_wo_bess_gbp)}`}
        sub="top scenario"
      />
      <Card
        title="Site Cost (with BESS)"
        value={`£${fmt(topScenario.site_cost_w_bess_gbp)}`}
        sub="top scenario"
      />
      <Card
        title="Net Benefit"
        value={`£${fmt(topScenario.net_benefit_gbp)}`}
        sub="BESS dispatch contribution"
      />
      <Card
        title="Total Throughput"
        value={`${fmt(topScenario.total_throughput_mwh)} MWh`}
        sub="top scenario"
      />
      <Card
        title="Peak Dispatch"
        value={`${topScenario.peak_dispatch_mw} MW`}
        sub="top scenario"
      />
    </div>
  );
}
