import { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";

function fmtTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr.replace(" ", "T"));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtMw(v) {
  if (v == null) return "";
  return `${Number(v).toFixed(2)} MW`;
}

function fmtMwh(v) {
  if (v == null) return "";
  return `${Number(v).toFixed(2)} MWh`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function DispatchProfileChart({ rankedScenarios }) {
  const [scenarioIdx, setScenarioIdx] = useState(0);

  const scenario = rankedScenarios[scenarioIdx];
  const ts = scenario?.dispatch_timeseries ?? [];

  const fullStart = ts[0]?.startTime?.slice(0, 10) ?? "";
  const fullEnd   = ts[ts.length - 1]?.startTime?.slice(0, 10) ?? "";

  const defaultEnd = fullStart ? addDays(fullStart, 6) : fullEnd;
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd,   setWindowEnd]   = useState("");

  const effectiveStart = windowStart || fullStart;
  const effectiveEnd   = windowEnd   || defaultEnd;

  const chartData = useMemo(() => {
    return ts
      .filter((row) => {
        const d = row.startTime?.slice(0, 10) ?? "";
        return d >= effectiveStart && d <= effectiveEnd;
      })
      .map((row) => ({
        time:          row.startTime,
        dis1_mw:       row.dis1_mw   ?? 0,
        dis2_mw:       row.dis2_mw   ?? 0,
        charge1_mw:  -(row.charge1_mw ?? 0),
        charge2_mw:  -(row.charge2_mw ?? 0),
        soc_mwh:       row.soc_mwh   ?? null,
      }));
  }, [scenario, effectiveStart, effectiveEnd]);

  const tickInterval = Math.max(1, Math.floor(chartData.length / 8));

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem", alignItems: "flex-end" }}>
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

        <label style={{ fontSize: "0.85rem" }}>
          <span style={{ color: "#6b7280", display: "block", marginBottom: 2 }}>From</span>
          <input
            type="date"
            value={windowStart || fullStart}
            min={fullStart}
            max={fullEnd}
            onChange={(e) => setWindowStart(e.target.value)}
            style={{ padding: "0.3rem 0.5rem", border: "1px solid #d1d5db", borderRadius: 4, fontSize: "0.85rem" }}
          />
        </label>

        <label style={{ fontSize: "0.85rem" }}>
          <span style={{ color: "#6b7280", display: "block", marginBottom: 2 }}>To</span>
          <input
            type="date"
            value={windowEnd || defaultEnd}
            min={fullStart}
            max={fullEnd}
            onChange={(e) => setWindowEnd(e.target.value)}
            style={{ padding: "0.3rem 0.5rem", border: "1px solid #d1d5db", borderRadius: 4, fontSize: "0.85rem" }}
          />
        </label>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 60, left: 10, bottom: 5 }}>
          <XAxis
            dataKey="time"
            tickFormatter={fmtTime}
            tick={{ fontSize: 10 }}
            interval={tickInterval}
          />
          <YAxis yAxisId="mw" tickFormatter={(v) => `${v} MW`} tick={{ fontSize: 11 }} width={58} />
          <YAxis yAxisId="mwh" orientation="right" tickFormatter={(v) => `${v} MWh`} tick={{ fontSize: 11 }} width={62} />
          <Tooltip
            formatter={(v, name) =>
              name === "soc_mwh" ? fmtMwh(v) : fmtMw(v)
            }
            labelFormatter={fmtTime}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine yAxisId="mw" y={0} stroke="#9ca3af" />
          <Bar yAxisId="mw" dataKey="dis1_mw"    stackId="a" fill="#2563eb" name="Discharge (demand)" />
          <Bar yAxisId="mw" dataKey="dis2_mw"    stackId="a" fill="#0ea5e9" name="Discharge (export)" />
          <Bar yAxisId="mw" dataKey="charge1_mw" stackId="a" fill="#f59e0b" name="Charge (surplus)" />
          <Bar yAxisId="mw" dataKey="charge2_mw" stackId="a" fill="#ef4444" name="Charge (grid)" />
          <Line yAxisId="mwh" dataKey="soc_mwh" stroke="#6b7280" dot={false} strokeWidth={2} name="SOC (MWh)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
