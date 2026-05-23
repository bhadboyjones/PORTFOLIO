import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  Legend, ReferenceLine, CartesianGrid, ResponsiveContainer,
} from "recharts";

const COLORS = ["#00c8e8", "#00e5a0", "#ff9f40"];

const tooltipStyle = {
  contentStyle: { background: "#152236", border: "1px solid #1e3352", borderRadius: 6, color: "#e0eaf8", fontSize: "0.82rem" },
  labelStyle:   { color: "#7ba0c8", marginBottom: 4 },
  itemStyle:    { color: "#e0eaf8" },
};

function sampleDaily(timeseries) {
  const byDate = {};
  for (const row of timeseries) {
    if (!row.startTime) continue;
    const date = row.startTime.slice(0, 10);
    byDate[date] = row.cumulative_pnl_gbp;
  }
  return byDate;
}

function fmtGbp(v) {
  if (v == null) return "";
  return Math.abs(v) >= 1000 ? `£${(v / 1000).toFixed(0)}k` : `£${Math.round(v)}`;
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function CumulativePnlChart({ rankedScenarios }) {
  const top3 = rankedScenarios.slice(0, 3);

  const { chartData, keys } = useMemo(() => {
    const perScenario = top3.map((s) => ({
      key: `${s.scenario_label} | ${s.export_limit_mw} MW`,
      daily: sampleDaily(s.dispatch_timeseries),
    }));
    const allDates = [...new Set(perScenario.flatMap((s) => Object.keys(s.daily)))].sort();
    const chartData = allDates.map((date) => {
      const point = { date };
      for (const { key, daily } of perScenario) point[key] = daily[date] ?? null;
      return point;
    });
    return { chartData, keys: perScenario.map((s) => s.key) };
  }, [rankedScenarios]);

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e3352" />
        <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: "#7ba0c8", fontSize: 11 }} interval={tickInterval} axisLine={{ stroke: "#1e3352" }} tickLine={false} />
        <YAxis tickFormatter={fmtGbp} tick={{ fill: "#7ba0c8", fontSize: 11 }} width={62} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => (v != null ? fmtGbp(v) : "—")} labelFormatter={fmtDate} {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12, color: "#7ba0c8" }} />
        <ReferenceLine y={0} stroke="#2a4772" strokeDasharray="3 3" />
        {keys.map((key, i) => (
          <Line key={key} dataKey={key} stroke={COLORS[i]} dot={false} strokeWidth={2} connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
