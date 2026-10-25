// Browser-side read of an uploaded CSV, echoed before the run.
// Accepts any File-like object with `name` and `text()`.

export async function parseCsvMeta(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { rows: null, headers: [], dateRange: null, resolution: null };
  }
  try {
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return { rows: 0, headers: [], dateRange: null, resolution: null };
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const rows = lines.length - 1;
    const tsIdx = headers.indexOf("timestamp");
    let dateRange = null;
    let resolution = null;
    if (tsIdx >= 0) {
      const firstTs = (lines[1].split(",")[tsIdx] || "").replace(/^"|"$/g, "").trim();
      const lastTs = (lines[lines.length - 1].split(",")[tsIdx] || "").replace(/^"|"$/g, "").trim();
      if (firstTs && lastTs) {
        dateRange = { start: firstTs.slice(0, 10), end: lastTs.slice(0, 10) };
      }
      if (lines.length >= 3 && firstTs) {
        const secondTs = (lines[2].split(",")[tsIdx] || "").replace(/^"|"$/g, "").trim();
        if (secondTs) {
          const gapMin = (new Date(secondTs) - new Date(firstTs)) / 60000;
          if (gapMin === 30) {
            resolution = { label: "30-minute (48 intervals/day)", valid: true };
          } else if (gapMin === 60) {
            resolution = { label: "Hourly (24 intervals/day)", valid: true };
          } else {
            resolution = { label: `Unsupported interval (${gapMin} min). flexiq accepts 30-min or hourly only`, valid: false };
          }
        }
      }
    }
    // Coverage and gaps from every timestamp; peak import in the file's own
    // unit (converted for display once the unit is known).
    let gaps = null, coverageDays = null, intervalMin = null, peakRaw = null;
    const ndIdx = headers.indexOf("net_demand_mw");
    if (tsIdx >= 0) {
      const times = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(",");
        const t = new Date((cells[tsIdx] || "").replace(/^"|"$/g, "").trim()).getTime();
        if (!Number.isNaN(t)) times.push(t);
        if (ndIdx >= 0) {
          const v = parseFloat(cells[ndIdx]);
          if (Number.isFinite(v) && (peakRaw == null || v > peakRaw)) peakRaw = v;
        }
      }
      times.sort((a, b) => a - b);
      if (times.length >= 2) {
        intervalMin = (times[1] - times[0]) / 60000;
        if (intervalMin > 0) {
          const expected = Math.round((times[times.length - 1] - times[0]) / (intervalMin * 60000)) + 1;
          const unique = new Set(times).size;
          gaps = Math.max(0, expected - unique);
          coverageDays = (unique * intervalMin) / 1440;
        }
      }
    }
    return { rows, headers, dateRange, resolution, gaps, coverageDays, intervalMin, peakRaw };
  } catch {
    return { rows: null, headers: [], dateRange: null, resolution: null };
  }
}

/** Peak import in kW, given the unit the user says the file is in. */
export function peakKw(meta, inputUnit) {
  if (meta?.peakRaw == null || !meta.intervalMin) return null;
  const h = meta.intervalMin / 60;
  const v = { mw: meta.peakRaw * 1000, kw: meta.peakRaw, mwh: (meta.peakRaw / h) * 1000, kwh: meta.peakRaw / h }[inputUnit];
  return v ?? null;
}
