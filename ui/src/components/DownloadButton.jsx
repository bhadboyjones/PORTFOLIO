import { useState } from "react";
import { getExportUrl } from "../api/client";

// The page's one primary action: the full XLSX report.
export default function DownloadButton({ jobId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getExportUrl(jobId));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flexiq-scenarios.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ textAlign: "right" }}>
      <button className="btn-primary" onClick={handleDownload} disabled={loading} aria-busy={loading} style={{ minWidth: 196 }}>
        {loading ? "Preparing report…" : "Download XLSX report"}
      </button>
      {error && (
        <p role="alert" style={{ margin: "6px 0 0", fontSize: 14, color: "var(--negative)" }}>
          Download failed: {error}. Try again, or start a new run if the results expired.
        </p>
      )}
    </div>
  );
}
