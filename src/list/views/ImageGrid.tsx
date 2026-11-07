/**
 * ImageGrid — Desk's Image view cards (frappe/public/js/frappe/views/image/image_view.js `item_html`): the record's
 * image (or the title's initials, Desk's `frappe.get_abbr`, when there is none), the title, one detail line and an
 * indicator slot; a selection checkbox per card. Presentational and Frappe-free.
 *
 * Keyboard: the cards' open buttons are one tab stop (roving focus). Arrow keys move between cards (Left / Right follow
 * the reading direction, so they swap in RTL; Up / Down move by a row), Home / End jump to the first / last card,
 * Enter opens, Space toggles the selection when `selection` is given.
 */
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../primitives/button";
import { Card } from "../../primitives/card";
import { Checkbox } from "../../primitives/checkbox";
import { Skeleton } from "../../primitives/skeleton";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";

/** Desk's `frappe.get_abbr` (utils/utils.js): the first letters of the first two words, upper-cased. */
export function initialsOf(title: string, max = 2): string {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return words.slice(0, max).map((w) => [...w][0]!.toUpperCase()).join("");
}

export interface ImageGridProps<T> {
  rows: T[];
  rowKey: (row: T) => string;
  /** The image URL, or nothing for the initials placeholder. */
  image: (row: T) => string | null | undefined;
  title: (row: T) => string;
  /** One line under the title (Desk: the first non-empty `in_list_view` field). */
  detail?: (row: T) => React.ReactNode;
  /** A status indicator slot (top of the card). */
  indicator?: (row: T) => React.ReactNode;
  onOpen?: (row: T) => void;
  selection?: { isSelected: (row: T) => boolean; toggleRow: (row: T) => void };
  loading?: boolean;
  error?: React.ReactNode | boolean;
  onRetry?: () => void;
  empty?: React.ReactNode;
  /** Number of placeholder cards while loading. Default 8. */
  skeletonCount?: number;
  className?: string;
}

export function ImageGrid<T>({ rows, rowKey, image, title, detail, indicator, onOpen, selection, loading, error, onRetry, empty, skeletonCount = 8, className }: ImageGridProps<T>) {
  const { t, direction } = useLocale();
  const listRef = React.useRef<HTMLUListElement>(null);
  const [active, setActive] = React.useState(0);
  const count = rows.length;
  React.useEffect(() => { if (active >= count) setActive(Math.max(0, count - 1)); }, [active, count]);

  const focusAt = (i: number) => {
    const next = Math.max(0, Math.min(count - 1, i));
    setActive(next);
    listRef.current?.querySelectorAll<HTMLElement>("[data-sf-image-open]")[next]?.focus();
  };
  /** Cards per row: the grid's computed track count, else cards sharing the first card's top (1 without layout). */
  const perRow = () => {
    const el = listRef.current;
    if (!el) return 1;
    const tracks = typeof getComputedStyle === "function" ? getComputedStyle(el).gridTemplateColumns : "";
    const n = tracks && tracks !== "none" ? tracks.split(" ").filter(Boolean).length : 0;
    if (n > 0) return n;
    const items = [...el.children] as HTMLElement[];
    const top = items[0]?.offsetTop ?? 0;
    return Math.max(1, items.filter((c) => c.offsetTop === top).length);
  };
  const onKeyDown = (e: React.KeyboardEvent, i: number, row: T) => {
    const fwd = direction === "rtl" ? "ArrowLeft" : "ArrowRight";
    const back = direction === "rtl" ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwd) { e.preventDefault(); focusAt(i + 1); }
    else if (e.key === back) { e.preventDefault(); focusAt(i - 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); focusAt(i + perRow()); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusAt(i - perRow()); }
    else if (e.key === "Home") { e.preventDefault(); focusAt(0); }
    else if (e.key === "End") { e.preventDefault(); focusAt(count - 1); }
    else if (e.key === " " && selection) { e.preventDefault(); selection.toggleRow(row); }
  };

  if (error) {
    return (
      <Card className={cn("flex flex-col items-center gap-3 p-8 text-center text-sm", className)} role="alert">
        {typeof error === "boolean" ? <><AlertTriangle className="h-5 w-5 text-destructive" /><span>{t("loadError")}</span></> : error}
        {onRetry && typeof error === "boolean" && <Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button>}
      </Card>
    );
  }
  const grid = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  if (loading && !count) {
    return (
      <ul className={cn(grid, className)} aria-busy="true" aria-label={t("imageGridLabel")}>
        {Array.from({ length: skeletonCount }, (_, i) => <li key={i}><Skeleton className="aspect-square w-full rounded-xl" /><Skeleton className="mt-2 h-4 w-3/4" /></li>)}
      </ul>
    );
  }
  if (!count) return <Card className={cn("p-8 text-center text-sm text-muted-foreground", className)} role="status">{empty ?? t("noData")}</Card>;

  return (
    <ul ref={listRef} className={cn(grid, className)} aria-label={t("imageGridLabel")} aria-busy={loading || undefined} data-testid="sf-image-grid">
      {rows.map((row, i) => {
        const key = rowKey(row);
        const name = title(row) || key;
        const src = image(row);
        const selected = !!selection?.isSelected(row);
        return (
          <li key={key} className="min-w-0" data-row-key={key}>
            <Card className={cn("group relative overflow-hidden p-0 transition-shadow", selected && "ring-2 ring-primary")}>
              {(selection || indicator) && (
                <div className="absolute inset-x-2 top-2 z-10 flex items-center justify-between gap-2">
                  {selection ? (
                    <Checkbox checked={selected} onCheckedChange={() => selection.toggleRow(row)} aria-label={t("imageSelect").replace("{title}", name)} className="bg-background/80" tabIndex={-1} />
                  ) : <span />}
                  {indicator?.(row)}
                </div>
              )}
              <button type="button" data-sf-image-open tabIndex={i === active ? 0 : -1} aria-label={t("imageOpen").replace("{title}", name)} aria-pressed={selection ? selected : undefined}
                className="block w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onFocus={() => setActive(i)} onClick={() => onOpen?.(row)} onKeyDown={(e) => onKeyDown(e, i, row)}>
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden bg-muted">
                  {src
                    ? <img src={src} alt={name} loading="lazy" className="h-full w-full object-cover" />
                    : <span className="text-3xl font-semibold text-muted-foreground" aria-hidden="true">{initialsOf(name)}</span>}
                </div>
                <div className="space-y-0.5 p-3">
                  <div className="truncate text-sm font-medium" title={name}>{name}</div>
                  {detail && <div className="truncate text-xs text-muted-foreground">{detail(row)}</div>}
                </div>
              </button>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
