import { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  Legend, ReferenceLine, CartesianGrid, ResponsiveContainer,
} from "recharts";
import useReducedMotion from "../hooks/useReducedMotion";
import {
  CHART_COLORS, tooltipProps, axisTick, axisLineProps,
  gridProps, legendStyle, seriesAnimation, controlStyles,
} from "./chartTheme";

function fmtTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr.replace(" ", "T"));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtMw(v)  { return v == null ? "" : `${Number(v).toFixed(2)} MW`; }
function fmtMwh(v) { return v == null ? "" : `${Number(v).toFixed(2)} MWh`; }

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function DispatchProfileChart({ rankedScenarios }) {
  const reduced = useReducedMotion();
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const scenario = rankedScenarios[scenarioIdx];
  const ts       = scenario?.dispatch_timeseries ?? [];

  const fullStart  = ts[0]?.startTime?.slice(0, 10) ?? "";
  const fullEnd    = ts[ts.length - 1]?.startTime?.slice(0, 10) ?? "";
  const defaultEnd = fullStart ? addDays(fullStart, 6) : fullEnd;

  const [windowStart, setWindowStart] = useState("");
  const [windowEnd,   setWindowEnd]   = useState("");

  const effectiveStart = windowStart || fullStart;
  const effectiveEnd   = windowEnd   || defaultEnd;

  const chartData = useMemo(() => ts
    .filter((row) => { const d = row.startTime?.slice(0, 10) ?? ""; return d >= effectiveStart && d <= effectiveEnd; })
    .map((row) => ({
      time:       row.startTime,
      dis1_mw:    row.dis1_mw   ?? 0,
      dis2_mw:    row.dis2_mw   ?? 0,
      charge1_mw: -(row.charge1_mw ?? 0),
      charge2_mw: -(row.charge2_mw ?? 0),
      soc_mwh:    row.soc_mwh   ?? null,
    })), [scenario, effectiveStart, effectiveEnd]);

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));
  const anim = seriesAnimation(reduced);

  return (
    <div>
      <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginBottom: "1rem", alignItems: "flex-end" }}>
        <label>
          <span style={controlStyles.fieldLabel}>Scenario</span>
          <select value={scenarioIdx} onChange={(e) => setScenarioIdx(Number(e.target.value))} style={controlStyles.select}>
            {rankedScenarios.map((s, i) => (
              <option key={i} value={i}>{s.scenario_label} | {s.export_limit_mw} MW export</option>
            ))}
          </select>
        </label>
        <label>
          <span style={controlStyles.fieldLabel}>From</span>
          <input type="date" value={windowStart || fullStart} min={fullStart} max={fullEnd} onChange={(e) => setWindowStart(e.target.value)} style={controlStyles.input} />
        </label>
        <label>
          <span style={controlStyles.fieldLabel}>To</span>
          <input type="date" value={windowEnd || defaultEnd} min={fullStart} max={fullEnd} onChange={(e) => setWindowEnd(e.target.value)} style={controlStyles.input} />
        </label>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 60, left: 10, bottom: 5 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="time" tickFormatter={fmtTime} tick={{ ...axisTick, fontSize: 10 }} interval={tickInterval} axisLine={axisLineProps} tickLine={false} />
          <YAxis yAxisId="mw"  tickFormatter={(v) => `${v} MW`}  tick={axisTick} width={58}  axisLine={false} tickLine={false} />
          <YAxis yAxisId="mwh" orientation="right" tickFormatter={(v) => `${v} MWh`} tick={axisTick} width={62} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v, name) => name === "SOC (MWh)" ? fmtMwh(v) : fmtMw(v)} labelFormatter={fmtTime} {...tooltipProps} />
          <Legend wrapperStyle={legendStyle} />
          <ReferenceLine yAxisId="mw" y={0} stroke={CHART_COLORS.refLine} />
          <Bar yAxisId="mw" dataKey="dis1_mw"    stackId="a" fill={CHART_COLORS.signal}   name="Discharge (demand)" {...anim} />
          <Bar yAxisId="mw" dataKey="dis2_mw"    stackId="a" fill={CHART_COLORS.positive} name="Discharge (export)" {...anim} />
          <Bar yAxisId="mw" dataKey="charge1_mw" stackId="a" fill={CHART_COLORS.charge}   name="Charge (surplus)"   {...anim} />
          <Bar yAxisId="mw" dataKey="charge2_mw" stackId="a" fill={CHART_COLORS.negative} name="Charge (grid)"      {...anim} />
          <Line yAxisId="mwh" dataKey="soc_mwh" stroke={CHART_COLORS.soc} dot={false} strokeWidth={2} name="SOC (MWh)" {...anim} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
