// Tariff form state and its payload for the API (src/tariff.py). Rates are typed
// in p/kWh, as contracts state them, and sent in £/MWh.

export const MAX_BANDS = 3;

/** `index` is the price signal chosen on the page: "Day-ahead" or "Imbalance". */
export const energyOptions = (index) => [
  { value: "indexed", label: `${index} indexed`, hint: `You pay the half-hourly ${index.toLowerCase()} price.` },
  { value: "percent", label: `Percentage of ${index.toLowerCase()}`, hint: "A share of the half-hourly price." },
  { value: "adder", label: `${index} plus a margin`, hint: "The half-hourly price plus a fixed adder." },
  { value: "time_bands", label: "Fixed time bands", hint: "Different fixed rates by time of day, such as morning, afternoon and night." },
  { value: "flat", label: "Fixed single rate", hint: "One rate every half-hour." },
];

export const exportOptions = (index) => [
  { value: "indexed", label: `${index} indexed` },
  { value: "percent", label: `Percentage of ${index.toLowerCase()}` },
  { value: "fee", label: `${index} less a fee` },
  { value: "fixed", label: "Fixed rate" },
  { value: "system", label: "System price (fully exposed)" },
];

export const DEFAULT_TARIFF_FORM = {
  energyType: "indexed", energyPercent: "100", energyAdder: "0", energyFlat: "",
  bands: [
    { start: "07:00", end: "12:00", rate: "" },
    { start: "12:00", end: "17:00", rate: "" },
    { start: "17:00", end: "23:00", rate: "" },
  ],
  otherRate: "",
  duosBundled: false, capacityBundled: false, policyBundled: false,
  exportType: "indexed", exportPercent: "100", exportFee: "0", exportFixed: "",
  gduosPassedOn: true,
};

const HHMM = /^([01]\d|2[0-4]):[0-5]\d$/;
const isNum = (v) => String(v).trim() !== "" && Number.isFinite(Number(v));
const mwh = (pPerKwh) => Number(pPerKwh) * 10;

const toMins = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const toClock = (slot) => `${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;

/**
 * The rate each half-hour takes, matching _band_rates in src/tariff.py: test the
 * half-hour's start time, earlier bands win, and a band may cross midnight.
 * Returns the 48 rates, and the same rates merged into runs of equal rate.
 */
export function bandRuns(t) {
  const bands = t.bands.filter((b) => HHMM.test(b.start) && HHMM.test(b.end));
  const num = (v) => (isNum(v) ? Number(v) : null);
  const slots = Array.from({ length: 48 }, (_, i) => {
    const mins = i * 30;
    const hit = bands.find((b) => {
      const s = toMins(b.start), e = toMins(b.end);
      return s < e ? mins >= s && mins < e : mins >= s || mins < e;
    });
    return { rate: hit ? num(hit.rate) : num(t.otherRate), band: hit ?? null };
  });
  const runs = [];
  slots.forEach(({ rate, band }, i) => {
    const last = runs.at(-1);
    if (last && last.band === band) { last.end = toClock(i + 1); last.hours += 0.5; }
    else runs.push({ start: toClock(i), end: toClock(i + 1), hours: 0.5, rate, band });
  });
  return { slots: slots.map((s) => s.rate), runs };
}

/** The first thing stopping a run, or null. */
export function tariffProblem(t) {
  if (t.energyType === "percent" && !(Number(t.energyPercent) > 0)) return "Enter the percentage of day-ahead";
  if (t.energyType === "adder" && !isNum(t.energyAdder)) return "Enter the margin in p/kWh";
  if (t.energyType === "flat" && !isNum(t.energyFlat)) return "Enter the flat rate in p/kWh";
  if (t.energyType === "time_bands") {
    if (!isNum(t.otherRate)) return "Enter the rate for all other times";
    if (t.bands.some((b) => !isNum(b.rate))) return "Enter a rate for each time band";
    if (t.bands.some((b) => !HHMM.test(b.start) || !HHMM.test(b.end))) return "Enter band times as HH:MM";
    if (t.bands.some((b) => b.start === b.end)) return "A time band can't start and end at the same time";
  }
  if (t.exportType === "percent" && !isNum(t.exportPercent)) return "Enter the export percentage";
  if (t.exportType === "fee" && !isNum(t.exportFee)) return "Enter the export fee in p/kWh";
  if (t.exportType === "fixed" && !isNum(t.exportFixed)) return "Enter the fixed export rate in p/kWh";
  return null;
}

/** Only the fields this tariff uses, so a stale input can't change a run. */
export function tariffPayload(t) {
  const out = {
    energy_type: t.energyType,
    duos_bundled: t.duosBundled, capacity_bundled: t.capacityBundled, policy_bundled: t.policyBundled,
    export_type: t.exportType, gduos_passed_on: t.gduosPassedOn,
  };
  if (t.energyType === "percent") out.energy_percent = Number(t.energyPercent);
  if (t.energyType === "adder") out.energy_adder_gbp_mwh = mwh(t.energyAdder);
  if (t.energyType === "flat") out.energy_flat_gbp_mwh = mwh(t.energyFlat);
  if (t.energyType === "time_bands") {
    out.energy_bands = t.bands.map((b) => ({ start: b.start, end: b.end, rate_gbp_mwh: mwh(b.rate) }));
    out.energy_other_gbp_mwh = mwh(t.otherRate);
  }
  if (t.exportType === "percent") out.export_percent = Number(t.exportPercent);
  if (t.exportType === "fee") out.export_fee_gbp_mwh = mwh(t.exportFee);
  if (t.exportType === "fixed") out.export_fixed_gbp_mwh = mwh(t.exportFixed);
  return out;
}

/** Plain summary of what the site's rate does to battery value, or null. */
export function tariffNote(t) {
  const fixedEnergy = t.energyType === "flat";
  if (fixedEnergy && t.duosBundled && t.policyBundled) {
    return "One rate all year leaves the battery nothing to trade. It can only earn from surplus and capacity.";
  }
  if (t.duosBundled) return "With DUoS inside your rate, the red, amber and green bands don't reach your bill.";
  return null;
}
