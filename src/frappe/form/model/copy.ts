/**
 * `frappe.model.copy_doc` (create_new.js:281; docs `11` §1.8) — Duplicate and Amend are client-side copies; nothing is
 * persisted until Save.
 *  - The copy STARTS from a new document (`get_new_doc`, create_new.js:283): field defaults first (so a `no_copy` field
 *    of a Duplicate gets its default, not nothing — P35 F8), `__run_link_triggers`, no mandatory child rows; child rows
 *    likewise start from the child DocType's defaults. Then the source values are laid over it.
 *  - Only keys that have a DocField are copied (create_new.js:303-308: `_assign`, `_comments`, `_liked_by`,
 *    `_user_tags` and other non-fields stay behind); skipped: `name`, `amended_from`, `amendment_date`,
 *    `cancel_reason`, `no_copy` fields (not when amending: `from_amend` ignores no_copy), Password fields;
 *    `docstatus`, `owner`, `creation`, `modified`, `modified_by` are reset.
 *  - Child rows are copied as NEW rows (`__islocal`, `new-…` names, the copy as parent).
 *  - Amend (`amend_doc`, form.js:1011) needs an `amended_from` field, copies with `from_amend` and sets
 *    `amended_from` = the cancelled document's name and `amendment_date` = today when the field exists
 *    (form.js:1021-1023); Desk first asks `frappe.client.is_document_amended` (the caller
 *    disables Amend when it answers true). The server checks the source is cancelled on insert.
 */
import type { DocTypeMeta, FrappeDoc, MetaBundle } from "../../contract";
import { TABLE_TYPES, newLocalName } from "./fieldtypes";
import { applyDefaults, newChildRow, todayString, type DefaultsContext } from "./defaults";
import { defaultState, workflowFromMeta } from "../../record/workflow";

// lft / rgt: create_new.js:316-317 resets them (tree DocTypes), so they are never copied
const SKIP = new Set(["name", "amended_from", "amendment_date", "cancel_reason", "docstatus", "owner", "creation", "modified", "modified_by", "idx", "lft", "rgt"]);
const CHILD_SKIP = new Set([...SKIP, "parent", "parenttype", "parentfield"]);

function copyValues(meta: DocTypeMeta, src: FrappeDoc, fromAmend: boolean, skip: Set<string>): Record<string, unknown> {
  const fields = new Map((meta.fields ?? []).map((f) => [f.fieldname, f]));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (skip.has(k) || k.startsWith("__")) continue;
    const df = fields.get(k);
    if (!df) continue;
    if (!fromAmend && df.no_copy) continue;
    if (df.fieldtype === "Password") continue;
    if (TABLE_TYPES.has(df.fieldtype)) continue;
    out[k] = v;
  }
  return out;
}

export function copyDoc(bundle: MetaBundle, doc: FrappeDoc, opts: { fromAmend?: boolean; user?: string; defaults?: DefaultsContext } = {}): FrappeDoc {
  const meta = bundle.meta;
  const fromAmend = !!opts.fromAmend;
  const ctx: DefaultsContext = { ...opts.defaults, ...(opts.user ? { user: opts.user } : {}) };
  const user = ctx.user;
  const base: FrappeDoc = { doctype: meta.name, name: newLocalName(meta.name), docstatus: 0, __islocal: 1, __unsaved: 1, ...(user ? { owner: user } : {}) };
  applyDefaults(base, meta, ctx);
  const copy: FrappeDoc = {
    ...base,
    ...copyValues(meta, doc, fromAmend, SKIP),
    doctype: meta.name,
    name: base.name,
    docstatus: 0,
    __islocal: 1,
    __unsaved: 1,
    __run_link_triggers: 1,
    ...(user ? { owner: user, modified_by: user } : {}),
  };
  for (const df of meta.fields ?? []) {
    if (!TABLE_TYPES.has(df.fieldtype)) continue;
    if (!Array.isArray(doc[df.fieldname]) || (!fromAmend && df.no_copy)) { copy[df.fieldname] = []; continue; }
    const child = df.options ? bundle.children[df.options] : undefined;
    copy[df.fieldname] = (doc[df.fieldname] as FrappeDoc[]).map((row, i) => {
      const values = child ? copyValues(child, row, fromAmend, CHILD_SKIP) : {};
      const fresh = child
        ? newChildRow(child, copy, df.fieldname, ctx, values)
        : { ...values, doctype: row.doctype, name: newLocalName(row.doctype), __islocal: 1 as const, __unsaved: 1 as const, docstatus: 0 as const, parent: copy.name, parenttype: meta.name, parentfield: df.fieldname };
      // create_new.js:319-321: a row of an amendment remembers the row it came from
      return { ...fresh, idx: i + 1, ...(fromAmend ? { _amended_from: row.name } : {}) };
    });
  }
  return copy;
}

export const canAmend = (meta: DocTypeMeta) => (meta.fields ?? []).some((f) => f.fieldname === "amended_from");

/** The local amendment of a cancelled document. Throws when the DocType has no `amended_from` field. */
export function amendDoc(bundle: MetaBundle, doc: FrappeDoc, opts: { user?: string; defaults?: DefaultsContext } = {}): FrappeDoc {
  if (!canAmend(bundle.meta)) throw new Error(`${bundle.meta.name} has no "amended_from" field`);
  const hasDate = (bundle.meta.fields ?? []).some((f) => f.fieldname === "amendment_date");
  const copy: FrappeDoc = { ...copyDoc(bundle, doc, { fromAmend: true, user: opts.user, defaults: opts.defaults }), amended_from: doc.name, ...(hasDate ? { amendment_date: todayString() } : {}) };
  // P36e submit: copy_doc copies no_copy fields when amending (create_new.js:281-292) — the workflow state too ("Rejected");
  // Desk's form then sets the default state of docstatus 0 on the local document (form/workflow.js:58-62 → 143-151,
  // frappe.workflow.get_default_state). Without it the amendment would be saved as a draft in a cancelled state.
  const wf = workflowFromMeta(bundle.meta as DocTypeMeta & { __workflow_docs?: unknown });
  const state = wf ? defaultState(wf, 0) : undefined;
  return wf && state ? { ...copy, [wf.workflow_state_field]: state } : copy;
}
