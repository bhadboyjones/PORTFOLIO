import { useState, useRef, useCallback, useEffect, useId } from "react";
import { getDnoRates, postRunCsv } from "../api/client";
import { bandsFromWindows } from "../components/dayTapeBands";
import { parseCsvMeta, peakKw, dataIssues } from "../lib/csvMeta";

const DNO_OPTIONS = [
  { key: "UKPN", label: "UK Power Networks (SE / East / London)" },
  { key: "NGED", label: "National Grid ED (SW / East Midlands)" },
  { key: "NPG",  label: "Northern Powergrid (NE / Yorkshire)" },
  { key: "ENWL", label: "Electricity North West (NW England)" },
  { key: "SPEN", label: "SP Energy Networks (Scotland / Merseyside)" },
  { key: "SSEN", label: "Scottish & Southern EN (N Scotland / South)" },
];


const DEFAULT_ADV = {
  necGbpMwh: "103.75",
  duosRed: "", duosAmber: "", duosGreen: "",
  gduosRed: "", gduosAmber: "", gduosGreen: "",
  fixedGbpPerDay: "", capacityRate: "", gduosFixed: "",
  ragRedStart: "16:00", ragRedEnd: "19:00",
  ragAmberMorningStart: "07:00", ragAmberMorningEnd: "16:00",
  ragAmberEveningStart: "19:00", ragAmberEveningEnd: "23:00",
  ragWeekendAmberStart: "", ragWeekendAmberEnd: "",
  chargeEffPct: "", dischargeEffPct: "",
  socMinPct: "5", socMaxPct: "95",
  degCostGbpMwh: "8",
};

function r4(v) { return String(parseFloat(v.toFixed(4))); }
function r6(v) { return String(parseFloat(v.toFixed(6))); }

// Mirrors src/csv_pipeline.py INPUT_UNITS.
const INPUT_UNIT_OPTIONS = [
  { value: "mw",  label: "MW: average power per interval" },
  { value: "kw",  label: "kW: average power per interval" },
  { value: "mwh", label: "MWh per interval (energy)" },
  { value: "kwh", label: "kWh per interval (energy)" },
];

export default function CsvConfigPage({ onRunStarted, jobError, jobErrorCode }) {
  const uid = useId();
  const fileInputRef = useRef(null);

  const [file, setFile]           = useState(null);
  const [parsedMeta, setParsedMeta] = useState(null);
  const [dragOver, setDragOver]   = useState(false);

  const [dnoKey, setDnoKey]               = useState("");
  const [voltageLevel, setVoltageLevel]   = useState("LV");
  const [priceExposure, setPriceExposure] = useState("da");
  const [thermalGenToggle, setThermalGenToggle] = useState(false);
  const [inputUnit, setInputUnit] = useState("mw");
  const [thermalMcGbpMwh, setThermalMcGbpMwh] = useState("70");
  const [micKva, setMicKva]           = useState("");
  const [micUnit, setMicUnit]         = useState("kva");
  const [powerFactor, setPowerFactor] = useState("1");

  const [powers, setPowers]           = useState(["1", "2", "3"]);
  const [capacities, setCapacities]   = useState(["1", "2", "4"]);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [exportLimits, setExportLimits]   = useState(["", "", "", ""]);
  const [bessMaxCycles, setBessMaxCycles] = useState("1.5");

  const [showAdvanced, setShowAdvanced]         = useState(false);
  const [advanced, setAdvanced]                 = useState({ ...DEFAULT_ADV });
  const [advancedDirty, setAdvancedDirty]       = useState(false);
  const [pendingDnoChange, setPendingDnoChange] = useState(null);
  const [dnoRatesLoading, setDnoRatesLoading]   = useState(false);
  const [ragWarning, setRagWarning]             = useState(null);
  const [dnoRateError, setDnoRateError]         = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError]     = useState(null);

  // Auto-select all valid cells whenever the power/capacity grid changes
  useEffect(() => {
    const next = new Set();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const pw = parseFloat(powers[r]);
        const cap = parseFloat(capacities[c]);
        if (pw > 0 && cap > 0) {
          const dur = cap / pw;
          if (dur >= 0.5 && dur <= 6.0) next.add(`${r},${c}`);
        }
      }
    }
    setSelectedCells(next);
  }, [powers, capacities]);

  // Derived
  const validExportLimits = exportLimits
    .filter(v => v !== "" && !isNaN(parseFloat(v)) && parseFloat(v) >= 0)
    .map(v => parseFloat(v));
  const validExportCount = validExportLimits.length;
  const selectedCount    = selectedCells.size;
  const scenarioCount    = selectedCount * validExportCount;
  const thermalGenWarning = thermalGenToggle && parsedMeta?.headers?.length > 0 && !parsedMeta.headers.includes("thermal_gen_mw");
  const resolutionError   = parsedMeta?.resolution?.valid === false;
  const [confirmData, setConfirmData] = useState(false);
  useEffect(() => { setConfirmData(false); }, [file, inputUnit]);
  const pfValid           = parseFloat(powerFactor) >= 0.5 && parseFloat(powerFactor) <= 1;
  const micValid          = micKva === "" || parseFloat(micKva) > 0;
  // Data check (mirrors the server): a unit mistake or a meter spike blocks the
  // run until fixed or confirmed; an export-only site needs its MIC entered.
  const issues            = dataIssues(parsedMeta, inputUnit, micKva !== "");
  const needsMic          = issues.some((i) => i.code === "mic_required") || jobErrorCode === "mic_required";
  const needsConfirm      = issues.some((i) => i.code === "data_check") || jobErrorCode === "data_check";
  const dataOk            = !needsMic && (!needsConfirm || confirmData);
  const canRun            = file != null && dnoKey !== "" && scenarioCount > 0 && scenarioCount <= 12 && !submitting && !resolutionError && !dnoRateError && pfValid && micValid && dataOk;

  const fetchAndPopulateRates = useCallback(async (dno, voltage) => {
    if (!dno) return;
    const effectiveVoltage = voltage === "unknown" ? "HV" : voltage;
    setDnoRatesLoading(true);
    try {
      const d = await getDnoRates(dno, effectiveVoltage);
      setAdvanced((prev) => ({
        ...prev,
        duosRed:   r4(d.duos_red_p_kwh   * 10),
        duosAmber: r4(d.duos_amber_p_kwh  * 10),
        duosGreen: r4(d.duos_green_p_kwh  * 10),
        gduosRed:   r4(d.gduos_red_p_kwh   * 10),
        gduosAmber: r4(d.gduos_amber_p_kwh  * 10),
        gduosGreen: r4(d.gduos_green_p_kwh  * 10),
        fixedGbpPerDay: r4(d.fixed_p_per_day          / 100),
        capacityRate:   r6(d.capacity_p_per_kva_day   / 100),
        gduosFixed:     r4(d.gduos_fixed_p_per_day    / 100),
        ragRedStart:          d.rag_red_start            || "16:00",
        ragRedEnd:            d.rag_red_end              || "19:00",
        ragAmberMorningStart: d.rag_amber_morning_start  || "07:00",
        ragAmberMorningEnd:   d.rag_amber_morning_end    || "16:00",
        ragAmberEveningStart: d.rag_amber_evening_start  || "19:00",
        ragAmberEveningEnd:   d.rag_amber_evening_end    || "23:00",
        ragWeekendAmberStart: d.rag_weekend_amber_start  || "",
        ragWeekendAmberEnd:   d.rag_weekend_amber_end    || "",
      }));
      setAdvancedDirty(false);
      setRagWarning(d.rag_warning || null);
      setDnoRateError(false);
    } catch {
      // Surface the failure: without DNO rates the RAG windows fall back to
      // generic defaults, which silently mis-prices the bands. Block the run.
      setDnoRateError(true);
    } finally {
      setDnoRatesLoading(false);
    }
  }, []);

  function handleDnoChange(newDno) {
    if (advancedDirty && showAdvanced) {
      setPendingDnoChange({ dno: newDno, voltage: voltageLevel });
    } else {
      setDnoKey(newDno);
      fetchAndPopulateRates(newDno, voltageLevel);
    }
  }

  function handleVoltageChange(newVoltage) {
    if (advancedDirty && showAdvanced && dnoKey) {
      setPendingDnoChange({ dno: dnoKey, voltage: newVoltage });
    } else {
      setVoltageLevel(newVoltage);
      if (dnoKey) fetchAndPopulateRates(dnoKey, newVoltage);
    }
  }

  function confirmDnoReset() {
    const { dno, voltage } = pendingDnoChange;
    setDnoKey(dno);
    setVoltageLevel(voltage);
    setPendingDnoChange(null);
    fetchAndPopulateRates(dno, voltage);
  }

  function keepCurrentRates() {
    const { dno, voltage } = pendingDnoChange;
    setDnoKey(dno);
    setVoltageLevel(voltage);
    setPendingDnoChange(null);
  }

  function updateAdv(field, value) {
    setAdvanced((prev) => ({ ...prev, [field]: value }));
    setAdvancedDirty(true);
  }

  async function handleFileChange(f) {
    setFile(f);
    setParsedMeta(null);
    if (f) {
      const meta = await parseCsvMeta(f);
      setParsedMeta(meta);
    }
  }

  async function handleRun() {
    setRunError(null);
    setSubmitting(true);
    try {
      // Build BESS configs from selected matrix cells (row order: powers × capacities)
      const bessConfigs = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if (selectedCells.has(`${r},${c}`)) {
            bessConfigs.push({ power_mw: parseFloat(powers[r]), capacity_mwh: parseFloat(capacities[c]) });
          }
        }
      }

      const fd = new FormData();
      fd.append("file", file);
      fd.append("dno_key", dnoKey);
      fd.append("voltage_level", voltageLevel === "unknown" ? "HV" : voltageLevel);
      fd.append("bess_configs_json", JSON.stringify(bessConfigs));
      fd.append("export_limits_json", JSON.stringify(validExportLimits));
      fd.append("bess_max_cycles", bessMaxCycles || "1.5");
      fd.append("chp_toggle", String(thermalGenToggle));
      fd.append("input_unit", inputUnit);
      fd.append("price_exposure", priceExposure);
      fd.append("nec_gbp_mwh", advanced.necGbpMwh || "103.75");
      fd.append("chp_mc_gbp_mwh", thermalMcGbpMwh || "70");
      if (micKva) fd.append("contracted_kva", micKva);
      fd.append("mic_unit", micUnit);
      fd.append("power_factor", powerFactor || "1");
      if (confirmData) fd.append("confirm_data", "true");

      // RAG band windows — always send (pre-populated from DNO defaults)
      fd.append("rag_red_start",           advanced.ragRedStart           || "16:00");
      fd.append("rag_red_end",             advanced.ragRedEnd             || "19:00");
      fd.append("rag_amber_morning_start", advanced.ragAmberMorningStart  || "07:00");
      fd.append("rag_amber_morning_end",   advanced.ragAmberMorningEnd    || "16:00");
      fd.append("rag_amber_evening_start", advanced.ragAmberEveningStart  || "19:00");
      fd.append("rag_amber_evening_end",   advanced.ragAmberEveningEnd    || "23:00");
      if (advanced.ragWeekendAmberStart) fd.append("rag_weekend_amber_start", advanced.ragWeekendAmberStart);
      if (advanced.ragWeekendAmberEnd)   fd.append("rag_weekend_amber_end",   advanced.ragWeekendAmberEnd);

      // Volumetric rate overrides — only if non-empty
      if (advanced.duosRed)   fd.append("duos_red_gbp_mwh",   advanced.duosRed);
      if (advanced.duosAmber) fd.append("duos_amber_gbp_mwh",  advanced.duosAmber);
      if (advanced.duosGreen) fd.append("duos_green_gbp_mwh",  advanced.duosGreen);
      // GDUoS: UI shows positive credits; API expects negative (model convention)
      if (advanced.gduosRed)   fd.append("gduos_red_gbp_mwh",   String(-Math.abs(parseFloat(advanced.gduosRed))));
      if (advanced.gduosAmber) fd.append("gduos_amber_gbp_mwh", String(-Math.abs(parseFloat(advanced.gduosAmber))));
      if (advanced.gduosGreen) fd.append("gduos_green_gbp_mwh", String(-Math.abs(parseFloat(advanced.gduosGreen))));
      if (advanced.fixedGbpPerDay) fd.append("fixed_gbp_per_day",          advanced.fixedGbpPerDay);
      if (advanced.capacityRate)   fd.append("capacity_gbp_per_kva_day",   advanced.capacityRate);
      if (advanced.gduosFixed)     fd.append("gduos_fixed_gbp_per_day",    advanced.gduosFixed);

      // BESS technical params — always send (have defaults)
      if (advanced.chargeEffPct)    fd.append("bess_charge_eff_pct",    advanced.chargeEffPct);
      if (advanced.dischargeEffPct) fd.append("bess_discharge_eff_pct", advanced.dischargeEffPct);
      fd.append("bess_soc_min_pct",      advanced.socMinPct    || "5");
      fd.append("bess_soc_max_pct",      advanced.socMaxPct    || "95");
      fd.append("bess_deg_cost_gbp_mwh", advanced.degCostGbpMwh || "8");

      // Weekday DUoS band shape actually used — drives the results-page tape
      const tapeBands = bandsFromWindows({
        redStart:          advanced.ragRedStart          || "16:00",
        redEnd:            advanced.ragRedEnd            || "19:00",
        amberMorningStart: advanced.ragAmberMorningStart || "07:00",
        amberMorningEnd:   advanced.ragAmberMorningEnd   || "16:00",
        amberEveningStart: advanced.ragAmberEveningStart || "19:00",
        amberEveningEnd:   advanced.ragAmberEveningEnd   || "23:00",
      });

      const { job_id } = await postRunCsv(fd);
      const ce = parseFloat(advanced.chargeEffPct), de = parseFloat(advanced.dischargeEffPct);
      onRunStarted(job_id, tapeBands, {
        fileName: file?.name,
        dnoLabel: DNO_OPTIONS.find((d) => d.key === dnoKey)?.label ?? dnoKey,
        voltage: voltageLevel === "unknown" ? "HV (assumed)" : voltageLevel,
        priceExposure,
        rtePct: Number.isFinite(ce) && Number.isFinite(de) ? (ce * de) / 100 : 90,
        maxCycles: parseFloat(bessMaxCycles || "1.5"),
        socMin: parseFloat(advanced.socMinPct || "5"),
        socMax: parseFloat(advanced.socMaxPct || "95"),
        degCost: parseFloat(advanced.degCostGbpMwh || "8"),
        nec: parseFloat(advanced.necGbpMwh || "103.75"),
      });
    } catch (e) {
      setRunError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ paddingBottom: 64 }}>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 0" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-title)", lineHeight: "32px", fontWeight: 700, letterSpacing: "-0.01em" }}>
          Site meter data
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 16, lineHeight: "24px", color: "var(--muted)" }}>
          Upload half-hourly or hourly meter data, choose the tariff and the battery sizes to compare.
        </p>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 24px 0" }}>

        {/* ── File Upload ─────────────────────────────── */}
        <Card label="Meter data">
          <div
            className="lift"
            role="button"
            tabIndex={0}
            aria-label={file ? `Replace uploaded file ${file.name}` : "Upload meter data, CSV or XLSX"}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); }
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) handleFileChange(f); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: dragOver ? "1.5px dashed var(--accent)" : file ? "1.5px dashed var(--signal-a40)" : "1.5px dashed var(--border)",
              borderRadius: 8,
              padding: "1.75rem 1.5rem",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "var(--signal-a05)" : file ? "#fafafa" : "var(--bg-surface)",
            }}
          >
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
              style={{ display: "none" }} />
            {file ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-pri)" }}>{file.name}</div>
                <div style={{ fontSize: 14, color: "var(--text-dim)", marginTop: "0.25rem" }}>
                  {(file.size / 1024).toFixed(0)} KB · click to replace
                </div>
                {thermalGenWarning && (
                  <div style={{ marginTop: "0.75rem", fontSize: 14, color: "var(--warn)",
                    background: "var(--pill-warning-bg)", border: "1px solid var(--pill-warning-line)",
                    borderRadius: 5, padding: "0.4rem 0.75rem", display: "inline-block" }}>
                    Thermal generation is enabled but <code style={{ color: "var(--warn)" }}>thermal_gen_mw</code> column not found in this CSV
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "1.4rem", marginBottom: "0.5rem", color: "var(--text-dim)" }}>↑</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-sec)" }}>
                  Drop CSV or XLSX here, or click to browse
                </div>
                <div style={{ fontSize: 14, color: "var(--text-dim)", marginTop: "0.35rem" }}>
                  Required: <code style={{ color: "var(--accent)" }}>timestamp</code>,{" "}
                  <code style={{ color: "var(--accent)" }}>net_demand_mw</code>
                  {" "}· Optional: <code style={{ color: "var(--accent)" }}>thermal_gen_mw</code>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: "0.4rem", lineHeight: 1.7 }}>
                  <code style={{ color: "var(--text-dim)" }}>net_demand_mw</code> is your boundary/grid meter reading – positive when the site is importing from the grid, negative when exporting.
                  {" "}If your metering records grid flow directly, use that column as-is. If you only have submetered data, calculate it as:
                  <br />
                  <code style={{ color: "var(--text-dim)" }}>net_demand_mw = site_load_mw − (all other BTM generation)</code>
                  {" "}e.g. <code style={{ color: "var(--text-dim)" }}>pv_gen_mw</code>, <code style={{ color: "var(--text-dim)" }}>wind_gen_mw</code>, <code style={{ color: "var(--text-dim)" }}>thermal_gen_mw</code>
                  <br />
                  PV, wind, and thermal generation must all be subtracted before uploading.
                </div>
              </div>
            )}
          </div>

          {/* Units — meters usually export energy per interval, but the model works
              in average MW. Picking the wrong unit halves (or 1000×) every number. */}
          <div style={{ marginTop: "1rem", maxWidth: 360 }}>
            <FieldLabel htmlFor={`${uid}-f1`}>Units of your meter values</FieldLabel>
            <select id={`${uid}-f1`} value={inputUnit} onChange={(e) => setInputUnit(e.target.value)} style={selectStyle(true)}>
              {INPUT_UNIT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: "0.35rem", lineHeight: 1.6 }}>
              Applies to <code>net_demand_mw</code> and <code>thermal_gen_mw</code>. Half-hourly meter exports
              are usually kWh or MWh per half-hour; they are converted to average MW on upload.
            </div>
          </div>
          {file && (
            <FileEcho
              file={file}
              meta={parsedMeta}
              inputUnit={inputUnit}
              dnoLabel={DNO_OPTIONS.find((d) => d.key === dnoKey)?.label}
              issues={issues}
            />
          )}
          {needsConfirm && !needsMic && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, fontSize: 14 }}>
              <input type="checkbox" checked={confirmData} onChange={(e) => setConfirmData(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                <strong style={{ fontWeight: 500 }}>My data is correct.</strong>{" "}
                <span style={{ color: "var(--muted)" }}>Run it anyway; results will be based on these readings as they are.</span>
              </span>
            </label>
          )}
        </Card>

        {/* ── Site Configuration ──────────────────────── */}
        <Card label="Site and tariff">
          <div className="adv-grid-2" style={{ gap: "1rem" }}>

            {/* DNO */}
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel htmlFor={`${uid}-f2`}>Network operator (DNO)</FieldLabel>
              <select id={`${uid}-f2`} value={dnoKey} onChange={(e) => handleDnoChange(e.target.value)} style={selectStyle(dnoKey !== "")}>
                <option value="">Select your DNO</option>
                {DNO_OPTIONS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              {dnoRatesLoading && (
                <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: "0.3rem" }}>
                  Loading DNO rates…
                </div>
              )}
              {dnoRateError && (
                <div style={{
                  fontSize: 12, color: "var(--negative)", marginTop: "0.3rem",
                  background: "var(--pill-negative-bg)", border: "1px solid #f3c3bf",
                  borderRadius: 5, padding: "0.4rem 0.6rem",
                }}>
                  Couldn’t load DNO rates, so band windows would fall back to generic
                  defaults and mis-price the tariff. Check your connection and reselect
                  the DNO, or enter rates manually in Advanced settings.
                </div>
              )}
            </div>

            {/* Voltage */}
            <div>
              <FieldLabel id={`${uid}-volt`}>Connection voltage</FieldLabel>
              <div role="group" aria-labelledby={`${uid}-volt`} style={{ display: "flex", gap: "0.5rem" }}>
                {[{ value: "LV", label: "LV" }, { value: "HV", label: "HV" }, { value: "unknown", label: "Not sure" }].map(({ value, label }) => {
                  const active = voltageLevel === value;
                  return (
                    <button key={value} className="lift" aria-pressed={active} onClick={() => handleVoltageChange(value)} style={{
                      flex: 1, padding: "0.5rem",
                      border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                      borderRadius: 6,
                      background: active ? "var(--signal-a10)" : "var(--bg-surface)",
                      color: active ? "var(--accent)" : "var(--text-dim)",
                      cursor: "pointer", fontSize: 14, fontWeight: active ? 700 : 500,
                    }}>{label}</button>
                  );
                })}
              </div>
              {voltageLevel === "unknown" && (
                <div style={{ marginTop: "0.4rem", fontSize: 12, color: "var(--text-dim)" }}>
                  Defaults to HV: lower DUoS rates give a conservative savings estimate. Select LV or HV if known.
                </div>
              )}
            </div>

            {/* Agreed import capacity (MIC) */}
            <div>
              <FieldLabel htmlFor={`${uid}-mic`}>Agreed import capacity (MIC)</FieldLabel>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <div style={{ flex: 1 }}>
                  <SuffixInput id={`${uid}-mic`} type="number" step="any" min="0"
                    placeholder="From your agreement…"
                    value={micKva}
                    onChange={(e) => setMicKva(e.target.value)}
                    suffix="" />
                </div>
                {[["kva", "kVA"], ["kw", "kW"], ["mw", "MW"]].map(([value, label]) => {
                  const active = micUnit === value;
                  return (
                    <button key={value} className="lift" aria-pressed={active} onClick={() => setMicUnit(value)} style={{
                      padding: "0.5rem 0.6rem",
                      border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                      borderRadius: 6,
                      background: active ? "var(--signal-a10)" : "var(--bg-surface)",
                      color: active ? "var(--accent)" : "var(--text-dim)",
                      cursor: "pointer", fontSize: 14, fontWeight: active ? 700 : 500,
                    }}>{label}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: "0.2rem" }}>
                {!micKva
                  ? "Blank = assumed equal to the peak import in your data, which hides any capacity headroom."
                  : micUnit === "kva"
                    ? "Use the unit written in your agreement. kVA: import cap = MIC × power factor."
                    : "Use the unit written in your agreement. kW/MW: used as the import cap directly; power factor converts it to kVA for the capacity charge."}
              </div>
            </div>

            {/* Power factor */}
            <div>
              <FieldLabel htmlFor={`${uid}-f3`}>Power factor</FieldLabel>
              <SuffixInput id={`${uid}-f3`} type="number" step="0.01" min="0.5" max="1"
                value={powerFactor}
                onChange={(e) => setPowerFactor(e.target.value)}
                suffix="PF" />
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: "0.2rem" }}>
                {!pfValid
                  ? "Power factor must be between 0.5 and 1.0."
                  : parseFloat(powerFactor) === 1
                  ? "Default 1.0 (kW = kVA). Use your meter's figure if known."
                  : `Import cap = MIC × ${powerFactor} in kW.`}
              </div>
            </div>

            {/* Thermal generation toggle */}
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel id={`${uid}-chp`}>On-site thermal generation? (CHP, genset, gas engine)</FieldLabel>
              <div role="group" aria-labelledby={`${uid}-chp`} style={{ display: "flex", gap: "0.5rem", maxWidth: 240 }}>
                {[{ value: false, label: "No" }, { value: true, label: "Yes" }].map(({ value, label }) => {
                  const active = thermalGenToggle === value;
                  return (
                    <button key={String(value)} className="lift" aria-pressed={active} onClick={() => setThermalGenToggle(value)} style={{
                      flex: 1, padding: "0.5rem",
                      border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                      borderRadius: 6,
                      background: active ? "var(--signal-a10)" : "var(--bg-surface)",
                      color: active ? "var(--accent)" : "var(--text-dim)",
                      cursor: "pointer", fontSize: 14, fontWeight: active ? 700 : 500,
                    }}>{label}</button>
                  );
                })}
              </div>
              {thermalGenToggle && (
                <div style={{ marginTop: "0.75rem" }}>
                  <div style={{ maxWidth: 240 }}>
                    <FieldLabel htmlFor={`${uid}-f4`}>Thermal generation marginal cost</FieldLabel>
                    <SuffixInput id={`${uid}-f4`}
                      type="number" step="0.5" min="0"
                      value={thermalMcGbpMwh}
                      onChange={(e) => setThermalMcGbpMwh(e.target.value)}
                      suffix="£/MWh"
                    />
                  </div>
                  <div style={{
                    marginTop: "0.75rem",
                    fontSize: 12,
                    color: "var(--text-dim)",
                    background: "var(--pill-warning-bg)",
                    border: "1px solid var(--pill-warning-line)",
                    borderRadius: 5,
                    padding: "0.5rem 0.75rem",
                    lineHeight: 1.6,
                    maxWidth: 520,
                  }}>
                    Thermal generation is treated as a fixed input. flexiq calculates its fuel cost in the baseline but does not co-optimise BESS dispatch with dispatchable thermal. Sites where BESS value comes from modulating a thermal asset or genset are still work in progress.
                  </div>
                </div>
              )}
            </div>

          </div>
        </Card>

        {/* ── BESS Configuration ──────────────────────── */}
        <Card label="Battery sizes">

          {/* 3×3 power × capacity matrix */}
          <div className="bess-matrix-scroll" style={{ marginBottom: "1rem" }}>
            <div className="bess-grid" style={{ display: "grid", gridTemplateColumns: "112px repeat(3, minmax(0, 1fr))", gap: "0.4rem" }}>

              {/* Top-left corner */}
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "0.3rem" }}>
                <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: "16px" }}>
                  Rows: power<br />Columns: capacity
                </span>
              </div>

              {/* Capacity column headers */}
              {capacities.map((cap, c) => (
                <SuffixInput
                  key={c}
                  aria-label={`Capacity, column ${c + 1}, MWh`}
                  type="number" min="0.1" step="0.5"
                  value={cap}
                  onChange={(e) => {
                    const next = [...capacities];
                    next[c] = e.target.value;
                    setCapacities(next);
                  }}
                  suffix="MWh"
                />
              ))}

              {/* Power row headers + cells */}
              {powers.map((pw, r) => [
                <SuffixInput
                  key={`pw-${r}`}
                  aria-label={`Power, row ${r + 1}, MW`}
                  type="number" min="0.1" step="0.5"
                  value={pw}
                  onChange={(e) => {
                    const next = [...powers];
                    next[r] = e.target.value;
                    setPowers(next);
                  }}
                  suffix="MW"
                />,
                ...capacities.map((cap, c) => {
                  const pwVal = parseFloat(pw);
                  const capVal = parseFloat(cap);
                  const dur = pwVal > 0 && capVal > 0 ? capVal / pwVal : null;
                  const cellValid = dur !== null && dur >= 0.5 && dur <= 6.0;
                  const key = `${r},${c}`;
                  const isSelected = cellValid && selectedCells.has(key);
                  return (
                    <button
                      key={key}
                      className="lift"
                      aria-pressed={isSelected}
                      disabled={!cellValid}
                      aria-label={cellValid ? `${pwVal} MW / ${capVal} MWh, ${dur.toFixed(1)} hours` : `${pw} MW / ${cap} MWh, duration outside 0.5 to 6 hours`}
                      onClick={() => {
                        if (!cellValid) return;
                        setSelectedCells(prev => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key); else next.add(key);
                          return next;
                        });
                      }}
                      style={{
                        padding: "0.55rem 0.25rem",
                        border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                        borderRadius: 6,
                        background: !cellValid ? "var(--bg-base)" : isSelected ? "var(--signal-a10)" : "var(--bg-surface)",
                        color: !cellValid ? "var(--faint)" : isSelected ? "var(--ink)" : "var(--muted)",
                        cursor: cellValid ? "pointer" : "not-allowed",
                        fontSize: 12,
                        fontWeight: isSelected ? 700 : 500,
                        textAlign: "center",
                        width: "100%",
                      }}
                    >
                      {cellValid && dur !== null ? `${dur.toFixed(1)}h` : dur !== null && dur < 0.5 ? "< 0.5h" : dur !== null && dur > 6.0 ? "> 6h" : "–"}
                    </button>
                  );
                }),
              ])}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: "0.4rem" }}>
              Select the sizes to compare. Each cell shows the battery's duration (capacity ÷ power); sizes outside 0.5 to 6 hours can't be selected.
            </div>
          </div>

          {/* Global BESS params */}
          <div style={{ maxWidth: 240, marginBottom: "1rem" }}>
            <FieldLabel htmlFor={`${uid}-f5`}>Maximum cycles a day</FieldLabel>
            <input id={`${uid}-f5`}
              type="number" min="0.5" max="4" step="0.5"
              value={bessMaxCycles}
              onChange={(e) => setBessMaxCycles(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Export limits */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            <FieldLabel id={`${uid}-exp`}>Export limits (up to 4 scenarios)</FieldLabel>
            <div className="export-grid" role="group" aria-labelledby={`${uid}-exp`}>
              {exportLimits.map((v, i) => (
                <SuffixInput
                  key={i}
                  aria-label={`Export limit ${i + 1}, MW${i === 0 ? "" : ", optional"}`}
                  type="number" min="0" step="0.25"
                  placeholder={i === 0 ? "e.g. 1.0 (0 for none)" : "Optional"}
                  value={v}
                  onChange={(e) => setExportLimits(prev => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })}
                  suffix="MW"
                />
              ))}
            </div>
          </div>

          {/* Scenario count */}
          <div style={{
            marginTop: "0.75rem",
            fontSize: 14,
            padding: "0.45rem 0.85rem",
            background: "#fafafa",
            border: `1px solid ${scenarioCount > 12 ? "var(--negative-a30)" : "var(--border)"}`,
            borderRadius: 5,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ color: scenarioCount > 12 ? "var(--negative)" : scenarioCount > 0 ? "var(--text-sec)" : "var(--text-dim)" }}>
              <strong className="tnum" style={{ color: scenarioCount > 12 ? "var(--negative)" : "var(--accent)" }}>{scenarioCount}</strong>
              {" "}scenario{scenarioCount !== 1 ? "s" : ""}
              {" "}({selectedCount} config{selectedCount !== 1 ? "s" : ""} × {validExportCount} export limit{validExportCount !== 1 ? "s" : ""})
            </span>
            {scenarioCount > 12 && (
              <span style={{ fontSize: 12, color: "var(--negative)" }}>max 12. Deselect some configs</span>
            )}
          </div>

        </Card>

        {/* ── Price Exposure ──────────────────────────── */}
        <Card label="Price signal">
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {[
              { value: "da",        label: "Day-ahead (DA)",     desc: "Elexon market index, a day-ahead proxy" },
              { value: "imbalance", label: "Imbalance (system)", desc: "Settled against the system imbalance price" },
            ].map(({ value, label, desc }) => {
              const active = priceExposure === value;
              return (
                <button key={value} className="lift" aria-pressed={active} onClick={() => setPriceExposure(value)} style={{
                  flex: 1, minWidth: 220, padding: "0.85rem 1rem",
                  border: active ? "1px solid var(--ink)" : "1px solid var(--control)",
                  borderRadius: "var(--radius-control)",
                  background: active ? "var(--raised)" : "var(--surface)",
                  cursor: "pointer", textAlign: "left", font: "inherit",
                }}>
                  <div style={{ fontWeight: 500, fontSize: 14, color: "var(--ink)", marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{desc}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* ── Advanced ────────────────────────────────── */}
        <div style={{ marginBottom: "1rem" }}>
          <button
            className="lift"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-card)",
              padding: "12px 24px",
              color: "var(--ink)",
              cursor: "pointer",
              font: "inherit",
              fontWeight: 500,
              width: "100%",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Advanced settings{advancedDirty ? <span style={{ color: "var(--muted)", fontWeight: 400 }}> (edited)</span> : ""}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ transform: showAdvanced ? "rotate(180deg)" : "none" }}>
              <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>

          {showAdvanced && (
            <div style={{
              marginTop: "0.5rem",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "1.5rem",
            }}>

              {/* DNO reset prompt */}
              {pendingDnoChange && (
                <div style={{
                  marginBottom: "1.25rem",
                  padding: "0.85rem 1rem",
                  background: "var(--pill-warning-bg)",
                  border: "1px solid var(--pill-warning-line)",
                  borderRadius: 7,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}>
                  <span style={{ fontSize: 14, color: "var(--warn)" }}>
                    DNO changed to <strong>{pendingDnoChange.dno}</strong>. Reset rates to new DNO defaults?
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={confirmDnoReset} style={{ ...smallBtn, borderColor: "var(--warn)", color: "var(--warn)", background: "var(--surface)" }}>
                      Yes, reset
                    </button>
                    <button onClick={keepCurrentRates} style={{ ...smallBtn, borderColor: "var(--border)", color: "var(--text-dim)" }}>
                      Keep current
                    </button>
                  </div>
                </div>
              )}

              {ragWarning && (
                <div style={{ marginBottom: "1rem", fontSize: 14, color: "var(--warn)",
                  background: "var(--pill-warning-bg)", border: "1px solid var(--pill-warning-line)",
                  borderRadius: 5, padding: "0.4rem 0.75rem" }}>
                  {ragWarning}
                </div>
              )}

              {/* Site assumptions */}
              <AdvancedSection label="Site Assumptions">
                <div className="adv-grid-2">
                  <div>
                    <FieldLabel htmlFor={`${uid}-f6`}>Non-energy charges</FieldLabel>
                    <SuffixInput id={`${uid}-f6`} type="number" step="0.01" min="0"
                      value={advanced.necGbpMwh}
                      onChange={(e) => updateAdv("necGbpMwh", e.target.value)}
                      suffix="£/MWh" />
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: "0.2rem" }}>EII-exempt sites: 43.75</div>
                  </div>
                </div>
              </AdvancedSection>

              {/* DUoS rates */}
              <AdvancedSection label="DUoS Import Rates">
                <div className="adv-grid-3">
                  {[["Red", "duosRed"], ["Amber", "duosAmber"], ["Green", "duosGreen"]].map(([band, key]) => (
                    <div key={key}>
                      <FieldLabel htmlFor={`${uid}-f7-${key}`}>{band}</FieldLabel>
                      <SuffixInput id={`${uid}-f7-${key}`} type="number" step="0.01" min="0"
                        value={advanced[key]}
                        onChange={(e) => updateAdv(key, e.target.value)}
                        suffix="£/MWh" />
                    </div>
                  ))}
                </div>
              </AdvancedSection>

              {/* GDUoS credits */}
              <AdvancedSection label="GDUoS Export Credits (enter as positive)">
                <div className="adv-grid-3">
                  {[["Red", "gduosRed"], ["Amber", "gduosAmber"], ["Green", "gduosGreen"]].map(([band, key]) => (
                    <div key={key}>
                      <FieldLabel htmlFor={`${uid}-f8-${key}`}>{band}</FieldLabel>
                      <SuffixInput id={`${uid}-f8-${key}`} type="number" step="0.01" min="0"
                        value={advanced[key]}
                        onChange={(e) => updateAdv(key, e.target.value)}
                        suffix="£/MWh" />
                    </div>
                  ))}
                </div>
              </AdvancedSection>

              {/* Standing charges */}
              <AdvancedSection label="Standing Charges">
                <div className="adv-grid-3">
                  <div>
                    <FieldLabel htmlFor={`${uid}-f9`}>DUoS fixed</FieldLabel>
                    <SuffixInput id={`${uid}-f9`} type="number" step="0.01" min="0"
                      value={advanced.fixedGbpPerDay}
                      onChange={(e) => updateAdv("fixedGbpPerDay", e.target.value)}
                      suffix="£/day" />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`${uid}-f10`}>DUoS capacity</FieldLabel>
                    <SuffixInput id={`${uid}-f10`} type="number" step="0.0001" min="0"
                      value={advanced.capacityRate}
                      onChange={(e) => updateAdv("capacityRate", e.target.value)}
                      suffix="£/kVA/day" />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`${uid}-f11`}>GDUoS fixed credit</FieldLabel>
                    <SuffixInput id={`${uid}-f11`} type="number" step="0.01" min="0"
                      value={advanced.gduosFixed}
                      onChange={(e) => updateAdv("gduosFixed", e.target.value)}
                      suffix="£/day" />
                  </div>
                </div>
              </AdvancedSection>

              {/* RAG band time windows */}
              <AdvancedSection label="DUoS Time Band Windows (HH:MM)">
                <div className="adv-grid-2" style={{ gap: "1rem" }}>

                  <div>
                    <FieldLabel htmlFor={`${uid}-ragRed`}>Red band (weekday)</FieldLabel>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <TimeInput id={`${uid}-ragRed`} label="Red band (weekday), start" value={advanced.ragRedStart} onChange={(v) => updateAdv("ragRedStart", v)} />
                      <span style={{ color: "var(--text-dim)", fontSize: 14 }}>to</span>
                      <TimeInput label="Red band (weekday), end" value={advanced.ragRedEnd} onChange={(v) => updateAdv("ragRedEnd", v)} />
                    </div>
                  </div>

                  <div>
                    <FieldLabel htmlFor={`${uid}-ragAmberMorning`}>Amber band, morning (weekday)</FieldLabel>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <TimeInput id={`${uid}-ragAmberMorning`} label="Amber band, morning (weekday), start" value={advanced.ragAmberMorningStart} onChange={(v) => updateAdv("ragAmberMorningStart", v)} />
                      <span style={{ color: "var(--text-dim)", fontSize: 14 }}>to</span>
                      <TimeInput label="Amber band, morning (weekday), end" value={advanced.ragAmberMorningEnd} onChange={(v) => updateAdv("ragAmberMorningEnd", v)} />
                    </div>
                  </div>

                  <div>
                    <FieldLabel htmlFor={`${uid}-ragAmberEvening`}>Amber band, evening (weekday)</FieldLabel>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <TimeInput id={`${uid}-ragAmberEvening`} label="Amber band, evening (weekday), start" value={advanced.ragAmberEveningStart} onChange={(v) => updateAdv("ragAmberEveningStart", v)} />
                      <span style={{ color: "var(--text-dim)", fontSize: 14 }}>to</span>
                      <TimeInput label="Amber band, evening (weekday), end" value={advanced.ragAmberEveningEnd} onChange={(v) => updateAdv("ragAmberEveningEnd", v)} />
                    </div>
                  </div>

                  <div>
                    <FieldLabel htmlFor={`${uid}-ragWeekendAmber`}>Amber band, weekend (optional)</FieldLabel>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <TimeInput id={`${uid}-ragWeekendAmber`} label="Amber band, weekend (optional), start"
                        value={advanced.ragWeekendAmberStart}
                        onChange={(v) => updateAdv("ragWeekendAmberStart", v)}
                        placeholder="–"
                      />
                      <span style={{ color: "var(--text-dim)", fontSize: 14 }}>to</span>
                      <TimeInput label="Amber band, weekend (optional), end"
                        value={advanced.ragWeekendAmberEnd}
                        onChange={(v) => updateAdv("ragWeekendAmberEnd", v)}
                        placeholder="–"
                      />
                    </div>
                  </div>

                </div>
              </AdvancedSection>

              {/* BESS Technical Parameters */}
              <AdvancedSection label="BESS Technical Parameters">
                <div className="adv-grid-3" style={{ marginBottom: "0.75rem" }}>
                  <div>
                    <FieldLabel htmlFor={`${uid}-f12`}>Charge efficiency</FieldLabel>
                    <SuffixInput id={`${uid}-f12`} type="number" step="0.5" min="50" max="100"
                      placeholder="90"
                      value={advanced.chargeEffPct}
                      onChange={(e) => updateAdv("chargeEffPct", e.target.value)}
                      suffix="%" />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`${uid}-f13`}>Discharge efficiency</FieldLabel>
                    <SuffixInput id={`${uid}-f13`} type="number" step="0.5" min="50" max="100"
                      placeholder="90"
                      value={advanced.dischargeEffPct}
                      onChange={(e) => updateAdv("dischargeEffPct", e.target.value)}
                      suffix="%" />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`${uid}-f14`}>Degradation cost</FieldLabel>
                    <SuffixInput id={`${uid}-f14`} type="number" step="0.5" min="0"
                      value={advanced.degCostGbpMwh}
                      onChange={(e) => updateAdv("degCostGbpMwh", e.target.value)}
                      suffix="£/MWh" />
                  </div>
                </div>
                <div className="adv-grid-2">
                  <div>
                    <FieldLabel htmlFor={`${uid}-f15`}>Minimum SOC</FieldLabel>
                    <SuffixInput id={`${uid}-f15`} type="number" step="1" min="0" max="50"
                      value={advanced.socMinPct}
                      onChange={(e) => updateAdv("socMinPct", e.target.value)}
                      suffix="%" />
                  </div>
                  <div>
                    <FieldLabel htmlFor={`${uid}-f16`}>Maximum SOC</FieldLabel>
                    <SuffixInput id={`${uid}-f16`} type="number" step="1" min="50" max="100"
                      value={advanced.socMaxPct}
                      onChange={(e) => updateAdv("socMaxPct", e.target.value)}
                      suffix="%" />
                  </div>
                </div>
              </AdvancedSection>

            </div>
          )}
        </div>

        {/* ── Errors ──────────────────────────────────── */}
        {jobError && (
          <div role="alert" style={errorBox}>
            {jobErrorCode === "data_check" || jobErrorCode === "mic_required" ? "Check your data: " : "Run failed: "}{jobError}
          </div>
        )}
        {runError && (
          <div role="alert" style={errorBox}>{runError}</div>
        )}

        {/* ── Run button ──────────────────────────────── */}
        <button
          className="btn-primary"
          onClick={handleRun}
          disabled={!canRun}
          style={{ width: "100%", height: 44, fontSize: 16 }}
        >
          {submitting ? "Starting the run…" : `Run optimisation${scenarioCount > 0 && scenarioCount <= 12 ? ` (${scenarioCount} scenario${scenarioCount === 1 ? "" : "s"})` : ""}`}
        </button>

        {!canRun && !submitting && (
          <div aria-live="polite" style={{ marginTop: 8, fontSize: 14, color: "var(--muted)" }}>
            To run:{" "}
            {[
              !file && "upload a CSV or XLSX",
              resolutionError && "use 30-minute or hourly data",
              !dnoKey && "choose a DNO",
              selectedCount === 0 && "select at least one battery size",
              validExportCount === 0 && "enter at least one export limit (0 for none)",
              scenarioCount > 12 && `cut the scenarios to 12 or fewer (now ${scenarioCount})`,
              !pfValid && "set the power factor between 0.5 and 1.0",
              !micValid && "enter a MIC above zero, or leave it blank",
              needsMic && "enter the site's MIC (it never imports in this data)",
              needsConfirm && !needsMic && !confirmData && "fix the data or tick \u201cMy data is correct\u201d",
            ].filter(Boolean).join(", ")}.
          </div>
        )}

      </div>
    </div>
  );
}


// ─── Sub-components ──────────────────────────────────────────────────────────

function Card({ label, children }) {
  return (
    <section style={{
      background: "var(--surface)",
      border: "1px solid var(--line)",
      borderRadius: "var(--radius-card)",
      padding: 24,
      marginBottom: "var(--gap)",
    }}>
      <h2 style={{ margin: "0 0 16px", fontSize: "var(--fs-section)", lineHeight: "24px", fontWeight: 500 }}>
        {label}
      </h2>
      {children}
    </section>
  );
}

function AdvancedSection({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
        {label}
      </h3>
      {children}
    </div>
  );
}

function FieldLabel({ children, htmlFor, id, style }) {
  const st = { display: "block", fontSize: 14, fontWeight: 500, color: "var(--ink)", marginBottom: 6, ...style };
  return htmlFor
    ? <label htmlFor={htmlFor} id={id} style={st}>{children}</label>
    : <span id={id} style={st}>{children}</span>;
}

function SuffixInput({ suffix, ...props }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        inputMode="decimal"
        autoComplete="off"
        {...props}
        className="tnum"
        style={{
          ...inputStyle,
          paddingRight: !suffix ? 10 : suffix.length > 4 ? "5.5rem" : "3.25rem",
        }}
      />
      <span aria-hidden="true" style={{
        position: "absolute",
        right: 10,
        fontSize: 12,
        color: "var(--muted)",
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}>
        {suffix}
      </span>
    </div>
  );
}

function TimeInput({ value, onChange, placeholder = "HH:MM", label, id }) {
  return (
    <input
      type="text"
      id={id}
      aria-label={label}
      autoComplete="off"
      inputMode="numeric"
      pattern="[0-2][0-9]:[0-5][0-9]"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, width: 80, textAlign: "center", padding: "0 8px" }}
    />
  );
}

function selectStyle() {
  return {
    width: "100%",
    height: 36,
    padding: "0 10px",
    background: "var(--surface)",
    border: "1px solid var(--control)",
    borderRadius: "var(--radius-control)",
    color: "var(--ink)",
    fontSize: 14,
    cursor: "pointer",
  };
}

const inputStyle = {
  width: "100%",
  height: 36,
  padding: "0 10px",
  background: "var(--surface)",
  border: "1px solid var(--control)",
  borderRadius: "var(--radius-control)",
  color: "var(--ink)",
  fontSize: 14,
  boxSizing: "border-box",
};

const errorBox = {
  marginBottom: "var(--gap)",
  padding: "10px 14px",
  background: "var(--pill-negative-bg)",
  border: "1px solid #f3c3bf",
  borderRadius: "var(--radius-card)",
  color: "var(--pill-negative-ink)",
  fontSize: 14,
};

const smallBtn = {
  padding: "0.3rem 0.75rem",
  fontSize: 14,
  fontWeight: 600,
  border: "1px solid",
  borderRadius: 5,
  cursor: "pointer",
  background: "none",
};


// What flexiq read from the file, echoed before the run so a wrong unit,
// a gap or the wrong DNO shows up now rather than in the results.
function FileEcho({ file, meta, inputUnit, dnoLabel, issues = [] }) {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const peak = peakKw(meta, inputUnit);
  const nf = (v, d = 0) => v == null ? "\u2013" : v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d });
  const rows = isCsv && meta ? [
    ["Intervals", nf(meta.rows)],
    ["Period", meta.dateRange ? `${meta.dateRange.start} to ${meta.dateRange.end}` : "\u2013"],
    ["Resolution", meta.resolution?.label ?? "\u2013", meta.resolution && !meta.resolution.valid],
    ["Coverage", meta.coverageDays != null ? `${nf(meta.coverageDays, 1)} days${meta.gaps ? `, ${nf(meta.gaps)} missing interval${meta.gaps === 1 ? "" : "s"}` : ", no gaps"}` : "\u2013", !!meta.gaps],
    ["Peak import", peak != null ? `${nf(peak)} kW in the selected unit` : "\u2013", peak != null && (peak > 100000 || peak < 1)],
    ["DNO tariff", dnoLabel ?? "Choose below"],
    ["Columns", meta.headers.join(", ")],
  ] : [];
  return (
    <div aria-live="polite" style={{ marginTop: 16, padding: 16, borderRadius: "var(--radius-card)", background: "#fafafa" }}>
      <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 500 }}>What flexiq read from {file.name}</p>
      {isCsv ? (
        <dl className="tnum" style={{ margin: 0, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 16px", fontSize: 14 }}>
          {rows.map(([k, v, warn]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt style={{ color: "var(--muted)" }}>{k}</dt>
              <dd style={{ margin: 0, overflowWrap: "anywhere", color: warn ? "var(--warning)" : "var(--ink)" }}>{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
          XLSX files are read on the server. Coverage, gaps and the peak appear on the results page.
        </p>
      )}
      {issues.map((i) => (
        <p key={i.code} role="alert" style={{ margin: "8px 0 0", fontSize: 14, padding: "8px 12px", borderRadius: 6, background: "var(--pill-warning-bg)", border: "1px solid var(--pill-warning-line)", color: "var(--pill-warning-ink)" }}>
          {i.text}
        </p>
      ))}
      {isCsv && peak != null && !issues.length && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
          If the peak looks 1,000 times too big or small, change the unit above.
        </p>
      )}
    </div>
  );
}
