import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";
import useReducedMotion from "../hooks/useReducedMotion";
import {
  CHART_COLORS, tooltipProps, axisTick, axisLineProps,
  gridProps, legendStyle, seriesAnimation,
} from "./chartTheme";

function fmtGbp(v) {
  if (v == null) return "";
  return Math.abs(v) >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${Math.round(v)}`;
}

export default function BaselineComparisonChart({ rankedScenarios }) {
  const reduced = useReducedMotion();
  const top3 = rankedScenarios.slice(0, 3);
  const chartData = useMemo(
    () => top3.map((s) => ({
      name:        `${s.scenario_label} · ${s.export_limit_mw} MW`,
      "No BESS":   s.site_cost_wo_bess_gbp,
      "With BESS": s.site_cost_w_bess_gbp,
    })),
    [rankedScenarios],
  );
  const anim = seriesAnimation(reduced);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 5 }} barCategoryGap="30%">
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey="name" tick={axisTick} axisLine={axisLineProps} tickLine={false} />
        <YAxis tickFormatter={fmtGbp} tick={axisTick} width={62} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => fmtGbp(v)} {...tooltipProps} />
        <Legend wrapperStyle={legendStyle} />
        <Bar dataKey="No BESS"   fill={CHART_COLORS.grid}   radius={[4, 4, 0, 0]} {...anim} />
        <Bar dataKey="With BESS" fill={CHART_COLORS.signal} radius={[4, 4, 0, 0]} {...anim} />
      </BarChart>
    </ResponsiveContainer>
  );
}
