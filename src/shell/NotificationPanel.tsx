/**
 * Notification bell + slide-in panel — Sear's NotificationCenter (sear_studio/components/NotificationCenter.tsx,
 * baseline 7abc895-dirty) with its data moved to props: unread badge ("9+"), All / Unread filter, Today / Yesterday /
 * Earlier groups, relative times, click a row to open it, "Mark all as read", close, click outside to close.
 *
 * Changes from Sear (VENDORED.md): the in-memory demo store is gone (items + callbacks come from the app);
 * BUG FIX — Sear's `dark:bg-[#1b1622]` made the glass panel opaque in dark mode only, so it no longer overrides the
 * glass; the hard-coded violet `#512195` is now the canonical `--color-deep-violet` token (same colour, both themes);
 * strings come from the package messages; the panel portals into the theme scope.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import { Button } from "../primitives/button";
import { useLocale, usePortalContainer } from "../theme/ThemeProvider";
import { relativeTime, timeGroup, type TimeGroup } from "../lib/relative-time";
import { loc, type Localized } from "./nav";

export interface NotificationItem {
  id: string;
  /** The notification text (already resolved by the app). */
  body: Localized;
  /** When it fired (epoch ms). */
  at: number;
  read: boolean;
  /** Source-app icon (image URL). */
  iconSrc?: string;
  /** Source-app name, shown before the relative time. */
  source?: Localized;
}

export interface NotificationPanelProps {
  items: NotificationItem[];
  /** A row was clicked. The panel closes; the app marks it read and navigates. */
  onItemClick?: (item: NotificationItem) => void;
  onMarkAllRead?: () => void;
  /** Distance from the top of the viewport to the panel (the header height). Default 56. */
  top?: number;
}

const VIOLET = "var(--color-deep-violet)";

export function NotificationPanel({ items, onItemClick, onMarkAllRead, top = 56 }: NotificationPanelProps) {
  const { language, isRTL, t } = useLocale();
  const container = usePortalContainer();
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");

  const unread = items.reduce((n, x) => n + (x.read ? 0 : 1), 0);
  const badge = unread > 9 ? "9+" : String(unread);

  const shown = filter === "unread" ? items.filter((n) => !n.read) : items;
  const groups: { key: TimeGroup; label: string; items: NotificationItem[] }[] = [
    { key: "today", label: t("today"), items: [] },
    { key: "yesterday", label: t("yesterday"), items: [] },
    { key: "earlier", label: t("earlier"), items: [] },
  ];
  for (const n of [...shown].sort((a, b) => b.at - a.at)) groups.find((g) => g.key === timeGroup(n.at))!.items.push(n);
  const nonEmpty = groups.filter((g) => g.items.length > 0);

  const openRow = (n: NotificationItem) => {
    setOpen(false);
    onItemClick?.(n);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("notifications")}
        aria-expanded={open}
        className="!rounded-lg text-muted-foreground hover:bg-muted"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-flame text-white text-[10px] font-semibold leading-4 text-center">
            {badge}
          </span>
        )}
      </Button>

      {open && createPortal(
        <>
          {/* Click-catcher — starts BELOW the header so the header stays clickable. No dim. */}
          <div className="fixed inset-x-0 bottom-0 z-40" style={{ top }} onClick={() => setOpen(false)} aria-hidden />
          <aside
            dir={isRTL ? "rtl" : "ltr"}
            style={{ top }}
            aria-label={t("notifications")}
            className="!fixed sf-glass-pane sf-glass-pane--airy rounded-[20px] bottom-0 end-0 z-40 flex w-[360px] max-w-[92vw] flex-col border-s border-black/10 dark:border-white/10 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-black/10 dark:border-white/10">
              <h2 className="text-sm font-semibold text-foreground dark:text-white">{t("notifications")}</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMarkAllRead?.()}
                  disabled={unread === 0}
                  className="text-[11px] font-medium hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed px-1"
                  style={{ color: VIOLET }}
                >
                  {t("markAllRead")}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setOpen(false)}
                  aria-label={t("close")}
                  className="!rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="px-4 py-2.5 border-b border-black/10 dark:border-white/10">
              <div className="inline-flex rounded-lg border border-black/10 dark:border-white/10 p-0.5">
                {(["all", "unread"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className={`px-3 h-7 rounded-md text-xs font-medium transition-colors ${
                      filter === f ? "text-white" : "text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-gray-200"
                    }`}
                    style={filter === f ? { backgroundColor: VIOLET } : undefined}
                  >
                    {f === "all" ? t("filterAll") : t("filterUnread")}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {nonEmpty.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <Bell className="h-7 w-7 text-gray-300 dark:text-muted-foreground" />
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                    {filter === "unread" ? t("allCaughtUp") : t("noNotifications")}
                  </p>
                </div>
              ) : (
                nonEmpty.map((g) => (
                  <div key={g.key}>
                    <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">{g.label}</div>
                    {g.items.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => openRow(n)}
                        className={`w-full text-start flex items-start gap-3 px-4 py-3 border-b border-black/5 dark:border-white/5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${
                          !n.read ? "bg-brand-violet/[0.06]" : ""
                        }`}
                      >
                        {n.iconSrc && <img src={n.iconSrc} alt="" className="h-8 w-8 rounded-md object-contain shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground dark:text-gray-100 leading-snug line-clamp-2">{loc(n.body, language)}</p>
                          <p className="text-[11px] text-muted-foreground dark:text-muted-foreground mt-1">
                            {n.source ? `${loc(n.source, language)} · ` : ""}{relativeTime(n.at, isRTL)}
                          </p>
                        </div>
                        {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: VIOLET }} />}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </aside>
        </>,
        container ?? document.body,
      )}
    </>
  );
}
