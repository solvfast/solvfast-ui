/**
 * FrappeComments — a document's comments (P36b social): Desk's comment box and the comment entries of the form
 * timeline, or (variant "count") the sidebar's comment counter. Frappe 15.110 `form/footer/footer.js:21-58`,
 * `form/footer/form_timeline.js:330-356, 607-760`, `form/templates/timeline_message_box.html`,
 * `form/sidebar/form_sidebar.js:51-55, 253-256`. Rules in ./comments.ts.
 *
 * - Reads `docinfo.comments` through the package's shared docinfo query (`useRecordDocInfo` → `frappeKeys.docinfo`).
 *   Every comment is listed — docinfo is not paged for comments (load.py:156-160); there is no "load more" here.
 * - Add / edit / delete go through `useDocAction` (add_comment, update_comment, frappe.client.delete Comment), which
 *   invalidates docinfo; Publish / Unpublish calls `update_comment_publicity` and invalidates docinfo too.
 *   Nothing changes on screen before the server answered (Desk's edit shows the new text first, form_timeline.js:637-650
 *   — not reproduced: a refusal would leave wrong text on screen).
 * - Edit only for the author or Administrator; Delete for (author or System Manager) with delete on Comment; Publish for
 *   the author or a System Manager (comments.ts). `readOnly`: no box, no actions. The server still decides.
 * - variant "count": the number of comments (`docinfo.comments.length`); a click goes to the comment box (Desk scrolls
 *   to `.comment-box`, form_sidebar.js:51-55) — `onCountClick`, else the nearest `[data-sf-comment-box]` on the page.
 */
import * as React from "react";
import { MessageSquare } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "../../lib/cn";
import { Skeleton } from "../../primitives/skeleton";
import { CommentComposer, type CommentComposerLabels } from "../../record/CommentComposer";
import { Timeline, type TimelineLabels } from "../../record/Timeline";
import type { MentionOption, TimelineItem } from "../../record/types";
import { fmt } from "../../record/format";
import { useLocale } from "../../theme/ThemeProvider";
import type { DocInfo, FrappeDoc } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import { useDocAction } from "../hooks";
import { applyDocInfoChange } from "../services/cache";
import { useRecordApi, useRecordDocInfo } from "./data";
import { buildTimelineItems } from "./timeline";
import { COMMENT_PUBLICITY_METHOD, canPublishComment, commentRights, mentionSearchWith } from "./comments";

export interface FrappeCommentsProps {
  doctype: string;
  name: string;
  /** No comment box and no edit / delete / publish (the list stays). */
  readOnly?: boolean;
  /** The page's docinfo when it has it. */
  docinfo?: DocInfo;
  /** "list" (default): the comment box and the comments; "count": the sidebar's comment counter. */
  variant?: "list" | "count";
  /** variant "count": what a click does (default: scroll to and focus the page's comment box). */
  onCountClick?: () => void;
  /** Default "newest-first" (Desk's timeline order). */
  order?: "newest-first" | "oldest-first";
  /** Replace the default `get_names_for_mentions` search. */
  searchMentions?: (query: string) => Promise<MentionOption[]>;
  /** Override what the session's roles say (a site that customised the Comment DocType's permissions). */
  canDeleteComment?: boolean;
  isSystemManager?: boolean;
  labels?: TimelineLabels;
  composerLabels?: CommentComposerLabels;
  className?: string;
}

const isNewName = (name?: string) => !name || name.startsWith("new-");

/** Scroll to and focus the page's comment box (form_sidebar.js:51-55). */
export function focusCommentBox(root: ParentNode = document): boolean {
  const box = root.querySelector<HTMLElement>("[data-sf-comment-box]");
  if (!box) return false;
  box.scrollIntoView?.({ behavior: "smooth", block: "center" });
  box.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  return true;
}

export function FrappeComments({
  doctype, name, readOnly, docinfo, variant = "list", onCountClick, order = "newest-first", searchMentions, canDeleteComment, isSystemManager, labels, composerLabels, className,
}: FrappeCommentsProps) {
  const { t, isRTL } = useLocale();
  const api = useRecordApi();
  const qc = useQueryClient();
  const actions = useDocAction();
  const { session } = useFrappeSettings();
  const unsaved = isNewName(name);
  const q = useRecordDocInfo(unsaved ? undefined : doctype, name, docinfo);
  const info = q.data;
  const user = session?.user ?? "";
  const rights = React.useMemo(() => commentRights(session, { canDeleteComment, isSystemManager }), [session, canDeleteComment, isSystemManager]);

  const items: TimelineItem[] = React.useMemo(() => {
    if (!info) return [];
    const doc = { doctype, name } as FrappeDoc;
    return buildTimelineItems(doc, { ...info, communications: [], automated_messages: [] }, {
      user, t, isSystemManager: rights.isSystemManager, canDeleteComment: rights.canDeleteComment, fieldLabel: () => null, activity: "communications", isolate: isRTL,
    }).filter((i) => i.kind === "comment");
  }, [info, doctype, name, user, t, rights, isRTL]);
  const comments = React.useMemo(() => new Map((info?.comments ?? []).map((c) => [c.name, c as typeof c & { published?: unknown }])), [info]);
  const mentionSearch = React.useMemo(() => searchMentions ?? mentionSearchWith(api), [api, searchMentions]);

  if (unsaved) return null; // Desk hides the footer (comment box + timeline) of a new document (footer.js:65-72)

  if (variant === "count") {
    const n = info?.comments?.length ?? 0;
    if (q.isLoading) return <Skeleton className="h-6 w-10" />;
    return (
      <button type="button" data-sf-comment-count="" aria-label={fmt(t("socCommentCount"), n)} title={labels?.comments ?? t("socComments")}
        onClick={() => (onCountClick ? onCountClick() : void focusCommentBox())}
        className={cn("inline-flex items-center gap-1.5 rounded px-1 text-sm tabular-nums text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
        <MessageSquare className="h-4 w-4" aria-hidden />{n}
      </button>
    );
  }

  const editable = !readOnly;
  return (
    <div className={cn("space-y-3", className)} data-sf-comments="">
      {editable ? (
        <div data-sf-comment-box="">
          <CommentComposer searchMentions={mentionSearch} labels={composerLabels}
            onSubmit={async (html) => { await actions.addComment.mutateAsync({ doctype, name, content: html }); }} />
        </div>
      ) : null}
      <Timeline
        items={items} order={order} loading={q.isLoading} labels={{ empty: t("socNoComments"), heading: t("socComments"), ...labels }} composerLabels={composerLabels}
        error={q.error ? <p role="alert" className="text-sm text-destructive">{q.error.message}</p> : undefined}
        searchMentions={mentionSearch}
        onEditComment={editable ? async (item, html) => { await actions.updateComment.mutateAsync({ doctype, name, commentName: item.id, content: html }); } : undefined}
        onDeleteComment={editable ? async (item) => { await actions.deleteComment.mutateAsync({ doctype, name, commentName: item.id }); } : undefined}
        canPublish={(item) => editable && canPublishComment(item.actorId, user, rights)}
        isPublished={(item) => { const p = comments.get(item.id)?.published; return p === 1 || p === true || p === "1"; }}
        onTogglePublish={editable ? async (item, publish) => {
          await api.call(COMMENT_PUBLICITY_METHOD, { name: item.id, publish });
          await applyDocInfoChange(qc, doctype, name);
        } : undefined}
      />
    </div>
  );
}
