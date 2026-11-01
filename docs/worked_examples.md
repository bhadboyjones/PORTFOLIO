# Worked examples: how the money works

Every figure here is derived step by step, for study. Rates are Northern
Powergrid (NPG) LV 2026/27 from `src/duos_rates.py`; non-energy is the app's
default. Prices of £70 and −£20 are examples, not market data, unless stated.

## 1. Rates and unit conversion

Published rates are p/kWh. Multiply by 10 for £/MWh (1 MWh = 1,000 kWh; £1 = 100p).

| Item | p/kWh | £/MWh |
|---|---|---:|
| DUoS green | 0.172 | 1.72 |
| DUoS red | 5.829 | 58.29 |
| GDUoS credit green | 0.153 | 1.53 |
| GDUoS credit red | 4.895 | 48.95 |
| Non-energy charges (default) | | 103.75 |

## 2. Import rate and export rate

```
import rate = price + DUoS + non-energy
export rate = price − gduos      (gduos is stored negative, so this adds the credit)
```

Code: `src/optimiser.py`, objective in `_solve_chunk` and rates in
`calculate_settlement`.

Price is in both, so it cancels in the gap between them:

```
gap = DUoS + non-energy − GDUoS credit
green: 1.72 + 103.75 − 1.53   = £103.94/MWh
red:   58.29 + 103.75 − 48.95 = £113.09/MWh
```

Price sets the level; charges set the gap. Avoiding an import is usually worth
over £100/MWh more than exporting, whatever the wholesale price.

## 3. Negative prices

The export rate goes negative only when price < −credit.

| Price | Credit | price − (gduos) | Export rate |
|---|---|---|---:|
| £50 | 1.53 (green) | 50 + 1.53 | +£51.53 |
| −£1 | 1.53 (green) | −1 + 1.53 | +£0.53 |
| −£20 | 1.53 (green) | −20 + 1.53 | −£18.47 |
| −£20 | 48.95 (red) | −20 + 48.95 | +£28.95 |

A behind-the-meter site is usually still charged to import at negative prices:

| Price | + DUoS | + Non-energy | Import rate |
|---|---|---|---:|
| £70 | 1.72 | 103.75 | £175.47/MWh |
| −£20 | 1.72 | 103.75 | £85.47/MWh |
| −£58.50 (lowest, Oct 2025 to Oct 2026) | 1.72 | 103.75 | £46.97/MWh |

Paid to import only below about −£105.47/MWh (−£45.47 for an energy-intensive
exempt site at £43.75 non-energy, assuming the same green DUoS).

## 4. The battery's four moves

| Move | Value per MWh |
|---|---|
| `dis1` discharge to the site | earns the import rate (avoided, not sold) |
| `dis2` discharge to the grid | earns the export rate |
| `chr2` charge from the grid | costs the import rate |
| `chr1` charge from surplus | costs the export rate, on the exportable part (`opp`) |

## 5. One round trip

Two different half-hours: charge in **green** at the charge price, discharge
later in **red** at an assumed £70.

**Efficiency.** 90% round trip splits as √0.9 = 0.9487 each way.

```
buy 1 MWh → stored 1 × 0.9487 = 0.9487 MWh → delivered 0.9487 × 0.9487 = 0.9 MWh
```

**Wear.** Charged on energy in and energy out (`deg_cost_gbp` in
`calculate_settlement`):

```
throughput = 1.0 in + 0.9 out = 1.9 MWh
wear = 1.9 × £8/MWh = £15.20
```

**Profit = saved − charged − wear**

| Trip | Value of 0.9 MWh | Charged (1 MWh) | Wear | Profit |
|---|---:|---:|---:|---:|
| A. Green £70 → serve site | 0.9 × 232.04 = £208.84 | 70 + 1.72 + 103.75 = £175.47 | £15.20 | **£18.17** |
| B. Green −£20 → serve site | 0.9 × 232.04 = £208.84 | −20 + 1.72 + 103.75 = £85.47 | £15.20 | **£108.17** |
| C. Green −£20 → export | 0.9 × 118.95 = £107.06 | £85.47 | £15.20 | **£6.39** |

- £232.04 = 70 + 58.29 + 103.75 (red import rate).
- £118.95 = 70 + 48.95 (red export rate).
- B − C = £101.78 = 0.9 × £113.09, the red gap on 0.9 MWh.

Negative-price days are the most valuable days, which is why the bug in §7 matters.

## 6. `opp`: charging from surplus

`opp` is the part of surplus charging that stopped a possible export.

Surplus 3 MW, export limit 1 MW:

1. Can't be exported anyway: 3 − 1 = 2 MW (curtailable, free to charge from).
2. Only charging beyond 2 MW stops an export.
3. Charging 2.5 MW gives `opp` = 0.5 MW.

Code: `opp >= chr1 − curtailable`, `opp >= 0`, in `_solve_chunk`.

## 7. Fixed bug: negative export rate

The objective subtracts `export rate × opp`. At −£18.47/MWh that becomes a reward
of £18.47 per MWh of `opp`, and `opp` has no upper limit, so the problem is
unbounded and the whole 3-day chunk dispatches zero.

Fix, 2026-11-01: `opp ≤ min(chr1 upper bound, export limit)`. The surplus limit is already inside the `chr1` bound.

Result, 2026-11-01, re-run on the fixed code: real Elexon prices 24 Oct 2025 to 23 Oct 2026,
demand repeated from `small_office_hh.csv`, NPG LV, 1 MW / 2 MWh, 0 MW export.

| | Before | Fixed |
|---|---:|---:|
| Net benefit (backtest) | £22,719 | £34,183 |
| Discharge | 383 MWh | 524 MWh |

276 half-hours had a negative export rate (368 had a negative price); 27 of 122
3-day blocks contained at least one. +50% is for this test case only. The bound is
exact except when an export limit is already curtailing surplus, where dispatch can
be slightly off; settlement still prices it exactly.

## 8. The site bill (planned feature)

Same run, fixed model, one year:

| Line | Without battery | With battery | Change |
|---|---:|---:|---:|
| Wholesale energy | £397,190 | £366,667 | −£30,523 |
| DUoS unit charges | £61,783 | £43,271 | −£18,512 |
| Non-energy charges | £417,039 | £423,040 | +£6,000 |
| Standing and capacity | £16,405 | £16,405 | £0 |
| **Bill total** | **£892,417** | **£849,383** | **−£43,035** |
| Battery wear (not on a real bill) | | £8,852 | |
| **Net saving** | | | **£34,183** |

Rows can differ by £1 from rounding. Reconciliation:

```
discharge saved 145,371 − charging 102,336 − wear 8,852 = 34,183
```

Non-energy rises because losses raise imports from 4,020 MWh to 4,077 MWh.

## 9. Reading real bills (published samples, 2020 and 2021)

Sample bills from British Gas and TotalEnergies (details masked by the suppliers),
plus an npower TNUoS guide. Used for line structure and for checking the sums;
rates are years old. Not for copying branding.

**British Gas sample, Sep 2020, 30 days**

| Line | Sum | £ |
|---|---|---:|
| Night | 183.40 kWh × 13.160p | 24.14 |
| Evening and weekend | 279.30 kWh × 18.140p | 50.67 |
| Winter weekday peak | 0.00 kWh × 18.140p | 0.00 |
| Winter off-peak and summer day | 460.60 kWh × 18.140p | 83.55 |
| Unit charge (after a rate change, 23 to 30 Sep) | 333.30 kWh × 31.700p | 105.66 |
| **Electricity charges** | | **264.02** |
| Capacity | 814 kVA-days × 0.000p | 0.00 |
| Capacity | 296 kVA-days × 2.490p | 7.37 |
| Standing | 22 days × 63.130p; 8 days × 79.870p | 13.89 + 6.39 |
| CCL | 923.30 kWh and 333.30 kWh × 0.811p | 7.48 + 2.70 |
| **Total exc VAT** | | **301.85** |
| VAT at 20% | | 60.37 |
| **Total inc VAT** | | **362.22** |

The "kVA/day" units are kVA-days: 814 ÷ 22 days = 37 kVA and 296 ÷ 8 days = 37 kVA,
so this site's capacity is 37 kVA, and the same 22 and 8 days as the standing lines.

**TotalEnergies sample, 1 to 29 Apr 2021**

| Line | Sum | £ |
|---|---|---:|
| Units | 13,731.20 kWh × 14.4796p | 1,988.22 |
| Standing | 29 days × 61.5035p | 17.84 |
| CCL | 13,731.20 kWh × 0.775p | 106.42 |
| Subtotal | | 2,112.48 |
| VAT at 20% | | 422.49 |
| **Total** | | **2,534.97** |

All lines recompute to within 1p, the usual supplier rounding. CCL of 0.775p/kWh is
the £7.75/MWh still in `src/config.py`, so that default looks stale.

**Contract type changes what a battery can earn.** Both samples bundle network
and policy costs into time-blocked unit rates. flexiq assumes full pass-through:
half-hourly wholesale price plus RAG-band DUoS. A site on a fixed bundled contract
saves only the difference between its own contract rates, so a pass-through
result would overstate its saving.

**TNUoS.** npower's guide charges it on Estimated Annual Peak Demand, reconciled
at Triads. Per `gb-network-charging/README.md`, the locational part is still
Triad-based, but about 98% of demand TNUoS is now a fixed residual by site band,
which a battery can't reduce: it belongs on the bill but doesn't change with dispatch.

**kVA-days.** Capacity is billed as kVA × days × p/kVA/day, in the same way energy
is kW × hours × p/kWh. Check on the British Gas sample: 37 kVA × 8 days = 296 kVA-days,
and 296 × 2.490p = 737p = £7.37. Cutting capacity to 30 kVA gives 240 kVA-days and
£5.98, a saving of £1.39 over those 8 days.

## 10. Tariff types (planned feature)

Two separate questions set the import rate: how energy is priced, and whether
network and policy charges are passed through or bundled.

Energy rate in one half-hour, for a day-ahead price of £70 and of −£20. The 105%,
£5 adder and £131.60 figures are examples.

| Type | Sum at £70 | £/MWh | Sum at −£20 | £/MWh |
|---|---|---:|---|---:|
| Day-ahead indexed | 70 | 70.00 | −20 | −20.00 |
| % of day-ahead (105%) | 70 × 1.05 | 73.50 | −20 × 1.05 | −21.00 |
| Day-ahead plus adder (£5) | 70 + 5 | 75.00 | −20 + 5 | −15.00 |
| Fixed block (night 13.160p) | | 131.60 | | 131.60 |

Why the second question matters, on the §5 trip (buy 1 MWh in green, deliver 0.9 MWh
in red, wear £15.20), using flat £100/MWh energy and 2026/27 NPG LV charges:

```
Flat energy, charges passed through:
red import   = 100 + 58.29 + 103.75 = £262.04/MWh; 0.9 × 262.04 = £235.84
green import = 100 + 1.72 + 103.75  = £205.47/MWh
profit = 235.84 − 205.47 − 15.20 = £15.17

Flat all-inclusive, 14.4796p (TotalEnergies sample) = £144.80/MWh every half-hour:
0.9 × 144.80 = £130.32
profit = 130.32 − 144.80 − 15.20 = −£29.68
```

Both sites are "flat", but only the first has a time signal to trade on. The second
loses money on every cycle, so its battery earns only from capacity or surplus.

Export structures found in desktop research, 2026-11-01 (example terms, £70 price):

| Structure | Sum | £/MWh | Source |
|---|---|---:|---|
| Fixed | agreed rate | 60.00 | [TotalEnergies](https://business.totalenergies.uk/understanding-ppas) |
| % of day-ahead (95%) | 70 × 0.95 | 66.50 | [TotalEnergies](https://business.totalenergies.uk/fixed-price-vs-day-ahead-indexed-ppas-uk-market) |
| Day-ahead less fee (£5) | 70 − 5 | 65.00 | TotalEnergies (fee size not stated) |
| System price | published half-hourly | varies | TotalEnergies |

SEG tariffs may be fixed or variable, and Ofgem's 2020 guidance says they must be
greater than zero at all times. Whether a grid-charged battery qualifies is not
verified. flexiq today uses `price − gduos` with no fee, and this can go negative.

## 11. Capacity and excess capacity

Illustration: NPG LV, 3.82p/kVA/day, MIC 1,000 kVA, January (31 days). The excess
rate is a figure the DNO publishes, so a breach always bills at that one rate and
nothing switches between multiples. All 14 areas publish excess at 1× capacity. Trade sources
quote 3×, which none of the 14 areas supports, so that line is a what-if.

```
capacity = 1,000 × 31 × 3.82p = £1,184.20 (paid whatever the site uses)
worst half-hour 1,100 kVA → excess 100 kVA
excess at 1× = 100 × 31 × 3.82p = £118.42
excess at 3× = 100 × 31 × 11.46p = £355.26
```

Only the worst half-hour of the billing period counts. Cutting the MIC to 800 kVA
saves 200 × 365 × 3.82p = £2,788.60 a year.
