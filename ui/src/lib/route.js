// Hash routes, so every screen has a URL and Back/refresh behave.
//   #/                 landing
//   #/upload           site meter data form
//   #/archetype        archetype form
//   #/run/<jobId>      progress
//   #/results/<jobId>  results

const JOB = /^[A-Za-z0-9_-]{1,64}$/;

export function parseHash(hash) {
  const path = (hash || "").replace(/^#/, "").replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { view: "landing" };
  if (parts.length === 1 && parts[0] === "upload") return { view: "config", mode: "csv" };
  if (parts.length === 1 && parts[0] === "archetype") return { view: "config", mode: "archetype" };
  if (parts.length === 2 && (parts[0] === "run" || parts[0] === "results") && JOB.test(parts[1])) {
    return { view: parts[0] === "run" ? "progress" : "results", jobId: parts[1] };
  }
  return { view: "landing" };
}

export function formatHash(route) {
  switch (route.view) {
    case "config":   return route.mode === "archetype" ? "#/archetype" : "#/upload";
    case "progress": return `#/run/${route.jobId}`;
    case "results":  return `#/results/${route.jobId}`;
    default:         return "#/";
  }
}

/** Push a new history entry (Back returns here), or replace the current one. */
export function navigate(route, { replace = false } = {}) {
  const hash = formatHash(route);
  if (window.location.hash === hash) return;
  if (replace) {
    window.history.replaceState(null, "", hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = hash;
  }
}
