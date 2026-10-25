import DayTape from "../components/DayTape";

const panel = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-card)",
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

export default function LandingPage({ onSelectMode }) {
  return (
    <div style={{ maxWidth: 1088, margin: "0 auto", padding: "36px 24px 64px" }}>
      <h1 style={{ margin: 0, fontSize: "var(--fs-title)", lineHeight: "32px", fontWeight: 700, letterSpacing: "-0.01em" }}>
        Battery appraisal for C&amp;I sites
      </h1>
      <p style={{ margin: "4px 0 0", fontSize: 16, lineHeight: "24px", color: "var(--muted)", maxWidth: 720 }}>
        flexiq optimises a behind-the-meter battery against your DNO&rsquo;s DUoS bands and
        wholesale prices, compares sizes, and prices the investment.
      </p>

      <section aria-labelledby="tape-h" style={{ ...panel, marginTop: 24, gap: 8 }}>
        <h2 id="tape-h" style={{ margin: 0, fontSize: "var(--fs-section)", fontWeight: 500 }}>
          Where the value comes from
        </h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          A typical weekday on one DNO tariff: the battery charges in the green band overnight and
          discharges into the red peak, when importing costs most.
        </p>
        <div style={{ marginTop: 8 }}>
          <DayTape variant="hero" showTicks />
        </div>
        <TapeKey />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--gap)", marginTop: "var(--gap)" }}>
        <section aria-labelledby="csv-h" style={panel}>
          <h2 id="csv-h" style={{ margin: 0, fontSize: "var(--fs-section)", fontWeight: 500 }}>Your site&rsquo;s meter data</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Half-hourly or hourly import and export, as CSV or XLSX. Results reflect the real site,
            on the tariff of the DNO you choose.
          </p>
          <div style={{ marginTop: "auto", paddingTop: 8 }}>
            <button className="btn-primary" onClick={() => onSelectMode("csv")}>Upload meter data</button>
          </div>
        </section>

        <section aria-labelledby="arch-h" style={panel}>
          <h2 id="arch-h" style={{ margin: 0, fontSize: "var(--fs-section)", fontWeight: 500 }}>Archetype sites</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            Representative office, industrial and retail demand profiles, for a first look before
            you have a site&rsquo;s data.
          </p>
          <div style={{ marginTop: "auto", paddingTop: 8 }}>
            <button className="btn-secondary" onClick={() => onSelectMode("archetype")}>Use an archetype</button>
          </div>
        </section>
      </div>

      <p style={{ margin: "16px 0 0", fontSize: 12, color: "var(--faint)" }}>
        Beta. Results are a perfect-foresight backtest, an upper bound on what a real operator earns.
        The results page lists what the model includes and leaves out.
      </p>
    </div>
  );
}

function TapeKey() {
  const items = [
    ["green", "Green band: cheapest, battery charges"],
    ["amber", "Amber band"],
    ["red", "Red band: dearest, battery discharges"],
  ];
  return (
    <ul style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", margin: 0, padding: 0, listStyle: "none", fontSize: 12, color: "var(--muted)" }}>
      {items.map(([band, label]) => (
        <li key={band} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, background: `var(--band-${band})`, opacity: 0.85 }} />
          {label}
        </li>
      ))}
    </ul>
  );
}
