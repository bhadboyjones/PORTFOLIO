export default function RunButton({ disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "1rem 2rem",
        fontSize: "0.9rem",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        border: disabled ? "1px solid #1e3352" : "1px solid rgba(0,200,232,0.4)",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled
          ? "#0f1928"
          : "linear-gradient(135deg, #00c8e8 0%, #0099bb 100%)",
        color: disabled ? "#4a6b8c" : "#080e1a",
        boxShadow: disabled ? "none" : "0 0 24px rgba(0,200,232,0.25)",
        transition: "all 0.2s ease",
      }}
    >
      {disabled ? "Complete configuration to run" : "Run Scenarios"}
    </button>
  );
}
