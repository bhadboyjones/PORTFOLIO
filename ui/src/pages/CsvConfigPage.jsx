import { useState, useRef, useCallback } from "react";
import { getDnoRates, postRunCsv } from "../api/client";

const DNO_OPTIONS = [
  { key: "UKPN", label: "UK Power Networks (SE / East / London)" },
  { key: "NGED", label: "National Grid ED (SW / East Midlands)" },
  { key: "NPG",  label: "Northern Powergrid (NE / Yorkshire)" },
  { key: "ENWL", label: "Electricity North West (NW England)" },
  { key: "SPEN", label: "SP Energy Networks (Scotland / Merseyside)" },
  { key: "SSEN", label: "Scottish & Southern EN (N Scotland / South)" },
];

const BESS_PRESETS = [
  { label: "— Select a standard config —", power: null, capacity: null },
  { label: "1 MW / 2 MWh  (2h)",  power: 1,  capacity: 2 },
  { label: "1 MW / 4 MWh  (4h)",  power: 1,  capacity: 4 },
  { label: "2 MW / 4 MWh  (2h)",  power: 2,  capacity: 4 },
  { label: "2 MW / 8 MWh  (4h)",  power: 2,  capacity: 8 },
  { label: "3 MW / 6 MWh  (2h)",  power: 3,  capacity: 6 },
  { label: "3 MW / 12 MWh (4h)",  power: 3,  capacity: 12 },
];

const DEFAULT_ADV = {
  contractedKva: "",
  necGbpMwh: "103.75",
  duosRed: "", duosAmber: "", duosGreen: "",
  gduosRed: "", gduosAmber: "", gduosGreen: "",
  fixedGbpPerDay: "", capacityRate: "", gduosFixed: "",
  ragRedStart: "16:00", ragRedEnd: "19:00",
  ragAmberMorningStart: "07:00", ragAmberMorningEnd: "16:00",
  ragAmberEveningStart: "19:00", ragAmberEveningEnd: "23:00",
  ragWeekendAmberStart: "", ragWeekendAmberEnd: "",
};

function r4(v) { return String(parseFloat(v.toFixed(4))); }
function r6(v) { return String(parseFloat(v.toFixed(6))); }

async function parseCsvMeta(file) {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { rows: null, headers: [], dateRange: null, resolution: null };
  }
  try {
    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return { rows: 0, headers: [], dateRange: null, resolution: null };
    const headers = lines[0]
      .split(",")
      .map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
    const rows = lines.length - 1;
    const tsIdx = headers.indexOf("timestamp");
    let dateRange = null;
    let resolution = null;
    if (tsIdx >= 0) {
      const firstTs = (lines[1].split(",")[tsIdx] || "").replace(/^"|"$/g, "").trim();
      const lastTs = (lines[lines.length - 1].split(",")[tsIdx] || "").replace(/^"|"$/g, "").trim();
      if (firstTs && lastTs) {
        dateRange = { start: firstTs.slice(0, 10), end: lastTs.slice(0, 10) };
      }
      if (lines.length >= 3 && firstTs) {
        const secondTs = (lines[2].split(",")[tsIdx] || "").replace(/^"|"$/g, "").trim();
        if (secondTs) {
          const gapMin = (new Date(secondTs) - new Date(firstTs)) / 60000;
          if (gapMin === 30) {
            resolution = { label: "30-minute (48 SPs/day)", valid: true };
          } else if (gapMin === 60) {
            resolution = { label: "Hourly (24 SPs/day)", valid: true };
          } else {
            resolution = { label: `Unsupported interval (${gapMin} min) — flexiq accepts 30-min or hourly only`, valid: false };
          }
        }
      }
    }
    return { rows, headers, dateRange, resolution };
  } catch {
    return { rows: null, headers: [], dateRange: null, resolution: null };
  }
}

export default function CsvConfigPage({ onRunStarted, jobError }) {
  const fileInputRef = useRef(null);

  const [file, setFile]           = useState(null);
  const [parsedMeta, setParsedMeta] = useState(null);
  const [dragOver, setDragOver]   = useState(false);

  const [dnoKey, setDnoKey]               = useState("");
  const [voltageLevel, setVoltageLevel]   = useState("LV");
  const [exportLimitMw, setExportLimitMw] = useState("");
  const [priceExposure, setPriceExposure] = useState("da");
  const [thermalGenToggle, setThermalGenToggle] = useState(false);
  const [thermalMcGbpMwh, setThermalMcGbpMwh] = useState("70");

  const [bessPreset, setBessPreset]     = useState("0");
  const [bessPower, setBessPower]       = useState("");
  const [bessCapacity, setBessCapacity] = useState("");
  const [bessRte, setBessRte]           = useState("90");
  const [bessMaxCycles, setBessMaxCycles] = useState("1.5");

  const [showAdvanced, setShowAdvanced]         = useState(false);
  const [advanced, setAdvanced]                 = useState({ ...DEFAULT_ADV });
  const [advancedDirty, setAdvancedDirty]       = useState(false);
  const [pendingDnoChange, setPendingDnoChange] = useState(null);
  const [dnoRatesLoading, setDnoRatesLoading]   = useState(false);
  const [ragWarning, setRagWarning]             = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [runError, setRunError]     = useState(null);

  // Derived
  const pw  = parseFloat(bessPower);
  const cap = parseFloat(bessCapacity);
  const durationH    = pw > 0 && cap > 0 ? cap / pw : null;
  const durationValid = durationH !== null && durationH >= 0.5 && durationH <= 6.0;
  const exportVal    = parseFloat(exportLimitMw);
  const exportValid  = exportLimitMw !== "" && !isNaN(exportVal) && exportVal > 0;
  const bessValid    = bessPower !== "" && bessCapacity !== "" && pw > 0 && cap > 0 && durationValid;
  const thermalGenWarning = thermalGenToggle && parsedMeta?.headers?.length > 0 && !parsedMeta.headers.includes("thermal_gen_mw");
  const resolutionError   = parsedMeta?.resolution?.valid === false;
  const canRun            = file != null && dnoKey !== "" && exportValid && bessValid && !submitting && !resolutionError;

  const fetchAndPopulateRates = useCallback(async (dno, voltage) => {
    if (!dno) return;
    const effectiveVoltage = voltage === "unknown" ? "LV" : voltage;
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
    } catch {
      // silently fail — user can manually enter rates in Advanced
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

  function handlePresetChange(idx) {
    setBessPreset(idx);
    const preset = BESS_PRESETS[parseInt(idx, 10)];
    if (preset.power !== null) {
      setBessPower(String(preset.power));
      setBessCapacity(String(preset.capacity));
    }
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
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dno_key", dnoKey);
      fd.append("voltage_level", voltageLevel === "unknown" ? "LV" : voltageLevel);
      fd.append("export_limit_mw", exportLimitMw);
      fd.append("bess_power_mw", bessPower);
      fd.append("bess_capacity_mwh", bessCapacity);
      fd.append("bess_rte_pct", bessRte || "90");
      fd.append("bess_max_cycles", bessMaxCycles || "1.5");
      fd.append("chp_toggle", String(thermalGenToggle));
      fd.append("price_exposure", priceExposure);
      fd.append("nec_gbp_mwh", advanced.necGbpMwh || "103.75");
      fd.append("chp_mc_gbp_mwh", thermalMcGbpMwh || "70");
      if (advanced.contractedKva) fd.append("contracted_kva", advanced.contractedKva);

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

      const { job_id } = await postRunCsv(fd);
      onRunStarted(job_id);
    } catch (e) {
      setRunError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080e1a" }}>

      {/* Hero */}
      <div style={{
        background: "#0f1928",
        backgroundImage: `
          linear-gradient(rgba(0,200,232,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,200,232,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "48px 48px",
        borderBottom: "1px solid #1e3352",
        padding: "2.5rem 1.5rem 2rem",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
            <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, color: "#e0eaf8", letterSpacing: "-0.025em" }}>
              flex<span style={{ color: "#00c8e8" }}>iq</span>
            </h1>
            <span style={{
              fontSize: "0.62rem", fontWeight: 700, color: "#00c8e8",
              background: "rgba(0,200,232,0.1)", border: "1px solid rgba(0,200,232,0.25)",
              borderRadius: 3, padding: "0.12rem 0.4rem", letterSpacing: "0.1em", textTransform: "uppercase",
            }}>BETA</span>
          </div>
          <p style={{ margin: "0 0 1rem", color: "#7ba0c8", fontSize: "0.9rem" }}>
            BTM BESS optimisation — site meter data upload
          </p>
          <p style={{
            margin: 0, color: "#4a6b8c", fontSize: "0.8rem",
            background: "rgba(0,200,232,0.05)", border: "1px solid rgba(0,200,232,0.12)",
            borderRadius: 5, padding: "0.45rem 0.85rem", display: "inline-block",
          }}>
            Upload your half-hourly meter data. flexiq will optimise dispatch against real market prices and your DNO tariff.
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "1.75rem 1rem" }}>

        {/* ── File Upload ─────────────────────────────── */}
        <Card label="Meter Data">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer?.files?.[0]; if (f) handleFileChange(f); }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: dragOver ? "1.5px dashed #00c8e8" : file ? "1.5px dashed rgba(0,200,232,0.4)" : "1.5px dashed #1e3352",
              borderRadius: 8,
              padding: "1.75rem 1.5rem",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "rgba(0,200,232,0.05)" : file ? "rgba(0,200,232,0.03)" : "#0f1928",
              transition: "all 0.15s",
            }}
          >
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
              style={{ display: "none" }} />
            {file ? (
              <div>
                <div style={{ fontSize: "1.1rem", marginBottom: "0.35rem" }}>📄</div>
                <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#e0eaf8" }}>{file.name}</div>
                <div style={{ fontSize: "0.75rem", color: "#4a6b8c", marginTop: "0.25rem" }}>
                  {(file.size / 1024).toFixed(0)} KB · click to replace
                </div>
                {parsedMeta && (
                  <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                    {parsedMeta.rows !== null && (
                      <Chip label="Settlement periods" value={parsedMeta.rows.toLocaleString()} />
                    )}
                    {parsedMeta.dateRange && (
                      <Chip label="Date range" value={`${parsedMeta.dateRange.start} → ${parsedMeta.dateRange.end}`} />
                    )}
                    {parsedMeta.resolution && (
                      <Chip
                        label="Resolution"
                        value={parsedMeta.resolution.label}
                        error={!parsedMeta.resolution.valid}
                      />
                    )}
                    {parsedMeta.headers.length > 0 && (
                      <Chip label="Columns" value={parsedMeta.headers.join(", ")} mono />
                    )}
                  </div>
                )}
                {thermalGenWarning && (
                  <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#f59e0b",
                    background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: 5, padding: "0.4rem 0.75rem", display: "inline-block" }}>
                    Thermal generation is enabled but <code style={{ color: "#f59e0b" }}>thermal_gen_mw</code> column not found in this CSV
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: "1.4rem", marginBottom: "0.5rem", color: "#4a6b8c" }}>↑</div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#7ba0c8" }}>
                  Drop CSV or XLSX here, or click to browse
                </div>
                <div style={{ fontSize: "0.75rem", color: "#4a6b8c", marginTop: "0.35rem" }}>
                  Required columns:{" "}
                  <code style={{ color: "#00c8e8" }}>timestamp</code>,{" "}
                  <code style={{ color: "#00c8e8" }}>net_demand_mw</code>
                  {" "}· Optional: <code style={{ color: "#00c8e8" }}>thermal_gen_mw</code>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* ── Site Configuration ──────────────────────── */}
        <Card label="Site Configuration">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

            {/* DNO */}
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Network operator (DNO)</FieldLabel>
              <select value={dnoKey} onChange={(e) => handleDnoChange(e.target.value)} style={selectStyle(dnoKey !== "")}>
                <option value="">— Select your DNO —</option>
                {DNO_OPTIONS.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              {dnoRatesLoading && (
                <div style={{ fontSize: "0.72rem", color: "#4a6b8c", marginTop: "0.3rem" }}>
                  Loading DNO rates…
                </div>
              )}
            </div>

            {/* Voltage */}
            <div>
              <FieldLabel>Connection voltage</FieldLabel>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {[{ value: "LV", label: "LV" }, { value: "HV", label: "HV" }, { value: "unknown", label: "Not sure" }].map(({ value, label }) => {
                  const active = voltageLevel === value;
                  return (
                    <button key={value} onClick={() => handleVoltageChange(value)} style={{
                      flex: 1, padding: "0.5rem",
                      border: active ? "1px solid #00c8e8" : "1px solid #1e3352",
                      borderRadius: 6,
                      background: active ? "rgba(0,200,232,0.1)" : "#0f1928",
                      color: active ? "#00c8e8" : "#4a6b8c",
                      cursor: "pointer", fontSize: "0.82rem", fontWeight: active ? 700 : 500, transition: "all 0.15s",
                    }}>{label}</button>
                  );
                })}
              </div>
              {voltageLevel === "unknown" && (
                <div style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: "#4a6b8c" }}>
                  Defaults to LV (conservative rates)
                </div>
              )}
            </div>

            {/* Export limit */}
            <div>
              <FieldLabel>Site export limit</FieldLabel>
              <SuffixInput
                type="number" min="0.01" step="0.25"
                placeholder="e.g. 1.0"
                value={exportLimitMw}
                onChange={(e) => setExportLimitMw(e.target.value)}
                suffix="MW"
              />
              {exportLimitMw !== "" && !exportValid && (
                <div style={{ fontSize: "0.72rem", color: "#ff5577", marginTop: "0.25rem" }}>
                  Must be greater than 0
                </div>
              )}
            </div>

            {/* Thermal generation toggle */}
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>On-site thermal generation? (CHP, genset, gas engine)</FieldLabel>
              <div style={{ display: "flex", gap: "0.5rem", maxWidth: 240 }}>
                {[{ value: false, label: "No" }, { value: true, label: "Yes" }].map(({ value, label }) => {
                  const active = thermalGenToggle === value;
                  return (
                    <button key={String(value)} onClick={() => setThermalGenToggle(value)} style={{
                      flex: 1, padding: "0.5rem",
                      border: active ? "1px solid #00c8e8" : "1px solid #1e3352",
                      borderRadius: 6,
                      background: active ? "rgba(0,200,232,0.1)" : "#0f1928",
                      color: active ? "#00c8e8" : "#4a6b8c",
                      cursor: "pointer", fontSize: "0.82rem", fontWeight: active ? 700 : 500, transition: "all 0.15s",
                    }}>{label}</button>
                  );
                })}
              </div>
              {thermalGenToggle && (
                <div style={{ marginTop: "0.75rem", maxWidth: 240 }}>
                  <FieldLabel>Thermal generation marginal cost</FieldLabel>
                  <SuffixInput
                    type="number" step="0.5" min="0"
                    value={thermalMcGbpMwh}
                    onChange={(e) => setThermalMcGbpMwh(e.target.value)}
                    suffix="£/MWh"
                  />
                </div>
              )}
            </div>

          </div>
        </Card>

        {/* ── BESS Configuration ──────────────────────── */}
        <Card label="BESS Configuration">

          {/* Shortcut preset dropdown */}
          <div style={{ marginBottom: "1rem" }}>
            <FieldLabel>Standard configuration shortcut</FieldLabel>
            <select
              value={bessPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              style={selectStyle(bessPreset !== "0")}
            >
              {BESS_PRESETS.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Free-form inputs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div>
              <FieldLabel>Power</FieldLabel>
              <SuffixInput
                type="number" min="0.01" step="0.5"
                placeholder="e.g. 1"
                value={bessPower}
                onChange={(e) => { setBessPower(e.target.value); setBessPreset("0"); }}
                suffix="MW"
              />
            </div>
            <div>
              <FieldLabel>Capacity</FieldLabel>
              <SuffixInput
                type="number" min="0.01" step="0.5"
                placeholder="e.g. 2"
                value={bessCapacity}
                onChange={(e) => { setBessCapacity(e.target.value); setBessPreset("0"); }}
                suffix="MWh"
              />
            </div>
            <div>
              <FieldLabel>Round-trip efficiency</FieldLabel>
              <SuffixInput
                type="number" min="50" max="100" step="1"
                value={bessRte}
                onChange={(e) => setBessRte(e.target.value)}
                suffix="%"
              />
            </div>
            <div>
              <FieldLabel>Max cycles / day</FieldLabel>
              <input
                type="number" min="0.5" max="4" step="0.5"
                value={bessMaxCycles}
                onChange={(e) => setBessMaxCycles(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Duration derived display */}
          {bessPower !== "" && bessCapacity !== "" && (
            <div style={{
              fontSize: "0.8rem",
              color: durationValid ? "#7ba0c8" : "#ff5577",
              padding: "0.5rem 0",
              borderTop: "1px solid #1e3352",
            }}>
              {durationH !== null ? (
                durationValid
                  ? <span>Duration: <strong style={{ color: "#00c8e8" }}>{durationH.toFixed(1)}h</strong> · {(cap).toFixed(1)} MWh</span>
                  : <span>Duration {durationH.toFixed(2)}h is outside the 0.5–6.0h range</span>
              ) : (
                <span>Enter valid power and capacity</span>
              )}
            </div>
          )}
        </Card>

        {/* ── Price Exposure ──────────────────────────── */}
        <Card label="Price Exposure">
          <div style={{ display: "flex", gap: "0.75rem" }}>
            {[
              { value: "da",        label: "Day-Ahead (DA)",     desc: "Settled against day-ahead market price" },
              { value: "imbalance", label: "Imbalance (System)", desc: "Settled against system imbalance price" },
            ].map(({ value, label, desc }) => {
              const active = priceExposure === value;
              return (
                <button key={value} onClick={() => setPriceExposure(value)} style={{
                  flex: 1, padding: "0.85rem 1rem",
                  border: active ? "1px solid #00c8e8" : "1px solid #1e3352",
                  borderRadius: 7,
                  background: active ? "rgba(0,200,232,0.08)" : "#0f1928",
                  cursor: "pointer", textAlign: "left",
                  boxShadow: active ? "0 0 16px rgba(0,200,232,0.1)" : "none",
                  transition: "all 0.15s",
                }}>
                  <div style={{ fontWeight: 700, fontSize: "0.875rem", color: active ? "#00c8e8" : "#7ba0c8", marginBottom: "0.25rem" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#4a6b8c" }}>{desc}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* ── Advanced ────────────────────────────────── */}
        <div style={{ marginBottom: "1rem" }}>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              background: "none",
              border: "1px solid #1e3352",
              borderRadius: 6,
              padding: "0.5rem 1rem",
              color: advancedDirty ? "#00c8e8" : "#4a6b8c",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 600,
              width: "100%",
              textAlign: "left",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>⚙ Advanced settings{advancedDirty ? " (edited)" : ""}</span>
            <span style={{ color: "#2a4772" }}>{showAdvanced ? "▲" : "▼"}</span>
          </button>

          {showAdvanced && (
            <div style={{
              marginTop: "0.5rem",
              background: "#152236",
              border: "1px solid #1e3352",
              borderRadius: 10,
              padding: "1.5rem",
            }}>

              {/* DNO reset prompt */}
              {pendingDnoChange && (
                <div style={{
                  marginBottom: "1.25rem",
                  padding: "0.85rem 1rem",
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  borderRadius: 7,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}>
                  <span style={{ fontSize: "0.82rem", color: "#f59e0b" }}>
                    DNO changed to <strong>{pendingDnoChange.dno}</strong>. Reset rates to new DNO defaults?
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={confirmDnoReset} style={{ ...smallBtn, borderColor: "#f59e0b", color: "#f59e0b", background: "rgba(245,158,11,0.1)" }}>
                      Yes, reset
                    </button>
                    <button onClick={keepCurrentRates} style={{ ...smallBtn, borderColor: "#1e3352", color: "#4a6b8c" }}>
                      Keep current
                    </button>
                  </div>
                </div>
              )}

              {ragWarning && (
                <div style={{ marginBottom: "1rem", fontSize: "0.75rem", color: "#f59e0b",
                  background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)",
                  borderRadius: 5, padding: "0.4rem 0.75rem" }}>
                  {ragWarning}
                </div>
              )}

              {/* Site assumptions */}
              <AdvancedSection label="Site Assumptions">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <FieldLabel>Non-energy charges</FieldLabel>
                    <SuffixInput type="number" step="0.01" min="0"
                      value={advanced.necGbpMwh}
                      onChange={(e) => updateAdv("necGbpMwh", e.target.value)}
                      suffix="£/MWh" />
                    <div style={{ fontSize: "0.7rem", color: "#2a4772", marginTop: "0.2rem" }}>EII-exempt sites: 43.75</div>
                  </div>
                  <div>
                    <FieldLabel>Contracted capacity</FieldLabel>
                    <SuffixInput type="number" step="1" min="0"
                      placeholder="Auto from CSV peak"
                      value={advanced.contractedKva}
                      onChange={(e) => updateAdv("contractedKva", e.target.value)}
                      suffix="kVA" />
                  </div>
                </div>
              </AdvancedSection>

              {/* DUoS rates */}
              <AdvancedSection label="DUoS Import Rates">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                  {[["Red", "duosRed"], ["Amber", "duosAmber"], ["Green", "duosGreen"]].map(([band, key]) => (
                    <div key={key}>
                      <FieldLabel>{band}</FieldLabel>
                      <SuffixInput type="number" step="0.01" min="0"
                        value={advanced[key]}
                        onChange={(e) => updateAdv(key, e.target.value)}
                        suffix="£/MWh" />
                    </div>
                  ))}
                </div>
              </AdvancedSection>

              {/* GDUoS credits */}
              <AdvancedSection label="GDUoS Export Credits (enter as positive)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                  {[["Red", "gduosRed"], ["Amber", "gduosAmber"], ["Green", "gduosGreen"]].map(([band, key]) => (
                    <div key={key}>
                      <FieldLabel>{band}</FieldLabel>
                      <SuffixInput type="number" step="0.01" min="0"
                        value={advanced[key]}
                        onChange={(e) => updateAdv(key, e.target.value)}
                        suffix="£/MWh" />
                    </div>
                  ))}
                </div>
              </AdvancedSection>

              {/* Standing charges */}
              <AdvancedSection label="Standing Charges">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <FieldLabel>DUoS fixed</FieldLabel>
                    <SuffixInput type="number" step="0.01" min="0"
                      value={advanced.fixedGbpPerDay}
                      onChange={(e) => updateAdv("fixedGbpPerDay", e.target.value)}
                      suffix="£/day" />
                  </div>
                  <div>
                    <FieldLabel>DUoS capacity</FieldLabel>
                    <SuffixInput type="number" step="0.0001" min="0"
                      value={advanced.capacityRate}
                      onChange={(e) => updateAdv("capacityRate", e.target.value)}
                      suffix="£/kVA/day" />
                  </div>
                  <div>
                    <FieldLabel>GDUoS fixed credit</FieldLabel>
                    <SuffixInput type="number" step="0.01" min="0"
                      value={advanced.gduosFixed}
                      onChange={(e) => updateAdv("gduosFixed", e.target.value)}
                      suffix="£/day" />
                  </div>
                </div>
              </AdvancedSection>

              {/* RAG band time windows */}
              <AdvancedSection label="DUoS Time Band Windows (HH:MM)">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>

                  <div>
                    <FieldLabel style={{ color: "#ef4444" }}>Red band (weekday)</FieldLabel>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <TimeInput value={advanced.ragRedStart} onChange={(v) => updateAdv("ragRedStart", v)} />
                      <span style={{ color: "#2a4772", fontSize: "0.75rem" }}>to</span>
                      <TimeInput value={advanced.ragRedEnd} onChange={(v) => updateAdv("ragRedEnd", v)} />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Amber band — morning (weekday)</FieldLabel>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <TimeInput value={advanced.ragAmberMorningStart} onChange={(v) => updateAdv("ragAmberMorningStart", v)} />
                      <span style={{ color: "#2a4772", fontSize: "0.75rem" }}>to</span>
                      <TimeInput value={advanced.ragAmberMorningEnd} onChange={(v) => updateAdv("ragAmberMorningEnd", v)} />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Amber band — evening (weekday)</FieldLabel>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <TimeInput value={advanced.ragAmberEveningStart} onChange={(v) => updateAdv("ragAmberEveningStart", v)} />
                      <span style={{ color: "#2a4772", fontSize: "0.75rem" }}>to</span>
                      <TimeInput value={advanced.ragAmberEveningEnd} onChange={(v) => updateAdv("ragAmberEveningEnd", v)} />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Amber band — weekend (optional)</FieldLabel>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <TimeInput
                        value={advanced.ragWeekendAmberStart}
                        onChange={(v) => updateAdv("ragWeekendAmberStart", v)}
                        placeholder="—"
                      />
                      <span style={{ color: "#2a4772", fontSize: "0.75rem" }}>to</span>
                      <TimeInput
                        value={advanced.ragWeekendAmberEnd}
                        onChange={(v) => updateAdv("ragWeekendAmberEnd", v)}
                        placeholder="—"
                      />
                    </div>
                  </div>

                </div>
              </AdvancedSection>

            </div>
          )}
        </div>

        {/* ── Errors ──────────────────────────────────── */}
        {jobError && (
          <div style={errorBox}>Run failed: {jobError}</div>
        )}
        {runError && (
          <div style={errorBox}>{runError}</div>
        )}

        {/* ── Run button ──────────────────────────────── */}
        <button
          onClick={handleRun}
          disabled={!canRun}
          style={{
            width: "100%",
            padding: "0.9rem",
            border: canRun ? "1px solid #00c8e8" : "1px solid #1e3352",
            borderRadius: 8,
            background: canRun
              ? "linear-gradient(135deg, rgba(0,200,232,0.15), rgba(0,200,232,0.08))"
              : "#0f1928",
            color: canRun ? "#00c8e8" : "#2a4772",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: canRun ? "pointer" : "not-allowed",
            letterSpacing: "0.03em",
            boxShadow: canRun ? "0 0 24px rgba(0,200,232,0.12)" : "none",
            transition: "all 0.15s",
          }}
        >
          {submitting ? "Submitting…" : "Run Optimisation"}
        </button>

        {!canRun && !submitting && (
          <div style={{ marginTop: "0.6rem", fontSize: "0.75rem", color: "#2a4772", textAlign: "center" }}>
            {!file && "Upload a CSV or XLSX · "}
            {resolutionError && <span style={{ color: "#ff5577" }}>{parsedMeta.resolution.label} · </span>}
            {!dnoKey && "Select a DNO · "}
            {dnoKey && !exportValid && "Enter export limit (> 0) · "}
            {!bessValid && (
              bessPower === "" || bessCapacity === ""
                ? "Enter BESS power and capacity"
                : !durationValid
                  ? `BESS duration ${durationH?.toFixed(2)}h outside 0.5–6.0h range`
                  : ""
            )}
          </div>
        )}

      </div>
    </div>
  );
}


// ─── Sub-components ──────────────────────────────────────────────────────────

function Card({ label, children }) {
  return (
    <div style={{
      background: "#152236",
      border: "1px solid #1e3352",
      borderRadius: 10,
      padding: "1.5rem",
      marginBottom: "1rem",
    }}>
      <div style={{
        fontSize: "0.68rem", fontWeight: 700, color: "#4a6b8c",
        textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.1rem",
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function AdvancedSection({ label, children }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#2a4772", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#4a6b8c", marginBottom: "0.35rem" }}>
      {children}
    </div>
  );
}

function SuffixInput({ suffix, ...props }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        {...props}
        style={{
          ...inputStyle,
          paddingRight: suffix.length > 4 ? "5.5rem" : "3.5rem",
        }}
      />
      <span style={{
        position: "absolute",
        right: "0.65rem",
        fontSize: "0.72rem",
        color: "#2a4772",
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}>
        {suffix}
      </span>
    </div>
  );
}

function TimeInput({ value, onChange, placeholder = "HH:MM" }) {
  return (
    <input
      type="text"
      pattern="[0-2][0-9]:[0-5][0-9]"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, width: 72, textAlign: "center", padding: "0.45rem 0.5rem" }}
    />
  );
}

function Chip({ label, value, mono, error }) {
  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ fontSize: "0.65rem", color: "#2a4772", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.15rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "0.75rem", color: error ? "#ff5577" : "#7ba0c8", fontFamily: mono ? "monospace" : undefined }}>
        {value}
      </div>
    </div>
  );
}

function selectStyle(hasValue) {
  return {
    width: "100%",
    padding: "0.55rem 0.75rem",
    background: "#0f1928",
    border: hasValue ? "1px solid rgba(0,200,232,0.3)" : "1px solid #1e3352",
    borderRadius: 6,
    color: hasValue ? "#e0eaf8" : "#4a6b8c",
    fontSize: "0.875rem",
    cursor: "pointer",
    outline: "none",
  };
}

const inputStyle = {
  width: "100%",
  padding: "0.55rem 0.75rem",
  background: "#0f1928",
  border: "1px solid #1e3352",
  borderRadius: 6,
  color: "#e0eaf8",
  fontSize: "0.875rem",
  outline: "none",
  boxSizing: "border-box",
};

const errorBox = {
  marginBottom: "1rem",
  padding: "0.75rem 1rem",
  background: "rgba(255,85,119,0.08)",
  border: "1px solid rgba(255,85,119,0.3)",
  borderRadius: 6,
  color: "#ff5577",
  fontSize: "0.875rem",
};

const smallBtn = {
  padding: "0.3rem 0.75rem",
  fontSize: "0.78rem",
  fontWeight: 600,
  border: "1px solid",
  borderRadius: 5,
  cursor: "pointer",
  background: "none",
};
