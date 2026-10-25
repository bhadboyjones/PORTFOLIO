import { useState, lazy, Suspense } from "react";
import LandingPage from "./pages/LandingPage";
import TopBar from "./components/TopBar";

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
  const [csvBands, setCsvBands] = useState(null);
  const [runInputs, setRunInputs] = useState(null);

  function handleModeChange(m) {
    setMode(m);
    setResults(null);
    setRunError(null);
    setJobId(null);
    setCsvWarnings(null);
    setDataPeriod(null);
    setCsvBands(null);
  }

  function handleRunStarted(id, bands, inputs) {
    setJobId(id);
    setResults(null);
    setRunError(null);
    setCsvWarnings(null);
    setDataPeriod(null);
    setCsvBands(bands ?? null);
    setRunInputs(inputs ?? null);
    setView("progress");
  }

  function handleComplete(payload, warns, period) {
    // CSV mode returns { csv_run: [...] }; normalise to the archetype shape
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

  const changeSource = (
    <button className="btn-text" onClick={() => handleModeChange(null)}>
      Change data source
    </button>
  );

  let content;
  let step = null;
  let action = null;

  if (view === "progress") {
    step = "Running";
    content = (
      <ProgressScreen
        jobId={jobId}
        onComplete={handleComplete}
        onFailed={handleFailed}
      />
    );
  } else if (view === "results") {
    step = "Results";
    action = <button className="btn-secondary" onClick={handleBack}>New run</button>;
    content = (
      <ResultsPage
        results={results}
        jobId={jobId}
        mode={mode}
        onBack={handleBack}
        validationWarnings={csvWarnings}
        dataPeriod={dataPeriod}
        bands={csvBands}
        runInputs={runInputs}
      />
    );
  } else if (mode === null) {
    content = <LandingPage onSelectMode={handleModeChange} />;
  } else {
    step = mode === "csv" ? "Site meter data" : "Archetype sites";
    action = changeSource;
    content = mode === "archetype"
      ? <ConfigPage onRunStarted={handleRunStarted} jobError={runError} />
      : <CsvConfigPage onRunStarted={handleRunStarted} jobError={runError} />;
  }

  return (
    <>
      <TopBar step={step} action={action} />
      <main id="main">
        <Suspense fallback={<PageShell />}>{content}</Suspense>
      </main>
    </>
  );
}
