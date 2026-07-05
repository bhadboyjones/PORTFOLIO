import { useState, useEffect } from "react";
import { getArchetypes, getScenarioOptions, postRun } from "../api/client";
import ArchetypeCard from "../components/ArchetypeCard";
import BessConfigurator from "../components/BessConfigurator";
import TimeframePicker from "../components/TimeframePicker";
import RunButton from "../components/RunButton";

export default function ConfigPage({ onRunStarted, jobError }) {
  const [archetypes, setArchetypes]         = useState([]);
  const [scenarioOptions, setScenarioOptions] = useState(null);
  const [loadError, setLoadError]           = useState(null);

  const [selectedArchetypes, setSelectedArchetypes] = useState([]);
  const [selectedCells, setSelectedCells]           = useState(new Set());
  const [selectedExports, setSelectedExports]       = useState([]);
  const [priceExposure, setPriceExposure]           = useState("da");
  const [startDate, setStartDate]                   = useState("");
  const [endDate, setEndDate]                       = useState("");
  const [runError, setRunError]                     = useState(null);
  const [submitting, setSubmitting]                 = useState(false);

  useEffect(() => {
    Promise.all([getArchetypes(), getScenarioOptions()])
      .then(([arch, opts]) => { setArchetypes(arch); setScenarioOptions(opts); })
      .catch((e) => setLoadError(e.message));
  }, []);

  function toggleArchetype(id) {
    setSelectedArchetypes((prev) => (prev.includes(id) ? [] : [id]));
  }

  function toggleCell(cellId) {
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(cellId)) { next.delete(cellId); }
      else if (next.size < 3) { next.add(cellId); }
      return next;
    });
  }

  function toggleExport(ex) {
    setSelectedExports((prev) =>
      prev.includes(ex) ? prev.filter((e) => e !== ex) : [...prev, ex]
    );
  }

  function handleDateChange(start, end) { setStartDate(start); setEndDate(end); }

  const canRun =
    selectedArchetypes.length > 0 &&
    selectedCells.size > 0 &&
    selectedExports.length > 0 &&
    startDate && endDate;

  async function handleRun() {
    setRunError(null);
    setSubmitting(true);
    try {
      const bessSelections = [...selectedCells].map((cellId) => {
        const [mw, duration] = cellId.split("_");
        return { mw: parseFloat(mw), duration: parseInt(duration, 10) };
      });
      const { job_id } = await postRun({
        archetypes: selectedArchetypes,
        bess_selections: bessSelections,
        export_selections: selectedExports,
        start_date: startDate,
        end_date: endDate,
        price_exposure: priceExposure,
      });
      onRunStarted(job_id);
    } catch (e) {
      setRunError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <div style={{ padding: "1.5rem 2rem", background: "var(--bg-card)", border: "1px solid var(--negative-a30)", borderRadius: 10, color: "var(--negative)", maxWidth: 480 }}>
          <strong>Failed to load configuration</strong>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "var(--text-sec)" }}>
            {loadError}. Is the API server running?
          </p>
        </div>
      </div>
    );
  }

  if (!scenarioOptions) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-base)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-dim)" }}>
          <div className="pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px rgba(0,200,232,0.5)", flexShrink: 0 }} />
          <span style={{ fontSize: "0.875rem" }}>Loading configuration…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>

      {/* Hero */}
      <div style={{
        background: "var(--bg-surface)",
        backgroundImage: `
          linear-gradient(rgba(0,200,232,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,200,232,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
        borderBottom: "1px solid var(--border)",
        padding: "2.5rem 1.5rem 2rem",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-pri)", letterSpacing: "-0.02em" }}>
              flex<span style={{ color: "var(--accent)" }}>iq</span>
            </h1>
            <span style={{
              fontSize: "0.62rem", fontWeight: 700, color: "var(--accent)",
              background: "var(--signal-a10)", border: "1px solid var(--signal-a25)",
              borderRadius: 3, padding: "0.12rem 0.4rem", letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              BETA
            </span>
          </div>
          <p style={{ margin: "0 0 1rem", color: "var(--text-sec)", fontSize: "0.9rem" }}>
            BTM BESS optimisation
          </p>
          <p style={{
            margin: 0, color: "var(--text-dim)", fontSize: "0.8rem",
            background: "var(--signal-a05)", border: "1px solid rgba(0,200,232,0.12)",
            borderRadius: 5, padding: "0.45rem 0.85rem", display: "inline-block",
          }}>
            Select 1 site archetype, up to 3 BESS configurations and up to 4 export limits (max 12 scenarios).
          </p>
        </div>
      </div>

      {/* Config body */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.75rem 1rem" }}>

        {/* Site Archetypes */}
        <Card label="Site Archetypes">
          <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap" }}>
            {archetypes.map((a) => (
              <ArchetypeCard
                key={a.id}
                archetype={a}
                selected={selectedArchetypes.includes(a.id)}
                onToggle={() => toggleArchetype(a.id)}
              />
            ))}
          </div>
        </Card>

        {/* BESS Configuration */}
        <Card label="BESS Configuration">
          <BessConfigurator
            mwOptions={scenarioOptions.mw_options}
            durationOptions={scenarioOptions.duration_options}
            exportOptions={scenarioOptions.export_options}
            selectedCells={selectedCells}
            selectedExports={selectedExports}
            onToggleCell={toggleCell}
            onToggleExport={toggleExport}
            archetypeCount={selectedArchetypes.length}
          />
        </Card>

        {/* Analysis Window */}
        <Card label="Analysis Window">
          <TimeframePicker
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
          />
        </Card>

        {/* Price Exposure */}
        <Card label="Price Exposure">
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {[
              { value: "da",        label: "Day-Ahead (DA)",     desc: "Settled against day-ahead market price" },
              { value: "imbalance", label: "Imbalance (System)", desc: "Settled against system imbalance price" },
            ].map(({ value, label, desc }) => {
              const active = priceExposure === value;
              return (
                <button
                  key={value}
                  className="lift"
                  onClick={() => setPriceExposure(value)}
                  aria-pressed={active}
                  style={{
                    flex: 1,
                    minWidth: 220,
                    padding: "0.85rem 1rem",
                    border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                    borderRadius: 7,
                    background: active ? "var(--signal-a08)" : "var(--bg-surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: active ? "0 0 16px var(--signal-a10)" : "none",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: active ? "var(--accent)" : "var(--text-sec)", marginBottom: "0.25rem" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    {desc}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Errors */}
        {jobError && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "rgba(255,85,119,0.08)", border: "1px solid var(--negative-a30)", borderRadius: 6, color: "var(--negative)", fontSize: "0.875rem" }}>
            Run failed: {jobError}
          </div>
        )}
        {runError && (
          <div style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "rgba(255,85,119,0.08)", border: "1px solid var(--negative-a30)", borderRadius: 6, color: "var(--negative)", fontSize: "0.875rem" }}>
            {runError}
          </div>
        )}

        <div style={{
          fontSize: "0.75rem",
          color: "var(--text-dim)",
          background: "rgba(0,200,232,0.03)",
          border: "1px solid var(--signal-a10)",
          borderRadius: 6,
          padding: "0.5rem 0.85rem",
          marginBottom: "0.75rem",
        }}>
          ⓘ Using representative demand profiles for typical I&amp;C sites. Network rates based on Northern Powergrid NE HV 2026/27 tariffs.
        </div>

        <RunButton disabled={!canRun || submitting} onClick={handleRun} />
      </div>
    </div>
  );
}

function Card({ label, children }) {
  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "1.5rem",
      marginBottom: "1rem",
    }}>
      <div style={{
        fontSize: "0.68rem", fontWeight: 700, color: "var(--text-dim)",
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.1rem",
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}
