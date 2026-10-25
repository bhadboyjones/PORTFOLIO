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
                        className="lift"
                        onClick={() => onToggleCell(cellId)}
                        disabled={locked}
                        aria-pressed={active}
                        title={locked ? "Max 3 BESS configs selected" : `${mw} MW / ${d}h`}
                        style={{
                          width: 52,
                          height: 38,
                          borderRadius: 5,
                          border: active ? "1px solid var(--ink)" : "1px solid var(--control)",
                          background: active ? "var(--raised)" : locked ? "var(--ground)" : "var(--surface)",
                          cursor: locked ? "not-allowed" : "pointer",
                          fontSize: "0.75rem",
                          color: locked ? "var(--faint)" : "var(--ink)",
                          fontWeight: active ? 500 : 400,
                        }}
                      >
                        {`${mw * d} MWh`}
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
        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 500, marginBottom: "0.6rem" }}>
          Export limit
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {exportOptions.map((ex) => {
            const active = selectedExports.includes(ex);
            return (
              <button
                key={ex}
                className="lift"
                onClick={() => onToggleExport(ex)}
                aria-pressed={active}
                style={{
                  padding: "0.4rem 1rem",
                  borderRadius: 999,
                  border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                  background: active ? "var(--raised)" : "var(--bg-surface)",
                  color: active ? "var(--accent)" : "var(--text-sec)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontWeight: 600,
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
        color: scenarioCount > 0 ? "var(--text-sec)" : "var(--text-dim)",
        padding: "0.5rem 0",
        borderTop: "1px solid var(--border)",
      }}>
        {selectedCells.size > 0 && selectedExports.length > 0 && archetypeCount > 0 ? (
          <span className="tnum">
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{selectedCells.size}</span> BESS config{selectedCells.size !== 1 ? "s" : ""} ×{" "}
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{selectedExports.length}</span> export limit{selectedExports.length !== 1 ? "s" : ""} ×{" "}
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>{archetypeCount}</span> archetype{archetypeCount !== 1 ? "s" : ""} ={" "}
            <span style={{ color: "var(--positive)", fontWeight: 700 }}>{scenarioCount} scenario{scenarioCount !== 1 ? "s" : ""}</span>
          </span>
        ) : (
          <span>Select BESS configs, export limits, and archetypes above</span>
        )}
      </div>
    </div>
  );
}

const sectionLabel = {
  margin: "0 0 12px",
  fontSize: 14,
  fontWeight: 500,
  color: "var(--ink)",
};

const cornerCell = {
  padding: "0.3rem 0.6rem",
  textAlign: "center",
  color: "var(--text-dim)",
  fontSize: "0.75rem",
};

const colHeader = {
  padding: "0.4rem 0.4rem 0.6rem",
  textAlign: "center",
  color: "var(--text-sec)",
  fontWeight: 500,
  fontSize: 14,
  borderBottom: "1px solid var(--border)",
};

const rowHeader = {
  padding: "0.3rem 0.8rem 0.3rem 0",
  textAlign: "right",
  color: "var(--text-sec)",
  fontWeight: 700,
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
};
