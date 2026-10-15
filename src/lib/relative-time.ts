// Ported from Sear (sear_studio/pages/Notifications/notificationCenterStore.ts, baseline 7abc895-dirty): the time
// helpers only — the in-memory notification store and its demo data stay in Sear.
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

export type TimeGroup = "today" | "yesterday" | "earlier";

export function timeGroup(at: number, now: number = Date.now()): TimeGroup {
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();
  if (at >= t0) return "today";
  if (at >= t0 - DAY) return "yesterday";
  return "earlier";
}

/** "12m ago" / "3h ago" / "2d ago" (bilingual). */
export function relativeTime(at: number, isRTL: boolean, now: number = Date.now()): string {
  const diff = Math.max(0, now - at);
  if (diff < HOUR) { const m = Math.max(1, Math.floor(diff / MIN)); return isRTL ? `قبل ${m} د` : `${m}m ago`; }
  if (diff < DAY) { const h = Math.floor(diff / HOUR); return isRTL ? `قبل ${h} س` : `${h}h ago`; }
  const d = Math.floor(diff / DAY); return isRTL ? `قبل ${d} ي` : `${d}d ago`;
}
