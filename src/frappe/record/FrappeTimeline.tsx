import * as React from "react";
import { CommentComposer } from "../../record/CommentComposer";
import { Timeline, type TimelineProps } from "../../record/Timeline";
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

export interface FrappeTimelineProps extends Pick<TimelineProps, "order" | "showFilters" | "hiddenKinds" | "labels" | "composerLabels" | "className"> {
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
}


/** The record’s activity, built from `docinfo` (docs 14 A8) with comment add / edit / delete and “load more communications”. */
export function FrappeTimeline({
  doc, user, docinfo, bundle, activity = "all", canComment = true, isSystemManager, canDeleteComment, canSeeField, translate = (s) => s, searchMentions, error, allowPublish = false, ...rest
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

  const items: TimelineItem[] = React.useMemo(() => {
    if (!info) return [];
    const ctx: TimelineContext = {
      user, t, isSystemManager, canDeleteComment, fieldLabel, activity, isolate: isRTL,
      milestoneLabel: (f) => fieldLabel(f) ?? f,
    };
    return buildTimelineItems(doc, { ...info, communications: comms }, ctx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, comms, doc.modified, user, isSystemManager, canDeleteComment, fieldLabel, activity, t, isRTL]);

  const mentionSearch = React.useMemo<(q: string) => Promise<MentionOption[]>>(() => searchMentions ?? mentionSearchWith(c), [c, searchMentions]);

  const addComment = async (html: string) => {
    await actions.addComment.mutateAsync({ doctype: doc.doctype, name: doc.name, content: html });
  };
  const unsaved = !!doc.__islocal;
  if (unsaved) return null; // Desk hides the timeline for new documents (footer.js:65-72)

  return (
    <div className="space-y-3">
      {/* P36b social: `data-sf-comment-box` is where the sidebar's comment counter goes (FrappeComments variant "count") */}
      {canComment ? <div data-sf-comment-box=""><CommentComposer onSubmit={addComment} searchMentions={mentionSearch} labels={rest.composerLabels} /></div> : null}
      <Timeline
        {...rest} items={items}
        loading={q.isLoading || meta.isLoading}
        error={error ?? (q.error ? <p role="alert" className="text-sm text-destructive">{q.error.message}</p> : comm.error ? <p role="alert" className="text-sm text-destructive">{comm.error}</p> : undefined)}
        hasMore={comm.hasMore} loadingMore={comm.loadingMore} onLoadMore={() => void comm.loadMore()}
        searchMentions={mentionSearch}
        onEditComment={async (item, html) => { await actions.updateComment.mutateAsync({ doctype: doc.doctype, name: doc.name, commentName: item.id, content: html }); }}
        onDeleteComment={async (item) => { await actions.deleteComment.mutateAsync({ doctype: doc.doctype, name: doc.name, commentName: item.id }); }}
        {...(allowPublish ? {
          canPublish: (item: TimelineItem) => !!user && (item.actorId === user || !!isSystemManager),
          isPublished: (item: TimelineItem) => { const p = (info?.comments.find((x) => x.name === item.id) as { published?: unknown } | undefined)?.published; return p === 1 || p === true || p === "1"; },
          onTogglePublish: async (item: TimelineItem, publish: boolean) => {
            await c.call(COMMENT_PUBLICITY_METHOD, { name: item.id, publish });
            await applyDocInfoChange(qc, doc.doctype, doc.name);
          },
        } : {})}
      />
    </div>
  );
}
