import * as React from "react";
import { ChevronDown, FilePlus2, GitBranch, Heart, Info, MessageSquare, Paperclip, Pencil, PencilLine, Trash2, UserCheck, Activity } from "lucide-react";
import { cn } from "../lib/cn";
import { relativeTime } from "../lib/relative-time";
import { Button } from "../primitives/button";
import { Skeleton } from "../primitives/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../primitives/alert-dialog";
import { useLocale } from "../theme/ThemeProvider";
import { CommentComposer, type CommentComposerLabels } from "./CommentComposer";
import { errorText, stripIsolates } from "./format";
import { sanitizeCommentHtml } from "./sanitize";
import type { MentionOption, TimelineItem, TimelineKind, Tone } from "./types";

export type TimelineFilter = "all" | "comments" | "changes";

export interface TimelineLabels {
  all?: string; comments?: string; changes?: string; loadMore?: string; loading?: string; empty?: string; edit?: string; delete?: string;
  deleteTitle?: string; deleteBody?: string; cancel?: string; heading?: string; save?: string;
}

export interface TimelineProps {
  items: TimelineItem[];
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

export function filterItems(items: TimelineItem[], filter: TimelineFilter, hidden: TimelineKind[] = []): TimelineItem[] {
  return items.filter((i) => !hidden.includes(i.kind) && (filter === "all" || (filter === "comments" ? i.kind === "comment" : i.kind !== "comment")));
}
export function sortItems(items: TimelineItem[], order: "newest-first" | "oldest-first"): TimelineItem[] {
  const s = items.map((it, n) => ({ it, n })).sort((a, b) => (a.it.at - b.it.at) || (a.n - b.n)).map((x) => x.it);
  return order === "newest-first" ? s.reverse() : s;
}

function Entry({ item, now, isRTL, L, onEdit, onDelete, searchMentions, composerLabels, onSelect, showActor }: {
  item: TimelineItem; now?: number; isRTL: boolean; L: Required<TimelineLabels>;
  onEdit?: TimelineProps["onEditComment"]; onDelete?: TimelineProps["onDeleteComment"];
  searchMentions?: TimelineProps["searchMentions"]; composerLabels?: CommentComposerLabels;
  onSelect?: TimelineProps["onItemSelect"]; showActor?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [err, setErr] = React.useState("");
  const showChangesLabel = useLocale().t("coreShowChanges");
  const when = <time dateTime={new Date(item.at).toISOString()} title={new Date(item.at).toLocaleString()} className="text-[11px] text-muted-foreground">{relativeTime(item.at, isRTL, now)}</time>;

  if (item.kind === "comment") {
    const body = item.bodyFormat === "text"
      ? <p className="whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
      : <div className="prose-sm break-words text-sm text-foreground [&_.mention]:rounded [&_.mention]:bg-primary/10 [&_.mention]:px-1 [&_.mention]:text-primary [&_a]:text-primary [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:ps-2" dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(item.body ?? "") }} />;
    return (
      <li id={`comment-${item.id}`} className="rounded-lg border border-border bg-card p-3" data-kind="comment">
        <div className="mb-1 flex items-center gap-1.5">
          <EntryIcon item={item} fallback="text-primary" className="" />
          <bdi className="text-sm font-medium text-foreground">{item.actor}</bdi><span aria-hidden className="text-muted-foreground">·</span>{when}
          {!editing && (item.canEdit || item.canDelete) ? (
            <span className="ms-auto flex items-center gap-1">
              {item.canEdit && onEdit ? <button type="button" onClick={() => setEditing(true)} aria-label={L.edit} title={L.edit} className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Pencil className="h-3 w-3" aria-hidden /></button> : null}
              {item.canDelete && onDelete ? <button type="button" onClick={() => setConfirmDel(true)} aria-label={L.delete} title={L.delete} className="rounded p-1 text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-3 w-3" aria-hidden /></button> : null}
            </span>
          ) : null}
        </div>
        {editing ? (
          <CommentComposer initialHtml={item.body ?? ""} autoFocus searchMentions={searchMentions} labels={{ ...composerLabels, submit: composerLabels?.submit ?? L.save }}
            onCancel={() => setEditing(false)} onSubmit={async (html) => { await onEdit?.(item, html); setEditing(false); }} className="border-0 p-0" />
        ) : body}
        {err ? <p role="alert" className="mt-1 text-xs text-destructive">{err}</p> : null}
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
  searchMentions, composerLabels, labels, now, className, onItemSelect, showActor,
}: TimelineProps) {
  const { t, isRTL } = useLocale();
  const L: Required<TimelineLabels> = {
    all: labels?.all ?? t("recFilterAll"), comments: labels?.comments ?? t("recFilterComments"), changes: labels?.changes ?? t("recFilterChanges"),
    loadMore: labels?.loadMore ?? t("recLoadMore"), loading: labels?.loading ?? t("recLoading"), empty: labels?.empty ?? t("recNoActivity"),
    edit: labels?.edit ?? t("recEdit"), delete: labels?.delete ?? t("recDelete"), deleteTitle: labels?.deleteTitle ?? t("recDeleteCommentTitle"),
    deleteBody: labels?.deleteBody ?? t("recDeleteCommentBody"), cancel: labels?.cancel ?? t("recCancel"), heading: labels?.heading ?? t("recActivity"), save: labels?.save ?? t("recSave"),
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
              onSelect={onItemSelect} showActor={showActor} />
          ))}
        </ul>
      )}
      {hasMore && onLoadMore && !error ? (
        <div className="flex justify-center"><Button type="button" size="sm" variant="outline" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? L.loading : L.loadMore}</Button></div>
      ) : null}
    </section>
  );
}
