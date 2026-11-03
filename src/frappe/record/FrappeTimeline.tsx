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
}


/** The record’s activity, built from `docinfo` (docs 14 A8) with comment add / edit / delete and “load more communications”. */
export function FrappeTimeline({
  doc, user, docinfo, bundle, activity = "all", canComment = true, isSystemManager, canDeleteComment, canSeeField, translate = (s) => s, searchMentions, error, ...rest
}: FrappeTimelineProps) {
  const { t } = useLocale();
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
      user, t, isSystemManager, canDeleteComment, fieldLabel, activity,
      milestoneLabel: (f) => fieldLabel(f) ?? f,
    };
    return buildTimelineItems(doc, { ...info, communications: comms }, ctx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, comms, doc.modified, user, isSystemManager, canDeleteComment, fieldLabel, activity, t]);

  const mentionSearch = React.useCallback(
    searchMentions ?? (async (term: string): Promise<MentionOption[]> => {
      const res = await c.call("frappe.desk.search.get_names_for_mentions", { search_term: term });
      return ((res.message as Array<Record<string, unknown>> | undefined) ?? []).map((r) => ({ id: String(r.id), label: String(r.value ?? r.id), isGroup: !!r.is_group }));
    }),
    [c, searchMentions],
  );

  const addComment = async (html: string) => {
    await actions.addComment.mutateAsync({ doctype: doc.doctype, name: doc.name, content: html });
  };
  const unsaved = !!doc.__islocal;
  if (unsaved) return null; // Desk hides the timeline for new documents (footer.js:65-72)

  return (
    <div className="space-y-3">
      {canComment ? <CommentComposer onSubmit={addComment} searchMentions={mentionSearch} labels={rest.composerLabels} /> : null}
      <Timeline
        {...rest} items={items}
        loading={q.isLoading || meta.isLoading}
        error={error ?? (q.error ? <p role="alert" className="text-sm text-destructive">{q.error.message}</p> : comm.error ? <p role="alert" className="text-sm text-destructive">{comm.error}</p> : undefined)}
        hasMore={comm.hasMore} loadingMore={comm.loadingMore} onLoadMore={() => void comm.loadMore()}
        searchMentions={mentionSearch}
        onEditComment={async (item, html) => { await actions.updateComment.mutateAsync({ doctype: doc.doctype, name: doc.name, commentName: item.id, content: html }); }}
        onDeleteComment={async (item) => { await actions.deleteComment.mutateAsync({ doctype: doc.doctype, name: doc.name, commentName: item.id }); }}
      />
    </div>
  );
}
