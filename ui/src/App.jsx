import { useState } from "react";
import ConfigPage from "./pages/ConfigPage";
import ProgressScreen from "./pages/ProgressScreen";
import ResultsPage from "./pages/ResultsPage";

export default function App() {
  const [view, setView] = useState("config");
  const [jobId, setJobId] = useState(null);
  const [results, setResults] = useState(null);
  const [runError, setRunError] = useState(null);

  function handleRunStarted(id) {
    setJobId(id);
    setResults(null);
    setRunError(null);
    setView("progress");
  }

  function handleComplete(payload) {
    setResults(payload);
    setView("results");
  }

  function handleFailed(errorMsg) {
    setRunError(errorMsg);
    setView("config");
  }

  function handleBack() {
    setView("config");
    setRunError(null);
  }

  if (view === "progress") {
    return (
      <ProgressScreen
        jobId={jobId}
        onComplete={handleComplete}
        onFailed={handleFailed}
      />
    );
  }

  if (view === "results") {
    return (
      <ResultsPage
        results={results}
        jobId={jobId}
        onBack={handleBack}
      />
    );
  }

  return <ConfigPage onRunStarted={handleRunStarted} jobError={runError} />;
}
