import Card from "./Card";

// "Why this result": the reasoning behind the lead figure, in plain
// sentences computed by lib/explain.js.
export default function WhyCard({ lines, loading }) {
  return (
    <Card id="why" title="Why this result">
      {loading || !lines.length ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>Working out the explanation…</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 16, lineHeight: "24px" }}>
          {lines.map((l) => <li key={l.key}>{l.text}</li>)}
        </ul>
      )}
    </Card>
  );
}
