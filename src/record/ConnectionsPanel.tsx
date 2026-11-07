/**
 * ConnectionsPanel — the "Connections" of a record (Desk: form/dashboard.js, the transactions area): groups of linked
 * record types, each with a count badge (Desk shows it only when the count is non-zero, `set_badge_count_common`
 * :493-510; an open-count badge when the server sent one) and an optional "+" to create a linked record. Frappe-free:
 * the caller gives the groups, counts and callbacks (or `href` per item). Loading, error (with retry) and empty states.
 */
import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { fmt } from "./format";

export interface ConnectionItem {
  /** Unique key (Frappe: the linked DocType). */
  id: string;
  label: string;
  /** Total linked records; "?" when the server could not count in time (Desk: statement timeout). Undefined = not loaded. */
  count?: number | "?";
  /** Open records (Desk's notification-config filter), shown next to the total when > 0. */
  openCount?: number;
  /** Offer "+" (create a linked record). */
  canCreate?: boolean;
  /** Link target for the item (rendered as <a>); otherwise `onOpen` makes it a button. */
  href?: string;
}
export interface ConnectionGroup { label: string; items: ConnectionItem[] }

export interface ConnectionsPanelProps {
  groups: ConnectionGroup[];
  /** Counts are loading (the items are shown; their badges wait). */
  loading?: boolean;
  /** The counts failed: shown above the groups (the items stay usable). */
  error?: React.ReactNode;
  onRetry?: () => void;
  onOpen?: (item: ConnectionItem) => void;
  onNew?: (item: ConnectionItem) => void;
  /** Replaces the groups (e.g. "Save the document to see its connections"). */
  notice?: React.ReactNode;
  emptyText?: string;
  className?: string;
}

export function ConnectionsPanel({ groups, loading, error, onRetry, onOpen, onNew, notice, emptyText, className }: ConnectionsPanelProps) {
  const { t } = useLocale();
  const visible = groups.filter((g) => g.items.length);
  if (notice) return <div className={cn("text-sm text-muted-foreground", className)} role="status">{notice}</div>;
  if (!visible.length) return <div className={cn("text-sm text-muted-foreground", className)} role="status">{emptyText ?? t("r35ConnectionsEmpty")}</div>;
  return (
    <div className={cn("space-y-4", className)} aria-busy={loading || undefined}>
      {loading && (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden />{t("r35ConnectionsLoading")}</p>
      )}
      {error ? (
        <div className="flex flex-wrap items-center gap-2">
          {typeof error === "string" ? <p role="alert" className="text-sm text-destructive">{error}</p> : error}
          {onRetry && <Button type="button" size="sm" variant="outline" onClick={onRetry}>{t("r35Retry")}</Button>}
        </div>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((g) => (
          <section key={g.label} aria-label={g.label} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h4>
            <ul className="space-y-1.5">
              {g.items.map((it) => {
                const body = (
                  <>
                    <span className="truncate">{it.label}</span>
                    {typeof it.openCount === "number" && it.openCount > 0 ? <Badge variant="warning" data-open-count={it.openCount}>{it.openCount}</Badge> : null}
                    {it.count === "?" ? <Badge variant="outline" title={t("r35CountUnknown")}>?</Badge>
                      : typeof it.count === "number" && it.count > 0 ? <Badge variant="outline" data-count={it.count}>{it.count}</Badge> : null}
                  </>
                );
                const cls = "inline-flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-start text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
                return (
                  <li key={it.id} data-connection={it.id} className="flex items-center gap-1 rounded-lg border border-border bg-card/60">
                    {it.href ? <a href={it.href} className={cls} aria-label={fmt(t("r35OpenList"), it.label)}>{body}</a>
                      : <button type="button" className={cls} onClick={() => onOpen?.(it)} disabled={!onOpen} aria-label={fmt(t("r35OpenList"), it.label)}>{body}</button>}
                    {it.canCreate && onNew ? (
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={fmt(t("r35CreateNew"), it.label)} title={fmt(t("r35CreateNew"), it.label)} onClick={() => onNew(it)}>
                        <Plus aria-hidden />
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
