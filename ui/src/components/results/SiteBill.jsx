import Card from "./Card";
import { gbp, num } from "../../format";
import { billView } from "../../lib/results";

const cell = { padding: "8px 0 8px 16px", textAlign: "right", verticalAlign: "top", whiteSpace: "nowrap", borderBottom: "1px solid var(--line)" };
const label = { ...cell, padding: "8px 0", textAlign: "left", whiteSpace: "normal", fontWeight: 400 };
const head = { ...cell, fontSize: 12, fontWeight: 500, color: "var(--muted)", paddingTop: 0 };
const sum = { fontSize: 12, color: "var(--muted)", marginTop: 2 };

const change = (v) => (Math.abs(v) < 0.5 ? gbp(0) : gbp(v, { sign: true }));

function Amount({ value, working }) {
  return (
    <>
      <div>{gbp(value)}</div>
      {working && <div style={sum}>{working}</div>}
    </>
  );
}

// The site's year as a bill, without and with the battery. Every line shows
// its sum. A modelled backtest, so never a copy of any supplier's invoice.
export default function SiteBill({ bill, annual, nDays, sizeLabel, runInputs, dataPeriod }) {
  const v = billView(bill, annual);
  const details = [
    ["Site", runInputs?.fileName],
    ["Network", runInputs?.dnoLabel && `${runInputs.dnoLabel}, ${runInputs.voltage}`],
    ["Agreed capacity", `${num(bill.mic_kva, 0)} kVA${dataPeriod?.mic_source === "assumed_peak" ? " (assumed from peak)" : ""}`],
    ["Battery", sizeLabel],
    ["Period", `One year, scaled from ${num(nDays, 0)} days of data`],
  ].filter(([, value]) => value);

  return (
    <Card
      id="site-bill"
      title="Modelled site bill"
      subtitle="A perfect-foresight backtest, not a supplier invoice."
      csv={{
        filename: "flexiq-site-bill.csv",
        rows: v.csv,
        columns: [["section", "Section"], ["label", "Line"], ["without", "Without battery (GBP/yr)"], ["with", "With battery (GBP/yr)"], ["change", "Change (GBP/yr)"]],
      }}
    >
      <dl className="bill-details">
        {details.map(([k, value]) => (
          <div key={k}><dt>{k}</dt><dd>{value}</dd></div>
        ))}
      </dl>

      <div style={{ overflowX: "auto" }}>
        <table className="tnum" style={{ width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...head, textAlign: "left", paddingLeft: 0 }}>Line</th>
              <th scope="col" style={head}>Without battery</th>
              <th scope="col" style={head}>With battery</th>
              <th scope="col" style={head}>Change</th>
            </tr>
          </thead>
          {v.sections.map((s) => (
            <tbody key={s.title}>
              <tr>
                <th scope="colgroup" colSpan={4} style={{ ...label, fontWeight: 500, paddingTop: 16 }}>{s.title}</th>
              </tr>
              {s.lines.map((l) => (
                <tr key={l.label}>
                  <th scope="row" style={label}>{l.label}</th>
                  {l.included ? (
                    <td colSpan={3} style={{ ...cell, color: "var(--muted)" }}>Inside your rate</td>
                  ) : (
                    <>
                      <td style={cell}><Amount value={l.without} working={l.workingWo} /></td>
                      <td style={cell}><Amount value={l.with} working={l.workingW} /></td>
                      <td style={cell}>{change(l.change)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <Total name="Total excluding VAT" a={v.totalWo} b={v.totalW} strong />
            <Total name={`VAT at ${num(bill.vat_rate * 100, 0)}%`} a={v.vatWo} b={v.vatW} />
            <Total name="Total including VAT" a={v.totalWo + v.vatWo} b={v.totalW + v.vatW} />
          </tfoot>
        </table>
      </div>

      <h3 style={{ margin: "24px 0 8px", fontSize: 14, fontWeight: 500 }}>How the battery got there</h3>
      <table className="tnum" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          {v.battery.map((r) => (
            <tr key={r.label}>
              <th scope="row" style={{ ...label, fontWeight: r.strong ? 600 : 400 }}>{r.label}</th>
              <td style={{ ...cell, fontWeight: r.strong ? 600 : 400 }}>{gbp(r.value, { sign: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
        Wear is a cost of using the battery, so it never appears on a bill. The figures here are before the dispatch efficiency in the lead strip. Most sites reclaim VAT.
      </p>
    </Card>
  );
}

function Total({ name, a, b, strong }) {
  const w = strong ? 600 : 400;
  return (
    <tr>
      <th scope="row" style={{ ...label, fontWeight: w, paddingTop: strong ? 16 : 8 }}>{name}</th>
      <td style={{ ...cell, fontWeight: w, paddingTop: strong ? 16 : 8 }}>{gbp(a)}</td>
      <td style={{ ...cell, fontWeight: w, paddingTop: strong ? 16 : 8 }}>{gbp(b)}</td>
      <td style={{ ...cell, fontWeight: w, paddingTop: strong ? 16 : 8 }}>{change(b - a)}</td>
    </tr>
  );
}
