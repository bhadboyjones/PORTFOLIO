import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceArea, ReferenceLine,
  CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";
import Card from "./Card";
import { averageDay, bandRuns, hhmm, niceTicks } from "../../lib/results";
import { BAND_COLORS, STREAM_COLORS, CHART_COLORS, tooltipProps, axisTick, axisLineProps, gridProps } from "../chartTheme";
import { DEFAULT_WEEKDAY_BANDS } from "../dayTapeBands";
import { num } from "../../format";

// The signature: how the battery runs on an average day, drawn over the
// DUoS bands it is trading against. Discharge above zero, charge below.

export default function TypicalDay({ scenario, label, bands }) {
  const data = useMemo(() => averageDay(scenario?.dispatch_timeseries ?? []), [scenario]);
  const runs = bandRuns(bands && bands.length ? bands : DEFAULT_WEEKDAY_BANDS);
  const step = data.length > 1 ? data[1].mins - data[0].mins : 30;
  const peak = Math.max(0.1, ...data.map((d) => Math.abs(d.net)));
  const yAxis = niceTicks(-peak, peak, 4);
  const redRuns = runs.filter((r) => r.band === "red");
  const redShare = (() => {
    const inRed = (m) => redRuns.some((r) => m >= r.start && m < r.end);
    const total = data.reduce((a, d) => a + d.discharge, 0);
    return total > 0 ? (data.filter((d) => inRed(d.mins)).reduce((a, d) => a + d.discharge, 0) / total) * 100 : null;
  })();

  return (
    <Card
      id="day"
      title="How the battery runs on an average day"
      subtitle={`${label}. Average power by time of day (MW) over the DUoS bands.`}
      csv={{
        filename: "flexiq-average-day.csv",
        rows: data.map((d) => ({ ...d, scenario: label })),
        columns: [["scenario", "Scenario"], ["time", "Time"], ["discharge", "Average discharge (MW)"], ["charge", "Average charge (MW)"], ["net", "Net (MW, discharge positive)"]],
      }}
    >
      <ul style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", margin: "0 0 8px", padding: 0, listStyle: "none", fontSize: 12, color: "var(--muted)" }}>
        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Sw c={STREAM_COLORS.demandOffset} />Discharge</li>
        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Sw c={STREAM_COLORS.gridCharge} />Charge</li>
        {["green", "amber", "red"].map((b) => (
          <li key={b} style={{ display: "flex", alignItems: "center", gap: 6 }}><Sw c={BAND_COLORS[b]} o={0.18} />{b[0].toUpperCase() + b.slice(1)} band</li>
        ))}
      </ul>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 200 }}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap={1}>
            {runs.map((r, i) => (
              <ReferenceArea key={i} x1={hhmm(r.start)} x2={hhmm(Math.min(r.end, 1440 - step))}
                fill={BAND_COLORS[r.band]} fillOpacity={0.1} strokeOpacity={0} ifOverflow="extendDomain" />
            ))}
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="time" tick={axisTick} axisLine={axisLineProps} tickLine={false}
              ticks={data.filter((d) => d.mins % 360 === 0).map((d) => d.time)} />
            <YAxis tickFormatter={(v) => num(v, yAxis.decimals)} tick={axisTick} width={44} axisLine={false} tickLine={false}
              domain={yAxis.domain} ticks={yAxis.ticks} />
            <Tooltip formatter={(v) => [`${num(v, 2)} MW`, v >= 0 ? "Average discharge" : "Average charge"]} labelFormatter={(t) => `${t}`} {...tooltipProps} />
            <ReferenceLine y={0} stroke={CHART_COLORS.grey} />
            <Bar dataKey="net" isAnimationActive={false}>
              {data.map((d) => <Cell key={d.mins} fill={d.net >= 0 ? STREAM_COLORS.demandOffset : STREAM_COLORS.gridCharge} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {redShare != null && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
          {num(redShare, 0)}% of discharge falls in the red band, when imports cost most.
        </p>
      )}
    </Card>
  );
}

function Sw({ c, o = 1 }) {
  return <span aria-hidden="true" style={{ width: 10, height: 10, background: c, opacity: o === 1 ? 1 : 0.35 }} />;
}
