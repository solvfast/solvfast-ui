/**
 * In-app navigation with unsaved edits (P35 F6). Desk keeps a dirty document in `locals` across route changes and only
 * guards a full unload (`beforeunload`, form.js:1351-1356). Here the edits live in the form component: unmounting it
 * (a route change) loses them, so the HOST ROUTER must ask first. The package has no router; this helper is
 * router-agnostic:
 *
 *   const [dirty, setDirty] = React.useState(false);
 *   const guard = useUnsavedChangesBlocker(dirty);
 *   <FrappeForm doctype="ToDo" name={name} onDirtyChange={setDirty} />
 *   // react-router 6.4+:   useBlocker(() => guard.dirty && !guard.confirmLeave())
 *   // a custom router:     if (!guard.confirmLeave()) return;  navigate(to);
 *
 * `confirmLeave()` answers true when nothing is unsaved or the user confirms (default `window.confirm` with the
 * translated "You have unsaved changes…" text; pass `confirm` for an in-app dialog that answers synchronously, or use
 * `dirty` to drive an async dialog yourself). `beforeUnload` (default false — FrappeFormView already registers it unless
 * `guardUnload={false}`) adds the browser's own prompt for reloads / tab closes.
 */
import * as React from "react";
import { useLocale } from "../../theme/ThemeProvider";

export interface UnsavedChangesBlockerOptions {
  /** The prompt (default: the translated `formLeaveUnsaved`). */
  message?: string;
  /** Ask the user; true = leave. Default `window.confirm`. */
  confirm?: (message: string) => boolean;
  /** Also register `beforeunload` while dirty. Default false. */
  beforeUnload?: boolean;
}

export interface UnsavedChangesBlocker {
  /** Something would be lost by leaving now. */
  dirty: boolean;
  /** True when leaving is fine (clean, or the user confirmed). */
  confirmLeave: () => boolean;
  message: string;
}

export function useUnsavedChangesBlocker(dirty: boolean, opts: UnsavedChangesBlockerOptions = {}): UnsavedChangesBlocker {
  const { t } = useLocale();
  const message = opts.message ?? t("formLeaveUnsaved");
  const ask = opts.confirm;
  React.useEffect(() => {
    if (!opts.beforeUnload || !dirty || typeof window === "undefined") return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, opts.beforeUnload]);
  const confirmLeave = React.useCallback(() => {
    if (!dirty) return true;
    if (ask) return ask(message);
    return typeof window !== "undefined" && typeof window.confirm === "function" ? window.confirm(message) : false;
  }, [dirty, ask, message]);
  return { dirty, confirmLeave, message };
}
