import { feedbackTone } from "../services/indicator";
/** msgprint `indicator` colours (docs 14 §B3) → design-system tones. Default blue = informational. */
export type Tone = "info" | "success" | "warning" | "destructive" | "default";
/** Thin alias of the single colour→tone map (`services/indicator.ts`). */
export function indicatorTone(indicator?: string): Tone { return feedbackTone(indicator); }
export const TONE_DOT: Record<Tone, string> = {
  info: "bg-info", success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", default: "bg-muted-foreground",
};
