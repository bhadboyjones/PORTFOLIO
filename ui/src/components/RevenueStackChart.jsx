import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, CartesianGrid, ResponsiveContainer,
} from "recharts";
import {
  CHART_COLORS, STREAM_COLORS, STREAM_LABELS, tooltipProps, axisTick, axisLineProps, gridProps,
} from "./chartTheme";
import { gbp, gbpCompact } from "../format";
import { aggregateDaily } from "../lib/results";

// Daily value: what the battery earns above zero, what it costs below,
// and the net as an ink line. Same stream colours as every other chart.
export const VALUE_SERIES = [
  ["demand",     STREAM_COLORS.demandOffset,  `${STREAM_LABELS.demandOffset} saving`],
  ["export",     STREAM_COLORS.export,        `${STREAM_LABELS.export} revenue`],
  ["gridCharge", STREAM_COLORS.gridCharge,    `${STREAM_LABELS.gridCharge} cost`],
  ["surplus",    STREAM_COLORS.surplusCharge, "Export given up to charge"],
  ["wear",       STREAM_COLORS.wear,          STREAM_LABELS.wear],
];

const fmtDate = (s) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(s + "T00:00:00"));

export default function RevenueStackChart({ scenario }) {
  const data = useMemo(() => aggregateDaily(scenario?.dispatch_timeseries ?? []), [scenario]);
  const used = VALUE_SERIES.filter(([k]) => data.some((d) => Math.abs(d[k]) > 0.005));
  const step = Math.max(1, Math.ceil(data.length / 7));
  const ticks = data.filter((_, i) => i % step === 0).map((d) => d.date);

  return (
    <div>
      <ul style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", margin: "0 0 8px", padding: 0, listStyle: "none", fontSize: 12, color: "var(--muted)" }}>
        {used.map(([k, c, l]) => (
          <li key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}><span aria-hidden="true" style={{ width: 10, height: 10, background: c }} />{l}</li>
        ))}
        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><span aria-hidden="true" style={{ width: 12, height: 2, background: CHART_COLORS.ink }} />Net per day</li>
      </ul>
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 200 }}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="sign" barCategoryGap={1}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="date" tickFormatter={fmtDate} ticks={ticks} tick={axisTick} axisLine={axisLineProps} tickLine={false} />
            <YAxis tickFormatter={gbpCompact} tick={axisTick} width={56} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [gbp(v, { decimals: 2 }), n]} labelFormatter={fmtDate} {...tooltipProps} />
            <ReferenceLine y={0} stroke={CHART_COLORS.grey} />
            {VALUE_SERIES.map(([k, c, l]) => (
              <Bar key={k} stackId="s" dataKey={k} fill={c} name={l} isAnimationActive={false} />
            ))}
            <Line dataKey="net" stroke={CHART_COLORS.ink} strokeWidth={1.5} dot={false} name="Net per day" isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
