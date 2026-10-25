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
          <p style={{ margin: "0.5rem 0 0", fontSize: 14, color: "var(--text-sec)" }}>
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
                    <span style={{ fontSize: 14 }}>Loading configuration…</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 64 }}>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 0" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-title)", lineHeight: "32px", fontWeight: 700, letterSpacing: "-0.01em" }}>
          Archetype sites
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 16, lineHeight: "24px", color: "var(--muted)" }}>
          Choose one site, up to 3 battery sizes and up to 4 export limits (12 scenarios at most).
        </p>
      </div>

      {/* Config body */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.75rem 1rem" }}>

        {/* Site */}
        <Card label="Site">
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

        {/* Battery sizes */}
        <Card label="Battery sizes">
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

        {/* Analysis window */}
        <Card label="Analysis window">
          <TimeframePicker
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
          />
        </Card>

        {/* Price signal */}
        <Card label="Price signal">
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {[
              { value: "da",        label: "Day-ahead (DA)",     desc: "Elexon market index, a day-ahead proxy" },
              { value: "imbalance", label: "Imbalance (system)", desc: "Settled against the system imbalance price" },
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
                    border: active ? "1px solid var(--ink)" : "1px solid var(--control)",
                    borderRadius: "var(--radius-control)",
                    background: active ? "var(--raised)" : "var(--surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    font: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 14, color: "var(--ink)", marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {desc}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Errors */}
        {jobError && (
          <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "var(--pill-negative-bg)", border: "1px solid var(--negative-a30)", borderRadius: 6, color: "var(--negative)", fontSize: 14 }}>
            Run failed: {jobError}
          </div>
        )}
        {runError && (
          <div role="alert" style={{ marginBottom: "1rem", padding: "0.75rem 1rem", background: "var(--pill-negative-bg)", border: "1px solid var(--negative-a30)", borderRadius: 6, color: "var(--negative)", fontSize: 14 }}>
            {runError}
          </div>
        )}

        <div style={{
          fontSize: 12,
          color: "var(--text-dim)",
          background: "transparent",
          border: "none",
          borderRadius: 6,
          padding: "0.5rem 0.85rem",
          marginBottom: "0.75rem",
        }}>
          Representative demand profiles for typical C&amp;I sites. Network rates based on Northern Powergrid NE HV 2026/27 tariffs.
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
      <h2 style={{ margin: "0 0 16px", fontSize: "var(--fs-section)", lineHeight: "24px", fontWeight: 500 }}>
        {label}
      </h2>
      {children}
    </div>
  );
}
