// Tariff form state and its payload for the API (src/tariff.py). Rates are typed
// in p/kWh, as contracts state them, and sent in £/MWh.

export const ENERGY_OPTIONS = [
  { value: "indexed", label: "Day-ahead indexed", hint: "You pay the half-hourly day-ahead price." },
  { value: "percent", label: "Percentage of day-ahead", hint: "A share of the half-hourly price." },
  { value: "adder", label: "Day-ahead plus a margin", hint: "The half-hourly price plus a fixed adder." },
  { value: "time_bands", label: "Fixed time bands", hint: "Fixed rates by time of day, such as day, evening and night." },
  { value: "flat", label: "Flat rate", hint: "One rate every half-hour." },
];

export const EXPORT_OPTIONS = [
  { value: "indexed", label: "Day-ahead indexed" },
  { value: "percent", label: "Percentage of day-ahead" },
  { value: "fee", label: "Day-ahead less a fee" },
  { value: "fixed", label: "Fixed rate" },
  { value: "system", label: "System price (fully exposed)" },
];

export const DEFAULT_TARIFF_FORM = {
  energyType: "indexed", energyPercent: "100", energyAdder: "0", energyFlat: "",
  bands: [
    { start: "07:00", end: "19:00", rate: "" },
    { start: "19:00", end: "23:00", rate: "" },
  ],
  otherRate: "",
  duosBundled: false, capacityBundled: false, policyBundled: false,
  exportType: "indexed", exportPercent: "100", exportFee: "0", exportFixed: "",
  gduosPassedOn: true,
};

const HHMM = /^([01]\d|2[0-4]):[0-5]\d$/;
const isNum = (v) => String(v).trim() !== "" && Number.isFinite(Number(v));
const mwh = (pPerKwh) => Number(pPerKwh) * 10;

/** The first thing stopping a run, or null. */
export function tariffProblem(t) {
  if (t.energyType === "percent" && !(Number(t.energyPercent) > 0)) return "Enter the percentage of day-ahead";
  if (t.energyType === "adder" && !isNum(t.energyAdder)) return "Enter the margin in p/kWh";
  if (t.energyType === "flat" && !isNum(t.energyFlat)) return "Enter the flat rate in p/kWh";
  if (t.energyType === "time_bands") {
    if (!isNum(t.otherRate)) return "Enter the rate for all other times";
    if (t.bands.some((b) => !isNum(b.rate))) return "Enter a rate for each time band";
    if (t.bands.some((b) => !HHMM.test(b.start) || !HHMM.test(b.end))) return "Enter band times as HH:MM";
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
