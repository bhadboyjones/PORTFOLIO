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

  const assumptions = useMemo(() => {
    const out = {};
    for (const f of INVESTMENT_FIELDS) {
      const v = f.int ? parseInt(form[f.key], 10) : parseFloat(form[f.key]);
      if (!Number.isFinite(v)) return null;
      out[f.key] = v;
    }
    return out;
  }, [form]);

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
        if (reqRef.current === id) { setResult(data); setError(null); }
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

  return { result, byKey, error, loading, assumptions, available: scenariosIn.length > 0 && !!nDays };
}
