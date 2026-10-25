// JS mirror of the CSS tokens in src/index.css; keep in sync.
// SVG fills stay literal hex (var() breaks Legend swatch interop).
//
// Fixed data palette: every value stream and DUoS band has ONE colour,
// used on every chart that shows it. Chrome stays ink and grey.

export const CHART_COLORS = {
  data:     "#1d5fbf", // the one chart hue: the screen's main data element
  ink:      "#141414",
  grey:     "#8a8a8a",
  lightGrey:"#c4c4c4",
  positive: "#2e7d32",
  negative: "#c4242a",
  grid:     "#e5e5e5",
  refLine:  "#8a8a8a",
  axisText: "#5f6368",
  panel:    "#ffffff",
  paper:    "#0a0a0a",
  // legacy names still referenced by older chart code
  signal:   "#1d5fbf",
  charge:   "#8a8a8a",
  soc:      "#141414",
  muted:    "#8a8a8a",
};

// One colour per value stream, on every chart.
export const STREAM_COLORS = {
  demandOffset: "#1d5fbf", // dis1: battery serves site demand (avoided import)
  export:       "#0f766e", // dis2: battery exports to grid
  gridCharge:   "#8a8a8a", // charge2: charging from the grid (a cost)
  surplusCharge:"#c4c4c4", // charge1: charging from on-site surplus
  wear:         "#141414", // degradation cost
  soc:          "#141414", // state of charge line
};

export const STREAM_LABELS = {
  demandOffset: "Demand offset",
  export:       "Export",
  gridCharge:   "Grid charging",
  surplusCharge:"Surplus charging",
  wear:         "Battery wear",
};

// DUoS time bands: data colours, only where a band is shown.
export const BAND_COLORS = {
  red:   "#c4242a",
  amber: "#b7791f",
  green: "#2e7d32",
};

// Export-limit lines on the savings-vs-size chart: ink, then the one hue,
// then greys. Never more than four.
export const SERIES = ["#1d5fbf", "#141414", "#8a8a8a", "#c4c4c4"];

export const tooltipProps = {
  contentStyle: {
    background: CHART_COLORS.panel,
    border: `1px solid ${CHART_COLORS.grid}`,
    borderRadius: 6,
    color: CHART_COLORS.paper,
    fontSize: 13,
    fontVariantNumeric: "tabular-nums",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },
  labelStyle: { color: CHART_COLORS.axisText, marginBottom: 4 },
  itemStyle: { color: CHART_COLORS.paper },
  isAnimationActive: false,
};

export const axisTick = { fill: CHART_COLORS.axisText, fontSize: 12 };
export const axisLineProps = { stroke: CHART_COLORS.grid };
export const gridProps = { stroke: CHART_COLORS.grid, vertical: false };
export const legendStyle = { fontSize: 12, color: CHART_COLORS.axisText };

// Charts draw at once: app screens perform no entrance.
export const seriesAnimation = () => ({ isAnimationActive: false });

// shared styles for the HTML controls above charts (DOM, so var() is fine)
export const controlStyles = {
  select: {
    height: 32,
    padding: "0 8px",
    border: "1px solid var(--control)",
    borderRadius: 6,
    fontSize: 14,
    background: "var(--surface)",
    color: "var(--ink)",
  },
  input: {
    height: 32,
    padding: "0 8px",
    border: "1px solid var(--control)",
    borderRadius: 6,
    fontSize: 14,
    background: "var(--surface)",
    color: "var(--ink)",
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--ink)",
    display: "block",
    marginBottom: 8,
  },
};
