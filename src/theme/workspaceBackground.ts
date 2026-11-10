/**
 * Workspace background (0.7.0-dev.7) — Sayr's System Settings › Appearance background: colour spots, a blended or a
 * solid tint, or a toned-down photo. Ported from Sayr (sear_product, the home screen's `workspaceBackground.ts`); Sayr's server
 * writes the same layers for pages outside its SPA (`engines/appearance.py` `css()`): keep the three in step.
 */
import type * as React from "react";

export type WorkspaceBackgroundMode = "color" | "image";
export type WorkspaceBackgroundStyle = "spots" | "blended" | "solid";

export interface WorkspaceBackground {
  mode: WorkspaceBackgroundMode;
  style: WorkspaceBackgroundStyle;
  /** Up to `BACKGROUND_MAX_COLORS` "#RRGGBB" colours. */
  colors: string[];
  /** 0–`BACKGROUND_INTENSITY_CAP` (percent opacity of the colours). */
  intensity: number;
  /** A same-site image URL, used when `mode` is "image". */
  image: string | null;
  /** 1 = the photo is blurred and dimmed more, so content stays readable. */
  auto_tame: 0 | 1;
}

export const BACKGROUND_INTENSITY_CAP = 35;
export const BACKGROUND_MAX_COLORS = 6;
const LIGHT_BASE = "#f0f1f6";
const DARK_BASE = "#0e0e16";
const SPOT_POSITIONS = ["7% 5%", "93% 10%", "14% 94%", "88% 90%", "50% 0%", "48% 100%"];

const hexToRgb = (hex: string): [number, number, number] => {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgba = (hex: string, a: number) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

/** The CSS `background` of a colour background; `base` replaces the opaque base colour (e.g. "transparent"). */
export function colorBackground(bg: WorkspaceBackground, isDark: boolean, base = isDark ? DARK_BASE : LIGHT_BASE): string {
  const a = Math.min(BACKGROUND_INTENSITY_CAP, bg.intensity || 0) / 100;
  const cols = bg.colors.length ? bg.colors : ["#512195"];
  if (bg.style === "solid") {
    const c = cols[0];
    return `linear-gradient(180deg, ${rgba(c, Math.min(0.35, a + 0.05))} 0%, ${rgba(c, a)} 100%), ${base}`;
  }
  if (bg.style === "blended") {
    const list = cols.length >= 2 ? cols : [cols[0], cols[0]];
    const stops = list.map((c, i) => `${rgba(c, a)} ${Math.round((i / (list.length - 1)) * 100)}%`).join(", ");
    return `linear-gradient(100deg, ${stops}), ${base}`;
  }
  const spots = cols.map((c, i) => `radial-gradient(560px 460px at ${SPOT_POSITIONS[i % SPOT_POSITIONS.length]}, ${rgba(c, a)}, transparent 48%)`).join(", ");
  return `${spots}, ${base}`;
}

/** The photo layer: always toned down; auto-tame decides how much. The URL is quoted (names may hold spaces or brackets). */
export function imageLayerStyle(bg: WorkspaceBackground, isDark: boolean): React.CSSProperties {
  return {
    backgroundImage: `url(${JSON.stringify(bg.image ?? "")})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: bg.auto_tame
      ? `blur(12px) saturate(0.45) brightness(${isDark ? 0.55 : 0.95})`
      : `blur(5px) saturate(0.75) brightness(${isDark ? 0.7 : 1})`,
    transform: "scale(1.12)",
  };
}

/** The wash over the photo. */
export function imageOverlayStyle(bg: WorkspaceBackground, isDark: boolean): React.CSSProperties {
  const a = bg.auto_tame ? (isDark ? 0.55 : 0.5) : (isDark ? 0.38 : 0.32);
  return { background: isDark ? `rgba(10,10,14,${a})` : `rgba(247,246,250,${a})` };
}

export const isImageBackground = (bg: WorkspaceBackground) => bg.mode === "image" && !!bg.image;

export interface BackgroundPreset {
  id: string;
  en: string;
  ar: string;
  style: WorkspaceBackgroundStyle;
  colors: string[];
  intensity: number;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "default", en: "Default", ar: "الافتراضي", style: "spots", colors: ["#25D0FE", "#11BF9D", "#512195", "#FE4E18"], intensity: 12 },
  { id: "aurora", en: "Aurora", ar: "الشفق", style: "blended", colors: ["#25D0FE", "#11BF9D", "#7C5CFF"], intensity: 24 },
  { id: "ocean", en: "Ocean", ar: "المحيط", style: "blended", colors: ["#2563EB", "#22D3EE", "#0EA5E9"], intensity: 22 },
  { id: "scatter", en: "Scatter", ar: "مبعثر", style: "spots", colors: ["#FE4E18", "#512195", "#25D0FE", "#11BF9D"], intensity: 30 },
  { id: "sunset", en: "Sunset", ar: "الغروب", style: "blended", colors: ["#FE4E18", "#FF9166", "#C026D3"], intensity: 26 },
  { id: "single", en: "Single tone", ar: "لون واحد", style: "solid", colors: ["#512195", "#7C5CFF"], intensity: 20 },
];

export const presetBackground = (p: BackgroundPreset): WorkspaceBackground => ({
  mode: "color", style: p.style, colors: [...p.colors], intensity: p.intensity, image: null, auto_tame: 1,
});

/** Sayr's default: the "Default" preset. */
export const DEFAULT_WORKSPACE_BACKGROUND: WorkspaceBackground = presetBackground(BACKGROUND_PRESETS[0]);
