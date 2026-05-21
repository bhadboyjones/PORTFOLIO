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

const CHART_TABS = [
  "Cumulative P&L",
  "Dispatch Profile",
  "Revenue Stack",
  "Baseline vs BESS",
];

function rankScenarios(scenarios) {
  return [...scenarios]
    .sort((a, b) => b.net_benefit_gbp - a.net_benefit_gbp)
    .map((s, i) => ({ ...s, rank: i + 1 }));
}

function TabBar({ tabs, active, onSelect, small }) {
  return (
    <div style={{ display: "flex", gap: "0.25rem", borderBottom: "2px solid #e5e7eb", marginBottom: small ? "1.25rem" : "1.75rem" }}>
      {tabs.map((tab, i) => (
        <button
          key={tab}
          onClick={() => onSelect(i)}
          style={{
            padding: small ? "0.4rem 0.85rem" : "0.55rem 1.1rem",
            border: "none",
            borderBottom: active === i ? "2px solid #2563eb" : "2px solid transparent",
            marginBottom: -2,
            background: "none",
            cursor: "pointer",
            fontWeight: active === i ? 700 : 400,
            color: active === i ? "#2563eb" : "#374151",
            fontSize: small ? "0.85rem" : "0.9rem",
            whiteSpace: "nowrap",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export default function ResultsPage({ results, jobId, onBack }) {
  const archetypeIds = Object.keys(results);
  const [activeArchetype, setActiveArchetype] = useState(archetypeIds[0]);
  const [chartTab, setChartTab] = useState(0);

  const rankedScenarios = rankScenarios(results[activeArchetype] || []);
  const topScenario = rankedScenarios[0] ?? null;

  function handleArchetypeChange(i) {
    setActiveArchetype(archetypeIds[i]);
    setChartTab(0);
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "2rem 1rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <button
          onClick={onBack}
          style={{
            padding: "0.4rem 0.85rem",
            border: "1px solid #d1d5db",
            borderRadius: 4,
            background: "#fff",
            cursor: "pointer",
            fontSize: "0.85rem",
          }}
        >
          ← New run
        </button>
        <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>Results</h1>
      </div>

      {/* Archetype tabs */}
      <TabBar
        tabs={archetypeIds.map((id) => DISPLAY_NAMES[id] ?? id)}
        active={archetypeIds.indexOf(activeArchetype)}
        onSelect={handleArchetypeChange}
      />

      {/* KPI cards */}
      <KpiCards topScenario={topScenario} />

      {/* Scenario table */}
      <ScenarioTable rankedScenarios={rankedScenarios} />

      {/* Charts */}
      <div style={{ marginTop: "2rem" }}>
        <TabBar
          tabs={CHART_TABS}
          active={chartTab}
          onSelect={setChartTab}
          small
        />

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem" }}>
          {chartTab === 0 && <CumulativePnlChart    rankedScenarios={rankedScenarios} />}
          {chartTab === 1 && <DispatchProfileChart  rankedScenarios={rankedScenarios} />}
          {chartTab === 2 && <RevenueStackChart     rankedScenarios={rankedScenarios} />}
          {chartTab === 3 && <BaselineComparisonChart rankedScenarios={rankedScenarios} />}
        </div>
      </div>

      <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
        <DownloadButton jobId={jobId} />
      </div>
    </div>
  );
}
