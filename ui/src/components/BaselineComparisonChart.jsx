import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  Legend, CartesianGrid, ResponsiveContainer,
} from "recharts";

const tooltipStyle = {
  contentStyle: { background: "#152236", border: "1px solid #1e3352", borderRadius: 6, color: "#e0eaf8", fontSize: "0.82rem" },
  labelStyle:   { color: "#7ba0c8", marginBottom: 4 },
  itemStyle:    { color: "#e0eaf8" },
};

function fmtGbp(v) {
  if (v == null) return "";
  return Math.abs(v) >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${Math.round(v)}`;
}

export default function BaselineComparisonChart({ rankedScenarios }) {
  const top3 = rankedScenarios.slice(0, 3);
  const chartData = useMemo(
    () => top3.map((s) => ({
      name:        `${s.scenario_label} · ${s.export_limit_mw} MW`,
      "No BESS":   s.site_cost_wo_bess_gbp,
      "With BESS": s.site_cost_w_bess_gbp,
    })),
    [rankedScenarios],
  );

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 5 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1e3352" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#7ba0c8", fontSize: 11 }} axisLine={{ stroke: "#1e3352" }} tickLine={false} />
        <YAxis tickFormatter={fmtGbp} tick={{ fill: "#7ba0c8", fontSize: 11 }} width={62} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => fmtGbp(v)} {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: "#7ba0c8" }} />
        <Bar dataKey="No BESS"   fill="#1e3352"  radius={[4, 4, 0, 0]} />
        <Bar dataKey="With BESS" fill="#00c8e8"  radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
