/**
 * SegmentedTabs — Sear's port of the Design System's pill tab group.
 *
 * DS source: design_system/frontend/src/pages/style-guide/StyleGuide.tsx →
 * `GlassNavControls` (:2295), the "Tabs — L1" block at :2350-2360 (plain, with-icons and
 * disabled variants). Same markup, same class strings.
 *
 * The container is LIQUID `glass` with `!rounded-full` — a pill rail, not the flat
 * `glass-subtle` `!rounded-xl` capsule of the DS's other tab control (`GlassTabs`, :2743).
 * Both exist in the DS; this component follows the pill one.
 *
 * There is NO sliding indicator: in the pill pattern the active TAB itself carries the
 * tint (`bg-primary/… font-medium text-primary`). That also removes the measurement pass
 * the old port needed, and with it the bug where the indicator could be positioned outside
 * a too-narrow rail.
 *
 * Two deliberate departures from the DS source, both called out rather than silent:
 *
 *  1. The active tint is `bg-primary/10`, not the DS's `bg-primary/12`. Tailwind 3 does not
 *     generate a `/12` opacity step, so `bg-primary/12` emits NO CSS — verified absent from
 *     both the DS and Sear bundles — which would leave the selected tab with no background
 *     at all. `/10` is the DS's own working value for this exact tint (GlassTabs' indicator,
 *     :2744), so it delivers the intended look with a step Tailwind actually emits.
 *
 *  2. Roving-tabindex + Arrow/Home/End keyboard navigation is kept. The DS's pill block is a
 *     static showcase with neither; dropping them would regress a control used across the
 *     app. The DS's own `GlassTabs` implements exactly this behaviour, so it stays.
 *
 * `compact` keeps the DS geometry (`px-3 py-1`) and only drops the label/icon a step, since
 * the DS shows the pill at a single size and six call sites already pass it.
 */
import * as React from "react";
import type { LucideIcon } from "lucide-react";

export interface SegmentedTabItem {
  key: string;
  label: React.ReactNode;
  Icon?: LucideIcon;
  disabled?: boolean;
}

export function SegmentedTabs({
  isRTL,
  items,
  value,
  onChange,
  ariaLabel,
  fullWidth = false,
  compact = false,
  className,
}: {
  isRTL: boolean;
  items: SegmentedTabItem[];
  value: string;
  onChange: (k: string) => void;
  ariaLabel: string;
  fullWidth?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);

  const onKey = (e: React.KeyboardEvent) => {
    const enabled = items.filter((i) => !i.disabled);
    const idx = enabled.findIndex((i) => i.key === value);
    if (idx < 0) return;
    const fwd = isRTL ? "ArrowLeft" : "ArrowRight";
    const back = isRTL ? "ArrowRight" : "ArrowLeft";
    let n = idx;
    if (e.key === fwd) n = (idx + 1) % enabled.length;
    else if (e.key === back) n = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = enabled.length - 1;
    else return;
    e.preventDefault();
    const nk = enabled[n].key;
    onChange(nk);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-val="${nk}"]`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKey}
      className={`glass gap-1 !rounded-full p-1 ${fullWidth ? "flex w-full" : "inline-flex"}${className ? ` ${className}` : ""}`}
    >
      {items.map((it) => {
        const on = value === it.key;
        return (
          <button
            key={it.key}
            data-val={it.key}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            disabled={it.disabled}
            aria-disabled={it.disabled || undefined}
            type="button"
            onClick={() => !it.disabled && onChange(it.key)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${compact ? "text-xs" : "text-sm"} ${fullWidth ? "min-w-0 flex-1" : ""} ${
              it.disabled
                ? "text-muted-foreground/40"
                : on
                  ? " font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {it.Icon && <it.Icon className={compact ? "size-3.5 shrink-0" : "size-4 shrink-0"} aria-hidden />}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
