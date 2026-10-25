import { useState } from "react";
import Card from "./Card";
import Tabs from "../Tabs";
import DispatchProfileChart from "../DispatchProfileChart";
import RevenueStackChart from "../RevenueStackChart";
import CumulativePnlChart from "../CumulativePnlChart";
import { aggregateDaily, dailyCumulative } from "../../lib/results";

const TABS = ["Half-hourly dispatch", "Daily value", "Saving to date"];

// The backtest in detail for the selected scenario. Each tab's CSV is the
// full data behind it, not just the visible window.
export default function OperationDetail({ scenario, label }) {
  const [tab, setTab] = useState(0);
  const ts = scenario?.dispatch_timeseries ?? [];

  const csv = [
    {
      filename: "flexiq-dispatch.csv",
      rows: ts,
      columns: [["startTime", "Time (UK)"], ["dis1_mw", "Demand offset (MW)"], ["dis2_mw", "Export (MW)"], ["charge1_mw", "Surplus charging (MW)"], ["charge2_mw", "Grid charging (MW)"], ["soc_mwh", "State of charge (MWh)"]],
    },
    {
      filename: "flexiq-daily-value.csv",
      rows: aggregateDaily(ts),
      columns: [["date", "Date"], ["demand", "Demand offset saving (GBP)"], ["export", "Export revenue (GBP)"], ["gridCharge", "Grid charging cost (GBP)"], ["surplus", "Export given up (GBP)"], ["wear", "Battery wear (GBP)"], ["net", "Net (GBP)"]],
    },
    {
      filename: "flexiq-saving-to-date.csv",
      rows: dailyCumulative(ts),
      columns: [["date", "Date"], ["cumulative", "Backtest saving to date (GBP)"]],
    },
  ][tab];

  return (
    <Card id="ops" title="The backtest in detail" subtitle={`${label}. Perfect price foresight over your data.`} csv={csv}>
      <Tabs tabs={TABS} active={tab} onSelect={setTab} label="Backtest detail">
        {tab === 0 && <DispatchProfileChart key={label} scenario={scenario} />}
        {tab === 1 && <RevenueStackChart scenario={scenario} />}
        {tab === 2 && <CumulativePnlChart scenario={scenario} />}
      </Tabs>
    </Card>
  );
}
