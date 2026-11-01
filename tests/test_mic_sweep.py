"""Peak shaving slice 3: MIC candidates and the value of each."""

from src.mic_sweep import mic_candidates, mic_value


def test_candidates_step_down_from_peak_by_battery_share():
    c = mic_candidates(peak_kva=1000.0, power_mw=0.4, power_factor=1.0, current_kva=2000.0)
    assert [x["mic_kva"] for x in c] == [1000.0, 900.0, 800.0, 700.0, 600.0]


def test_candidates_at_or_above_the_current_mic_are_dropped():
    # Peak 1,000 kVA, MIC 850: only cuts below 850 can save anything.
    c = mic_candidates(peak_kva=1000.0, power_mw=0.4, power_factor=1.0, current_kva=850.0)
    assert [x["mic_kva"] for x in c] == [800.0, 700.0, 600.0]


def test_battery_kva_uses_power_factor():
    c = mic_candidates(peak_kva=1000.0, power_mw=0.4, power_factor=0.8, current_kva=2000.0)
    assert c[-1]["mic_kva"] == 500.0   # 400 kW ÷ 0.8 = 500 kVA


def test_candidates_never_reach_zero():
    c = mic_candidates(peak_kva=100.0, power_mw=1.0, power_factor=1.0, current_kva=500.0)
    assert all(x["mic_kva"] > 0 for x in c)


def test_value_worked_number():
    # Cut 200 kVA at £0.0382/kVA/day for 365 days: capacity saved £2,788.60.
    # Dispatch falls £500; excess rises £100. Value = 2,788.60 − 500 − 100.
    now = dict(mic_kva=1000.0, dispatch_gbp=30000.0, excess_gbp=0.0)
    cut = dict(mic_kva=800.0, dispatch_gbp=29500.0, excess_gbp=100.0, share=0.5, months_breached=1)
    v = mic_value(now, cut, 0.0382, 365)
    assert v["capacity_saved_gbp"] == 2788.6
    assert v["value_gbp"] == 2188.6
    assert v["months_breached"] == 1
