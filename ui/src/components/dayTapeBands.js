// DUoS band-window helpers for the Day Tape (kept out of DayTape.jsx so the
// component file only exports components — required for Vite fast refresh).

function toSlot(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  return Math.min(48, Math.max(0, h * 2 + (m >= 30 ? 1 : 0)));
}

/** Expand HH:MM band windows into 48 slots. Red overrides amber overrides green. */
export function bandsFromWindows({
  redStart,
  redEnd,
  amberMorningStart,
  amberMorningEnd,
  amberEveningStart,
  amberEveningEnd,
} = {}) {
  const bands = Array(48).fill("green");
  const paint = (start, end, band) => {
    const a = toSlot(start);
    const b = toSlot(end);
    if (a == null || b == null) return;
    for (let i = a; i < b; i++) bands[i] = band;
  };
  paint(amberMorningStart, amberMorningEnd, "amber");
  paint(amberEveningStart, amberEveningEnd, "amber");
  paint(redStart, redEnd, "red");
  return bands;
}

// Representative NPG weekday — matches the CSV-mode DUoS defaults
export const DEFAULT_WEEKDAY_BANDS = bandsFromWindows({
  redStart: "16:00",
  redEnd: "19:00",
  amberMorningStart: "07:00",
  amberMorningEnd: "16:00",
  amberEveningStart: "19:00",
  amberEveningEnd: "23:00",
});
