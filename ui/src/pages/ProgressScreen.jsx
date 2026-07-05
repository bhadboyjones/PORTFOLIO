import { useEffect, useState } from "react";
import { getRunStatus } from "../api/client";
import ProgressBar from "../components/ProgressBar";
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
          // hold at 100% so the battery-full pulse is visible before results
          setStatus({ ...data, progress_pct: 100 });
          setTimeout(() => {
            if (!cancelled) onComplete(data.results, data.validation_warnings ?? null, data.data_period ?? null);
          }, reduced ? 0 : 700);
          return;
        }
        if (data.status === "failed")   { onFailed(data.error || "Run failed — unknown error."); return; }
        setTimeout(poll, 3000);
      } catch {
        if (cancelled) return;
        failures += 1;
        if (failures >= MAX_FAILURES) {
          onFailed(`Lost connection to API server after ${MAX_FAILURES} attempts. The job may still be running — job ID: ${jobId}`);
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
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      background: "var(--bg-base)",
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-pri)", letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>
            flex<span style={{ color: "var(--accent)" }}>iq</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            BTM BESS Optimiser
          </div>
        </div>

        {/* Pulse indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.75rem" }}>
          <div
            className="pulse-dot"
            style={{
              width: 10, height: 10, borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 10px rgba(0,200,232,0.5)",
              flexShrink: 0,
            }}
          />
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-pri)" }}>
            {isBuilding ? "Building report…" : "Running optimisation…"}
          </h2>
        </div>

        <ProgressBar pct={pct} />

        <div style={{ marginTop: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p style={{ margin: 0, color: "var(--text-sec)", fontSize: "0.875rem" }}>
            {total > 0
              ? `${complete} of ${total} scenario${total !== 1 ? "s" : ""} complete`
              : "Initialising…"}
          </p>
          {isBuilding && (
            <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>Writing XLSX…</span>
          )}
        </div>

        {current && !isBuilding && (
          <div style={{
            marginTop: "1rem",
            padding: "0.6rem 0.9rem",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: "0.78rem",
            color: "var(--text-dim)",
            fontFamily: "monospace",
          }}>
            {current}
          </div>
        )}

        {csvWarns?.length > 0 && (
          <div style={{
            marginTop: "1.25rem",
            padding: "0.75rem 1rem",
            background: "rgba(255,176,58,0.07)",
            border: "1px solid rgba(255,176,58,0.25)",
            borderRadius: 6,
          }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--warn)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>
              Validation warnings
            </div>
            {csvWarns.map((w, i) => (
              <div key={i} style={{ fontSize: "0.78rem", color: "var(--warn)", marginTop: i > 0 ? "0.25rem" : 0 }}>
                {w}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
