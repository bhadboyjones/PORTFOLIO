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
          padding: "0.65rem 1.5rem",
          fontSize: "0.9rem",
          fontWeight: 700,
          border: "none",
          borderRadius: 6,
          cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "#d1d5db" : "#16a34a",
          color: "#fff",
          transition: "background 0.15s",
        }}
      >
        {loading ? "Generating…" : "Download Full Report (XLSX)"}
      </button>
      {error && (
        <div style={{ marginTop: "0.5rem", color: "#dc2626", fontSize: "0.8rem" }}>
          {error}
        </div>
      )}
    </div>
  );
}
