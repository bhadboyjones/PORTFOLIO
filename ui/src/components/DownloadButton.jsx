import { useState } from "react";
import { getExportUrl } from "../api/client";

export default function DownloadButton({ jobId }) {
  const [loading, setLoading] = useState(false);
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
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleDownload}
        disabled={loading}
        style={{
          padding: "0.65rem 1.75rem",
          fontSize: "0.85rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          border: loading ? "1px solid #1e3352" : "1px solid rgba(0,229,160,0.4)",
          borderRadius: 6,
          cursor: loading ? "not-allowed" : "pointer",
          background: loading
            ? "#0f1928"
            : "linear-gradient(135deg, #00e5a0 0%, #00c896 100%)",
          color: loading ? "#4a6b8c" : "#080e1a",
          boxShadow: loading ? "none" : "0 0 16px rgba(0,229,160,0.2)",
          transition: "all 0.2s ease",
        }}
      >
        {loading ? "Generating…" : "Download Report (XLSX)"}
      </button>
      {error && (
        <div style={{ marginTop: "0.5rem", color: "#ff5577", fontSize: "0.8rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
