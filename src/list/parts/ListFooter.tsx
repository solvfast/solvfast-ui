/**
 * Pager — Sear's DataGrid pager markup (total + prev · page · next), styled as the DS Pagination pill by the rules in
 * styles/src/sf-overrides.css (Sear's sear-studio.css:382-420). Must stay the LAST child of the `.sf-datagrid` root.
 * Bulk actions — PMO's floating bar (solvfast_pmo components/tasks/BulkActionBar.tsx) with app-supplied actions.
 */
import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../primitives/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../primitives/dropdown-menu";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/button";
import { Card } from "../../primitives/card";
import { loc, type Localized } from "../../lib/localized";
import { useLocale } from "../../theme/ThemeProvider";

export function ListPagination({ total, totalLabel, onTotalClick, page, hasPrev, hasNext, onPage, pageSize, pageSizes, onPageSize }: {
  total: number; totalLabel?: string; onTotalClick?: () => void; page: number; hasPrev: boolean; hasNext: boolean; onPage: (p: number) => void;
  /** Desk's page-length buttons (base_list.js:374-418: 20 / 100 / 500 / 2500): offered when `pageSizes` and `onPageSize` are given. */
  pageSize?: number; pageSizes?: number[]; onPageSize?: (n: number) => void;
}) {
  const { t, direction, language } = useLocale();
  const Prev = direction === "rtl" ? ChevronRight : ChevronLeft;
  const Next = direction === "rtl" ? ChevronLeft : ChevronRight;
  const totalNode = totalLabel === "" ? <span /> : onTotalClick
    ? <button type="button" className="rounded-sm underline decoration-dotted underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title={t("listCountExact")} onClick={onTotalClick}>{t("total")}: {totalLabel ?? total}</button>
    : <span>{t("total")}: {totalLabel ?? total}</span>;
  const sizes = pageSizes?.length && onPageSize ? (
    <div role="group" aria-label={t("listPageSize")} className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5" data-page-sizes="">
      {pageSizes.map((n) => (
        <button key={n} type="button" aria-pressed={n === pageSize} onClick={() => n !== pageSize && onPageSize(n)} dir="ltr"
          className={cn("rounded px-2 py-0.5 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            n === pageSize ? "bg-accent font-medium text-foreground" : "hover:text-foreground")}>
          {n.toLocaleString(language === "ar" ? "ar-EG" : "en-US")}
        </button>
      ))}
    </div>
  ) : null;
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      {/* the page buttons must stay the LAST child (pill styles, styles/src/sf-overrides.css) */}
      {sizes ? <div className="flex flex-wrap items-center gap-3">{totalNode}{sizes}</div> : totalNode}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!hasPrev} onClick={() => onPage(page - 1)} aria-label={t("prevPage")}><Prev className="h-4 w-4" /></Button>
        <span className="px-2" aria-current="page">{page + 1}</span>
        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!hasNext} onClick={() => onPage(page + 1)} aria-label={t("nextPage")}><Next className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

/**
 * What a bulk action sees: the selected row keys, the selected rows the list has loaded, and a way to clear the selection.
 * `allMatching` is set when the user chose "Select all {n} matching" (`ListView selectAllMatching`): the action is asked to
 * act on EVERY record that matches the list's current query (`total` of them), not only on `keys` (the loaded rows).
 */
export interface BulkActionContext<T> { keys: string[]; rows: T[]; clear: () => void; allMatching?: { total: number } }

/**
 * One action on the selected rows. In the bar (`selectionMode="bar"`) it is a button; in Desk's header mode
 * (`selectionMode="header"`) an item of the toolbar's Actions menu (list_view.js:1855-2127). `hidden` / `disabled`
 * gate it per selection (capabilities, permissions, business rules) — a disabled item says why (`disabled` returning a
 * string). `confirm` asks first (AlertDialog). `run` gets exactly the selected keys.
 */
export interface BulkAction<T> {
  key: string;
  label: Localized;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "outline" | "destructive" | "secondary";
  /** `ctx` is passed only when all matching records are selected (`ctx.allMatching`). */
  run: (keys: string[], rows: T[], ctx?: BulkActionContext<T>) => void | Promise<void>;
  /**
   * The action can act on every record matching the query ("Select all {n} matching": `ctx.allMatching` — e.g. by sending
   * the list's filters instead of names). Actions without it are offered DISABLED while all matching records are selected:
   * running them on the loaded keys only would silently act on fewer records than the user chose.
   */
  allMatching?: boolean;
  /** "destructive": the destructive look (bar button and menu item) and a destructive confirm button. */
  tone?: "default" | "destructive";
  /** Not offered for this selection. */
  hidden?: (ctx: BulkActionContext<T>) => boolean;
  /** Offered but disabled for this selection; a string is the reason shown with it. */
  disabled?: (ctx: BulkActionContext<T>) => boolean | string;
  /** Ask first. A function gets the selection (e.g. to name the count). */
  confirm?: BulkActionConfirm | ((ctx: BulkActionContext<T>) => BulkActionConfirm);
  /** Menu: a separator is drawn before the first action of a new group. */
  group?: string;
}
export interface BulkActionConfirm { title: Localized; description?: Localized; confirmLabel?: Localized }

/** The actions offered for a selection (`hidden` applied) with their disabled state. With `ctx.allMatching`, actions that
 *  cannot act on all matching records are disabled with `opts.allMatchingReason`. */
export function resolveBulkActions<T>(actions: BulkAction<T>[] | undefined, ctx: BulkActionContext<T>, opts: { allMatchingReason?: string } = {}): { action: BulkAction<T>; disabled: boolean; reason?: string }[] {
  return (actions ?? []).filter((a) => !a.hidden?.(ctx)).map((a) => {
    if (ctx.allMatching && !a.allMatching) return { action: a, disabled: true, reason: opts.allMatchingReason ?? "Not available for all matching records" };
    const d = a.disabled?.(ctx);
    return { action: a, disabled: !!d, reason: typeof d === "string" ? d : undefined };
  });
}

export function BulkActionBar<T>({ count, actions, render, onClear, keys, rows }: {
  count: number; actions?: BulkAction<T>[]; render?: (ctx: { keys: string[]; rows: T[]; clear: () => void }) => React.ReactNode;
  onClear: () => void; keys: string[]; rows: T[];
}) {
  const { language, t } = useLocale();
  const ctx: BulkActionContext<T> = { keys, rows, clear: onClear };
  const runner = useBulkActionRunner<T>();
  if (!count) return null;
  return (
    <Card className="sticky top-2 z-20 flex flex-wrap items-center gap-3 p-3" role="region" aria-label={t("selectedCount").replace("{n}", String(count))}>
      <span className="text-sm font-medium" aria-live="polite">{t("selectedCount").replace("{n}", String(count))}</span>
      <div className="h-5 w-px bg-border" />
      {render?.(ctx)}
      {resolveBulkActions(actions, ctx, { allMatchingReason: t("listAllMatchingUnsupported") }).map(({ action: a, disabled, reason }) => {
        const Icon = a.icon;
        return (
          <Button key={a.key} size="sm" variant={a.variant ?? (a.tone === "destructive" ? "destructive" : "outline")} className="gap-1.5" loading={runner.busy === a.key}
            disabled={!!runner.busy || disabled} title={reason} onClick={() => runner.request(a, ctx)}>
            {Icon && <Icon className="h-4 w-4" />} {loc(a.label, language)}
          </Button>
        );
      })}
      <Button variant="ghost" size="sm" className="ms-auto gap-1.5" onClick={onClear}>
        <X className="h-4 w-4" /> {t("clearSelection")}
      </Button>
      {runner.dialog}
    </Card>
  );
}

/**
 * Runs bulk actions: `confirm` first when the action asks for it (package AlertDialog, destructive button for a destructive
 * action), `busy` while it runs. Shared by the bar and the header-mode Actions menu.
 */
export function useBulkActionRunner<T>() {
  const { language, t } = useLocale();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [asking, setAsking] = React.useState<{ action: BulkAction<T>; ctx: BulkActionContext<T>; confirm: BulkActionConfirm } | null>(null);
  const exec = async (a: BulkAction<T>, ctx: BulkActionContext<T>) => {
    setBusy(a.key);
    // the context is passed only for an "all matching" selection: older actions keep their exact (keys, rows) call
    try { await (ctx.allMatching ? a.run(ctx.keys, ctx.rows, ctx) : a.run(ctx.keys, ctx.rows)); } finally { setBusy(null); }
  };
  const request = (a: BulkAction<T>, ctx: BulkActionContext<T>) => {
    const c = typeof a.confirm === "function" ? a.confirm(ctx) : a.confirm;
    if (c) setAsking({ action: a, ctx, confirm: c }); else void exec(a, ctx);
  };
  const dialog = (
    <AlertDialog open={!!asking} onOpenChange={(o) => !o && setAsking(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{asking ? loc(asking.confirm.title, language) : ""}</AlertDialogTitle>
          {asking?.confirm.description && <AlertDialogDescription>{loc(asking.confirm.description, language)}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction asChild onClick={() => { const a = asking; setAsking(null); if (a) void exec(a.action, a.ctx); }}>
            <Button variant={asking?.action.tone === "destructive" ? "destructive" : "default"}>
              {asking?.confirm.confirmLabel ? loc(asking.confirm.confirmLabel, language) : t("confirm")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { busy, request, dialog };
}

/**
 * Desk's page-head **Actions** dropdown (list_view.js:590-598, 1855-2127): shown instead of the primary action while rows
 * are selected. Items are the typed `actions` (hidden / disabled / confirm / groups) plus `extra` menu content (e.g. the
 * workflow's actions, which the server computes when the menu opens: `onOpenChange`).
 */
export function ListActionsMenu<T>({ actions, ctx, extra, label, onOpenChange, align = "end" }: {
  actions?: BulkAction<T>[]; ctx: BulkActionContext<T>; extra?: React.ReactNode; label?: React.ReactNode;
  onOpenChange?: (open: boolean) => void; align?: "start" | "end";
}) {
  const { language, t } = useLocale();
  const runner = useBulkActionRunner<T>();
  const items = resolveBulkActions(actions, ctx, { allMatchingReason: t("listAllMatchingUnsupported") });
  return (
    <>
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button className="gap-1.5 shrink-0" loading={!!runner.busy} data-testid="sf-list-actions">
            {label ?? t("listActions")} <ChevronDown className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="min-w-[13rem]">
          {items.map(({ action: a, disabled, reason }, i) => {
            const Icon = a.icon;
            const sep = i > 0 && a.group !== items[i - 1].action.group;
            return (
              <React.Fragment key={a.key}>
                {sep && <DropdownMenuSeparator />}
                <DropdownMenuItem disabled={disabled || !!runner.busy} title={reason} data-action={a.key}
                  className={cn(a.tone === "destructive" && "text-destructive focus:text-destructive")}
                  onSelect={() => runner.request(a, ctx)}>
                  {Icon && <Icon className="me-2 h-4 w-4" aria-hidden />}
                  <span className="flex-1">{loc(a.label, language)}</span>
                  {reason && <span className="sr-only"> — {reason}</span>}
                </DropdownMenuItem>
              </React.Fragment>
            );
          })}
          {extra}
        </DropdownMenuContent>
      </DropdownMenu>
      {runner.dialog}
    </>
  );
}
