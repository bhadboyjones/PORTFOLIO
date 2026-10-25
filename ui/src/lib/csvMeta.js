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
    const abs = [];
    let absMaxRaw = null, absMaxTs = null;
    const ndIdx = headers.indexOf("net_demand_mw");
    if (tsIdx >= 0) {
      const times = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(",");
        const t = new Date((cells[tsIdx] || "").replace(/^"|"$/g, "").trim()).getTime();
        if (!Number.isNaN(t)) times.push(t);
        if (ndIdx >= 0) {
          const v = parseFloat(cells[ndIdx]);
          if (Number.isFinite(v)) {
            if (peakRaw == null || v > peakRaw) peakRaw = v;
            const a = Math.abs(v);
            abs.push(a);
            if (absMaxRaw == null || a > absMaxRaw) { absMaxRaw = a; absMaxTs = (cells[tsIdx] || "").replace(/^"|"$/g, "").trim(); }
          }
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
    abs.sort((a, b) => a - b);
    const p99AbsRaw = abs.length ? abs[Math.min(abs.length - 1, Math.floor(0.99 * (abs.length - 1)))] : null;
    return { rows, headers, dateRange, resolution, gaps, coverageDays, intervalMin, peakRaw, absMaxRaw, absMaxTs, p99AbsRaw };
  } catch {
    return { rows: null, headers: [], dateRange: null, resolution: null };
  }
}

/** Multiplier from the file's unit to kW (energy units need the interval). */
export function toKwFactor(inputUnit, intervalMin) {
  if (!intervalMin) return null;
  const h = intervalMin / 60;
  return { mw: 1000, kw: 1, mwh: 1000 / h, kwh: 1 / h }[inputUnit] ?? null;
}

/** Peak import in kW, given the unit the user says the file is in. */
export function peakKw(meta, inputUnit) {
  const f = toKwFactor(inputUnit, meta?.intervalMin);
  if (meta?.peakRaw == null || f == null) return null;
  return meta.peakRaw * f;
}

// Mirrors api/routes/run_csv.py _data_check, so the user sees the problem
// before uploading. The server checks again (XLSX files are only read there).
export const PLAUSIBLE_PEAK_KW = [5, 50000];
export const SPIKE_RATIO = 5;

const nf = (v) => Math.round(v).toLocaleString("en-GB");

/** @returns {{ code: "data_check" | "mic_required", text: string }[]} */
export function dataIssues(meta, inputUnit, micEntered) {
  const f = toKwFactor(inputUnit, meta?.intervalMin);
  if (!meta || f == null || meta.absMaxRaw == null) return [];
  const out = [];
  if (!micEntered && meta.peakRaw != null && meta.peakRaw <= 0) {
    out.push({ code: "mic_required", text: "This site never imports in the data, so its MIC can't be assumed. Enter the agreed import capacity below." });
  }
  const peak = meta.absMaxRaw * f;
  const p99 = (meta.p99AbsRaw ?? 0) * f;
  const [lo, hi] = PLAUSIBLE_PEAK_KW;
  if (p99 > 0 && peak > SPIKE_RATIO * p99) {
    out.push({ code: "data_check", text: `One reading (${nf(peak)} kW${meta.absMaxTs ? ` at ${meta.absMaxTs}` : ""}) is more than ${SPIKE_RATIO} times the site's usual peak (${nf(p99)} kW). It looks like a meter error and would distort the MIC and the bill.` });
  } else if (peak < lo || peak > hi) {
    out.push({ code: "data_check", text: `The largest reading is ${nf(peak)} kW in the selected unit, outside the ${nf(lo)} to ${nf(hi)} kW a C&I site normally sits in. Check the unit above.` });
  }
  return out;
}
