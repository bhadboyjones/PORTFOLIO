import { downloadCsv } from "../../lib/csv";

// A white card on the ground: 1px edge, no shadow. Header holds a 16px
// title, an optional grey line, and actions on the right (a CSV download
// of the data behind the chart, when given).
export default function Card({ id, title, subtitle, csv, actions, children, style }) {
  return (
    <section
      aria-labelledby={id ? `${id}-h` : undefined}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-card)",
        padding: 20,
        minWidth: 0,
        ...style,
      }}
    >
      {(title || csv || actions) && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {title && (
              <h2 id={id ? `${id}-h` : undefined} style={{ margin: 0, fontSize: "var(--fs-section)", lineHeight: "24px", fontWeight: 500 }}>
                {title}
              </h2>
            )}
            {subtitle && (
              <p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--muted)" }}>{subtitle}</p>
            )}
          </div>
          {actions}
          {csv && (
            <button
              className="btn-text"
              style={{ fontSize: 14, whiteSpace: "nowrap", color: "var(--muted)" }}
              onClick={() => downloadCsv(csv.filename, csv.rows, csv.columns)}
            >
              Download CSV<span className="sr-only"> of {title}</span>
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
