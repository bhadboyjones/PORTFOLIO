import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";

function aggregateDaily(timeseries) {
  const byDate = {};
  for (const row of timeseries) {
    if (!row.startTime) continue;
    const date = row.startTime.slice(0, 10);
    if (!byDate[date]) {
      byDate[date] = {
        date,
        dis1_saving_gbp:      0,
        dis2_revenue_gbp:     0,
        charge2_cost_gbp:     0,
        charge1_opp_cost_gbp: 0,
        deg_cost_gbp:         0,
      };
    }
    const d = byDate[date];
    d.dis1_saving_gbp      += row.dis1_saving_gbp      ?? 0;
    d.dis2_revenue_gbp     += row.dis2_revenue_gbp     ?? 0;
    d.charge2_cost_gbp     -= row.charge2_cost_gbp     ?? 0;  // negate → negative stack
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

export default function RevenueStackChart({ rankedScenarios }) {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const scenario = rankedScenarios[scenarioIdx];

  const chartData = useMemo(
    () => aggregateDaily(scenario?.dispatch_timeseries ?? []),
    [scenario],
  );

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ fontSize: "0.85rem" }}>
          <span style={{ color: "#6b7280", display: "block", marginBottom: 2 }}>Scenario</span>
          <select
            value={scenarioIdx}
            onChange={(e) => setScenarioIdx(Number(e.target.value))}
            style={{ padding: "0.3rem 0.5rem", border: "1px solid #d1d5db", borderRadius: 4, fontSize: "0.85rem" }}
          >
            {rankedScenarios.map((s, i) => (
              <option key={i} value={i}>
                {s.scenario_label} | {s.export_limit_mw} MW export
              </option>
            ))}
          </select>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 5 }}>
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 11 }}
            interval={tickInterval}
          />
          <YAxis tickFormatter={fmtGbp} tick={{ fontSize: 11 }} width={56} />
          <Tooltip formatter={(v) => fmtGbp(v)} labelFormatter={fmtDate} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
          <Area stackId="s" dataKey="dis1_saving_gbp"      stroke="#2563eb" fill="#bfdbfe" name="Demand saving"       />
          <Area stackId="s" dataKey="dis2_revenue_gbp"     stroke="#0ea5e9" fill="#bae6fd" name="Export revenue"      />
          <Area stackId="s" dataKey="charge2_cost_gbp"     stroke="#ef4444" fill="#fecaca" name="Grid charge cost"    />
          <Area stackId="s" dataKey="charge1_opp_cost_gbp" stroke="#f59e0b" fill="#fed7aa" name="Opp. cost (surplus)" />
          <Area stackId="s" dataKey="deg_cost_gbp"         stroke="#6b7280" fill="#e5e7eb" name="Degradation"         />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
