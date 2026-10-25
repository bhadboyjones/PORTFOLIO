# flexiq roadmap and build plan

*Written 2026-10-04 after a revision session. Each feature gets its own logic
doc (`docs/<feature>.md`) when it is built. Regulatory facts below were checked
against the sources listed at the end; re-check them before relying on them.*

---

## Done on 2026-10-04

| Fix | What changed | Doc |
|---|---|---|
| Upload units | `input_unit` (mw / kw / mwh / kwh) on upload; values converted to average MW once interval length is known. Half-hourly MWh uploads were previously halved. | [csv_ingestion.md](csv_ingestion.md) |
| Coverage denominator | Annualise by days actually covered (rows × interval), not calendar span. | [investment_case.md §5.1](investment_case.md) |
| Wear double count | Wear accrual added back in the investment cashflow; stays in the optimiser as a dispatch signal. | [investment_case.md §6](investment_case.md) |
| Investment case + foresight haircut | First commit of the investment layer (NPV, IRR, payback, BCR, range display). | [investment_case.md](investment_case.md) |

---

## Build order

| # | Feature | Size | Depends on |
|---|---|---|---|
| 1 | Peak shaving: MIC optimisation | M | — |
| 2 | Price-curve input (single + multi-year) and per-year tariff rates | M | — |
| 3 | Multi-year degradation and year-by-year optimisation | L | 1, 2 |
| 4 | Forecast engine and measured dispatch efficiency | M–L | — |
| 5 | DA trading: rolling horizon, position + imbalance, intraday | L | 4 |
| 6 | Capacity Market, ancillary services | L | 3 |

Peak shaving goes first: it is the most bankable behind-the-meter value, uses
data already in the app, and changes dispatch, which the degradation curves in
step 3 depend on.

### 1. Peak shaving: MIC optimisation

**Mechanism (verified, UKPN EPN LC14 2026 §2.37–2.42):**
- Capacity charge = p/kVA/day × agreed MIC, every day, used or not. Rate fixed
  for the charging year (1 April–31 March).
- Excess capacity charge applies only on a breach: the largest half-hourly
  `2 × √(AI² + max(RI,RE)²) − MIC` in the billing period, charged at the excess
  rate for the **whole** billing period.
- MIC reductions: none for 12 months after an agreement, at most once per 12
  months, from the next billing period, not backdated. Free to reduce; released
  capacity may go to others and re-increasing may cost (NGED).

**Design:**
- Outer loop: sweep candidate MICs (like the export-limit matrix).
- Inner: each candidate becomes a hard cap on net import in the MILP; the
  battery holds charge in reserve and discharges at peaks.
- A non-negative breach variable takes any excess, priced at the excess rate,
  so the model never goes infeasible and failures are reported (count, dates,
  £). Track the worst breach per billing month across 3-day chunks — further
  breaches up to that level cost nothing extra that month.
- Safety margin: `cap = MIC × (1 − margin)`.
- Value per candidate = rate × (old − new MIC) × 365 − arbitrage lost − excess.
- Separate MIC headroom (savings available with no battery: MIC above true
  peak) from the battery's own contribution (below the natural peak).
- Power factor input (kW = kVA × PF), or metered kVArh where available.
- Add excess capacity charging to settlement (baseline and with battery).
- Real-operation analogue for later: SOC reserve rule before peak windows.

### 2. Price-curve input

- Upload a price series (HH or hourly) instead of pulling Elexon MID. Lets users
  bring licensed data (N2EX, EPEX) or a forecaster's curve under their own licence.
- Multi-year: a series per year, or one shape year × annual price level.
- Same per-year treatment for DUoS and capacity rates (reset each April; Ofgem
  network charging reform due by 2029).

### 3. Multi-year degradation

- State of health per year = 1 − cycle fade (from throughput) − calendar fade.
- Re-run the optimiser at sampled health levels (100/90/80%), interpolate
  benefit vs health; each year's benefit uses that year's price curve (step 2).
- Augmentation as real capex when health crosses a threshold.
- Derive the dispatch wear cost from this model instead of a fixed £8/MWh.
- Compute cost: sample years and/or representative weeks; offer as a
  "detailed appraisal" toggle on Render's 512 MB tier.

### 4. Forecast engine

Ladder — climb only if the extra £ justifies it:
1. Naive: same half-hour last week.
2. Gradient-boosted trees on Elexon price history (lags, time of day, weekday,
   holidays), walk-forward validation (train on the past only).
3. PV forecast from weather/irradiance data + site generation history.

TimesFM as an optional benchmark. Evaluation: dispatch on forecast, settle on
actual, compare £ with perfect foresight → measured dispatch efficiency replaces
the assumed 85%. Evidence that accuracy ≠ profit: Lipiecki & Weron, Aug 2026.

Note: MID is unknown at D-1, so optimising on MID needs a price forecast. DA
auction prices are known by 10:00 GMT D-1 (N2EX), so a behind-the-meter
schedule on DA prices needs only the site forecast.

### 5. DA trading

- D-1 position chosen on forecasts; physical delivery on D; deviation settled
  at imbalance price. Intraday trades are new trades that adjust the position
  (Nord Pool GB half-hours open 00:00 D-1, close 15 min before delivery).
- Daily rolling horizon replaces 3-day chunks; look-ahead or terminal SOC value
  to stop the battery emptying every midnight.
- Real auction prices are licensed: N2EX DA price-only €3,300/yr (8 days
  history), redistribution from €5,500/yr. Keep MID as the free labelled proxy.
- Market access: VLPs can trade wholesale since P415 went live 7 Nov 2024.

---

## Smaller queued items

| Item | Notes |
|---|---|
| DNO rates refresh | `src/duos_rates.py` holds 2026-27. Final charges publish ~15 months ahead (EPN 2026/27 v1.0: 24 Dec 2024), so 2027/28 is likely already out — check. Refresh window is Dec–Jan, not April; fix the file comment. |
| Staleness banner | Warn on results when today is outside the loaded charge year. |
| 15-minute data | Resample to 30-minute in the pipeline (PV and some meter exports are 15-min). |
| Export saturation curve | See investment_case.md §9. Test on a PV/CHP site. |
| Reinforcement capex | Per-export-limit cost row; needs saturation curve first. |
| Seasonality | Precision/range display for short periods; charge-stack decomposition; wholesale-only index. |
| Archetype-mode investment card | Archetype runs need to emit a data period. |
| UI input tiering | Primary vs advanced investment inputs. |
| XLSX investment sheet | Needs `src/report.py` sign-off. |
| PV value reporting | Needs gross demand and PV as separate columns. |

---

## Data inventory for forecasting (found 2026-10-04)

| File | Contents | Use |
|---|---|---|
| `~/Documents/Solar generation since 2024.xlsx` | 15-min, 2 Sep 2024 – 31 Aug 2025: export meter, import meter, PV production | PV forecast training; needs 15→30 min resample and timestamp rounding |
| `~/Downloads/Import Export MWh*.xlsx` | HH MWh import/export, 1 Jan – 9 Oct 2025, named hospital and science-park sites with MPANs | Real-format test of the units fix. **Customer data — confirm you're permitted to use it; never publish it or put it in the repo.** |
| `~/Downloads/Import (Export) CT MWh (Half Hourly).xlsx` | Report exports with a filter header block | Needs a closer look |

---

## Sources

- [UKPN Eastern Power Networks LC14 statement, effective 1 April 2026](https://media.umbraco.io/ukpn-cms/fr2evo4j/eastern-power-networks-lc14-statement-2026-v1-5.pdf)
- [National Grid: reduction in capacity](https://connections.nationalgrid.co.uk/how-to-apply-for-a-reduction-in-capacity)
- [DCUSA Schedule 16 (CDCM)](https://www.dcusa.co.uk/dcusa-digital-document/DCUSA/DCUSA_Schedule_16/DCUSA_Schedule_16.htm)
- [Nord Pool GB product specifications](https://www.nordpoolgroup.com/4ab576/globalassets/download-center/rules-and-regulations/product-specifications-gb-market.pdf)
- [Nord Pool day-ahead market data](https://www.nordpoolgroup.com/en/services/power-market-data-services/day-ahead-market-data/)
- [Elexon P415](https://www.elexon.co.uk/bsc/mod-proposal/p415/)
- [Ofgem Forward Work Programme 2026–27](https://www.ofgem.gov.uk/sites/default/files/2026-03/Forward-Work-Programme-2026-to-2027.pdf)
- [Lipiecki & Weron, arXiv 2609.00089](https://arxiv.org/abs/2609.00089)
