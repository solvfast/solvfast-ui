import * as React from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Button } from "../primitives/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../primitives/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../primitives/alert-dialog";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, fmt } from "./format";
import type { LifecycleActionItem } from "./types";

export interface ActionBarLabels { actions?: string; none?: string; confirmTitle?: string; confirmBody?: string; confirm?: string; cancel?: string; working?: string }

export interface ActionBarProps {
  actions: LifecycleActionItem[];
  /** Perform the action. A rejection is shown under the bar and the action can be retried. */
  onAction: (action: LifecycleActionItem) => void | Promise<unknown>;
  /** "menu" (default, like Desk's Actions dropdown) or one button per action. */
  variant?: "menu" | "buttons";
  /** An action is in flight (controlled); the bar also tracks its own promise. */
  busy?: boolean;
  disabled?: boolean;
  /** Why the bar is disabled — shown as a tooltip text. */
  disabledReason?: string;
  labels?: ActionBarLabels;
  className?: string;
}

/** The transition actions of a record. `confirm` actions ask first. Hidden entirely when there are no actions and `hideWhenEmpty`. */
export function ActionBar({ actions, onAction, variant = "menu", busy, disabled, disabledReason, labels, className }: ActionBarProps) {
  const { t } = useLocale();
  const L = {
    actions: labels?.actions ?? t("recActions"), none: labels?.none ?? t("recNoActions"), confirmTitle: labels?.confirmTitle ?? t("recConfirmTitle"),
    confirmBody: labels?.confirmBody ?? t("recConfirmBody"), confirm: labels?.confirm ?? t("recConfirm"), cancel: labels?.cancel ?? t("recCancel"),
    working: labels?.working ?? t("recWorking"),
  };
  const [pending, setPending] = React.useState<LifecycleActionItem | null>(null);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; }, []);
  const isBusy = busy || running;
  const off = disabled || isBusy;

  const run = async (a: LifecycleActionItem) => {
    setError(""); setRunning(true);
    try { await onAction(a); } catch (e) { if (mounted.current) setError(errorText(e) || "Error"); }
    finally { if (mounted.current) setRunning(false); }
  };
  const choose = (a: LifecycleActionItem) => { if (a.confirm) setPending(a); else void run(a); };

  return (
    <div className={className} data-busy={isBusy || undefined}>
      <div className="flex flex-wrap items-center gap-2">
        {variant === "menu" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" disabled={off} title={disabled ? disabledReason : undefined} aria-label={L.actions}>
                {isBusy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {isBusy ? L.working : L.actions}
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {actions.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground">{L.none}</div>
              ) : actions.map((a) => (
                <DropdownMenuItem key={a.id} disabled={a.disabled} onSelect={() => choose(a)}>{a.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : actions.map((a) => (
          <Button key={a.id} size="sm" variant={a.tone === "danger" ? "destructive" : "default"} disabled={off || a.disabled}
            title={disabled ? disabledReason : undefined} onClick={() => choose(a)}>{a.label}</Button>
        ))}
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{fmt(L.confirmTitle, pending?.label ?? "")}</AlertDialogTitle>
            <AlertDialogDescription>{typeof pending?.confirm === "string" ? pending.confirm : L.confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{L.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const a = pending; setPending(null); if (a) void run(a); }}>{L.confirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
