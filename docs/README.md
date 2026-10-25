# flexiq feature logic docs

One document per feature, written for the app owner: what the code does, the
maths, where each number comes from (cited to `file:line`), and what is known to
be wrong. Read these before explaining a feature to anyone.

| Doc | Covers | Status |
|---|---|---|
| [roadmap.md](roadmap.md) | Build order, feature designs, queued items, data inventory | Plan as of 2026-10-04 |
| [investment_case.md](investment_case.md) | NPV, IRR, payback, BCR, foresight haircut, wear add-back | Built |
| [csv_ingestion.md](csv_ingestion.md) | Upload units, granularity detection | Built (unit fix 2026-10-04) |
| [peak_shaving.md](peak_shaving.md) | MIC + power factor inputs, import cap, no simultaneous charge/discharge; slice 2–4 design | Slice 1 built 2026-10-25 |
| [ui_ledger.md](ui_ledger.md) | Ledger UI redesign: tokens, fixed data palette, results logic (lead figure, bill maths, best vs selected), upload echo, accessibility | Built 2026-10-25 |
