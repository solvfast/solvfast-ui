// Overview library — self-contained tokens + tiny shared primitives.
// No external module coupling except the two components the spec says to reuse
// (SenaiyIcon, FilterDropdown) which are imported at their call sites.

import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { ChipKind, DistPhase, Lang } from './types';

// ── Brand palette (LOCKED, self-contained) ────────────────────────────────────
export const BRAND = {
  violet: '#512195', // neutral counts, headings, default accent
  teal: '#11bf9d',   // healthy / connected / volume / success / closed
  flame: '#fe4e18',  // at-risk / sent-back / attention, delta-down, on-hold
  sky: '#25d0fe',    // working / in-progress / open
  amber: '#f59e0b',  // expired
  red: '#dc2626',    // error
  grey: '#9ca3af',   // idle
} as const;

/** Deterministic brand-palette rotation for uncolored bars / icons (RC3). */
export const PALETTE = [BRAND.violet, BRAND.teal, BRAND.flame, BRAND.sky] as const;
export const paletteColor = (i: number): string =>
  PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

// ── Status-chip semantics: kind → color + default bilingual label ─────────────
// KEEP: connected/error (connectors) + working/needs-approval/sent-back (Senaiy AI
// delegation — colors match the My Work "AI / Delegated" module EXACTLY). The rest
// are phantom (deprecated) kinds retained only for backward compatibility.
export const CHIP: Record<ChipKind, { color: string; en: string; ar: string }> = {
  connected:        { color: BRAND.teal,   en: 'Connected',     ar: 'متصل' },
  error:            { color: BRAND.red,    en: 'Error',         ar: 'خطأ' },
  working:          { color: BRAND.sky,    en: 'Working',       ar: 'قيد العمل' },
  'needs-approval': { color: BRAND.violet, en: 'Needs approval', ar: 'بانتظار الاعتماد' },
  'sent-back':      { color: BRAND.flame,  en: 'Sent back',     ar: 'أُعيدت إليك' },
  // phantom (deprecated — app agents no longer pass these):
  healthy:   { color: BRAND.teal,  en: 'Healthy',   ar: 'سليم' },
  'at-risk': { color: BRAND.flame, en: 'At-risk',   ar: 'معرّض للخطر' },
  pending:   { color: BRAND.flame, en: 'Pending',   ar: 'معلّق' },
  expired:   { color: BRAND.amber, en: 'Expired',   ar: 'منتهٍ' },
  idle:      { color: BRAND.grey,  en: 'Idle',      ar: 'خامل' },
  neutral:   { color: BRAND.violet, en: 'Count',    ar: 'عدد' },
};

// ── Universal phase semantics: sky (open) · flame (on hold) · teal (closed) ────
export const PHASE: Record<DistPhase, { color: string; en: string; ar: string }> = {
  open:    { color: BRAND.sky,   en: 'Open',    ar: 'مفتوح' },
  on_hold: { color: BRAND.flame, en: 'On hold', ar: 'معلّق' },
  closed:  { color: BRAND.teal,  en: 'Closed',  ar: 'مغلق' },
};

/** Resolve the active language: explicit prop wins, else the document direction. */
export function resolveLang(lang?: Lang): Lang {
  if (lang) return lang;
  if (typeof document !== 'undefined' && document.documentElement.dir === 'rtl') return 'ar';
  return 'en';
}

/** Locale-format a value; numbers get thousands separators, strings pass through. Zero is data. */
export function fmt(value: number | string, lang: Lang): string {
  if (typeof value === 'string') return value;
  return value.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US');
}

/** Relative-time helper (feed timestamps). Accepts an ISO date or a ready display string. */
export function relTime(ts: string, lang: Lang): string {
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return ts; // already a display string
  const isAr = lang === 'ar';
  const d = Math.floor((Date.now() - t) / 86_400_000);
  if (d <= 0) return isAr ? 'اليوم' : 'today';
  if (d === 1) return isAr ? 'أمس' : '1d ago';
  if (d < 7) return isAr ? `قبل ${d} أيام` : `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return isAr ? `قبل ${w} أسابيع` : `${w}w ago`;
  const m = Math.floor(d / 30);
  return isAr ? `قبل ${m} أشهر` : `${m}mo ago`;
}

// ── Shared surface: the DS container tier. Identical to what <Card> renders
// (design_system components/ui/card.tsx), kept as a constant because these widgets
// compose it onto <Link>/<button> roots rather than a plain <div>. ──
export const CARD = 'glass-pane glass-pane--airy rounded-[20px] text-card-foreground';

/** Deep-link wrapper: renders a react-router <Link> when `to` is set, else a plain element. */
export const MaybeLink: React.FC<{
  to?: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}> = ({ to, className, children, ariaLabel }) =>
  to ? (
    <Link to={to} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );

/** Tinted rounded icon square (Zone 1 / status rows). */
export const IconSquare: React.FC<{
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  size?: 'md' | 'sm';
}> = ({ icon: Icon, color, size = 'md' }) => (
  <span
    className={cn(
      'rounded-xl flex items-center justify-center shrink-0',
      size === 'md' ? 'h-11 w-11' : 'h-9 w-9 rounded-lg',
    )}
    style={{ backgroundColor: `${color}1a`, color }}
  >
    <Icon className={size === 'md' ? 'h-5 w-5' : 'h-4 w-4'} />
  </span>
);

/** A small colored status pill. */
export const ChipPill: React.FC<{ kind: ChipKind; label?: string }> = ({ kind, label }) => {
  const c = CHIP[kind];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0"
      style={{ backgroundColor: `${c.color}1a`, color: c.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c.color }} />
      {label ?? c.en}
    </span>
  );
};

/** Section heading used inside every card. */
export const CardTitle: React.FC<{
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}> = ({ icon: Icon, children }) => (
  <h2 className="text-sm font-semibold mb-4 inline-flex items-center gap-2 text-foreground">
    {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
    {children}
  </h2>
);
