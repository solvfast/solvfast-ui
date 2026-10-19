/**
 * @solvfast/ui/chart — the Design System's chart helpers on recharts. Requires `recharts` 2 (^2.15, an optional peer
 * dependency): the app and this entry share one copy, so charts are built from the app's own recharts components
 * inside <ChartContainer>. The core entry never imports this.
 */
export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle } from "./chart";
export type { ChartConfig } from "./chart";
