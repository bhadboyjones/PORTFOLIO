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

flexiq is a BTM BESS dispatch optimiser for pre-feasibility analysis. It solves a MILP for each scenario to find the optimal charge/discharge schedule, then settles results against real UK market prices pulled from Elexon's BMRS API.

Two input modes are supported:

- **CSV mode** — upload real half-hourly or hourly site meter data. flexiq validates the file, detects resolution, joins market prices and DNO tariff rates, and runs the optimiser against actual demand.
- **Archetype mode** — select from representative I&C demand profiles (small commercial, mid-size industrial, large industrial) with synthetic demand shapes when no meter data is available.

In both modes the user configures a BESS matrix (up to 9 power/capacity combinations) and up to 4 export limit scenarios. Results are a ranked comparison of up to 12 scenarios showing net bill reduction, site cost with and without BESS, and a full SP-level dispatch timeseries — exportable as a formatted Excel report.

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

Charges are published in pence per day — converted to £/SP before the optimiser runs:

```
dduos_fixed_gbp_per_sp     = fixed_p_per_day / 100 / n_sps_per_day
dduos_capacity_gbp_per_sp  = (capacity_p_per_kva_day × contracted_kva) / 100 / n_sps_per_day
gduos_fixed_gbp_per_sp     = gduos_fixed_p_per_day / 100 / n_sps_per_day
```

`n_sps_per_day` is 48 for half-hourly data and 24 for hourly data. `contracted_kva` defaults to peak net demand × 1000 at unity power factor if not supplied.

**P&L per SP:**
```
net_settlement = dis1_saving + dis2_revenue − charge2_cost − charge1_opp_cost − deg_cost
```

`charge1_opp_cost` is the foregone export revenue from absorbing on-site surplus rather than exporting it. `deg_cost` defaults to £8/MWh throughput and is user-configurable.

**Baseline (no BESS) — calculated per SP before the optimiser runs:**

```
import_cost = net_demand_mwh × (price + DUoS + NEC)     [where net_demand_mw > 0]
export_rev  = |net_demand_mwh| × (price − GDUoS)        [where net_demand_mw ≤ 0]
thermal_cost = thermal_gen_mw × sp_duration_hrs × MC

baseline_net_gbp = import_cost + thermal_cost − export_rev
```

Net demand is negative when on-site generation exceeds site load. PV carries no fuel cost and is already embedded in net demand. Thermal (CHP/genset) fuel cost accrues regardless of import/export state.

**Site-level comparison:**
```
site_cost_without_bess = baseline_net_gbp.sum() + total_standing_gbp.sum()
site_cost_with_bess    = site_cost_without_bess − net_settlement_gbp.sum()
net_benefit            = net_settlement_gbp.sum()
```

### Network charges

Six DNOs are supported with 2025/26 published tariff rates, selectable at LV or HV:

| DNO | Coverage |
|---|---|
| UK Power Networks (UKPN) | South East, East, London |
| National Grid ED (NGED) | South West, East Midlands |
| Northern Powergrid (NPG) | North East, Yorkshire |
| Electricity North West (ENWL) | North West England |
| SP Energy Networks (SPEN) | Scotland, Merseyside |
| Scottish & Southern EN (SSEN) | North Scotland, South |

DUoS volumetric rates follow the RAG band structure with DNO-specific time windows. RAG band windows are pre-populated from DNO defaults and overridable in the Advanced settings panel. GDUoS credits mirror the band structure with a negative sign convention.

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
│  LandingPage → CsvConfigPage / ConfigPage                    │
│             → ProgressScreen → ResultsPage                   │
│  recharts · date-fns · inline styles                        │
└─────────────────────┬───────────────────────────────────────┘
                      │  REST (CORS-gated)
┌─────────────────────▼───────────────────────────────────────┐
│  FastAPI  ──────────────────────────────  Render            │
│  POST /run           → archetype optimisation job           │
│  POST /run/csv       → CSV upload optimisation job          │
│  GET  /run/{job_id}  → polls status + progress              │
│  GET  /export/{id}   → streams pre-built XLSX               │
│  GET  /dno-rates/{dno}/{voltage} → DNO tariff lookup        │
│                                                             │
│  ThreadPoolExecutor (max 2 concurrent jobs)                  │
│  In-memory job store (resets on restart)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  src/ — Python engine                                       │
│  data_builder / csv_pipeline → prices + charges → optimiser  │
│  PuLP + HiGHS MILP, 3-day chunks, SOC handoff               │
│  openpyxl write_only streaming → report                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Project structure

```
flexiq/
├── src/                        Core Python engine
│   ├── config.py               Site archetypes, BESS defaults, policy levies
│   ├── data_builder.py         Assembles per-SP optimiser input (archetype mode)
│   ├── csv_pipeline.py         CSV validation, RAG mapping, baseline (CSV mode)
│   ├── duos_rates.py           DNO tariff lookup — 6 DNOs, LV/HV, 2025/26 rates
│   ├── prices.py               Elexon BMRS pulls — MID (DA) + DISEBSP (imbalance)
│   ├── charges.py              DUoS/GDUoS RAG band logic + standing charges
│   ├── generation.py           Synthetic demand/PV/CHP profiles (archetype mode)
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
│       ├── run.py              POST /run · GET /run/{job_id} (archetype)
│       ├── run_csv.py          POST /run/csv (CSV multi-scenario loop)
│       └── export.py           GET /export/{job_id}
│
├── ui/                         React + Vite frontend
│   └── src/
│       ├── pages/
│       │   ├── LandingPage.jsx         Mode selection (CSV vs archetype)
│       │   ├── CsvConfigPage.jsx       CSV upload, BESS matrix, DNO config
│       │   ├── ConfigPage.jsx          Archetype config
│       │   ├── ProgressScreen.jsx      Polling progress display
│       │   └── ResultsPage.jsx         KPI cards, scenario table, 4 chart tabs
│       ├── components/
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
| **CSV mode demand** | Real site meter data — half-hourly or hourly. `net_demand_mw` must be the grid boundary meter reading, net of all on-site generation (PV, wind, thermal). |
| **Archetype demand** | Fully synthetic. Modelled from archetype parameters (peak/base/offpeak MW) with a deterministic intraday shape — not site-specific. |
| **Price foresight** | Perfect foresight — forecast equals actual. Results are an optimistic upper bound. |
| **DNO/tariff** | Six DNOs supported at LV and HV (2025/26 published rates). RAG band windows are per-DNO defaults, overridable in Advanced settings. |
| **Chunk size** | MILP solved in 3-day chunks with SOC continuity between chunks. |
| **Policy levies** | NEC (BSUoS, CfD, RO, CM, FiT) defaults to an indicative flat rate — overridable. EII-exempt sites can set a reduced NEC. |
| **Thermal generation** | Treated as a fixed input to the baseline. flexiq does not co-optimise BESS dispatch with dispatchable thermal assets. |
| **CHP fuel cost** | User-configurable marginal cost input; defaults to £70/MWh as a pre-feasibility benchmark. |
| **Degradation** | Flat £/MWh throughput cost, user-configurable (default £8/MWh). No cycle-depth or temperature curves. |
| **Efficiency** | One-way charge and discharge efficiency are independently configurable. Default: √RTE per side (symmetric split). |
| **SoC bounds** | Configurable min/max SOC (default 5–95%). End-of-chunk SOC target is initial SOC (50%) ± 10% of capacity. |
| **Scenario cap** | Max 12 scenarios per run (BESS configs × export limits). |
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

### V3 — Forecasting and degradation

- Substitute perfect foresight with a real DA price forecast (EPEXSpot auction results or a simple regression model)
- Cycle-depth aware degradation model replacing the flat £/MWh throughput cost
- Gas price input integration for dynamic CHP marginal cost

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
