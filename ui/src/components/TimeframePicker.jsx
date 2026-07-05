import { useState, useEffect } from "react";
import { subYears, subDays, format } from "date-fns";

export default function TimeframePicker({ startDate, endDate, onChange }) {
  const [useDefault, setUseDefault] = useState(true);

  useEffect(() => {
    if (useDefault) {
      const end   = subDays(new Date(), 1);
      const start = subYears(end, 1);
      onChange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
    }
  }, [useDefault]);

  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", marginBottom: "1rem" }}>
        <input
          type="checkbox"
          checked={useDefault}
          onChange={(e) => setUseDefault(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        />
        <div
          className="toggle-track"
          aria-hidden="true"
          style={{
            width: 36,
            height: 20,
            borderRadius: 999,
            background: useDefault ? "var(--accent)" : "var(--border)",
            position: "relative",
            transition: "background var(--dur-fast) var(--ease-flex)",
            flexShrink: 0,
          }}
        >
          <div style={{
            position: "absolute",
            top: 2,
            left: useDefault ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: useDefault ? "var(--bg-base)" : "var(--text-dim)",
            transition: "left var(--dur-fast) var(--ease-flex)",
          }} />
        </div>
        <span style={{ fontSize: "0.85rem", color: "var(--text-sec)", userSelect: "none" }}>
          Use last 12 months
        </span>
      </label>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {[
          { label: "From", value: startDate, onChange: (v) => onChange(v, endDate) },
          { label: "To",   value: endDate,   onChange: (v) => onChange(startDate, v) },
        ].map(({ label, value, onChange: handleChange }) => (
          <label key={label} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {label}
            </span>
            <input
              type="date"
              value={value}
              disabled={useDefault}
              onChange={(e) => handleChange(e.target.value)}
              style={{
                padding: "0.45rem 0.65rem",
                border: "1px solid",
                borderColor: useDefault ? "var(--border)" : "var(--border-bright)",
                borderRadius: 6,
                fontSize: "0.85rem",
                color: useDefault ? "var(--text-dim)" : "var(--text-pri)",
                background: useDefault ? "var(--bg-base)" : "var(--bg-surface)",
                cursor: useDefault ? "not-allowed" : "text",
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
