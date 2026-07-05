// Day Tape — one day of 48 settlement periods, coloured by DUoS time band.
// Styles live in index.css under "Day Tape"; band helpers in dayTapeBands.js.
import { DEFAULT_WEEKDAY_BANDS } from "./dayTapeBands";

const pad = (n) => String(n).padStart(2, "0");

function slotLabel(i, band) {
  const h0 = Math.floor(i / 2);
  const m0 = i % 2 ? 30 : 0;
  const h1 = Math.floor((i + 1) / 2) % 24;
  const m1 = (i + 1) % 2 ? 30 : 0;
  const bandName = band.charAt(0).toUpperCase() + band.slice(1);
  return `SP ${i + 1} · ${pad(h0)}:${pad(m0)}–${pad(h1)}:${pad(m1)} · ${bandName}`;
}

export default function DayTape({
  bands = DEFAULT_WEEKDAY_BANDS,
  variant = "divider",
  showTicks = false,
  ariaLabel = "One day of settlement periods coloured by DUoS band — Red 16:00–19:00",
}) {
  const hero = variant === "hero";
  return (
    <div>
      <div
        className={`day-tape day-tape--${variant}`}
        role={hero ? "img" : undefined}
        aria-label={hero ? ariaLabel : undefined}
        aria-hidden={hero ? undefined : true}
      >
        {bands.map((band, i) => (
          <span
            key={i}
            className="day-tape__seg is-filled"
            data-band={band}
            title={hero ? slotLabel(i, band) : undefined}
          />
        ))}
        {hero && <div className="day-tape__wave" aria-hidden="true" />}
      </div>
      {showTicks && (
        <div
          className="tnum"
          aria-hidden="true"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "0.3rem",
            fontSize: "0.65rem",
            color: "var(--text-dim)",
            letterSpacing: "0.05em",
          }}
        >
          <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
        </div>
      )}
    </div>
  );
}
