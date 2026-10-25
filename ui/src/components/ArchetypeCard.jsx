export default function ArchetypeCard({ archetype, selected, onToggle }) {
  return (
    <div
      className="lift lift-glow"
      role="button"
      aria-label={`${sentenceCase(archetype.display_name)}, peak ${archetype.peak_mw} MW`}
      tabIndex={0}
      aria-pressed={selected}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
      }}
      style={{
        border: selected ? "1px solid var(--ink)" : "1px solid var(--line)",
        borderRadius: 10,
        padding: "1.25rem",
        cursor: "pointer",
        background: selected ? "var(--raised)" : "var(--surface)",
        flex: 1,
        minWidth: 200,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.9rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 500, color: "var(--ink)" }}>
          {sentenceCase(archetype.display_name)}
        </h3>
        {selected && (
          <span style={{
            fontSize: 12, fontWeight: 400, color: "var(--pill-neutral-ink)",
            background: "var(--pill-neutral-bg)", borderRadius: 4, padding: "0 8px", lineHeight: "20px",
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

// Backend names arrive in Title Case ("Mid-Size Industrial"); the UI uses
// sentence case throughout.
function sentenceCase(t = "") {
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
