/**
 * Mobile bottom navigation — Sear's StudioShell `StudioMobileNav` (baseline 7abc895-dirty): the first leaves in an
 * airy-glass bottom bar plus "More", which opens a sheet with the rest and an exit row. Hidden from `md` up.
 *
 * Changes from Sear (VENDORED.md): items and routing from props; BUG FIX — Sear passed `side={isRTL ? "right" :
 * "left"}` to a Sheet whose sides are already logical (start/end), so in Arabic the sheet opened on the LEFT edge;
 * it now opens on the start edge in both directions (left in LTR, right in RTL) and slides in from that edge.
 */
import * as React from "react";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../primitives/sheet";
import { useLocale } from "../theme/ThemeProvider";
import { defaultIsActive, loc, type IsActive, type Localized, type NavItem } from "./nav";

export interface MobileNavProps {
  items: NavItem[];
  currentPath: string;
  onNavigate: (href: string, item?: NavItem) => void;
  isActive?: IsActive;
  brand?: { name: Localized; logoSrc?: string };
  /** The exit row at the bottom of the "More" sheet. Omit to hide. */
  exit?: { href: string; label?: Localized };
  /** Leaves shown in the bar before "More" (default 4). */
  maxItems?: number;
}

export function MobileNav({ items, currentPath, onNavigate, isActive = defaultIsActive, brand, exit, maxItems = 4 }: MobileNavProps) {
  const { language, t } = useLocale();
  const [moreOpen, setMoreOpen] = React.useState(false);
  if (!items.length) return null;
  // Leaves fill the bar; parents (items with children) always go to "More".
  const leaves = items.filter((i) => !i.children?.length);
  const parents = items.filter((i) => i.children?.length);
  const primary = leaves.slice(0, maxItems);
  const overflow = [...leaves.slice(maxItems), ...parents];
  const overflowActive = overflow.some((i) => isActive(i, currentPath));
  const go = (item: NavItem) => {
    setMoreOpen(false);
    const href = item.href ?? item.children?.find((c) => c.href)?.href;
    if (href) onNavigate(href, item);
  };
  const brandName = brand ? loc(brand.name, language) : "";

  return (
    <>
      <nav className="sf-glass-pane sf-glass-pane--airy  !fixed inset-x-0 bottom-0 z-50 md:hidden pb-[env(safe-area-inset-bottom,6px)]">
        <div className="flex h-16 items-stretch justify-between gap-0.5 px-1">
          {primary.map((item) => {
            const active = isActive(item, currentPath);
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => go(item)} aria-current={active ? "page" : undefined}
                className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${active ? "text-brand-flame font-medium" : "text-muted-foreground"}`}>
                {Icon && <Icon className="h-5 w-5 shrink-0" />}
                <span className="max-w-full truncate text-[10px] leading-none">{loc(item.label, language)}</span>
              </button>
            );
          })}
          <button onClick={() => setMoreOpen(true)} aria-expanded={moreOpen}
            className={`flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${overflowActive ? "text-brand-flame font-medium" : "text-muted-foreground"}`}>
            <MoreHorizontal className="h-5 w-5 shrink-0" />
            <span className="text-[10px] leading-none">{t("more")}</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        {/* `side="left"` is the logical START edge (the Sheet uses start-0); the rtl: classes make the slide come from
            that edge too. `sf-app` repeats the app scope on this portal, as Sear does with `sear-studio`. */}
        <SheetContent side="left" className="sf-app flex w-72 flex-col pb-8 pt-4 rtl:data-[state=open]:slide-in-from-right rtl:data-[state=closed]:slide-out-to-right">
          <SheetTitle className="sr-only">{t("more")}</SheetTitle>
          <SheetDescription className="sr-only">{brandName}</SheetDescription>
          <div className="flex items-center gap-3 px-3 pb-3">
            {brand?.logoSrc && <img src={brand.logoSrc} alt="" className="h-9 w-9 object-contain shrink-0" />}
            <span className="text-base font-semibold leading-tight text-brand-violet">{brandName}</span>
          </div>
          <div className="h-px bg-border mb-2" />
          <div className="flex-1 space-y-1 overflow-y-auto">
            {overflow.map((item) => {
              const active = isActive(item, currentPath);
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => go(item)} aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors ${active ? "bg-brand-flame/10 text-brand-flame font-medium" : "text-foreground hover:bg-muted"}`}>
                  {Icon && <Icon className="h-5 w-5 shrink-0" />}
                  <span>{loc(item.label, language)}</span>
                </button>
              );
            })}
          </div>
          {exit && (
            <>
              <div className="h-px bg-border my-2" />
              <button onClick={() => { setMoreOpen(false); onNavigate(exit.href); }}
                className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
                <span>{exit.label ? loc(exit.label, language) : t("backToWorkspace")}</span>
              </button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
