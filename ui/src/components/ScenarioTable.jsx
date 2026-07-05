import { useState } from "react";

const COLUMNS = [
  { key: "rank",                  label: "Rank",              align: "center" },
  { key: "scenario_label",        label: "Scenario",          align: "left"   },
  { key: "export_limit_mw",       label: "Export",            align: "right", numeric: true },
  { key: "site_cost_wo_bess_gbp", label: "No BESS (£)",       align: "right", numeric: true },
  { key: "site_cost_w_bess_gbp",  label: "With BESS (£)",     align: "right", numeric: true },
  { key: "net_benefit_gbp",       label: "Net Benefit (£)",   align: "right", numeric: true },
];

function fmt(key, value) {
  if (value == null || (typeof value === "number" && isNaN(value))) return "—";
  if (["net_benefit_gbp", "site_cost_wo_bess_gbp", "site_cost_w_bess_gbp"].includes(key)) {
    return `£${Math.round(value).toLocaleString("en-GB")}`;
  }
  if (key === "export_limit_mw") return `${value} MW`;
  return value;
}

export default function ScenarioTable({ rankedScenarios }) {
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("desc");

  function handleSort(key) {
    if (key === "rank") return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const top3 = rankedScenarios.slice(0, 3);
  const allSorted = sortKey
    ? [...rankedScenarios].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rankedScenarios;

  const displayRows = showAll ? allSorted : top3;

  return (
    <div style={{ marginBottom: "0.5rem" }}>
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Scenario Rankings
      </h3>
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
          <thead>
            <tr style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)" }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  onClick={() => handleSort(col.key)}
                  tabIndex={col.key === "rank" ? undefined : 0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSort(col.key); }
                  }}
                  aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                  style={{
                    padding: "0.65rem 1rem",
                    textAlign: col.align,
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    color: sortKey === col.key ? "var(--accent)" : "var(--text-sec)",
                    cursor: col.key === "rank" ? "default" : "pointer",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    letterSpacing: "0.04em",
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4, color: "var(--accent)" }}>
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr
                key={`${row.scenario_label}-${row.export_limit_mw}`}
                style={{
                  borderBottom: i < displayRows.length - 1 ? "1px solid var(--border)" : "none",
                  background: row.rank === 1
                    ? "var(--signal-a05)"
                    : i % 2 === 0 ? "var(--bg-card)" : "var(--bg-surface)",
                }}
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={col.numeric ? "tnum" : undefined}
                    style={{
                      padding: "0.6rem 1rem",
                      textAlign: col.align,
                      color: col.key === "net_benefit_gbp"
                        ? "var(--positive)"
                        : col.key === "rank" && row.rank === 1
                          ? "var(--accent)"
                          : "var(--text-pri)",
                      fontWeight: col.key === "rank" && row.rank === 1 ? 700 : 400,
                      fontSize: "0.83rem",
                    }}
                  >
                    {fmt(col.key, row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rankedScenarios.length > 3 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{
            marginTop: "0.6rem",
            background: "none",
            border: "none",
            color: "var(--accent)",
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: 600,
            padding: "0.2rem 0",
          }}
        >
          {showAll ? "Show top 3 ↑" : `View all ${rankedScenarios.length} scenarios ↓`}
        </button>
      )}
    </div>
  );
}
