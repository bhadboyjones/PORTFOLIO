// Pure calculations behind the results page. No React, no charts:
// everything here is unit-tested in src/lib/__tests__.
import { gbp, num, count } from "../format";
import { sizeLabel } from "../hooks/useInvestment";

// ── Annual site bill, without vs with the battery ─────────────────────
// Scaled by `annual` (365 / days of data). Perfect-foresight backtest after
// wear: net with = net without − net settlement.
export function billRows(s, annual) {
  const k = annual;
  const rows = [
    {
      part: "Imports",
      without: s.baseline_import_cost_gbp * k,
      with: (s.baseline_import_cost_gbp - s.dis1_saving_gbp + s.charge2_cost_gbp) * k,
    },
  ];
  const exportWo = s.baseline_export_rev_gbp;
  const exportW = s.baseline_export_rev_gbp + s.dis2_revenue_gbp - s.charge1_opp_cost_gbp;
  if (Math.abs(exportWo) > 0.5 || Math.abs(exportW) > 0.5) {
    rows.push({ part: "Export", without: exportWo * k, with: exportW * k });
  }
  if ((s.baseline_thermal_cost_gbp ?? 0) > 0.5) {
    rows.push({ part: "Fuel", without: s.baseline_thermal_cost_gbp * k, with: s.baseline_thermal_cost_gbp * k });
  }
  rows.push({ part: "Standing", without: s.total_standing_gbp * k, with: s.total_standing_gbp * k });
  rows.push({ part: "Wear", without: 0, with: (s.deg_cost_gbp ?? 0) * k });
  rows.push({ part: "Net bill", without: s.site_cost_wo_bess_gbp * k, with: s.site_cost_w_bess_gbp * k });
  for (const r of rows) {
    r.change = Math.abs(r.without) > 0.5 ? ((r.with - r.without) / Math.abs(r.without)) * 100 : null;
    r.changeLabel = r.change == null ? (r.with > 0.5 ? "new" : "") : `${num(r.change, 0, { sign: true })}%`;
  }
  return rows;
}

// ── Average day ───────────────────────────────────────────────────────
// Average discharge and charge (MW) by time of day over every day in the data.
export const hhmm = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function averageDay(ts) {
  const slots = new Map();
  for (const r of ts) {
    const t = r.startTime?.slice(11, 16);
    if (!t) continue;
    const [h, m] = t.split(":").map(Number);
    const mins = h * 60 + m;
    const e = slots.get(mins) || { mins, n: 0, dis: 0, chg: 0 };
    e.n += 1;
    e.dis += (r.dis1_mw ?? 0) + (r.dis2_mw ?? 0);
    e.chg += (r.charge1_mw ?? 0) + (r.charge2_mw ?? 0);
    slots.set(mins, e);
  }
  return [...slots.values()]
    .sort((a, b) => a.mins - b.mins)
    .map((e) => ({ time: hhmm(e.mins), mins: e.mins, net: (e.dis - e.chg) / e.n, discharge: e.dis / e.n, charge: e.chg / e.n }));
}

// Contiguous runs of the same DUoS band, in minutes of the day.
export function bandRuns(bands) {
  // contiguous runs of the same band, in minutes of the day
  const step = 1440 / bands.length;
  const runs = [];
  bands.forEach((b, i) => {
    const last = runs[runs.length - 1];
    if (last && last.band === b) last.end = (i + 1) * step;
    else runs.push({ band: b, start: i * step, end: (i + 1) * step });
  });
  return runs;
}

// ── Daily series ──────────────────────────────────────────────────────
export function aggregateDaily(timeseries) {
  const byDate = {};
  for (const row of timeseries) {
    if (!row.startTime) continue;
    const date = row.startTime.slice(0, 10);
    if (!byDate[date]) byDate[date] = { date, demand: 0, export: 0, gridCharge: 0, surplus: 0, wear: 0 };
    const d = byDate[date];
    d.demand     += row.dis1_saving_gbp      ?? 0;
    d.export     += row.dis2_revenue_gbp     ?? 0;
    d.gridCharge -= row.charge2_cost_gbp     ?? 0;
    d.surplus    -= row.charge1_opp_cost_gbp ?? 0;
    d.wear       -= row.deg_cost_gbp         ?? 0;
  }
  return Object.values(byDate)
    .map((d) => ({ ...d, net: d.demand + d.export + d.gridCharge + d.surplus + d.wear }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function dailyCumulative(timeseries) {
  const byDate = {};
  for (const row of timeseries) {
    if (!row.startTime) continue;
    byDate[row.startTime.slice(0, 10)] = row.cumulative_pnl_gbp;
  }
  return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, cumulative]) => ({ date, cumulative }));
}

// ── Results page helpers ──────────────────────────────────────────────
export const labelOf = (s) => `${sizeLabel(s)}, ${num(s.export_limit_mw, s.export_limit_mw % 1 ? 1 : 0)} MW export`;

// Days of data actually covered: rows × interval. CSV runs send it; archetype
// runs don't, so derive it from the timeseries the same way.
export function coverageDays(dataPeriod, scenarios) {
  if (dataPeriod?.coverage_days) return dataPeriod.coverage_days;
  const ts = scenarios[0]?.dispatch_timeseries ?? [];
  if (ts.length < 2) return null;
  const step = (new Date(ts[1].startTime.replace(" ", "T")) - new Date(ts[0].startTime.replace(" ", "T"))) / 3.6e6;
  return step > 0 ? (ts.length * step) / 24 : null;
}

/** The title-row sentence that answers "does a battery pay, and which size?" */
export function finding(best, inv, lifetime) {
  if (!best || !inv) return null;
  const name = labelOf(best);
  if (inv.npv_gbp >= 0) {
    return inv.payback_yrs != null
      ? `${name} pays back in ${count(inv.payback_yrs, "year", 1)}, with an NPV of ${gbp(inv.npv_gbp)}.`
      : `${name} has the best NPV, ${gbp(inv.npv_gbp)}.`;
  }
  return `No size pays back over ${count(lifetime, "year")} at these assumptions. The closest, ${name}, has an NPV of ${gbp(inv.npv_gbp)}.`;
}

// ── Axis ticks ────────────────────────────────────────────────────────
const NICE = [1, 2, 2.5, 5, 10];

/** Smallest "nice" number (1, 2, 2.5, 5 × 10^n) at or above x. */
export function niceCeil(x) {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  return NICE.find((n) => n * p >= x - 1e-12) * p;
}

/**
 * Ticks on whole steps for an axis from `min` to `max` (`count` intervals),
 * with the decimals each label needs. Symmetric axes pass min = −max.
 */
export function niceTicks(min, max, count = 4) {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max) > lo ? Math.max(0, max) : lo + 1; // all-zero data still gets an axis
  const span = hi - lo;
  const step = niceCeil(span / count);
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  const decimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (String(step / 10 ** Math.floor(Math.log10(step))).includes(".") ? 1 : 0));
  return { ticks, domain: [ticks[0], ticks[ticks.length - 1]], decimals };
}

/** "2MW / 1MWh | Export 0 MW" (backend progress label) → "2 MW / 1 MWh, 0 MW export". */
export function progressLabel(raw) {
  const m = /([\d.]+)\s*MW\s*\/\s*([\d.]+)\s*MWh\s*\|\s*Export\s*([\d.]+)\s*MW/i.exec(raw || "");
  return m ? `${m[1]} MW / ${m[2]} MWh, ${m[3]} MW export` : raw;
}
