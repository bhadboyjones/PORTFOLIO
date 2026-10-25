# UI: the "ledger" redesign

*Built 2026-10-25 on branch `feat/ledger-ui`. Replaces the "Night Grid" dark
theme. Line references are to the files as committed; check them before
relying on them.*

## 1. Why

Two reviews and one piece of research agreed:

- **taste-skill** (`design-taste-frontend`, app-screen rules): navy ground,
  cyan on chrome, glowing KPI tiles, tracked uppercase labels, 8 gradients,
  emoji icons. Lint 12 FAIL before, 0 FAIL after.
- **Vercel Web Interface Guidelines**: inputs without labels, no `<h1>` on
  results, tabs without ARIA, `£-340,270` money format, no live regions.
- **Research on established tools** (HOMER Grid, Modo, Energy Toolbase,
  Gridcog, Levelise): every real product screen is light with colour on data
  only, leads with one figure against a named baseline, and shows assumptions
  and exclusions next to the results.

Style dealt by taste-skill: `achromatic-ledger`, seed 798273244. Face: a
blue-grey ledger ground (`#f2f4f7`) and one chart blue (`#1d5fbf`) on the main
data element. Signature element: the average-day chart over the DUoS bands.

## 2. Tokens and type

- `ui/src/index.css` holds the ledger tokens. The old Night Grid variable
  names (`--accent`, `--bg-card`, `--signal-a10`…) are kept as aliases that
  now resolve to neutral ledger values, so untouched inline styles render
  light. Delete an alias only after sweeping its uses.
- One typeface: Geist (400, 500, 700). Geist Mono is loaded for code only.
- `ui/src/components/chartTheme.js` is the fixed data palette:

| Stream | Colour | Where |
|---|---|---|
| Demand offset (dis1) | `#1d5fbf` | dispatch, daily value, average day |
| Export (dis2) | `#0f766e` | dispatch, daily value |
| Grid charging (charge2) | `#8a8a8a` | dispatch, daily value, average day |
| Surplus charging (charge1) | `#c4c4c4` | dispatch, daily value |
| Battery wear | `#141414` | daily value |
| DUoS red / amber / green | `#c4242a` / `#b7791f` / `#2e7d32` | day tape, average day |

- `ui/src/format.js` formats every figure on screen with `Intl.NumberFormat`.
  Negatives use a true minus before the currency: `−£340,270`. Missing values
  are an en dash.

## 3. Results page logic

Screen question: *does a battery pay on this site, and which size?*

### 3.1 Data flow

`ResultsPage` owns the investment assumptions form. `hooks/useInvestment.js`
posts every scenario to `POST /investment/evaluate` 350 ms after an edit and
indexes the response by `scenario_label|export_limit_mw`. The lead strip,
table, cashflow and size charts all read from that one index, so a figure
shown twice is one value.

`nDays` (for annualising) is `data_period.coverage_days` when the backend
sends it (CSV runs). Archetype runs don't send it, so it is derived from the
timeseries: rows × interval length ÷ 24. This also gives archetype runs an
investment case, which they lacked before.

Scenario sizes come from `power_mw`/`capacity_mwh`, else from the label:
`"1MW / 2MWh"` (CSV) or `"1MW_2h"` (archetype, capacity = MW × hours).
`sizeLabel()` turns either into `1 MW / 2 MWh`.

### 3.2 Best and selected

- **Best** = highest realistic NPV once priced; before that, highest backtest
  net benefit.
- **Selected** = the row you click in the table, else Best. Cashflow, bill,
  average day and backtest detail all follow Selected; the lead strip always
  shows Best.

### 3.3 What each figure is

| Figure | Source | Notes |
|---|---|---|
| Year-1 saving (lead) | `annual_benefit_yr1_gbp` | Realistic: backtest × dispatch efficiency, wear added back (capex covers the battery) |
| "of the £X/yr backtest" | `annual_benefit_ceiling_yr1_gbp` | Same, at 100% efficiency |
| NPV, IRR, payback, capex | investment endpoint | Unchanged maths, see [investment_case.md](investment_case.md) |
| Annual site bill | settlement fields × 365 / nDays | **Perfect-foresight backtest after wear.** Its saving is larger than the lead figure; the card says so |

Bill components (`components/results/BillChart.jsx`, `billRows()`):

```
imports  with = baseline_import − dis1_saving + charge2_cost
export   with = baseline_export + dis2_revenue − charge1_opp_cost
standing, fuel unchanged; wear = deg_cost (with battery only)
net      = site_cost_wo / site_cost_w   (identity holds: net_w = net_wo − net_settlement)
```

The average day (`TypicalDay.jsx`) averages discharge and charge by time of day
over every day in the data, weekends included, and reports the share of
discharge that falls in red-band slots.

### 3.4 Known limits

- **Two savings figures** (realistic lead vs backtest bill) are both labelled,
  but a reader can still conflate them. A later option: show the bill at the
  realistic efficiency.
- **Ties** (two scenarios with the same NPV) are not called out; the
  "Best NPV" pill goes on whichever sorts first.
- Offline (server asleep or restarted), cached results show but NPV/IRR wait
  for the server to recalculate.
- The average day mixes weekdays and weekends, so the red-band share is
  slightly diluted.

## 4. Why this result (`lib/explain.js`)

Four sentences computed from the figures, never generated text:

1. **Source:** share of discharge energy in red-band slots (`redBandShare`),
   or the export share of gross value when it is 20% or more.
2. **Pays or not:** year-1 repayment, capex ÷ (saving − opex), against the life;
   or "cannot pay" when the saving doesn't cover opex.
3. **What would change it:** exact breakeven. Opex is a share of capex, so
   ```
   A = Σ_{n=1..N} (1+e)^(n−1) / (1+r)^n        (opexAnnuity, as in build_cashflows)
   PV costs = capex × (1 + opex% × A);  PV savings = NPV + PV costs
   breakeven capex = PV savings / (1 + opex% × A);  saving multiplier = PV costs / PV savings
   ```
   Cross-checked: re-pricing at the breakeven capex in `api/investment.py`
   gives NPV 0.000000.
4. **What it rests on:** days of data and months, dispatch efficiency.

"This run" and the model scope fold into one collapsed "Inputs and model
scope" section beneath the investment inputs.

## 5. URLs, Back and refresh (`lib/route.js`, `lib/resultsCache.js`)

| Screen | URL |
|---|---|
| Landing | `#/` |
| Site meter data / archetype form | `#/upload`, `#/archetype` |
| Progress | `#/run/<jobId>` |
| Results | `#/results/<jobId>` |

- Each step is a history entry; finishing a run *replaces* the progress
  entry, so Back from results returns to the form.
- Config pages stay mounted once opened (hidden when not shown), so Back keeps
  the file and settings within a session.
- Results load from memory, then IndexedDB (newest 5 runs), then
  `GET /run/<id>`, else an "expired" screen. The server keeps the 20 newest
  jobs in memory and loses all of them on restart (`api/jobs.py`).
- A 404 while polling ends the progress screen with a plain message.

## 6. Tests

| Command | What | Count |
|---|---|---|
| `npm test` (Vitest 5) | Pure logic in `src/lib` and `format.js`: formatting, bill identity, average day, explanation and breakeven, CSV parse, routes, cache pruning | 54 |
| `npm run test:e2e` (Playwright 1.64, system Chrome) | Upload → run → answer → no em dashes → refresh → Back. Starts the API and a production build itself | 1 (about 20 s) |

A mutation check (one flipped sign in the import formula) fails 3 unit tests.

## 7. Upload echo

`CsvConfigPage` parses CSVs in the browser (`parseCsvMeta`) and shows "What
flexiq read": intervals, period, resolution, coverage days, missing intervals
(expected count from first to last timestamp minus unique timestamps), peak
import converted to kW in the selected unit, the chosen DNO and the columns.
XLSX files are parsed server-side, so the echo says so instead.

## 8. Accessibility changes (Vercel guidelines)

- Every input has a linked `<label>` (`htmlFor`/`id` via `useId`), button
  groups use `role="group"` + `aria-labelledby`, matrix and export inputs
  have `aria-label`s.
- One `<h1>` per screen; section titles are `<h2>`/`<h3>` in sentence case.
- ARIA tabs with arrow-key navigation (`components/Tabs.jsx`).
- Live regions on progress, the run blockers, the finding line and errors.
- Skip link, `theme-color`, `color-scheme: light`, `touch-action`.
- Investment help text is visible under each input, not in `title` tooltips.

## 9. Data check before a run (`api/routes/run_csv.py _data_check`, `ui/src/lib/csvMeta.js dataIssues`)

| Check | Rule | Action |
|---|---|---|
| Meter spike | one reading > 5 × the 99th percentile of |demand| | Block; "My data is correct" overrides (`confirm_data`) |
| Unit mistake | largest |reading| outside 5–50,000 kW | Block; same override |
| Export-only site | never imports and no MIC entered | Block until the MIC is entered (not overridable) |

The spike rule runs first because it names the more specific cause. The
browser runs the same rules on CSVs before upload; the server runs them
again for every file (XLSX is only read there). Failed runs carry an
`error_code` (`data_check`, `mic_required`) so the form shows the override.

Invalid investment assumptions (bounds from `api/schemas.py`) are flagged
per field; the figures dim with "Figures shown are for the last valid
inputs" and the explanation uses the assumptions the figures were priced with.

## 10. Apple pass (2026-10-25)

Principles from the `apple-design` skill (WWDC *Designing Fluid Interfaces*):

| Principle | Implementation |
|---|---|
| Respond on press | `.btn-*:active` scale 0.97 (0.99 on full-width buttons), cards and cells 0.98, rows a tone step; 100 ms in, 160 ms out on `cubic-bezier(0.23,1,0.32,1)` |
| Motion from the value on screen | `hooks/useRollingNumber.js`: lead figures roll to new values in 380 ms when an assumption changes; interruptible; never on load; instant under reduced motion. Measured: −£340,270 → −£243,224 → −£184,371 → −£168,680 |
| Materials | Translucent sticky top bar (blur 20 px, saturate 180%); its edge appears only once content scrolls under it; solid under `prefers-reduced-transparency` |
| System type | SF Pro on Apple devices (system font stack); display face and −0.015 to −0.02 em tracking on large type |
| Light and dark | Dark mode follows the system: neutral darks, lightness steps, colour still on data. Recharts' literal hex is remapped by attribute selectors; HTML legend swatches go through `swatch()` → CSS variables |
| Reduced motion | Keeps colour and opacity fades, drops travel and looping |

The grid-to-battery progress animation stays (fill now eased over 600 ms
between 3 s polls; the line stays blue under reduced motion). Investment
charts moved directly under the scenario table so a row click changes what
is right below it. Deliberately not done: sliding tab underline (keyboard
driven), entrance animations, chart draw-in.

## 11. Checks run (2026-10-25)

- taste-skill lint: 12 FAIL / 9 WARN → 0 FAIL / 4 WARN (clock zero-padding,
  Geist Mono declared for code).
- taste-skill inspector on landing: 5 WARN → 1 WARN (centred column).
- Full CSV run and archetype run in Chrome at 1440, 768 and 390 px.
- Backend tests: 55 passed (no backend changes).
