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
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
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
                        aria-label={`${mw} MW / ${mw * d} MWh, ${d} hours${locked ? ", limit of 3 reached" : ""}`}
                        style={{
                          width: 52,
                          height: 38,
                          borderRadius: 5,
                          border: active ? "1px solid var(--ink)" : "1px solid var(--control)",
                          background: active ? "var(--raised)" : locked ? "var(--ground)" : "var(--surface)",
                          cursor: locked ? "not-allowed" : "pointer",
                          fontSize: 12,
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
        <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500, marginBottom: "0.6rem" }}>
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
                  fontSize: 14,
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
        fontSize: 14,
        color: scenarioCount > 0 ? "var(--text-sec)" : "var(--text-dim)",
        padding: "0.5rem 0",
        borderTop: "1px solid var(--border)",
      }}>
        {selectedCells.size > 0 && selectedExports.length > 0 && archetypeCount > 0 ? (
          <span className="tnum">
            {selectedCells.size} battery size{selectedCells.size !== 1 ? "s" : ""} × {selectedExports.length} export limit{selectedExports.length !== 1 ? "s" : ""} × {archetypeCount} site{archetypeCount !== 1 ? "s" : ""} = <strong style={{ fontWeight: 500 }}>{scenarioCount} scenario{scenarioCount !== 1 ? "s" : ""}</strong>
          </span>
        ) : (
          <span>No scenarios yet.</span>
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
  fontSize: 12,
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
  fontSize: 12,
  whiteSpace: "nowrap",
};
