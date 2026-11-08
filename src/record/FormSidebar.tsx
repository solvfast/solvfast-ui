/**
 * FormSidebar — the layout of Desk's form sidebar (Frappe 15.110 `form/templates/form_sidebar.html`,
 * `form/sidebar/form_sidebar.js`), Frappe-free. The host passes each section's content; this component owns the native
 * ORDER and the parts that are pure display:
 *
 *   user actions (form_sidebar.html:1, `add_user_action` form_sidebar.js:186-193)
 *   Assigned To (:43-56) → Attachments (:57-81) → Tags (:95-104) → Share (:105-118)
 *   stats row: likes · comment count (:139-162; the count scrolls to the comments, form_sidebar.js:52-55, 253-256)
 *   ─── then "You last edited this · 2h ago" / "You created this · 3d ago" (:163-168, form_sidebar.js:92-113)
 *   comments (P36b: the owner's sidebar comments; Desk keeps the comment box in the form FOOTER, footer/footer.js:8-25)
 *
 * `sections` hides or reorders them (ids from `FORM_SIDEBAR_SECTIONS`); a section with no content is not drawn.
 * `hidden` (Desk: a new, unsaved document, form_sidebar.js:71-74) renders nothing; `loading` a skeleton; `error` a
 * message with Retry.
 */
import * as React from "react";
import { MessageSquare } from "lucide-react";
import { cn } from "../lib/cn";
import { relativeTime } from "../lib/relative-time";
import { Button } from "../primitives/button";
import { Separator } from "../primitives/separator";
import { Skeleton } from "../primitives/skeleton";
import { useLocale } from "../theme/ThemeProvider";
import { fmt } from "./format";

export type FormSidebarSectionId = "userActions" | "assign" | "attachments" | "tags" | "share" | "stats" | "meta" | "comments";
/** Desk's order (form_sidebar.html). Reviews, Followed by, auto-repeat and page views are not part of the DS sidebar. */
export const FORM_SIDEBAR_SECTIONS: readonly FormSidebarSectionId[] = ["userActions", "assign", "attachments", "tags", "share", "stats", "meta", "comments"];

export interface FormSidebarUserAction { label: string; onClick: () => void }
/** "{who} created / last edited this · {when}". `isYou` → "You …" (Desk `get_user_message`). */
export interface FormSidebarStamp { name: string; isYou?: boolean; at?: number }

export interface FormSidebarProps {
  assign?: React.ReactNode;
  attachments?: React.ReactNode;
  tags?: React.ReactNode;
  share?: React.ReactNode;
  /** Shown first in the stats row (Desk: the heart and the like count). */
  likes?: React.ReactNode;
  /** The comments panel, drawn last (anchor of the comment count). */
  comments?: React.ReactNode;
  /** Comment count of the stats row (Desk: `docinfo.comments.length`). Undefined → no count. */
  commentCount?: number;
  /** Replaces the built-in comment count of the stats row (a host / Frappe count component). */
  commentCountSlot?: React.ReactNode;
  /** Comment count click. Default: scroll to and focus the `comments` section when there is one. */
  onCommentsClick?: () => void;
  userActions?: FormSidebarUserAction[];
  created?: FormSidebarStamp;
  modified?: FormSidebarStamp;
  /** Which sections, in which order (default `FORM_SIDEBAR_SECTIONS`). */
  sections?: readonly FormSidebarSectionId[];
  /** Nothing is rendered (Desk hides the sidebar of an unsaved document). */
  hidden?: boolean;
  loading?: boolean;
  /** A load failure; with `onRetry` a Retry button. */
  error?: React.ReactNode;
  onRetry?: () => void;
  /** Clock for the relative times (tests). */
  now?: number;
  className?: string;
}

export function FormSidebar({
  assign, attachments, tags, share, likes, comments, commentCount, commentCountSlot, onCommentsClick, userActions, created, modified, sections = FORM_SIDEBAR_SECTIONS,
  hidden, loading, error, onRetry, now, className,
}: FormSidebarProps) {
  const { t, isRTL } = useLocale();
  const commentsRef = React.useRef<HTMLDivElement>(null);
  if (hidden) return null;
  const shell = (children: React.ReactNode, busy?: boolean) => (
    <aside aria-label={t("sbSidebar")} aria-busy={busy || undefined} data-form-sidebar="" className={cn("w-full min-w-0 space-y-4 text-sm", className)}>{children}</aside>
  );
  if (loading) {
    return shell(
      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="space-y-1.5"><Skeleton className="h-4 w-24" /><Skeleton className="h-7 w-full" /></div>)}
      </div>, true,
    );
  }
  if (error) {
    return shell(
      <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        <p>{error}</p>
        {onRetry ? <Button type="button" size="sm" variant="outline" onClick={onRetry}>{t("sbRetry")}</Button> : null}
      </div>,
    );
  }

  const when = (s?: FormSidebarStamp) => (s?.at ? ` · ${relativeTime(s.at, isRTL, now)}` : "");
  const stamp = (s: FormSidebarStamp | undefined, you: string, other: string, kind: string) => (s ? (
    <li data-stamp={kind}>
      {s.isYou ? you : fmt(other, s.name)}
      {s.at ? <time dateTime={new Date(s.at).toISOString()} title={new Date(s.at).toLocaleString()}>{when(s)}</time> : null}
    </li>
  ) : null);
  const scrollToComments = () => {
    if (onCommentsClick) { onCommentsClick(); return; }
    const el = commentsRef.current;
    if (!el) return;
    el.scrollIntoView?.({ behavior: "smooth", block: "start" });
    (el.querySelector<HTMLElement>("textarea, [contenteditable=true], input, button") ?? el).focus?.();
  };

  const parts: Record<FormSidebarSectionId, React.ReactNode> = {
    userActions: userActions?.length ? (
      <ul className="space-y-1" data-sidebar-section="userActions">
        {userActions.map((a, i) => (
          <li key={i}><button type="button" onClick={a.onClick} className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">{a.label}</button></li>
        ))}
      </ul>
    ) : null,
    assign, attachments, tags,
    share: share ? <div data-sidebar-slot="share">{share}</div> : null,
    stats: likes || commentCount !== undefined || commentCountSlot ? (
      <div data-sidebar-section="stats" className="flex items-center gap-2 text-xs text-muted-foreground">
        {likes}
        {likes && (commentCountSlot || commentCount !== undefined) ? <span aria-hidden>·</span> : null}
        {commentCountSlot ?? (commentCount !== undefined ? (
          <button type="button" onClick={scrollToComments} aria-label={fmt(t("sbCommentCount"), commentCount)} title={t("sbComments")}
            className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden /><span>{commentCount}</span>
          </button>
        ) : null)}
      </div>
    ) : null,
    meta: created || modified ? (
      <div data-sidebar-section="meta" className="space-y-3">
        <Separator />
        <ul className="space-y-1 text-xs text-muted-foreground">
          {stamp(modified, t("sbYouEdited"), t("sbUserEdited"), "modified")}
          {stamp(created, t("sbYouCreated"), t("sbUserCreated"), "created")}
        </ul>
      </div>
    ) : null,
    comments: comments ? <div ref={commentsRef} tabIndex={-1} data-sidebar-section="comments" className="focus-visible:outline-none">{comments}</div> : null,
  };

  return shell(sections.map((id) => (parts[id] ? <React.Fragment key={id}>{parts[id]}</React.Fragment> : null)));
}
