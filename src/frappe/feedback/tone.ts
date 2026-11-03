/** msgprint `indicator` colours (docs 14 §B3) → design-system tones. Default blue = informational. */
export type Tone = "info" | "success" | "warning" | "destructive" | "default";
export function indicatorTone(indicator?: string): Tone {
  switch ((indicator || "blue").toLowerCase()) {
    case "green": return "success";
    case "orange": case "yellow": return "warning";
    case "red": return "destructive";
    case "gray": case "grey": case "darkgrey": return "default";
    default: return "info";
  }
}
export const TONE_DOT: Record<Tone, string> = {
  info: "bg-info", success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", default: "bg-muted-foreground",
};
