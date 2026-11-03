/**
 * Who moved the record into each workflow state, and when - for the stepper (LifecycleBar `by` / `at`).
 * Source 1: docinfo `workflow_logs` (Comment type "Workflow": content = the state entered, translated by the server's `_()`; owner = actor;
 * creation = time; apply_workflow adds it, model/workflow.py:148).
 * Source 2 (no log for that state): Version rows whose `changed` contains the workflow state field -> [field, old, new]; the NEW value is the entry.
 * The state the record was created in has no log: it is attributed to the document owner at `creation` when it equals the oldest known `old` value.
 * UNVERIFIED: the server translates the log content, so on a translated site a log may not match the untranslated state name (then source 2 applies).
 */
import type { DocInfo, FrappeDoc } from "../contract";
import { parseFrappeTime } from "./timeline";

export interface StateEntry { by: string; at: number }
type Row = Record<string, unknown>;

export function stateEntries(opts: {
  doc: FrappeDoc; docinfo?: DocInfo; stateField: string; states: string[]; translate?: (s: string) => string;
}): Map<string, StateEntry> {
  const { doc, docinfo, stateField, states } = opts;
  const tr = opts.translate ?? ((s: string) => s);
  const name = (id: string) => docinfo?.user_info?.[id]?.fullname ?? id;
  const out = new Map<string, StateEntry>();
  const put = (state: string, by: string, at: number) => { const cur = out.get(state); if (!cur || at >= cur.at) out.set(state, { by, at }); };

  for (const l of (docinfo?.workflow_logs ?? []) as Row[]) {
    const content = String(l.content ?? "").replace(/<[^>]*>/g, "").trim();
    const state = states.find((s) => s === content || tr(s) === content);
    if (state) put(state, name(String(l.owner)), parseFrappeTime(String(l.creation)));
  }
  let oldest: { at: number; old: string } | undefined;
  for (const v of docinfo?.versions ?? []) {
    let data: { changed?: Array<[string, unknown, unknown]> };
    try { data = JSON.parse(v.data); } catch { continue; }
    const c = data.changed?.find((x) => x[0] === stateField);
    if (!c) continue;
    const at = parseFrappeTime(v.creation);
    if (typeof c[2] === "string" && states.includes(c[2]) && !out.has(c[2])) put(c[2], name(v.owner), at);
    if (typeof c[1] === "string" && (!oldest || at < oldest.at)) oldest = { at, old: c[1] };
  }
  if (oldest && states.includes(oldest.old) && !out.has(oldest.old) && doc.creation) put(oldest.old, name(String(doc.owner ?? "")), parseFrappeTime(doc.creation));
  return out;
}
