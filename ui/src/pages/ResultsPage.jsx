import { useState } from "react";
import KpiCards from "../components/KpiCards";
import DownloadButton from "../components/DownloadButton";
import ScenarioTable from "../components/ScenarioTable";
import CumulativePnlChart from "../components/CumulativePnlChart";
import DispatchProfileChart from "../components/DispatchProfileChart";
import RevenueStackChart from "../components/RevenueStackChart";
import BaselineComparisonChart from "../components/BaselineComparisonChart";

const DISPLAY_NAMES = {
  small_office:      "Small Commercial",
  medium_industrial: "Mid-Size Industrial",
  large_industrial:  "Large Industrial",
};

const CHART_TABS = ["Cumulative P&L", "Dispatch Profile", "Revenue Stack", "Baseline vs BESS"];

function rankScenarios(scenarios) {
  return [...scenarios]
    .sort((a, b) => b.net_benefit_gbp - a.net_benefit_gbp)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

function TabBar({ tabs, active, onSelect, small }) {
  return (
    <div style={{
      display: "flex",
      gap: 0,
      borderBottom: "1px solid #1e3352",
      marginBottom: small ? "1.25rem" : "1.5rem",
    }}>
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onSelect(i)}
          style={{
            padding: small ? "0.45rem 1rem" : "0.6rem 1.25rem",
            border: "none",
            borderBottom: active === i ? "2px solid #00c8e8" : "2px solid transparent",
            marginBottom: -1,
            background: "none",
            cursor: "pointer",
            fontWeight: active === i ? 700 : 500,
            color: active === i ? "#00c8e8" : "#4a6b8c",
            fontSize: small ? "0.82rem" : "0.875rem",
            whiteSpace: "nowrap",
            transition: "color 0.15s",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function fmt(v, dec = 0) {
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function BaselineBreakdown({ topScenario }) {
  if (!topScenario) return null;
  const rows = [
    { label: "Import cost",   value: topScenario.baseline_import_cost_gbp, sign: 1  },
    { label: "Thermal generation cost", value: topScenario.baseline_thermal_cost_gbp, sign: 1  },
    { label: "Export revenue",value: topScenario.baseline_export_rev_gbp,  sign: -1 },
    { label: "Standing charges", value: topScenario.total_standing_gbp,    sign: 1  },
    { label: "Net site cost", value: topScenario.baseline_net_gbp + topScenario.total_standing_gbp, sign: 1, bold: true },
  ];
  return (
    <div style={{
      background: "#152236",
      border: "1px solid #1e3352",
      borderRadius: 10,
      padding: "1.25rem 1.5rem",
      marginBottom: "1.5rem",
    }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#4a6b8c", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1rem" }}>
        Baseline Site Cost (without BESS)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
        {rows.map(({ label, value, sign, bold }) => {
          const display = value != null ? `£${fmt(value, 0)}` : "—";
          const color = bold ? "#e0eaf8" : sign < 0 ? "#00e5a0" : "#7ba0c8";
          return (
            <div key={label} style={{ paddingBottom: bold ? "0" : "0", borderTop: bold ? "1px solid #1e3352" : "none", paddingTop: bold ? "0.6rem" : "0" }}>
              <div style={{ fontSize: "0.7rem", color: "#4a6b8c", marginBottom: "0.2rem" }}>{label}</div>
              <div style={{ fontSize: bold ? "1rem" : "0.9rem", fontWeight: bold ? 700 : 600, color }}>
                {display}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResultsPage({ results, jobId, mode, onBack, validationWarnings }) {
  const archetypeIds   = Object.keys(results);
  const [activeArchetype, setActiveArchetype] = useState(archetypeIds[0]);
  const [chartTab, setChartTab]               = useState(0);

  const rankedScenarios = rankScenarios(results[activeArchetype] || []);
  const topScenario     = rankedScenarios[0] ?? null;

  function handleArchetypeChange(i) {
    setActiveArchetype(archetypeIds[i]);
    setChartTab(0);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080e1a" }}>

      {/* Top bar */}
      <div style={{
        background: "#0f1928",
        borderBottom: "1px solid #1e3352",
        padding: "0.9rem 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "1.25rem",
      }}>
        <button
          onClick={onBack}
          style={{
            padding: "0.35rem 0.85rem",
            border: "1px solid #1e3352",
            borderRadius: 5,
            background: "transparent",
            cursor: "pointer",
            fontSize: "0.82rem",
            color: "#7ba0c8",
            transition: "border-color 0.15s",
          }}
        >
          ← New run
        </button>
        <div>
          <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#e0eaf8", letterSpacing: "-0.01em" }}>
            flex<span style={{ color: "#00c8e8" }}>iq</span>
          </span>
          <span style={{ marginLeft: "0.75rem", fontSize: "0.8rem", color: "#4a6b8c" }}>Results</span>
        </div>
      </div>

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "1.75rem 1rem" }}>

        {/* Archetype tabs */}
        {archetypeIds.length > 1 && (
          <TabBar
            tabs={archetypeIds.map((id) => DISPLAY_NAMES[id] ?? id)}
            active={archetypeIds.indexOf(activeArchetype)}
            onSelect={handleArchetypeChange}
          />
        )}

        {/* Mode badge */}
        {mode === "archetype" && (
          <div style={{
            marginBottom: "1rem",
            fontSize: "0.72rem",
            color: "#4a6b8c",
            background: "rgba(0,200,232,0.03)",
            border: "1px solid rgba(0,200,232,0.1)",
            borderRadius: 5,
            padding: "0.4rem 0.75rem",
            display: "inline-block",
          }}>
            ⓘ Archetype mode — demand profile is representative, not site-specific
          </div>
        )}

        {/* Validation warnings from CSV upload */}
        {validationWarnings?.length > 0 && (
          <div style={{
            marginBottom: "1.25rem",
            padding: "0.75rem 1rem",
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 6,
          }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>
              Data warnings
            </div>
            {validationWarnings.map((w, i) => (
              <div key={i} style={{ fontSize: "0.78rem", color: "#d97706", marginTop: i > 0 ? "0.25rem" : 0 }}>
                {w}
              </div>
            ))}
          </div>
        )}

        {/* KPI cards */}
        <KpiCards topScenario={topScenario} />

        {/* Baseline breakdown — CSV mode only */}
        {mode === "csv" && <BaselineBreakdown topScenario={topScenario} />}

        {/* Scenario table */}
        <div style={{ marginBottom: "2rem" }}>
          <ScenarioTable rankedScenarios={rankedScenarios} />
        </div>

        {/* Charts */}
        <div style={{
          background: "#152236",
          border: "1px solid #1e3352",
          borderRadius: 10,
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}>
          <TabBar tabs={CHART_TABS} active={chartTab} onSelect={setChartTab} small />
          {chartTab === 0 && <CumulativePnlChart     rankedScenarios={rankedScenarios} />}
          {chartTab === 1 && <DispatchProfileChart   rankedScenarios={rankedScenarios} />}
          {chartTab === 2 && <RevenueStackChart      rankedScenarios={rankedScenarios} />}
          {chartTab === 3 && <BaselineComparisonChart rankedScenarios={rankedScenarios} />}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <DownloadButton jobId={jobId} />
        </div>

      </div>
    </div>
  );
}
