/**
 * SIMULATED handlers added by the P35 "record" workstream. Each handler cites the Frappe 15.110 source of its response
 * shape (paths relative to `apps/frappe/frappe/`). They reproduce REQUEST and RESPONSE SHAPES only:
 *  - permission checks go through the transport's own SIMULATED permission engine (P35 integration: `ctx.assertDoc`,
 *    DocPerm rows × roles, if_owner, User Permissions, shares, controller hooks — see ../permissions.ts) when
 *    `createFixtureTransport(…, { permissions })` is used; without `permissions` nothing is refused;
 *  - Print Settings and the clock are the transport's (`ctx.printSettings()`: a stored "Print Settings" single, else
 *    `options.printSettings`; `ctx.now()` / `ctx.stamp()` from `options.now`);
 *  - nothing is rendered, sent or scheduled: the print preview is a labelled placeholder WITHOUT document values (as the
 *    simulated PDF / export files), the e-mail is only recorded as a Communication, the reminder is only stored.
 */
import { toFrappeError, type FrappeResponse } from "../../client";
import type { DocTypeMeta, FrappeDoc } from "../../contract";
import type { FixtureContextHandler, FixtureStore } from "../fixtureTransport";

type Row = Record<string, unknown>;
const sm = (...messages: Row[]) => JSON.stringify(messages.map((m) => JSON.stringify(m)));
function fail(status: number, exc_type: string, message: string): never {
  throw toFrappeError(status, { exc_type, _server_messages: sm({ message, indicator: "red", raise_exception: 1 }) });
}
const parse = (v: unknown): unknown => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return v; } };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const on = (v: unknown) => v === true || v === 1 || v === "1";
const hash = () => { let s = ""; while (s.length < 10) s += Math.random().toString(36).slice(2); return s.slice(0, 10); };

const metaOf = (store: FixtureStore, doctype: string): DocTypeMeta | undefined => store.meta[doctype]?.[0];
const table = (store: FixtureStore, doctype: string) => {
  let t = store.docs.get(doctype);
  if (!t) { t = new Map(); store.docs.set(doctype, t); }
  return t;
};
function getDoc(store: FixtureStore, doctype: string, name: unknown): FrappeDoc {
  const doc = store.docs.get(doctype)?.get(String(name ?? ""));
  if (!doc) fail(404, "DoesNotExistError", `${doctype} ${String(name ?? "")} not found`);
  return doc;
}

const LAYOUT = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Heading", "Fold", "Button", "Image", "Page Break"]);

export const recordHandlers: Record<string, FixtureContextHandler> = {
  /**
   * desk/notifications.py:244-314 `get_open_count` → `_get_linked_document_counts`: READ on the document
   * (`doc.check_permission()`), the dashboard from the meta (`get_dashboard_data`, model/meta.py:652-720 — here the
   * stored meta's `__dashboard`, i.e. what getdoctype sends), `items` (JSON) or every transaction item; internal links
   * (:316-337) → `{ doctype, open_count: 0, count, names }`, the rest (:340-355) → `{ doctype, count, open_count }` counted
   * by `{ fieldname | non_standard_fieldnames[d]: name }` plus the dynamic-link filter (:370-388), capped at 100
   * (`get_doc_count` limit=100, :358-367), WITHOUT the linked DocTypes' permissions (frappe.get_all). `open_count` is 0
   * (the simulator has no notification config, `get_filters_for` :237-241). No `timeline_data`.
   */
  "frappe.desk.notifications.get_open_count": (a, store, ctx) => {
    const doctype = String(a.doctype ?? "");
    const doc = getDoc(store, doctype, a.name);
    ctx.assertDoc(doc, "read");
    const d = ((metaOf(store, doctype)?.__dashboard ?? {}) as Row);
    const transactions = (Array.isArray(d.transactions) ? d.transactions : []) as { items?: string[] }[];
    const raw = parse(a.items);
    const items: string[] = Array.isArray(raw) ? raw.map(String) : transactions.flatMap((g) => g.items ?? []);
    const internal = { ...((d.internal_and_external_links ?? {}) as Row), ...((d.internal_links ?? {}) as Row) };
    const nonStandard = (d.non_standard_fieldnames ?? {}) as Record<string, string>;
    const dynamic = (d.dynamic_links ?? {}) as Record<string, [string, string]>;
    const external_links_found: Row[] = [];
    const internal_links_found: Row[] = [];
    const external = (target: string): Row => {
      const fieldname = nonStandard[target] ?? String(d.fieldname ?? "");
      const filters: Row = { [fieldname]: doc.name };
      const dyn = dynamic[fieldname];
      const targetMeta = metaOf(store, target);
      if (dyn && targetMeta?.fields.some((f) => f.fieldname === dyn[1])) filters[dyn[1]] = dyn[0];
      const rows = [...(store.docs.get(target)?.values() ?? [])].filter((r) => Object.entries(filters).every(([k, v]) => (r as Row)[k] === v));
      return { doctype: target, count: Math.min(rows.length, 100), open_count: 0 };
    };
    for (const item of items) {
      const link = internal[item] as string | [string, string] | undefined;
      if (link) {
        const names: string[] = [];
        if (typeof link === "string") { const v = (doc as Row)[link]; if (v && !names.includes(String(v))) names.push(String(v)); }
        else for (const row of ((doc as Row)[link[0]] as Row[] | undefined) ?? []) { const v = row[link[1]]; if (v && !names.includes(String(v))) names.push(String(v)); }
        if (names.length) { internal_links_found.push({ doctype: item, open_count: 0, count: names.length, names }); continue; }
        try { external_links_found.push(external(item)); } catch { external_links_found.push({ doctype: item, open_count: 0, count: 0 }); }
      } else external_links_found.push(external(item));
    }
    return { message: { count: { external_links_found, internal_links_found } } };
  },

  /**
   * www/printview.py:304-341 `get_html_and_style(doc, name, print_format, no_letterhead, letterhead, trigger_print,
   * style, settings)`: `doc` + `name` or a JSON document; `document.check_permission()` (read); the draft / cancelled
   * rule of `get_rendered_template` (:137-142, Print Settings — `ctx.printSettings()`: a stored "Print Settings" single,
   * else the transport's `printSettings` option; default draft allowed / cancelled not); answers `{ html, style }`. The HTML is a SIMULATED placeholder: the format / letterhead
   * requested and the LABELS of the printable fields (not `print_hide`) — never document values.
   */
  "frappe.www.printview.get_html_and_style": (a, store, ctx) => {
    let posted: FrappeDoc;
    if (typeof a.name === "string" && a.name) posted = getDoc(store, String(a.doc), a.name);
    else {
      const d = parse(a.doc) as FrappeDoc | null;
      if (!d || typeof d !== "object" || !d.doctype) fail(417, "ValidationError", "SIMULATED: get_html_and_style needs a document");
      posted = d;
      // frappe.get_doc(dict) of a saved document: the stored row decides docstatus / owner for the checks
      const stored = store.docs.get(d.doctype)?.get(String(d.name ?? ""));
      if (stored) posted = { ...posted, docstatus: stored.docstatus };
    }
    ctx.assertDoc(posted, "read");
    const meta = metaOf(store, posted.doctype);
    if (on(meta?.is_submittable)) {
      const s = ctx.printSettings();
      const ds = Number(posted.docstatus ?? 0);
      if (ds === 0 && !s.allow_print_for_draft) fail(403, "PermissionError", "Not allowed to print draft documents");
      if (ds === 2 && !s.allow_print_for_cancelled) fail(403, "PermissionError", "Not allowed to print cancelled documents");
    }
    const format = String(a.print_format ?? "Standard") || "Standard";
    const letterhead = on(a.no_letterhead) ? "No Letterhead" : String(a.letterhead ?? "");
    const labels = (meta?.fields ?? []).filter((f) => !LAYOUT.has(f.fieldtype) && !on(f.print_hide) && !on(f.hidden)).map((f) => f.label || f.fieldname);
    const html = [
      `<div class="print-format sim">`,
      `<p class="sim-banner"><strong>SIMULATED preview</strong> — in-browser Frappe simulator. No print format was rendered; on a site the server renders "${esc(format)}" with Jinja. Field values are not reproduced.</p>`,
      `<h2>${esc(posted.doctype)} · ${esc(String(posted.name ?? ""))}</h2>`,
      `<p>Print Format: ${esc(format)} · Letter Head: ${esc(letterhead || "—")}</p>`,
      `<table>${labels.map((l) => `<tr><th>${esc(l)}</th><td>•••</td></tr>`).join("")}</table>`,
      `</div>`,
    ].join("");
    const style = ".print-format{font-family:sans-serif;padding:24px;color:#111}.sim-banner{background:#fff4d6;border:1px solid #e8b400;padding:8px;border-radius:6px;font-size:12px}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:4px 8px;text-align:start;font-size:13px}";
    return { message: { html, style } } as FrappeResponse;
  },

  /**
   * core/doctype/communication/email.py:27-200 `make`: `has_permission(doctype, doc=name, ptype="email", throw=True)`
   * (:83-84; a missing document → DoesNotExistError), recipients validated (`validate_email`, :203-213 →
   * InvalidEmailAddressError, a ValidationError), a Communication inserted (:147-171: subject, content, sender, recipients
   * / cc / bcc as text, sent_or_received, reference_doctype / reference_name, email_template, read_receipt,
   * has_attachment), File attachments recorded (`add_attachments`, :240-270). Answer `{ name, emails_not_sent_to }`
   * (:200). SIMULATED: nothing is queued or sent (no Email Account, no Email Queue); `emails_not_sent_to` is "".
   */
  "frappe.core.doctype.communication.email.make": (a, store, ctx) => {
    const doctype = String(a.doctype ?? "");
    const doc = getDoc(store, doctype, a.name);
    ctx.assertDoc(doc, "email");
    const split = (v: unknown) => String(v ?? "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    const valid = (e: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test((/<([^<>]+)>\s*$/.exec(e)?.[1] ?? e).trim());
    for (const e of [...split(a.recipients), ...split(a.cc), ...split(a.bcc)]) if (!valid(e)) fail(417, "InvalidEmailAddressError", `${e} is not a valid Email Address`);
    const attachments = (parse(a.attachments) as unknown[] | null) ?? [];
    const name = hash();
    const ts = ctx.stamp();
    const comm = {
      doctype: "Communication", name, subject: a.subject ?? null, content: a.content ?? null, sender: a.sender || ctx.user, sender_full_name: a.sender_full_name ?? null,
      recipients: a.recipients || null, cc: a.cc || null, bcc: a.bcc || null, communication_medium: "Email", sent_or_received: "Sent", communication_type: "Communication",
      communication_date: ts, delivery_status: "Sent",
      reference_doctype: doctype, reference_name: doc.name, email_template: a.email_template || null, read_receipt: on(a.read_receipt) ? 1 : 0,
      has_attachment: Array.isArray(attachments) && attachments.length ? 1 : 0, attachments: JSON.stringify(attachments), print_format: a.print_format ?? null,
      send_me_a_copy: on(a.send_me_a_copy) ? 1 : 0, status: "Linked", owner: store.user, creation: ts, modified: ts, modified_by: store.user, docstatus: 0,
      _simulated: "SIMULATED: recorded only — no e-mail was queued or sent",
    } as unknown as FrappeDoc;
    table(store, "Communication").set(name, comm);
    return { message: { name, emails_not_sent_to: "" } };
  },

  /**
   * email/doctype/email_template/email_template.py:50-55 `get_email_template(template_name, doc)` → `{ subject, message }`
   * (`get_formatted_email`, :41-48: `response_html` when `use_html`, else `response`, rendered against the document).
   * SIMULATED rendering: only `{{ field }}` / `{{ doc.field }}` placeholders are replaced — no Jinja.
   */
  "frappe.email.doctype.email_template.email_template.get_email_template": (a, store) => {
    const tpl = getDoc(store, "Email Template", a.template_name) as Row;
    const doc = (parse(a.doc) ?? {}) as Row;
    const render = (s: unknown) => String(s ?? "").replace(/\{\{\s*(?:doc\.)?([a-zA-Z_][\w]*)\s*\}\}/g, (_, k: string) => String(doc[k] ?? ""));
    return { message: { subject: render(tpl.subject), message: render(on(tpl.use_html) ? tpl.response_html : tpl.response) } };
  },

  /**
   * automation/doctype/reminder/reminder.py:58-74 `create_new_reminder(remind_at, description, reminder_doctype,
   * reminder_docname)` → `reminder.insert()` (the inserted Reminder as a dict). `validate` (:36-39): `user` = the session
   * user; a time in the past → "Reminder cannot be created in past." (ValidationError, 417). `description` / `remind_at`
   * are mandatory (reminder.json). SIMULATED: stored only; nothing is scheduled (`send_reminders` never runs).
   */
  "frappe.automation.doctype.reminder.reminder.create_new_reminder": (a, store, ctx) => {
    if (!String(a.remind_at ?? "").trim() || !String(a.description ?? "").trim()) fail(417, "MandatoryError", "[Reminder]: remind_at, description");
    const at = new Date(String(a.remind_at).replace(" ", "T"));
    if (Number.isNaN(at.getTime())) fail(417, "ValidationError", `${String(a.remind_at)} is not a valid datetime`);
    if (at.getTime() < ctx.now().getTime()) fail(417, "ValidationError", "Reminder cannot be created in past.");
    const name = hash();
    const ts = ctx.stamp();
    const reminder = {
      doctype: "Reminder", name, user: store.user, remind_at: String(a.remind_at), description: String(a.description), reminder_doctype: a.reminder_doctype ?? null,
      reminder_docname: a.reminder_docname ?? null, notified: 0, owner: store.user, creation: ts, modified: ts, modified_by: store.user, docstatus: 0, idx: 0,
    } as unknown as FrappeDoc;
    table(store, "Reminder").set(name, reminder);
    return { message: clone(reminder) };
  },
};
