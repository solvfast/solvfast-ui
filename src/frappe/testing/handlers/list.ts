/**
 * SIMULATED handlers added by the P35 "list" workstream. Each handler cites the Frappe 15.110 source of its response shape.
 * They are request/response-shape stand-ins for tests and the Showcase, never evidence of server behaviour.
 *
 * Rows come from the transport's own row filter (`ctx.rows`, P35 integration): every simulated operator, child-table
 * (4-tuple) conditions and — with `createFixtureTransport(…, { permissions })` — only the rows the session may read
 * (`frappe.get_list` applies permissions in both server methods; 403 without read).
 */
import type { FixtureContextHandler, FixtureHandler, FixtureStore } from "../fixtureTransport";
import { toFrappeError, type FrappeResponse } from "../../client";
import type { FixtureBackend, FrappeDoc } from "../../contract";

type Row = Record<string, unknown>;
const parse = (v: unknown): unknown => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
const blank = (v: unknown) => v === null || v === undefined || v === "";

export const listHandlers: Record<string, FixtureContextHandler> = {
  /**
   * `frappe.desk.listview.get_group_by_count(doctype, current_filters, field)` — frappe/desk/listview.py:33-89:
   * - `assigned_to`: open (status != Cancelled) ToDos of System Users whose `reference_name` is one of the filtered
   *   records (the server's sub-query does not check `reference_type`; reproduced as is), grouped by `allocated_to`,
   *   `[{name, count}]` ordered by count desc, at most 50 (:36-60);
   * - any other field of the DocType (or a default field): `count(*) as count, <field> as name` grouped by the field,
   *   count desc (:62-71); for `owner` the session user moves to the top (:73-84); at most 50.
   * Unknown field → ValueError("Field does not belong to doctype") (:62-63).
   */
  "frappe.desk.listview.get_group_by_count": (a, store, ctx) => {
    const doctype = String(a.doctype);
    const field = String(a.field);
    const rows = ctx.rows(doctype, { filters: a.current_filters }) as Row[];
    // count desc; ties by value (SQL leaves their order open — a deterministic SIMULATED choice), "no value" last
    const byCount = (m: Map<string | null, number>) => [...m.entries()].map(([name, count]) => ({ name, count }))
      .sort((x, y) => y.count - x.count || (x.name === null ? 1 : y.name === null ? -1 : x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
    if (field === "assigned_to") {
      const names = new Set(rows.map((r) => String(r.name)));
      const users = store.docs.get("User");
      const counts = new Map<string | null, number>();
      for (const t of store.todos.values()) {
        if (t.status === "Cancelled" || !names.has(String(t.reference_name ?? ""))) continue;
        const u = String(t.allocated_to ?? "");
        const user = users?.get(u) as Row | undefined;
        if (!u || (users?.size && (!user || (user.user_type ?? "System User") !== "System User"))) continue;
        counts.set(u, (counts.get(u) ?? 0) + 1);
      }
      return { message: byCount(counts).slice(0, 50) };
    }
    const meta = store.meta[doctype]?.[0];
    const DEFAULT = ["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx", "parent", "parentfield", "parenttype"];
    if (!(meta?.fields ?? []).some((df) => df.fieldname === field) && !DEFAULT.includes(field)) {
      throw toFrappeError(417, { exc_type: "ValueError", _server_messages: JSON.stringify([JSON.stringify({ message: "Field does not belong to doctype", indicator: "red" })]) });
    }
    const counts = new Map<string | null, number>();
    for (const r of rows) { const v = blank(r[field]) ? null : String(r[field]); counts.set(v, (counts.get(v) ?? 0) + 1); }
    let data = byCount(counts);
    if (field === "owner") {
      const i = data.findIndex((d) => d.name === store.user);
      data = i > 0 ? [data[i], ...data.filter((_, j) => j !== i).slice(0, 49)] : data.slice(0, 50);
    } else data = data.slice(0, 50);
    return { message: data };
  },

  /**
   * `frappe.desk.reportview.get_sidebar_stats(stats, doctype, filters)` → `{stats: {<column>: [[value, count], …]}}`
   * (reportview.py:623-636 → get_stats :639-696). For `_user_tags`: the `",a,b"` strings are split and counted per tag
   * (`scrub_user_tags`, :750-765), then `["No Tags", n]` is appended (:672-683); other columns: `[value, count]` rows of
   * non-empty values.
   */
  "frappe.desk.reportview.get_sidebar_stats": (a, _store, ctx) => {
    const doctype = String(a.doctype);
    const columns = (parse(a.stats) as string[] | undefined) ?? [];
    const rows = ctx.rows(doctype, { filters: a.filters }) as Row[];
    const stats: Record<string, [string, number][]> = {};
    for (const column of columns) {
      if (column === "_user_tags") {
        const tags = new Map<string, number>();
        let none = 0;
        for (const r of rows) {
          const parts = String(r._user_tags ?? "").split(",").filter(Boolean);
          if (!parts.length) none += 1;
          for (const tag of parts) tags.set(tag, (tags.get(tag) ?? 0) + 1);
        }
        stats[column] = [...tags.entries(), ["No Tags", none]];
      } else {
        const counts = new Map<string, number>();
        for (const r of rows) if (!blank(r[column])) counts.set(String(r[column]), (counts.get(String(r[column])) ?? 0) + 1);
        stats[column] = [...counts.entries()];
      }
    }
    return { message: { stats } };
  },

  /**
   * `frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings(doctype, listview_settings,
   * removed_listview_fields)` — list_view_settings.py:29-46: inserts or updates the `List View Settings` row named after
   * the DocType, then flips `in_list_view` (Property Setters, :49-85) on for the listed fields and off for the removed
   * ones (never for `status_field`), and answers `{meta, listview_settings}`. SIMULATED: the row is kept as a
   * `List View Settings` document in the store and `in_list_view` is changed on the stored meta (what a re-read of
   * `getdoctype` then returns). `get_list_settings` keeps answering from the transport's `listSettings` option — the
   * client takes the saved row from this response, as Desk does (list_settings.js:51-53 `refresh_columns`).
   */
  "frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings": (a, store) => {
    const doctype = String(a.doctype);
    const values = (parse(a.listview_settings) as Row | undefined) ?? {};
    const removed = (parse(a.removed_listview_fields) as string[] | undefined) ?? [];
    let table = store.docs.get("List View Settings");
    if (!table) { table = new Map(); store.docs.set("List View Settings", table); }
    const prev = (table.get(doctype) as Row | undefined) ?? { doctype: "List View Settings", name: doctype };
    const doc = { ...prev, ...values, doctype: "List View Settings", name: doctype };
    table.set(doctype, doc as never);
    const listed = ((parse(values.fields) as { fieldname?: string }[] | undefined) ?? []).map((f) => f.fieldname).filter((f): f is string => !!f);
    const meta = store.meta[doctype]?.[0];
    if (meta) {
      for (const df of meta.fields ?? []) {
        if (df.fieldname === "status_field") continue;
        if (removed.includes(df.fieldname)) (df as Row).in_list_view = 0;
        if (listed.includes(df.fieldname)) (df as Row).in_list_view = 1;
      }
    }
    return { message: { meta: meta ?? null, listview_settings: doc } };
  },
};

// ---- P36b bulk ------------------------------------------------------------------------------------------------------

/** The method Desk's bulk Submit / Cancel / Edit call (bulk_operations.js:280, :343-356). */
export const BULK_UPDATE_METHOD = "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs";

const msgs = (...m: Row[]) => JSON.stringify(m.map((x) => JSON.stringify(x)));
const fail = (status: number, exc_type: string, message: string, extra: Row = {}): never => {
  throw toFrappeError(status, { exc_type, _server_messages: msgs({ message, indicator: "red", raise_exception: 1, ...extra }) });
};

/**
 * The first SUBMITTED document that links to `doctype` / `name` through a Link field — what blocks a Cancel
 * (`Document.check_no_back_links_exist`, document.py:1184-1186, 1300-1306 → delete_doc.py `get_linked_docs` :265-331,
 * method "Cancel"): every Link field whose `options` is the DocType (`get_link_fields`), except `amended_from` (:283); a
 * child-table row counts with its parent's docstatus (:303-310, the row carries it in Frappe); the document itself is
 * skipped (:318-320). SIMULATED subset: Dynamic Links (`check_if_doc_is_dynamically_linked`, :344-430), Single DocTypes
 * and the document's `ignore_linked_doctypes` are not simulated.
 */
export function submittedBackLink(store: FixtureStore, doctype: string, name: string): { doctype: string; name: string } | null {
  const metas = Object.values(store.meta).flat();
  for (const m of metas) {
    const fields = (m.fields ?? []).filter((f) => f.fieldtype === "Link" && f.options === doctype && f.fieldname !== "amended_from");
    if (!fields.length) continue;
    if (m.istable) {
      for (const parentMeta of metas) {
        const tables = (parentMeta.fields ?? []).filter((f) => (f.fieldtype === "Table" || f.fieldtype === "Table MultiSelect") && f.options === m.name);
        if (!tables.length) continue;
        for (const d of store.docs.get(parentMeta.name)?.values() ?? []) {
          if (Number(d.docstatus ?? 0) !== 1) continue;
          if (parentMeta.name === doctype && String(d.name) === name) continue;
          for (const tf of tables) for (const row of (d[tf.fieldname] as Row[] | undefined) ?? []) {
            if (fields.some((f) => String(row[f.fieldname] ?? "") === name)) return { doctype: parentMeta.name, name: String(d.name) };
          }
        }
      }
      continue;
    }
    for (const d of store.docs.get(m.name)?.values() ?? []) {
      if (Number(d.docstatus ?? 0) !== 1) continue;
      if (m.name === doctype && String(d.name) === name) continue;
      if (fields.some((f) => String(d[f.fieldname] ?? "") === name)) return { doctype: m.name, name: String(d.name) };
    }
  }
  return null;
}

/**
 * SIMULATED `submit_cancel_or_update_docs(doctype, docnames, action="submit", data=None, task_id=None)` exactly as
 * frappe/desk/doctype/bulk_update/bulk_update.py:51-114 dispatches it, delegating each document's own Submit / Cancel /
 * Save to the transport's form path (so the same permission, mandatory and docstatus checks apply as in the form):
 *
 * - fewer than 20 names (:56-57): `_bulk_action` runs now and the answer is the list of FAILED names (`[]` = all done);
 * - 20 to 500 (:58-69): an alert "Bulk operation is enqueued in background." (`msgprint(alert=True)`) and NO `message`;
 *   the job (`queue="short"`) is SIMULATED as having run at once — its failures are only logged (`log_error`, :109-112),
 *   never answered;
 * - more than 500 (:70-71): ValidationError "Bulk operations only support up to 500 documents." ("Too Many Documents").
 *
 * `_bulk_action` (:74-114), per name in order:
 * - `frappe.get_doc` sits OUTSIDE the try (:82): an unknown name fails the WHOLE request (DoesNotExistError, 404) — the
 *   documents handled before it stay changed (`frappe.db.commit()` per document, :101);
 * - submit only a DRAFT (`docstatus.is_draft()`, :85) → `doc.submit()` (:90) = the form's Submit (`savedocs`, action
 *   "Submit": write + submit rights, mandatory fields, document.py:404, 880-915); `queue_in_background` DocTypes queue a
 *   Submission Queue only while the scheduler runs (:86-88) — the simulator has no scheduler, so they submit directly
 *   (`is_scheduler_inactive()`, the server's own fallback);
 * - cancel only a SUBMITTED one (:92-93) → `doc.cancel()` = the form's Cancel (write + cancel rights) — refused while a
 *   submitted document links to it (`check_no_back_links_exist`, see `submittedBackLink`);
 * - update anything not cancelled (:95-98) → `doc.update(data); doc.save()` (Update after Submit for a submitted one);
 * - any other docstatus → failed WITHOUT an exception (:99-100); any exception → failed and rolled back (:109-112).
 * `frappe.publish_progress` (:102-107) is not simulated (the package does not subscribe to `task_id`).
 *
 * Opt-in like `reportSetValueHandler`: `createFixtureTransport(backend, { handlers: { [BULK_UPDATE_METHOD]:
 * bulkUpdateHandler(() => transport) } })`. The nested form calls are recorded in `store.calls` too.
 */
export function bulkUpdateHandler(transport: () => (method: string, args: Record<string, unknown>) => Promise<FrappeResponse>): FixtureHandler {
  return async (a, store) => {
    const doctype = String(a.doctype);
    const names = ((parse(a.docnames) as unknown[] | undefined) ?? []).map(String);
    const action = String(a.action ?? "submit");
    const data = (parse(a.data) as Row | undefined) ?? undefined;
    const call = (m: string, args: Record<string, unknown>) => transport()(m, args);
    const run = async (): Promise<string[]> => {
      const failed: string[] = [];
      for (const name of names) {
        const doc: FrappeDoc = store.docs.get(doctype)?.get(name) ?? fail(404, "DoesNotExistError", `${doctype} ${name} not found`);
        try {
          const ds = Number(doc.docstatus ?? 0);
          if (action === "submit" && ds === 0) await call("frappe.desk.form.save.savedocs", { doc: JSON.stringify(doc), action: "Submit" });
          else if (action === "cancel" && ds === 1) {
            const link = submittedBackLink(store, doctype, name);
            if (link) fail(417, "LinkExistsError", `Cannot delete or cancel because ${doctype} ${name} is linked with ${link.doctype} ${link.name}`);
            await call("frappe.desk.form.save.cancel", { doctype, name });
          } else if (action === "update" && ds !== 2) await call("frappe.desk.form.save.savedocs", { doc: JSON.stringify({ ...doc, ...(data ?? {}) }), action: ds === 1 ? "Update" : "Save" });
          else failed.push(name);
        } catch { failed.push(name); }
      }
      return failed;
    };
    if (names.length < 20) return { message: await run() };
    if (names.length <= 500) {
      // the background job, SIMULATED as having run at once; an exception there (unknown name) only ends the job
      try { await run(); } catch { /* frappe.log_error in the worker */ }
      return { _server_messages: msgs({ message: "Bulk operation is enqueued in background.", alert: 1 }) } as FrappeResponse;
    }
    return fail(417, "ValidationError", "Bulk operations only support up to 500 documents.", { title: "Too Many Documents" });
  };
}

/**
 * P36b — demo site for bulk Submit / Cancel (Showcase): a submittable "Demo Invoice" with an item table, 24 invoices in
 * every docstatus (two drafts miss the mandatory customer; INV-0005 is linked from the submitted PAY-0001, so its Cancel
 * is refused), and roles: "Accounts Manager" (submit + cancel), "Submitter" (submit only), "Accounts User" (neither).
 * `workflow: true` adds an active Workflow (Desk then hides Submit / Cancel). SIMULATED demo data.
 */
export function bulkDemoBackend(opts: { workflow?: boolean } = {}): FixtureBackend {
  const perms = [
    { role: "Accounts Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, print: 1, export: 1 },
    { role: "Submitter", permlevel: 0, read: 1, write: 1, create: 1, submit: 1, print: 1 },
    { role: "Accounts User", permlevel: 0, read: 1, write: 1, create: 1, print: 1 },
  ];
  const invoice = {
    name: "Demo Invoice", autoname: "hash", is_submittable: 1, title_field: "customer", sort_field: "name", sort_order: "asc", permissions: perms,
    fields: [
      { fieldname: "customer", fieldtype: "Data", label: "Customer", reqd: 1, in_list_view: 1 },
      { fieldname: "amount", fieldtype: "Currency", label: "Amount", in_list_view: 1 },
      { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State", hidden: 1 },
      { fieldname: "items", fieldtype: "Table", label: "Items", options: "Demo Invoice Item" },
    ],
  };
  const item = { name: "Demo Invoice Item", istable: 1, fields: [{ fieldname: "item", fieldtype: "Data", label: "Item", in_list_view: 1 }] };
  const payment = { name: "Demo Payment", autoname: "hash", is_submittable: 1, permissions: perms, fields: [{ fieldname: "invoice", fieldtype: "Link", label: "Invoice", options: "Demo Invoice", in_list_view: 1 }] };
  const CUSTOMERS = ["Acme", "Globex", "Initech", "Umbrella", "Hooli", "Stark"];
  const invoices = Array.from({ length: 24 }, (_, i) => {
    const n = i + 1;
    const docstatus = n % 4 === 0 ? 2 : n % 3 === 0 || n === 5 ? 1 : 0;
    return {
      doctype: "Demo Invoice", name: `INV-${String(n).padStart(4, "0")}`, customer: n === 7 || n === 14 ? null : `${CUSTOMERS[i % CUSTOMERS.length]} ${n}`,
      amount: 100 * n, docstatus, workflow_state: docstatus === 0 ? "Draft" : "Approved", items: [{ item: `Item ${n}` }],
      modified: `2026-11-0${(n % 9) + 1} 10:00:00.000000`,
    };
  });
  const workflow = {
    name: "Invoice Flow", document_type: "Demo Invoice", workflow_state_field: "workflow_state",
    states: [{ state: "Draft", doc_status: "0", allow_edit: "Accounts Manager" }, { state: "Approved", doc_status: "1", allow_edit: "Accounts Manager" }],
    transitions: [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "Accounts Manager", allow_self_approval: 1 }],
  };
  return {
    meta: { "Demo Invoice": [invoice, item], "Demo Invoice Item": [item], "Demo Payment": [payment] },
    docs: {
      "Demo Invoice": invoices,
      "Demo Payment": [{ doctype: "Demo Payment", name: "PAY-0001", invoice: "INV-0005", docstatus: 1, modified: "2026-11-01 10:00:00.000000" }],
    },
    ...(opts.workflow ? { workflows: { "Demo Invoice": workflow } } : {}),
  } as unknown as FixtureBackend;
}
