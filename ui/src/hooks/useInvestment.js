import { useEffect, useMemo, useRef, useState } from "react";
import { postInvestmentEvaluate } from "../api/client";

// Investment assumptions. Defaults mirror api/schemas.py InvestmentAssumptions:
// placeholders to be replaced with real quotes, not market data.
export const INVESTMENT_FIELDS = [
  { key: "capex_gbp_per_kw",  label: "Capex per kW",      unit: "£/kW",  def: 150,  step: 10,   hint: "Inverter, switchgear, connection" },
  { key: "capex_gbp_per_kwh", label: "Capex per kWh",     unit: "£/kWh", def: 250,  step: 10,   hint: "Cells and racks, usually the largest share" },
  { key: "capex_fixed_gbp",   label: "Fixed capex",       unit: "£",     def: 0,    step: 5000, hint: "Site works and design, whatever the size" },
  { key: "opex_pct_of_capex", label: "Opex",              unit: "% of capex/yr", def: 1.5, step: 0.1, hint: "O&M, insurance, monitoring" },
  { key: "lifetime_yrs",      label: "Life",              unit: "years", def: 15,   step: 1,    hint: "Design life; warranties are often 10 years", int: true },
  { key: "discount_rate_pct", label: "Discount rate",     unit: "%/yr",  def: 8,    step: 0.5,  hint: "Nominal cost of capital or hurdle rate" },
  { key: "fade_pct_yr",       label: "Capacity fade",     unit: "%/yr",  def: 2.5,  step: 0.1,  hint: "Usable capacity lost each year" },
  { key: "escalation_pct_yr", label: "Price escalation",  unit: "%/yr",  def: 2,    step: 0.1,  hint: "Growth in savings and opex, nominal" },
  { key: "dispatch_efficiency_pct", label: "Dispatch efficiency", unit: "%", def: 85, step: 1, hint: "Share of the perfect-foresight saving a real operator keeps. 100% is the backtest ceiling." },
];

// Bounds mirror api/schemas.py InvestmentAssumptions, so a value the server
// would reject is caught here and the figures are marked stale instead.
const BOUNDS = {
  capex_gbp_per_kw: [0, 1e6], capex_gbp_per_kwh: [0, 1e6], capex_fixed_gbp: [0, 1e9],
  opex_pct_of_capex: [0, 10], lifetime_yrs: [1, 40], discount_rate_pct: [0, 30],
  fade_pct_yr: [0, 10], escalation_pct_yr: [-5, 15], dispatch_efficiency_pct: [0, 100],
};

/** { key: message } for every field the server would reject. */
export function validateAssumptions(form) {
  const errs = {};
  for (const f of INVESTMENT_FIELDS) {
    const raw = String(form[f.key] ?? "").trim();
    const v = Number(raw);
    const [lo, hi] = BOUNDS[f.key];
    if (raw === "" || !Number.isFinite(v)) errs[f.key] = "Enter a number";
    else if (f.int && !Number.isInteger(v)) errs[f.key] = "Whole years only";
    else if (v < lo || v > hi) errs[f.key] = `Between ${lo.toLocaleString("en-GB")} and ${hi.toLocaleString("en-GB")}`;
  }
  return errs;
}

export const defaultInvestmentForm = () =>
  Object.fromEntries(INVESTMENT_FIELDS.map((f) => [f.key, String(f.def)]));

// Backend sends power_mw/capacity_mwh (new runs); fall back to the label.
export function scenarioDims(s) {
  if (s.power_mw != null && s.capacity_mwh != null) {
    return { power_mw: s.power_mw, capacity_mwh: s.capacity_mwh };
  }
  const label = s.scenario_label || "";
  const m = /([\d.]+)\s*MW\s*\/\s*([\d.]+)\s*MWh/.exec(label);
  if (m) return { power_mw: +m[1], capacity_mwh: +m[2] };
  // Archetype runs label scenarios as power and duration: "1MW_2h".
  const a = /([\d.]+)\s*MW_([\d.]+)\s*h/i.exec(label);
  return a ? { power_mw: +a[1], capacity_mwh: +a[1] * +a[2] } : null;
}

const trim = (v) => String(+v.toFixed(3));

/** "1 MW / 2 MWh" for any scenario, whichever label format it arrived in. */
export function sizeLabel(s) {
  const d = scenarioDims(s);
  return d ? `${trim(d.power_mw)} MW / ${trim(d.capacity_mwh)} MWh` : s.scenario_label;
}

export const scenarioKey = (s) => `${s.scenario_label}|${s.export_limit_mw}`;

/** Evaluates every scenario's investment case; re-runs 350ms after edits. */
export default function useInvestment(scenarios, nDays, form) {
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  const invalid = useMemo(() => validateAssumptions(form), [form]);
  const assumptions = useMemo(() => {
    if (Object.keys(invalid).length) return null;
    return Object.fromEntries(INVESTMENT_FIELDS.map((f) => [f.key, Number(form[f.key])]));
  }, [form, invalid]);
  // The assumptions the figures on screen were priced with.
  const [priced, setPriced] = useState(null);

  const scenariosIn = useMemo(() =>
    scenarios
      .map((s) => {
        const d = scenarioDims(s);
        return d && {
          scenario_label:     s.scenario_label,
          export_limit_mw:    s.export_limit_mw,
          power_mw:           d.power_mw,
          capacity_mwh:       d.capacity_mwh,
          period_benefit_gbp: s.net_benefit_gbp,
          // Wear is added back server-side: capex already pays for the
          // battery, so charging wear in the cashflow too would double-count.
          period_wear_cost_gbp: Math.max(s.deg_cost_gbp ?? 0, 0),
        };
      })
      .filter(Boolean),
    [scenarios]
  );

  useEffect(() => {
    if (!assumptions || !scenariosIn.length || !nDays) return;
    const id = ++reqRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await postInvestmentEvaluate({ n_days: nDays, scenarios: scenariosIn, assumptions });
        if (reqRef.current === id) { setResult(data); setPriced(assumptions); setError(null); }
      } catch (e) {
        if (reqRef.current === id) setError(e.message);
      } finally {
        if (reqRef.current === id) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [assumptions, scenariosIn, nDays]);

  // Index by scenario key so the table and charts can join on it.
  const byKey = useMemo(() => {
    const m = new Map();
    for (const s of result?.scenarios ?? []) m.set(scenarioKey(s), s);
    return m;
  }, [result]);

  const invalidCount = Object.keys(invalid).length;
  // Stale: the figures on screen no longer match the inputs (being re-priced,
  // or the inputs are invalid, or the last request failed).
  const stale = !!result && (loading || invalidCount > 0 || !!error);
  return {
    result, byKey, error, loading, invalid, stale,
    assumptions: priced ?? assumptions,   // what the shown figures are based on
    available: scenariosIn.length > 0 && !!nDays,
  };
}
