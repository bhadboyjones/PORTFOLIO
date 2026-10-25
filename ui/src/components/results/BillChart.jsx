import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LabelList,
} from "recharts";
import Card from "./Card";
import { CHART_COLORS, tooltipProps, axisTick, axisLineProps, gridProps } from "../chartTheme";
import { gbp, gbpCompact, num } from "../../format";

// Annual site bill without vs with the battery, split by component, each
// pair labelled with its % change. Scaled from the data period to a year.
// This is the perfect-foresight backtest after battery wear, so its saving
// is larger than the realistic year-1 figure in the lead strip.

export function billRows(s, annual) {
  const k = annual;
  const rows = [
    {
      part: "Imports",
      without: s.baseline_import_cost_gbp * k,
      with: (s.baseline_import_cost_gbp - s.dis1_saving_gbp + s.charge2_cost_gbp) * k,
    },
  ];
  const exportWo = s.baseline_export_rev_gbp;
  const exportW = s.baseline_export_rev_gbp + s.dis2_revenue_gbp - s.charge1_opp_cost_gbp;
  if (Math.abs(exportWo) > 0.5 || Math.abs(exportW) > 0.5) {
    rows.push({ part: "Export", without: exportWo * k, with: exportW * k });
  }
  if ((s.baseline_thermal_cost_gbp ?? 0) > 0.5) {
    rows.push({ part: "Fuel", without: s.baseline_thermal_cost_gbp * k, with: s.baseline_thermal_cost_gbp * k });
  }
  rows.push({ part: "Standing", without: s.total_standing_gbp * k, with: s.total_standing_gbp * k });
  rows.push({ part: "Wear", without: 0, with: (s.deg_cost_gbp ?? 0) * k });
  rows.push({ part: "Net bill", without: s.site_cost_wo_bess_gbp * k, with: s.site_cost_w_bess_gbp * k });
  for (const r of rows) {
    r.change = Math.abs(r.without) > 0.5 ? ((r.with - r.without) / Math.abs(r.without)) * 100 : null;
    r.changeLabel = r.change == null ? (r.with > 0.5 ? "new" : "") : `${num(r.change, 0, { sign: true })}%`;
  }
  return rows;
}

export default function BillChart({ scenario, label, annual, nDays }) {
  const rows = billRows(scenario, annual);
  const net = rows[rows.length - 1];
  const saving = net.without - net.with;

  return (
    <Card
      id="bill"
      title="Annual site bill"
      subtitle={`${label}. Backtest saving ${gbp(saving)}/yr (perfect foresight, after wear), scaled from ${num(nDays, 0)} days. Standing charges and export credit are unchanged unless shown.`}
      csv={{
        filename: "flexiq-annual-bill.csv",
        rows: rows.map((r) => ({ ...r, scenario: label })),
        columns: [["scenario", "Scenario"], ["part", "Component"], ["without", "Without battery (GBP/yr)"], ["with", "With battery (GBP/yr)"], ["change", "Change (%)"]],
      }}
    >
      <ul style={{ display: "flex", gap: 16, margin: "0 0 8px", padding: 0, listStyle: "none", fontSize: 12, color: "var(--muted)" }}>
        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Swatch c={CHART_COLORS.lightGrey} />Without battery</li>
        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Swatch c={CHART_COLORS.data} />With battery</li>
      </ul>
      <div style={{ height: 212 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="part" tick={{ ...axisTick, fontSize: 12 }} axisLine={axisLineProps} tickLine={false} interval={0} />
            <YAxis tickFormatter={gbpCompact} tick={axisTick} width={64} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [`${gbp(v)}/yr`, n === "without" ? "Without battery" : "With battery"]} {...tooltipProps} />
            <Bar dataKey="without" fill={CHART_COLORS.lightGrey} isAnimationActive={false} />
            <Bar dataKey="with" fill={CHART_COLORS.data} isAnimationActive={false}>
              <LabelList dataKey="changeLabel" position="top" fill={CHART_COLORS.paper} fontSize={12} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Swatch({ c }) {
  return <span aria-hidden="true" style={{ width: 10, height: 10, background: c }} />;
}
