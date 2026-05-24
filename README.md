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

flexiq is a behind-the-meter (BTM) BESS dispatch optimiser built for pre-feasibility analysis. Given a site load profile, a set of BESS hardware configurations, and an analysis window, it solves a mixed-integer linear programme (MILP) for each scenario to find the optimal charge/discharge schedule — then settles the results against real UK market prices pulled from Elexon's BMRS API. The output is a ranked comparison of up to 12 scenarios showing net bill reduction, site cost with and without BESS, and a full SP-level dispatch timeseries, exportable as a formatted Excel report.

---

## What it models

### Decision variables (per settlement period)

| Variable | Description |
|---|---|
| `charge1_mw` | Charge from on-site surplus (PV/CHP spill) — avoids curtailment |
| `charge2_mw` | Charge from grid import — incurs full import cost |
| `dis1_mw` | Discharge to offset site demand — avoids import |
| `dis2_mw` | Discharge to grid — generates export revenue |

All variables are continuous and bounded per SP by site conditions (available surplus, demand level, export connection limit).

### Cost stack

**Import rate (£/MWh):**
```
Energy price (DA or imbalance) + DUoS volumetric + NEC policy levies
```

**Export rate (£/MWh):**
```
Energy price + |GDUoS credit| (GDUoS stored as negative, subtraction adds the credit)
```

**Standing charges (£/SP, accrued regardless of dispatch):**
- DUoS fixed daily charge
- DUoS capacity charge (scales with contracted kVA)
- GDUoS fixed daily charge

**P&L per SP:**
```
net_settlement = dis1_saving + dis2_revenue − charge2_cost − charge1_opp_cost − deg_cost
```

Where `charge1_opp_cost` is the foregone export revenue from absorbing on-site surplus rather than exporting it, and `deg_cost` is a flat £8/MWh throughput degradation charge.

**Site-level comparison:**
```
site_cost_without_bess = baseline_net_gbp.sum() + total_standing_gbp.sum()
site_cost_with_bess    = site_cost_without_bess − net_settlement_gbp.sum()
net_benefit            = net_settlement_gbp.sum()
```

### Network charges

Northern Powergrid (Northeast) HV Site Specific tariff (2025/26 rates). DUoS volumetric rates follow the standard RAG band structure — Red (16:00–19:00 weekdays) at £88/MWh, Amber (07:00–16:00 and 19:00–23:00) at £5/MWh, Green otherwise at £0.50/MWh. Weekends and UK bank holidays are always green. GDUoS credits mirror the same band structure (negative sign convention).

### Price signals

Prices are fetched from the Elexon BMRS API:
- **Day-ahead**: Market Index Data (MID) endpoint, used as a day-ahead proxy
- **Imbalance**: System sell price from the DISEBSP endpoint

The user selects which price they are contractually exposed to before running. The optimiser uses the selected forecast price for dispatch decisions; settlement uses the corresponding actual price.

Currently implemented with **perfect foresight** (forecast = actual). This gives an upper-bound estimate of achievable value — a real deployment would substitute a forecast model.

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
│  In-memory job store (resets on dyno restart)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  src/ — Python engine                                       │
│  data_builder → [prices, charges, generation] → optimiser   │
│  PuLP + HiGHS MILP, 1-day chunks, SOC handoff               │
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
│       ├── run.py              POST /run · GET /run/{job_id} (background MILP runner)
│       └── export.py           GET /export/{job_id} (streams pre-built XLSX)
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
│       └── api/client.js               API base URL — update this to switch environments
│
├── data/cache/                 Elexon price CSVs (gitignored)
├── requirements.txt
└── README.md
```

---

## Running locally

### Prerequisites

- Python 3.11+
- Node 18+
- `pip3 install -r requirements.txt`

### Backend

```bash
uvicorn api.main:app --reload
```

API runs on `http://localhost:8000`. The first run for any date range will fetch prices from Elexon and cache them to `data/cache/`. Subsequent runs for the same range use the cache.

### Frontend

```bash
cd ui
npm install
npm run dev
```

UI runs on `http://localhost:5173`. Make sure `ui/src/api/client.js` has `API_BASE_URL = "http://localhost:8000"` for local development (currently set to the Render deployment URL).

---

## Assumptions and limitations

| Area | Assumption |
|---|---|
| **Demand profiles** | Fully synthetic. Demand is modelled from archetype parameters (peak/base/offpeak MW) with a deterministic intraday shape — no real meter data. |
| **Price foresight** | Perfect foresight — forecast equals actual. Results represent an optimistic upper bound. A deployed system would use a forecast model. |
| **DNO/tariff** | Hardcoded to Northern Powergrid (Northeast), HV Site Specific 2025/26. Only one network configuration is supported. |
| **Chunk size** | The MILP is solved in 1-day (48 SP) chunks with SOC continuity between chunks. Longer look-ahead windows would improve dispatch quality at the cost of solve time. |
| **Policy levies** | NEC (BSUoS, CfD, RO, CM, FiT) are indicative flat rates — not supplier-quoted actuals. |
| **CHP fuel cost** | Fixed at £70/MWh — a pre-feasibility benchmark, not site-specific. |
| **Degradation** | Flat £8/MWh throughput cost throughout the asset life. No cycle-depth or temperature degradation curves. |
| **Efficiency** | 90% round-trip, split symmetrically (√0.9 per side). |
| **SoC bounds** | 5–95% of capacity. End-of-day SoC target is the initial SoC (50%) ± 10% of capacity. |
| **Scenario cap** | UI enforces 1 archetype × max 3 BESS configs × max 4 export limits = 12 scenarios per run. |
| **Job persistence** | Job results are held in memory on the Render instance. A dyno restart clears all jobs — no database. |
| **Concurrency** | Maximum 2 simultaneous optimisation jobs via `ThreadPoolExecutor`. |

---

## Roadmap

### V2 — Ancillary services revenue stacking

Add revenue from GB ancillary service markets alongside energy arbitrage:

- **Dynamic Containment (DC)** — FFR replacement, 1 second response, high availability requirement
- **Dynamic Moderation (DM)** and **Dynamic Regulation (DR)** — slower response tiers
- **Quick Reserve (QR)** — minutes-timescale
- **Capacity Market (CM)** — T-1 and T-4 auction participation, annual payment

This requires reformulating the MILP objective to include availability payments and adding state variables for response headroom alongside the current energy dispatch variables.

### V3 — Real site data

- Half-hourly AMR meter data upload (CSV/XLSX) replacing synthetic demand profiles
- Site-specific DNO connection agreement parameters (export limit, contracted capacity)
- Multiple DNO tariff configurations beyond Northern Powergrid
- Gas price input for CHP marginal cost
- Forecast price integration (EPEXSpot DA auction results)

---

## Tech stack

| Layer | Technology |
|---|---|
| Optimisation | PuLP 3.3 (modelling) + HiGHS 1.14 (solver) via `highspy` |
| Backend | FastAPI 0.136, Uvicorn, Pydantic v2 |
| Data | pandas, numpy, Elexon BMRS REST API |
| Report | openpyxl 3.1 (write_only streaming mode) |
| Frontend | React 18, Vite 5, recharts, date-fns |
| Deployment | Vercel (frontend), Render (backend) |
