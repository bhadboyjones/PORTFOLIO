# CSV Ingestion: Units and Granularity

*Reference for `src/csv_pipeline.py::load_and_validate_csv` and the upload
screen in `ui/src/pages/CsvConfigPage.jsx`. Verified against code 2026-10-04.*

---

## 1. What the model works in

The engine works in **average MW per interval** throughout. Energy is derived
by multiplying by the interval length:

```
MWh = MW × sp_duration_hrs        (src/csv_pipeline.py: net_demand_mwh)
```

Power is needed as well as energy, because the battery is rated in MW and
every half-hour the optimiser compares power with power:

- discharge to offset site import ≤ min(site demand MW, battery power MW)
- grid charging ≤ import cap MW − site demand MW
- battery export ≤ export limit MW

## 2. Granularity is detected; units are declared

**Granularity (interval length)** is detected from the data: the median gap
between timestamps must be 30 or 60 minutes, which sets `sp_duration_hrs` to
0.5 or 1.0. Median rather than mean, so a file with holes still detects
correctly. Anything else (e.g. 15-minute data) is rejected.

**Units cannot be detected** — 0.5 could be MW or MWh per half-hour. The user
declares them with `input_unit` on upload:

| `input_unit` | Meaning | Conversion to average MW |
|---|---|---|
| `mw` (default) | average MW per interval | × 1 |
| `kw` | average kW per interval | ÷ 1000 |
| `mwh` | MWh per interval | ÷ sp_duration_hrs |
| `kwh` | kWh per interval | ÷ (1000 × sp_duration_hrs) |

Conversion runs straight after resolution detection and NaN filling, and is
applied to both `net_demand_mw` and `thermal_gen_mw`. The kW/MW magnitude
sanity check then runs on the converted values.

Worked example, half-hourly data:

```
uploaded 0.5 MWh  →  0.5 ÷ 0.5 = 1.0 MW  →  costs use 1.0 × 0.5 = 0.5 MWh  ✓
```

## 3. The bug this fixed (2026-10-04)

Before `input_unit` existed, every upload was read as average MW. Meters export
energy per interval, so a half-hourly MWh upload was multiplied by 0.5 again:

```
0.5 MWh read as 0.5 MW  →  0.5 × 0.5 = 0.25 MWh   (half the truth)
```

Every energy, cost, saving and peak came out at 50%, and the battery looked
oversized against the site. Hourly MWh was correct by coincidence (÷ 1 hour).
The bundled test CSVs are in MW (written from the archetype model), which is
why tests never caught it.

The API default stays `mw` so existing callers are unchanged; the upload screen
shows the unit selector directly under the file drop zone.

## 4. Known limitations

- **15-minute data is rejected.** Some meter and PV exports are 15-minute (e.g.
  the 2024–25 solar workbook). Needs resampling to 30-minute before upload, or a
  resample step in the pipeline. Queued.
- **Power factor is assumed 1.** Contracted kVA is converted to MW by ÷ 1000.
  Peak shaving work will add a PF input or use metered kVArh.
- **Single unit per file.** Both columns share `input_unit`.
