# Tariff types

*Built 2026-11-01. Code: `src/tariff.py`, `TariffCard` in
`ui/src/pages/CsvConfigPage.jsx`, `ui/src/lib/tariff.js`. Worked sums:
[worked_examples.md §10](worked_examples.md).*

## 1. The rule

Network and policy charges always exist. The DNO invoices the supplier (Eastern
Power Networks statement §2.15). Each charge is either a separate line, which flexiq
adds, or already inside the rate the site entered, which flexiq must not add again.

A battery trades the import-rate spread the site actually sees. After losses and
wear, on a 90% battery with £8/MWh wear:

```
profit per 1 MWh bought = 0.9 × discharge rate − charge rate − £15.20
```

## 2. What the screen asks

| Group | Question | Effect |
|---|---|---|
| Energy | Day-ahead indexed | import energy = price |
| | Percentage of day-ahead | price × share |
| | Day-ahead plus a margin | price + adder |
| | Fixed time bands | rate by UK clock time, up to 3 bands, same every day |
| | Flat rate | one rate |
| Inside your rate | DUoS unit and fixed | `duos_gbp_mwh` and the fixed charge become 0 |
| | Capacity and excess | capacity charge becomes 0; no breach pricing, no MIC sweep |
| | Policy and system | `nec_gbp_mwh` becomes 0 |
| Export | Day-ahead, percentage, less a fee, fixed, system price | `export_forecast_gbp`, `export_actual_gbp` |
| | GDUoS credit reaches me | off sets `gduos_gbp_mwh` to 0 |

Blank tariff is the old behaviour: full pass-through. Export always uses the
wholesale price, even when import is flat. `apply_tariff` sets it first for that reason.

Indexed types follow the price signal chosen above the card, so labels read
"Day-ahead" or "Imbalance". The screen shows a 24-hour preview of fixed bands: the
strip and the hours for each rate come from `bandRuns` in `ui/src/lib/tariff.js`,
which applies the same rule as `_band_rates` in `src/tariff.py`.

Rates are entered in p/kWh and sent in £/MWh. Percentages apply to negative prices
too: 105% of −£20 is −£21.

## 3. Warnings

A run with one import rate all year says so, because the battery has nothing to trade.
It can still spend some opening charge inside the ±10% end-of-chunk tolerance; it never
buys energy back.

## 4. Known limits

- Time bands are the same on weekdays and weekends.
- Forecast and actual use the same fixed rates; only indexed types differ between them.
- SEG's above-zero floor is not modelled: use a fixed export rate.
- Who pays excess on a bundled contract depends on the contract. Ticking capacity
  assumes the supplier absorbs it.
- A battery can still earn from capacity on a flat rate, but only if capacity is a
  separate line.
- Standing fixed charges bundled with DUoS drop from the bill totals, so bill totals
  are lower than a real bill by whatever the entered rate doesn't include.
