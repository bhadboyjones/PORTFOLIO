import { useState } from "react";
import { getExportUrl } from "../api/client";

export default function DownloadButton({ jobId }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const url = getExportUrl(jobId);
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "bess_scenarios.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        className="lift"
        onClick={handleDownload}
        disabled={loading}
        style={{
          padding: "0.65rem 1.75rem",
          fontSize: "0.85rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          border: loading ? "1px solid var(--border)" : "1px solid rgba(0,229,160,0.4)",
          borderRadius: 6,
          cursor: loading ? "not-allowed" : "pointer",
          background: loading
            ? "var(--bg-surface)"
            : "linear-gradient(135deg, var(--positive) 0%, #00c896 100%)",
          color: loading ? "var(--text-dim)" : "var(--bg-base)",
          boxShadow: loading ? "none" : "0 0 16px rgba(0,229,160,0.2)",
        }}
      >
        {loading ? "Generating…" : done ? "✓ Report downloaded" : "Download Report (XLSX)"}
      </button>
      {error && (
        <div style={{ marginTop: "0.5rem", color: "var(--negative)", fontSize: "0.8rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
