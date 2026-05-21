import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#dc2626"];

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
  return Math.abs(v) >= 1000
    ? `£${(v / 1000).toFixed(0)}k`
    : `£${Math.round(v)}`;
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
      for (const { key, daily } of perScenario) {
        point[key] = daily[date] ?? null;
      }
      return point;
    });

    return { chartData, keys: perScenario.map((s) => s.key) };
  }, [rankedScenarios]);

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 5 }}>
        <XAxis
          dataKey="date"
          tickFormatter={fmtDate}
          tick={{ fontSize: 11 }}
          interval={tickInterval}
        />
        <YAxis tickFormatter={fmtGbp} tick={{ fontSize: 11 }} width={62} />
        <Tooltip formatter={(v) => (v != null ? fmtGbp(v) : "—")} labelFormatter={fmtDate} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
        {keys.map((key, i) => (
          <Line
            key={key}
            dataKey={key}
            stroke={COLORS[i]}
            dot={false}
            strokeWidth={2}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
