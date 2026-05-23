import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  Legend, ReferenceLine, CartesianGrid, ResponsiveContainer,
} from "recharts";

const tooltipStyle = {
  contentStyle: { background: "#152236", border: "1px solid #1e3352", borderRadius: 6, color: "#e0eaf8", fontSize: "0.82rem" },
  labelStyle:   { color: "#7ba0c8", marginBottom: 4 },
  itemStyle:    { color: "#e0eaf8" },
};

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
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtGbp(v) {
  if (v == null) return "";
  return Math.abs(v) >= 1 ? `£${Number(v).toFixed(0)}` : `£${Number(v).toFixed(2)}`;
}

const selectStyle = {
  padding: "0.35rem 0.6rem",
  border: "1px solid #1e3352",
  borderRadius: 5,
  fontSize: "0.82rem",
  background: "#0f1928",
  color: "#e0eaf8",
  outline: "none",
};

export default function RevenueStackChart({ rankedScenarios }) {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const scenario  = rankedScenarios[scenarioIdx];
  const chartData = useMemo(() => aggregateDaily(scenario?.dispatch_timeseries ?? []), [scenario]);
  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4a6b8c", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
          Scenario
        </label>
        <select value={scenarioIdx} onChange={(e) => setScenarioIdx(Number(e.target.value))} style={selectStyle}>
          {rankedScenarios.map((s, i) => (
            <option key={i} value={i}>{s.scenario_label} | {s.export_limit_mw} MW export</option>
          ))}
        </select>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3352" />
          <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: "#7ba0c8", fontSize: 11 }} interval={tickInterval} axisLine={{ stroke: "#1e3352" }} tickLine={false} />
          <YAxis tickFormatter={fmtGbp} tick={{ fill: "#7ba0c8", fontSize: 11 }} width={56} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => fmtGbp(v)} labelFormatter={fmtDate} {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#7ba0c8" }} />
          <ReferenceLine y={0} stroke="#2a4772" strokeDasharray="3 3" />
          <Area stackId="s" dataKey="dis1_saving_gbp"      stroke="#00c8e8" fill="rgba(0,200,232,0.25)"  name="Demand saving" />
          <Area stackId="s" dataKey="dis2_revenue_gbp"     stroke="#00e5a0" fill="rgba(0,229,160,0.25)"  name="Export revenue" />
          <Area stackId="s" dataKey="charge2_cost_gbp"     stroke="#ff5577" fill="rgba(255,85,119,0.2)"  name="Grid charge cost" />
          <Area stackId="s" dataKey="charge1_opp_cost_gbp" stroke="#ff9f40" fill="rgba(255,159,64,0.2)"  name="Opp. cost (surplus)" />
          <Area stackId="s" dataKey="deg_cost_gbp"         stroke="#4a6b8c" fill="rgba(74,107,140,0.2)"  name="Degradation" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
