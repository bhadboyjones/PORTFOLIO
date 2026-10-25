import { useMemo, useState } from "react";
import { gbp, pct, num, DASH } from "../../format";
import { scenarioKey, scenarioDims, sizeLabel } from "../../hooks/useInvestment";

// Every battery size × export limit, sortable. Clicking a row selects the
// scenario the charts below show. Below 640px the table becomes two-line rows.

const COLUMNS = [
  { key: "label",   header: "Battery size",  align: "left" },
  { key: "export",  header: "Export limit",  align: "right" },
  { key: "saving",  header: "Year-1 saving", align: "right" },
  { key: "capex",   header: "Capex",         align: "right" },
  { key: "npv",     header: "NPV",           align: "right" },
  { key: "irr",     header: "IRR",           align: "right" },
  { key: "payback", header: "Payback",       align: "right" },
];

function rowsFrom(scenarios, byKey) {
  return scenarios.map((s) => {
    const inv = byKey.get(scenarioKey(s));
    return {
      key: scenarioKey(s),
      s,
      label: sizeLabel(s),
      cap: scenarioDims(s)?.capacity_mwh ?? 0,
      pw: scenarioDims(s)?.power_mw ?? 0,
      export: s.export_limit_mw,
      saving: inv?.annual_benefit_yr1_gbp ?? null,
      capex: inv?.capex_gbp ?? null,
      npv: inv?.npv_gbp ?? null,
      irr: inv?.irr_pct ?? null,
      payback: inv?.payback_yrs ?? null,
      backtest: s.net_benefit_gbp,
    };
  });
}

function compare(a, b, key) {
  if (key === "label") return a.cap - b.cap || a.pw - b.pw;
  const x = a[key], y = b[key];
  if (x == null && y == null) return 0;
  if (x == null) return 1;   // missing sorts last either way
  if (y == null) return -1;
  return x - y;
}

export default function ScenarioTable({ scenarios, byKey, selectedKey, onSelect, bestKey, lifetime }) {
  const hasInv = byKey.size > 0;
  const [sort, setSort] = useState({ key: "npv", dir: "desc" });
  const effective = hasInv ? sort : { key: "backtest", dir: "desc" };

  const rows = useMemo(() => {
    const r = rowsFrom(scenarios, byKey);
    r.sort((a, b) => {
      const c = compare(a, b, effective.key);
      return effective.dir === "asc" ? c : -c;
    });
    return r;
  }, [scenarios, byKey, effective.key, effective.dir]);

  function toggle(key) {
    setSort((p) => (p.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "label" || key === "payback" ? "asc" : "desc" }));
  }

  const paybackText = (r) => (r.payback != null ? `${num(r.payback, 1)} yrs` : hasInv ? `> ${lifetime} yrs` : DASH);
  const cellText = {
    label: (r) => r.label,
    export: (r) => `${num(r.export, r.export % 1 ? 1 : 0)} MW`,
    saving: (r) => gbp(r.saving),
    capex: (r) => gbp(r.capex),
    npv: (r) => gbp(r.npv),
    irr: (r) => (r.irr != null ? pct(r.irr, 1) : DASH),
    payback: paybackText,
  };

  return (
    <>
      <div className="scn-table-wrap">
        <table className="tnum" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <caption className="sr-only">Battery sizes compared. Select a row to show it in the charts.</caption>
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const active = effective.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (effective.dir === "asc" ? "ascending" : "descending") : "none"}
                    style={{ textAlign: c.align, fontWeight: 400, fontSize: 12, color: "var(--muted)", padding: "0 8px 8px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}
                  >
                    <button
                      onClick={() => toggle(c.key)}
                      disabled={!hasInv && c.key !== "label" && c.key !== "export"}
                      style={{ all: "unset", cursor: "pointer", display: "inline-flex", gap: 4, alignItems: "center" }}
                    >
                      {c.header}
                      <span aria-hidden="true" style={{ width: 8, color: "var(--ink)" }}>
                        {active ? (effective.dir === "asc" ? "↑" : "↓") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const selected = r.key === selectedKey;
              return (
                <tr
                  key={r.key}
                  onClick={() => onSelect(r.key)}
                  style={{ cursor: "pointer", background: selected ? "var(--raised)" : undefined }}
                >
                  {COLUMNS.map((c, i) => (
                    <td
                      key={c.key}
                      style={{
                        textAlign: c.align,
                        padding: "12px 8px",
                        borderBottom: "1px solid var(--rule)",
                        whiteSpace: "nowrap",
                        color: c.key === "npv" && r.npv != null ? (r.npv >= 0 ? "var(--positive)" : "var(--negative)") : i === 0 ? "var(--ink)" : c.key === "export" ? "var(--muted)" : "var(--ink)",
                        fontWeight: c.key === "npv" ? 500 : 400,
                      }}
                    >
                      {i === 0 ? (
                        <button
                          aria-pressed={selected}
                          onClick={(e) => { e.stopPropagation(); onSelect(r.key); }}
                          style={{ all: "unset", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
                        >
                          {r.label}
                          {r.key === bestKey && <Best />}
                        </button>
                      ) : cellText[c.key](r)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* phone: two-line rows, every field kept */}
      <ul className="scn-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((r) => {
          const selected = r.key === selectedKey;
          return (
            <li key={r.key} style={{ borderBottom: "1px solid var(--rule)" }}>
              <button
                aria-pressed={selected}
                onClick={() => onSelect(r.key)}
                className="tnum"
                style={{ all: "unset", boxSizing: "border-box", display: "block", width: "100%", padding: "12px 8px", cursor: "pointer", background: selected ? "var(--raised)" : undefined }}
              >
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ minWidth: 0 }}>{r.label} · {cellText.export(r)}</span>
                  <span style={{ flex: "none", whiteSpace: "nowrap", fontWeight: 500, color: r.npv == null ? "var(--ink)" : r.npv >= 0 ? "var(--positive)" : "var(--negative)" }}>
                    NPV {gbp(r.npv)}
                  </span>
                </span>
                {r.key === bestKey && <span style={{ display: "block", marginTop: 4 }}><Best /></span>}
                <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "var(--muted)" }}>
                  {gbp(r.saving)}/yr · capex {gbp(r.capex)} · IRR {cellText.irr(r)} · payback {paybackText(r)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Best() {
  return (
    <span style={{ flex: "none", whiteSpace: "nowrap", fontSize: 12, lineHeight: "20px", padding: "0 8px", borderRadius: 4, background: "var(--pill-neutral-bg)", color: "var(--pill-neutral-ink)" }}>
      Best NPV
    </span>
  );
}
