// Notification Center — the in-app CONSUMPTION surface (Prompt v1.0).
//
// Session-scoped, in-memory ONLY (never localStorage/sessionStorage/backend): the
// fired in-app notifications the current user has received, with their content
// already resolved (variables substituted). Seeded with a Rihlat fixture at load
// so the bell + panel are populated on first open; gone on a hard refresh.

import { useSyncExternalStore } from 'react';
import crmIcon from '../../../assets/applogos/apps/sf-crm.png';
import ticketsIcon from '../../../assets/applogos/apps/sf-tickets.png';
import servicesIcon from '../../../assets/applogos/apps/sf-services.png';
import omniIcon from '../../../assets/applogos/apps/sf-omnichannel.png';

export type NotifAppKey = 'crm' | 'tickets' | 'services' | 'omnichannel';

/** Source-app metadata for a notification row (icon + label). */
export const NOTIF_APP_META: Record<NotifAppKey, { icon: string; en: string; ar: string }> = {
  crm: { icon: crmIcon, en: 'CRM', ar: 'إدارة العملاء' },
  tickets: { icon: ticketsIcon, en: 'Tickets', ar: 'التذاكر' },
  services: { icon: servicesIcon, en: 'Services', ar: 'الخدمات' },
  omnichannel: { icon: omniIcon, en: 'Omnichannel', ar: 'القنوات الموحّدة' },
};

export interface InAppNotification {
  id: string;
  app: NotifAppKey;
  /** In-app body, resolved with real values (variables already substituted). */
  body: string;
  bodyAr: string;
  /** The record_link target — a client-side route (react-router path, no basename). */
  recordLink: string;
  /** Fired-at epoch ms. */
  at: number;
  read: boolean;
}

const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

// Rihlat demo fixture — a mix of read/unread across apps + Today / Yesterday / Earlier.
function seed(): InAppNotification[] {
  const now = Date.now();
  return [
    { id: 'n1', app: 'crm', body: 'New lead “Gulf Adventures Co.” was assigned to you.', bodyAr: 'تم إسناد العميل المحتمل «Gulf Adventures Co.» إليك.', recordLink: '/crm-app/leads', at: now - 12 * MIN, read: false },
    { id: 'n2', app: 'omnichannel', body: 'A new WhatsApp conversation was opened and is waiting to be picked up.', bodyAr: 'تم فتح محادثة واتساب جديدة وهي بانتظار الاستلام.', recordLink: '/omnichannel/inbox/7', at: now - 48 * MIN, read: false },
    { id: 'n3', app: 'tickets', body: 'Your request “Booking Change Request” is complete.', bodyAr: 'اكتمل طلبك «طلب تغيير حجز».', recordLink: '/service-desk-app/tickets', at: now - 3 * HOUR, read: false },
    { id: 'n4', app: 'services', body: 'New work has been assigned to you: “Visa Processing — KSA”.', bodyAr: 'تم إسناد عمل جديد إليك: «معالجة تأشيرة — السعودية».', recordLink: '/service-management-app/orders', at: now - 6 * HOUR, read: true },
    { id: 'n5', app: 'crm', body: 'Deal “Red Sea Retreats” has moved to Won.', bodyAr: 'انتقلت الصفقة «Red Sea Retreats» إلى مكسوبة.', recordLink: '/crm-app/deals', at: now - (DAY + 2 * HOUR), read: false },
    { id: 'n6', app: 'tickets', body: 'A ticket handled by your team moved to On Hold and may need attention.', bodyAr: 'انتقلت تذكرة يتولاها فريقك إلى «معلّقة» وقد تحتاج إلى متابعة.', recordLink: '/service-desk-app/tickets', at: now - (DAY + 5 * HOUR), read: true },
    { id: 'n7', app: 'omnichannel', body: 'A new public comment was posted on Instagram — review and respond.', bodyAr: 'تم نشر تعليق عام جديد على إنستغرام — راجِع وردّ.', recordLink: '/omnichannel/inbox', at: now - 3 * DAY, read: true },
    { id: 'n8', app: 'services', body: 'Your request “Refund — Unused Ticket” is complete.', bodyAr: 'اكتمل طلبك «استرداد — تذكرة غير مستخدمة».', recordLink: '/service-management-app/orders', at: now - 5 * DAY, read: true },
  ];
}

let _state: InAppNotification[] = seed();
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

let _seq = 0;
const newId = () => `nc_${++_seq}_${_state.length}`;

export const notificationCenterStore = {
  subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
  getSnapshot(): InAppNotification[] { return _state; },
  unreadCount(): number { return _state.reduce((n, x) => n + (x.read ? 0 : 1), 0); },
  markRead(id: string) {
    if (_state.some((x) => x.id === id && !x.read)) {
      _state = _state.map((x) => (x.id === id ? { ...x, read: true } : x));
      emit();
    }
  },
  markAllRead() {
    if (_state.some((x) => !x.read)) { _state = _state.map((x) => ({ ...x, read: true })); emit(); }
  },
  /** Fire a new in-app notification into the panel (session-scoped). */
  add(n: Omit<InAppNotification, 'id' | 'at' | 'read'> & { at?: number; read?: boolean }) {
    _state = [{ id: newId(), at: n.at ?? Date.now(), read: n.read ?? false, app: n.app, body: n.body, bodyAr: n.bodyAr, recordLink: n.recordLink }, ..._state];
    emit();
  },
};

export function useNotificationCenter(): InAppNotification[] {
  return useSyncExternalStore(notificationCenterStore.subscribe, notificationCenterStore.getSnapshot, notificationCenterStore.getSnapshot);
}

/** A stable snapshot getter for the unread badge (recomputes on change). */
export function useUnreadCount(): number {
  const list = useNotificationCenter();
  return list.reduce((n, x) => n + (x.read ? 0 : 1), 0);
}

// ── Time helpers for the panel ────────────────────────────────────────────────
export type TimeGroup = 'today' | 'yesterday' | 'earlier';

export function timeGroup(at: number, now: number = Date.now()): TimeGroup {
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const t0 = startOfToday.getTime();
  if (at >= t0) return 'today';
  if (at >= t0 - DAY) return 'yesterday';
  return 'earlier';
}

/** "12m ago" / "3h ago" / "2d ago" (bilingual). */
export function relativeTime(at: number, isRTL: boolean, now: number = Date.now()): string {
  const diff = Math.max(0, now - at);
  if (diff < HOUR) { const m = Math.max(1, Math.floor(diff / MIN)); return isRTL ? `قبل ${m} د` : `${m}m ago`; }
  if (diff < DAY) { const h = Math.floor(diff / HOUR); return isRTL ? `قبل ${h} س` : `${h}h ago`; }
  const d = Math.floor(diff / DAY); return isRTL ? `قبل ${d} ي` : `${d}d ago`;
}
