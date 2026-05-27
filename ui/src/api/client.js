const API_BASE_URL = "https://flexiq-5eo2.onrender.com";

export async function getArchetypes() {
  const res = await fetch(`${API_BASE_URL}/archetypes`);
  if (!res.ok) throw new Error("Failed to fetch archetypes");
  return res.json();
}

export async function getScenarioOptions() {
  const res = await fetch(`${API_BASE_URL}/scenarios/options`);
  if (!res.ok) throw new Error("Failed to fetch scenario options");
  return res.json();
}

export async function postRun(payload) {
  const res = await fetch(`${API_BASE_URL}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to start run");
  return res.json();
}

export async function getRunStatus(jobId) {
  const res = await fetch(`${API_BASE_URL}/run/${jobId}`);
  if (!res.ok) throw new Error("Failed to fetch run status");
  return res.json();
}

export async function postRunCsv(formData) {
  const res = await fetch(`${API_BASE_URL}/run/csv`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    let detail = "Failed to start CSV run";
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export async function getDnoRates(dno, voltage) {
  const res = await fetch(`${API_BASE_URL}/duos-rates/${encodeURIComponent(dno)}/${encodeURIComponent(voltage)}`);
  if (!res.ok) throw new Error("Failed to fetch DNO rates");
  return res.json();
}

export function getExportUrl(jobId) {
  return `${API_BASE_URL}/export/${jobId}`;
}
