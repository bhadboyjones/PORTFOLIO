import { useState } from "react";

const COLUMNS = [
  { key: "rank",                  label: "Rank",                  align: "center" },
  { key: "scenario_label",        label: "Scenario",              align: "left"   },
  { key: "export_limit_mw",       label: "Export",                align: "right"  },
  { key: "site_cost_wo_bess_gbp", label: "Site Cost (no BESS) £", align: "right"  },
  { key: "site_cost_w_bess_gbp",  label: "Site Cost (with BESS) £", align: "right" },
  { key: "net_benefit_gbp",       label: "Net Benefit £",         align: "right"  },
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
  const [showAll, setShowAll]         = useState(false);
  const [sortKey, setSortKey]         = useState(null);
  const [sortDir, setSortDir]         = useState("desc");

  function handleSort(key) {
    if (key === "rank") return; // rank is fixed by net_benefit order
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
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rankedScenarios;

  const displayRows = showAll ? allSorted : top3;

  return (
    <div>
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700 }}>
        Top Scenarios
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.875rem",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: "0.6rem 0.9rem",
                    textAlign: col.align,
                    fontWeight: 700,
                    color: "#374151",
                    cursor: col.key === "rank" ? "default" : "pointer",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                  }}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4, color: "#2563eb" }}>
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
                  borderBottom: "1px solid #f3f4f6",
                  background: row.rank === 1 ? "#eff6ff" : i % 2 === 0 ? "#fff" : "#fafafa",
                }}
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: "0.55rem 0.9rem",
                      textAlign: col.align,
                      fontWeight: col.key === "rank" && row.rank === 1 ? 700 : 400,
                      color: col.key === "net_benefit_gbp" ? "#1d4ed8" : "#111827",
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
            color: "#2563eb",
            cursor: "pointer",
            fontSize: "0.85rem",
            padding: "0.2rem 0",
          }}
        >
          {showAll
            ? "Hide ↑"
            : `View all ${rankedScenarios.length} scenarios ↓`}
        </button>
      )}
    </div>
  );
}
