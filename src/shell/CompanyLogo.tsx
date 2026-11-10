/**
 * Company logo (0.7.0-dev.7) — the customer's logo (Sayr: System Settings › Appearance). `darkSrc` is used in the dark
 * theme when given, e.g. a light-text variant of a default logo; an uploaded logo usually has none.
 */
import { cn } from "../lib/cn";
import { useTheme } from "../theme/ThemeProvider";

export interface CompanyLogoProps {
  src: string;
  darkSrc?: string | null;
  /** Accessible name; default "" (decorative, next to a title). */
  alt?: string;
  className?: string;
}

export function CompanyLogo({ src, darkSrc, alt = "", className }: CompanyLogoProps) {
  const { isDark } = useTheme();
  return <img src={isDark && darkSrc ? darkSrc : src} alt={alt} className={cn("w-auto object-contain", className)} />;
}
