/**
 * LikeToggle — Frappe Desk's "Like" heart (the list view's favorite marker), Frappe-free.
 *
 * Native behaviour reproduced (Frappe 15.110, `list/list_view.js:985-991, 1049-1059, 2227-2266`, `ui/like.js:12-56`):
 * a heart that is outlined / muted when not liked and filled red when liked; the click is NOT optimistic — while the
 * host's `onToggle` promise runs the control is disabled, the state changes only after it resolves, and a rejection leaves
 * the state unchanged (Desk's request is `quiet`: no message; `onError` lets the host decide). `title` carries the liked-by
 * names. Deliberate deviation: Desk renders a `<span>` with no keyboard path; this is a real `<button aria-pressed>` with
 * one fixed accessible name (a toggle's name must not change with its state).
 *
 * Controlled (`liked`) or uncontrolled (`defaultLiked`). Clicks never reach an enclosing row (no row open / selection).
 */
import * as React from "react";
import { Heart } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";

export interface LikeToggleProps {
  /** Controlled state. Omit to let the control keep its own state (`defaultLiked`). */
  liked?: boolean;
  defaultLiked?: boolean;
  /** Called with the requested state. A returned promise keeps the control pending until it settles. */
  onToggle?: (next: boolean) => void | Promise<unknown>;
  /** The toggle failed (the promise rejected); the state is left unchanged. */
  onError?: (error: unknown) => void;
  /** Tooltip, e.g. the names of the users who liked the document. */
  title?: string;
  disabled?: boolean;
  /** Accessible name (default: the catalogue's "Like"). */
  label?: string;
  className?: string;
}

export function LikeToggle({ liked, defaultLiked = false, onToggle, onError, title, disabled, label, className }: LikeToggleProps) {
  const { t } = useLocale();
  const [own, setOwn] = React.useState(defaultLiked);
  const [pending, setPending] = React.useState(false);
  const live = React.useRef(true);
  React.useEffect(() => () => { live.current = false; }, []);
  const controlled = liked !== undefined;
  const on = controlled ? !!liked : own;

  const toggle = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (pending || disabled) return;
    const next = !on;
    let result: void | Promise<unknown>;
    try {
      result = onToggle?.(next);
    } catch (err) {
      onError?.(err);
      return;
    }
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setPending(true);
      (result as Promise<unknown>).then(
        () => { if (live.current) { if (!controlled) setOwn(next); setPending(false); } },
        (err) => { if (live.current) setPending(false); onError?.(err); },
      );
    } else if (!controlled) {
      setOwn(next);
    }
  };

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-busy={pending || undefined}
      aria-label={label ?? t("like")}
      title={title || undefined}
      disabled={disabled || pending}
      data-liked={on ? "" : undefined}
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
        pending && "opacity-60",
        on ? "text-destructive" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", on && "fill-current")} aria-hidden />
    </button>
  );
}
