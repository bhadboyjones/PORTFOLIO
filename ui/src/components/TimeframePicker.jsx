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
      <h2 style={sectionLabel}>Analysis Window</h2>

      <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", marginBottom: "1rem" }}>
        <div
          onClick={() => setUseDefault((v) => !v)}
          style={{
            width: 36,
            height: 20,
            borderRadius: 999,
            background: useDefault ? "#00c8e8" : "#1e3352",
            position: "relative",
            transition: "background 0.2s",
            cursor: "pointer",
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
            background: useDefault ? "#080e1a" : "#4a6b8c",
            transition: "left 0.2s",
          }} />
        </div>
        <span style={{ fontSize: "0.85rem", color: "#7ba0c8", userSelect: "none" }}>
          Use last 12 months
        </span>
      </label>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {[
          { label: "From", value: startDate, onChange: (v) => onChange(v, endDate) },
          { label: "To",   value: endDate,   onChange: (v) => onChange(startDate, v) },
        ].map(({ label, value, onChange: handleChange }) => (
          <label key={label} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#4a6b8c", textTransform: "uppercase", letterSpacing: "0.08em" }}>
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
                borderColor: useDefault ? "#1e3352" : "#2a4772",
                borderRadius: 6,
                fontSize: "0.85rem",
                color: useDefault ? "#4a6b8c" : "#e0eaf8",
                background: useDefault ? "#0a1422" : "#0f1928",
                outline: "none",
                cursor: useDefault ? "not-allowed" : "text",
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

const sectionLabel = {
  margin: "0 0 1rem",
  fontSize: "0.72rem",
  fontWeight: 700,
  color: "#4a6b8c",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};
