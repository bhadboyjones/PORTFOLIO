import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from "recharts";
import Card from "./Card";
import { CHART_COLORS, tooltipProps, axisTick, axisLineProps, gridProps } from "../chartTheme";
import { gbp, gbpCompact, num } from "../../format";
import { micRows } from "../../lib/results";

const th = { padding: "6px 8px", fontSize: 12, fontWeight: 500, color: "var(--muted)", textAlign: "right", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 14, textAlign: "right", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };
const first = { textAlign: "left" };

// How far the site can cut its MIC and what each cut is worth a year. The
// first row is the natural peak: headroom the site has without any battery.
export default function MicCard({ sweep, annual, applied, onApply }) {
  const rows = micRows(sweep, annual);
  const best = rows.find((r) => r.mic_kva === sweep.best_mic_kva);
  const headroom = rows.find((r) => r.share === 0);

  return (
    <Card
      id="mic"
      title="Agreed import capacity (MIC)"
      subtitle={best
        ? `Cutting from ${num(sweep.current_kva, 0)} to ${num(best.mic_kva, 0)} kVA is worth ${gbp(best.value)}/yr on ${sweep.scenario_label}, after capacity, arbitrage and excess.`
        : `No cut below ${num(sweep.current_kva, 0)} kVA pays on ${sweep.scenario_label}.`}
      csv={{
        filename: "flexiq-mic-sweep.csv",
        rows,
        columns: [["mic_kva", "MIC (kVA)"], ["reduction_kva", "Cut (kVA)"], ["capacity", "Capacity saved (GBP/yr)"], ["dispatch", "Dispatch change (GBP/yr)"], ["excess", "Excess change (GBP/yr)"], ["value", "Value (GBP/yr)"], ["months_breached", "Months breached"]],
      }}
    >
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 180 }}>
          <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" tick={axisTick} axisLine={axisLineProps} tickLine={false} interval={0} />
            <YAxis domain={[(min) => Math.min(0, min), (max) => Math.max(0, max)]} tickFormatter={gbpCompact} tick={axisTick} width={64} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [`${gbp(v)}/yr`, "Value"]} {...tooltipProps} />
            <Bar dataKey="value" isAnimationActive={false}>
              {rows.map((r) => <Cell key={r.mic_kva} fill={r === best ? CHART_COLORS.data : CHART_COLORS.lightGrey} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table className="tnum" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...th, ...first }}>MIC</th>
              <th scope="col" style={th}>Capacity saved</th>
              <th scope="col" style={th}>Arbitrage change</th>
              <th scope="col" style={th}>Excess change</th>
              <th scope="col" style={th}>Value/yr</th>
              <th scope="col" style={th}>Months over</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mic_kva} style={r === best ? { fontWeight: 600 } : undefined}>
                <th scope="row" style={{ ...td, ...first, fontWeight: "inherit" }}>{num(r.mic_kva, 0)} kVA</th>
                <td style={td}>{gbp(r.capacity)}</td>
                <td style={td}>{gbp(r.dispatch, { sign: true })}</td>
                <td style={td}>{gbp(r.excess, { sign: true })}</td>
                <td style={td}>{gbp(r.value)}</td>
                <td style={td}>{num(r.months_breached, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {headroom && (
        <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--muted)" }}>
          The site's natural peak is {num(sweep.peak_kva, 0)} kVA, so {num(headroom.reduction_kva, 0)} kVA of any cut is existing headroom. The battery isn't needed for that part.
        </p>
      )}
      <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--muted)" }}>
        Check before acting: DNOs checked so far allow one reduction in 12 months, and released capacity may not come back without reinforcement costs.
      </p>

      {best && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 14 }}>
          <input type="checkbox" checked={applied} onChange={(e) => onApply(e.target.checked)} />
          Add this cut to the investment case
        </label>
      )}
    </Card>
  );
}
