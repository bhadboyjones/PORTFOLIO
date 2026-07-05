import useCountUp from "../hooks/useCountUp";

function fmt(value, decimals = 0) {
  if (value == null || isNaN(value)) return "—";
  return value.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function Card({ title, value, format, sub, accent, delay = 0 }) {
  const shown = useCountUp(value);
  return (
    <div
      className="kpi-enter"
      style={{
        animationDelay: `${delay}ms`,
        padding: "1.1rem 1.25rem",
        background: accent ? "rgba(0,200,232,0.07)" : "var(--bg-card)",
        border: accent ? "1px solid rgba(0,200,232,0.3)" : "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: accent ? "0 0 20px var(--signal-a08)" : "none",
      }}
    >
      <div style={{
        fontSize: "0.68rem",
        color: "var(--text-dim)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: "0.6rem",
      }}>
        {title}
      </div>
      <div
        className="tnum"
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          fontFamily: "var(--font-display)",
          color: accent ? "var(--accent)" : "var(--text-pri)",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
        }}
      >
        {format(shown)}
      </div>
      {sub && (
        <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.4rem", fontWeight: 500 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function KpiCards({ topScenario }) {
  if (!topScenario) return null;

  const label = `${topScenario.scenario_label} · ${topScenario.export_limit_mw} MW export`;
  const STAGGER = 50;

  const cards = [
    { title: "Best Net Benefit",    value: topScenario.net_benefit_gbp,      format: (v) => `£${fmt(v)}`,      sub: label, accent: true },
    { title: "Site Cost (no BESS)", value: topScenario.site_cost_wo_bess_gbp, format: (v) => `£${fmt(v)}`,     sub: "top scenario" },
    { title: "Site Cost (w/ BESS)", value: topScenario.site_cost_w_bess_gbp,  format: (v) => `£${fmt(v)}`,     sub: "vs no BESS" },
    { title: "Value / kWh Cycled",  value: topScenario.gbp_per_kwh,           format: (v) => `£${fmt(v, 3)}`,  sub: "net benefit ÷ throughput" },
    { title: "Total Throughput",    value: topScenario.total_throughput_mwh,  format: (v) => `${fmt(v)} MWh`,  sub: "top scenario" },
    { title: "Peak Dispatch",       value: topScenario.peak_dispatch_mw,      format: (v) => `${v == null || isNaN(v) ? "—" : (+v).toLocaleString("en-GB", { maximumFractionDigits: 1 })} MW`, sub: "top scenario" },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
      gap: "0.75rem",
      marginBottom: "1.75rem",
    }}>
      {cards.map((c, i) => (
        <Card key={c.title} {...c} delay={i * STAGGER} />
      ))}
    </div>
  );
}
