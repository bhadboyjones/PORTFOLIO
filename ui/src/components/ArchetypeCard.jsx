export default function ArchetypeCard({ archetype, selected, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        border: selected ? "2px solid #2563eb" : "2px solid #e5e7eb",
        borderRadius: 8,
        padding: "1.25rem",
        cursor: "pointer",
        background: selected ? "#eff6ff" : "#fff",
        flex: 1,
        minWidth: 220,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700 }}>
        {archetype.display_name}
      </h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <tbody>
          <Row label="Peak demand" value={`${archetype.peak_mw} MW`} />
          <Row label="Base load" value={`${archetype.base_mw} MW`} />
          <Row label="Off-peak" value={`${archetype.offpeak_mw} MW`} />
          <Row label="PV" value={archetype.has_pv ? `${archetype.pv_kwp} kWp` : "None"} />
          <Row label="CHP" value={archetype.has_chp ? `${archetype.chp_kw} kW` : "None"} />
          <Row label="DNO" value={archetype.dno} />
          <Row label="Tariff" value={archetype.tariff} />
        </tbody>
      </table>
      <button
        style={{
          marginTop: "1rem",
          width: "100%",
          padding: "0.4rem",
          border: "1px solid #2563eb",
          borderRadius: 4,
          background: selected ? "#2563eb" : "#fff",
          color: selected ? "#fff" : "#2563eb",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "0.85rem",
        }}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        {selected ? "Selected" : "Select"}
      </button>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <tr>
      <td style={{ color: "#6b7280", paddingRight: "0.5rem", paddingBottom: "0.2rem", whiteSpace: "nowrap" }}>
        {label}:
      </td>
      <td style={{ fontWeight: 500 }}>{value}</td>
    </tr>
  );
}
