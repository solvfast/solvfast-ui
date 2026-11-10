/**
 * Brand colours (0.7.0-dev.7) — a customer's primary and secondary colours as the theme's tokens, set inline on <html>
 * so they win over the theme's `.sf-theme` rules. Ported from Sayr (sear_product `lib/brandTheme.ts`); Sayr's server
 * writes the same tokens for pages outside its SPA (`engines/appearance.py` `css()`): keep the three in step.
 *
 * At the default colours nothing is set, so the design system's own look stays (its orange primary in dark included).
 * Needs the ThemeProvider's default `scope="document"`: the tokens go on <html>, not on an element scope.
 */
export interface BrandColors {
  primaryColor: string;
  secondaryColor: string;
}

export const DEFAULT_BRAND_COLORS: BrandColors = { primaryColor: "#512195", secondaryColor: "#25D0FE" };

const PRIMARY_TOKENS = ["--primary", "--primary-foreground", "--ring", "--brand-violet", "--btn-primary-bg", "--btn-primary-fg"];
const SECONDARY_TOKENS = ["--brand-sky", "--brand-cyan"];
const DARK_TEXT = "240 19% 10%";
const WHITE_TEXT = "0 0% 100%";

/** "#RRGGBB" → [hue, saturation %, lightness %], rounded as the theme's HSL tokens are written. */
export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, Math.round(l * 100)];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

/** Text on a colour by perceived brightness: dark on a light colour, else white. */
function textOn(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.6 ? DARK_TEXT : WHITE_TEXT;
}

/** The tokens for a brand (empty for the default colours). A dark primary is lifted to 60% lightness in dark mode. */
export function brandTokens(brand: BrandColors, isDark: boolean, defaults: BrandColors = DEFAULT_BRAND_COLORS): Record<string, string> {
  const tokens: Record<string, string> = {};
  const primary = brand.primaryColor.toUpperCase();
  if (primary !== defaults.primaryColor.toUpperCase()) {
    const [h, s, l] = hexToHsl(primary);
    const value = `${h} ${s}% ${isDark ? Math.max(l, 60) : l}%`;
    const fg = isDark && l < 60 ? DARK_TEXT : textOn(primary);
    Object.assign(tokens, {
      "--primary": value, "--ring": value, "--brand-violet": value, "--primary-foreground": fg,
      "--btn-primary-bg": `hsl(${value})`, "--btn-primary-fg": `hsl(${fg})`,
    });
  }
  const secondary = brand.secondaryColor.toUpperCase();
  if (secondary !== defaults.secondaryColor.toUpperCase()) {
    const [h, s, l] = hexToHsl(secondary);
    for (const t of SECONDARY_TOKENS) tokens[t] = `${h} ${s}% ${l}%`;
  }
  return tokens;
}

/** Sets the brand's tokens on <html> and removes the ones a previous brand set but this one does not. */
export function applyBrandTheme(brand: BrandColors, isDark: boolean, defaults: BrandColors = DEFAULT_BRAND_COLORS): void {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  const tokens = brandTokens(brand, isDark, defaults);
  for (const t of [...PRIMARY_TOKENS, ...SECONDARY_TOKENS]) {
    if (tokens[t] === undefined) style.removeProperty(t);
    else style.setProperty(t, tokens[t]);
  }
}
