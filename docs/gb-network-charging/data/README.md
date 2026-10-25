# Tariff data

Transcribed from primary documents. See `../README.md` section 10 for full sources
and section 11 for caveats.

## tnuos-tcr-residual-bands-2026-27.csv

NESO Published Tables, Table TB, January 2026. Charging year 2026/27.

Units are **£/site/day**, not pence. Reading them as pence understates by 100 times.
Band thresholds are fixed for the whole of RIIO-ET3, to 2030/31.

This charge does not respond to load shifting. It is set by connection capacity and
voltage. The only lever is crossing a band boundary by changing agreed capacity.

## duos-lv-site-specific-band2-fixed-charge.csv

DNO LC14 Use of System charging statements, all 14 GB licence areas.

Units are **pence per MPAN per day**. LV site-specific, residual Band 2 only. Other
bands, voltages and tariff components are not included.

Four areas show 0.00 for 2026/27, which is a published zero rather than missing
data. Percentage change is undefined for those. Use the absolute values.
