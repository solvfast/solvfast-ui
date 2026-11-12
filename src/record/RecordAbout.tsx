/**
 * The record page's About cards (the CRM Deal / Lead / Contact / Organization pages' About tab), ported 1:1 from their
 * @solvfast/ui-scope markup: summary tiles, info rows, the score ring (Probability), a field list (Prerequisites'
 * read view), an insight card (e.g. an AI summary — the host writes its content), the closed-record notice, and the
 * two-column Recent Interactions card. Presentational: the host passes values, colours (`tone`) and wording.
 */
import * as React from "react";
import { Activity, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconType = React.ComponentType<any>;

/* ── Summary tile ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordInfoTileProps {
  label: React.ReactNode;
  icon?: IconType;
  /** Border + wash classes (default neutral: `border-border/60 bg-gradient-to-br from-muted/40 to-transparent`). */
  tone?: string;
  children: React.ReactNode;
  className?: string;
}

/** A small labelled tile (Assignee, Organization, Contact, Probability…) in the About summary grid. */
export function RecordInfoTile({ label, icon: Icon, tone = "border-border/60 bg-gradient-to-br from-muted/40 to-transparent", children, className }: RecordInfoTileProps) {
  return (
    <div className={cn("rounded-lg border p-3", tone, className)} data-record-tile="">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5">{Icon ? <Icon className="h-3 w-3" /> : null}{label}</p>
      {children}
    </div>
  );
}

/* ── Info row ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordInfoRowProps {
  icon: IconType;
  label: React.ReactNode;
  value: React.ReactNode;
  dir?: "ltr" | "rtl";
  hint?: React.ReactNode;
  /** The icon square's colours (bg + text). */
  tone?: string;
}

/** A labelled value with a tinted icon square (Expected Value, Created…); rows divide themselves. */
export function RecordInfoRow({ icon: Icon, label, value, dir, hint, tone = "bg-primary/[0.08] text-foreground" }: RecordInfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0" data-record-info-row="">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ring-1 ring-primary/10", tone)}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground truncate" dir={dir}>{value || "—"}</p>
        {hint ? <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p> : null}
      </div>
    </div>
  );
}

/* ── Score ring ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordScoreRingProps {
  /** 0–100. */
  value: number;
  /** The ring's colour (any CSS colour). */
  color: string;
  /** Under the number (large ring only). */
  label?: React.ReactNode;
  /** Pixels; ≤ 64 is the compact ring (thin stroke, small number). Default 140. */
  size?: number;
}

/** A radial percentage (e.g. a deal's Probability). */
export function RecordScoreRing({ value, color, label, size = 140 }: RecordScoreRingProps) {
  const v = Number.isFinite(value) ? value : 0;
  const compact = size <= 64;
  const stroke = compact ? 5 : 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, v)) / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }} data-record-score={v}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 600ms ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold tabular-nums leading-none", compact ? "text-[11px]" : "text-2xl")} style={{ color }}>{v}%</span>
        {label ? <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span> : null}
      </div>
    </div>
  );
}

/* ── Field list ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordFieldListItem { id: string; label: React.ReactNode; value?: React.ReactNode }

/** Label / value rows (e.g. Prerequisites' read view); an empty value shows `emptyLabel`. */
export function RecordFieldList({ items, emptyLabel }: { items: RecordFieldListItem[]; emptyLabel: React.ReactNode }) {
  return (
    <div className="space-y-2.5" data-record-field-list="">
      {items.map((f) => (
        <div key={f.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
          <span className="text-xs text-muted-foreground">{f.label}</span>
          <span className="text-sm font-medium text-foreground text-end">{f.value === undefined || f.value === null || f.value === "" ? emptyLabel : f.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Insight card ─────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordInsightCardProps {
  /** The square at the start of the header (e.g. an assistant's mark on a tint). */
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** A summary card with an icon, a title and a subtitle (e.g. "Deal summary by Senaiy · Updated just now"). */
export function RecordInsightCard({ icon, title, subtitle, children, className }: RecordInsightCardProps) {
  return (
    <div className={cn("relative rounded-xl border border-border bg-card", className)} data-record-insight="">
      <div className="relative overflow-hidden p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2">
            {icon}
            <div>
              <p className="text-sm font-semibold">{title}</p>
              {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Notice ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The read-only notice of a closed record ("This record is closed. Fields are read-only."). */
export function RecordClosedNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
      {children}
    </div>
  );
}

/* ── Recent interactions ──────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordInteraction {
  id: string;
  title: React.ReactNode;
  /** The formatted time (e.g. "Apr 24, 10:00 AM"). */
  when?: React.ReactNode;
  channel?: React.ReactNode;
  preview?: React.ReactNode;
  /** Shown when the row is opened. */
  body?: React.ReactNode;
  icon: IconType;
  /** The icon square's tint classes (per activity type). */
  iconClassName?: string;
}

export interface RecordInteractionsProps {
  /** The host's split (e.g. inbound by direction or by type); up to 4 each are shown. */
  inbound: RecordInteraction[];
  outbound: RecordInteraction[];
  labels?: { title?: string; inbound?: string; outbound?: string; empty?: string };
  /** Glyphs: header (Activity), inbound (ArrowDownLeft), outbound (ArrowUpRight). */
  icons?: { header?: IconType; inbound?: IconType; outbound?: IconType };
}

/** The two-column Recent Interactions card (Inbound / Outbound); a row opens to its body. */
export function RecordInteractions({ inbound, outbound, labels, icons }: RecordInteractionsProps) {
  const { t } = useLocale();
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const L = { title: labels?.title ?? t("rpgInteractions"), inbound: labels?.inbound ?? t("rpgInbound"), outbound: labels?.outbound ?? t("rpgOutbound"), empty: labels?.empty ?? t("rpgNoInteractions") };
  const Header = icons?.header ?? Activity;
  const col = (items: RecordInteraction[], label: string, Arrow: IconType, tone: string, key: string) => (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden" data-record-interactions-col={key}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
        <div className="inline-flex items-center gap-2">
          <Arrow className={cn("h-3.5 w-3.5", tone)} />
          <h4 className={cn("text-xs font-semibold uppercase tracking-wider", tone)}>{label}</h4>
        </div>
        <span className="text-[10px] text-muted-foreground">{items.slice(0, 4).length}</span>
      </div>
      <div className="divide-y divide-border/40">
        {items.length === 0 && <p className="p-4 text-xs text-muted-foreground text-center">{L.empty}</p>}
        {items.slice(0, 4).map((a) => {
          const open = expanded === a.id;
          return (
            <button key={a.id} type="button" onClick={() => setExpanded(open ? null : a.id)} aria-expanded={open}
              className="w-full text-start p-3 hover:bg-muted/40 transition-colors flex items-start gap-2.5">
              <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", a.iconClassName)}>
                <a.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{a.title}</p>
                  {a.when != null ? <span className="text-[10px] text-muted-foreground shrink-0">{a.when}</span> : null}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                  {a.channel ? <span className="font-medium">{a.channel}</span> : null}
                  {a.channel && a.preview ? <span className="opacity-50">•</span> : null}
                  <span className="truncate">{a.preview}</span>
                </div>
                {open && a.body ? <p className="text-xs text-foreground/80 mt-2 leading-relaxed border-s-2 border-brand-violet/30 ps-2.5">{a.body}</p> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 space-y-3" data-record-interactions="">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-brand-violet/10 flex items-center justify-center">
          <Header className="h-4 w-4 text-brand-violet" />
        </div>
        <h3 className="text-sm font-semibold">{L.title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {col(inbound, L.inbound, icons?.inbound ?? ArrowDownLeft, "text-brand-cyan", "inbound")}
        {col(outbound, L.outbound, icons?.outbound ?? ArrowUpRight, "text-brand-violet", "outbound")}
      </div>
    </div>
  );
}
