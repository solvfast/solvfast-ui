// Notification Center — the global bell + slide-in panel (Prompt v1.0 / v1.1).
//
// A bell in every header (immediately left of the language globe) that opens a
// slide-in panel listing the current user's in-app notifications, grouped by
// time, with read/unread. This component is rendered inside MANY different theme
// scopes (workspace home, ServeFast, Omnichannel, Sayr Studio) — several of which
// do NOT define the ServeFast design tokens (--card, --foreground, --border). So
// it uses EXPLICIT light/dark colours (never scoped tokens) and anchors BELOW the
// global header (top offset per header) as a single contained surface.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import {
  useNotificationCenter, notificationCenterStore,
  NOTIF_APP_META, timeGroup, relativeTime,
  type InAppNotification, type TimeGroup,
} from '@sear/pages/Notifications/notificationCenterStore';

const VIOLET = '#512195';

export default function NotificationCenter({ isRTL = false, top = 56 }: { isRTL?: boolean; top?: number }) {
  const navigate = useNavigate();
  const list = useNotificationCenter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const unread = list.reduce((n, x) => n + (x.read ? 0 : 1), 0);
  const badge = unread > 9 ? '9+' : String(unread);

  const shown = filter === 'unread' ? list.filter((n) => !n.read) : list;
  const groups: { key: TimeGroup; label: string; items: InAppNotification[] }[] = [
    { key: 'today', label: isRTL ? 'اليوم' : 'Today', items: [] },
    { key: 'yesterday', label: isRTL ? 'أمس' : 'Yesterday', items: [] },
    { key: 'earlier', label: isRTL ? 'أقدم' : 'Earlier', items: [] },
  ];
  for (const n of [...shown].sort((a, b) => b.at - a.at)) {
    groups.find((g) => g.key === timeGroup(n.at))!.items.push(n);
  }
  const nonEmpty = groups.filter((g) => g.items.length > 0);

  const openRow = (n: InAppNotification) => {
    notificationCenterStore.markRead(n.id);
    setOpen(false);
    navigate(n.recordLink);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={isRTL ? 'الإشعارات' : 'Notifications'}
        className="group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-[180ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:!translate-y-0 active:duration-[120ms] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 glass glass--interactive glass--clear size-8 rounded-full !rounded-lg text-muted-foreground hover:bg-muted"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-flame text-white text-[10px] font-semibold leading-4 text-center">
            {badge}
          </span>
        )}
      </button>

      {open && createPortal(
        <>
          {/* Click-catcher — starts BELOW the header so the header stays clickable. No dim. */}
          <div className="fixed inset-x-0 bottom-0 z-40" style={{ top }} onClick={() => setOpen(false)} aria-hidden />
          {/* Single contained slide-in surface, anchored below the header. Explicit colours. */}
          <aside
            dir={isRTL ? 'rtl' : 'ltr'}
            style={{ top }}
            className="!fixed glass-pane glass-pane--airy rounded-[20px] bottom-0 end-0 z-40 flex w-[360px] max-w-[92vw] flex-col dark:bg-[#1b1622] border-s border-black/10 dark:border-white/10 shadow-2xl"
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-black/10 dark:border-white/10">
              <h2 className="text-sm font-semibold text-foreground dark:text-white">{isRTL ? 'الإشعارات' : 'Notifications'}</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => notificationCenterStore.markAllRead()}
                  disabled={unread === 0}
                  className="text-[11px] font-medium hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed px-1"
                  style={{ color: VIOLET }}
                >
                  {isRTL ? 'تعليم الكل كمقروء' : 'Mark all as read'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={isRTL ? 'إغلاق' : 'Close'}
                  className="group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-[180ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:!translate-y-0 active:duration-[120ms] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 glass glass--interactive glass--clear size-8 rounded-full !rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter row — All / Unread segmented */}
            <div className="px-4 py-2.5 border-b border-black/10 dark:border-white/10">
              <div className="inline-flex rounded-lg border border-black/10 dark:border-white/10 p-0.5">
                {(['all', 'unread'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                    className={`px-3 h-7 rounded-md text-xs font-medium transition-colors ${
                      filter === f ? 'text-white' : 'text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:hover:text-gray-200'
                    }`}
                    style={filter === f ? { backgroundColor: VIOLET } : undefined}
                  >
                    {f === 'all' ? (isRTL ? 'الكل' : 'All') : (isRTL ? 'غير مقروء' : 'Unread')}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto">
              {nonEmpty.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <Bell className="h-7 w-7 text-gray-300 dark:text-muted-foreground" />
                  <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                    {filter === 'unread'
                      ? (isRTL ? 'أنت على اطّلاع بكل شيء.' : "You're all caught up.")
                      : (isRTL ? 'لا توجد إشعارات بعد.' : 'No notifications yet.')}
                  </p>
                </div>
              ) : (
                nonEmpty.map((g) => (
                  <div key={g.key}>
                    <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">{g.label}</div>
                    {g.items.map((n) => {
                      const app = NOTIF_APP_META[n.app];
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => openRow(n)}
                          className={`w-full text-start flex items-start gap-3 px-4 py-3 border-b border-black/5 dark:border-white/5 transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${
                            !n.read ? 'bg-brand-violet/[0.06]' : ''
                          }`}
                        >
                          <img src={app.icon} alt="" className="h-8 w-8 rounded-md object-contain shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground dark:text-gray-100 leading-snug line-clamp-2">{isRTL ? n.bodyAr : n.body}</p>
                            <p className="text-[11px] text-muted-foreground dark:text-muted-foreground mt-1">
                              {isRTL ? app.ar : app.en} · {relativeTime(n.at, isRTL)}
                            </p>
                          </div>
                          {!n.read && <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: VIOLET }} />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </aside>
        </>,
        document.body,
      )}
    </>
  );
}
