import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import Card from "./Card";
import { SERIES, tooltipProps, axisTick, axisLineProps, gridProps } from "../chartTheme";
import { gbp, gbpCompact, num } from "../../format";
import { scenarioKey, scenarioDims, sizeLabel } from "../../hooks/useInvestment";
import { niceTicks } from "../../lib/results";

// Year-1 saving by battery size, one line per export limit. Sizes run
// smallest energy first, then power, so the x axis reads left to right.
export default function SizeChart({ scenarios, byKey, available = true }) {
  const limits = [...new Set(scenarios.map((s) => s.export_limit_mw))].sort((a, b) => a - b).slice(0, 4);
  const dim = (s, k) => scenarioDims(s)?.[k] ?? 0;
  const sizes = [...new Map(scenarios.map((s) => [s.scenario_label, s])).values()]
    .sort((a, b) => dim(a, "capacity_mwh") - dim(b, "capacity_mwh") || dim(a, "power_mw") - dim(b, "power_mw"))
    .map((s) => s.scenario_label);

  const nameOf = (l) => `${num(l, l % 1 ? 1 : 0)} MW export`;
  const data = sizes.map((label) => {
    const point = { size: sizeLabel(scenarios.find((x) => x.scenario_label === label)) };
    for (const l of limits) {
      const s = scenarios.find((x) => x.scenario_label === label && x.export_limit_mw === l);
      const inv = s && byKey.get(scenarioKey(s));
      point[nameOf(l)] = inv ? inv.annual_benefit_yr1_gbp : null;
    }
    return point;
  });
  const ready = byKey.size > 0;
  // When every export limit gives the same saving (within 0.5%), the lines
  // would sit on top of each other: draw one and say why.
  const same = limits.length > 1 && data.every((p) => {
    const v = limits.map((l) => p[nameOf(l)]).filter((x) => x != null);
    return v.length && Math.max(...v) - Math.min(...v) <= Math.max(1, 0.005 * Math.abs(Math.max(...v)));
  });
  const drawn = same ? limits.slice(0, 1) : limits;
  const vals = data.flatMap((p) => drawn.map((l) => p[nameOf(l)])).filter((v) => v != null);
  const yAxis = niceTicks(Math.min(0, ...vals), Math.max(1000, ...vals), 4);

  return (
    <Card
      id="size"
      title="Saving by battery size"
      subtitle={same ? "Year-1 saving. Raising the export limit adds nothing at these sizes." : limits.length > 1 ? "Year-1 saving, one line per export limit" : `Year-1 saving at ${nameOf(limits[0] ?? 0)}`}
      csv={ready ? {
        filename: "flexiq-saving-by-size.csv",
        rows: data,
        columns: [["size", "Battery size"], ...limits.map((l) => [nameOf(l), `${nameOf(l)} (GBP/yr)`])],
      } : null}
    >
      {drawn.length > 1 && (
        <ul style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", margin: "0 0 8px", padding: 0, listStyle: "none", fontSize: 12, color: "var(--muted)" }}>
          {drawn.map((l, i) => (
            <li key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden="true" style={{ width: 12, height: 2, background: SERIES[i] }} />{nameOf(l)}
            </li>
          ))}
        </ul>
      )}
      {!ready ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>{available ? "Calculating the investment case…" : "No investment case for this run."}</p>
      ) : (
        <div style={{ height: 212 }}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 200 }}>
            <LineChart data={data} margin={{ top: 8, right: 28, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="size" tick={{ ...axisTick, fontSize: 12 }} axisLine={axisLineProps} tickLine={false} interval="preserveStartEnd" padding={{ left: 12, right: 12 }} />
              <YAxis tickFormatter={gbpCompact} ticks={yAxis.ticks} domain={yAxis.domain} tick={axisTick} width={64} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, n) => [`${gbp(v)}/yr`, n]} {...tooltipProps} />
              {drawn.map((l, i) => (
                <Line key={l} dataKey={nameOf(l)} stroke={SERIES[i]} strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: SERIES[i] }} isAnimationActive={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
