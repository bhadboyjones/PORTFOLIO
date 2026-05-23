import { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  Legend, ReferenceLine, CartesianGrid, ResponsiveContainer,
} from "recharts";

const tooltipStyle = {
  contentStyle: { background: "#152236", border: "1px solid #1e3352", borderRadius: 6, color: "#e0eaf8", fontSize: "0.82rem" },
  labelStyle:   { color: "#7ba0c8", marginBottom: 4 },
  itemStyle:    { color: "#e0eaf8" },
};

const selectStyle = {
  padding: "0.35rem 0.6rem",
  border: "1px solid #1e3352",
  borderRadius: 5,
  fontSize: "0.82rem",
  background: "#0f1928",
  color: "#e0eaf8",
  outline: "none",
};

const inputStyle = {
  padding: "0.35rem 0.6rem",
  border: "1px solid #1e3352",
  borderRadius: 5,
  fontSize: "0.82rem",
  background: "#0f1928",
  color: "#e0eaf8",
  outline: "none",
};

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

const fieldLabel = { fontSize: "0.72rem", fontWeight: 700, color: "#4a6b8c", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 };

export default function DispatchProfileChart({ rankedScenarios }) {
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

  return (
    <div>
      <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", marginBottom: "1rem", alignItems: "flex-end" }}>
        <label>
          <span style={fieldLabel}>Scenario</span>
          <select value={scenarioIdx} onChange={(e) => setScenarioIdx(Number(e.target.value))} style={selectStyle}>
            {rankedScenarios.map((s, i) => (
              <option key={i} value={i}>{s.scenario_label} | {s.export_limit_mw} MW export</option>
            ))}
          </select>
        </label>
        <label>
          <span style={fieldLabel}>From</span>
          <input type="date" value={windowStart || fullStart} min={fullStart} max={fullEnd} onChange={(e) => setWindowStart(e.target.value)} style={inputStyle} />
        </label>
        <label>
          <span style={fieldLabel}>To</span>
          <input type="date" value={windowEnd || defaultEnd} min={fullStart} max={fullEnd} onChange={(e) => setWindowEnd(e.target.value)} style={inputStyle} />
        </label>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 60, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e3352" />
          <XAxis dataKey="time" tickFormatter={fmtTime} tick={{ fill: "#7ba0c8", fontSize: 10 }} interval={tickInterval} axisLine={{ stroke: "#1e3352" }} tickLine={false} />
          <YAxis yAxisId="mw"  tickFormatter={(v) => `${v} MW`}  tick={{ fill: "#7ba0c8", fontSize: 11 }} width={58}  axisLine={false} tickLine={false} />
          <YAxis yAxisId="mwh" orientation="right" tickFormatter={(v) => `${v} MWh`} tick={{ fill: "#7ba0c8", fontSize: 11 }} width={62} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v, name) => name === "soc_mwh" ? fmtMwh(v) : fmtMw(v)} labelFormatter={fmtTime} {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#7ba0c8" }} />
          <ReferenceLine yAxisId="mw" y={0} stroke="#2a4772" />
          <Bar yAxisId="mw" dataKey="dis1_mw"    stackId="a" fill="#00c8e8" name="Discharge (demand)" />
          <Bar yAxisId="mw" dataKey="dis2_mw"    stackId="a" fill="#00e5a0" name="Discharge (export)" />
          <Bar yAxisId="mw" dataKey="charge1_mw" stackId="a" fill="#ff9f40" name="Charge (surplus)" />
          <Bar yAxisId="mw" dataKey="charge2_mw" stackId="a" fill="#ff5577" name="Charge (grid)" />
          <Line yAxisId="mwh" dataKey="soc_mwh" stroke="#b48efe" dot={false} strokeWidth={2} name="SOC (MWh)" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
