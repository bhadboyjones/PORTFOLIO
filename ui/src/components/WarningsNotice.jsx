import { useState } from "react";

// Run warnings as one quiet notice: unique messages only, five shown, the
// rest behind a toggle. Guards against a flood (e.g. results cached before
// the backend filtered library warnings).
const SHOW = 5;

export function uniqueWarnings(list) {
  return [...new Set((list || []).filter((w) => typeof w === "string" && w.trim()))];
}

export default function WarningsNotice({ warnings, title, style }) {
  const [all, setAll] = useState(false);
  const items = uniqueWarnings(warnings);
  if (!items.length) return null;
  const shown = all ? items : items.slice(0, SHOW);
  return (
    <div role="status" style={{
      padding: "10px 14px", borderRadius: "var(--radius-card)",
      background: "var(--pill-warning-bg)", border: "1px solid var(--pill-warning-line)",
      color: "var(--pill-warning-ink)", fontSize: 14, ...style,
    }}>
      {title && <p style={{ margin: "0 0 4px", fontWeight: 500 }}>{title}</p>}
      {shown.map((w, i) => <p key={i} style={{ margin: i ? "4px 0 0" : 0 }}>{w}</p>)}
      {items.length > SHOW && (
        <button className="btn-text" onClick={() => setAll((v) => !v)} style={{ marginTop: 6, color: "inherit", fontSize: 14 }}>
          {all ? "Show fewer" : `Show ${items.length - SHOW} more`}
        </button>
      )}
    </div>
  );
}
