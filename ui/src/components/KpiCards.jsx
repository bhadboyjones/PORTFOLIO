function fmt(value, decimals = 0) {
  if (value == null || isNaN(value)) return "—";
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function Card({ title, value, sub, accent }) {
  return (
    <div style={{
      padding: "1.1rem 1.25rem",
      background: accent ? "rgba(0,200,232,0.07)" : "#152236",
      border: accent ? "1px solid rgba(0,200,232,0.3)" : "1px solid #1e3352",
      borderRadius: 10,
      boxShadow: accent ? "0 0 20px rgba(0,200,232,0.08)" : "none",
    }}>
      <div style={{
        fontSize: "0.68rem",
        color: "#4a6b8c",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: "0.6rem",
      }}>
        {title}
      </div>
      <div style={{
        fontSize: "1.5rem",
        fontWeight: 800,
        color: accent ? "#00c8e8" : "#e0eaf8",
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.72rem", color: "#4a6b8c", marginTop: "0.4rem", fontWeight: 500 }}>
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
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
      gap: "0.75rem",
      marginBottom: "1.75rem",
    }}>
      <Card title="Best Net Benefit"    value={`£${fmt(topScenario.net_benefit_gbp)}`}       sub={label}                        accent />
      <Card title="Site Cost (no BESS)" value={`£${fmt(topScenario.site_cost_wo_bess_gbp)}`} sub="top scenario" />
      <Card title="Site Cost (w/ BESS)" value={`£${fmt(topScenario.site_cost_w_bess_gbp)}`}  sub="vs no BESS" />
      <Card title="Net Benefit"         value={`£${fmt(topScenario.net_benefit_gbp)}`}       sub="BESS dispatch contribution" />
      <Card title="Total Throughput"    value={`${fmt(topScenario.total_throughput_mwh)} MWh`} sub="top scenario" />
      <Card title="Peak Dispatch"       value={`${topScenario.peak_dispatch_mw} MW`}          sub="top scenario" />
    </div>
  );
}
