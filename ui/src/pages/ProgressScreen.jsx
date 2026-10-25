import { useEffect, useState } from "react";
import { getRunStatus } from "../api/client";
import ProgressBar from "../components/ProgressBar";
import WarningsNotice from "../components/WarningsNotice";
import useReducedMotion from "../hooks/useReducedMotion";

export default function ProgressScreen({ jobId, onComplete, onFailed }) {
  const [status, setStatus] = useState(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    let failures = 0;
    const MAX_FAILURES = 5;  // tolerate transient blips before giving up

    async function poll() {
      try {
        const data = await getRunStatus(jobId);
        if (cancelled) return;
        failures = 0;
        setStatus(data);
        if (data.status === "complete") {
          // hold at 100% briefly so the finished bar is seen before results
          setStatus({ ...data, progress_pct: 100 });
          setTimeout(() => {
            if (!cancelled) onComplete(data.results, data.validation_warnings ?? null, data.data_period ?? null);
          }, reduced ? 0 : 400);
          return;
        }
        if (data.status === "failed")   { onFailed(data.error || "Run failed: unknown error.", data.error_code ?? null); return; }
        setTimeout(poll, 3000);
      } catch (e) {
        if (cancelled) return;
        if (e?.status === 404) {
          onFailed("This run is no longer on the server, which may have restarted. Run it again.");
          return;
        }
        failures += 1;
        if (failures >= MAX_FAILURES) {
          onFailed(`Lost connection to API server after ${MAX_FAILURES} attempts. The job may still be running. Job ID: ${jobId}`);
        } else {
          setTimeout(poll, 3000);  // keep polling; the job runs server-side
        }
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [jobId]);

  const pct        = status?.progress_pct        ?? 0;
  const complete   = status?.scenarios_complete  ?? 0;
  const total      = status?.scenarios_total     ?? 0;
  const current    = status?.current_scenario    ?? null;
  const csvWarns   = status?.validation_warnings ?? null;
  const isBuilding = pct === 99 && complete === total && total > 0;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 24px 64px" }}>
      <h1 style={{ margin: 0, fontSize: "var(--fs-title)", lineHeight: "32px", fontWeight: 700 }}>
        {isBuilding ? "Building the report" : "Running the optimisation"}
      </h1>
      <p style={{ margin: "4px 0 24px", color: "var(--muted)", fontSize: 16, lineHeight: "24px" }}>
        Each scenario is a full dispatch optimisation over your data. Larger files and more
        scenarios take longer.
      </p>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-card)", padding: 24 }}>
        <ProgressBar pct={pct} />
        <p aria-live="polite" style={{ margin: "16px 0 0", fontSize: 14 }}>
          {total > 0
            ? `${complete} of ${total} scenario${total !== 1 ? "s" : ""} complete${isBuilding ? ". Writing the XLSX report…" : ""}`
            : "Starting…"}
        </p>
        {current && !isBuilding && (
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--muted)" }}>
            Now: <span className="tnum">{current}</span>
          </p>
        )}
      </div>

      <WarningsNotice warnings={csvWarns} title="Check your data" style={{ marginTop: "var(--gap)" }} />
    </div>
  );
}
