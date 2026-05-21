import { useState, useEffect } from "react";
import { subYears, subDays, format } from "date-fns";

export default function TimeframePicker({ startDate, endDate, onChange }) {
  const [useDefault, setUseDefault] = useState(true);

  useEffect(() => {
    if (useDefault) {
      const end = subDays(new Date(), 1);
      const start = subYears(end, 1);
      onChange(format(start, "yyyy-MM-dd"), format(end, "yyyy-MM-dd"));
    }
  }, [useDefault]);

  function handleToggleDefault(e) {
    setUseDefault(e.target.checked);
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem" }}>
      <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>Analysis Window</h2>

      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
        <input
          type="checkbox"
          checked={useDefault}
          onChange={handleToggleDefault}
          style={{ width: 16, height: 16 }}
        />
        Use last 12 months (default)
      </label>

      <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.875rem" }}>
          From
          <input
            type="date"
            value={startDate}
            disabled={useDefault}
            onChange={(e) => onChange(e.target.value, endDate)}
            style={{
              padding: "0.35rem 0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: 4,
              fontSize: "0.875rem",
              color: useDefault ? "#9ca3af" : "#111827",
              background: useDefault ? "#f9fafb" : "#fff",
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.875rem" }}>
          To
          <input
            type="date"
            value={endDate}
            disabled={useDefault}
            onChange={(e) => onChange(startDate, e.target.value)}
            style={{
              padding: "0.35rem 0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: 4,
              fontSize: "0.875rem",
              color: useDefault ? "#9ca3af" : "#111827",
              background: useDefault ? "#f9fafb" : "#fff",
            }}
          />
        </label>
      </div>
    </div>
  );
}
