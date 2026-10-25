import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  Legend, ReferenceLine, CartesianGrid, ResponsiveContainer,
} from "recharts";
import useReducedMotion from "../hooks/useReducedMotion";
import useCountUp from "../hooks/useCountUp";
import {
  CHART_COLORS, SERIES, tooltipProps, axisTick, axisLineProps,
  gridProps, legendStyle, seriesAnimation, controlStyles,
} from "./chartTheme";
import { postInvestmentEvaluate } from "../api/client";

// Defaults mirror api/schemas.py InvestmentAssumptions — placeholder
// assumptions to be replaced with real quotes, not market data.
const FIELDS = [
  { key: "capex_gbp_per_kw",  label: "Capex £/kW",       def: 150,  step: 10,   title: "Power-related capex: inverter/PCS, switchgear, connection" },
  { key: "capex_gbp_per_kwh", label: "Capex £/kWh",      def: 250,  step: 10,   title: "Energy-related capex: cells and racks — the dominant share" },
  { key: "capex_fixed_gbp",   label: "Fixed capex £",    def: 0,    step: 5000, title: "Site works, design, project management — size-independent" },
  { key: "opex_pct_of_capex", label: "Opex % capex/yr",  def: 1.5,  step: 0.1,  title: "O&M contract, insurance, monitoring" },
  { key: "lifetime_yrs",      label: "Life (years)",     def: 15,   step: 1,    title: "Design life — warranty is typically 10y", int: true },
  { key: "discount_rate_pct", label: "Discount %/yr",    def: 8,    step: 0.5,  title: "Nominal cost of capital / hurdle rate" },
  { key: "fade_pct_yr",       label: "Fade %/yr",        def: 2.5,  step: 0.1,  title: "Usable capacity lost per year to degradation" },
  { key: "escalation_pct_yr", label: "Escalation %/yr",  def: 2,    step: 0.1,  title: "Benefit and opex price growth (nominal)" },
  { key: "dispatch_efficiency_pct", label: "Dispatch eff %", def: 85, step: 1,  title: "Foresight haircut: the backtest assumes perfect price foresight. This scales it to a realistic operating case. 100% = raw backtest ceiling." },
];

function fmt(v, dec = 0) {
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtGbpAxis(v) {
  if (v == null) return "";
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(1)}m`;
  if (Math.abs(v) >= 1000) return `£${(v / 1000).toFixed(0)}k`;
  return `£${Math.round(v)}`;
}

// Backend sends power_mw/capacity_mwh explicitly (new runs); fall back to
// parsing the label so the card still works across a backend deploy skew.
function scenarioDims(s) {
  if (s.power_mw != null && s.capacity_mwh != null) {
    return { power_mw: s.power_mw, capacity_mwh: s.capacity_mwh };
  }
  const m = /([\d.]+)\s*MW\s*\/\s*([\d.]+)\s*MWh/.exec(s.scenario_label || "");
  return m ? { power_mw: +m[1], capacity_mwh: +m[2] } : null;
}

function MetricTile({ label, value, sub, color }) {
  return (
    <div>
      <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginBottom: "0.2rem" }}>{label}</div>
      <div className="tnum" style={{ fontSize: "0.95rem", fontWeight: 600, color: color || "var(--text-sec)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}

function NpvHeadline({ best }) {
  const shown = useCountUp(best.npv_gbp);
  const positive = best.npv_gbp >= 0;
  // Ceiling is the raw perfect-foresight backtest; realistic (shown) is after
  // the dispatch-efficiency haircut. Only show the range when they differ.
  const hasRange = best.npv_ceiling_gbp != null && best.npv_ceiling_gbp !== best.npv_gbp;
  return (
    <div style={{
      padding: "1.1rem 1.25rem",
      background: positive ? "rgba(0,229,160,0.06)" : "var(--bg-card)",
      border: `1px solid ${positive ? "rgba(0,229,160,0.3)" : "var(--border)"}`,
      borderRadius: 10,
      minWidth: 200,
    }}>
      <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.6rem" }}>
        Best NPV · realistic
      </div>
      <div className="tnum" style={{
        fontSize: "1.5rem", fontWeight: 700, fontFamily: "var(--font-display)",
        color: positive ? CHART_COLORS.positive : CHART_COLORS.negative,
        lineHeight: 1.1, letterSpacing: "-0.02em",
      }}>
        £{fmt(shown)}
      </div>
      {hasRange && (
        <div className="tnum" style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.4rem" }}>
          up to £{fmt(best.npv_ceiling_gbp)} at perfect foresight
        </div>
      )}
      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: "0.3rem" }}>
        {best.scenario_label} · {best.export_limit_mw} MW export
      </div>
    </div>
  );
}

export default function InvestmentCard({ rankedScenarios, nDays }) {
  const reduced = useReducedMotion();
  const [form, setForm] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, String(f.def)]))
  );
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  const assumptions = useMemo(() => {
    const out = {};
    for (const f of FIELDS) {
      const v = f.int ? parseInt(form[f.key], 10) : parseFloat(form[f.key]);
      if (!Number.isFinite(v)) return null;
      out[f.key] = v;
    }
    return out;
  }, [form]);

  const scenariosIn = useMemo(() =>
    rankedScenarios
      .map((s) => {
        const d = scenarioDims(s);
        return d && {
          scenario_label:     s.scenario_label,
          export_limit_mw:    s.export_limit_mw,
          power_mw:           d.power_mw,
          capacity_mwh:       d.capacity_mwh,
          period_benefit_gbp: s.net_benefit_gbp,
          // Wear accrual is added back server-side: capex already pays for the
          // battery, so charging wear in the cashflow too would double-count.
          period_wear_cost_gbp: Math.max(s.deg_cost_gbp ?? 0, 0),
        };
      })
      .filter(Boolean),
    [rankedScenarios]
  );

  useEffect(() => {
    if (!assumptions || !scenariosIn.length || !nDays) return;
    const id = ++reqRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await postInvestmentEvaluate({
          n_days: nDays,
          scenarios: scenariosIn,
          assumptions,
        });
        if (reqRef.current === id) { setResult(data); setError(null); }
      } catch (e) {
        if (reqRef.current === id) setError(e.message);
      } finally {
        if (reqRef.current === id) setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [assumptions, scenariosIn, nDays]);

  if (!scenariosIn.length || !nDays) return null;

  const rankedByNpv = [...(result?.scenarios ?? [])].sort((a, b) => b.npv_gbp - a.npv_gbp);
  const best = rankedByNpv[0] ?? null;
  const lifetime = assumptions?.lifetime_yrs ?? 15;

  // Breakeven curves for the top 3 NPV scenarios: year vs cumulative
  // discounted cashflow. Same lifetime for all, so one shared x-axis.
  const top3 = rankedByNpv.slice(0, 3);
  const chartData = [];
  if (top3.length) {
    for (let year = 0; year < top3[0].cumulative_discounted.length; year++) {
      const point = { year };
      for (const s of top3) {
        point[`${s.scenario_label} | ${s.export_limit_mw} MW`] = s.cumulative_discounted[year];
      }
      chartData.push(point);
    }
  }

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "1.5rem",
      marginBottom: "2rem",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.35rem" }}>
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Investment Case
        </div>
        {loading && (
          <span style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>recalculating…</span>
        )}
      </div>
      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
        Lifetime appraisal of each scenario — nominal, unlevered, pre-tax. Annual benefit
        is scaled from the data period, then cut by the dispatch-efficiency haircut: the
        backtest assumes perfect price foresight, so its raw benefit is a ceiling no real
        operator reaches. Headline figures are the realistic case; "up to" is the raw
        backtest. Defaults below are editable placeholders — replace with real quotes.
      </div>

      {/* Assumption inputs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: "0.75rem",
        marginBottom: "1.25rem",
      }}>
        {FIELDS.map((f) => (
          <label key={f.key} title={f.title}>
            <span style={controlStyles.fieldLabel}>{f.label}</span>
            <input
              type="number"
              step={f.step}
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              style={{ ...controlStyles.input, width: "100%", boxSizing: "border-box" }}
            />
          </label>
        ))}
      </div>

      {error && (
        <div style={{
          marginBottom: "1rem", padding: "0.6rem 0.9rem", borderRadius: 6,
          background: "rgba(255,85,119,0.07)", border: "1px solid rgba(255,85,119,0.25)",
          fontSize: "0.78rem", color: CHART_COLORS.negative,
        }}>
          {error}
        </div>
      )}

      {result?.warnings?.length > 0 && (
        <div style={{
          marginBottom: "1rem", padding: "0.6rem 0.9rem", borderRadius: 6,
          background: "rgba(255,176,58,0.07)", border: "1px solid rgba(255,176,58,0.25)",
          fontSize: "0.78rem", color: "var(--warn)",
        }}>
          {result.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      {best && (
        <>
          {/* Headline metrics for the best-NPV scenario */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            <NpvHeadline best={best} />
            <div style={{
              flex: 1, minWidth: 320,
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              gap: "0.75rem", alignContent: "center",
              padding: "0.75rem 1rem",
              border: "1px solid var(--border)", borderRadius: 10,
            }}>
              <MetricTile label="IRR" value={best.irr_pct != null ? `${fmt(best.irr_pct, 1)}%` : "n/a"} sub="vs hurdle rate" />
              <MetricTile
                label="Payback"
                value={best.payback_yrs != null ? `${fmt(best.payback_yrs, 1)}y` : `> ${lifetime}y`}
                sub={best.discounted_payback_yrs != null ? `${fmt(best.discounted_payback_yrs, 1)}y discounted` : "beyond life discounted"}
              />
              <MetricTile label="Benefit / £ capex" value={best.benefit_cost_ratio != null ? fmt(best.benefit_cost_ratio, 2) : "—"} sub="PV terms · >1 pays" />
              <MetricTile label="Capex" value={`£${fmt(best.capex_gbp)}`} />
              <MetricTile label="Year-1 benefit" value={`£${fmt(best.annual_benefit_yr1_gbp)}`} sub={`opex £${fmt(best.annual_opex_yr1_gbp)}/yr`} />
            </div>
          </div>

          {/* Per-scenario appraisal table, ranked by NPV */}
          <div style={{ overflowX: "auto", marginBottom: "1.25rem" }}>
            <table className="tnum" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ color: "var(--text-dim)", textAlign: "right" }}>
                  {["Scenario", "Export", "Capex", "Yr-1 benefit", "NPV", "IRR", "Payback", "PV benefit / £"].map((h, i) => (
                    <th key={h} style={{
                      padding: "0.45rem 0.6rem", fontWeight: 600, whiteSpace: "nowrap",
                      textAlign: i === 0 ? "left" : "right",
                      borderBottom: "1px solid var(--border)",
                      fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankedByNpv.map((s) => (
                  <tr key={`${s.scenario_label}|${s.export_limit_mw}`} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.5rem 0.6rem", color: "var(--text-sec)", whiteSpace: "nowrap" }}>{s.scenario_label}</td>
                    <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", color: "var(--text-dim)" }}>{s.export_limit_mw} MW</td>
                    <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", color: "var(--text-sec)" }}>£{fmt(s.capex_gbp)}</td>
                    <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", color: "var(--text-sec)" }}>£{fmt(s.annual_benefit_yr1_gbp)}</td>
                    <td style={{
                      padding: "0.5rem 0.6rem", textAlign: "right", fontWeight: 600,
                      color: s.npv_gbp >= 0 ? CHART_COLORS.positive : CHART_COLORS.negative,
                    }}>
                      £{fmt(s.npv_gbp)}
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", color: "var(--text-sec)" }}>
                      {s.irr_pct != null ? `${fmt(s.irr_pct, 1)}%` : "n/a"}
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", color: "var(--text-sec)" }}>
                      {s.payback_yrs != null ? `${fmt(s.payback_yrs, 1)}y` : `> ${lifetime}y`}
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem", textAlign: "right", color: "var(--text-sec)" }}>
                      {s.benefit_cost_ratio != null ? fmt(s.benefit_cost_ratio, 2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Breakeven curve — cumulative discounted cashflow, top 3 by NPV */}
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
            Discounted breakeven curve
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="year" tick={axisTick} axisLine={axisLineProps} tickLine={false}
                label={{ value: "Year", position: "insideBottomRight", offset: -2, fill: CHART_COLORS.axisText, fontSize: 11 }}
              />
              <YAxis tickFormatter={fmtGbpAxis} tick={axisTick} width={62} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => (v != null ? `£${fmt(v)}` : "—")}
                labelFormatter={(y) => `End of year ${y}`}
                {...tooltipProps}
              />
              <Legend wrapperStyle={legendStyle} />
              <ReferenceLine y={0} stroke={CHART_COLORS.refLine} strokeDasharray="3 3" />
              {top3.map((s, i) => (
                <Line
                  key={`${s.scenario_label}|${s.export_limit_mw}`}
                  dataKey={`${s.scenario_label} | ${s.export_limit_mw} MW`}
                  stroke={SERIES[i]} dot={false} strokeWidth={2}
                  {...seriesAnimation(reduced)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", marginTop: "0.5rem", lineHeight: 1.6 }}>
            Cumulative discounted cashflow: starts at −capex, each year adds that year's
            benefit − opex discounted at the rate above. Crossing £0 is discounted payback;
            the year-{lifetime} endpoint is the NPV.
          </div>
        </>
      )}
    </div>
  );
}
