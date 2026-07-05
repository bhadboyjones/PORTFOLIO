export default function ArchetypeCard({ archetype, selected, onToggle }) {
  return (
    <div
      className="lift lift-glow"
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
      }}
      style={{
        border: selected ? "1px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: 10,
        padding: "1.25rem",
        cursor: "pointer",
        background: selected ? "rgba(0,200,232,0.07)" : "var(--bg-card)",
        flex: 1,
        minWidth: 200,
        boxShadow: selected ? "0 0 0 1px var(--accent), 0 0 20px rgba(0,200,232,0.12)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.9rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: selected ? "var(--accent)" : "var(--text-pri)" }}>
          {archetype.display_name}
        </h3>
        {selected && (
          <span style={{
            fontSize: "0.65rem", fontWeight: 700, color: "var(--bg-base)",
            background: "var(--accent)", borderRadius: 3, padding: "0.15rem 0.45rem",
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            Selected
          </span>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <tbody>
          <Row label="Peak demand" value={`${archetype.peak_mw} MW`} />
          <Row label="Base load"   value={`${archetype.base_mw} MW`} />
          <Row label="Off-peak"    value={`${archetype.offpeak_mw} MW`} />
          <Row label="PV"          value={archetype.has_pv  ? `${archetype.pv_kwp} kWp` : "None"} />
          <Row label="CHP"         value={archetype.has_chp ? `${archetype.chp_kw} kW`  : "None"} />
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <tr>
      <td style={{ color: "var(--text-dim)", paddingRight: "0.6rem", paddingBottom: "0.25rem", whiteSpace: "nowrap", fontWeight: 500 }}>
        {label}
      </td>
      <td style={{ color: "var(--text-sec)", fontWeight: 500 }}>{value}</td>
    </tr>
  );
}
