# Peak shaving and MIC optimisation

*Started 2026-10-25. Built in four slices; this doc grows with each one. Design
and regulatory sources: [roadmap.md §1](roadmap.md). Line numbers are as of the
slice 1 commit, so check them against the code before relying on them.*

| Slice | What | Status |
|---|---|---|
| 1 | Explicit MIC + power factor inputs; import cap = MIC × PF; no simultaneous charge/discharge | **Built 2026-10-25** |
| 2 | Breach variable, monthly worst-breach carry across chunks, excess-capacity settlement | Queued, needs step 0 rates |
| 3 | MIC sweep with pre-screen | Queued |
| 4 | Results UI: value-vs-MIC curve, breach table, headroom vs battery split | Queued |

---

## 1. The question the feature answers

How far can a site cut its agreed import capacity (MIC) with a battery, and
what is that worth a year?

Value per candidate MIC = capacity rate × (current MIC − candidate) × 365
− arbitrage given up − excess charges.

## 2. Where the MIC applies

At the boundary meter, and nowhere else. That meter sees the net flow:

```
meter import = site demand − battery discharge to site (dis1) + battery charge from grid (chr2)
```

Battery discharge is subtracted because it feeds load from inside the boundary.
Demand 1,100 kW with the battery discharging 150 kW: the meter sees 950 kW.

## 3. Slice 1: what was built

### 3.1 MIC is an explicit input

- UI: "Agreed import capacity (MIC)" now sits in Site Configuration
  (`ui/src/pages/CsvConfigPage.jsx:503`). It used to be buried in Advanced as
  "Contracted capacity".
- **Unit toggle: kVA / kW / MW.** Connection agreements state MIC either way.
  The schema keeps the MIC as written. `_resolve_mic()`
  (`api/routes/run_csv.py:71`) turns it into two separate numbers:

  | Entered | `import_cap_kw` (optimiser) | `billing_kva` (capacity charge) |
  |---|---|---|
  | kVA | MIC × PF | MIC |
  | kW | MIC, as written | MIC ÷ PF |
  | MW | MIC × 1000 | MIC × 1000 ÷ PF |
  | blank | peak import in the data | peak ÷ PF |

  A kW or MW MIC is already real power, so PF never touches the cap. PF only
  enters the kVA used for billing.

  Not verified: LC14 bills capacity in p/kVA/day, but how a DNO bills a MIC
  agreed in kW (with the site's PF or a fixed one) is unchecked. At PF 1.0 it
  doesn't matter. Check during step 0.
- Blank MIC: the cap is the site's own peak import and a warning goes to the
  results page, because an assumed MIC hides any headroom and peak-shaving value.
- The job's `data_period` carries `import_cap_kw`, `billing_kva`, `mic_source`
  (`user` / `assumed_peak`), `power_factor` and `mic_unit_entered`
  (`run_csv.py:357`).
- `billing_kva` sets the capacity standing charge:
  `capacity rate × kVA / SPs per day` (`src/csv_pipeline.py:476`). Entering a
  real MIC changes `total_standing_gbp`, which feeds the site cost but not
  `net_settlement_gbp` (standing charges are excluded as sunk).

### 3.2 Power factor

- Optimiser cap (`src/optimiser.py:216`): if `bess_params` has
  `import_cap_kw`, it is used as-is. Otherwise the cap is
  `contracted_kva × power_factor`, the path archetype mode still uses.
- Input range 0.5–1.0, validated in `api/schemas.py` and in the UI. Default 1.0,
  shown on screen as "Default 1.0 (kW = kVA)".
- Worked example: MIC 1,200 kVA at PF 0.9 → cap 1,080 kW. MIC 1,080 kW at any
  PF → cap 1,080 kW.

### 3.3 What the import cap does today, and what it doesn't

The cap bounds **battery grid charging only** (`src/optimiser.py:237-238`):

```python
import_headroom = max(import_cap_mw - demand_i, 0.0)
ub_chr2 = min(power_mw - ub_chr1, import_headroom)
```

| Demand | Cap 1,000 kW | Max grid charge (300 kW battery) | Result |
|---|---|---|---|
| 600 kW | headroom 400 | 300 | fine |
| 850 kW | headroom 150 | 150 | charging throttled, meter at 1,000 |
| 1,100 kW | headroom 0 | 0 | meter at 1,100. **Nothing makes the battery discharge** |

The battery can never *cause* a breach, but it is never told to *prevent* one.
Slice 2 closes this. The test `test_import_cap_is_mic_times_power_factor`
checks only grid-charging periods for exactly this reason.

### 3.4 No simultaneous charge and discharge

A binary `mode[i]` per period (`src/optimiser.py:264`), with two constraints
(`src/optimiser.py:299-300`):

```
charge(i)    ≤ power_mw × mode[i]          mode = 1 → may charge
discharge(i) ≤ power_mw × (1 − mode[i])    mode = 0 → may discharge
```

`power_mw` is the tightest valid big-M, because neither side can exceed it
anyway.

**Why:** the shared power limit `charge + discharge ≤ power_mw` alone lets the
LP do both at once. That's physically impossible, and it pays whenever both
legs earn: at a negative import price with a positive export rate, the battery
gets paid to import and paid to export in the same half-hour, and the round-trip
losses burn the difference. The test `test_no_simultaneous_charge_and_discharge`
builds that case (price −£50/MWh, GDUoS credit £100/MWh) and fails on the old
model.

**Cost (measured 2026-10-25, synthetic one-year HH run, 1 MW / 2 MWh, local Mac):**

| Model | Solve time | Net benefit |
|---|---|---|
| LP, no switch | 2.3 s | £86,663 |
| MILP, with switch | 5.2 s | £86,662 |

The £1 gap is HiGHS's default MIP optimality gap. A 12-scenario run takes about
35 s longer locally, and Render's free tier will be slower than that.

## 4. Known wrong (found while building slice 1, not fixed)

**Negative export rate makes a whole chunk unbounded, so it dispatches zero.**

- `opp[i]` has no upper bound (`src/optimiser.py:259`) and enters the objective
  as `−export_rate × opp` (`src/optimiser.py:344`).
- When `export_rate = price − gduos` goes negative (wholesale price below minus
  the GDUoS credit, which happens on negative-price days), that penalty becomes
  a reward and the solver drives `opp` to infinity.
- HiGHS returns "primal infeasible or unbounded", and `_solve_chunk` fills the
  **whole 3-day chunk with zeros**. The only trace is a log warning.
- Effect: benefit is understated (conservative) for every chunk containing such
  a period. The tests miss it because their prices are all positive.
- Found by: a synthetic year with 3% of periods at −£20/MWh. Every chunk
  failed, in the old model as well as the new one.
- Fix options are in [roadmap.md](roadmap.md) (smaller queued items).

## 5. Tests

| Test | File | Proves |
|---|---|---|
| `test_no_simultaneous_charge_and_discharge` | `tests/test_optimiser.py` | No period with both charge and discharge > 0 |
| `test_import_cap_is_mic_times_power_factor` | `tests/test_optimiser.py` | Grid charging keeps the meter ≤ 1.2 MW at PF 1.0 and ≤ 1.08 MW at PF 0.9 |
| `test_power_factor_defaults_to_one` | `tests/test_optimiser.py` | Omitting PF behaves as PF 1.0 |
| `test_explicit_import_cap_kw_overrides_kva_conversion` | `tests/test_optimiser.py` | An explicit kW cap is used as-is |
| `test_kva_mic_cap_is_kva_times_pf` | `tests/test_mic.py` | 1,200 kVA at PF 0.9 → cap 1,080 kW, billing 1,200 kVA |
| `test_kw_mic_used_as_cap_without_pf` | `tests/test_mic.py` | 1,080 kW → cap 1,080 kW, PF not applied |
| `test_mw_mic_converts_to_kw` | `tests/test_mic.py` | 1.5 MW → 1,500 kW |
| `test_blank_mic_falls_back_to_peak` | `tests/test_mic.py` | Blank → cap = peak, warning issued |
| `test_schema_keeps_mic_as_written` | `tests/test_mic.py` | The schema does no unit conversion |
| `test_schema_rejects_bad_inputs` | `tests/test_mic.py` | Bad unit, PF outside 0.5–1.0, or negative MIC → HTTP 422 |

The first two fail against the pre-slice-1 optimiser.

## 6. Next: slice 2 design (agreed 2026-10-25, not built)

- **Step 0 (research):** excess capacity rate and billing period per DNO from
  the 2026/27 LC14 statements. UKPN charges 1× the capacity rate; NGED guidance
  says 2–3× ([gb-network-charging notes](gb-network-charging/README.md)).
  Verify every one at the primary source.
- **Constraint:** `demand − dis1 + chr2 ≤ MIC × PF × (1 − margin) + breach`,
  with `breach ≥ 0`. Breach is chosen by the solver and priced at
  `excess rate × days in the month` on the month's new worst breach only.
- **Margin:** our planning buffer (default 5%), not a DNO allowance. It covers
  forecast misses, PF uncertainty and controller lag. Kept separate from demand
  growth.
- **Monthly carry:** `paid_kva` runs from chunk to chunk and resets on the 1st.
  Inside a chunk, only breach above `paid_kva` costs money.
- **Objective:** co-optimised. Arbitrage, DUoS savings and the breach penalty
  sit in one objective.
