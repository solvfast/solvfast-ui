/**
 * useFrappeMessages — Desk's `frappe.msgprint` semantics for server messages (docs 14 §B3-B4; JS ui/messages.js):
 *  - an array where ANY message has `raise_exception` shows ONLY those;
 *  - `alert` / `toast` messages go to a transient alert (Desk `show_alert`, 7 s), the others to ONE shared message
 *    dialog where successive messages stack (title = the last message's title, else "Message");
 *  - `indicator` is a semantic (blue info default, green success, orange/yellow warning, red error);
 *  - message bodies may hold HTML: rendered through an allow-list (ServerHtml), never as raw HTML.
 * Messages of a server RESPONSE replace what the dialog shows (Desk hides the open msgprint first, request.js cleanup);
 * `show()` from code appends, as msgprint does.
 */
import * as React from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../primitives/dialog";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import { visibleMessages, type FrappeApi } from "../client";
import type { FrappeMessage } from "../contract";
import { ServerHtml } from "./ServerHtml";
import { TONE_DOT, indicatorTone } from "./tone";

export interface FrappeMessagesApi {
  /** Show messages with msgprint semantics. `replace`: drop what the dialog currently shows (a new server response). */
  show(messages: FrappeMessage[], opts?: { replace?: boolean }): void;
}

const MessagesContext = React.createContext<FrappeMessagesApi | null>(null);
let warned = false;
const fallback: FrappeMessagesApi = {
  show(messages) {
    if (!warned && messages.length) { warned = true; console.warn("[@solvfast/ui/frappe] useFrappeMessages: no FrappeProvider (serverMessages) above — messages not shown."); }
  },
};

/** The nearest message host (FrappeProvider renders one by default). Without one, `show` only warns once. */
export function useFrappeMessages(): FrappeMessagesApi {
  return React.useContext(MessagesContext) ?? fallback;
}

interface AlertItem { id: number; message: FrappeMessage }
const ALERT_MS = 7000;

export interface FrappeMessagesProviderProps {
  /** Show the messages of this client's successful responses (FrappeApi.subscribeMessages). */
  source?: Pick<FrappeApi, "subscribeMessages">;
  /** Route alerts elsewhere (e.g. sonner's `toast`). Default: the built-in alert region. */
  onAlert?: (message: FrappeMessage) => void;
  children: React.ReactNode;
}

export function FrappeMessagesProvider({ source, onAlert, children }: FrappeMessagesProviderProps) {
  const { t } = useLocale();
  const [dialog, setDialog] = React.useState<FrappeMessage[]>([]);
  const [alerts, setAlerts] = React.useState<AlertItem[]>([]);
  const nextId = React.useRef(0);
  const onAlertRef = React.useRef(onAlert);
  onAlertRef.current = onAlert;

  const dismissAlert = React.useCallback((id: number) => setAlerts((a) => a.filter((x) => x.id !== id)), []);
  const api = React.useMemo<FrappeMessagesApi>(() => ({
    show(messages, opts = {}) {
      const visible = visibleMessages(messages.filter((m) => m && m.message));
      const toAlert = visible.filter((m) => m.alert);
      const toDialog = visible.filter((m) => !m.alert);
      for (const m of toAlert) {
        if (onAlertRef.current) onAlertRef.current(m);
        else {
          const id = ++nextId.current;
          setAlerts((a) => [...a, { id, message: m }]);
          setTimeout(() => dismissAlert(id), ALERT_MS);
        }
      }
      if (toDialog.length || opts.replace) setDialog((d) => (opts.replace ? toDialog : [...d, ...toDialog]));
    },
  }), [dismissAlert]);

  React.useEffect(() => source?.subscribeMessages((messages) => api.show(messages, { replace: true })), [source, api]);

  const title = [...dialog].reverse().find((m) => m.title)?.title ?? t("feMessage");
  const tone = indicatorTone(dialog[dialog.length - 1]?.indicator);
  return (
    <MessagesContext.Provider value={api}>
      {children}
      <Dialog open={dialog.length > 0} onOpenChange={(open) => { if (!open) setDialog([]); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle className="flex items-center gap-2">
            <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[tone])} />
            {title}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-foreground">
              {dialog.map((m, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <hr className="border-border" />}
                  <ServerHtml html={m.message} className="break-words [&_p]:my-1" />
                </React.Fragment>
              ))}
            </div>
          </DialogDescription>
        </DialogContent>
      </Dialog>
      {alerts.length > 0 && (
        <div className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
          {alerts.map(({ id, message }) => (
            <div key={id} role="status" className="pointer-events-auto flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm text-card-foreground shadow-lg">
              <span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE_DOT[indicatorTone(message.indicator)])} />
              <ServerHtml html={message.message} className="min-w-0 flex-1 break-words" />
              <button type="button" onClick={() => dismissAlert(id)} aria-label={t("feDismiss")} className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </MessagesContext.Provider>
  );
}
