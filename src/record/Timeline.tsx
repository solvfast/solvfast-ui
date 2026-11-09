import * as React from "react";
import { ChevronDown, ExternalLink, FilePlus2, GitBranch, Globe2, Heart, Info, Link2, Lock, MessageSquare, Paperclip, Pencil, PencilLine, Trash2, UserCheck, Activity } from "lucide-react";
import { cn } from "../lib/cn";
import { relativeTime } from "../lib/relative-time";
import { Button } from "../primitives/button";
import { Skeleton } from "../primitives/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "../primitives/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../primitives/alert-dialog";
import { useLocale } from "../theme/ThemeProvider";
import { CommentComposer, type CommentComposerLabels } from "./CommentComposer";
import { errorText, fmt, stripIsolates } from "./format";
import { sanitizeCommentHtml } from "./sanitize";
import type { MentionOption, TimelineItem, TimelineKind, Tone } from "./types";

export type TimelineFilter = "all" | "comments" | "changes";

/**
 * P36d history: optional extras an entry may carry (all additive; `TimelineItem` alone renders exactly as before).
 * - `actorImage`: the actor's avatar URL (Desk `frappe.avatar(owner)`, timeline_message_box.html) — shown with `showAvatars`.
 * - `card`: render a non-comment entry as a card with its `body` (Desk `is_card`: communications, automated messages,
 *   `additional_timeline_content` with `is_card`, base_timeline.js:135-141).
 * - `subject`, `status` (Desk's delivery-status pill, form_timeline.js:298-311), `attachments` (template :89-109): card details.
 */
export interface TimelineItemExtras {
  actorImage?: string | null;
  card?: boolean;
  subject?: string;
  status?: { label: string; tone?: Tone };
  attachments?: Array<{ name: string; url: string; isPrivate?: boolean }>;
}
export type TimelineEntry = TimelineItem & TimelineItemExtras;
/** "compact" = "12m ago" (default); "desk" = Frappe's `comment_when` / prettyDate long form ("yesterday", "3 weeks ago"). */
export type TimelineTimeFormat = "compact" | "desk";

export interface TimelineLabels {
  all?: string; comments?: string; changes?: string; loadMore?: string; loading?: string; empty?: string; edit?: string; delete?: string;
  deleteTitle?: string; deleteBody?: string; cancel?: string; heading?: string; save?: string;
  /** P36b social: comment publicity (form_timeline.js:620-625, 734-760). */
  publish?: string; unpublish?: string; published?: string; publishedTitle?: string; publishBody?: string; unpublishBody?: string;
  /** P36d history: card actions. */
  copyLink?: string; copied?: string; openItem?: string; privateFile?: string; attachments?: string;
}

export interface TimelineProps {
  /** Entries; `TimelineItemExtras` fields are optional (P36d history). */
  items: TimelineEntry[];
  /** Default "newest-first". Sorting is by `at`; ties keep the given order. */
  order?: "newest-first" | "oldest-first";
  loading?: boolean;
  /** Rendered instead of the list when set (use a `<FrappeErrorState>` or any node). */
  error?: React.ReactNode;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Filter chips (All / Comments / Changes). Default off. */
  showFilters?: boolean;
  /** Kinds never shown (the CRM hides lifecycle `state` entries — they live in the lifecycle widget). */
  hiddenKinds?: TimelineKind[];
  onEditComment?: (item: TimelineItem, html: string) => void | Promise<unknown>;
  onDeleteComment?: (item: TimelineItem) => void | Promise<unknown>;
  /**
   * P36b social: Desk's comment "Publish" / "Unpublish" (form_timeline.js:620-625 — the author or a System Manager;
   * `update_comment_publicity`, desk/form/utils.py:72-79). Shown on comments for which `canPublish(item)` is true; asks
   * for confirmation first (form_timeline.js:734-748). `isPublished` marks a comment "Published" (timeline_message_box.html).
   */
  onTogglePublish?: (item: TimelineItem, publish: boolean) => void | Promise<unknown>;
  canPublish?: (item: TimelineItem) => boolean;
  isPublished?: (item: TimelineItem) => boolean;
  searchMentions?: (query: string) => Promise<MentionOption[]>;
  composerLabels?: CommentComposerLabels;
  labels?: TimelineLabels;
  /**
   * P35 (G13): makes non-comment entries selectable (e.g. open the email / call behind it). The summary becomes a button
   * (or, with `href`, the link also calls this first — `preventDefault()` on the event to handle navigation yourself).
   */
  onItemSelect?: (item: TimelineItem, event: React.MouseEvent<HTMLElement>) => void;
  /** P35 (G13): show the actor's name before the summary of non-comment entries (when the summary does not carry it). */
  showActor?: boolean;
  /** Fixed "now" for relative times (tests). */
  now?: number;
  /**
   * P36d history: relative-time wording. Default "compact" (unchanged). "desk" reproduces Frappe's `comment_when`
   * (pretty_date.js:46-76: "just now", "1 minute ago", "yesterday", "3 weeks ago", "1 year ago"). The absolute date and time
   * is always the `<time>` element's title (comment_when's `title`, pretty_date.js:81-93) in the active language.
   */
  timeFormat?: TimelineTimeFormat;
  /** P36d history: show the author's avatar (image, else initials) on comment and card entries (Desk `frappe.avatar`). Default false. */
  showAvatars?: boolean;
  /** P36d history: a shareable link for an entry → a "Copy Link" action on comment / card entries (form_timeline.js:767-773). */
  itemLink?: (item: TimelineEntry) => string | undefined;
  className?: string;
}

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground", success: "text-success", warning: "text-warning", danger: "text-destructive", info: "text-info", brand: "text-primary",
};

/** The entry's icon: the item's own (`item.icon`) or the per-kind one; `tone` tints it. */
function EntryIcon({ item, fallback, className }: { item: TimelineItem; fallback: string; className: string }) {
  const tint = item.tone ? TONE_TEXT[item.tone] : fallback;
  if (item.icon != null && item.icon !== false) {
    return <span aria-hidden data-item-icon="" className={cn("inline-flex shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5", className, tint)}>{item.icon}</span>;
  }
  const Icon = ICON[item.kind] ?? Activity;
  return <Icon className={cn("h-3.5 w-3.5", className, tint)} aria-hidden />;
}

const ICON: Record<TimelineKind, React.ComponentType<{ className?: string }>> = {
  comment: MessageSquare, change: PencilLine, assignment: UserCheck, attachment: Paperclip, state: GitBranch, created: FilePlus2, modified: Pencil,
  info: Info, like: Heart, communication: MessageSquare, custom: Activity,
};

const DAY_MS = 86_400_000;
/** Frappe's prettyDate long form (pretty_date.js:14-76): calendar-day difference, then seconds within the same day. */
export function deskRelativeTime(at: number, t: (key: "hisJustNow" | "hisMinuteAgo" | "hisMinutesAgo" | "hisHourAgo" | "hisHoursAgo" | "hisYesterday" | "hisDaysAgo" | "hisWeekAgo" | "hisWeeksAgo" | "hisMonthAgo" | "hisMonthsAgo" | "hisYearAgo" | "hisYearsAgo") => string, now: number = Date.now()): string {
  const diff = (now - at) / 1000;
  const n = new Date(now); const d = new Date(at);
  const dayDiff = Math.floor((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY_MS);
  if (Number.isNaN(dayDiff) || dayDiff < 0) return "";
  if (dayDiff === 0) {
    if (diff < 60) return t("hisJustNow");
    if (diff < 120) return t("hisMinuteAgo");
    if (diff < 3600) return fmt(t("hisMinutesAgo"), Math.floor(diff / 60));
    if (diff < 7200) return t("hisHourAgo");
    return fmt(t("hisHoursAgo"), Math.floor(diff / 3600));
  }
  if (dayDiff === 1) return t("hisYesterday");
  if (dayDiff < 7) return fmt(t("hisDaysAgo"), dayDiff);
  if (dayDiff < 14) return t("hisWeekAgo");
  if (dayDiff < 31) return fmt(t("hisWeeksAgo"), Math.floor(dayDiff / 7));
  if (dayDiff < 62) return t("hisMonthAgo");
  if (dayDiff < 365) return fmt(t("hisMonthsAgo"), Math.floor(dayDiff / 30));
  if (dayDiff < 730) return t("hisYearAgo");
  return fmt(t("hisYearsAgo"), Math.floor(dayDiff / 365));
}

/** The absolute date and time in the active language (Latin digits, like the CRM's other dates). */
export function absoluteTime(at: number, language?: string): string {
  try {
    return new Intl.DateTimeFormat(language === "ar" ? "ar-u-nu-latn" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(at));
  } catch { return new Date(at).toLocaleString(); }
}

const initialsOf = (name?: string) => (name ?? "").replace(/[\u2068\u2069]/g, "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
function ActorAvatar({ item }: { item: TimelineEntry }) {
  return (
    <Avatar className="h-6 w-6 text-[10px] font-medium" data-avatar="" aria-hidden>
      {item.actorImage ? <AvatarImage src={item.actorImage} alt="" /> : null}
      <AvatarFallback className="bg-primary/10 text-primary">{initialsOf(item.actor)}</AvatarFallback>
    </Avatar>
  );
}

/** "Copy Link": copies `link`, then says so for 2 s (Desk: frappe.utils.copy_to_clipboard → "Copied to clipboard"). */
function CopyLinkButton({ link, label, copiedLabel }: { link: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { if (!copied) return; const h = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(h); }, [copied]);
  return (
    <>
      <button type="button" aria-label={label} title={label} data-copy-link=""
        onClick={async () => { try { await navigator.clipboard?.writeText(link); setCopied(true); } catch { /* clipboard blocked */ } }}
        className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Link2 className="h-3 w-3" aria-hidden /></button>
      {copied ? <span role="status" className="text-[11px] text-muted-foreground">{copiedLabel}</span> : null}
    </>
  );
}

const STATUS_PILL: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground", success: "bg-success/10 text-success", warning: "bg-warning/10 text-warning", danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info", brand: "bg-primary/10 text-primary",
};

/**
 * Summaries carry U+2068 ... U+2069 around interpolated tokens (RTL word order). Rendered text turns each isolated span into a `<bdi>`
 * (no invisible characters in the DOM, so copied text and search stay clean); plain-text uses call `stripIsolates`.
 */
export function renderIsolated(text: string): React.ReactNode {
  if (!/[\u2068\u2069]/.test(text)) return text;
  let i = 0;
  const parse = (): React.ReactNode[] => {
    const out: React.ReactNode[] = []; let buf = "";
    while (i < text.length) {
      const c = text[i++];
      if (c === "\u2068") { if (buf) { out.push(buf); buf = ""; } const kids = parse(); out.push(<bdi key={out.length}>{kids}</bdi>); }
      else if (c === "\u2069") break;
      else buf += c;
    }
    if (buf) out.push(buf);
    return out;
  };
  return <>{parse()}</>;
}

export function filterItems<T extends TimelineItem>(items: T[], filter: TimelineFilter, hidden: TimelineKind[] = []): T[] {
  return items.filter((i) => !hidden.includes(i.kind) && (filter === "all" || (filter === "comments" ? i.kind === "comment" : i.kind !== "comment")));
}
export function sortItems<T extends TimelineItem>(items: T[], order: "newest-first" | "oldest-first"): T[] {
  const s = items.map((it, n) => ({ it, n })).sort((a, b) => (a.it.at - b.it.at) || (a.n - b.n)).map((x) => x.it);
  return order === "newest-first" ? s.reverse() : s;
}

function Entry({ item, now, isRTL, L, onEdit, onDelete, searchMentions, composerLabels, onSelect, showActor, onPublish, canPublish, published, timeFormat, showAvatars, link }: {
  item: TimelineEntry; now?: number; isRTL: boolean; L: Required<TimelineLabels>; timeFormat: TimelineTimeFormat; showAvatars?: boolean; link?: string;
  onEdit?: TimelineProps["onEditComment"]; onDelete?: TimelineProps["onDeleteComment"];
  onPublish?: TimelineProps["onTogglePublish"]; canPublish?: boolean; published?: boolean;
  searchMentions?: TimelineProps["searchMentions"]; composerLabels?: CommentComposerLabels;
  onSelect?: TimelineProps["onItemSelect"]; showActor?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [confirmPub, setConfirmPub] = React.useState(false);
  const [err, setErr] = React.useState("");
  const { t, language } = useLocale();
  const showChangesLabel = t("coreShowChanges");
  const when = (
    <time dateTime={new Date(item.at).toISOString()} title={absoluteTime(item.at, language)} className="text-[11px] text-muted-foreground">
      {timeFormat === "desk" ? deskRelativeTime(item.at, t, now) : relativeTime(item.at, isRTL, now)}
    </time>
  );
  const copy = link ? <CopyLinkButton link={link} label={L.copyLink} copiedLabel={L.copied} /> : null;

  if (item.kind === "comment") {
    const body = item.bodyFormat === "text"
      ? <p className="whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
      : <div className="prose-sm break-words text-sm text-foreground [&_.mention]:rounded [&_.mention]:bg-primary/10 [&_.mention]:px-1 [&_.mention]:text-primary [&_a]:text-primary [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:ps-2" dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(item.body ?? "") }} />;
    return (
      <li id={`comment-${item.id}`} className="rounded-lg border border-border bg-card p-3" data-kind="comment">
        <div className="mb-1 flex items-center gap-1.5">
          {showAvatars ? <ActorAvatar item={item} /> : <EntryIcon item={item} fallback="text-primary" className="" />}
          <bdi className="text-sm font-medium text-foreground">{item.actor}</bdi><span aria-hidden className="text-muted-foreground">·</span>{when}
          {published ? <><span aria-hidden className="text-muted-foreground">·</span><span className="text-[11px] text-muted-foreground" title={L.publishedTitle} data-published="">{L.published}</span></> : null}
          {!editing && (item.canEdit || item.canDelete || (canPublish && onPublish) || copy) ? (
            <span className="ms-auto flex items-center gap-1">
              {copy}
              {canPublish && onPublish ? <button type="button" onClick={() => setConfirmPub(true)} aria-label={published ? L.unpublish : L.publish} title={published ? L.unpublish : L.publish} className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Globe2 className="h-3 w-3" aria-hidden /></button> : null}
              {item.canEdit && onEdit ? <button type="button" onClick={() => setEditing(true)} aria-label={L.edit} title={L.edit} className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Pencil className="h-3 w-3" aria-hidden /></button> : null}
              {item.canDelete && onDelete ? <button type="button" onClick={() => setConfirmDel(true)} aria-label={L.delete} title={L.delete} className="rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-3 w-3" aria-hidden /></button> : null}
            </span>
          ) : null}
        </div>
        {editing ? (
          <CommentComposer initialHtml={item.body ?? ""} autoFocus searchMentions={searchMentions} labels={{ ...composerLabels, submit: L.save }}
            onCancel={() => setEditing(false)} onSubmit={async (html) => { await onEdit?.(item, html); setEditing(false); }} className="border-0 p-0" />
        ) : body}
        {err ? <p role="alert" className="mt-1 text-xs text-destructive">{err}</p> : null}
        {canPublish && onPublish ? (
          <AlertDialog open={confirmPub} onOpenChange={setConfirmPub}>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>{published ? L.unpublish : L.publish}</AlertDialogTitle><AlertDialogDescription>{published ? L.unpublishBody : L.publishBody}</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{L.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={async () => { setErr(""); try { await onPublish(item, !published); } catch (e) { setErr(errorText(e)); } }}>{published ? L.unpublish : L.publish}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
        <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{L.deleteTitle}</AlertDialogTitle><AlertDialogDescription>{L.deleteBody}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{L.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { setErr(""); try { await onDelete?.(item); } catch (e) { setErr(errorText(e)); } }}>{L.delete}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </li>
    );
  }

  if (item.card && item.body != null) {
    const body = item.bodyFormat === "text"
      ? <p className="whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
      : <div className="prose-sm break-words text-sm text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:ps-2" dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(item.body) }} />;
    return (
      <li id={item.id} className="rounded-lg border border-border bg-card p-3" data-kind={item.kind} data-card="">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {showAvatars && item.actor ? <ActorAvatar item={item} /> : <EntryIcon item={item} fallback="text-muted-foreground" className="" />}
          {item.actor ? <><bdi className="text-sm font-medium text-foreground">{item.actor}</bdi><span aria-hidden className="text-muted-foreground">·</span></> : null}
          {when}
          <span className="ms-auto flex items-center gap-1">
            {item.status ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_PILL[item.status.tone ?? "neutral"])} data-status="">{item.status.label}</span> : null}
            {item.href ? <a href={item.href} onClick={onSelect ? (e) => onSelect(item, e) : undefined} aria-label={L.openItem} title={L.openItem}
              className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ExternalLink className="h-3 w-3" aria-hidden /></a> : null}
            {copy}
          </span>
        </div>
        {item.subject ? <p className="mb-1 text-sm text-muted-foreground" data-subject=""><bdi>{item.subject}</bdi></p> : null}
        {body}
        {item.attachments?.length ? (
          <ul className="mt-2 space-y-0.5" aria-label={L.attachments}>
            {item.attachments.map((a) => (
              <li key={a.url} className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline"><bdi>{a.name}</bdi></a>
                {a.isPrivate ? <Lock className="h-3 w-3 shrink-0 text-warning" aria-label={L.privateFile} /> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  const multi = (item.changes?.length ?? 0) > 0;
  return (
    <li className="flex gap-2 px-1 py-1.5 text-sm" data-kind={item.kind}>
      <EntryIcon item={item} fallback="text-muted-foreground" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          {showActor && item.actor ? <bdi className="font-medium text-foreground" data-actor="">{item.actor}</bdi> : null}
          {item.href ? <a href={item.href} onClick={onSelect ? (e) => onSelect(item, e) : undefined} className="text-foreground underline-offset-2 hover:underline">{renderIsolated(item.summary ?? "")}</a>
            : onSelect ? (
              <button type="button" onClick={(e) => onSelect(item, e)} data-item-select=""
                className="rounded text-start text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{renderIsolated(item.summary ?? "")}</button>
            ) : <span className="text-muted-foreground">{renderIsolated(item.summary ?? "")}</span>}
          <span aria-hidden className="text-muted-foreground">·</span>{when}
          {multi ? (
            <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
              // with onItemSelect the summary is a button too: give the toggle its own name (P35 G13)
              aria-label={onSelect ? `${stripIsolates(item.summary ?? "")} — ${showChangesLabel}` : stripIsolates(item.summary ?? "")}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
            </button>
          ) : null}
        </div>
        {multi && open ? (
          <ul className="mt-1 space-y-0.5 ps-3 text-[13px] text-muted-foreground">
            {item.changes!.map((c, i) => (
              <li key={i}><bdi>{c.label}</bdi>{c.row != null ? ` #${c.row + 1}` : ""}: <bdi className="text-foreground">{c.before || "—"}</bdi> <span aria-hidden>{isRTL ? "←" : "→"}</span> <bdi className="text-foreground">{c.after || "—"}</bdi></li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/** The record's activity feed. Everything it shows is already resolved into `TimelineItem`s by the caller. */
export function Timeline({
  items, order = "newest-first", loading, error, hasMore, loadingMore, onLoadMore, showFilters, hiddenKinds, onEditComment, onDeleteComment,
  searchMentions, composerLabels, labels, now, className, onItemSelect, showActor, onTogglePublish, canPublish, isPublished,
  timeFormat = "compact", showAvatars, itemLink,
}: TimelineProps) {
  const { t, isRTL } = useLocale();
  const L: Required<TimelineLabels> = {
    all: labels?.all ?? t("recFilterAll"), comments: labels?.comments ?? t("recFilterComments"), changes: labels?.changes ?? t("recFilterChanges"),
    loadMore: labels?.loadMore ?? t("recLoadMore"), loading: labels?.loading ?? t("recLoading"), empty: labels?.empty ?? t("recNoActivity"),
    edit: labels?.edit ?? t("recEdit"), delete: labels?.delete ?? t("recDelete"), deleteTitle: labels?.deleteTitle ?? t("recDeleteCommentTitle"),
    deleteBody: labels?.deleteBody ?? t("recDeleteCommentBody"), cancel: labels?.cancel ?? t("recCancel"), heading: labels?.heading ?? t("recActivity"), save: labels?.save ?? t("recSave"),
    publish: labels?.publish ?? t("socPublish"), unpublish: labels?.unpublish ?? t("socUnpublish"), published: labels?.published ?? t("socPublished"),
    publishedTitle: labels?.publishedTitle ?? t("socPublishedTitle"), publishBody: labels?.publishBody ?? t("socPublishBody"), unpublishBody: labels?.unpublishBody ?? t("socUnpublishBody"),
    copyLink: labels?.copyLink ?? t("hisCopyLink"), copied: labels?.copied ?? t("hisCopied"), openItem: labels?.openItem ?? t("hisOpenCommunication"),
    privateFile: labels?.privateFile ?? t("hisPrivateFile"), attachments: labels?.attachments ?? t("hisAttachments"),
  };
  const [filter, setFilter] = React.useState<TimelineFilter>("all");
  const shown = React.useMemo(() => sortItems(filterItems(items, filter, hiddenKinds), order), [items, filter, hiddenKinds, order]);
  const chips: Array<[TimelineFilter, string]> = [["all", L.all], ["comments", L.comments], ["changes", L.changes]];

  return (
    <section className={cn("space-y-3", className)} aria-label={L.heading} aria-busy={loading || undefined}>
      {showFilters ? (
        <div className="flex items-center gap-1.5" role="group" aria-label={L.heading}>
          {chips.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
              className={cn("h-7 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === k ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>{label}</button>
          ))}
        </div>
      ) : null}
      {error ? <div>{error}</div> : loading ? (
        <div className="space-y-2" role="status" aria-label={L.loading}><Skeleton className="h-12 w-full" /><Skeleton className="h-8 w-3/4" /><Skeleton className="h-8 w-2/3" /></div>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{L.empty}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((it) => (
            <Entry key={it.id} item={it} now={now} isRTL={isRTL} L={L} onEdit={onEditComment} onDelete={onDeleteComment} searchMentions={searchMentions} composerLabels={composerLabels}
              onSelect={onItemSelect} showActor={showActor}
              onPublish={onTogglePublish} canPublish={it.kind === "comment" && !!canPublish?.(it)} published={it.kind === "comment" && !!isPublished?.(it)}
              timeFormat={timeFormat} showAvatars={showAvatars} link={itemLink?.(it)} />
          ))}
        </ul>
      )}
      {hasMore && onLoadMore && !error ? (
        <div className="flex justify-center"><Button type="button" size="sm" variant="outline" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? L.loading : L.loadMore}</Button></div>
      ) : null}
    </section>
  );
}
