import Card from "./Card";
import { gbp, num } from "../../format";

const th = { padding: "6px 8px", fontSize: 12, fontWeight: 500, color: "var(--muted)", textAlign: "right", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };
const td = { padding: "8px", fontSize: 14, textAlign: "right", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" };

const monthName = (m) => new Date(`${m}-01T12:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

// Month by month: the worst half-hour against the MIC, without and with the
// battery. One breach prices the whole month, on the worst half-hour only.
export default function BreachTable({ months, label }) {
  const over = months.filter((m) => m.excess_wo_bess_gbp > 0 || m.excess_w_bess_gbp > 0);
  if (!over.length) return null;
  return (
    <Card
      id="breaches"
      title="Months over the MIC"
      subtitle={`${label}. Excess is the worst half-hour above the MIC, for every day of the month.`}
      csv={{
        filename: "flexiq-mic-breaches.csv",
        rows: months,
        columns: [["month", "Month"], ["mic_kva", "MIC (kVA)"], ["worst_wo_bess_kva", "Worst without battery (kVA)"], ["worst_w_bess_kva", "Worst with battery (kVA)"], ["excess_wo_bess_gbp", "Excess without battery (GBP)"], ["excess_w_bess_gbp", "Excess with battery (GBP)"]],
      }}
    >
      <div style={{ overflowX: "auto" }}>
        <table className="tnum" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...th, textAlign: "left" }}>Month</th>
              <th scope="col" style={th}>Worst without</th>
              <th scope="col" style={th}>Worst with</th>
              <th scope="col" style={th}>Excess without</th>
              <th scope="col" style={th}>Excess with</th>
            </tr>
          </thead>
          <tbody>
            {over.map((m) => (
              <tr key={m.month}>
                <th scope="row" style={{ ...td, textAlign: "left", fontWeight: 400 }}>{monthName(m.month)}</th>
                <td style={td}>{num(m.worst_wo_bess_kva, 0)} kVA</td>
                <td style={td}>{num(m.worst_w_bess_kva, 0)} kVA</td>
                <td style={td}>{gbp(m.excess_wo_bess_gbp)}</td>
                <td style={td}>{gbp(m.excess_w_bess_gbp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
