/**
 * P36e submit — SIMULATED server rules for submittable DocTypes that the base simulator does not apply on every path.
 * `withSubmitRules(transport)` wraps a fixture transport (like `withSimulatedSidebar`) and adds, before the base handler
 * runs:
 *  - `_validate_update_after_submit` (model/base_document.py:1050-1085) on every "Update" save of a SUBMITTED document —
 *    `frappe.desk.form.save.savedocs` (action Update, desk/form/save.py:18-35), `frappe.client.save` /
 *    `frappe.client.set_value` (client.py → doc.save(), docstatus 1 → `_action` update_after_submit, document.py:905-907):
 *    a changed field that is not `allow_on_submit` → 417 UpdateAfterSubmitError "Not allowed to change {label} after
 *    submission from {old} to {new}" (title "Cannot Update After Submit"). The base `save()` does not check it (only
 *    `reportSetValueHandler` does, handlers/views.ts:270-280).
 *  - `submit_cancel_or_update_docs` action "update" (desk/doctype/bulk_update/bulk_update.py:95-98, 109-112): a
 *    submitted document whose update breaks that rule fails (the exception is caught, the name reported as failed).
 *  - `frappe.desk.reportview.delete_items` without simulated permissions: `delete_bulk` (desk/reportview.py:588-616)
 *    deletes each name on its own (> 10 enqueued: SIMULATED as run at once) and reports the failures (e.g. "Submitted Record cannot be deleted", delete_doc.py:
 *    252-262) by a realtime msgprint — the base handler, permissions off, stopped at the first refused name.
 *  - `validate_workflow` (model/workflow.py:179-181) on save: an empty workflow state becomes the first state (an
 *    amendment's state field is no_copy, workflow.py:55-56).
 * Uses the rule of the Core `updateAfterSubmitViolations` (src/record/docstatus.ts), so the mock path and the simulator
 * agree. Nothing here is evidence of Frappe behaviour.
 */
import type { DocTypeMeta, FrappeDoc } from "../../contract";
import { toFrappeError, type FrappeResponse } from "../../client";
import type { FixtureStore, FixtureTransport } from "../fixtureTransport";
import { updateAfterSubmitViolations, type DocstatusField } from "../../../record/docstatus";

type Row = Record<string, unknown>;
const parse = (v: unknown): unknown => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
const metaOf = (store: FixtureStore, doctype: string): DocTypeMeta | undefined => store.meta[doctype]?.[0];
const LAYOUT = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Heading", "Fold", "Button", "Image", "Page Break"]);
const TABLES = new Set(["Table", "Table MultiSelect"]);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The value fields checked by `_validate_update_after_submit` (child tables: only their row count, :1059-1063). */
function checkedFields(meta: DocTypeMeta): DocstatusField[] {
  return meta.fields
    .filter((f) => !LAYOUT.has(f.fieldtype) && !(f as { is_virtual?: unknown }).is_virtual)
    .map((f) => ({ fieldname: f.fieldname, label: f.label || f.fieldname, allow_on_submit: !!Number((f as { allow_on_submit?: unknown }).allow_on_submit ?? 0), fieldtype: f.fieldtype }));
}

const lengthOf = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** The first violation for a SUBMITTED stored doc and the posted values, or null. */
export function updateAfterSubmitError(store: FixtureStore, posted: FrappeDoc): string | null {
  const meta = metaOf(store, String(posted.doctype));
  const stored = meta ? store.docs.get(meta.name)?.get(String(posted.name)) : undefined;
  if (!meta || !stored || Number(stored.docstatus) !== 1) return null;
  const fields = checkedFields(meta);
  const before: Row = {}, after: Row = {};
  for (const f of fields) {
    if (!(f.fieldname in posted)) continue; // a key the request did not send is not compared (doc.as_dict keys, :1054)
    const table = TABLES.has(String(f.fieldtype));
    before[f.fieldname] = table ? lengthOf(stored[f.fieldname]) : stored[f.fieldname];
    after[f.fieldname] = table ? lengthOf(posted[f.fieldname]) : posted[f.fieldname];
  }
  const v = updateAfterSubmitViolations(fields.filter((f) => f.fieldname in after), before, after)[0];
  return v ? `Not allowed to change <strong>${esc(v.args[0])}</strong> after submission from <strong>${esc(v.args[1])}</strong> to <strong>${esc(v.args[2])}</strong>` : null;
}

const refuse = (message: string): never => {
  throw toFrappeError(417, { exc_type: "UpdateAfterSubmitError", _server_messages: JSON.stringify([JSON.stringify({ message, title: "Cannot Update After Submit", indicator: "red", raise_exception: 1 })]) });
};

const BULK_UPDATE = "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs";

export function withSubmitRules(base: FixtureTransport): FixtureTransport {
  const store = base.store;
  const record = (method: string, args: Record<string, unknown>) => store.calls.push({ method, args: JSON.parse(JSON.stringify(args)) as Record<string, unknown> });
  const t = (async (method: string, args: Record<string, unknown>): Promise<FrappeResponse> => {
    // validate_workflow (workflow.py:179-181): a document saved without a workflow state gets the FIRST state — e.g. an
    // amendment, whose state field is no_copy (workflow.py:55-56) and so arrives empty
    if (method === "frappe.desk.form.save.savedocs" || method === "frappe.client.insert" || method === "frappe.client.save") {
      const posted = parse(args.doc) as FrappeDoc | undefined;
      const wf = posted ? store.workflows[String(posted.doctype)] : undefined;
      if (posted && wf?.workflow_state_field && wf.states[0] && !posted[wf.workflow_state_field]) {
        args = { ...args, doc: JSON.stringify({ ...posted, [wf.workflow_state_field]: wf.states[0].state }) };
      }
    }
    if ((method === "frappe.desk.form.save.savedocs" && String(args.action) === "Update") || method === "frappe.client.save") {
      const posted = parse(args.doc) as FrappeDoc | undefined;
      const err = posted && !posted.__islocal ? updateAfterSubmitError(store, posted) : null;
      if (err) { record(method, args); refuse(err); }
    }
    if (method === "frappe.client.set_value") {
      const meta = metaOf(store, String(args.doctype));
      const cur = meta ? store.docs.get(meta.name)?.get(String(args.name)) : undefined;
      if (cur && Number(cur.docstatus) === 1) {
        const f = parse(args.fieldname);
        const patch = f && typeof f === "object" ? (f as Row) : { [String(f)]: args.value };
        const err = updateAfterSubmitError(store, { ...cur, ...patch } as FrappeDoc);
        if (err) { record(method, args); refuse(err); }
      }
    }
    if (method === BULK_UPDATE && String(args.action) === "update") {
      const doctype = String(args.doctype);
      const names = ((parse(args.docnames) as unknown[] | undefined) ?? []).map(String);
      const data = (parse(args.data) as Row | undefined) ?? {};
      const refused = names.filter((n) => {
        const cur = store.docs.get(doctype)?.get(n);
        return !!cur && Number(cur.docstatus) === 1 && !!updateAfterSubmitError(store, { ...cur, ...data } as FrappeDoc);
      });
      if (refused.length) {
        const rest = names.filter((n) => !refused.includes(n));
        record(method, args);
        if (!rest.length) return names.length < 20 ? { message: refused } : ({ _server_messages: JSON.stringify([JSON.stringify({ message: "Bulk operation is enqueued in background.", alert: 1 })]) } as FrappeResponse);
        const res = await base(method, { ...args, docnames: JSON.stringify(rest) });
        // < 20: the failed names in request order (bulk_update.py:114); 20–500: enqueued, no answer
        if (names.length < 20) { const failed = new Set([...refused, ...((res.message as string[] | undefined) ?? [])]); return { message: names.filter((n) => failed.has(n)) }; }
        return res;
      }
    }
    if (method === "frappe.desk.reportview.delete_items" && !base.permissions) {
      const items = ((parse(args.items) as unknown[] | undefined) ?? []).map(String);
      record(method, args);
      const attempt = async (ns: string[]) => {
        const failed: string[] = [];
        for (const n of ns) { try { await base("frappe.client.delete", { doctype: args.doctype, name: n }); } catch { failed.push(n); } }
        return failed;
      };
      let failed = await attempt([...items].sort().reverse()); // delete_items sorts, reversed (reportview.py:579)
      // delete_bulk retries the failed names while some went through (:608-610)
      while (failed.length) { const again = await attempt(failed); if (again.length === failed.length) break; failed = again; }
      store.published.push(failed.length
        ? { event: "msgprint", title: "Bulk Operation Failed", message: `Failed to delete ${failed.length} documents: ${failed.join(", ")}` }
        : { event: "msgprint", title: "Bulk Operation Successful", message: "Deleted all documents successfully" });
      return {};
    }
    return base(method, args);
  }) as FixtureTransport;
  t.store = base.store;
  t.files = base.files;
  t.permissions = base.permissions;
  return t;
}
