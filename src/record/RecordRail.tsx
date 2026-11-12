import * as React from "react";
import {
  BookOpen, CheckSquare, ChevronRight, ExternalLink, FileText, GripVertical, Pencil, Plus, Settings2, Sparkles, User, X, ArrowUpRight,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Button } from "../primitives/button";
import { Badge } from "../primitives/badge";
import { Checkbox } from "../primitives/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { Sheet, SheetContent } from "../primitives/sheet";

/**
 * RecordRail — the record page's right rail as the CRM draws it (Deal / Lead / Contact / Organization / Ticket details):
 * "Customize sections", the pinned Lifecycle card, the visible sections in order, the footer (Created / Last edited /
 * Seen by) and the Articles panel after it. A CRM-exact port of the CRM's own rail pieces (SidebarCard, RailSection,
 * RelatedRecordRow, SidebarCustomizer, RailFooter, ReferencesPanel) — same DOM, same classes — so the CRM's look is the
 * package's look. It is NOT the Frappe Desk form sidebar (FormSidebar / FrappeFormSidebar), which stays as it is.
 *
 * Presentational only: data, stores, permissions, undo and routing stay in the app; accents are the host's border classes.
 * Literal class strings only: consumers compile the package's classes from dist (Tailwind path A).
 */

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/** Props a sortable list (e.g. dnd-kit) spreads on the card's grip. */
export interface RecordRailDragHandle {
  className?: string;
  style?: React.CSSProperties;
  [attr: string]: unknown;
}

/** The rail card surface (also used by hosts that draw their own header inside, e.g. FrappeAttachments' `className`). */
export const recordRailCardClass = (accent?: string, stacked = true) =>
  cn("group rounded-xl border bg-card p-4", stacked && "space-y-3", "shadow-sm hover:shadow-md transition-shadow", accent ?? RECORD_RAIL_DEFAULT_ACCENT);

/** Default accent: the theme primary at 20% (40% on hover). */
export const RECORD_RAIL_DEFAULT_ACCENT = "border-primary/20 hover:border-primary/40";

/* ── Card ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordRailCardProps {
  /** Card title (hosts bake a count in, e.g. "Contacts (3)"). Rendered uppercase. */
  title: React.ReactNode;
  icon: IconType;
  /** Header end slot: the "+" / pencil / × buttons or an indicator pill. */
  action?: React.ReactNode;
  /** Accent border classes, e.g. `"border-cyan-500/20 hover:border-cyan-500/40"`. Default: primary. */
  accent?: string;
  /** Grip props from a sortable list; the grip shows on hover either way. */
  dragHandle?: RecordRailDragHandle;
  dragLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

/** One rail card: a hover grip, the icon, the uppercase title and an end action; the body is the caller's rows. */
export function RecordRailCard({ title, icon: Icon, action, accent, dragHandle, dragLabel, className, children }: RecordRailCardProps) {
  const { t } = useLocale();
  const { className: gripClass, style: gripStyle, ...grip } = dragHandle ?? {};
  return (
    <div data-record-rail-card="" className={cn(recordRailCardClass(accent), className)}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="min-w-0 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 text-foreground">
          <span
            {...grip}
            className={cn(
              "inline-flex items-center justify-center h-5 w-4 shrink-0 rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 opacity-0 group-hover:opacity-100 transition-opacity",
              gripClass as string | undefined,
            )}
            style={gripStyle}
            title={dragLabel ?? t("rrDragToReorder")}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{title}</span>
        </h4>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ── Section (card + kind-driven header controls) ─────────────────────────────────────────────────────────────────── */

/**
 * The section's kind decides its header controls:
 *  - `process`: read-only (Lifecycle, SLA, Playbook);
 *  - `single`: one value — pencil "Change" and an optional × "Clear";
 *  - `multi`: label · (count) · "+" link;
 *  - `content`: label · optional "+" add (Tasks has none).
 */
export type RecordRailSectionSpec =
  | { kind: "process" }
  | { kind: "single"; onChange?: () => void; onClear?: () => void }
  | { kind: "multi"; count: number; onAdd?: () => void }
  | { kind: "content"; onAdd?: () => void };

export interface RecordRailSectionLabels { link?: string; add?: string; change?: string; clear?: string }

export interface RecordRailSectionProps extends Omit<RecordRailCardProps, "action" | "title"> {
  title: string;
  spec: RecordRailSectionSpec;
  /** Shown above the body (e.g. a "sample data" note). */
  notice?: React.ReactNode;
  labels?: RecordRailSectionLabels;
}

export function RecordRailSection({ title, spec, notice, labels, children, ...card }: RecordRailSectionProps) {
  const { t } = useLocale();
  const L = {
    link: labels?.link ?? t("rrLink"), add: labels?.add ?? t("rrAdd"), change: labels?.change ?? t("rrChange"), clear: labels?.clear ?? t("rrClear"),
  };
  const iconButton = (label: string, onClick: () => void, Icon: IconType, cls: string, iconCls: string) => (
    <Button type="button" variant="ghost" size="icon" onClick={onClick} aria-label={label} title={label} className={`h-7 w-7 ${cls}`}>
      <Icon className={iconCls} />
    </Button>
  );
  const action = (() => {
    if (spec.kind === "multi" && spec.onAdd) return iconButton(L.link, spec.onAdd, Plus, "text-primary", "h-4 w-4");
    if (spec.kind === "content" && spec.onAdd) return iconButton(L.add, spec.onAdd, Plus, "text-primary", "h-4 w-4");
    if (spec.kind === "single" && (spec.onChange || spec.onClear))
      return (
        <span className="flex items-center gap-0.5">
          {spec.onChange && iconButton(L.change, spec.onChange, Pencil, "text-muted-foreground", "h-3.5 w-3.5")}
          {spec.onClear && iconButton(L.clear, spec.onClear, X, "text-muted-foreground hover:text-destructive", "h-3.5 w-3.5")}
        </span>
      );
    // A `single` section without controls keeps the CRM's empty end slot (an empty span).
    if (spec.kind === "single") return <span className="flex items-center gap-0.5" />;
    return null;
  })();
  const count = spec.kind === "multi" && spec.count > 0 ? ` (${spec.count})` : "";
  return (
    <RecordRailCard {...card} title={`${title}${count}`} action={action}>
      {notice}
      {children}
    </RecordRailCard>
  );
}

/* ── Related-record row ───────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordRailRowProps {
  icon: IconType;
  /** Classes of the tinted icon square (bg + text). Default: muted. */
  iconTint?: string;
  /** Inline colours for the icon square (e.g. a record type's own colour). */
  iconStyle?: React.CSSProperties;
  /** Shown small above the name; a "#" is added when missing. */
  recordId?: string;
  name: string;
  /** Arabic name, shown when `isAr` (default: the ThemeProvider's language). */
  nameAr?: string;
  isAr?: boolean;
  subline?: React.ReactNode;
  /** Chip row under the name (stage, value, priority…). */
  chips?: React.ReactNode;
  /** Top-end action, revealed on hover / focus (unlink, set primary). */
  action?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/** One linked record in a rail card: icon square, #id, name (wraps, never cropped), subline, chips, hover action.
 *  Clickable rows are `div[role=button]` so hosts can nest their own buttons in `chips` / `action`. */
export function RecordRailRow({ icon: Icon, iconTint, iconStyle, recordId, name, nameAr, isAr, subline, chips, action, onClick, className }: RecordRailRowProps) {
  const { language } = useLocale();
  const ar = isAr ?? language === "ar";
  const displayName = (ar ? nameAr : name) || name || nameAr || "";
  const idText = recordId ? (recordId.startsWith("#") ? recordId : `#${recordId}`) : null;
  const clickable = !!onClick;
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
  };
  return (
    <div
      {...(clickable ? { role: "button", tabIndex: 0, onClick, onKeyDown } : {})}
      data-record-rail-row=""
      className={cn(
        "group/row w-full flex items-start gap-2.5 rounded-lg border border-border/60 bg-card p-2.5 text-start",
        clickable && "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span className={cn("h-8 w-8 shrink-0 rounded-md flex items-center justify-center mt-0.5", iconTint || "bg-muted text-muted-foreground")} style={iconStyle}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        {idText && <p className="font-mono text-[10px] leading-none text-muted-foreground mb-0.5">{idText}</p>}
        <p className="text-sm font-medium text-foreground leading-snug break-words" title={displayName || undefined}>{displayName}</p>
        {subline != null && subline !== "" && <p className="text-[11px] text-muted-foreground break-words mt-0.5">{subline}</p>}
        {chips != null && <div className="flex flex-wrap items-center gap-1.5 mt-1.5">{chips}</div>}
      </div>
      {action != null && (
        <div className="shrink-0 -me-0.5 -mt-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-within:opacity-100">
          {action}
        </div>
      )}
    </div>
  );
}

/* ── Customize sections ───────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordRailCustomizeOption { id: string; label: React.ReactNode }

export interface RecordRailCustomizeProps {
  options: RecordRailCustomizeOption[];
  visible: ReadonlySet<string>;
  onToggle: (id: string) => void;
  labels?: { trigger?: string; heading?: string };
  className?: string;
}

/** The "Customize sections" button and its "Visible sections" checklist. */
export function RecordRailCustomize({ options, visible, onToggle, labels, className }: RecordRailCustomizeProps) {
  const { t } = useLocale();
  const [open, setOpen] = React.useState(false);
  const heading = labels?.heading ?? t("rrVisibleSections");
  return (
    <div className={cn("mb-3 flex justify-end", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium transition-colors border-border bg-card hover:border-primary/40 hover:text-primary">
            <Settings2 className="h-3.5 w-3.5" />
            <span>{labels?.trigger ?? t("rrCustomize")}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-2">
          <p className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{heading}</p>
          <div className="space-y-0.5 max-h-80 overflow-y-auto" role="group" aria-label={heading}>
            {options.map((opt) => (
              <label key={opt.id} className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted text-start cursor-pointer">
                <Checkbox checked={visible.has(opt.id)} onCheckedChange={() => onToggle(opt.id)} className="shrink-0" />
                <span className="flex-1 truncate">{opt.label}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordRailFooterLine {
  label: string;
  /** Nothing is shown for a line without `who`. */
  who?: string;
  /** Short time, e.g. "3d ago" (shown as "· 3d ago"). */
  when?: string;
  /** Tooltip of the time (the exact date and time). */
  whenTitle?: string;
}

export interface RecordRailFooterProps {
  lines: RecordRailFooterLine[];
  seenBy?: { label: string; people: { name: string; title?: string }[] };
  className?: string;
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

/** The always-shown rail footer: Created by / Last edited by, and "Seen by" avatars. */
export function RecordRailFooter({ lines, seenBy, className }: RecordRailFooterProps) {
  return (
    <div data-record-rail-footer="" className={cn("space-y-3 rounded-xl border border-border bg-card p-4", className)}>
      <div className="space-y-1">
        {lines.map((l, i) => l.who ? (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{l.label}</span>
            <span className="font-medium text-foreground">{l.who}</span>
            {l.when != null && <span title={l.whenTitle}>· {l.when}</span>}
          </div>
        ) : null)}
      </div>
      {seenBy && seenBy.people.length > 0 && (
        <div className="flex items-center gap-2 border-t border-border pt-2.5">
          <span className="text-[11px] text-muted-foreground">{seenBy.label}</span>
          <div className="flex -space-x-1.5 rtl:space-x-reverse">
            {seenBy.people.map((p) => (
              <span key={p.name} title={p.title ?? p.name}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary ring-1 ring-background">
                {initials(p.name)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Modules ──────────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordRailAssignmentProps {
  /** The assignee UI: the package's AssigneeGroup (`variant="list" withDetails`), or FrappeAssignTo on Frappe data. */
  children: React.ReactNode;
  /** A detail row under the assignees (e.g. Team · Reservations). */
  team?: { label: string; value: string };
  /** "Auto-assign" (e.g. when the record's type has an assignment profile). */
  autoAssign?: { label: string; onClick: () => void };
  /** Anything after (e.g. the open assignments' ToDo details). */
  footer?: React.ReactNode;
  className?: string;
}

/** Assignment module body (put it in a `single` RecordRailSection): assignees, the team row, auto-assign, details. */
export function RecordRailAssignment({ children, team, autoAssign, footer, className }: RecordRailAssignmentProps) {
  return (
    <div data-record-rail-assignment="" className={cn("space-y-2.5 text-xs", className)}>
      {children}
      {team && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground flex-1">{team.label}</span>
          <span className="text-foreground font-medium truncate max-w-[55%] text-end">{team.value}</span>
        </div>
      )}
      {autoAssign && (
        <button type="button" onClick={autoAssign.onClick} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
          <Sparkles className="h-3 w-3" />{autoAssign.label}
        </button>
      )}
      {footer}
    </div>
  );
}

export interface RecordRailLinkedRecordProps extends Omit<RecordRailSectionProps, "spec" | "children"> {
  /** The linked record, or nothing (→ `emptyLabel`). */
  record?: Omit<RecordRailRowProps, "icon"> & { icon?: IconType };
  emptyLabel: string;
  /** Pencil "Change" (e.g. toggles the host's picker). */
  onChange?: () => void;
  /** × "Clear" (only while a record is linked). */
  onClear?: () => void;
  /** The host's picker (e.g. a LinkInput-based record picker), shown under the row while changing. */
  picker?: React.ReactNode;
}

/** A single linked record (e.g. the Organization of a deal): one row, Change / Clear in the header, a picker slot. */
export function RecordRailLinkedRecord({ record, emptyLabel, onChange, onClear, picker, icon, ...section }: RecordRailLinkedRecordProps) {
  return (
    <RecordRailSection {...section} icon={icon} spec={{ kind: "single", onChange, onClear: record ? onClear : undefined }}>
      {record ? <RecordRailRow {...record} icon={record.icon ?? icon} /> : <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
      {picker}
    </RecordRailSection>
  );
}

export interface RecordRailTask {
  id: string;
  title: string;
  titleAr?: string;
  /** e.g. "Assignee: Layla". */
  subline?: React.ReactNode;
  /** The task's state, as an outline badge. */
  status?: string;
  /** "Open in My Work" link under the row (omit when the user may not open it). */
  onOpen?: () => void;
}

export interface RecordRailTasksProps extends Omit<RecordRailSectionProps, "spec" | "children" | "icon"> {
  icon?: IconType;
  tasks: RecordRailTask[];
  emptyLabel: string;
  openLabel: string;
  /** Rows shown (default 5). */
  max?: number;
  /** Optional "+" (the CRM creates tasks in My Work, so its rail has none). */
  onAdd?: () => void;
  /** Icon-square classes of each row (default: primary tint). */
  iconTint?: string;
  isAr?: boolean;
}

/** Tasks module: the record's linked tasks (count in the title), each with its state and an "Open in …" link. */
export function RecordRailTasks({ title, tasks, emptyLabel, openLabel, max = 5, onAdd, iconTint = "bg-primary/10 text-primary", isAr, icon = CheckSquare, ...section }: RecordRailTasksProps) {
  return (
    <RecordRailSection {...section} icon={icon} title={`${title}${tasks.length ? ` (${tasks.length})` : ""}`} spec={{ kind: "content", onAdd }}>
      {tasks.length === 0 && <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
      {tasks.slice(0, max).map((w) => (
        <div key={w.id} className="space-y-1" data-record-rail-task={w.id}>
          <RecordRailRow isAr={isAr} icon={icon} iconTint={iconTint} name={w.title} nameAr={w.titleAr} subline={w.subline}
            chips={w.status ? <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">{w.status}</Badge> : undefined} />
          {w.onOpen && (
            <button type="button" onClick={w.onOpen} className="ms-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
              <ExternalLink className="h-3 w-3" />{openLabel}
            </button>
          )}
        </div>
      ))}
    </RecordRailSection>
  );
}

export interface RecordRailArticle {
  id: string;
  title: string;
  /** Second line, e.g. "FAQ · from Senaiy-Pedia". */
  meta?: React.ReactNode;
}

export interface RecordRailArticlesProps {
  articles: RecordRailArticle[];
  onOpen: (id: string) => void;
  title?: string;
  className?: string;
}

/** Articles module: the knowledge articles attached to the record's app / module / type. Nothing when there are none. */
export function RecordRailArticles({ articles, onOpen, title, className }: RecordRailArticlesProps) {
  const { t } = useLocale();
  if (articles.length === 0) return null;
  return (
    <div data-record-rail-articles="" className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{title ?? t("rrArticles")}</h3>
        </div>
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
          {articles.length}
        </span>
      </div>
      <div className="divide-y divide-border/60">
        {articles.map((a) => (
          <button key={a.id} type="button" onClick={() => onOpen(a.id)}
            className="w-full flex items-center gap-3 p-3 text-start transition-colors hover:bg-muted/50 cursor-pointer">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium truncate">{a.title}</span>
              {a.meta != null && <span className="block text-[11px] text-muted-foreground truncate">{a.meta}</span>}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          </button>
        ))}
      </div>
    </div>
  );
}

export interface RecordRailArticleReaderProps {
  open: boolean;
  onClose: () => void;
  /** Small line above the title, e.g. "FAQ · from Senaiy-Pedia". */
  kicker?: React.ReactNode;
  title?: React.ReactNode;
  /** The article body (the host renders / sanitises its own content). */
  children?: React.ReactNode;
  /** "Open in …" escape link at the bottom. */
  link?: { href: string; label: string; icon?: React.ReactNode };
  /** Default: the end side of the reading direction (right in LTR, left in RTL). */
  side?: "left" | "right";
}

/** The read-only slide-in article reader (single close: the sheet's own). */
export function RecordRailArticleReader({ open, onClose, kicker, title, children, link, side }: RecordRailArticleReaderProps) {
  const { isRTL } = useLocale();
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side={side ?? (isRTL ? "left" : "right")} className="w-full sm:max-w-xl p-0 overflow-y-auto">
        {open && (
          <article className="p-6" data-record-rail-article="">
            <div className="mb-4 pe-8">
              {kicker != null && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                  <FileText className="h-3.5 w-3.5" />
                  {kicker}
                </div>
              )}
              <h2 className="text-xl font-bold text-primary leading-snug">{title}</h2>
            </div>
            {children}
            {link && (
              <div className="mt-6 pt-4 border-t border-border">
                <a href={link.href} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  {link.icon}
                  {link.label}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:rotate-90" />
                </a>
              </div>
            )}
          </article>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ── The rail ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

export interface RecordRailSectionDef {
  id: string;
  /** The section's name in "Customize sections". */
  label: React.ReactNode;
  /** The section (usually a RecordRailSection or a module); may return null when it does not apply right now. */
  render: () => React.ReactNode;
  /** Always shown, first, and not listed in Customize (the CRM's Lifecycle). */
  pinned?: boolean;
}

export interface RecordRailProps {
  /** The sections, in order. */
  sections: RecordRailSectionDef[];
  /** Visible (non-pinned) section ids — controlled. */
  visible?: ReadonlySet<string>;
  onVisibleChange?: (visible: Set<string>) => void;
  /** Uncontrolled initial visible ids (default: every section). */
  defaultVisible?: Iterable<string>;
  /** Opt-in persistence of the hidden ids in localStorage (`sf-record-rail:<key>`); the CRM keeps it per page view. */
  storageKey?: string;
  /** Show "Customize sections" (default true). */
  customize?: boolean;
  customizeLabels?: RecordRailCustomizeProps["labels"];
  /** After the sections (e.g. a RecordRailFooter). */
  footer?: React.ReactNode;
  /** After the footer, outside Customize (e.g. RecordRailArticles). */
  after?: React.ReactNode;
  className?: string;
}

const storageName = (key: string) => `sf-record-rail:${key}`;
function readHidden(key: string | undefined): string[] | null {
  if (!key) return null;
  try { const v = JSON.parse(window.localStorage.getItem(storageName(key)) ?? "null"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : null; } catch { return null; }
}

/** The whole rail: Customize, pinned sections, the visible sections in order, the footer, then `after`. Renders an `aside`. */
export function RecordRail({ sections, visible, onVisibleChange, defaultVisible, storageKey, customize = true, customizeLabels, footer, after, className }: RecordRailProps) {
  const toggleable = sections.filter((s) => !s.pinned);
  const [own, setOwn] = React.useState<Set<string>>(() => {
    const hidden = readHidden(storageKey);
    if (hidden) return new Set(toggleable.map((s) => s.id).filter((id) => !hidden.includes(id)));
    return new Set(defaultVisible ?? toggleable.map((s) => s.id));
  });
  const shown = visible ?? own;
  const toggle = (id: string) => {
    const next = new Set(shown);
    if (next.has(id)) next.delete(id); else next.add(id);
    if (!visible) setOwn(next);
    if (storageKey) {
      try { window.localStorage.setItem(storageName(storageKey), JSON.stringify(toggleable.map((s) => s.id).filter((x) => !next.has(x)))); } catch { /* storage unavailable */ }
    }
    onVisibleChange?.(next);
  };
  return (
    <aside data-record-rail="" className={className}>
      {customize && toggleable.length > 0 && (
        <RecordRailCustomize options={toggleable.map((s) => ({ id: s.id, label: s.label }))} visible={shown} onToggle={toggle} labels={customizeLabels} />
      )}
      {sections.filter((s) => s.pinned).map((s) => <React.Fragment key={s.id}>{s.render()}</React.Fragment>)}
      {toggleable.filter((s) => shown.has(s.id)).map((s) => <React.Fragment key={s.id}>{s.render()}</React.Fragment>)}
      {footer}
      {after}
    </aside>
  );
}
