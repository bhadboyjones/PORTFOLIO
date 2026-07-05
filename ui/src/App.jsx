import { useState, lazy, Suspense } from "react";
import LandingPage from "./pages/LandingPage";

const ConfigPage    = lazy(() => import("./pages/ConfigPage"));
const CsvConfigPage = lazy(() => import("./pages/CsvConfigPage"));
const ProgressScreen = lazy(() => import("./pages/ProgressScreen"));
const ResultsPage   = lazy(() => import("./pages/ResultsPage"));

const PageShell = () => <div style={{ minHeight: "100vh", background: "var(--bg-base)" }} />;

export default function App() {
  const [view, setView]       = useState("config");
  const [mode, setMode]       = useState(null);
  const [jobId, setJobId]     = useState(null);
  const [results, setResults] = useState(null);
  const [runError, setRunError] = useState(null);
  const [csvWarnings, setCsvWarnings] = useState(null);
  const [dataPeriod, setDataPeriod] = useState(null);

  function handleModeChange(m) {
    setMode(m);
    setResults(null);
    setRunError(null);
    setJobId(null);
    setCsvWarnings(null);
    setDataPeriod(null);
  }

  function handleRunStarted(id) {
    setJobId(id);
    setResults(null);
    setRunError(null);
    setCsvWarnings(null);
    setDataPeriod(null);
    setView("progress");
  }

  function handleComplete(payload, warns, period) {
    // CSV mode returns { csv_run: [...] } — normalise to archetype-compatible shape
    let norm = payload;
    if (mode === "csv" && payload.csv_run) {
      norm = { "CSV Upload": payload.csv_run };
    }
    setResults(norm);
    setCsvWarnings(warns && warns.length > 0 ? warns : null);
    setDataPeriod(period ?? null);
    setView("results");
  }

  function handleFailed(errorMsg) {
    setRunError(errorMsg);
    setView("config");
  }

  function handleBack() {
    setView("config");
    setRunError(null);
    setCsvWarnings(null);
    setDataPeriod(null);
  }

  const modeBar = (
    <div style={{
      position: "sticky",
      top: 0,
      zIndex: 100,
      background: "var(--bg-base)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      padding: "0 1.5rem",
      gap: "1rem",
      minHeight: 40,
    }}>
      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
        Mode: <span style={{ color: mode === "csv" ? "var(--accent)" : "var(--text-sec)", fontWeight: 700 }}>
          {mode === "csv" ? "CSV Upload" : "Archetypes"}
        </span>
      </span>
      <button
        onClick={() => handleModeChange(null)}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-dim)",
          fontSize: "0.72rem",
          cursor: "pointer",
          padding: "0.15rem 0",
          textDecoration: "underline",
        }}
      >
        change
      </button>
    </div>
  );

  let viewKey;
  let content;
  let showModeBar = false;

  if (view === "progress") {
    viewKey = "progress";
    content = (
      <ProgressScreen
        jobId={jobId}
        onComplete={handleComplete}
        onFailed={handleFailed}
      />
    );
  } else if (view === "results") {
    viewKey = "results";
    content = (
      <ResultsPage
        results={results}
        jobId={jobId}
        mode={mode}
        onBack={handleBack}
        validationWarnings={csvWarnings}
        dataPeriod={dataPeriod}
      />
    );
  } else if (mode === null) {
    viewKey = "landing";
    content = <LandingPage onSelectMode={handleModeChange} />;
  } else {
    viewKey = `config-${mode}`;
    showModeBar = true;
    content = mode === "archetype"
      ? <ConfigPage onRunStarted={handleRunStarted} jobError={runError} />
      : <CsvConfigPage onRunStarted={handleRunStarted} jobError={runError} />;
  }

  // Keyed wrapper re-mounts per view, replaying the entrance animation
  return (
    <div key={viewKey} className="view-enter">
      {showModeBar && modeBar}
      <Suspense fallback={<PageShell />}>{content}</Suspense>
    </div>
  );
}
