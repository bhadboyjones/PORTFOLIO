import DayTape from "../components/DayTape";

export default function LandingPage({ onSelectMode }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-base)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1.5rem",
    }}>
      <div style={{ textAlign: "center", maxWidth: 520, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", justifyContent: "center", marginBottom: "0.4rem" }}>
          <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--text-pri)", letterSpacing: "-0.02em" }}>
            flex<span style={{ color: "var(--accent)" }}>iq</span>
          </h1>
          <span style={{
            fontSize: "0.62rem", fontWeight: 700, color: "var(--accent)",
            background: "var(--signal-a10)", border: "1px solid var(--signal-a25)",
            borderRadius: 3, padding: "0.12rem 0.4rem", letterSpacing: "0.1em", textTransform: "uppercase",
          }}>BETA</span>
        </div>
        <p style={{ margin: "0 0 1.75rem", color: "var(--text-dim)", fontSize: "0.9rem" }}>
          BTM BESS dispatch optimisation
        </p>

        <div style={{ margin: "0 0 0.35rem", textAlign: "left" }}>
          <DayTape variant="hero" showTicks />
        </div>
        <p style={{
          margin: "0 0 2.25rem", color: "var(--text-dim)", fontSize: "0.68rem",
          letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "left",
        }}>
          Charge green · discharge red · a representative DUoS day
        </p>

        <p style={{ margin: "0 0 1.5rem", color: "var(--text-sec)", fontSize: "1.05rem", fontWeight: 600 }}>
          Do you have site meter data?
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            className="lift lift-glow"
            onClick={() => onSelectMode("csv")}
            style={{
              padding: "0.85rem 1.75rem",
              border: "1px solid var(--signal-a40)",
              borderRadius: 8,
              background: "var(--signal-a08)",
              color: "var(--accent)",
              fontSize: "0.9rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Upload CSV
          </button>
          <button
            className="lift"
            onClick={() => onSelectMode("archetype")}
            style={{
              padding: "0.85rem 1.75rem",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--bg-surface)",
              color: "var(--text-sec)",
              fontSize: "0.9rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Use archetypes
          </button>
        </div>
        <p style={{ margin: "1.5rem 0 0", color: "var(--text-dim)", fontSize: "0.78rem" }}>
          CSV: your real half-hourly or hourly meter data · Archetypes: representative I&amp;C demand profiles
        </p>
      </div>
    </div>
  );
}
