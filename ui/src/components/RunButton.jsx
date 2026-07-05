export default function RunButton({ disabled, onClick }) {
  return (
    <button
      className="lift lift-glow"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "1rem 2rem",
        fontSize: "0.9rem",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        border: disabled ? "1px solid var(--border)" : "1px solid var(--signal-a40)",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled
          ? "var(--bg-surface)"
          : "linear-gradient(135deg, var(--accent) 0%, #0099bb 100%)",
        color: disabled ? "var(--text-dim)" : "var(--bg-base)",
        boxShadow: disabled ? "none" : "0 0 24px var(--signal-a25)",
      }}
    >
      {disabled ? "Complete configuration to run" : "Run Scenarios"}
    </button>
  );
}
