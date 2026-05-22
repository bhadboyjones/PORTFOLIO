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

export function getExportUrl(jobId) {
  return `${API_BASE_URL}/export/${jobId}`;
}
