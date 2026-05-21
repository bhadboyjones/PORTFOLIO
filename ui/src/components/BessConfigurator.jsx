export default function BessConfigurator({
  mwOptions,
  durationOptions,
  exportOptions,
  selectedCells,
  selectedExports,
  onToggleCell,
  onToggleExport,
  archetypeCount,
}) {
  const scenarioCount = selectedCells.size * selectedExports.length * archetypeCount;
  const showWarning = scenarioCount > 50;

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem" }}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>BESS Configuration</h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              {durationOptions.map((d) => (
                <th key={d} style={thStyle}>{d}h</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mwOptions.map((mw) => (
              <tr key={mw}>
                <td style={tdStyle}>{mw} MW</td>
                {durationOptions.map((d) => {
                  const cellId = `${mw}_${d}`;
                  const active = selectedCells.has(cellId);
                  return (
                    <td key={d} style={tdStyle}>
                      <button
                        onClick={() => onToggleCell(cellId)}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 4,
                          border: active ? "2px solid #2563eb" : "2px solid #d1d5db",
                          background: active ? "#2563eb" : "#fff",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                          color: active ? "#fff" : "#374151",
                          fontWeight: 600,
                        }}
                      >
                        {active ? "✓" : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <div style={{ fontSize: "0.875rem", color: "#374151", marginBottom: "0.5rem" }}>
          Export limit:
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {exportOptions.map((ex) => {
            const active = selectedExports.includes(ex);
            return (
              <button
                key={ex}
                onClick={() => onToggleExport(ex)}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: 20,
                  border: active ? "2px solid #2563eb" : "2px solid #d1d5db",
                  background: active ? "#2563eb" : "#fff",
                  color: active ? "#fff" : "#374151",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                {ex} MW
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#374151" }}>
        {selectedCells.size > 0 && selectedExports.length > 0 && archetypeCount > 0 ? (
          <span>
            <strong>{selectedCells.size}</strong> BESS config{selectedCells.size !== 1 ? "s" : ""} ×{" "}
            <strong>{selectedExports.length}</strong> export limit{selectedExports.length !== 1 ? "s" : ""} ×{" "}
            <strong>{archetypeCount}</strong> archetype{archetypeCount !== 1 ? "s" : ""} ={" "}
            <strong>{scenarioCount} scenarios</strong>
          </span>
        ) : (
          <span style={{ color: "#9ca3af" }}>Select BESS configs, export limits, and archetypes</span>
        )}
      </div>

      {showWarning && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.6rem 0.85rem",
          background: "#fffbeb",
          border: "1px solid #f59e0b",
          borderRadius: 6,
          fontSize: "0.8rem",
          color: "#92400e",
        }}>
          ⚠ Large run — estimated time 8–12 mins
        </div>
      )}
    </div>
  );
}

const thStyle = {
  padding: "0.4rem 0.75rem",
  textAlign: "center",
  color: "#6b7280",
  fontWeight: 600,
  fontSize: "0.8rem",
};

const tdStyle = {
  padding: "0.4rem 0.75rem",
  textAlign: "center",
};
