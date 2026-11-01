# flexiq feature logic docs

One document per feature, written for the app owner: what the code does, the
maths, where each number comes from (cited to `file:line`), and what is known to
be wrong. Read these before explaining a feature to anyone.

| Doc | Covers | Status |
|---|---|---|
| [roadmap.md](roadmap.md) | Build order, feature designs, queued items, data inventory | Plan as of 2026-10-04 |
| [investment_case.md](investment_case.md) | NPV, IRR, payback, BCR, foresight haircut, wear add-back | Built |
| [csv_ingestion.md](csv_ingestion.md) | Upload units, granularity detection | Built (unit fix 2026-10-04) |
| [site_bill.md](site_bill.md) | Modelled site bill: lines, sources and how it ties to the settlement | Built 2026-11-01 |
| [tariff_types.md](tariff_types.md) | Energy pricing types, bundled charges, export contracts and how each changes dispatch | Built 2026-11-01 |
| [peak_shaving.md](peak_shaving.md) | MIC and power factor inputs, breach pricing, excess settlement, MIC sweep and results | Slices 1 to 4 built by 2026-11-01 |
| [ui_ledger.md](ui_ledger.md) | Ledger UI redesign: tokens, fixed data palette, results logic (lead figure, bill maths, best vs selected), upload echo, accessibility | Built 2026-10-25 |
| [worked_examples.md](worked_examples.md) | Every figure derived step by step: import and export rates, negative prices, round-trip profit, `opp`, the open bug, the site bill | Study notes, started 2026-11-01 |
