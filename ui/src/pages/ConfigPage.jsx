import { useState, useEffect } from "react";
import { getArchetypes, getScenarioOptions, postRun } from "../api/client";
import ArchetypeCard from "../components/ArchetypeCard";
import BessConfigurator from "../components/BessConfigurator";
import TimeframePicker from "../components/TimeframePicker";
import RunButton from "../components/RunButton";

export default function ConfigPage({ onRunStarted, jobError }) {
  const [archetypes, setArchetypes] = useState([]);
  const [scenarioOptions, setScenarioOptions] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [selectedArchetypes, setSelectedArchetypes] = useState([]);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [selectedExports, setSelectedExports] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [runError, setRunError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getArchetypes(), getScenarioOptions()])
      .then(([arch, opts]) => {
        setArchetypes(arch);
        setScenarioOptions(opts);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  function toggleArchetype(id) {
    setSelectedArchetypes((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function toggleCell(cellId) {
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(cellId)) next.delete(cellId);
      else next.add(cellId);
      return next;
    });
  }

  function toggleExport(ex) {
    setSelectedExports((prev) =>
      prev.includes(ex) ? prev.filter((e) => e !== ex) : [...prev, ex]
    );
  }

  function handleDateChange(start, end) {
    setStartDate(start);
    setEndDate(end);
  }

  const canRun =
    selectedArchetypes.length > 0 &&
    selectedCells.size > 0 &&
    selectedExports.length > 0 &&
    startDate &&
    endDate;

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
      <div style={{ padding: "2rem", color: "#dc2626" }}>
        Failed to load configuration: {loadError}. Is the API server running?
      </div>
    );
  }

  if (!scenarioOptions) {
    return <div style={{ padding: "2rem", color: "#6b7280" }}>Loading…</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.25rem" }}>
        BTM BESS Portfolio Optimiser
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "2rem", fontSize: "0.9rem" }}>
        Configure site archetypes, BESS specifications, and analysis window to model behind-the-meter battery economics.
      </p>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.75rem" }}>
          Site Archetypes
        </h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {archetypes.map((a) => (
            <ArchetypeCard
              key={a.id}
              archetype={a}
              selected={selectedArchetypes.includes(a.id)}
              onToggle={() => toggleArchetype(a.id)}
            />
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "2rem" }}>
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
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <TimeframePicker
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
        />
      </section>

      {jobError && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: "0.875rem" }}>
          Run failed: {jobError}
        </div>
      )}

      {runError && (
        <div style={{ marginBottom: "1rem", color: "#dc2626", fontSize: "0.875rem" }}>
          Error: {runError}
        </div>
      )}

      <RunButton disabled={!canRun || submitting} onClick={handleRun} />
    </div>
  );
}
