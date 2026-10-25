# The Investment Case Layer

*Phase 1 of the flexiq roadmap. Reference for `api/investment.py`,
`api/routes/investment.py` and `ui/src/components/InvestmentCard.jsx`.*

*This document is deliberately technical. It states what the code does, where the
numbers come from, and — importantly — where the model is known to be wrong.
Claims here are cited to file:line and were verified against the code, not
recalled. If you change the engine, re-verify the citations.*

---

## 1. Why this layer exists

The dispatch optimiser answers "what does this battery earn per year?". An
investor asks "is that worth what it costs?". A BESS is a capex asset: money
leaves on day 0, benefits arrive over 10–20 years while the asset degrades.

- **NPV** — lifetime value in today's money, net of cost. Ranks competing projects.
- **IRR** — the discount rate where NPV = 0; the return the project itself throws
  off. Compared against a hurdle rate (cost of capital + risk premium), it decides
  go/no-go without arguing about the discount rate.
- **Payback** — years to repay capex. Crude (blind to everything after breakeven)
  but it measures *risk exposure time*. Payback inside the warranty period means
  the manufacturer underwrites your route to breakeven.

Revenue **stacking** (roadmap phases 2–5) matters to financiers for a specific
reason: diversified, partly-contracted revenue (Capacity Market, availability
payments) forms a floor that supports debt. A pure-merchant single-stream battery
is financed on equity at higher hurdle rates.

---

## 2. What this layer is NOT

**There is no multi-year optimisation.** The MILP runs only over the uploaded
data period. Year 7's cashflow is not the result of solving a dispatch problem
for a 7-year-old battery — it is year 1's number multiplied by
`(1−fade)⁶ × (1+escalation)⁶`. The optimiser is never re-run at reduced capacity.

The multi-year sequence in `build_cashflows()` is **projection arithmetic, not
optimisation**. This is the single most important limitation of the layer, and
closing it is a queued work item (§10).

---

## 3. The cashflow model

Per scenario (one power/capacity/export-limit combination):

```
Year 0:      CF₀ = −capex
Year n ≥ 1:  CFₙ = B₁·(1−f)^(n−1)·(1+e)^(n−1)  −  O₁·(1+e)^(n−1)
```

`B₁` = year-1 annual benefit, `O₁` = year-1 opex, `f` = fade rate,
`e` = escalation rate, `N` = lifetime. Then:

```
NPV(r)  = Σₙ CFₙ / (1+r)ⁿ                   (n = 0 … N)
IRR     = r where NPV(r) = 0
Payback = first year cumulative CF crosses 0 (interpolated within the year)
BCR     = (NPV + capex) / capex             (PV of benefits per £ of capex)
```

Benefit erodes with fade and grows with escalation; opex only escalates — a
degraded battery does not get cheaper to insure.

**All cashflows are nominal**, so the discount rate must be nominal too. Mixing a
real rate with escalated cashflows double-counts inflation. This is the classic
appraisal error and the model does nothing to stop you making it.

**IRR is solved by bisection**, not a closed form. This is safe here because our
cashflow profiles have exactly one sign change (outflow, then net inflows), which
makes the root unique and `NPV(r)` monotonically decreasing through it. `irr()`
returns `None` when no root exists in the bracket — i.e. when annual net cashflow
never turns positive and IRR is meaningless. Do not swap in a solver that assumes
a root exists.

---

## 4. Where the annual benefit comes from

### 4.1 The provenance chain

```
src/optimiser.py:680-686   net_settlement_gbp   (per settlement period)
  → api/routes/run_csv.py  _serialise_scenario  sums to net_benefit_gbp
  → ui InvestmentCard      passes as period_benefit_gbp
  → api/investment.py:33   annualise_benefit()  scales to a year
```

`net_settlement_gbp` ([src/optimiser.py:680-686](../src/optimiser.py)) is:

```
  dis1_saving_gbp        discharge offsetting site demand (avoids full import stack)
+ dis2_revenue_gbp       discharge exported to grid
− charge2_cost_gbp       grid import to charge
− charge1_opp_cost_gbp   foregone export from charging off on-site surplus
− deg_cost_gbp           degradation wear accrual
```

### 4.2 Standing charges are excluded, and that is correct

Standing charges (DUoS fixed, DUoS capacity, GDUoS fixed) are held **separate**
from `net_settlement_gbp` ([src/optimiser.py:569-580](../src/optimiser.py)). They
accrue every period regardless of what the battery does.

This is correct incremental-appraisal discipline: the investment case must see
only cashflows that *change* as a result of the investment. Including sunk costs
is a textbook appraisal error.

**But it hides a real revenue stream.** The DUoS capacity charge (£/kVA/day) is
treated as fixed, when in reality a battery that reliably shaves peak import can
justify renegotiating agreed capacity downward — a recurring saving. The model
cannot currently see this value at all. Queued (§10).

### 4.3 Perfect foresight is literal, not approximate

[src/csv_pipeline.py:499-500](../src/csv_pipeline.py) assigns
`forecast = actual` outright, with the same in
[src/data_builder.py:131-132](../src/data_builder.py). The optimiser decides
dispatch against exactly the prices it is later settled at.

So the "upper bound" caveat in the UI is structural, not a hedge. A real operator
forecasts and is wrong. **Everything downstream of this — NPV, IRR, payback —
inherits an optimistic bias.**

**The dispatch-efficiency haircut (IMPLEMENTED)** prices that bias explicitly.
`evaluate_scenario(..., dispatch_efficiency)` ([api/investment.py](../api/investment.py))
scales the annualised benefit by a fraction (UI default 85%) before building the
cashflows, and computes the 100%-foresight case alongside it in the same pass. The
endpoint returns both `npv_gbp` (realistic, after haircut) and `npv_ceiling_gbp`
(raw backtest), and the card shows them as a range: "£X realistic, up to £Y at
perfect foresight." The haircut touches **only the benefit** — capex and opex are
unchanged. At 100% the realistic case reproduces the raw backtest exactly, so the
default is opt-in conservatism, not a hidden adjustment. Typical real-operation
capture against a forecast is ~80–90%; the true figure is knowable only once
Phase 2 introduces a genuine forecast-vs-actual spread to measure it.

### 4.4 Foresight is chunked, which softens it slightly

`CHUNK_DAYS = 3` ([src/optimiser.py:83](../src/optimiser.py)) means the MILP
solves 3-day windows. State of charge carries between chunks
([src/optimiser.py:533](../src/optimiser.py)) but **price foresight does not** —
each window is solved blind to what follows.

So the model is not clairvoyant across the year; it is clairvoyant in 3-day
episodes. Still an upper bound, marginally less extreme than §4.3 alone suggests.

`chunk_group` ([src/csv_pipeline.py:509](../src/csv_pipeline.py)) additionally
resets SOC across gaps in the meter data, so state never carries across a hole as
if it were one continuous period.

### 4.5 `sp_duration_hrs` is a unit conversion, not a chunking detail

It is a **scalar per upload**, not vectorised — derived once from the *median*
timestamp gap ([src/csv_pipeline.py:162-173](../src/csv_pipeline.py)) and
restricted to 0.5 or 1.0; anything else raises. Median rather than mean means a
file with a hole still detects resolution correctly.

It is the MW→MWh bridge and appears in nearly every physical and financial
calculation: SOC balance ([optimiser.py:273-274](../src/optimiser.py)), the
objective function ([319-325](../src/optimiser.py)), settlement P&L
([663-676](../src/optimiser.py)), cycle counting ([301](../src/optimiser.py)),
the export energy cap ([440](../src/optimiser.py)), and standing charges via
`n_sps_per_day` ([csv_pipeline.py:441-443](../src/csv_pipeline.py)). Hourly data
also triggers a price resample to hourly means
([csv_pipeline.py:463-468](../src/csv_pipeline.py)) so the HH:30 price is not
silently dropped by the join.

If this were wrong you would not get a chunking bug — you would get a battery
with double its true effective capacity and every pound figure off by 2×.

**Naming caveat:** a GB settlement period is *always* 30 minutes (fixed by the
BSC). When `sp_duration_hrs = 1.0` the code models hourly intervals and calls
them SPs. Harmless for tariff work (coarser band assignment, already disclosed in
the results UI). **Not harmless for roadmap Phase 5** — imbalance and Balancing
Mechanism settlement are half-hourly by definition, so hourly uploads will need
an explicit averaging assumption or a block on those revenue streams.

---

## 5. Annualisation and its two known defects

```python
B₁ = period_benefit_gbp × 365 / n_days        # api/investment.py:33
```

### 5.1 The denominator was calendar span, not data coverage — FIXED 2026-10-04

`n_days` is computed at
[api/routes/run_csv.py:207](../api/routes/run_csv.py) as
`(data_end − data_start).days + 1` — the calendar span between first and last
timestamp.

That equals actual data coverage **only if the CSV is contiguous**, and the
pipeline explicitly anticipates that it may not be (`chunk_group` exists precisely
to handle gaps).

A CSV covering January and March but missing February has a 91-day span and 62
days of actual dispatch. We divide by 91 when we should divide by 62 —
**understating annual benefit by ~32%**. Conservative in direction, still wrong,
and it silently penalises exactly the messy meter exports a consultant is handed.

**Fixed 2026-10-04:** `api/routes/run_csv.py` now emits `data_period.coverage_days`
= rows × `sp_duration_hrs` / 24, and the investment card annualises by it (falling
back to `n_days` for older payloads). `n_days` is a float in the request schema so
partial-day coverage is not truncated. Original note: derive coverage from row count —
`len(df) × sp_duration_hrs / 24`. Verified safe: the price join at
[csv_pipeline.py:471](../src/csv_pipeline.py) is a left join, NaNs are filled
rather than dropped, and no reindexing follows, so row count is preserved from
the validated meter data. Keep the calendar span for the "Results cover …"
display; only the *divisor* should change.

### 5.2 Seasonality

Linear scaling assumes the data period is seasonally representative. It is not:
winter demand shape, red-band exposure and price spreads all differ. The endpoint
warns below 300 days
([api/routes/investment.py:22](../api/routes/investment.py)).

Deliberate decision: **warn, do not block.** Most clients only have partial data,
and blocking means the feature goes unused on the sites that need it most.

The presentational failure is separate and real: showing `−£391,076` from 60 days
of winter data is falsely precise. Precision should degrade with the period.

### 5.3 A seasonality index is available but is NOT a drop-in fix

[src/prices.py](../src/prices.py) already pulls 12 months of system and market
index prices, so a price-spread index (full-year mean spread ÷ data-period mean
spread) is computable. **Do not apply it to total benefit.** Doing so would be
worse than naive scaling on many sites, in a way that looks more sophisticated
than it is.

The reason: for a BTM tariff-arbitrage battery the value is driven by the **DUoS
red-to-green differential** plus avoided non-energy charges (£103.75/MWh default),
not primarily by wholesale spread. Those rates are set by tariff and are **flat
year-round — zero rate seasonality.** A wholesale-spread index would correct the
minority component and mis-scale the majority one.

What *is* seasonal in the DUoS component is how much site demand sits in the red
band to be shaved — which is exactly what cannot be observed outside the data
period.

**Prerequisite** (the larger half of the job): benefit must first be decomposed
**by charge component** — wholesale vs DUoS vs non-energy charges. That does not
currently exist. `import_rate_gbp` is a composite, and settlement breaks value
down by *dispatch route* (`dis1`/`dis2`/`charge2`), not by *charge stack*. Only
then can the index be applied to the wholesale slice alone, leaving the rest on
naive scaling — and even then the demand-shape unknown remains.

Any adjustment that ships must be **visible and labelled**, never silent.

**Cheaper honest win, available today with no new maths:** degrade displayed
precision with the period length and show a range rather than a point. "Roughly
−£390k, indicative, scaled from 60 winter days" is defensible; "−£391,076" from
the same data is not.

---

## 6. Degradation: three distinct channels

Easy to double-count. They are not the same thing.

1. **Wear accrual** — `deg_cost_gbp_mwh` (default £8/MWh throughput), a marginal
   price on cell life that stops the dispatcher cycling for spreads smaller than
   the wear they consume. **Already subtracted inside `net_settlement_gbp`**
   ([optimiser.py:685](../src/optimiser.py)), so the investment layer receives it
   net.
2. **Capacity fade** — physical shrinkage of the machine, eroding *future revenue
   capability*. Applied here as a benefit multiplier.
3. **Augmentation capex** — spending to restore lost capacity. **Not modelled.**

~~(1) + (2) is the standard, conservative pairing.~~ **Corrected 2026-10-04:
keeping (1) in the investment cashflow double-counts capex.** The wear accrual
is a non-cash charge for consuming the battery's life, and the battery's whole
cost already sits in year 0 as capex. A DCF must not charge for the asset twice.
The right split is:

- **Dispatch objective: keep a wear cost** as a shadow price, so the MILP will
  not cycle for spreads that barely clear round-trip losses. Derive its value
  from the degradation model rather than a fixed £8/MWh.
- **Investment cashflow: add the wear accrual back** to `net_benefit_gbp`. Let
  capex (year 0), fade (lost future revenue) and, if modelled, augmentation capex
  (a real cash cost in the year it happens) carry the economics of degradation.

**Fixed 2026-10-04:** each scenario now sends `period_wear_cost_gbp`
(`deg_cost_gbp` from the run) and `evaluate_scenario` adds it back before
annualising and before the dispatch-efficiency haircut:
`ceiling = annualise(net_benefit + wear)`, `realistic = ceiling × efficiency`.
On the 60-day test site (0.5 MW / 1 MWh) wear was £616.62 against £915.08 net
benefit, so the add-back lifted annual benefit from £5,567 to £9,318 (+67%).
The optimiser still uses the wear cost as a dispatch signal; its value should
later come from the degradation model instead of a fixed £8/MWh.

### 6.1 On whether linear fade scaling is conservative

An earlier version of this document claimed linear scaling is conservative
"since dispatch concentrates in the highest-value hours." **That was overstated.**
The accurate position:

- **Spread-driven arbitrage** — the MWh given up as capacity fades are the least
  profitable ones, so value falls by *less* than capacity. Linear scaling
  overstates the loss: genuinely conservative.
- **Red-band peak shaving** — the whole discharge sits at roughly the same high
  value, so losing 20% of capacity loses close to 20% of value. Linear scaling is
  roughly accurate, not conservative.

Real sites are a blend, so treat linear fade as a reasonable first approximation
with unknown sign of error, not a safety margin. The fix is §2's multi-year
re-optimisation: re-run the optimiser at sampled capacity points (100/85/70%) and
interpolate the real benefit-versus-capacity curve.

---

## 7. Sensitivity: where the answer actually comes from

Over 15 years at 8%, on the worked example:

| Parameter | NPV impact | Notes |
|---|---|---|
| **Capex £/kWh** | **±£100k** on a ±20% swing | Dominant. £500k of the £650k capex. |
| Discount rate | ~±£32k over 6–10% | Annuity factor 9.71 → 7.61 |
| Fade | ~£55k (2.5%/yr vs 0) | Comparable to discount rate |
| Escalation | ~£50k (2%/yr vs 0) | Comparable, opposite sign |

Two consequences. Capex per kWh dominates everything, so effort spent on real
quotes beats effort spent on any other input. And **fade and escalation partly
cancel** — 2.5% fade against 2% escalation is a net drift of about −0.5%/yr — so
getting both roughly right matters far more than getting either precisely right.

This ordering drives the UI tiering (§10, item 3).

---

## 8. The inputs

**Defaults are editable placeholder assumptions, not market data.**

| Input | Default | Why it exists |
|---|---|---|
| Capex £/kW | 150 | PCS/inverter, switchgear, connection — scales with **MW** |
| Capex £/kWh | 250 | Cells, racks, enclosure — scales with **MWh**; dominant share, and why duration is expensive |
| Capex fixed £ | 0 | Site works, design, PM — size-independent; makes small systems look appropriately worse |
| Opex %/capex/yr | 1.5 | O&M, insurance, monitoring. As % so it scales across the matrix |
| Lifetime yrs | 15 | Warranty typically 10y; 20y usually needs augmentation |
| Discount %/yr | 8 | Nominal WACC / hurdle. C&I BTM typically 6–12% depending on who carries risk |
| Fade %/yr | 2.5 | See §6 |
| Escalation %/yr | 2 | Applies to benefit and opex. Set 0 for real terms (then use a real discount rate) |

**Known limitation:** capex rates are **global across the scenario matrix**. A
0.5 MW system genuinely costs more per kW than a 5 MW one, so a single rate
systematically flatters larger configurations. Kept global deliberately — a
credible economies-of-scale curve needs real quote data, and inventing one would
add false precision rather than accuracy.

---

## 9. Export limit economics

Currently the export limit is **free** in the model, so benefit is monotonically
non-decreasing in it and the export axis of the scenario matrix can never produce
a trade-off. The biggest limit always wins or ties.

### 9.1 The true shape of the benefit curve

The value of the E-th MW of export capacity is the sum of value across every
period where potential export *exceeds* E. As E rises, fewer periods qualify.
Once E exceeds the maximum potential export the site ever has, the marginal value
is **exactly zero** — not asymptotically small.

So the curve is **concave then hard-flat**, and its shape below saturation is
entirely a property of the site profile:

- **PV** — bell-curve surplus, many low-surplus periods and few peak ones, so
  each slice captures fewer periods. Genuinely concave.
- **Constant-output CHP** — surplus sits near one level whenever running. Close to
  linear, then a cliff.

Potential export is **site surplus + battery discharge** (`dis2` competes for the
same headroom), so saturation sits slightly above pure site surplus — relevant
only when the battery is large relative to site load.

### 9.2 Why the axis usually shows nothing

For BTM sites, discharging behind the meter avoids the full import stack (energy
+ DUoS + non-energy charges) while exporting earns only the export rate. `dis1`
dominates `dis2` until site demand is fully offset, so the export constraint
rarely binds.

This is observable: a 60-day test run on a flat-load site returned **identical**
net benefit for 0 MW and 0.5 MW export limits on both battery sizes. Not a bug —
the battery never wanted to export. Any work on this axis must be tested against
a generation-carrying archetype (PV or CHP).

### 9.3 What makes the axis meaningful

Reinforcement cost. It is a **one-off** capital contribution to the DNO under the
connection charging methodology — not recurring — but it has a recurring shadow:
reinforcement usually comes with higher agreed capacity, billed daily at £/kVA/day
(already present as `capacity_gbp_per_kva_day`). Complete treatment is therefore
one-off capex **plus** an ongoing capacity-charge delta.

It is also **lumpy**: free within existing headroom, modest for new metering and
protection, then a step change when a transformer, cable or primary substation
needs upgrading.

Concave-then-flat benefit against step-function cost means NPV rises within a
tier and falls at each cliff, and — because benefit saturates — the optimum can
**never** sit above the saturation point. That yields the actual deliverable:
*"your site saturates at 480 kW; a connection sized above that is dead capital."*

**Honesty boundary:** flexiq cannot know a reinforcement cost. It is site-specific
and only comes from a real DNO connection application. The defensible claim is
*given your quote, here is the NPV-maximising export limit, and here is what the
next tier would have to earn to justify itself.* The tool does the economics; the
user supplies the network facts. Same division as the roadmap's live-NESO-docs
workflow.

---

## 10. Queued work

| # | Item | Size | Depends on |
|---|---|---|---|
| 1 | ~~Coverage denominator (§5.1)~~ **done 2026-10-04** | S | — |
| 2 | UI input tiering by sensitivity (§7) | S | — |
| 3 | Archetype-mode support (card is CSV-only; needs a data period) | S | — |
| 4 | Export saturation curve (§9.1) | M | generation archetype |
| 5 | Reinforcement capex + capacity-charge delta (§9.3) | M | 4 |
| 6 | Agreed-capacity avoidance as a revenue stream (§4.2) | M | — |
| 7 | Multi-year re-optimisation replacing linear fade (§2, §6.1) | L | — |
| 8 | Load growth as a volume escalator, distinct from price (§11) | S–M | — |
| 9a | Precision degradation + range display for short periods (§5.3) | S | — |
| 9b | Benefit decomposition by charge component (wholesale/DUoS/NEC) | M | — |
| 9c | Seasonality index on the wholesale slice only (§5.3) | M | 9b |
| 10 | XLSX investment sheet | S | **requires `src/report.py` authorisation** |

---

## 11. Out of scope in v1

Augmentation/replacement capex · residual value · debt structure (this is an
**unlevered, pre-tax** view) · tax and capital allowances · real-terms toggle ·
LCOS · site load growth (a *volume* escalator, genuinely distinct from the price
escalator — value is volume × price, so both may legitimately apply, but folding
them into one number hides the assumption).

---

## 12. Worked example

Mirrors `tests/test_investment.py::test_worked_example_duos_arbitrage_alone_is_npv_negative`.
1 MW / 2 MWh, £40,000 benefit over a 365-day CSV, fade and escalation zeroed.

- Capex = 1,000 kW × £150 + 2,000 kWh × £250 = **£650,000**
- B₁ = £40,000; O₁ = 1.5% × 650,000 = £9,750 → net £30,250/yr
- Annuity factor (8%, 15y) = (1 − 1.08⁻¹⁵)/0.08 = 8.559479
- NPV = 30,250 × 8.559479 − 650,000 = **−£391,076** · IRR −4.19% · payback 21.5y

Verified against the live endpoint: `−391075.77`, IRR `−4.19%`.

**Negative, deliberately. A battery rarely pays for itself on DUoS/tariff
arbitrage alone.** That is the honest Phase-1 headline and the reason the roadmap
exists: wholesale spreads (Phase 2), Capacity Market (3), ancillary availability
(4) and BM (5) stack further benefit onto the same asset. Watch B₁ grow as each
phase lands — this layer is the scoreboard.
