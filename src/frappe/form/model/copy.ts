/**
 * `frappe.model.copy_doc` (create_new.js:281; docs `11` §1.8) — Duplicate and Amend are client-side copies; nothing is
 * persisted until Save.
 *  - Skipped keys: `name`, `amended_from`, `amendment_date`, `cancel_reason`, every internal `__*` key, `no_copy`
 *    fields (not when amending: `from_amend` ignores no_copy), Password fields; `docstatus`, `owner`, `creation`,
 *    `modified`, `modified_by` are reset.
 *  - Child rows are copied as NEW rows (`__islocal`, `new-…` names, the copy as parent).
 *  - Amend (`amend_doc`, form.js:1011) needs an `amended_from` field, copies with `from_amend` and sets
 *    `amended_from` = the cancelled document's name; Desk first asks `frappe.client.is_document_amended` (the caller
 *    disables Amend when it answers true). The server checks the source is cancelled on insert.
 */
import type { DocTypeMeta, FrappeDoc, MetaBundle } from "../../contract";
import { TABLE_TYPES, newLocalName } from "./fieldtypes";

const SKIP = new Set(["name", "amended_from", "amendment_date", "cancel_reason", "docstatus", "owner", "creation", "modified", "modified_by", "idx"]);
const CHILD_SKIP = new Set([...SKIP, "parent", "parenttype", "parentfield"]);

function copyValues(meta: DocTypeMeta, src: FrappeDoc, fromAmend: boolean, skip: Set<string>): Record<string, unknown> {
  const fields = new Map((meta.fields ?? []).map((f) => [f.fieldname, f]));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (skip.has(k) || k.startsWith("__")) continue;
    const df = fields.get(k);
    if (df && !fromAmend && df.no_copy) continue;
    if (df?.fieldtype === "Password") continue;
    if (df && TABLE_TYPES.has(df.fieldtype)) continue;
    out[k] = v;
  }
  return out;
}

export function copyDoc(bundle: MetaBundle, doc: FrappeDoc, opts: { fromAmend?: boolean; user?: string } = {}): FrappeDoc {
  const meta = bundle.meta;
  const fromAmend = !!opts.fromAmend;
  const copy: FrappeDoc = {
    ...copyValues(meta, doc, fromAmend, SKIP),
    doctype: meta.name,
    name: newLocalName(meta.name),
    docstatus: 0,
    __islocal: 1,
    __unsaved: 1,
    ...(opts.user ? { owner: opts.user } : {}),
  };
  for (const df of meta.fields ?? []) {
    if (!TABLE_TYPES.has(df.fieldtype) || !Array.isArray(doc[df.fieldname])) continue;
    if (!fromAmend && df.no_copy) continue;
    const child = df.options ? bundle.children[df.options] : undefined;
    copy[df.fieldname] = (doc[df.fieldname] as FrappeDoc[]).map((row, i) => ({
      ...(child ? copyValues(child, row, fromAmend, CHILD_SKIP) : {}),
      doctype: row.doctype,
      name: newLocalName(row.doctype),
      __islocal: 1,
      __unsaved: 1,
      docstatus: 0,
      idx: i + 1,
      parent: copy.name,
      parenttype: meta.name,
      parentfield: df.fieldname,
    }));
  }
  return copy;
}

export const canAmend = (meta: DocTypeMeta) => (meta.fields ?? []).some((f) => f.fieldname === "amended_from");

/** The local amendment of a cancelled document. Throws when the DocType has no `amended_from` field. */
export function amendDoc(bundle: MetaBundle, doc: FrappeDoc, opts: { user?: string } = {}): FrappeDoc {
  if (!canAmend(bundle.meta)) throw new Error(`${bundle.meta.name} has no "amended_from" field`);
  return { ...copyDoc(bundle, doc, { fromAmend: true, user: opts.user }), amended_from: doc.name };
}
