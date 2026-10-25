import { useId, useRef } from "react";

// ARIA tabs: an underline on a full-width 1px rule, arrow keys move between
// tabs. The active tab is ink with a 2px ink underline; the rest are grey.
export default function Tabs({ tabs, active, onSelect, label, children }) {
  const base = useId();
  const refs = useRef([]);

  function onKeyDown(e, i) {
    let next = null;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next != null) {
      e.preventDefault();
      onSelect(next);
      refs.current[next]?.focus();
    }
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="tab-bar" style={{ display: "flex", gap: 20, borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
        {tabs.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t}
              ref={(el) => (refs.current[i] = el)}
              role="tab"
              id={`${base}-tab-${i}`}
              aria-selected={on}
              aria-controls={`${base}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              style={{
                padding: "8px 0",
                border: "none",
                borderBottom: on ? "2px solid var(--ink)" : "2px solid transparent",
                marginBottom: -1,
                background: "none",
                cursor: "pointer",
                font: "inherit",
                fontWeight: on ? 500 : 400,
                color: on ? "var(--ink)" : "var(--muted)",
                whiteSpace: "nowrap",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${active}`}>
        {children}
      </div>
    </div>
  );
}
