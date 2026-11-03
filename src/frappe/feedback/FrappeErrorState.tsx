/**
 * <FrappeErrorState error onRetry /> — the one rendering of a failed Frappe call for every component (contract §3).
 * Title from the error's `kind`; body = the server's own messages as sent (the raise_exception ones when present,
 * HTML through the allow-list), else the error's message; a hint for kinds that need the user to act. Actions:
 * Retry (when `onRetry` is given), "Reload page" for csrf (the page's token is stale), "Log in" for session_expired
 * (Desk redirects to `/login?redirect-to=<path>`, desk.js handle_session_expired).
 */
import { AlertTriangle, Lock, RefreshCw, SearchX, WifiOff } from "lucide-react";
import { Button } from "../../primitives/button";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import type { Messages } from "../../theme/messages";
import { FrappeError, visibleMessages } from "../client";
import type { FrappeErrorKind } from "../contract";
import { ServerHtml } from "./ServerHtml";

const TITLE: Record<FrappeErrorKind, keyof Messages> = {
  permission: "feErrPermission", not_found: "feErrNotFound", duplicate: "feErrDuplicate", timestamp: "feErrTimestamp",
  mandatory: "feErrMandatory", link: "feErrLink", validation: "feErrValidation", csrf: "feErrCsrf",
  session_expired: "feErrSessionExpired", too_large: "feErrTooLarge", network: "feErrNetwork", server: "feErrServer",
};
const HINT: Partial<Record<FrappeErrorKind, keyof Messages>> = {
  timestamp: "feHintTimestamp", csrf: "feHintCsrf", session_expired: "feHintSessionExpired", network: "feHintNetwork", too_large: "feHintTooLarge",
};

/** Any thrown value → kind + messages, so the component also renders plain Errors (as "server"). */
export function describeError(error: unknown): { kind: FrappeErrorKind; bodies: string[] } {
  if (error instanceof FrappeError) {
    const shown = visibleMessages(error.messages).map((m) => m.message).filter(Boolean);
    // a 403 with `_error_message` reads better than the generic server messages (Desk's 403 handler does the same)
    return { kind: error.kind, bodies: error.status === 403 || !shown.length ? [error.message] : shown };
  }
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return { kind: "server", bodies: message ? [message] : [] };
}

export interface FrappeErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  /** Where "Log in" goes for an expired session. Default `/login?redirect-to=<current path>`. */
  loginUrl?: string;
  /** Smaller, inline (inside a field or a row). */
  compact?: boolean;
  className?: string;
}

export function FrappeErrorState({ error, onRetry, loginUrl, compact, className }: FrappeErrorStateProps) {
  const { t } = useLocale();
  const { kind, bodies } = describeError(error);
  const Icon = kind === "permission" || kind === "session_expired" || kind === "csrf" ? Lock : kind === "not_found" ? SearchX : kind === "network" ? WifiOff : AlertTriangle;
  const destructive = kind === "server" || kind === "too_large";
  const title = t(TITLE[kind]);
  const hint = HINT[kind] ? t(HINT[kind]!) : undefined;
  const login = loginUrl ?? (typeof window !== "undefined" ? `/login?redirect-to=${encodeURIComponent(window.location.pathname + window.location.search)}` : "/login");
  const showBodies = bodies.filter((b) => b && b !== title);
  return (
    <div
      role="alert"
      data-kind={kind}
      className={cn(
        "flex items-start gap-3 rounded-lg border text-sm",
        compact ? "p-2" : "p-4",
        destructive ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40",
        className,
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", destructive ? "text-destructive" : kind === "permission" || kind === "not_found" ? "text-muted-foreground" : "text-warning")} />
      <div className="min-w-0 flex-1 space-y-1 text-start">
        <p className="font-medium text-foreground">{title}</p>
        {showBodies.map((b, i) => <ServerHtml key={i} html={b} className="break-words text-muted-foreground" />)}
        {hint && <p className="text-muted-foreground">{hint}</p>}
        {(onRetry || kind === "csrf" || kind === "session_expired") && (
          <div className={cn("flex flex-wrap gap-2", compact ? "pt-1" : "pt-2")}>
            {kind === "session_expired" ? (
              <Button asChild size="sm" variant="outline"><a href={login}>{t("feLogIn")}</a></Button>
            ) : kind === "csrf" ? (
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>{t("feReloadPage")}</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw aria-hidden />{t("retry")}</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
