export default function ArchetypeCard({ archetype, selected, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        border: selected ? "1px solid #00c8e8" : "1px solid #1e3352",
        borderRadius: 10,
        padding: "1.25rem",
        cursor: "pointer",
        background: selected ? "rgba(0,200,232,0.07)" : "#152236",
        flex: 1,
        minWidth: 200,
        transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
        boxShadow: selected ? "0 0 0 1px #00c8e8, 0 0 20px rgba(0,200,232,0.12)" : "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.9rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: selected ? "#00c8e8" : "#e0eaf8" }}>
          {archetype.display_name}
        </h3>
        {selected && (
          <span style={{
            fontSize: "0.65rem", fontWeight: 700, color: "#080e1a",
            background: "#00c8e8", borderRadius: 3, padding: "0.15rem 0.45rem",
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
      <td style={{ color: "#4a6b8c", paddingRight: "0.6rem", paddingBottom: "0.25rem", whiteSpace: "nowrap", fontWeight: 500 }}>
        {label}
      </td>
      <td style={{ color: "#7ba0c8", fontWeight: 500 }}>{value}</td>
    </tr>
  );
}
