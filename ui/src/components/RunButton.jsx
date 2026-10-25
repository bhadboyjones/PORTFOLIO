export default function RunButton({ disabled, onClick }) {
  return (
    <button className="btn-primary" onClick={onClick} disabled={disabled} style={{ width: "100%", height: 44, fontSize: 16 }}>
      {disabled ? "Choose a site, a battery size and an export limit to run" : "Run scenarios"}
    </button>
  );
}
