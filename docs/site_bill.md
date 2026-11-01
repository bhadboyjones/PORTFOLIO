# Modelled site bill

*Built 2026-11-01. Code: `src/bill.py`, `ui/src/components/results/SiteBill.jsx`,
`billView` in `ui/src/lib/results.js`.*

The results page opens on the lead strip and this bill. "Show full analysis" reveals
everything else. Older cached runs and archetype runs have no bill and open as before.

## 1. How a line is built

Every line is quantity × rate = £, without and with the battery, over the data
period. The UI scales both by 365 ÷ days of data, the same backtest basis as the old
bill chart.

```
import without = net demand above zero (MWh)
import with    = import without − dis1 + chr2
export with    = exportable surplus − surplus the battery absorbed + dis2
```

A half-hourly price varies, so an energy line's rate is its average: cost ÷ kWh.

## 2. Sections

| Section | Lines |
|---|---|
| Energy | By DUoS band; by rate on a fixed tariff |
| Network charges | DUoS red, amber, green, fixed; capacity in kVA-days; excess; TNUoS residual |
| Policy and system | Levies, Capacity Market, BSUoS, CCL |
| Exports and on-site | Export energy, GDUoS credit, export fixed charge, fuel |

A bundled charge reads "Inside your rate" with no amount.

## 3. How it ties to the model

Tested in `tests/test_bill.py` on seven tariff cases:

```
bill without − TNUoS = baseline_net + standing
bill without − bill with − wear = net_settlement
saved − charging + excess avoided − wear = net saving
```

Worked sum, from `billView` tests: 1,000 kWh at £100 scaled by 2 reads
"2,000 kWh × 10.00p" and £200.

## 4. Sources and assumptions

- **TNUoS residual:** NESO 2026/27 band by voltage and MIC, £/site/day
  ([gb-network-charging](gb-network-charging/README.md)). It's new to site cost, so the
  bill total is higher than `site_cost_wo_bess_gbp`, but it's the same with and without
  the battery. With DUoS ticked as bundled it's treated as inside the rate too.
- **CCL:** 0.801p/kWh from 1 April 2026
  ([gov.uk](https://www.gov.uk/guidance/climate-change-levy-rates)). The non-energy
  default rose from £103.75 to £104.01/MWh, so older worked examples use £103.75.
- **Policy split:** the entered non-energy total is shared in the default proportions.
  Levies and Capacity Market figures are upper-bound placeholders, not billed rates.
- **VAT:** 20%, shown below the total. Lower rates for small use aren't modelled.

## 5. Known limits

- The bill uses the current MIC. Ticking a MIC cut doesn't change it.
- The bill shows the backtest; the lead strip applies dispatch efficiency.
- Losses are inside the wholesale and non-energy lines, not their own line.
- A TNUoS band step from a lower MIC isn't valued in the MIC sweep. At HV, 1,101 to
  1,100 kVA is worth £24,917 a year, so this is worth adding.
