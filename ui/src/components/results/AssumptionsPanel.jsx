import { useId } from "react";
import { INVESTMENT_FIELDS } from "../../hooks/useInvestment";
import { num, date } from "../../format";

const heading = { margin: "0 0 8px", fontSize: "var(--fs-section)", lineHeight: "24px", fontWeight: 500 };
const panel = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-card)", padding: 20 };

/** Editable investment assumptions; every change re-prices all scenarios. */
export function InvestmentInputs({ form, setForm, loading, error, invalid = {}, warnings }) {
  const base = useId();
  return (
    <section aria-labelledby={`${base}-h`} style={panel}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h2 id={`${base}-h`} style={heading}>Investment assumptions</h2>
        <span aria-live="polite" style={{ fontSize: 12, color: "var(--muted)" }}>{loading ? "Recalculating…" : ""}</span>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--muted)" }}>
        Placeholders, not market data. Replace them with your quotes; every figure updates.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {INVESTMENT_FIELDS.map((f) => {
          const id = `${base}-${f.key}`;
          const wide = f.key === "dispatch_efficiency_pct";
          return (
            <div key={f.key} style={{ gridColumn: wide ? "1 / -1" : undefined, minWidth: 0 }}>
              <label htmlFor={id} style={{ display: "block", fontSize: 14, fontWeight: 500, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.label}<span className="sr-only">, {f.unit}</span>
              </label>
              <div style={{ position: "relative" }}>
              <input
                id={id}
                name={f.key}
                type="number"
                inputMode="decimal"
                autoComplete="off"
                step={f.step}
                value={form[f.key]}
                aria-describedby={invalid[f.key] ? `${id}-err ${id}-hint` : `${id}-hint`}
                aria-invalid={invalid[f.key] ? true : undefined}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                className="tnum"
                style={{ width: "100%", height: 36, padding: "0 10px", paddingRight: f.unit.length > 6 ? 96 : 52, border: "1px solid var(--control)", borderRadius: "var(--radius-control)" }}
              />
              <span aria-hidden="true" style={{ position: "absolute", right: 10, top: 0, lineHeight: "36px", fontSize: 12, color: "var(--muted)", pointerEvents: "none", whiteSpace: "nowrap" }}>{f.unit}</span>
              </div>
              {invalid[f.key] && <div id={`${id}-err`} style={{ marginTop: 4, fontSize: 12, lineHeight: "16px", color: "var(--negative)", fontWeight: 500 }}>{invalid[f.key]}</div>}
              <div id={`${id}-hint`} style={{ marginTop: 4, fontSize: 12, lineHeight: "16px", color: "var(--muted)" }}>{f.hint}</div>
            </div>
          );
        })}
      </div>
      {error && <p role="alert" style={{ margin: "12px 0 0", fontSize: 14, color: "var(--negative)" }}>Couldn&rsquo;t price the scenarios: {error}. Check the inputs above.</p>}
      {warnings?.map((w, i) => (
        <p key={i} style={{ margin: "12px 0 0", fontSize: 12, padding: "8px 12px", borderRadius: 6, background: "var(--pill-warning-bg)", border: "1px solid var(--pill-warning-line)", color: "var(--pill-warning-ink)" }}>{w}</p>
      ))}
    </section>
  );
}

/** What this run was given: tariff, connection, battery and data. */
export function RunInputs({ runInputs, dataPeriod, mode, bare }) {
  const base = useId();
  const r = runInputs || {};
  const dp = dataPeriod || {};
  const rows = [
    ["Data", r.fileName],
    ["Period", dp.start ? `${date(dp.start)} to ${date(dp.end)}` : null],
    ["Coverage", dp.coverage_days != null ? `${num(dp.coverage_days, 1)} days, ${dp.resolution}` : null],
    ["DNO tariff", r.dnoLabel ? `${r.dnoLabel}, ${r.voltage}` : null],
    ["Import cap (MIC)", dp.import_cap_kw != null ? `${num(dp.import_cap_kw, 0)} kW${dp.mic_source === "assumed_peak" ? ", assumed from peak" : ""}` : null],
    ["Power factor", dp.power_factor != null ? num(dp.power_factor, 2) : null],
    ["Price signal", r.priceExposure === "imbalance" ? "System imbalance price" : r.priceExposure ? "Elexon market index (day-ahead proxy)" : null],
    ["Round trip efficiency", r.rtePct != null ? `${num(r.rtePct, 0)}%` : null],
    ["Cycles", r.maxCycles != null ? `up to ${num(r.maxCycles, 1)} a day` : null],
    ["State of charge", r.socMin != null ? `${num(r.socMin, 0)}% to ${num(r.socMax, 0)}%` : null],
    ["Wear cost in dispatch", r.degCost != null ? `£${num(r.degCost, 0)}/MWh` : null],
    ["Non-energy charges", r.nec != null ? `£${num(r.nec, 2)}/MWh` : null],
  ].filter(([, v]) => v != null && v !== "");
  if (!rows.length && mode !== "archetype") return null;
  return (
    <section aria-labelledby={`${base}-h`} style={bare ? undefined : panel}>
      <h2 id={`${base}-h`} style={heading}>This run</h2>
      {mode === "archetype" && (
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--muted)" }}>Representative demand profile, not a real site.</p>
      )}
      <dl className="tnum" style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 14 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <dt style={{ color: "var(--muted)" }}>{k}</dt>
            <dd style={{ margin: 0, textAlign: "right", overflowWrap: "anywhere" }}>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Model scope, stated plainly: what it counts and what it leaves out. */
export function ModelScope({ bare }) {
  const base = useId();
  const li = { margin: "0 0 6px" };
  return (
    <section aria-labelledby={`${base}-h`} style={bare ? { marginTop: 20 } : panel}>
      <h2 id={`${base}-h`} style={heading}>What this model includes</h2>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
        <li style={li}>Half-hourly dispatch against wholesale price, DUoS bands and non-energy charges</li>
        <li style={li}>Your DNO&rsquo;s 2026/27 DUoS unit rates by band and voltage</li>
        <li style={li}>Export limit and import cap at the meter</li>
        <li style={li}>Battery efficiency, charge limits, cycle cap and wear</li>
        <li style={li}>Capex, opex, capacity fade, escalation and discounting</li>
      </ul>
      <h2 style={{ ...heading, margin: "16px 0 8px" }}>What it leaves out</h2>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
        <li style={li}>Forecast error: dispatch sees prices perfectly within 3-day windows, so the backtest is an upper bound. The dispatch efficiency setting turns it into a realistic case.</li>
        <li style={li}>Capacity charge savings from a lower MIC, and excess capacity charges</li>
        <li style={li}>Balancing Mechanism, Capacity Market and ancillary services</li>
        <li style={li}>Year-by-year re-optimisation: ageing is a flat capacity fade</li>
        <li style={li}>Tax, financing and battery augmentation</li>
      </ul>
    </section>
  );
}

/** The run's inputs and the model's scope, folded away under one summary. */
export function ScopeDetails({ runInputs, dataPeriod, mode }) {
  return (
    <details style={{ ...panel, padding: 0 }}>
      <summary style={{ padding: "16px 20px", cursor: "pointer", fontSize: "var(--fs-section)", fontWeight: 500 }}>
        Inputs and model scope
      </summary>
      <div style={{ padding: "0 20px 20px" }}>
        <RunInputs runInputs={runInputs} dataPeriod={dataPeriod} mode={mode} bare />
        <ModelScope bare />
      </div>
    </details>
  );
}
