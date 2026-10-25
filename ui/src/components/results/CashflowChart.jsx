import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceDot,
  CartesianGrid, ResponsiveContainer,
} from "recharts";
import Card from "./Card";
import { CHART_COLORS, tooltipProps, axisTick, axisLineProps, gridProps } from "../chartTheme";
import { gbp, gbpCompact, num } from "../../format";

// Cumulative discounted cashflow of the selected scenario (the one hue)
// against doing nothing (the grey zero line). Payback is where they cross.
export default function CashflowChart({ inv, label, lifetime, discountPct, available = true }) {
  if (!inv) {
    return (
      <Card id="cashflow" title="Cashflow against no battery">
        <p style={{ margin: 0, color: "var(--muted)" }}>{available ? "Calculating the investment case…" : "No investment case for this run: the battery size could not be read."}</p>
      </Card>
    );
  }
  const data = inv.cumulative_discounted.map((v, year) => ({ year, battery: v }));
  const pb = inv.discounted_payback_yrs;
  const values = data.map((d) => d.battery);
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values);

  return (
    <Card
      id="cashflow"
      title="Cashflow against no battery"
      subtitle={`${label}. Cumulative, discounted at ${num(discountPct, 1)}%/yr.`}
      csv={{
        filename: "flexiq-cashflow.csv",
        rows: data.map((d) => ({ ...d, scenario: label })),
        columns: [["scenario", "Scenario"], ["year", "Year"], ["battery", "Cumulative discounted cashflow (GBP)"]],
      }}
    >
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="year" type="number" domain={[0, lifetime]} tickCount={6} allowDecimals={false}
              tick={axisTick} axisLine={axisLineProps} tickLine={false}
              tickFormatter={(y) => (y === 0 ? "Year 0" : `${y}`)} />
            <YAxis tickFormatter={gbpCompact} tick={axisTick} width={64} axisLine={false} tickLine={false}
              domain={[lo, hi]} />
            <Tooltip formatter={(v) => [gbp(v), "Battery, cumulative"]} labelFormatter={(y) => `End of year ${y}`} {...tooltipProps} />
            <ReferenceLine y={0} stroke={CHART_COLORS.grey} strokeWidth={2}
              label={{ value: "No battery", position: "insideTopLeft", fill: CHART_COLORS.axisText, fontSize: 12 }} />
            <Line dataKey="battery" stroke={CHART_COLORS.data} strokeWidth={2} dot={false} isAnimationActive={false} />
            {pb != null && (
              <ReferenceDot x={pb} y={0} r={4} fill={CHART_COLORS.data} stroke="#fff"
                label={{ value: `Payback ${num(pb, 1)} yrs`, position: "top", fill: CHART_COLORS.paper, fontSize: 12 }} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
        {pb != null
          ? `Discounted payback in year ${num(pb, 1)}. The line ends at the NPV, ${gbp(inv.npv_gbp)}.`
          : `The line stays below zero for all ${lifetime} years: no discounted payback. It ends at the NPV, ${gbp(inv.npv_gbp)}.`}
      </p>
    </Card>
  );
}
