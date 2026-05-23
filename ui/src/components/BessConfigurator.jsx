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
  const atCellLimit   = selectedCells.size >= 3;

  return (
    <div>
      <h2 style={sectionLabel}>BESS Configuration</h2>

      {/* MW × Duration matrix */}
      <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
        <table style={{ borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr>
              <th style={cornerCell}></th>
              {durationOptions.map((d) => (
                <th key={d} style={colHeader}>{d}h</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mwOptions.map((mw) => (
              <tr key={mw}>
                <td style={rowHeader}>{mw} MW</td>
                {durationOptions.map((d) => {
                  const cellId = `${mw}_${d}`;
                  const active = selectedCells.has(cellId);
                  const locked = !active && atCellLimit;
                  return (
                    <td key={d} style={{ padding: "0.3rem 0.4rem", textAlign: "center" }}>
                      <button
                        onClick={() => onToggleCell(cellId)}
                        disabled={locked}
                        title={locked ? "Max 3 BESS configs selected" : `${mw} MW / ${d}h`}
                        style={{
                          width: 52,
                          height: 38,
                          borderRadius: 5,
                          border: active ? "1px solid #00c8e8" : "1px solid #1e3352",
                          background: active ? "rgba(0,200,232,0.15)" : locked ? "#0a1422" : "#0f1928",
                          cursor: locked ? "not-allowed" : "pointer",
                          fontSize: "0.75rem",
                          color: active ? "#00c8e8" : locked ? "#2a4772" : "#4a6b8c",
                          fontWeight: 700,
                          transition: "all 0.15s",
                          boxShadow: active ? "inset 0 0 0 1px #00c8e8" : "none",
                        }}
                      >
                        {active ? "✓" : `${mw * d} MWh`}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export limit pills */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: "0.75rem", color: "#4a6b8c", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
          Export Limit
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {exportOptions.map((ex) => {
            const active = selectedExports.includes(ex);
            return (
              <button
                key={ex}
                onClick={() => onToggleExport(ex)}
                style={{
                  padding: "0.4rem 1rem",
                  borderRadius: 999,
                  border: active ? "1px solid #00c8e8" : "1px solid #1e3352",
                  background: active ? "rgba(0,200,232,0.12)" : "#0f1928",
                  color: active ? "#00c8e8" : "#7ba0c8",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  transition: "all 0.15s",
                }}
              >
                {ex} MW
              </button>
            );
          })}
        </div>
      </div>

      {/* Scenario count */}
      <div style={{
        fontSize: "0.82rem",
        color: scenarioCount > 0 ? "#7ba0c8" : "#4a6b8c",
        padding: "0.5rem 0",
        borderTop: "1px solid #1e3352",
      }}>
        {selectedCells.size > 0 && selectedExports.length > 0 && archetypeCount > 0 ? (
          <span>
            <span style={{ color: "#00c8e8", fontWeight: 700 }}>{selectedCells.size}</span> BESS config{selectedCells.size !== 1 ? "s" : ""} ×{" "}
            <span style={{ color: "#00c8e8", fontWeight: 700 }}>{selectedExports.length}</span> export limit{selectedExports.length !== 1 ? "s" : ""} ×{" "}
            <span style={{ color: "#00c8e8", fontWeight: 700 }}>{archetypeCount}</span> archetype{archetypeCount !== 1 ? "s" : ""} ={" "}
            <span style={{ color: "#00e5a0", fontWeight: 700 }}>{scenarioCount} scenario{scenarioCount !== 1 ? "s" : ""}</span>
          </span>
        ) : (
          <span>Select BESS configs, export limits, and archetypes above</span>
        )}
      </div>
    </div>
  );
}

const sectionLabel = {
  margin: "0 0 1rem",
  fontSize: "0.72rem",
  fontWeight: 700,
  color: "#4a6b8c",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const cornerCell = {
  padding: "0.3rem 0.6rem",
  textAlign: "center",
  color: "#4a6b8c",
  fontSize: "0.75rem",
};

const colHeader = {
  padding: "0.4rem 0.4rem 0.6rem",
  textAlign: "center",
  color: "#7ba0c8",
  fontWeight: 700,
  fontSize: "0.8rem",
  letterSpacing: "0.04em",
  borderBottom: "1px solid #1e3352",
};

const rowHeader = {
  padding: "0.3rem 0.8rem 0.3rem 0",
  textAlign: "right",
  color: "#7ba0c8",
  fontWeight: 700,
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
};
