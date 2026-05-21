import { useEffect, useState } from "react";
import { getRunStatus } from "../api/client";
import ProgressBar from "../components/ProgressBar";

export default function ProgressScreen({ jobId, onComplete, onFailed }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await getRunStatus(jobId);
        if (cancelled) return;

        setStatus(data);

        if (data.status === "complete") {
          onComplete(data.results);
          return;
        }
        if (data.status === "failed") {
          onFailed(data.error || "Run failed — unknown error.");
          return;
        }

        setTimeout(poll, 3000);
      } catch (err) {
        if (!cancelled) onFailed("Lost connection to API server.");
      }
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const pct      = status?.progress_pct      ?? 0;
  const complete = status?.scenarios_complete ?? 0;
  const total    = status?.scenarios_total    ?? 0;
  const current  = status?.current_scenario   ?? null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "#f9fafb",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        <h2 style={{ marginBottom: "2rem", fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>
          Running scenarios…
        </h2>

        <ProgressBar pct={pct} />

        <p style={{ marginTop: "1rem", color: "#374151", fontSize: "0.9rem" }}>
          {total > 0
            ? `${complete} of ${total} scenario${total !== 1 ? "s" : ""} complete`
            : "Initialising…"}
        </p>

        {current && (
          <p style={{ color: "#6b7280", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Current: {current}
          </p>
        )}
      </div>
    </div>
  );
}
