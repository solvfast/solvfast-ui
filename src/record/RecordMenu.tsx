/**
 * RecordMenu — a record's "⋯" menu (Desk: the form toolbar's menu, `page.add_menu_item`, toolbar.js:340-530), Frappe-free.
 * Items are grouped (a separator between groups, in order of first appearance), may show a keyboard-shortcut hint
 * (display only — the menu does not bind keys), may be `hidden` or `disabled` (with a reason as the item's title), and
 * may ask first (`confirm`, an AlertDialog). A destructive item is styled as such. An item's action may return a
 * promise: the trigger shows a spinner meanwhile, and a rejection is shown under the trigger (role="alert") — the
 * caller's error, never a success the server did not give.
 */
import * as React from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import { Button, buttonVariants } from "../primitives/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from "../primitives/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../primitives/alert-dialog";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, fmt } from "./format";

export interface RecordMenuConfirm { title?: string; body?: string; confirmLabel?: string }

export interface RecordMenuItem {
  id: string;
  label: string;
  /** Items of one group are kept together; groups are separated. Default: one group. */
  group?: string;
  /** A shortcut hint shown at the end of the item (e.g. "Ctrl+E"). Display only. */
  shortcut?: string;
  destructive?: boolean;
  disabled?: boolean;
  /** Why the item is disabled (the item's title). */
  disabledReason?: string;
  hidden?: boolean;
  /** Ask first: true (generic text), a body string, or a title / body / button label. */
  confirm?: boolean | string | RecordMenuConfirm;
  icon?: React.ReactNode;
  /** The action. A rejection is shown under the trigger. Without it, `RecordMenu.onSelect` runs. */
  onSelect?: () => void | Promise<unknown>;
}

export interface RecordMenuLabels { menu?: string; confirmTitle?: string; confirmBody?: string; confirm?: string; cancel?: string; working?: string }

export interface RecordMenuProps {
  items: RecordMenuItem[];
  /** Fallback action for items without their own `onSelect`. */
  onSelect?: (item: RecordMenuItem) => void | Promise<unknown>;
  /** Called with the rejection of an action (it is shown under the trigger as well). */
  onError?: (error: unknown, item: RecordMenuItem) => void;
  disabled?: boolean;
  /** Controlled busy state (the menu also tracks its own action's promise). */
  busy?: boolean;
  align?: "start" | "end";
  labels?: RecordMenuLabels;
  /** Replace the default "⋯" trigger (must accept a ref / props — rendered with `asChild`). */
  trigger?: React.ReactElement;
  className?: string;
}

/** Visible items grouped in order of first appearance (pure; exported for tests and custom renderers). */
export function groupMenuItems(items: RecordMenuItem[]): RecordMenuItem[][] {
  const order: string[] = [];
  const by = new Map<string, RecordMenuItem[]>();
  for (const it of items) {
    if (it.hidden) continue;
    const g = it.group ?? "";
    if (!by.has(g)) { by.set(g, []); order.push(g); }
    by.get(g)!.push(it);
  }
  return order.map((g) => by.get(g)!);
}

export function RecordMenu({ items, onSelect, onError, disabled, busy, align = "end", labels, trigger, className }: RecordMenuProps) {
  const { t } = useLocale();
  const L = {
    menu: labels?.menu ?? t("r35Menu"), confirmTitle: labels?.confirmTitle ?? t("r35ConfirmTitle"), confirmBody: labels?.confirmBody ?? t("r35ConfirmBody"),
    confirm: labels?.confirm ?? t("r35Confirm"), cancel: labels?.cancel ?? t("r35Cancel"), working: labels?.working ?? t("r35Working"),
  };
  const [pending, setPending] = React.useState<RecordMenuItem | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState("");
  const mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; }, []);
  const groups = React.useMemo(() => groupMenuItems(items), [items]);
  const isBusy = !!busy || running;

  const run = async (it: RecordMenuItem) => {
    setError("");
    const action = it.onSelect ?? (onSelect ? () => onSelect(it) : undefined);
    if (!action) return;
    let result: void | Promise<unknown>;
    try { result = action(); } catch (e) { setError(errorText(e) || "Error"); onError?.(e, it); return; }
    if (!result || typeof (result as Promise<unknown>).then !== "function") return;
    setRunning(true);
    try { await result; } catch (e) { if (mounted.current) setError(errorText(e) || "Error"); onError?.(e, it); }
    finally { if (mounted.current) setRunning(false); }
  };
  const choose = (it: RecordMenuItem) => { if (it.confirm) setPending(it); else void run(it); };

  const confirm = pending?.confirm;
  const c: RecordMenuConfirm = typeof confirm === "object" ? confirm : typeof confirm === "string" ? { body: confirm } : {};
  if (!groups.length) return null;

  return (
    <div className={cn("inline-flex flex-col items-end", className)} data-busy={isBusy || undefined}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled || isBusy}>
          {trigger ?? (
            <Button type="button" size="icon-sm" variant="outline" aria-label={isBusy ? L.working : L.menu} title={L.menu} disabled={disabled || isBusy}>
              {isBusy ? <Loader2 className="animate-spin" aria-hidden /> : <MoreHorizontal aria-hidden />}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="min-w-[12rem]">
          {groups.map((g, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <DropdownMenuSeparator />}
              {g.map((it) => (
                <DropdownMenuItem key={it.id} data-item={it.id} disabled={it.disabled} title={it.disabled ? it.disabledReason : undefined}
                  className={it.destructive ? "text-destructive focus:text-destructive" : undefined} onSelect={() => choose(it)}>
                  {it.icon}
                  <span>{it.label}</span>
                  {it.shortcut ? <DropdownMenuShortcut dir="ltr">{it.shortcut}</DropdownMenuShortcut> : null}
                </DropdownMenuItem>
              ))}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? <p role="alert" className="mt-1 max-w-xs text-xs text-destructive">{error}</p> : null}
      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{c.title ?? fmt(L.confirmTitle, pending?.label ?? "")}</AlertDialogTitle>
            <AlertDialogDescription>{c.body ?? L.confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L.cancel}</AlertDialogCancel>
            <AlertDialogAction className={pending?.destructive ? buttonVariants({ variant: "destructive" }) : undefined}
              onClick={() => { const it = pending; setPending(null); if (it) void run(it); }}>{c.confirmLabel ?? L.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
