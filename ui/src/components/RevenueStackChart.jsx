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

// Daily revenue stack: value components above zero, cost components below,
// with a net line — the standard BESS revenue-stack presentation.
function aggregateDaily(timeseries) {
  const byDate = {};
  for (const row of timeseries) {
    if (!row.startTime) continue;
    const date = row.startTime.slice(0, 10);
    if (!byDate[date]) byDate[date] = { date, dis1_saving_gbp: 0, dis2_revenue_gbp: 0, charge2_cost_gbp: 0, charge1_opp_cost_gbp: 0, deg_cost_gbp: 0 };
    const d = byDate[date];
    d.dis1_saving_gbp      += row.dis1_saving_gbp      ?? 0;
    d.dis2_revenue_gbp     += row.dis2_revenue_gbp     ?? 0;
    d.charge2_cost_gbp     -= row.charge2_cost_gbp     ?? 0;
    d.charge1_opp_cost_gbp -= row.charge1_opp_cost_gbp ?? 0;
    d.deg_cost_gbp         -= row.deg_cost_gbp         ?? 0;
  }
  return Object.values(byDate)
    .map((d) => ({
      ...d,
      net_gbp: d.dis1_saving_gbp + d.dis2_revenue_gbp + d.charge2_cost_gbp + d.charge1_opp_cost_gbp + d.deg_cost_gbp,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtGbp(v) {
  if (v == null) return "";
  return Math.abs(v) >= 1 ? `£${Number(v).toFixed(0)}` : `£${Number(v).toFixed(2)}`;
}

export default function RevenueStackChart({ rankedScenarios }) {
  const reduced = useReducedMotion();
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const scenario  = rankedScenarios[scenarioIdx];
  const chartData = useMemo(() => aggregateDaily(scenario?.dispatch_timeseries ?? []), [scenario]);
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));
  const anim = seriesAnimation(reduced);

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label>
          <span style={controlStyles.fieldLabel}>Scenario</span>
          <select value={scenarioIdx} onChange={(e) => setScenarioIdx(Number(e.target.value))} style={controlStyles.select}>
            {rankedScenarios.map((s, i) => (
              <option key={i} value={i}>{s.scenario_label} | {s.export_limit_mw} MW export</option>
            ))}
          </select>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 5 }} stackOffset="sign">
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={axisTick} interval={tickInterval} axisLine={axisLineProps} tickLine={false} />
          <YAxis tickFormatter={fmtGbp} tick={axisTick} width={56} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => fmtGbp(v)} labelFormatter={fmtDate} {...tooltipProps} />
          <Legend wrapperStyle={legendStyle} />
          <ReferenceLine y={0} stroke={CHART_COLORS.refLine} />
          <Bar stackId="s" dataKey="dis1_saving_gbp"      fill={CHART_COLORS.signal}   fillOpacity={0.85} name="Demand saving"      {...anim} />
          <Bar stackId="s" dataKey="dis2_revenue_gbp"     fill={CHART_COLORS.positive} fillOpacity={0.85} name="Export revenue"     {...anim} />
          <Bar stackId="s" dataKey="charge2_cost_gbp"     fill={CHART_COLORS.negative} fillOpacity={0.75} name="Grid charge cost"   {...anim} />
          <Bar stackId="s" dataKey="charge1_opp_cost_gbp" fill={CHART_COLORS.charge}   fillOpacity={0.75} name="Opp. cost (surplus)" {...anim} />
          <Bar stackId="s" dataKey="deg_cost_gbp"         fill={CHART_COLORS.muted}    fillOpacity={0.75} name="Degradation"        {...anim} />
          <Line dataKey="net_gbp" stroke={CHART_COLORS.paper} strokeWidth={1.5} dot={false} name="Net daily value" {...anim} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
