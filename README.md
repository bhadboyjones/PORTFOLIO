# flexiq — BTM BESS Optimiser

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?style=flat&logo=fastapi&logoColor=white)
![PuLP](https://img.shields.io/badge/Solver-PuLP%20%2B%20HiGHS-4CAF50?style=flat)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat&logo=vite&logoColor=white)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=flat&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat&logo=render&logoColor=black)

**Live demo: [flexiq-bess.vercel.app](https://flexiq-bess.vercel.app)**

---

## What it is

flexiq is a BTM BESS dispatch optimiser for pre-feasibility analysis. It takes a site load profile, a set of BESS hardware configurations, and an analysis window, solves a MILP for each scenario to find the optimal charge/discharge schedule, then settles results against real UK market prices pulled from Elexon's BMRS API.

The output is a ranked comparison of up to 12 scenarios showing net bill reduction, site cost with and without BESS, and a full SP-level dispatch timeseries — exportable as a formatted Excel report.

---

## What it models

### Decision variables (per settlement period)

| Variable | Description |
|---|---|
| `charge1_mw` | Charge from on-site surplus (PV/CHP spill) — avoids curtailment |
| `charge2_mw` | Charge from grid import — incurs full import cost |
| `dis1_mw` | Discharge to offset site demand — avoids import |
| `dis2_mw` | Discharge to grid — generates export revenue |

All variables are continuous and bounded per SP by site conditions — available surplus, demand level, and export connection limit.

### Cost stack

**Import rate (£/MWh):**
```
Energy price (DA or imbalance) + DUoS volumetric (RAG banded) + NEC policy levies
```

**Export rate (£/MWh):**
```
Energy price + |GDUoS credit|
```
GDUoS is stored as a negative value — subtraction adds the credit.

**Standing charges (£/SP, accrued regardless of dispatch):**
- DUoS fixed daily charge
- DUoS capacity charge (scales with contracted kVA)
- GDUoS fixed daily charge

Charges are published in pence per day — converted to £/SP in `data_builder.py` before the optimiser runs:

```
dduos_fixed_gbp_per_sp     = dduos_fixed_p_per_day / 100 / 48
dduos_capacity_gbp_per_sp  = (dduos_capacity_p_per_kva_day × contracted_kva) / 100 / 48
gduos_fixed_gbp_per_sp     = gduos_fixed_p_per_day / 100 / 48
```

`contracted_kva` is derived from `peak_mw × 1000` at unity power factor assumption.

**P&L per SP:**
```
net_settlement = dis1_saving + dis2_revenue − charge2_cost − charge1_opp_cost − deg_cost
```

`charge1_opp_cost` is the foregone export revenue from absorbing on-site surplus rather than exporting it. `deg_cost` is a flat £8/MWh throughput degradation charge.

**Baseline (no BESS) — calculated per SP before the optimiser runs:**

```
import_cost = net_demand_mwh × (price + DUoS + NEC)     [where net_demand_mw > 0]
export_rev  = |net_demand_mwh| × (price − GDUoS)        [where net_demand_mw ≤ 0]
chp_cost    = chp_gen_mwh × £70/MWh

baseline_net_gbp = import_cost + chp_cost − export_rev
```

Net demand is negative when on-site generation (PV/CHP) exceeds site load — the site is a net exporter in those SPs. PV carries no fuel cost and is already embedded in net demand. CHP fuel cost accrues regardless of whether the site is importing or exporting. Standing charges are sunk costs added at reporting stage only.

**Site-level comparison:**
```
site_cost_without_bess = baseline_net_gbp.sum() + total_standing_gbp.sum()
site_cost_with_bess    = site_cost_without_bess − net_settlement_gbp.sum()
net_benefit            = net_settlement_gbp.sum()
```

### Network charges

Northern Powergrid (Northeast) HV Site Specific tariff (2025/26 rates). DUoS volumetric rates follow the RAG band structure:

- **Red** (16:00–19:00 weekdays): £88/MWh
- **Amber** (07:00–16:00 and 19:00–23:00): £5/MWh
- **Green** (all other times, weekends, bank holidays): £0.50/MWh

GDUoS credits mirror the same band structure with a negative sign convention.

### Price signals

Prices are fetched from the Elexon BMRS API:
- **Day-ahead**: Market Index Data (MID) endpoint, used as a day-ahead proxy
- **Imbalance**: System sell price from the DISEBSP endpoint

The user selects which price they are contractually exposed to before running. The optimiser uses the selected price for dispatch decisions; settlement uses the corresponding actual price.

Currently implemented with **perfect foresight** — forecast equals actual. Results represent an upper-bound estimate of achievable value. A real deployment would substitute a forecast model.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React (Vite)  ─────────────────────────  Vercel            │
│  ConfigPage → ProgressScreen → ResultsPage                   │
│  recharts · date-fns · inline styles                        │
└─────────────────────┬───────────────────────────────────────┘
                      │  REST (CORS-gated)
┌─────────────────────▼───────────────────────────────────────┐
│  FastAPI  ──────────────────────────────  Render            │
│  POST /run           → submits background job               │
│  GET  /run/{job_id}  → polls status + progress              │
│  GET  /export/{id}   → streams pre-built XLSX               │
│                                                             │
│  ThreadPoolExecutor (max 2 concurrent jobs)                  │
│  In-memory job store (resets on restart)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  src/ — Python engine                                       │
│  data_builder → [prices, charges, generation] → optimiser   │
│  PuLP + HiGHS MILP, 3-day chunks, SOC handoff               │
│  openpyxl write_only streaming → report                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Project structure

```
flexiq/
├── src/                        Core Python engine
│   ├── config.py               Site archetypes, BESS matrix, network tariff, levies
│   ├── data_builder.py         Assembles per-SP optimiser input DataFrame
│   ├── prices.py               Elexon BMRS pulls — MID (DA) + DISEBSP (imbalance)
│   ├── charges.py              DUoS/GDUoS RAG band logic + standing charges
│   ├── generation.py           Synthetic demand/PV/CHP profiles
│   ├── optimiser.py            MILP formulation, baseline calc, settlement P&L
│   └── report.py               Excel report — openpyxl write_only, one sheet per scenario
│
├── api/                        FastAPI application layer
│   ├── main.py                 App factory, CORS origins
│   ├── schemas.py              Pydantic request/response models
│   ├── jobs.py                 Thread-safe in-memory job store
│   └── routes/
│       ├── archetypes.py       GET /archetypes
│       ├── scenarios.py        GET /scenarios/options
│       ├── run.py              POST /run · GET /run/{job_id}
│       └── export.py           GET /export/{job_id}
│
├── ui/                         React + Vite frontend
│   └── src/
│       ├── pages/
│       │   ├── ConfigPage.jsx          Site/BESS/timeframe/price configuration
│       │   ├── ProgressScreen.jsx      Polling progress display
│       │   └── ResultsPage.jsx         KPI cards, scenario table, 4 chart tabs
│       ├── components/
│       │   ├── BessConfigurator.jsx    MW × duration selection matrix
│       │   ├── KpiCards.jsx            Summary metrics for top scenario
│       │   ├── ScenarioTable.jsx       Ranked sortable results table
│       │   ├── CumulativePnlChart.jsx  Cumulative P&L over time (top 3 scenarios)
│       │   ├── DispatchProfileChart.jsx SP-level charge/discharge bars + SOC line
│       │   ├── RevenueStackChart.jsx   Stacked P&L components by day
│       │   └── BaselineComparisonChart Site cost with vs without BESS
│       └── api/client.js               API base URL — update to switch environments
│
├── data/cache/                 Elexon price parquets (gitignored)
├── requirements.txt
└── README.md
```

---

## Running locally

### Prerequisites

- Python 3.11+
- Node 18+

```bash
pip install -r requirements.txt
```

### Backend

```bash
uvicorn api.main:app --reload
```

Runs on `http://localhost:8000`. The first run for any date range fetches prices from Elexon and caches them to `data/cache/`. Subsequent runs use the cache.

### Frontend

```bash
cd ui
npm install
npm run dev
```

Runs on `http://localhost:5173`. Make sure `ui/src/api/client.js` has `API_BASE_URL = "http://localhost:8000"` for local development — it currently points to the Render deployment URL.

---

## Assumptions and limitations

| Area | Detail |
|---|---|
| **Demand profiles** | Fully synthetic. Modelled from archetype parameters (peak/base/offpeak MW) with a deterministic intraday shape — no real meter data. |
| **Price foresight** | Perfect foresight — forecast equals actual. Results are an optimistic upper bound. |
| **DNO/tariff** | Hardcoded to Northern Powergrid (Northeast), HV Site Specific 2025/26. Single network configuration only. |
| **Chunk size** | MILP solved in 3-day (144 SP) chunks with SOC continuity between chunks. |
| **Policy levies** | NEC (BSUoS, CfD, RO, CM, FiT) are indicative flat rates — not supplier-quoted actuals. |
| **CHP fuel cost** | Fixed at £70/MWh — a pre-feasibility benchmark. |
| **Degradation** | Flat £8/MWh throughput cost. No cycle-depth or temperature curves. |
| **Efficiency** | 90% round-trip, split symmetrically (√0.9 per side). |
| **SoC bounds** | 5–95% of capacity. End-of-chunk SoC target is initial SoC (50%) ± 10% of capacity. |
| **Scenario cap** | 1 archetype × max 3 BESS configs × max 4 export limits = 12 scenarios per run. |
| **Job persistence** | Results held in memory on the Render instance. A restart clears all jobs — no database. |
| **Concurrency** | Maximum 2 simultaneous optimisation jobs. |

---

## Roadmap

### V2 — Ancillary services revenue stacking

Add GB ancillary service markets alongside energy arbitrage:

- **Dynamic Containment (DC)**, **Dynamic Moderation (DM)**, **Dynamic Regulation (DR)** — frequency response services, EFA block availability payments
- **Quick Reserve (QR)** — minutes-timescale reserve
- **Capacity Market (CM)** — T-1 and T-4 auction participation, annual de-rated capacity payment

This requires extending the MILP objective to include availability payments and adding headroom state variables alongside the current energy dispatch variables.

### V3 — Real site data

- Half-hourly AMR meter data upload (CSV/XLSX) replacing synthetic profiles
- Site-specific DNO connection parameters (export limit, contracted capacity)
- Multiple DNO tariff configurations
- Gas price input for CHP marginal cost
- Forecast price integration (EPEXSpot DA auction results)

---

## Tech stack

| Layer | Technology |
|---|---|
| Optimisation | PuLP 3.3 + HiGHS 1.14 via `highspy` |
| Backend | FastAPI 0.136, Uvicorn, Pydantic v2 |
| Data | pandas, numpy, Elexon BMRS REST API, pyarrow |
| Report | openpyxl 3.1 (write_only streaming mode) |
| Frontend | React 18, Vite 5, recharts, date-fns |
| Deployment | Vercel (frontend), Render Standard (backend) |
