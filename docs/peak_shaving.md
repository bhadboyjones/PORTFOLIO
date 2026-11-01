# Peak shaving and MIC optimisation

*Started 2026-10-25. Built in four slices; this doc grows with each one. Design
and regulatory sources: [roadmap.md §1](roadmap.md). Line numbers are as of the
slice 1 commit, so check them against the code before relying on them.*

| Slice | What | Status |
|---|---|---|
| 1 | Explicit MIC + power factor inputs; import cap = MIC × PF; no simultaneous charge/discharge | **Built 2026-10-25** |
| 2 | Breach variable, monthly worst-breach carry across chunks, excess-capacity settlement | **Built 2026-11-01** |
| 3 | MIC sweep | **Built 2026-11-01** |
| 4 | Results UI: value by MIC, breach table, headroom note, add to investment case | **Built 2026-11-01** |

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

## 4. Fixed: negative export rate blanked whole chunks

`opp[i]` had no upper bound and enters the objective as `−export_rate × opp`. When
`export_rate = price − gduos` went negative, that penalty became a reward, the solver
drove `opp` to infinity, HiGHS reported the problem unbounded, and `_solve_chunk`
filled the whole 3-day chunk with zeros.

Fixed 2026-11-01 with `opp ≤ min(ub_chr1, export_limit_mw)` in `src/optimiser.py`.
Numbers: [worked_examples.md §7](worked_examples.md). Test:
`test_negative_export_rate_does_not_blank_the_chunk`.

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

## 6. Slices 2 to 4 as built

**Breach pricing** (`_solve_chunk`, `src/optimiser.py`). Only on when the user enters
a MIC; an assumed MIC is the site's own peak, so it can't be breached.

```
demand − dis1 + chr2 ≤ MIC cap × (1 − margin) + month's paid breach + new breach
cost of new breach = excess rate × days in month × kW ÷ PF
```

`paid_mw` carries each month's breach from chunk to chunk, so a smaller peak later in
the month costs nothing. With pricing on, grid charging may cause a breach if that
pays, because `chr2` is no longer capped by headroom.

**Settlement** (`apply_excess_capacity`). Uses the real MIC, not the margin, and takes
the worst half-hour per calendar month, with and without the battery. Each month's
cost is booked on its last period so every total carries it.

**Sweep** (`src/mic_sweep.py`, `_sweep_mic`). Runs on the scenario with the highest
net benefit only. Candidates: natural peak minus 0, 25, 50, 75, 100% of the smaller of
battery kVA and 40% of peak. The 40% limit is a change from the agreed design, made
because a 2 MW battery on a 1,098 kVA peak gave 598 and 98 kVA.

```
value = capacity saved + change in dispatch value − change in excess paid
```

**Measured**, real year, NPG LV, 1 MW / 2 MWh, peak 1,098 kW, 3.82p excess, 5% margin:

| MIC (kVA) | Dispatch | Excess without | Excess with | Months over, with |
|---|---:|---:|---:|---:|
| 1,043 | £32,211 | £821 | £90 | 2 |
| 934 | £28,991 | £2,482 | £566 | 6 |
| 769 | £25,507 | £4,974 | £2,227 | 11 |

Excess at 1× is cheap against arbitrage, so the solver sometimes pays it. Solve time
for that year rose from about 4 s to 7 to 10 s per scenario on a Mac.

**Investment case.** The tickbox sends the capacity saving as a fixed benefit: no
dispatch efficiency cut and no capacity fade, because a lower MIC is a contract term.
It still escalates. Dispatch and excess changes stay with the backtest benefit.

**Report.** The XLSX gains "MIC sweep" and "Months over MIC" sheets when a MIC is entered.

**Known limits.**
- Chunks are 3 days, so the battery can't hold charge for a peak in the next chunk.
- kVA uses a fixed power factor; statements use metered reactive power.
- Capacity saved by a lower MIC starts in the investment case from year 1, though a
  real reduction starts the billing period after it's agreed.
- The MEC is not priced.

## 7. Original slice 2 design (agreed 2026-10-25)

- **Step 0 (research):** excess capacity rate and billing period per DNO from
  the 2026/27 LC14 statements. Checked 2026-11-01: Eastern Power Networks and all
  12 of 14 licence areas publish excess equal to capacity at LV and HV. This overrides
  the "2 to 3×" trade claims. SP Distribution and SP Manweb are unread.
  Ofgem's DCP161 decision removed the customer-contribution discount from excess
  charges and sets no multiple.
  Verify every one at the primary source. Eastern Power Networks 2026/27 v1.5,
  read 2026-11-01:
  - §2.37: the chargeable capacity is the MIC, for each billing period.
  - §2.41: excess is charged on MIC against actual capacity used, at the excess
    p/kVA/day rate, "for the full duration of the billing period in which the
    breach occurs".
  - §2.41 to §2.43: for each half-hour, `max(2 × √(AI² + max(RI, RE)²) − MIC, 0)`,
    with AI in kWh and RI, RE in kVArh. The highest value in the period applies.
    This uses metered reactive power, so flexiq's fixed power factor is an
    approximation.
  - §2.38 and §2.39: one MIC reduction per 12 months, from the next billing period.
    The old capacity may not come back without reinforcement charges.
  - No statement read defines the billing period. UKPN, NGED, NPG and ENWL say "the
    full duration of the billing period"; SSEN says "the full month". flexiq uses
    calendar months. No statement gives a kW to kVA rule for a MIC.
  - Annex 1 prices LV Site Specific capacity and excess capacity both at 8.04p/kVA/day
    (1×); HV both at 5.31p. The excess rate is a published figure, so step 0 stores it
    per tariff rather than as a multiple.
  - The same section charges exceeded export capacity against the MEC, so the
    export limit needs the same treatment.
  NGED says a reduction is free, starts the month after agreement, and can't be
  backdated ([NGED](https://connections.nationalgrid.co.uk/how-to-apply-for-a-reduction-in-capacity)).
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
