import { gbp, gbpCompact, pct, num, count, DASH } from "../../format";
import useRollingNumber from "../../hooks/useRollingNumber";

// Large figures switch to £28.9m so they never run into the next cell.
const money = (v) => (Math.abs(v) >= 1e7 ? gbpCompact(v) : gbp(v));

// The answer first: one divided container. The lead cell is the year-1
// saving of the best scenario; NPV, IRR, payback and capex sit beside it
// as plain figures. Colour only says good or bad on NPV and IRR.

function Cell({ label, value, unit, caption, lead, tone, loading }) {
  const color = tone === "bad" ? "var(--negative)" : tone === "good" ? "var(--positive)" : "var(--ink)";
  return (
    <div style={{ padding: "16px 20px", minWidth: 0 }}>
      <div style={{ fontSize: 14, color: "var(--muted)" }}>{label}</div>
      <div className={`tnum${lead ? " figure-lg" : ""}`} style={{ marginTop: 4, fontSize: lead ? 30 : 22, lineHeight: lead ? "36px" : "28px", fontWeight: lead ? 700 : 500, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {loading ? <span aria-hidden="true" style={{ display: "inline-block", width: lead ? 160 : 90, height: lead ? 30 : 22, background: "var(--raised)", borderRadius: 4, verticalAlign: "middle" }} /> : value}
        {!loading && unit && <span style={{ fontSize: 14, fontWeight: 400, color: "var(--muted)", marginLeft: 4 }}>{unit}</span>}
      </div>
      {caption && <div style={{ marginTop: 4, fontSize: 12, lineHeight: "16px", color: "var(--muted)" }}>{caption}</div>}
    </div>
  );
}

export default function LeadStrip({ inv, effPct, lifetime, loading }) {
  const pending = loading && !inv;
  // Figures roll to new values when an assumption changes (never on load).
  const saving = useRollingNumber(inv?.annual_benefit_yr1_gbp ?? null);
  const npv = useRollingNumber(inv?.npv_gbp ?? null);
  const capex = useRollingNumber(inv?.capex_gbp ?? null);
  const irr = useRollingNumber(inv?.irr_pct ?? null);
  const npvTone = inv ? (inv.npv_gbp >= 0 ? "good" : "bad") : null;
  const irrTone = inv?.irr_pct != null ? (inv.irr_pct >= 0 ? null : "bad") : null;
  return (
    <div
      className="lead-strip"
      style={{
        display: "grid",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <Cell
        lead
        label="Year-1 saving, best size"
        value={inv ? money(saving) : DASH}
        unit="/yr"
        loading={pending}
        caption={inv
          ? `On the site bill, vs no battery on the same tariff. Realistic case: ${num(effPct, 0)}% of the ${gbp(inv.annual_benefit_ceiling_yr1_gbp)}/yr perfect-foresight backtest.`
          : "On the site bill, vs no battery on the same tariff."}
      />
      <Cell label="NPV" value={inv ? money(npv) : DASH} tone={npvTone} loading={pending}
        caption={inv ? `Over ${count(lifetime, "year")}, after capex and opex` : null} />
      <Cell label="IRR" value={inv?.irr_pct != null ? pct(irr, 1) : DASH} tone={irrTone} loading={pending}
        caption={inv && inv.irr_pct == null ? "No rate makes NPV zero" : "Compare with your hurdle rate"} />
      <Cell label="Payback" loading={pending}
        value={inv ? (inv.payback_yrs != null ? num(inv.payback_yrs, 1) : `> ${lifetime}`) : DASH}
        unit={inv ? (inv.payback_yrs != null && num(inv.payback_yrs, 1) === "1.0" ? "year" : "years") : null}
        caption={inv ? (inv.discounted_payback_yrs != null ? `${count(inv.discounted_payback_yrs, "year", 1)} discounted` : "Not within the design life") : null} />
      <Cell label="Capex" value={inv ? money(capex) : DASH} loading={pending}
        caption={inv ? `Opex ${gbp(inv.annual_opex_yr1_gbp)}/yr` : null} />
    </div>
  );
}
