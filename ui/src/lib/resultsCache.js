// Completed results kept in the browser (IndexedDB), so a refresh or a
// sleeping server doesn't lose them. Newest KEEP runs are kept. Every call
// fails soft: private windows and blocked storage just mean no cache.

const DB = "flexiq";
const STORE = "results";
export const KEEP = 5;

/** Job ids to delete so only the newest `keep` entries remain. */
export function pickPrune(entries, keep = KEEP) {
  return [...entries]
    .sort((a, b) => b.savedAt - a.savedAt)
    .slice(keep)
    .map((e) => e.jobId);
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "jobId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result);
    t.onerror = () => reject(t.error);
  });
}

/** entry: { jobId, results, warnings, dataPeriod, bands, runInputs, mode } */
export async function saveResults(entry) {
  try {
    const db = await openDb();
    await tx(db, "readwrite", (s) => s.put({ ...entry, savedAt: Date.now() }));
    const all = await tx(db, "readonly", (s) => s.getAll());
    const drop = pickPrune(all);
    if (drop.length) await tx(db, "readwrite", (s) => drop.forEach((id) => s.delete(id)));
    db.close();
  } catch {
    // no cache available: results still show for this session
  }
}

export async function loadResults(jobId) {
  try {
    const db = await openDb();
    const entry = await tx(db, "readonly", (s) => s.get(jobId));
    db.close();
    return entry ?? null;
  } catch {
    return null;
  }
}
