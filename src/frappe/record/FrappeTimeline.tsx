/**
 * FrappeTimeline — the record's history (Desk's form timeline, Frappe 15.110 form/footer/form_timeline.js, base_timeline.js,
 * version_timeline_content_builder.js) over `getdocinfo` (desk/form/load.py:100-180): comment box, comments, communications
 * (paged), versions, assignment / attachment / info / like / workflow logs, milestones, views, additional timeline content.
 * Mapping rules in ./timeline.ts; comment rights in ./comments.ts.
 *
 * P36d history (all additive): `timeFormat` / `showAvatars` / `copyLinks` / `communicationHref` pass to `Timeline`; a
 * comment's "Published" marker shows whenever docinfo says so (timeline_message_box.html:39-44 — Publish / Unpublish itself
 * stays behind `allowPublish`); a failed docinfo / meta load is a `FrappeErrorState` with Retry (re-reads docinfo / meta);
 * docinfo `document_email` shows Desk's "Add to this activity by mailing to {0}" line (form_timeline.js:92-116).
 */
import * as React from "react";
import { Copy } from "lucide-react";
import { CommentComposer } from "../../record/CommentComposer";
import { Timeline, type TimelineEntry, type TimelineProps } from "../../record/Timeline";
import { fmt } from "../../record/format";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { frappeKeys } from "../contract";
import type { MentionOption, TimelineItem } from "../../record/types";
import { useLocale } from "../../theme/ThemeProvider";
import type { DocInfo, DocTypeMeta, FrappeDoc, MetaBundle } from "../contract";
import { useDocAction } from "../hooks";
import { usePermissions } from "../hooks";
import { useRecordApi, useRecordDocInfo, useRecordMeta } from "./data";
import { useCommunications } from "./useCommunications";
import { buildTimelineItems, type TimelineContext } from "./timeline";
import { useQueryClient } from "@tanstack/react-query";
import { applyDocInfoChange } from "../services/cache";
import { COMMENT_PUBLICITY_METHOD, mentionSearchWith } from "./comments";

export interface FrappeTimelineProps extends Pick<TimelineProps, "order" | "showFilters" | "hiddenKinds" | "labels" | "composerLabels" | "className" | "timeFormat" | "showAvatars"> {
  doc: FrappeDoc;
  user: string;
  docinfo?: DocInfo;
  /** Needed for field labels in version lines; loaded through the client when omitted. */
  bundle?: MetaBundle;
  /** "communications" = Desk’s “Show all activity” switch off. Default "all". */
  activity?: "all" | "communications";
  /** Comment box: needs `read` on the document (add_comment checks read). Default true. */
  canComment?: boolean;
  /** Roles: System Manager lets a user delete others’ comments — only together with `canDeleteComment`. */
  isSystemManager?: boolean;
  /** `can_delete("Comment")` from the user’s permissions. */
  canDeleteComment?: boolean;
  /** Extra visibility test for a field (display status Read/Write); default: not hidden (permlevel NOT applied: UNVERIFIED). */
  canSeeField?: (fieldname: string, table?: string) => boolean;
  translate?: (text: string) => string;
  /** Replaces the default `get_names_for_mentions` search. */
  searchMentions?: (query: string) => Promise<MentionOption[]>;
  error?: React.ReactNode;
  /**
   * P36b social: offer Desk's comment Publish / Unpublish (form_timeline.js:614, 620-625 — author or System Manager;
   * `update_comment_publicity`, desk/form/utils.py:72-79). Default false (unchanged timeline).
   */
  allowPublish?: boolean;
  /** P36d history: Desk's "Copy Link" on comments and communications (form_timeline.js:767-773) — the current page URL with
   *  `#comment-<name>` / `#communication-<name>`. Default false. */
  copyLinks?: boolean;
  /** P36d history: where "Open Communication" goes (Desk: `/app/communication/<name>`). Default: no link. */
  communicationHref?: (name: string) => string | undefined;
  /** P36d history: Desk's "Add to this activity by mailing to {0}" when docinfo has `document_email`. Default true. */
  showDocumentEmail?: boolean;
}

/** The current page with `#<anchor>` (Desk copies the form URL with `#comment-<name>`). */
const pageLink = (anchor: string) => (typeof window === "undefined" ? `#${anchor}` : `${window.location.origin}${window.location.pathname}${window.location.search}#${anchor}`);


/** The record’s activity, built from `docinfo` (docs 14 A8) with comment add / edit / delete and “load more communications”. */
export function FrappeTimeline({
  doc, user, docinfo, bundle, activity = "all", canComment = true, isSystemManager, canDeleteComment, canSeeField, translate = (s) => s, searchMentions, error, allowPublish = false,
  copyLinks = false, communicationHref, showDocumentEmail = true, ...rest
}: FrappeTimelineProps) {
  const qc = useQueryClient();
  const { t, isRTL } = useLocale();
  const c = useRecordApi();
  const actions = useDocAction();
  const q = useRecordDocInfo(doc.__islocal ? undefined : doc.doctype, doc.name, docinfo);
  const meta = useRecordMeta(doc.doctype, bundle);
  const info = q.data;
  const perms = usePermissions(meta.data, doc, info);
  const comm = useCommunications(doc.__islocal ? undefined : doc.doctype, doc.name, docinfo);
  const comms = comm.communications;

  /** Desk: skip hidden fields (unless show_on_timeline) and fields whose display status is not Read / Write (version_timeline_content_builder.js:85-96). */
  const fieldLabel = React.useCallback((fieldname: string, table?: string): string | null => {
    const m = meta.data; if (!m) return null;
    const tableDf = table ? m.meta.fields.find((f) => f.fieldname === table) : undefined;
    const dtMeta: DocTypeMeta | undefined = tableDf ? m.children[String(tableDf.options)] : m.meta;
    const df = dtMeta?.fields.find((f) => f.fieldname === fieldname);
    if (!df || (df.hidden && !df.show_on_timeline)) return null;
    if (canSeeField && !canSeeField(fieldname, table)) return null;
    const row: FrappeDoc = tableDf ? { doctype: String(tableDf.options), name: "", parentfield: table, parent: doc.name, parenttype: doc.doctype } : doc;
    const st = perms.fieldStatus(df, row, tableDf ? doc : undefined);
    if (st === "None" && !(df.hidden && df.show_on_timeline)) return null;
    const label = df.label ?? fieldname;
    return (m.meta.__messages?.[label] ?? translate(label));
  }, [meta.data, perms, canSeeField, translate, doc]);

  const items: TimelineEntry[] = React.useMemo(() => {
    if (!info) return [];
    const ctx: TimelineContext = {
      user, t, isSystemManager, canDeleteComment, fieldLabel, activity, isolate: isRTL,
      milestoneLabel: (f) => fieldLabel(f) ?? f, communicationHref,
    };
    return buildTimelineItems(doc, { ...info, communications: comms }, ctx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, comms, doc.modified, user, isSystemManager, canDeleteComment, fieldLabel, activity, t, isRTL, communicationHref]);

  const mentionSearch = React.useMemo<(q: string) => Promise<MentionOption[]>>(() => searchMentions ?? mentionSearchWith(c), [c, searchMentions]);

  const addComment = async (html: string) => {
    await actions.addComment.mutateAsync({ doctype: doc.doctype, name: doc.name, content: html });
  };
  const isPublished = React.useCallback((item: TimelineItem) => {
    const p = (info?.comments.find((x) => x.name === item.id) as { published?: unknown } | undefined)?.published;
    return p === 1 || p === true || p === "1";
  }, [info]);
  const retry = React.useCallback(() => {
    void qc.invalidateQueries({ queryKey: frappeKeys.docinfo(doc.doctype, doc.name), exact: true });
    void qc.invalidateQueries({ queryKey: frappeKeys.metaBundle(doc.doctype), exact: true });
  }, [qc, doc.doctype, doc.name]);
  const itemLink = React.useCallback((item: TimelineEntry) => (item.kind === "comment" ? pageLink(`comment-${item.id}`) : item.kind === "communication" ? pageLink(item.id) : undefined), []);
  const loadError = q.error ?? meta.error;
  const documentEmail = showDocumentEmail && typeof info?.document_email === "string" && info.document_email ? info.document_email : "";

  const unsaved = !!doc.__islocal;
  if (unsaved) return null; // Desk hides the timeline for new documents (footer.js:65-72)

  return (
    <div className="space-y-3">
      {/* P36b social: `data-sf-comment-box` is where the sidebar's comment counter goes (FrappeComments variant "count") */}
      {canComment ? <div data-sf-comment-box=""><CommentComposer onSubmit={addComment} searchMentions={mentionSearch} labels={rest.composerLabels} /></div> : null}
      {documentEmail ? (
        <p className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" data-document-email="">
          <span>{fmt(t("hisDocumentEmail"), "")}</span>
          <button type="button" title={t("hisCopyEmail")} aria-label={`${t("hisCopyEmail")}: ${documentEmail}`} onClick={() => void navigator.clipboard?.writeText(documentEmail).catch(() => undefined)}
            className="inline-flex items-center gap-1 rounded font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><bdi>{documentEmail}</bdi><Copy className="h-3 w-3" aria-hidden /></button>
        </p>
      ) : null}
      <Timeline
        {...rest} items={items}
        loading={q.isLoading || meta.isLoading}
        error={error ?? (loadError ? <FrappeErrorState error={loadError} onRetry={retry} compact /> : comm.error ? <FrappeErrorState error={comm.error} onRetry={() => void comm.loadMore()} compact /> : undefined)}
        itemLink={copyLinks ? itemLink : undefined}
        isPublished={isPublished}
        hasMore={comm.hasMore} loadingMore={comm.loadingMore} onLoadMore={() => void comm.loadMore()}
        searchMentions={mentionSearch}
        onEditComment={async (item, html) => { await actions.updateComment.mutateAsync({ doctype: doc.doctype, name: doc.name, commentName: item.id, content: html }); }}
        onDeleteComment={async (item) => { await actions.deleteComment.mutateAsync({ doctype: doc.doctype, name: doc.name, commentName: item.id }); }}
        {...(allowPublish ? {
          canPublish: (item: TimelineItem) => !!user && (item.actorId === user || !!isSystemManager),
          onTogglePublish: async (item: TimelineItem, publish: boolean) => {
            await c.call(COMMENT_PUBLICITY_METHOD, { name: item.id, publish });
            await applyDocInfoChange(qc, doc.doctype, doc.name);
          },
        } : {})}
      />
    </div>
  );
}
