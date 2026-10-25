import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, tooltipProps, axisTick, axisLineProps, gridProps } from "./chartTheme";
import { gbp, gbpCompact } from "../format";

// Backtest saving accumulated over the data period, for the selected scenario.
export function dailyCumulative(timeseries) {
  const byDate = {};
  for (const row of timeseries) {
    if (!row.startTime) continue;
    byDate[row.startTime.slice(0, 10)] = row.cumulative_pnl_gbp;
  }
  return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, cumulative]) => ({ date, cumulative }));
}

const fmtDate = (s) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(s + "T00:00:00"));

export default function CumulativePnlChart({ scenario }) {
  const data = useMemo(() => dailyCumulative(scenario?.dispatch_timeseries ?? []), [scenario]);
  const step = Math.max(1, Math.ceil(data.length / 7));
  const ticks = data.filter((_, i) => i % step === 0).map((d) => d.date);
  return (
    <div style={{ height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="date" tickFormatter={fmtDate} ticks={ticks} tick={axisTick} axisLine={axisLineProps} tickLine={false} />
          <YAxis tickFormatter={gbpCompact} tick={axisTick} width={56} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v) => [gbp(v), "Saving to date"]} labelFormatter={fmtDate} {...tooltipProps} />
          <ReferenceLine y={0} stroke={CHART_COLORS.grey} />
          <Line dataKey="cumulative" stroke={CHART_COLORS.data} dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
