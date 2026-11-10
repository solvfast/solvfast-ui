/** Keeps the brand tokens in step with the brand and the ThemeProvider's light/dark (0.7.0-dev.7). Renders nothing. */
import * as React from "react";
import { applyBrandTheme, DEFAULT_BRAND_COLORS, type BrandColors } from "./brand";
import { useTheme } from "./ThemeProvider";

export interface BrandThemeProps {
  brand: BrandColors;
  /** The colours that mean "no brand": at these nothing is set. Default `DEFAULT_BRAND_COLORS` (Sayr's). */
  defaults?: BrandColors;
}

export function BrandTheme({ brand, defaults = DEFAULT_BRAND_COLORS }: BrandThemeProps) {
  const { isDark } = useTheme();
  const { primaryColor, secondaryColor } = brand;
  React.useLayoutEffect(
    () => applyBrandTheme({ primaryColor, secondaryColor }, isDark, defaults),
    [primaryColor, secondaryColor, isDark, defaults],
  );
  return null;
}
