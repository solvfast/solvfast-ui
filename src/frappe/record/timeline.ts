/**
 * docinfo → timeline items (docs 14 §A8). Pure: no network, no React.
 * Item kinds and their docinfo keys: comments, communications + automated_messages, versions, assignment_logs, attachment_logs,
 * info_logs, like_logs, workflow_logs, milestones, views, plus the created / last-edited lines from the document.
 * Deliberately NOT read: `share_logs` (nothing on the server sets it — Desk shows no sharing events either).
 * Not reproduced (UNVERIFIED gaps): energy_point_logs, additional_timeline_content, reply buttons on communications,
 * " · Impersonated by" / " · [Action taken by]" suffixes, `updater_reference` links.
 */
import type { DocInfo, FrappeDoc, VersionInfo } from "../contract";
import type { TimelineChange, TimelineItem } from "../../record/types";
import type { Messages } from "../../theme/messages";
import { isolate, fmt } from "../../record/format";
import { htmlToText } from "../../record/sanitize";

export type MessageKey = keyof Messages;

/** `fmt` that wraps every interpolated token in Unicode bidi isolates when `ctx.isolate` (RTL): English field labels, values and user
 *  names inside an Arabic sentence then keep their own direction and the sentence keeps its word order. */
const f = (ctx: { isolate?: boolean }, template: string, ...args: Array<string | number>) =>
  fmt(template, ...(ctx.isolate ? args.map((a) => isolate(String(a))) : args));

export interface TimelineContext {
  /** The signed-in user id. */
  user: string;
  t: (key: MessageKey) => string;
  /** Allow-list of what the user can do with comments (decided by the caller from roles + `can("delete")` on Comment). */
  isSystemManager?: boolean;
  canDeleteComment?: boolean;
  /**
   * Label of a field the user may see, or `null` to skip it (missing, hidden without show_on_timeline, or display status None).
   * `table` is the parent table fieldname when `fieldname` is a child field. Translate here (translateLabel).
   */
  fieldLabel: (fieldname: string, table?: string) => string | null;
  /** Meta label for a milestone `track_field`. */
  milestoneLabel?: (fieldname: string) => string;
  /** "all" = every kind; "communications" = only communications, comments and created/modified (Desk's switch off). Default "all". */
  activity?: "all" | "communications";
  /** Wrap interpolated tokens (names, labels, values) in Unicode bidi isolates. Set for RTL languages. */
  isolate?: boolean;
  /** Display name for a user id (default: docinfo.user_info fullname, else the id). */
  userName?: (id: string) => string;
}

/** Frappe datetimes are "YYYY-MM-DD HH:mm:ss[.ffffff]" in the server time zone; parsed as local time like the browser does. */
export function parseFrappeTime(v: string | undefined | null): number {
  if (!v) return 0;
  const ms = Date.parse(v.includes("T") ? v : v.replace(" ", "T").replace(/(\.\d{3})\d+$/, "$1"));
  return Number.isNaN(ms) ? 0 : ms;
}

const ellipsis = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);
/** `format_content_for_timeline`: HTML stripped, 40 characters, empty → `""`. */
export function formatTimelineValue(v: unknown): string {
  const text = ellipsis(htmlToText(v == null ? "" : String(v)).trim());
  return text || '""';
}

interface VersionData {
  comment?: string;
  changed?: Array<[string, unknown, unknown]>;
  added?: Array<[string, Record<string, unknown>]>;
  removed?: Array<[string, Record<string, unknown>]>;
  /** [table_fieldname, row_index, row_name, [[fieldname, old, new], …]] */
  row_changed?: Array<[string, number, string, Array<[string, unknown, unknown]>]>;
}

export interface VersionLine { summary: string; changes?: TimelineChange[]; kind: "change" | "state" }

/** One Version row → 0..n timeline lines, per `get_version_timeline_content` (3-part cap, 40-char truncation). */
export function formatVersion(version: Pick<VersionInfo, "data" | "owner">, ctx: TimelineContext, who: string): VersionLine[] {
  let data: VersionData;
  try { data = JSON.parse(version.data) as VersionData; } catch { return []; }
  if (!data || typeof data !== "object") return [];
  const t = ctx.t;
  if (data.comment) return [{ summary: data.comment, kind: "change" }];
  const out: VersionLine[] = [];

  if (data.changed?.length) {
    const parts: string[] = []; const detail: TimelineChange[] = [];
    for (const [field, oldV, newV] of data.changed) {
      if (field === "docstatus") {
        if (newV === 1) out.push({ summary: f(ctx, t("recSubmittedThis"), who), kind: "state" });
        else if (newV === 2) out.push({ summary: f(ctx, t("recCancelledThis"), who), kind: "state" });
      } else {
        const label = ctx.fieldLabel(field);
        if (label != null) {
          const o = formatTimelineValue(oldV); const n = formatTimelineValue(newV);
          detail.push({ label, before: o, after: n });
          if (parts.length < 3) parts.push(f(ctx, t("recFromTo"), label, o, n));
        }
      }
    }
    if (parts.length) out.push({ summary: f(ctx, t("recChangedValue"), who, parts.join(", ")), changes: detail, kind: "change" });
  }

  if (data.row_changed?.length) {
    const parts: string[] = []; const detail: TimelineChange[] = [];
    for (const [table, idx, , cols] of data.row_changed) {
      for (const [field, oldV, newV] of cols) {
        const label = ctx.fieldLabel(field, table);
        if (label == null) continue;
        const o = formatTimelineValue(oldV); const n = formatTimelineValue(newV);
        detail.push({ label, before: o, after: n, row: idx });
        if (parts.length < 3) parts.push(f(ctx, t("recFromToRow"), label, o, n, idx + 1));
      }
    }
    if (parts.length) out.push({ summary: f(ctx, t("recChangedValues"), who, parts.join(", ")), changes: detail, kind: "change" });
  }

  for (const key of ["added", "removed"] as const) {
    const rows = data[key];
    if (!rows?.length) continue;
    const counts = new Map<string, number>();
    for (const [table] of rows) { const label = ctx.fieldLabel(table); if (label != null) counts.set(label, (counts.get(label) ?? 0) + 1); }
    if (!counts.size) continue;
    const msgs: string[] = []; let first = true;
    for (const [label, n] of counts) {
      const add = key === "added";
      if (first) msgs.push(n > 1 ? f(ctx, t(add ? "recAddedRows" : "recRemovedRows"), who, n, label) : f(ctx, t(add ? "recAddedRow" : "recRemovedRow"), who, label));
      else msgs.push(n > 1 ? f(ctx, t(add ? "recAddedRowsMore" : "recRemovedRowsMore"), n, label) : f(ctx, t(add ? "recAddedRowMore" : "recRemovedRowMore"), label));
      first = false;
    }
    out.push({ summary: commaAnd(msgs, t("recAnd")), kind: "change" });
  }
  return out;
}

/** `frappe.utils.comma_and`: "a, b and c". */
export function commaAnd(list: string[], and: string): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} ${and} ${list[list.length - 1]}`;
}

type Row = Record<string, unknown>;
const s = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

export function buildTimelineItems(doc: FrappeDoc, docinfo: DocInfo, ctx: TimelineContext): TimelineItem[] {
  const t = ctx.t;
  const nameOf = (id: string) => (id === ctx.user ? t("recYou") : ctx.userName?.(id) ?? docinfo.user_info?.[id]?.fullname ?? id);
  const items: TimelineItem[] = [];
  const full = (ctx.activity ?? "all") === "all";

  if (doc.creation) items.push({ id: "created", kind: "created", at: parseFrappeTime(doc.creation), actorId: doc.owner, actor: nameOf(s(doc.owner)), summary: f(ctx, t("recCreatedThis"), nameOf(s(doc.owner))) });
  if (doc.modified && doc.modified !== doc.creation) items.push({ id: "modified", kind: "modified", at: parseFrappeTime(doc.modified), actorId: doc.modified_by, actor: nameOf(s(doc.modified_by)), summary: f(ctx, t("recModifiedThis"), nameOf(s(doc.modified_by))) });

  for (const c of [...(docinfo.communications ?? []), ...((docinfo.automated_messages as unknown[] | undefined) ?? [])] as Row[]) {
    const sender = s(c.sender_full_name || c.sender);
    items.push({
      id: `communication-${s(c.name)}`, kind: "communication", at: parseFrappeTime(s(c.communication_date || c.creation)), actor: sender,
      summary: [sender, s(c.subject)].filter(Boolean).join(" · "),
    });
  }

  for (const c of docinfo.comments ?? []) {
    const own = c.owner === ctx.user;
    items.push({
      id: c.name, kind: "comment", at: parseFrappeTime(c.creation), actorId: c.owner, actor: nameOf(c.owner), body: c.content, bodyFormat: "html",
      canEdit: own || ctx.user === "Administrator",
      canDelete: (own || !!ctx.isSystemManager) && !!ctx.canDeleteComment,
    });
  }

  if (full) {
    for (const v of docinfo.versions ?? []) {
      const who = nameOf(v.owner);
      formatVersion(v, ctx, who).forEach((l, n) => items.push({ id: `version-${v.name}-${n}`, kind: l.kind, at: parseFrappeTime(v.creation), actorId: v.owner, actor: who, summary: l.summary, changes: l.changes && l.changes.length > 1 ? l.changes : undefined }));
    }
    for (const a of (docinfo.assignment_logs ?? []) as Row[]) {
      items.push({ id: `assignment-${s(a.name)}`, kind: "assignment", at: parseFrappeTime(s(a.creation)), actorId: s(a.owner), actor: nameOf(s(a.owner)), summary: htmlToText(s(a.content)) });
    }
    for (const a of (docinfo.attachment_logs ?? []) as Row[]) {
      const added = a.comment_type === "Attachment"; const who = nameOf(s(a.owner));
      items.push({ id: `attachment-${s(a.name)}`, kind: "attachment", at: parseFrappeTime(s(a.creation)), actorId: s(a.owner), actor: who, summary: f(ctx, t(added ? "recAttached" : "recRemovedAttachment"), who, htmlToText(s(a.content))) });
    }
    for (const a of (docinfo.info_logs ?? []) as Row[]) {
      items.push({ id: `info-${s(a.name)}`, kind: "info", at: parseFrappeTime(s(a.creation)), actorId: s(a.owner), actor: nameOf(s(a.owner)), summary: `${nameOf(s(a.owner))} ${htmlToText(s(a.content))}` });
    }
    for (const a of (docinfo.like_logs ?? []) as Row[]) {
      items.push({ id: `like-${s(a.name)}`, kind: "like", at: parseFrappeTime(s(a.creation)), actorId: s(a.owner), actor: nameOf(s(a.owner)), summary: f(ctx, t("recLiked"), nameOf(s(a.owner))) });
    }
    for (const a of (docinfo.workflow_logs ?? []) as Row[]) {
      items.push({ id: `workflow-${s(a.name)}`, kind: "state", at: parseFrappeTime(s(a.creation)), actorId: s(a.owner), actor: nameOf(s(a.owner)), summary: `${nameOf(s(a.owner))} ${htmlToText(s(a.content))}` });
    }
    for (const m of (docinfo.milestones ?? []) as Row[]) {
      const who = nameOf(s(m.owner));
      items.push({ id: `milestone-${s(m.name)}`, kind: "info", at: parseFrappeTime(s(m.creation)), actorId: s(m.owner), actor: who, summary: f(ctx, t("recChangedMilestone"), who, ctx.milestoneLabel?.(s(m.track_field)) ?? s(m.track_field), s(m.value)) });
    }
    for (const v of (docinfo.views ?? []) as Row[]) {
      items.push({ id: `view-${s(v.name)}`, kind: "info", at: parseFrappeTime(s(v.creation)), actorId: s(v.owner), actor: nameOf(s(v.owner)), summary: f(ctx, t("recViewed"), nameOf(s(v.owner))) });
    }
  }
  return items;
}
