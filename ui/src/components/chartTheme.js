// JS mirror of the CSS tokens in src/index.css — keep in sync.
// SVG fills stay literal hex (var() breaks Legend swatch interop).

export const CHART_COLORS = {
  signal:   "#00C8E8",
  positive: "#00E5A0",
  charge:   "#FFB03A",
  negative: "#FF5577",
  soc:      "#B48EFE",
  muted:    "#4A6B8C",
  grid:     "#24344F",
  refLine:  "#2E4266",
  axisText: "#8FA9C9",
  panel:    "#121C30",
  paper:    "#E6EEF8",
};

export const SERIES = [CHART_COLORS.signal, CHART_COLORS.positive, CHART_COLORS.charge];

export const tooltipProps = {
  contentStyle: {
    background: CHART_COLORS.panel,
    border: `1px solid ${CHART_COLORS.grid}`,
    borderRadius: 6,
    color: CHART_COLORS.paper,
    fontSize: "0.82rem",
    fontVariantNumeric: "tabular-nums",
  },
  labelStyle: { color: CHART_COLORS.axisText, marginBottom: 4 },
  itemStyle: { color: CHART_COLORS.paper },
  isAnimationActive: false, // tooltip chase reads as lag on dense HH data
};

export const axisTick = { fill: CHART_COLORS.axisText, fontSize: 11 };
export const axisLineProps = { stroke: CHART_COLORS.grid };
export const gridProps = { strokeDasharray: "3 3", stroke: CHART_COLORS.grid };
export const legendStyle = { fontSize: 12, color: CHART_COLORS.axisText };

export const seriesAnimation = (reduced) => ({
  isAnimationActive: !reduced,
  animationDuration: 500,
  animationEasing: "ease-out", // Recharts only accepts preset strings
});

// shared styles for the HTML controls above charts (DOM, so var() is fine)
export const controlStyles = {
  select: {
    padding: "0.35rem 0.6rem",
    border: "1px solid var(--border)",
    borderRadius: 5,
    fontSize: "0.82rem",
    background: "var(--bg-surface)",
    color: "var(--text-pri)",
  },
  input: {
    padding: "0.35rem 0.6rem",
    border: "1px solid var(--border)",
    borderRadius: 5,
    fontSize: "0.82rem",
    background: "var(--bg-surface)",
    color: "var(--text-pri)",
  },
  fieldLabel: {
    fontSize: "0.72rem",
    fontWeight: 700,
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    display: "block",
    marginBottom: 6,
  },
};
