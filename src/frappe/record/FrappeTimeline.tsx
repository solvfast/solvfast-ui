import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CommentComposer } from "../../record/CommentComposer";
import { Timeline, type TimelineProps } from "../../record/Timeline";
import type { MentionOption, TimelineItem } from "../../record/types";
import { useLocale } from "../../theme/ThemeProvider";
import type { DocInfo, DocTypeMeta, FrappeDoc, MetaBundle } from "../contract";
import { invalidateDocInfo, requireClientMethod, useRecordClient, useRecordDocInfo, useRecordMeta, type RecordClient } from "./data";
import { buildTimelineItems, type TimelineContext } from "./timeline";

export interface FrappeTimelineProps extends Pick<TimelineProps, "order" | "showFilters" | "hiddenKinds" | "labels" | "composerLabels" | "className"> {
  doc: FrappeDoc;
  user: string;
  docinfo?: DocInfo;
  /** Needed for field labels in version lines; loaded through the client when omitted. */
  bundle?: MetaBundle;
  client?: RecordClient;
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

const PAGE = 20;

/** The record’s activity, built from `docinfo` (docs 14 A8) with comment add / edit / delete and “load more communications”. */
export function FrappeTimeline({
  doc, user, docinfo, bundle, client, activity = "all", canComment = true, isSystemManager, canDeleteComment, canSeeField, translate = (s) => s, searchMentions, error, ...rest
}: FrappeTimelineProps) {
  const { t } = useLocale();
  const c = useRecordClient(client);
  const qc = useQueryClient();
  const q = useRecordDocInfo(c, doc.__islocal ? undefined : doc.doctype, doc.name, docinfo);
  const meta = useRecordMeta(c, doc.doctype, bundle);
  const [extraComms, setExtraComms] = React.useState<unknown[]>([]);
  const [moreAvailable, setMoreAvailable] = React.useState<boolean | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [moreError, setMoreError] = React.useState("");

  const info = q.data;
  // The server sends up to 21 communications; Desk shows 20 and offers “Load More” when there were more (form_timeline.js:193-223).
  const baseComms = (info?.communications ?? []) as unknown[];
  const hasMoreBase = baseComms.length > PAGE;
  const shownBase = hasMoreBase ? baseComms.slice(0, PAGE) : baseComms;
  const comms = [...shownBase, ...extraComms];
  const hasMore = moreAvailable ?? hasMoreBase;

  const fieldLabel = React.useCallback((fieldname: string, table?: string): string | null => {
    const m = meta.data; if (!m) return null;
    const dtMeta: DocTypeMeta | undefined = table ? m.children[String(m.meta.fields.find((f) => f.fieldname === table)?.options)] : m.meta;
    const df = dtMeta?.fields.find((f) => f.fieldname === fieldname);
    if (!df || (df.hidden && !df.show_on_timeline)) return null;
    if (canSeeField && !canSeeField(fieldname, table)) return null;
    const label = df.label ?? fieldname;
    return (m.meta.__messages?.[label] ?? translate(label));
  }, [meta.data, canSeeField, translate]);

  const items: TimelineItem[] = React.useMemo(() => {
    if (!info) return [];
    const ctx: TimelineContext = {
      user, t, isSystemManager, canDeleteComment, fieldLabel, activity,
      milestoneLabel: (f) => fieldLabel(f) ?? f,
    };
    return buildTimelineItems(doc, { ...info, communications: comms }, ctx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info, extraComms, doc.modified, user, isSystemManager, canDeleteComment, fieldLabel, activity, t]);

  const mentionSearch = React.useCallback(
    searchMentions ?? (async (term: string): Promise<MentionOption[]> => {
      const res = await c.call("frappe.desk.search.get_names_for_mentions", { search_term: term });
      return ((res.message as Array<Record<string, unknown>> | undefined) ?? []).map((r) => ({ id: String(r.id), label: String(r.value ?? r.id), isGroup: !!r.is_group }));
    }),
    [c, searchMentions],
  );

  const loadMore = async () => {
    setLoadingMore(true); setMoreError("");
    try {
      const res = await c.call("frappe.desk.form.load.get_communications", { doctype: doc.doctype, name: doc.name, start: comms.length, limit: PAGE + 1 });
      const got = ((res.message as unknown[] | undefined) ?? []);
      setExtraComms((e) => [...e, ...got.slice(0, PAGE)]);
      setMoreAvailable(got.length > PAGE);
    } catch (e) { setMoreError(e instanceof Error ? e.message : String(e)); } finally { setLoadingMore(false); }
  };

  const addComment = async (html: string) => {
    await requireClientMethod(c, "addComment")(doc.doctype, doc.name, html);
    invalidateDocInfo(qc, doc.doctype, doc.name);
  };
  const unsaved = !!doc.__islocal;
  if (unsaved) return null; // Desk hides the timeline for new documents (footer.js:65-72)

  return (
    <div className="space-y-3">
      {canComment ? <CommentComposer onSubmit={addComment} searchMentions={mentionSearch} labels={rest.composerLabels} /> : null}
      <Timeline
        {...rest} items={items}
        loading={q.isLoading || meta.isLoading}
        error={error ?? (q.error ? <p role="alert" className="text-sm text-destructive">{q.error.message}</p> : moreError ? <p role="alert" className="text-sm text-destructive">{moreError}</p> : undefined)}
        hasMore={hasMore} loadingMore={loadingMore} onLoadMore={() => void loadMore()}
        searchMentions={mentionSearch}
        onEditComment={async (item, html) => { await requireClientMethod(c, "updateComment")(item.id, html); invalidateDocInfo(qc, doc.doctype, doc.name); }}
        onDeleteComment={async (item) => { await requireClientMethod(c, "deleteComment")(item.id); invalidateDocInfo(qc, doc.doctype, doc.name); }}
      />
    </div>
  );
}
