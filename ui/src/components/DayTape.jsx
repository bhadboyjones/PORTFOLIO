// Day Tape: one day of 48 settlement periods, coloured by DUoS time band.
// Styles live in index.css under "Day Tape"; band helpers in dayTapeBands.js.
import { DEFAULT_WEEKDAY_BANDS } from "./dayTapeBands";

const pad = (n) => String(n).padStart(2, "0");

// Segment tooltip: a time-of-day slot and its DUoS band. The number of
// segments is visual resolution, not a settlement-period claim.
function slotLabel(i, n, band) {
  const perHour = n / 24;
  const startMin = (i / perHour) * 60;
  const endMin = ((i + 1) / perHour) * 60;
  const fmt = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(Math.round(mins % 60))}`;
  const bandName = band.charAt(0).toUpperCase() + band.slice(1);
  return `${fmt(startMin)}–${fmt(endMin)} · ${bandName}`;
}

export default function DayTape({
  bands = DEFAULT_WEEKDAY_BANDS,
  variant = "divider",
  showTicks = false,
  ariaLabel = "A representative DUoS day: charge in green overnight, discharge into the red peak",
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
            title={hero ? slotLabel(i, bands.length, band) : undefined}
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
            marginTop: 4,
            fontSize: 12,
            color: "var(--muted)",
          }}
        >
          <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
        </div>
      )}
    </div>
  );
}
