export default function RunButton({ disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "0.75rem 2.5rem",
        fontSize: "1rem",
        fontWeight: 700,
        letterSpacing: "0.05em",
        border: "none",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#d1d5db" : "#2563eb",
        color: disabled ? "#9ca3af" : "#fff",
        transition: "background 0.15s",
      }}
    >
      RUN SCENARIOS
    </button>
  );
}
