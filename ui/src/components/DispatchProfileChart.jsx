import { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid, ResponsiveContainer,
} from "recharts";
import {
  CHART_COLORS, STREAM_COLORS, STREAM_LABELS, tooltipProps, axisTick, axisLineProps,
  gridProps, controlStyles,
} from "./chartTheme";
import { num } from "../format";

function fmtTime(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(d);
}
function fmtTimeFull(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T"));
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export const DISPATCH_SERIES = [
  ["dis1_mw",    STREAM_COLORS.demandOffset,  STREAM_LABELS.demandOffset],
  ["dis2_mw",    STREAM_COLORS.export,        STREAM_LABELS.export],
  ["charge1_mw", STREAM_COLORS.surplusCharge, STREAM_LABELS.surplusCharge],
  ["charge2_mw", STREAM_COLORS.gridCharge,    STREAM_LABELS.gridCharge],
];

/** Half-hourly dispatch for a chosen window (a week by default). */
export default function DispatchProfileChart({ scenario }) {
  const ts = scenario?.dispatch_timeseries ?? [];
  const fullStart  = ts[0]?.startTime?.slice(0, 10) ?? "";
  const fullEnd    = ts[ts.length - 1]?.startTime?.slice(0, 10) ?? "";
  const defaultEnd = fullStart ? addDays(fullStart, 6) : fullEnd;
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd,   setWindowEnd]   = useState("");
  const start = windowStart || fullStart;
  const end   = windowEnd   || defaultEnd;

  const data = useMemo(() => ts
    .filter((r) => { const d = r.startTime?.slice(0, 10) ?? ""; return d >= start && d <= end; })
    .map((r) => ({
      time: r.startTime,
      dis1_mw: r.dis1_mw ?? 0,
      dis2_mw: r.dis2_mw ?? 0,
      charge1_mw: -(r.charge1_mw ?? 0),
      charge2_mw: -(r.charge2_mw ?? 0),
      soc_mwh: r.soc_mwh ?? null,
    })), [scenario, start, end]);

  const used = DISPATCH_SERIES.filter(([k]) => data.some((d) => Math.abs(d[k]) > 1e-6));
  const dayTicks = data.filter((d) => d.time?.slice(11, 16) === "00:00").map((d) => d.time);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, alignItems: "flex-end" }}>
        <label>
          <span style={controlStyles.fieldLabel}>From</span>
          <input type="date" value={start} min={fullStart} max={fullEnd} onChange={(e) => setWindowStart(e.target.value)} style={controlStyles.input} />
        </label>
        <label>
          <span style={controlStyles.fieldLabel}>To</span>
          <input type="date" value={end} min={fullStart} max={fullEnd} onChange={(e) => setWindowEnd(e.target.value)} style={controlStyles.input} />
        </label>
        <ul style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", margin: "0 0 8px auto", padding: 0, listStyle: "none", fontSize: 12, color: "var(--muted)" }}>
          {used.map(([k, c, l]) => (
            <li key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}><span aria-hidden="true" style={{ width: 10, height: 10, background: c }} />{l}</li>
          ))}
          <li style={{ display: "flex", alignItems: "center", gap: 6 }}><span aria-hidden="true" style={{ width: 12, height: 2, background: STREAM_COLORS.soc }} />State of charge (MWh, right axis)</li>
          <li>Power in MW, left axis</li>
        </ul>
      </div>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={0}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="time" tickFormatter={fmtTime} tick={axisTick} ticks={dayTicks} axisLine={axisLineProps} tickLine={false} />
            <YAxis yAxisId="mw" tickFormatter={(v) => num(v, 1)} tick={axisTick} width={40} axisLine={false} tickLine={false} />
            <YAxis yAxisId="mwh" orientation="right" tickFormatter={(v) => num(v, 1)} tick={axisTick} width={40} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v, name) => [name === "State of charge" ? `${num(v, 2)} MWh` : `${num(Math.abs(v), 2)} MW`, name]}
              labelFormatter={fmtTimeFull} {...tooltipProps} />
            <ReferenceLine yAxisId="mw" y={0} stroke={CHART_COLORS.grey} />
            {DISPATCH_SERIES.map(([k, c, l]) => (
              <Bar key={k} yAxisId="mw" dataKey={k} stackId="a" fill={c} name={l} isAnimationActive={false} />
            ))}
            <Line yAxisId="mwh" dataKey="soc_mwh" stroke={STREAM_COLORS.soc} dot={false} strokeWidth={1.5} name="State of charge" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
