import { useEffect, useState } from "react";

// The app's one piece of chrome: a 48px translucent bar with the product's
// mark and name, the current step, and at most one action on the right.
// Content scrolls under it; its edge appears only once something does.

export function Mark({ size = 20 }) {
  // A battery cell seen from the front: a filled lower half (stored energy)
  // under an empty upper half, with the terminal on top. Ink on the ground.
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="7.5" y="1" width="5" height="2.5" rx="0.5" fill="#141414" />
      <rect x="4" y="3.5" width="12" height="15.5" rx="2" fill="none" stroke="#141414" strokeWidth="1.5" />
      <rect x="6" y="11" width="8" height="6" rx="0.75" fill="#1d5fbf" />
    </svg>
  );
}

export default function TopBar({ step, action }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 2);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className="topbar"
      data-scrolled={scrolled}
      style={{ height: 48, display: "flex", alignItems: "center", gap: 12, padding: "0 24px" }}
    >
      <a href="#main" className="skip-link">Skip to content</a>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Mark />
        <span translate="no" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>flexiq</span>
      </span>
      {step && (
        <span style={{ fontSize: 14, color: "var(--muted)" }}>
          <span aria-hidden="true" style={{ margin: "0 8px 0 4px", color: "var(--control)" }}>/</span>
          {step}
        </span>
      )}
      <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {action}
      </span>
    </header>
  );
}
