import { useState, lazy, Suspense } from "react";

const ConfigPage    = lazy(() => import("./pages/ConfigPage"));
const CsvConfigPage = lazy(() => import("./pages/CsvConfigPage"));
const ProgressScreen = lazy(() => import("./pages/ProgressScreen"));
const ResultsPage   = lazy(() => import("./pages/ResultsPage"));

const PageShell = () => <div style={{ minHeight: "100vh", background: "#080e1a" }} />;

export default function App() {
  const [view, setView]       = useState("config");
  const [mode, setMode]       = useState(null);
  const [jobId, setJobId]     = useState(null);
  const [results, setResults] = useState(null);
  const [runError, setRunError] = useState(null);
  const [csvWarnings, setCsvWarnings] = useState(null);

  function handleModeChange(m) {
    setMode(m);
    setResults(null);
    setRunError(null);
  }

  function handleRunStarted(id) {
    setJobId(id);
    setResults(null);
    setRunError(null);
    setView("progress");
  }

  function handleComplete(payload, warns) {
    // CSV mode returns { csv_run: [...] } — normalise to archetype-compatible shape
    let norm = payload;
    if (mode === "csv" && payload.csv_run) {
      norm = { "CSV Upload": payload.csv_run };
    }
    setResults(norm);
    setCsvWarnings(warns && warns.length > 0 ? warns : null);
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
  }

  if (view === "progress") {
    return (
      <Suspense fallback={<PageShell />}>
        <ProgressScreen
          jobId={jobId}
          onComplete={handleComplete}
          onFailed={handleFailed}
        />
      </Suspense>
    );
  }

  if (view === "results") {
    return (
      <Suspense fallback={<PageShell />}>
        <ResultsPage
          results={results}
          jobId={jobId}
          mode={mode}
          onBack={handleBack}
          validationWarnings={csvWarnings}
        />
      </Suspense>
    );
  }

  // Mode not yet chosen — show landing question
  if (mode === null) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#080e1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
      }}>
        <div style={{ textAlign: "center", maxWidth: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", justifyContent: "center", marginBottom: "0.4rem" }}>
            <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 800, color: "#e0eaf8", letterSpacing: "-0.025em" }}>
              flex<span style={{ color: "#00c8e8" }}>iq</span>
            </h1>
            <span style={{
              fontSize: "0.62rem", fontWeight: 700, color: "#00c8e8",
              background: "rgba(0,200,232,0.1)", border: "1px solid rgba(0,200,232,0.25)",
              borderRadius: 3, padding: "0.12rem 0.4rem", letterSpacing: "0.1em", textTransform: "uppercase",
            }}>BETA</span>
          </div>
          <p style={{ margin: "0 0 2.5rem", color: "#4a6b8c", fontSize: "0.9rem" }}>
            BTM BESS dispatch optimisation
          </p>
          <p style={{ margin: "0 0 1.5rem", color: "#7ba0c8", fontSize: "1.05rem", fontWeight: 600 }}>
            Do you have site meter data?
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <button
              onClick={() => handleModeChange("csv")}
              style={{
                padding: "0.85rem 1.75rem",
                border: "1px solid rgba(0,200,232,0.4)",
                borderRadius: 8,
                background: "rgba(0,200,232,0.08)",
                color: "#00c8e8",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Upload CSV
            </button>
            <button
              onClick={() => handleModeChange("archetype")}
              style={{
                padding: "0.85rem 1.75rem",
                border: "1px solid #1e3352",
                borderRadius: 8,
                background: "#0f1928",
                color: "#7ba0c8",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Use archetypes
            </button>
          </div>
          <p style={{ margin: "1.5rem 0 0", color: "#2a4772", fontSize: "0.78rem" }}>
            CSV: your real half-hourly meter data · Archetypes: representative I&amp;C demand profiles
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Slim mode indicator bar */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "#060d16",
        borderBottom: "1px solid #1e3352",
        display: "flex",
        alignItems: "center",
        padding: "0 1.5rem",
        gap: "1rem",
        minHeight: 40,
      }}>
        <span style={{ fontSize: "0.75rem", color: "#2a4772" }}>
          Mode: <span style={{ color: mode === "csv" ? "#00c8e8" : "#7ba0c8", fontWeight: 700 }}>
            {mode === "csv" ? "CSV Upload" : "Archetypes"}
          </span>
        </span>
        <button
          onClick={() => handleModeChange(null)}
          style={{
            background: "none",
            border: "none",
            color: "#2a4772",
            fontSize: "0.72rem",
            cursor: "pointer",
            padding: "0.15rem 0",
            textDecoration: "underline",
          }}
        >
          change
        </button>
      </div>

      <Suspense fallback={<PageShell />}>
        {mode === "archetype" ? (
          <ConfigPage onRunStarted={handleRunStarted} jobError={runError} />
        ) : (
          <CsvConfigPage onRunStarted={handleRunStarted} jobError={runError} />
        )}
      </Suspense>
    </>
  );
}
