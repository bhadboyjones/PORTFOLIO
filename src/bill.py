"""
Modelled site bill: one scenario as bill lines, without and with the battery.

Every line is quantity × rate = £ over the data period, and the totals tie back
to the settlement: bill without − TNUoS = site_cost_wo_bess, and
bill with + wear − TNUoS = site_cost_w_bess. See docs/site_bill.md.
"""

from typing import Any, Dict, List, Optional

import pandas as pd

from .config import NEC_COMPONENTS, NEC_GBP_MWH

# NESO TCR residual bands, 2026/27, £/site/day (docs/gb-network-charging).
TNUOS_BANDS = {
    "LV": [(90, "LV1", 5.7974), (150, "LV2", 11.5118), (250, "LV3", 14.3814), (float("inf"), "LV4", 38.1801)],
    "HV": [(500, "HV1", 31.8390), (1100, "HV2", 117.1528), (2000, "HV3", 185.4185), (float("inf"), "HV4", 528.9123)],
}

VAT_RATE = 0.20

_NEC_LABELS = {
    "policy_levies_gbp_mwh": "Renewables and CfD levies",
    "cm_gbp_mwh": "Capacity Market",
    "bsuos_gbp_mwh": "BSUoS",
    "ccl_gbp_mwh": "Climate Change Levy",
}
_BANDS = ("red", "amber", "green")


def tnuos_band(voltage: str, mic_kva: float) -> Dict[str, Any]:
    """Residual band by voltage and agreed capacity. Unknown voltage reads as LV."""
    table = TNUOS_BANDS.get(str(voltage).upper(), TNUOS_BANDS["LV"])
    for limit, name, gbp_per_day in table:
        if mic_kva <= limit:
            return {"band": name, "gbp_per_day": gbp_per_day}
    raise ValueError(f"No TNUoS band for {mic_kva} kVA")


def _line(label, unit, qty_wo, qty_w, cost_wo, cost_w, **extra) -> Dict[str, Any]:
    """A bill line. Rate is implied, so a varying half-hourly price shows its average."""
    return {
        "label": label, "unit": unit,
        "qty_wo": round(float(qty_wo), 3), "qty_w": round(float(qty_w), 3),
        "cost_wo": round(float(cost_wo), 2), "cost_w": round(float(cost_w), 2),
        **extra,
    }


def _included(label: str) -> Dict[str, Any]:
    return {"label": label, "included": True, "cost_wo": 0.0, "cost_w": 0.0}


def build_bill(
    settled: pd.DataFrame,
    actual_col: str,
    tariff: Dict[str, Any],
    voltage: str,
    mic_kva: float,
    coverage_days: float,
    sp_duration_hrs: float = 0.5,
    capacity_breaches: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Build the bill for one settled scenario. Amounts cover the data period."""
    s = settled
    h = sp_duration_hrs
    import_wo = s["net_demand_mwh"].clip(lower=0)
    import_w = import_wo - s["dis1_mw"] * h + s["charge2_mw"] * h
    price = s[actual_col]

    sections = []

    # Energy: one line per fixed rate, otherwise one per DUoS band.
    energy = []
    if tariff["energy_type"] in ("flat", "time_bands"):
        groups = price.round(4)
        labels = {v: "Energy" for v in sorted(groups.unique())}
        if len(labels) > 1:
            labels = {v: f"Energy at {v / 10:.2f}p/kWh" for v in labels}
    else:
        groups = s["rag_band"]
        labels = {b: f"Energy, {b} hours" for b in _BANDS}
    for key in labels:
        mask = groups == key
        if mask.any():
            energy.append(_line(
                labels[key], "kWh", import_wo[mask].sum() * 1000, import_w[mask].sum() * 1000,
                (import_wo * price)[mask].sum(), (import_w * price)[mask].sum(),
            ))
    sections.append({"title": "Energy", "lines": energy})

    # Network charges
    network = []
    if tariff["duos_bundled"]:
        network.append(_included("DUoS and TNUoS"))
    else:
        for b in _BANDS:
            mask = s["rag_band"] == b
            if mask.any():
                rate = s["duos_gbp_mwh"]
                network.append(_line(
                    f"DUoS, {b} band", "kWh", import_wo[mask].sum() * 1000, import_w[mask].sum() * 1000,
                    (import_wo * rate)[mask].sum(), (import_w * rate)[mask].sum(),
                ))
        fixed = s["dduos_fixed_gbp_per_sp"].sum()
        network.append(_line("DUoS fixed charge", "days", coverage_days, coverage_days, fixed, fixed))
    capacity = s["dduos_capacity_gbp_per_sp"].sum()
    kva_days = mic_kva * coverage_days
    if tariff["capacity_bundled"]:
        network.append(_included("Capacity and excess capacity"))
    else:
        network.append(_line("Capacity", "kVA-days", kva_days, kva_days, capacity, capacity))
        months = capacity_breaches or []
        ex_wo = sum(m["excess_wo_bess_gbp"] for m in months)
        ex_w = sum(m["excess_w_bess_gbp"] for m in months)
        if ex_wo > 0 or ex_w > 0:
            qty = lambda k: sum(max(m[k] - m["mic_kva"], 0) * m["days"] for m in months)
            network.append(_line("Excess capacity", "kVA-days", qty("worst_wo_bess_kva"), qty("worst_w_bess_kva"), ex_wo, ex_w))
    band = tnuos_band(voltage, mic_kva)
    tnuos = 0.0
    if not tariff["duos_bundled"]:
        tnuos = band["gbp_per_day"] * coverage_days
        network.append(_line(f"TNUoS residual, band {band['band']}", "days", coverage_days, coverage_days, tnuos, tnuos))
    sections.append({"title": "Network charges", "lines": network})

    # Policy and system: the entered non-energy total, split in the default shares.
    policy = []
    nec = s["nec_gbp_mwh"]
    if tariff["policy_bundled"]:
        policy.append(_included("Policy and system charges"))
    else:
        for key, label in _NEC_LABELS.items():
            share = NEC_COMPONENTS[key] / NEC_GBP_MWH
            policy.append(_line(
                label, "kWh", import_wo.sum() * 1000, import_w.sum() * 1000,
                (import_wo * nec).sum() * share, (import_w * nec).sum() * share,
            ))
    sections.append({"title": "Policy and system", "lines": policy})

    # Export credits and on-site fuel
    limit_mwh = float(s["export_limit_mw"].iloc[0]) * h if "export_limit_mw" in s else 0.0
    surplus = (-s["net_demand_mwh"]).clip(lower=0)
    export_wo = surplus.clip(upper=limit_mwh)
    curtailable = (surplus / h - limit_mwh / h).clip(lower=0)
    lost = (s["charge1_mw"] - curtailable).clip(lower=0) * h
    export_w = export_wo - lost + s["dis2_mw"] * h
    export_price = s["export_actual_gbp"] if "export_actual_gbp" in s else price
    credits = []
    if export_wo.sum() > 0 or export_w.sum() > 0:
        credits.append(_line(
            "Export energy", "kWh", export_wo.sum() * 1000, export_w.sum() * 1000,
            -(export_wo * export_price).sum(), -(export_w * export_price).sum(),
        ))
        gduos = s["gduos_gbp_mwh"]
        if (gduos != 0).any():
            credits.append(_line(
                "GDUoS export credit", "kWh", export_wo.sum() * 1000, export_w.sum() * 1000,
                (export_wo * gduos).sum(), (export_w * gduos).sum(),
            ))
    gduos_fixed = s["gduos_fixed_gbp_per_sp"].sum()
    if gduos_fixed:
        credits.append(_line("Export fixed charge", "days", coverage_days, coverage_days, gduos_fixed, gduos_fixed))
    fuel = float(s["baseline_thermal_cost_gbp"].sum())
    if fuel > 0.5:
        credits.append({"label": "On-site generation fuel", "cost_wo": round(fuel, 2), "cost_w": round(fuel, 2)})
    if credits:
        sections.append({"title": "Exports and on-site", "lines": credits})

    total_wo = sum(l["cost_wo"] for sec in sections for l in sec["lines"])
    total_w = sum(l["cost_w"] for sec in sections for l in sec["lines"])
    wear = float(s["deg_cost_gbp"].sum())
    excess_saved = float(s["excess_wo_bess_gbp"].sum() - s["excess_w_bess_gbp"].sum()) if "excess_wo_bess_gbp" in s else 0.0
    return {
        "sections": sections,
        "total_wo_gbp": round(total_wo, 2),
        "total_w_gbp": round(total_w, 2),
        "tnuos_gbp": round(tnuos, 2),
        "vat_rate": VAT_RATE,
        "mic_kva": round(mic_kva, 1),
        "tnuos_band": band["band"],
        "battery": {
            "saved_gbp": round(float(s["dis1_saving_gbp"].sum() + s["dis2_revenue_gbp"].sum()), 2),
            "charging_gbp": round(float(s["charge2_cost_gbp"].sum() + s["charge1_opp_cost_gbp"].sum()), 2),
            "excess_saved_gbp": round(excess_saved, 2),
            "wear_gbp": round(wear, 2),
            "net_gbp": round(float(s["net_settlement_gbp"].sum()), 2),
        },
    }
