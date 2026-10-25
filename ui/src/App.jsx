import { useEffect, useState, lazy, Suspense } from "react";
import LandingPage from "./pages/LandingPage";
import TopBar from "./components/TopBar";
import { parseHash, navigate } from "./lib/route";
import { saveResults, loadResults } from "./lib/resultsCache";
import { getRunStatus } from "./api/client";

const ConfigPage     = lazy(() => import("./pages/ConfigPage"));
const CsvConfigPage  = lazy(() => import("./pages/CsvConfigPage"));
const ProgressScreen = lazy(() => import("./pages/ProgressScreen"));
const ResultsPage    = lazy(() => import("./pages/ResultsPage"));

const PageShell = () => <div style={{ minHeight: "60vh" }} />;

// CSV runs return { csv_run: [...] }; normalise to the archetype shape.
function normalise(payload) {
  if (payload?.csv_run) return { results: { "CSV Upload": payload.csv_run }, mode: "csv" };
  return { results: payload, mode: "archetype" };
}

function useRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export default function App() {
  const route = useRoute();
  const [run, setRun]         = useState(null);   // the results on screen
  const [pending, setPending] = useState(null);   // inputs of the run in progress
  const [runError, setRunError] = useState(null);
  const [loadState, setLoadState] = useState("idle"); // results: loading | expired
  // Config pages stay mounted once opened, so Back keeps the file and settings.
  const [opened, setOpened] = useState(() => new Set());

  useEffect(() => {
    if (route.view === "config" && !opened.has(route.mode)) {
      setOpened((s) => new Set(s).add(route.mode));
    }
  }, [route, opened]);

  // Results by URL: memory, then this browser's cache, then the server.
  useEffect(() => {
    if (route.view !== "results" || run?.jobId === route.jobId) return;
    let cancelled = false;
    setLoadState("loading");
    (async () => {
      const cached = await loadResults(route.jobId);
      if (cancelled) return;
      if (cached) { setRun(cached); setLoadState("idle"); return; }
      try {
        const data = await getRunStatus(route.jobId);
        if (cancelled) return;
        if (data.status === "complete" && data.results) {
          const { results, mode } = normalise(data.results);
          const entry = { jobId: route.jobId, results, mode, warnings: data.validation_warnings ?? null, dataPeriod: data.data_period ?? null, bands: null, runInputs: null };
          setRun(entry);
          saveResults(entry);
          setLoadState("idle");
          return;
        }
        if (data.status === "running" || data.status === "pending") {
          navigate({ view: "progress", jobId: route.jobId }, { replace: true });
          return;
        }
      } catch {
        // not on the server either
      }
      if (!cancelled) setLoadState("expired");
    })();
    return () => { cancelled = true; };
  }, [route, run]);

  function handleRunStarted(jobId, bands, runInputs, mode) {
    setRunError(null);
    setPending({ jobId, bands: bands ?? null, runInputs: runInputs ?? null, mode });
    navigate({ view: "progress", jobId });
  }

  function handleComplete(jobId, payload, warns, period) {
    const { results, mode } = normalise(payload);
    const p = pending?.jobId === jobId ? pending : null;
    const entry = {
      jobId, results, mode,
      warnings: warns && warns.length ? warns : null,
      dataPeriod: period ?? null,
      bands: p?.bands ?? null,
      runInputs: p?.runInputs ?? null,
    };
    setRun(entry);
    saveResults(entry);
    // Replace the progress entry so Back from results returns to the form.
    navigate({ view: "results", jobId }, { replace: true });
  }

  function handleFailed(msg) {
    setRunError(msg);
    navigate({ view: "config", mode: pending?.mode ?? "csv" }, { replace: true });
  }

  let content = null;
  let step = null;
  let action = null;
  const changeSource = (
    <button className="btn-text" onClick={() => navigate({ view: "landing" })}>Change data source</button>
  );

  if (route.view === "progress") {
    step = "Running";
    content = (
      <ProgressScreen
        key={route.jobId}
        jobId={route.jobId}
        onComplete={(payload, warns, period) => handleComplete(route.jobId, payload, warns, period)}
        onFailed={handleFailed}
      />
    );
  } else if (route.view === "results") {
    step = "Results";
    const shown = run?.jobId === route.jobId ? run : null;
    action = (
      <button className="btn-secondary" onClick={() => navigate({ view: "config", mode: shown?.mode ?? "csv" })}>
        New run
      </button>
    );
    content = shown ? (
      <ResultsPage
        key={shown.jobId}
        results={shown.results}
        jobId={shown.jobId}
        mode={shown.mode}
        validationWarnings={shown.warnings}
        dataPeriod={shown.dataPeriod}
        bands={shown.bands}
        runInputs={shown.runInputs}
      />
    ) : loadState === "expired" ? (
      <Expired />
    ) : (
      <p style={{ maxWidth: 640, margin: "36px auto", padding: "0 24px", color: "var(--muted)" }} aria-live="polite">Loading results…</p>
    );
  } else if (route.view === "landing") {
    content = <LandingPage onSelectMode={(m) => navigate({ view: "config", mode: m })} />;
  } else if (route.view === "config") {
    step = route.mode === "csv" ? "Site meter data" : "Archetype sites";
    action = changeSource;
  }

  const showConfig = route.view === "config";
  return (
    <>
      <TopBar step={step} action={action} />
      <main id="main">
        <Suspense fallback={<PageShell />}>
          {content}
          {opened.has("csv") && (
            <div hidden={!(showConfig && route.mode === "csv")}>
              <CsvConfigPage
                onRunStarted={(id, bands, inputs) => handleRunStarted(id, bands, inputs, "csv")}
                jobError={showConfig && route.mode === "csv" ? runError : null}
              />
            </div>
          )}
          {opened.has("archetype") && (
            <div hidden={!(showConfig && route.mode === "archetype")}>
              <ConfigPage
                onRunStarted={(id) => handleRunStarted(id, null, null, "archetype")}
                jobError={showConfig && route.mode === "archetype" ? runError : null}
              />
            </div>
          )}
        </Suspense>
      </main>
    </>
  );
}

function Expired() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 24px" }}>
      <h1 style={{ margin: 0, fontSize: "var(--fs-title)", lineHeight: "32px", fontWeight: 700 }}>These results have expired</h1>
      <p style={{ margin: "8px 0 24px", fontSize: 16, lineHeight: "24px", color: "var(--muted)" }}>
        They are no longer on the server, which keeps recent runs only until it restarts, and
        this browser has no saved copy. Run the appraisal again to get them back.
      </p>
      <button className="btn-primary" onClick={() => navigate({ view: "config", mode: "csv" })}>Start a new run</button>
    </div>
  );
}
