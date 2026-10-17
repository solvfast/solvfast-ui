/**
 * Two number cards.
 *
 * - `StatCard`: the Design System's stat card (DS v0.3.0 `92fc1cd`, StyleGuide section `data`, "Data display — stat
 *   cards"). Liquid glass, a label, a large value and an optional trend pill. Markup and classes as in the DS.
 * - `IconStatCard`: the card on Sear Studio's overview page (Sear `7abc895`, `sear_studio/components/overview/
 *   DefinitionsGrid.tsx` with `IconSquare` from `overviewShared.tsx`). The container pane, a tinted icon square,
 *   a name and a total. Markup and classes as in Sear.
 *
 * Both render a `<div>`. With `href` they render an `<a>`; with only `onClick`, a `<button>`. The package never
 * navigates: with a client-side router, handle `onClick` (preventDefault, then navigate) and keep `href` so the card
 * still opens in a new tab. Numbers are formatted for the language (Arabic: ar-EG digits), as in Sear; strings pass
 * through.
 */
import * as React from "react";
import { Layers, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { loc, type Localized } from "../lib/localized";
import { useLocale } from "../theme/ThemeProvider";
import type { Language } from "../theme/messages";

const fmt = (v: number | string, language: Language) =>
  typeof v === "number" ? v.toLocaleString(language === "ar" ? "ar-EG" : "en-US") : v;

interface CardAction {
  /** Render the card as a link. */
  href?: string;
  /** Click handler; without `href` the card renders as a button. */
  onClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  className?: string;
}

/** `<a>` with href, `<button>` with only onClick, else `<div>` (exactly the source markup). */
function CardRoot({ href, onClick, base, interactive, className, children }: CardAction & {
  base: string; interactive?: string; children: React.ReactNode;
}) {
  const focus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  if (href != null) {
    return <a href={href} onClick={onClick} className={cn(base, "block", focus, interactive, className)}>{children}</a>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={cn(base, "block w-full text-start", focus, interactive, className)}>{children}</button>;
  }
  return <div className={cn(base, className)}>{children}</div>;
}

export interface StatCardProps extends CardAction {
  label: Localized;
  value: number | string;
  /** The trend pill: up is green, down is red (as in the Design System). */
  trend?: { value: number | string; direction: "up" | "down" };
}

/** The Design System's stat card: liquid glass, label, large value, optional trend. */
export function StatCard({ label, value, trend, href, onClick, className }: StatCardProps) {
  const { language } = useLocale();
  const up = trend?.direction === "up";
  return (
    <CardRoot href={href} onClick={onClick} className={className} interactive="sf-glass--interactive"
      base="sf-glass sf-glass--lg rounded-[20px] p-5 text-card-foreground">
      <p className="text-sm text-muted-foreground">{loc(label, language)}</p>
      <div className="mt-1 flex items-end justify-between">
        <span className="font-brand text-4xl font-bold leading-none">{fmt(value, language)}</span>
        {trend && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${up ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}>
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{fmt(trend.value, language)}
          </span>
        )}
      </div>
    </CardRoot>
  );
}

/** Sear's tint: the colour at 0x1a alpha. Six-digit hex as Sear writes it; other CSS colours through color-mix. */
const tint = (color: string) =>
  /^#[0-9a-f]{6}$/i.test(color) ? `${color}1a` : `color-mix(in srgb, ${color} 10%, transparent)`;

export interface IconStatCardProps extends CardAction {
  label: Localized;
  value: number | string;
  /** Default: Layers (as in Sear). */
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  /** Icon colour; the square is the same colour at 10%. Any CSS colour. Default: Sear's brand violet `#512195`,
   *  which, like Sear's, stays the same in dark mode. */
  color?: string;
}

/** Sear Studio's overview card: a tinted icon square, a name and a total. */
export function IconStatCard({ label, value, icon: Icon = Layers, color = "#512195", href, onClick, className }: IconStatCardProps) {
  const { language } = useLocale();
  return (
    <CardRoot href={href} onClick={onClick} className={className}
      base={cn("sf-glass-pane sf-glass-pane--airy rounded-[20px] text-card-foreground", "block p-4 transition-colors hover:bg-muted/30")}>
      <div className="flex items-center gap-2.5">
        <span className={cn("rounded-xl flex items-center justify-center shrink-0", "h-9 w-9 rounded-lg")} style={{ backgroundColor: tint(color), color }}>
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-sm font-semibold text-foreground truncate min-w-0">{loc(label, language)}</p>
      </div>
      <p className="mt-3 text-2xl font-bold leading-none tabular-nums text-foreground">{fmt(value, language)}</p>
    </CardRoot>
  );
}
