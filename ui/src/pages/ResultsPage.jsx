import { useMemo, useState } from "react";
import DownloadButton from "../components/DownloadButton";
import Tabs from "../components/Tabs";
import LeadStrip from "../components/results/LeadStrip";
import ScenarioTable from "../components/results/ScenarioTable";
import CashflowChart from "../components/results/CashflowChart";
import BillChart from "../components/results/BillChart";
import SizeChart from "../components/results/SizeChart";
import TypicalDay from "../components/results/TypicalDay";
import OperationDetail from "../components/results/OperationDetail";
import Card from "../components/results/Card";
import { InvestmentInputs, RunInputs, ModelScope } from "../components/results/AssumptionsPanel";
import useInvestment, { defaultInvestmentForm, scenarioKey, sizeLabel } from "../hooks/useInvestment";
import { gbp, num, date } from "../format";

// Screen question: does a battery pay on this site, and which size?
// The title row answers it; the lead strip carries the figures; the
// charts below show the selected scenario (the best NPV until you pick one).

const DISPLAY_NAMES = {
  small_office:      "Small commercial",
  medium_industrial: "Mid-size industrial",
  large_industrial:  "Large industrial",
};

const labelOf = (s) => `${sizeLabel(s)}, ${num(s.export_limit_mw, s.export_limit_mw % 1 ? 1 : 0)} MW export`;

// Days of data actually covered: rows × interval. CSV runs send it; archetype
// runs don't, so derive it from the timeseries the same way.
function coverageDays(dataPeriod, scenarios) {
  if (dataPeriod?.coverage_days) return dataPeriod.coverage_days;
  const ts = scenarios[0]?.dispatch_timeseries ?? [];
  if (ts.length < 2) return null;
  const step = (new Date(ts[1].startTime.replace(" ", "T")) - new Date(ts[0].startTime.replace(" ", "T"))) / 3.6e6;
  return step > 0 ? (ts.length * step) / 24 : null;
}

function finding(best, inv, lifetime) {
  if (!best || !inv) return null;
  const name = labelOf(best);
  if (inv.npv_gbp >= 0) {
    return inv.payback_yrs != null
      ? `${name} pays back in ${num(inv.payback_yrs, 1)} years, with an NPV of ${gbp(inv.npv_gbp)}.`
      : `${name} has the best NPV, ${gbp(inv.npv_gbp)}.`;
  }
  return `No size pays back over ${lifetime} years at these assumptions. The closest, ${name}, has an NPV of ${gbp(inv.npv_gbp)}.`;
}

export default function ResultsPage({ results, jobId, mode, validationWarnings, dataPeriod, bands, runInputs }) {
  const archetypeIds = Object.keys(results);
  const [archIdx, setArchIdx] = useState(0);
  const scenarios = results[archetypeIds[archIdx]] || [];
  const nDays = coverageDays(dataPeriod, scenarios);

  const [form, setForm] = useState(defaultInvestmentForm);
  const inv = useInvestment(scenarios, nDays, form);
  const lifetime = inv.assumptions?.lifetime_yrs ?? 15;
  const effPct = inv.assumptions?.dispatch_efficiency_pct ?? 85;

  // Best = highest NPV once priced; until then, highest backtest benefit.
  const bestKey = useMemo(() => {
    if (inv.byKey.size) {
      let top = null;
      for (const [k, v] of inv.byKey) if (!top || v.npv_gbp > top[1].npv_gbp) top = [k, v];
      return top?.[0] ?? null;
    }
    const s = [...scenarios].sort((a, b) => b.net_benefit_gbp - a.net_benefit_gbp)[0];
    return s ? scenarioKey(s) : null;
  }, [inv.byKey, scenarios]);

  const [picked, setPicked] = useState(null);
  const selectedKey = picked && scenarios.some((s) => scenarioKey(s) === picked) ? picked : bestKey;
  const selected = scenarios.find((s) => scenarioKey(s) === selectedKey) ?? scenarios[0];
  const best = scenarios.find((s) => scenarioKey(s) === bestKey);
  const bestInv = bestKey ? inv.byKey.get(bestKey) : null;
  const selInv = selected ? inv.byKey.get(scenarioKey(selected)) : null;
  const selLabel = selected ? labelOf(selected) : "";
  const annual = nDays ? 365 / nDays : 1;

  const subtitle = [
    runInputs?.fileName,
    runInputs?.dnoLabel && `${runInputs.dnoLabel} ${runInputs.voltage}`,
    dataPeriod?.start && `${date(dataPeriod.start)} to ${date(dataPeriod.end)}`,
    nDays && `${num(nDays, 0)} days of data`,
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ maxWidth: 1320, margin: "0 auto", padding: "32px 24px 64px" }}>
      {/* Title row: the answer, and the one primary action */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ margin: 0, fontSize: "var(--fs-title)", lineHeight: "32px", fontWeight: 700, letterSpacing: "-0.01em" }}>
            {mode === "archetype" ? "Archetype appraisal" : "Site appraisal"}
          </h1>
          {subtitle && <p className="tnum" style={{ margin: "4px 0 0", fontSize: 14, color: "var(--muted)" }}>{subtitle}</p>}
          <p aria-live="polite" style={{ margin: "8px 0 0", fontSize: 16, lineHeight: "24px" }}>
            {finding(best, bestInv, lifetime) ?? (inv.available ? "Pricing the investment case…" : "")}
          </p>
        </div>
        <DownloadButton jobId={jobId} />
      </div>

      {archetypeIds.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <Tabs
            tabs={archetypeIds.map((id) => DISPLAY_NAMES[id] ?? id)}
            active={archIdx}
            onSelect={(i) => { setArchIdx(i); setPicked(null); }}
            label="Archetype site"
          />
        </div>
      )}

      {validationWarnings?.length > 0 && (
        <div role="status" style={{
          marginTop: 16, padding: "10px 14px", borderRadius: "var(--radius-card)",
          background: "var(--pill-warning-bg)", border: "1px solid var(--pill-warning-line)",
          color: "var(--pill-warning-ink)", fontSize: 14,
        }}>
          {validationWarnings.map((w, i) => <p key={i} style={{ margin: i ? "4px 0 0" : 0 }}>{w}</p>)}
        </div>
      )}

      <div className="results-grid" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)", minWidth: 0 }}>
          {inv.available ? (
            <LeadStrip inv={bestInv} effPct={effPct} lifetime={lifetime} loading={inv.loading || !bestInv} />
          ) : null}

          {selected && (
            <div className="pair">
              <CashflowChart available={inv.available} inv={selInv} label={selLabel} lifetime={lifetime} discountPct={inv.assumptions?.discount_rate_pct ?? 8} />
              <BillChart scenario={selected} label={selLabel} annual={annual} nDays={nDays ?? 0} />
            </div>
          )}

          <Card
            id="sizes"
            title="Battery sizes compared"
            subtitle={`${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"}. Select one to show it in the charts.`}
            csv={inv.byKey.size ? {
              filename: "flexiq-scenarios.csv",
              rows: scenarios.map((s) => {
                const v = inv.byKey.get(scenarioKey(s)) || {};
                return {
                  size: sizeLabel(s), export: s.export_limit_mw, backtest: s.net_benefit_gbp,
                  saving: v.annual_benefit_yr1_gbp, capex: v.capex_gbp, npv: v.npv_gbp, irr: v.irr_pct,
                  payback: v.payback_yrs, dpayback: v.discounted_payback_yrs,
                };
              }),
              columns: [["size", "Battery size"], ["export", "Export limit (MW)"], ["backtest", "Backtest saving over data period (GBP)"], ["saving", "Year-1 saving, realistic (GBP)"], ["capex", "Capex (GBP)"], ["npv", "NPV (GBP)"], ["irr", "IRR (%)"], ["payback", "Payback (years)"], ["dpayback", "Discounted payback (years)"]],
            } : null}
          >
            <ScenarioTable
              scenarios={scenarios}
              byKey={inv.byKey}
              selectedKey={selectedKey}
              onSelect={setPicked}
              bestKey={inv.byKey.size ? bestKey : null}
              lifetime={lifetime}
            />
          </Card>

          <div className="pair">
            <SizeChart scenarios={scenarios} byKey={inv.byKey} available={inv.available} />
            {selected && <TypicalDay scenario={selected} label={selLabel} bands={mode === "csv" ? bands : null} />}
          </div>

          {selected && <OperationDetail scenario={selected} label={selLabel} />}
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: "var(--gap)", minWidth: 0 }} aria-label="Assumptions and model scope">
          {inv.available && (
            <InvestmentInputs form={form} setForm={setForm} loading={inv.loading} error={inv.error} warnings={inv.result?.warnings} />
          )}
          <RunInputs runInputs={runInputs} dataPeriod={dataPeriod} mode={mode} />
          <ModelScope />
        </aside>
      </div>
    </div>
  );
}
