# GB network charging for C&I sites

Reference for flexibility product design. Compiled 4 August 2026 from NESO, Ofgem,
DESNZ, HMRC and DNO primary documents. Every figure is sourced in the last section.
Tariff data is for charging years 2025/26 to 2027/28.

---

## 1. What responds to flexibility, and what does not

This is the table the rest of the document supports. Two different questions get
confused constantly: whether a charge falls when you consume less, and whether it
falls when you consume at a different time.

| Charge | Falls if you cut total volume | Falls if you shift load in time | Basis |
|---|---|---|---|
| TNUoS residual | No | **No** | Fixed £/site/day by capacity band |
| TNUoS locational | Yes | Yes, at Triads | £/kW on Triad demand |
| BSUoS | Yes | No | Fixed £/MWh, volumetric |
| DUoS unit rates | Yes | **Yes** | p/kWh by red, amber, green band |
| DUoS fixed charge | No | No | p/MPAN/day by residual band |
| DUoS capacity charge | No | Only via a lower agreed capacity | p/kVA/day on agreed capacity |
| Capacity Market supplier charge | Yes | **Yes** | Share of demand, weekdays 16:00 to 19:00, November to February |
| CCL | Yes | No | p/kWh, volumetric |
| RO, CfD, FIT | Yes | No | p/kWh, volumetric |

Three things follow.

**The largest single line does not respond to flexibility at all.** The TNUoS
residual raises £6.27bn of £6.38bn of demand TNUoS revenue in 2026/27, about 98%.
It is a fixed daily charge set by connection capacity and voltage. No amount of
load shifting, peak avoidance or on-site generation reduces it.

**DUoS red band and the Capacity Market supplier charge are the two real
time-shifting levers.** The CM charge is the better of the two for automated
control, because it applies across roughly 250 chargeable hours per winter rather
than a handful of forecast half-hours. It rewards habitual daily shifting.

**One caveat on the CM lever.** It only reaches the customer if their contract
passes the charge through on a peak-window basis. Many SME contracts embed it in a
flat p/kWh, in which case reducing peak demand saves the customer nothing. Check
the contract structure before selling it.

---

## 2. How the charges are built

Three layers. Confusing them is the most common error in reading this data.

**Layer 1. The price control sets allowed revenue.** Ofgem's RIIO framework caps
what each network company may collect over a fixed period. Revenue is built from
fast money, depreciation, return on the regulatory asset value, incentive payments
and pass-through costs.

**Layer 2. A charging methodology converts revenue into tariffs.** Distribution
uses the CDCM for LV and HV users and the EDCM for EHV site-specific users.
Transmission uses the CUSC.

**Layer 3. The residual is the balancing item.** Charges split into forward-looking
elements, priced to signal the marginal cost of using or reinforcing the network,
and a residual that recovers whatever allowed revenue those elements do not. The
residual exists because a network is almost entirely sunk cost, and marginal-cost
pricing on a system like that recovers only a fraction of total cost.

### Why the residual is deliberately unavoidable

Before the Targeted Charging Review the residual was volumetric, so a site could
dodge part of it by cutting consumption at the right moments. Avoiding a residual
saves the system nothing. Allowed revenue is fixed, so every pound one site avoids
is recovered from another. TCR made it a fixed charge by band, set by connection
capacity and voltage, so behaviour cannot move it.

The forward-looking half stays avoidable, because avoiding that does save real
cost. The split is doing exactly what it was designed to do.

### The residual is a plug, so it absorbs every shock

- Allowed revenue rises, so the residual rises. TNUoS demand residual went up 63%
  for 2026/27 when RIIO-ET3 allowances stepped up.
- Forward-looking charges rise, so the residual falls to compensate. Several DNO
  fixed charges collapsed in 2026/27 when the Access SCR flowed through the CDCM.
- Forward-looking charges would over-recover, so the residual computes negative and
  is floored at zero. This is what SSEN's tariffs show, and what broke UK Power
  Networks' model. UKPN told Ofgem its CDCM "returned a number of errors as the
  surplus residual could not be fully accounted for".

A fixed charge moving 300% in a year is almost never telling you about network
costs. It is telling you what happened to the other half of the tariff.

### The correction factor is a different thing

Tariffs are set on forecast volumes 15 months ahead, so companies over- or
under-recover against the cap. That difference is trued up in a later year's
allowed revenue, with interest. It is not the residual, and it causes its own
volatility.

---

## 3. Transmission: TNUoS

### The split, 2026/27

| Component | Revenue | Share |
|---|---|---|
| Total demand TNUoS revenue | £6.38bn | 100% |
| Locational (forward-looking) | about £0.11bn | ~2% |
| Residual (fixed by band) | £6.27bn | ~98% |

Residual revenue rose from £3,836.0m in 2025/26 to £6,265.2m in 2026/27, up 63.3%,
effective 1 April 2026. Expressed per unit of chargeable demand (243,956.8 GWh)
that is £15.72 to £25.68/MWh, but no site is billed on a £/MWh basis. Use the
revenue figures unless a £/MWh comparison against BSUoS or CCL is needed, and state
the denominator if you do.

### TCR residual bands, 2026/27

Thresholds are fixed for the whole of RIIO-ET3, to 2030/31. Bands are set by
percentile of sites within each voltage level.

| Band | Threshold | £/site/day | £/site/year | Sites |
|---|---|---|---|---|
| Domestic | | 0.2226 | 81 | 29,896,095 |
| LVN1 | up to 3,986 kWh | 0.2393 | 87 | 876,682 |
| LVN2 | 3,986 to 13,677 kWh | 0.5873 | 214 | 657,512 |
| LVN3 | 13,677 to 27,543 kWh | 1.2424 | 453 | 328,756 |
| LVN4 | above 27,543 kWh | 3.4610 | 1,263 | 328,756 |
| LV1 | up to 90 kVA | 5.7974 | 2,116 | 86,184 |
| LV2 | 90 to 150 kVA | 11.5118 | 4,202 | 64,638 |
| LV3 | 150 to 250 kVA | 14.3814 | 5,249 | 32,319 |
| LV4 | above 250 kVA | 38.1801 | 13,936 | 32,319 |
| HV1 | up to 500 kVA | 31.8390 | 11,621 | 8,718 |
| HV2 | 500 to 1,100 kVA | 117.1528 | 42,761 | 6,539 |
| HV3 | 1,100 to 2,000 kVA | 185.4185 | 67,678 | 3,269 |
| HV4 | above 2,000 kVA | 528.9123 | 193,053 | 3,269 |
| EHV1 | up to 3,500 kVA | 325.4766 | 118,799 | 362 |
| EHV2 | 3,500 to 11,000 kVA | 1,159.3815 | 423,174 | 272 |
| EHV3 | 11,000 to 20,000 kVA | 2,512.9305 | 917,220 | 136 |
| EHV4 | above 20,000 kVA | 5,698.3864 | 2,079,911 | 136 |
| T-Demand1 | up to 25,131 MWh | 1,401.9495 | 511,712 | 30 |
| T-Demand2 | 25,131 to 64,451 MWh | 2,931.2288 | 1,069,899 | 21 |
| T-Demand3 | 64,451 to 163,880 MWh | 7,586.4139 | 2,769,041 | 16 |
| T-Demand4 | above 163,880 MWh | 20,829.2367 | 7,602,671 | 5 |

Units are £/site/day, not pence. Reading them as pence understates by 100 times.

### Band boundaries are step changes

A site at 1,100 kVA sits at the top of HV2 and pays £42,761 a year. At 1,101 kVA it
moves to HV3 and pays £67,678. One additional kVA costs £24,917 a year.

This is the strongest argument for capacity right-sizing, and it means peak-shaving
has real value at this layer as an enabler of a lower agreed capacity, not as an
energy saving.

### The residual penalises low load factor, not size

NESO allocates residual revenue to each band in proportion to that band's
consumption share, so every band averages to a similar £/MWh by construction. The
real spread sits within bands, driven by how hard each site works its connection.

A 1,100 kVA site running flat out all year would consume about 9,640 MWh.

| Load factor | Consumption | Residual bill | Effective |
|---|---|---|---|
| 10% | about 964 MWh | £42,761 | about £44/MWh |
| 60% | about 5,780 MWh | £42,761 | about £7/MWh |

Worst affected: single-shift manufacturing, schools, offices with large HVAC peaks,
seasonal businesses, EV charging hubs, and any site holding a connection sized for
headroom. Least affected: continuous process loads such as data centres, cold
storage, water treatment and paper.

A site electrifying heat or fleet adds peak capacity before it adds consumption, so
its effective £/MWh residual rises early in the transition.

### Triads are still live

The locational element of HH demand TNUoS is still charged on Triad demand, the
three half-hour settlement periods of highest system demand between November and
February. TCR removed Triad avoidance from the residual in April 2023, not from the
locational element.

What changed is the value. The average HH locational tariff fell from £8.49/kW in
2025/26 to £2.79/kW in 2026/27, and locational is only about 2% of demand TNUoS
revenue. Triad avoidance is still real and now worth much less. Do not describe
Triads as abolished.

---

## 4. Transmission: BSUoS

Charged 100% on final demand since April 2023 (CMP308). Since CMP408 and CMP415
took effect on 1 April 2025 it is a fixed volumetric tariff published 12 months
ahead each December, so it is a predictable line rather than a risk position.

| Period | £/MWh |
|---|---|
| Apr to Sep 2025 | 10.74 |
| Oct 2025 to Mar 2026 | 15.69 |
| Apr to Sep 2026 | 13.74 |
| Oct 2026 to Mar 2027 | 12.49 |

Weighted average falls from £13.44/MWh in 2025/26 to £13.05/MWh in 2026/27. The
seasonal shape matters more than the annual trend, with winter running about 25%
above summer.

Because the tariff is fixed and volumetric, cutting consumption reduces it
proportionally and shifting consumption does not.

Note a trap: BSUoS at £15.69/MWh for winter 2025/26 is close to the £15.72/MWh
figure sometimes quoted for the 2025/26 TNUoS residual per MWh. Different charges,
coincidentally similar numbers.

---

## 5. Distribution: DUoS

### Structure

| Component | Unit | Applies to |
|---|---|---|
| Unit rate, red, amber, green | p/kWh | All non-domestic |
| Fixed charge | p/MPAN/day | All, banded 1 to 4 |
| Capacity charge | p/kVA/day | Half-hourly site-specific only |
| Exceeded capacity | p/kVA/day | Half-hourly site-specific only |
| Reactive power | p/kVArh | Half-hourly site-specific only |

The dividing line between small and large is site-specific versus aggregated
metering, not annual consumption. Aggregated LV sites pay unit rates and a fixed
charge only, with no capacity, excess or reactive charges.

Red band is typically weekdays 16:00 to 19:00, but it varies. London Power Networks
runs a twin peak, 11:00 to 14:00 and 16:00 to 19:00, all year. Northern Powergrid
runs 16:00 to 19:30. Check the licence area.

### LV site-specific Band 2 fixed charge, all 14 licence areas

p/MPAN/day. Two-year change is the honest comparison, because the one-year column
reorders almost arbitrarily depending on what each DNO did in 2026/27.

| Licence area | 2025/26 | 2026/27 | 2027/28 | 1 year | 2 year |
|---|---|---|---|---|---|
| South Eastern | 27.82 | 65.81 | 308.19 | +368.30% | +1,007.8% |
| South West | 87.70 | 60.79 | 240.23 | +295.18% | +173.9% |
| Eastern | 24.82 | 33.09 | 123.11 | +272.05% | +396.0% |
| Northern Powergrid, Northeast | 117.29 | 129.89 | 364.33 | +180.49% | +210.6% |
| East Midlands | 92.33 | 85.08 | 226.69 | +166.44% | +145.5% |
| South Wales | 94.16 | 165.52 | 326.94 | +97.52% | +247.2% |
| SP Distribution | 490.43 | 608.00 | 842.76 | +38.61% | +71.8% |
| West Midlands | 136.85 | 219.77 | 294.58 | +34.04% | +115.3% |
| Northern Powergrid, Yorkshire | 231.22 | 293.65 | 390.64 | +33.03% | +68.9% |
| SP Manweb | 1,307.66 | 1,021.63 | 1,081.44 | +5.85% | -17.3% |
| London | 24.97 | 2.35 | 2.30 | -2.13% | -90.8% |
| North West (ENWL) | 137.29 | 0.00 | 87.57 | undefined | -36.2% |
| Northern Scotland (SHEPD) | 152.19 | 0.00 | 0.00 | undefined | -100% |
| Southern (SEPD) | 0.00 | 0.00 | 11.63 | undefined | undefined |

Four areas cannot be ranked on a percentage at all, because their 2026/27 base was
zero. Any cross-DNO league table built on fixed-charge percentage change silently
drops or distorts them.

Levels differ as much as changes. SP Manweb charges £10.81 a day where London
charges 2.3p.

### Recovery is shifting to capacity

Two DNOs have independently moved most or all site-specific recovery onto the
capacity charge.

London Power Networks, HV site-specific Band 2:

| | 2025/26 | 2026/27 | 2027/28 |
|---|---|---|---|
| Red p/kWh | 2.141 | 0.009 | 0.223 |
| Amber p/kWh | 0.111 | 0.000 | 0.000 |
| Green p/kWh | 0.008 | 0.000 | 0.000 |
| Fixed p/MPAN/day | 220.70 | 0.00 | 0.00 |
| Capacity p/kVA/day | 4.49 | 9.19 | 10.65 |

Those zeros are published zeros, not blanks. For an LPN HV site the entire DUoS
bill sits in the capacity charge, and no amount of load shifting touches it.

SSEN did the same thing differently. SHEPD zeroed its Band 2 fixed charge and moved
recovery onto capacity, up 20.54% at LV in 2027/28. SEPD's fixed charges fall as the
residual band rises, which indicates a negative computed residual floored at zero:

| SEPD LV site-specific 2027/28 | No residual | Band 1 | Band 2 | Band 3 | Band 4 |
|---|---|---|---|---|---|
| Fixed p/MPAN/day | 25.25 | 16.93 | 11.63 | 1.38 | 0.00 |

For SSEN customers the capacity charge is the line to watch, not the fixed charge.

### Timing and process

Charges are published 15 months before they take effect, so only two years are ever
known. Ofgem rejected shortening that notice period (DCP437) on 10 October 2025.

The Access SCR was implemented on **1 April 2023**, not 2025. It made the connection
charging boundary fully shallow for demand and standardised non-firm access rights.
The April 2025 event was different: DNOs set customer contributions in the CDCM to
zero, which pushed recovery from fixed charges onto capacity and unit charges. Trade
press routinely conflates the two.

### GB has no ongoing non-firm tariff discount

GB curtailable connections deliver a cheaper and faster connection. They carry no
ongoing DUoS discount.

| | GB | Netherlands |
|---|---|---|
| Non-firm option | Curtailable connection, Access SCR, April 2023 | Non-firm ATO |
| Benefit | Lower upfront connection cost, faster energisation | About 50% lower ongoing transport tariff |
| Mandatory on the network operator | Only where a network benefit exists | Yes, since 1 February 2025 |
| Product range | Firm or curtailable | Four rights since 1 April 2025 |

Do not present GB as being on the same path as the Dutch or German reforms. The
capacity weighting shift described above was a consequence of the Access SCR flowing
through the CDCM, not a designed tariff reform.

---

## 6. Price control calendar

RIIO stands for Revenue = Incentives + Innovation + Outputs. The name encodes both a
sector and a round, which is why it looks confusing.

| Sector | Current control | Period | Next |
|---|---|---|---|
| Electricity transmission | RIIO-ET3 | 1 Apr 2026 to 31 Mar 2031 | RIIO-4, not yet started |
| Electricity distribution | RIIO-ED2 | 1 Apr 2023 to 31 Mar 2028 | RIIO-ED3, 2028 to 2033 |
| Gas transmission and distribution | RIIO-3 | 1 Apr 2026 to 31 Mar 2031 | |

RIIO-ET3 Final Determinations were published on 4 December 2025. Ofgem set
allowances of £10.7bn of upfront transmission funding, stated that at least £44bn is
already committed for the period including the ASTI programme, and used an upper
bound of over £70bn that may be required. The wider RIIO-3 pipeline across
electricity and gas is around £90bn.

RIIO-ED3 published its Sector Specific Methodology Decision on 21 May 2026, with DNO
business plans due December 2026 and determinations concluding end 2027. Ofgem
declines to quantify bill impacts at this stage but states that investment "is
likely to place upward pressure on electricity distribution charges".

**Two planning points.** The cycles are offset, so a 2026 to 2035 view crosses a
control boundary in 2028, 2031 and 2033. And nothing beyond March 2031 for
transmission or March 2033 for distribution rests on a published allowance, because
RIIO-4 does not exist yet.

### Published business bill impacts

Ofgem's own estimates for 2030/31 against a RIIO-2 roll-forward:

| Site type | Increase per year |
|---|---|
| Holiday let or retail kiosk | about £70 |
| Small office or hotel | about £1,790 |
| Medium factory | about £9,760 |
| Large HV site (HV4) | about £165,320 |
| EHV4 | about £1.64m |

Energy-intensive bills are expected to be 10 to 15% lower by 2031 as RIIO-3 effects
combine with government relief.

---

## 7. Reform pipeline

| Reform | Status | Timing |
|---|---|---|
| Reformed National Pricing | Delivery plan published 21 April 2026. National pricing retained, zonal rejected on 10 July 2025 | Network charge reform "as soon as possible", call for input and workshops during 2026/27 |
| Imbalance settlement period, 30 minutes to 15 or 5 | Initial Ofgem decision expected | H2 2026 |
| Balancing Mechanism participation thresholds lowered | Committed | From 2027 |
| Cost Allocation and Recovery Review | Launched 30 July 2025, 330 responses. Examining the fixed versus unit split | Options engagement Q1 and Q2 of 2026/27 |
| DUoS Significant Code Review | Open since February 2022, no decision, deprioritised | None |
| Market-wide Half-Hourly Settlement | Committed | July 2027 |
| Connections reform, TMO4+ | Approved 15 April 2025, gated queue live | Distribution Gate 2 offers through 2026 into 2027 |

The move to 15 or 5 minute imbalance settlement is the most consequential item for
flexibility value. It sharpens intraday exposure on indexed contracts and raises the
value of fast automated response.

The DUoS SCR is the reform that would be GB's structural equivalent to Germany's
AgNes. It has been open for four years without a decision.

---

## 8. Levies that interact with the value stack

Not network charges, but they sit in the same bill and two of them respond to
flexibility.

| Levy | 2026/27 | Notes |
|---|---|---|
| CCL | 0.801 p/kWh, rising to 0.827 p/kWh on 1 April 2027 | RPI-indexed. Same rate now applies to gas. Sites under 1,000 kWh a month fall outside CCL |
| CCL with a Climate Change Agreement | 0.064 p/kWh | 92% discount, electricity |
| Capacity Market, T-4 for 2029/30 | £27.10/kW/yr | Less than half the previous three T-4 rounds |
| Capacity Market, T-1 for 2026/27 | £5.00/kW/yr | Lowest since 2020/21 |

Energy-intensive relief stacks four ways, each with a different eligibility test.
EII certificate holders get 100% exemption from RO, CfD, FIT and Capacity Market
costs, plus 90% compensation on BSUoS, DUoS and TNUoS from 1 April 2026, up from
60%. The network compensation is funded by the EII Support Levy on all other GB
electricity customers.

---

## 9. Product implications

**Load shifting does not reduce the largest network line.** Any business case that
assumes flexibility reduces network charges generally is wrong for about 98% of
demand TNUoS revenue, and increasingly wrong for DUoS.

**Two levers work on the residual.** Raise utilisation of capacity already held, or
cut agreed capacity to cross a band boundary. The second has a step-change payoff
and is a connection-agreement decision, not an operational one.

**Segment by load factor, not by size.** The sites with most to gain from a capacity
review are peaky and under-utilised. A target list ranked by consumption returns the
wrong sites.

**Two cautions before advising a capacity reduction.** Released capacity may be
reallocated and may need chargeable reinforcement to recover. And TNUoS and DUoS
capacity charges must be modelled together, because DUoS rates vary enormously by
region.

**Where time-shifting does pay.** DUoS red band avoidance, Capacity Market supplier
charge avoidance across the winter peak window, Triad avoidance at reduced value,
and wholesale or imbalance exposure. The Capacity Market lever is the best fit for
automated control because of the number of chargeable hours, subject to the contract
pass-through check in section 1.

---

## 10. Sources

1. NESO, Final TNUoS Tariffs for 2026/27, January 2026.
   https://www.neso.energy/document/376336/download
2. NESO, Final TNUoS Tariffs for 2025/26, January 2025.
   https://www.neso.energy/document/353086/download
3. NESO, Published Tables, Table TB, TCR band charges, January 2026.
   https://www.neso.energy/document/376341/download
4. NESO, BSUoS Final 2026/27 Tariffs, 29 December 2025.
   https://www.neso.energy/document/375861/download
5. Ofgem, RIIO-3 Final Determinations Overview, 4 December 2025.
   https://www.ofgem.gov.uk/sites/default/files/2025-12/RIIO-3-Final-Determinations-overview.pdf
6. Ofgem, RIIO-3 Final Determinations Impact Assessment, 4 December 2025.
   https://www.ofgem.gov.uk/sites/default/files/2025-12/RIIO-3-Final-Determinations-impact-assessment.pdf
7. Ofgem, RIIO-ED3 Sector Specific Methodology Decision, 21 May 2026.
   https://www.ofgem.gov.uk/sites/default/files/2026-05/ED3%20Sector%20specific%20methodology%20decision%20core%20document.pdf
8. Ofgem, RIIO-ED2 Final Determinations Overview, 30 November 2022.
   https://www.ofgem.gov.uk/sites/default/files/2022-11/RIIO-ED2%20Final%20Determinations%20Overview%20document.pdf
9. Ofgem, Access SCR Final Decision, May 2022.
   https://www.ofgem.gov.uk/sites/default/files/2022-05/Access%20SCR%20-%20Final%20Decision.pdf
10. Ofgem, DCP437 decision on DUoS pricing notice periods, 10 October 2025.
    https://www.ofgem.gov.uk/sites/default/files/2025-10/DCUSA%20DCP437%20-%20To%20Shorten%20the%20DUoS%20Pricing%20Notice%20Periods.pdf
11. Ofgem, Open Letter: Reforming network charging signals, 21 July 2025.
    https://www.ofgem.gov.uk/sites/default/files/2025-07/open-letter-reforming-network-charging-signals.pdf
12. Ofgem, Energy system cost allocation and recovery review, launched 30 July 2025.
    https://www.ofgem.gov.uk/call-for-input/energy-system-cost-allocation-and-recovery-review
13. Ofgem, Forward Work Programme 2026 to 2027, March 2026.
    https://www.ofgem.gov.uk/sites/default/files/2026-03/Forward-Work-Programme-2026-to-2027.pdf
14. DESNZ, Reformed National Pricing delivery plan, 21 April 2026.
    https://www.gov.uk/government/publications/reformed-national-pricing-rnp-delivery-plan/reformed-national-pricing-rnp-delivery-plan-accessible-webpage
15. DESNZ, REMA summer update, 10 July 2025.
    https://www.gov.uk/government/publications/review-of-electricity-market-arrangements-rema-summer-update-2025/review-of-electricity-market-arrangements-rema-summer-update-2025-accessible-webpage
16. HMRC, Climate Change Levy rates, updated 27 November 2025.
    https://www.gov.uk/guidance/climate-change-levy-rates
17. Deloitte for NESO, Capacity Market T-4 2029/30 Auction Monitor Report, March 2026.
    https://assets.publishing.service.gov.uk/media/69b44fd2cf4af9cad362b41c/t-4-2025-delivery-year-2029-2030-auction-monitor-report.pdf
18. Deloitte for NESO, Capacity Market T-1 2026/27 Auction Monitor Report, March 2026.
    https://assets.publishing.service.gov.uk/media/69aedeaf6827004e30b8a56e/T-1-2025-for-delivery-2026-27-auction-monitor-report.pdf
19. The Electricity Capacity (Supplier Payment etc.) Regulations 2014, Part 3.
    https://www.legislation.gov.uk/ukdsi/2014/9780111123119/part/3
20. DBT, Energy Intensive Industries exemption guidance, revised May 2026.
    https://assets.publishing.service.gov.uk/media/69fc5886cd2e0e8b5b20b21e/energy-intensive-industries-certificate-for-exemption-funding-contracts-for-difference-renewables-obligation-feed-in-tariff.pdf
21. NESO, Connections reform timeline.
    https://www.neso.energy/industry-information/connections-reform/connections-reform-timeline
22. DNO Use of System charging statements, 2025/26 to 2027/28, all 14 GB licence
    areas. Examples: UK Power Networks London Power Networks effective 1 April 2026,
    https://media.umbraco.io/ukpn-cms/bqthjnqt/london-power-networks-lc14-statement-2026-v1-3.pdf
    and Eastern Power Networks effective 1 April 2027,
    https://media.umbraco.io/ukpn-cms/voglwumz/eastern-power-networks-lc14-statement-2027-v1-2.pdf

---

## 11. Known gaps and caveats

Carry these if the data is reused.

**SP Energy Networks 2027/28 statements were read through a text-extraction proxy**,
not parsed from raw PDF bytes, because scottishpower.com blocks automated requests.
The proxy was control-tested against a verified PDF and reproduced all ten
site-specific rows exactly. For an audit trail, download those two in a browser.

**SP has published no final 2026/27 statement.** Version 0.1 from December 2024
remains current for both SPD and SP Manweb even though the charging year began in
April 2026. If SP reissues, the SPD and SPM year-on-year figures need recomputing.

**Scope of the DUoS extract.** LV and HV site-specific Band 2 only. Other residual
bands were pulled only to test claimed ranges. LDNO, sub-LV, generation, EHV/EDCM
and unmetered tariffs are not covered.

**Excess capacity multiplier varies.** UK Power Networks 2026/27 charges excess at
1 times the capacity rate. National Grid Electricity Distribution guidance says 2 to
3 times. Check per DNO rather than assuming.

**No published evidence that C&I sites are actually reducing agreed capacity** in
response to the capacity shift. Every source found is a consultancy marketing a kVA
review. Treat it as a plausible response, not an evidenced trend.

**Unreconciled NESO figure.** The Five-Year View implies a 2025/26 average HH
locational tariff of £3.00/kW, while the 2025/26 Final Tariffs state £8.49/kW.
Probably a restatement onto the RIIO-ET3 expansion-constant basis. Do not quote a
locational trend until this is resolved.

**NESO's five-year TNUoS forecast is pre-Final-Determinations.** The September 2025
vintage put 2026/27 demand residual at £7,521m against an actual £6,265m, because it
was built on the transmission owners' business plan submissions before Ofgem cut
them by 10 to 14%. Forward years to 2030/31 rest on the same basis and should be
treated as an upper bound.
