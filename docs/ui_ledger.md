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
- **Navigation state** is not in the URL: Back leaves the app and a refresh
  loses results (Vercel guideline, not addressed).
- The average day mixes weekdays and weekends, so the red-band share is
  slightly diluted.

## 4. Upload echo

`CsvConfigPage` parses CSVs in the browser (`parseCsvMeta`) and shows "What
flexiq read": intervals, period, resolution, coverage days, missing intervals
(expected count from first to last timestamp minus unique timestamps), peak
import converted to kW in the selected unit, the chosen DNO and the columns.
XLSX files are parsed server-side, so the echo says so instead.

## 5. Accessibility changes (Vercel guidelines)

- Every input has a linked `<label>` (`htmlFor`/`id` via `useId`), button
  groups use `role="group"` + `aria-labelledby`, matrix and export inputs
  have `aria-label`s.
- One `<h1>` per screen; section titles are `<h2>`/`<h3>` in sentence case.
- ARIA tabs with arrow-key navigation (`components/Tabs.jsx`).
- Live regions on progress, the run blockers, the finding line and errors.
- Skip link, `theme-color`, `color-scheme: light`, `touch-action`.
- Investment help text is visible under each input, not in `title` tooltips.

## 6. Checks run (2026-10-25)

- taste-skill lint: 12 FAIL / 9 WARN → 0 FAIL / 4 WARN (clock zero-padding,
  Geist Mono declared for code).
- taste-skill inspector on landing: 5 WARN → 1 WARN (centred column).
- Full CSV run and archetype run in Chrome at 1440, 768 and 390 px.
- Backend tests: 55 passed (no backend changes).
