import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from "recharts";

function fmtGbp(v) {
  if (v == null) return "";
  return Math.abs(v) >= 1000
    ? `£${(v / 1000).toFixed(0)}k`
    : `£${Math.round(v)}`;
}

export default function BaselineComparisonChart({ rankedScenarios }) {
  const top3 = rankedScenarios.slice(0, 3);

  const chartData = useMemo(
    () =>
      top3.map((s) => ({
        name: `${s.scenario_label}\n${s.export_limit_mw} MW`,
        "No BESS":   s.site_cost_wo_bess_gbp,
        "With BESS": s.site_cost_w_bess_gbp,
      })),
    [rankedScenarios],
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 5 }} barCategoryGap="30%">
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={fmtGbp} tick={{ fontSize: 11 }} width={62} />
        <Tooltip formatter={(v) => fmtGbp(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="No BESS"   fill="#d1d5db" radius={[4, 4, 0, 0]} />
        <Bar dataKey="With BESS" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
