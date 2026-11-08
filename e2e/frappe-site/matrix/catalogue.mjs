// P36 real-site test catalogue — the single source for docs/audit/p36/VALIDATION-MATRIX.md (render.mjs) and for the
// runner (run-matrix.mjs). PREPARED, NOT RUN: no test here has been executed against any site.
//
// Frappe citations: apps/frappe at 15.110.0 (commit ab7e5ae), source files read only — `file:line` is relative to the
// `frappe/` package. HTTP status of an exception = its `http_status_code` (exceptions.py): PermissionError 403,
// ValidationError and subclasses (MandatoryError, LinkValidationError, UpdateAfterSubmitError, LinkExistsError,
// TimestampMismatchError, WorkflowTransitionError, …) 417, CSRFTokenError 400, DoesNotExistError 404, NameError 409.
//
// kind: read (no data change except Frappe's own logs / _seen) · write (creates / changes synthetic SFUI records)
//       · reject (an unauthorised request that MUST fail; if Frappe wrongly accepts it, it writes — so it needs --write)
//       · browser (harness page, Playwright) · infra (needs something the seed cannot create; named in `infra`)
// automated: "api" (run-matrix.mjs runs it) · "browser" (run-matrix.mjs --browser) · "manual" (steps for a person)

export const FRAPPE_REF = "Frappe 15.110.0, apps/frappe commit ab7e5ae (source read, no site)";

// Records created by a run link contact #12 (no seeded parent uses it; restricted may not see it) and are titled
// "SFUI P36 RUN …", so the aggregate read checks below count only the SEEDED parents (title like "SFUI Parent %").
const RUN_CONTACT = (X) => X.names.contacts[11];
const SEEDED = ["title", "like", "SFUI Parent %"];
const parentDoc = (X, extra = {}) => ({
  doctype: "SFUI Test Parent", name: `new-sfui-test-parent-${Math.random().toString(36).slice(2, 8)}`, __islocal: 1, __unsaved: 1,
  status: "Draft", contact: RUN_CONTACT(X), ...extra,
});
const childRow = (i, extra = {}) => ({
  doctype: "SFUI Test Child", name: `new-sfui-test-child-${Math.random().toString(36).slice(2, 8)}`, __islocal: 1,
  parentfield: "items", parenttype: "SFUI Test Parent", idx: i, item_code: `SFUI-RUN-${i}`, qty: i, ...extra,
});
const J = JSON.stringify;
const savedocs = (s, doc, action = "Save") => s.call("frappe.desk.form.save.savedocs", { doc: J(doc), action });
const getdoc = (s, doctype, name) => s.call("frappe.desk.form.load.getdoc", { doctype, name }, "GET");
const docOf = (r) => r.body?.docs?.[0];
const is = (r, status, exc) => r.status === status && (!exc || r.exc_type === exc);

/** A fresh synthetic draft Parent created by `who` (write tests only). */
async function newParent(ctx, who = "manager", extra = {}) {
  const r = await savedocs(ctx.as(who), parentDoc(ctx.X, { title: `${ctx.tag} ${extra.title ?? "parent"}`, ...extra }));
  ctx.check(`${who} creates a synthetic draft Parent`, is(r, 200) && !!docOf(r)?.name, "200 + name", { status: r.status, exc_type: r.exc_type });
  return docOf(r);
}

export const TESTS = [
  // ---------------------------------------------------------------- FORM ------------------------------------------
  { id: "F-META-1", area: "Form", feature: "metadata / fieldtypes / tabs / sections", kind: "browser", automated: "browser", users: ["manager"],
    rows: ["FV.A1", "FV.A3", "FV.A4", "FV.A6", "FV.A7", "FV.A8", "FV.A9", "FV.A11", "FV.A12", "FV.A13", "FV.A15", "FV.A19", "FV.A22", "FV.A23", "FV.A24", "FV.A26", "FV.A27", "FV.A28", "FV.A44", "FV.B1", "FV.B2", "FV.B3", "FV.B5", "FV.B6", "FV.B8", "FV.J7", "FV.J9", "FV.M1"],
    pre: "seeded parent SFUI Parent 02 (Open, 2 child rows); harness served (`?view=form&doctype=SFUI Test Parent&name=<parent>`)",
    steps: ["log in as manager", "open the harness form", "read the tab bar, section labels, every field's control type", "screenshot each tab"],
    expect: "the real getdoctype meta drives the layout: tabs Main / Rules / Permissions and flags / Tables (Dependent Tab hidden until test_field = 'Show Tab'), one control per fieldtype, unsupported types reported, never a silent text box",
    cite: ["desk/form/load.py:67 getdoctype", "model/meta.py (DocField order)"], evidence: "screenshots per tab, the getdoctype response shape (field count by fieldtype)" },
  { id: "F-VIS-1", area: "Form", feature: "visibility / read-only / depends_on", kind: "browser", automated: "browser", users: ["writer"],
    rows: ["FV.C1", "FV.C2", "FV.C4", "FV.C6", "FV.C7", "FV.B4"],
    pre: "a draft parent owned by writer", steps: ["open the Rules tab", "type 'Value' in Test Field → Display Dependant Field appears", "type 'Some Other Value' → Dependant Field read-only", "tick Plain Dep Flag → Plain Dep Field appears; Collapsible section opens", "type 'Show Tab' → Dependent Tab appears"],
    expect: "Desk's client evaluation (the server does not evaluate depends_on); collapsible_depends_on re-evaluation is a known PARTIAL (FV.B4)",
    cite: ["public/js/frappe/form/layout.js (Desk client evaluation; no server counterpart)"], evidence: "screenshots before / after each change" },
  { id: "F-REQ-1", area: "Form", feature: "required (reqd) — server enforcement", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.A43", "FV.H2", "FV.A42"],
    pre: "seeded site", steps: ["writer: savedocs Save of a new Parent without `title` (reqd)"],
    expect: "417 MandatoryError; the message names the missing field (`Error: Value missing for SFUI Test Parent: Title`); nothing inserted",
    cite: ["model/document.py:946 _validate_mandatory", "model/base_document.py:738-786 _get_missing_mandatory_fields"], evidence: "status, exc_type, _server_messages (redacted), count of parents before / after",
    async run(ctx) {
      const r = await savedocs(ctx.as("writer"), parentDoc(ctx.X, { title: "" }));
      ctx.check("missing reqd title → 417 MandatoryError", is(r, 417, "MandatoryError"), "417 MandatoryError", { status: r.status, exc_type: r.exc_type });
    } },
  { id: "F-REQ-2", area: "Form", feature: "mandatory_depends_on — client-only rule", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.C3"],
    pre: "seeded site", steps: ["writer: savedocs Save of a new Parent with test_field = 'Some Value' and dependant_field empty", "browser (optional): the same in the harness must be blocked before any request"],
    expect: "the SERVER ACCEPTS it (200): Frappe enforces only `reqd` on the server, so mandatory_depends_on is a client rule — the package must block it in the form (FV.C3 'client-only (as Desk)')",
    cite: ["model/base_document.py:775-777 (only reqd fields are checked)"], evidence: "status + saved name; harness screenshot of the client-side error",
    async run(ctx) {
      const r = await savedocs(ctx.as("writer"), parentDoc(ctx.X, { title: `${ctx.tag} mdo`, test_field: "Some Value", dependant_field: "" }));
      ctx.check("server does not enforce mandatory_depends_on (200)", is(r, 200), 200, { status: r.status, exc_type: r.exc_type });
    } },
  { id: "F-REQ-3", area: "Form", feature: "workflow-state mandatory (mandatory_depends_on on workflow_state)", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.C5"],
    pre: "a fresh SFUI Test Workflow doc in SFUI Draft (approval_notes empty)", steps: ["writer: apply_workflow 'SFUI Request Approval' → state SFUI Pending", "browser (optional): the harness form shows Approval Notes as mandatory in SFUI Pending and blocks Save without it"],
    expect: "apply_workflow succeeds (server does not evaluate mandatory_depends_on); the client marks approval_notes mandatory in SFUI Pending",
    cite: ["model/workflow.py:99-148 apply_workflow", "model/base_document.py:775-777"], evidence: "workflow_state before / after; screenshot",
    async run(ctx) {
      const w = ctx.as("writer");
      const c = await savedocs(w, { doctype: "SFUI Test Workflow", name: "new-sfui-test-workflow-1", __islocal: 1, subject: `${ctx.tag} wf`, amount: 10, workflow_state: "SFUI Draft" });
      const doc = docOf(c);
      ctx.check("writer creates a workflow doc", is(c, 200) && !!doc, 200, c.status);
      if (!doc) return;
      const a = await w.call("frappe.model.workflow.apply_workflow", { doc: J(doc), action: "SFUI Request Approval" });
      ctx.check("Request Approval without approval_notes → SFUI Pending", is(a, 200) && a.message?.workflow_state === "SFUI Pending", "SFUI Pending", { status: a.status, state: a.message?.workflow_state });
    } },
  { id: "F-CHILD-1", area: "Form", feature: "child tables — save, idx, naming, delete, reorder", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.G12", "FV.G2", "FV.G3", "FV.G4", "FV.G11", "FV.A23"],
    pre: "seeded site", steps: ["writer: insert a Parent with 3 child rows", "remove row 2, swap rows 1 and 3 (idx 1, 2), save"],
    expect: "inserted rows get server names, parent = the parent's name, parentfield 'items', parenttype, idx 1..3; after the update exactly 2 rows with idx 1, 2 in the sent order (the deleted row is gone from the table)",
    cite: ["model/document.py:261 insert", "model/document.py:380 _save (child rows: update_child_table)", "model/base_document.py (set_parent_in_children)"], evidence: "child rows (name, idx, item_code) before / after",
    async run(ctx) {
      const w = ctx.as("writer");
      const r = await savedocs(w, parentDoc(ctx.X, { title: `${ctx.tag} child`, items: [childRow(1), childRow(2), childRow(3)] }));
      const d = docOf(r);
      ctx.check("3 rows saved with idx 1..3 and the parent's name", is(r, 200) && d?.items?.length === 3 && d.items.every((x, i) => x.idx === i + 1 && x.parent === d.name && x.parentfield === "items"), "idx 1..3", d?.items?.map((x) => ({ idx: x.idx, parent: x.parent === d.name })));
      if (!d) return;
      const kept = [{ ...d.items[2], idx: 1 }, { ...d.items[0], idx: 2 }];
      const u = await savedocs(w, { ...d, items: kept });
      const e = docOf(u);
      ctx.check("after delete + reorder: 2 rows, idx 1, 2 in the sent order", is(u, 200) && e?.items?.map((x) => x.item_code).join() === "SFUI-RUN-3,SFUI-RUN-1", "SFUI-RUN-3,SFUI-RUN-1", e?.items?.map((x) => x.item_code));
    } },
  { id: "F-CHILD-2", area: "Form", feature: "child row required field", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.G7"],
    pre: "seeded site", steps: ["writer: insert a Parent whose child row lacks item_code (reqd)"],
    expect: "417 MandatoryError naming 'SFUI Test Child Row #1: Value missing for: Item Code'",
    cite: ["model/base_document.py:748-756 (row message)", "model/document.py:946"], evidence: "status, exc_type, message",
    async run(ctx) {
      const r = await savedocs(ctx.as("writer"), parentDoc(ctx.X, { title: `${ctx.tag} child-reqd`, items: [childRow(1, { item_code: "" })] }));
      ctx.check("child row without reqd item_code → 417 MandatoryError", is(r, 417, "MandatoryError"), "417 MandatoryError", { status: r.status, exc_type: r.exc_type });
    } },
  { id: "F-LINK-1", area: "Form", feature: "Link / Dynamic Link validation on save", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.F7", "FV.A25", "FV.F4"],
    pre: "seeded site", steps: ["writer: save a Parent with contact = 'SFUI-NOPE'", "writer: save a Parent with ref_type = 'SFUI Test Contact', ref_name = 'SFUI-NOPE' (Dynamic Link)"],
    expect: "both 417 LinkValidationError 'Could not find …' (dynamic links are validated through their options field)",
    cite: ["model/document.py:969-982 _validate_links", "model/base_document.py:787 get_invalid_links"], evidence: "status, exc_type for each",
    async run(ctx) {
      const w = ctx.as("writer");
      const a = await savedocs(w, parentDoc(ctx.X, { title: `${ctx.tag} badlink`, contact: "SFUI-NOPE" }));
      ctx.check("invalid Link → 417 LinkValidationError", is(a, 417, "LinkValidationError"), "417 LinkValidationError", { status: a.status, exc_type: a.exc_type });
      const b = await savedocs(w, parentDoc(ctx.X, { title: `${ctx.tag} baddyn`, ref_type: "SFUI Test Contact", ref_name: "SFUI-NOPE" }));
      ctx.check("invalid Dynamic Link → 417 LinkValidationError", is(b, 417, "LinkValidationError"), "417 LinkValidationError", { status: b.status, exc_type: b.exc_type });
    } },
  { id: "F-LINK-2", area: "Form", feature: "Link search filtered by User Permissions", kind: "read", automated: "api", users: ["restricted", "manager"],
    rows: ["FV.D8", "FV.F8", "FV.F1", "LV.B10"],
    pre: "restricted has User Permissions on 2 SFUI Test Contacts (apply_to_all_doctypes)", steps: ["restricted: search_link doctype=SFUI Test Contact txt='SFUI Contact' reference_doctype=SFUI Test Parent", "manager: the same"],
    expect: "restricted gets exactly the 2 allowed contacts; manager gets a full page (search page length)",
    cite: ["desk/search.py:37-62 search_link → search_widget", "desk/search.py:194 frappe.get_list (user permissions applied)", "model/db_query.py:1065 add_user_permissions"], evidence: "returned values (names only) per account",
    async run(ctx) {
      const args = { doctype: "SFUI Test Contact", txt: "SFUI Contact", reference_doctype: "SFUI Test Parent", page_length: 50 };
      const r = await ctx.as("restricted").call("frappe.desk.search.search_link", args);
      const m = await ctx.as("manager").call("frappe.desk.search.search_link", args);
      const names = (x) => (x.message ?? []).map((o) => o.value).sort();
      ctx.check("restricted sees only the allowed contacts", J(names(r)) === J([...ctx.X.contacts.allowed].sort()), ctx.X.contacts.allowed, names(r));
      ctx.check("manager sees more than the restricted set", names(m).length > ctx.X.contacts.allowed.length, `> ${ctx.X.contacts.allowed.length}`, names(m).length);
    } },
  { id: "F-LINK-3", area: "Form", feature: "Link titles (show_title_field_in_link) from getdoc", kind: "read", automated: "api", users: ["manager"],
    rows: ["FV.F10"],
    pre: "seeded parent with a contact (SFUI Test Contact has show_title_field_in_link)", steps: ["manager: getdoc SFUI Test Parent <parent>"],
    expect: "the response carries `_link_titles` with key 'SFUI Test Contact::<contact>' = the contact's contact_name (getdoc also writes _seen / View Log — Frappe's own side effect)",
    cite: ["desk/form/load.py:60 set_link_titles", "desk/form/load.py:425-480 send_link_titles"], evidence: "keys of _link_titles",
    async run(ctx) {
      const p = ctx.X.names.parents[0];
      const r = await getdoc(ctx.as("manager"), "SFUI Test Parent", p);
      const c = r.body?.docs?.[0]?.contact;
      const t = r.body?._link_titles ?? {};
      ctx.check("_link_titles has the contact's title", !!c && typeof t[`SFUI Test Contact::${c}`] === "string", `SFUI Test Contact::${c}`, Object.keys(t));
    } },
  { id: "F-FETCH-1", area: "Form", feature: "fetch_from / fetch_if_empty on the server", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.E3", "FV.E7"],
    pre: "seeded contacts have email_id", steps: ["writer: save a Parent with contact = contact #12, contact_email empty, contact_name_if_empty = 'SFUI typed'"],
    expect: "saved contact_email = contact #12's email_id (re-fetched by the server); contact_name_if_empty keeps 'SFUI typed' (fetch_if_empty)",
    cite: ["model/base_document.py:787-880 get_invalid_links (fetch_from values set during link validation)", "model/base_document.py:824-825 fetch_if_empty"], evidence: "saved values",
    async run(ctx) {
      const r = await savedocs(ctx.as("writer"), parentDoc(ctx.X, { title: `${ctx.tag} fetch`, contact: RUN_CONTACT(ctx.X), contact_email: "", contact_name_if_empty: "SFUI typed" }));
      const d = docOf(r);
      ctx.check("contact_email fetched by the server", d?.contact_email === "sfui-contact-012@example.com", "sfui-contact-012@example.com", d?.contact_email);
      ctx.check("fetch_if_empty keeps the typed value", d?.contact_name_if_empty === "SFUI typed", "SFUI typed", d?.contact_name_if_empty);
    } },
  { id: "F-SAVE-1", area: "Form", feature: "save / update / concurrent edit", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.H1", "FV.H11", "FV.H13", "FV.E5", "FV.J1", "FV.J2"],
    pre: "seeded site", steps: ["writer: insert a Parent (savedocs Save)", "update its notes (Save) with the returned `modified`", "send another update with the OLD `modified`"],
    expect: "insert → 200, name SFUI-PAR-####, owner = writer, docstatus 0; update → 200; stale update → 417 TimestampMismatchError (Desk: 'Document has been modified after you have opened it')",
    cite: ["desk/form/save.py:16-45 savedocs", "model/document.py:850-874 check_if_latest"], evidence: "names, modified values, statuses",
    async run(ctx) {
      const d = await newParent(ctx, "writer", { title: "save" });
      if (!d) return;
      ctx.check("autoname + owner", /^SFUI-PAR-\d{4,}$/.test(d.name) && d.owner === ctx.X.accounts.writer && d.docstatus === 0, "SFUI-PAR-#### by writer", { name: d.name, docstatus: d.docstatus });
      const u = await savedocs(ctx.as("writer"), { ...d, notes: "SFUI update 1" });
      ctx.check("update → 200", is(u, 200), 200, u.status);
      const s = await savedocs(ctx.as("writer"), { ...d, notes: "SFUI stale" });
      ctx.check("stale modified → 417 TimestampMismatchError", is(s, 417, "TimestampMismatchError"), "417 TimestampMismatchError", { status: s.status, exc_type: s.exc_type });
    } },
  { id: "F-SAVE-2", area: "Security", feature: "Reader cannot save (server rejection)", kind: "reject", automated: "api", users: ["reader"],
    rows: ["FV.D3", "FV.D9", "FV.H8"],
    pre: "a seeded draft parent", steps: ["reader: getdoc it (allowed)", "reader: savedocs Save with a changed notes field — directly to the API, no UI"],
    expect: "403 PermissionError; the stored document is unchanged",
    cite: ["model/document.py:404 check_permission('write')", "model/document.py:225-258", "exceptions.py:34-35 (403)"], evidence: "status, exc_type, the doc's modified before / after",
    async run(ctx) {
      const p = ctx.X.parents.draft_owned_by_writer[0];
      const g = await getdoc(ctx.as("reader"), "SFUI Test Parent", p);
      const d = g.body?.docs?.[0];
      ctx.check("reader can read the draft", is(g, 200) && !!d, 200, g.status);
      if (!d) return;
      const r = await savedocs(ctx.as("reader"), { ...d, notes: `${ctx.tag} reader write` });
      ctx.check("reader save → 403 PermissionError", is(r, 403, "PermissionError"), "403 PermissionError", { status: r.status, exc_type: r.exc_type });
      const after = await getdoc(ctx.as("manager"), "SFUI Test Parent", p);
      ctx.check("document unchanged", after.body?.docs?.[0]?.modified === d.modified, d.modified, after.body?.docs?.[0]?.modified);
    } },
  { id: "F-SAVE-3", area: "Security", feature: "Reader cannot create", kind: "reject", automated: "api", users: ["reader"],
    rows: ["FV.D4", "FV.F6", "LV.G2"],
    pre: "seeded site", steps: ["reader: savedocs Save of a new Parent", "reader: frappe.client.insert of a new SFUI Test Contact"],
    expect: "both 403 PermissionError (create)", cite: ["model/document.py:300 check_permission('create')", "client.py:211 insert"], evidence: "statuses",
    async run(ctx) {
      const a = await savedocs(ctx.as("reader"), parentDoc(ctx.X, { title: `${ctx.tag} reader create` }));
      ctx.check("reader savedocs insert → 403", is(a, 403, "PermissionError"), "403 PermissionError", { status: a.status, exc_type: a.exc_type });
      const b = await ctx.as("reader").call("frappe.client.insert", { doc: J({ doctype: "SFUI Test Contact", contact_name: `${ctx.tag} reader contact` }) });
      ctx.check("reader client.insert → 403", is(b, 403, "PermissionError"), "403 PermissionError", { status: b.status, exc_type: b.exc_type });
    } },
  { id: "F-SUBMIT-1", area: "Form", feature: "submit", kind: "write", automated: "api", users: ["manager"],
    rows: ["FV.H3", "FV.J3", "FV.H7", "FV.H9", "FV.H12"],
    pre: "a fresh draft parent", steps: ["manager: savedocs Submit"],
    expect: "200, docstatus 1 (unless the DocType has queue_in_background — it does not)", cite: ["desk/form/save.py:28-37", "model/document.py:894-895"], evidence: "docstatus after",
    async run(ctx) {
      const d = await newParent(ctx, "manager", { title: "submit" });
      if (!d) return;
      const s = await savedocs(ctx.as("manager"), d, "Submit");
      ctx.check("submit → docstatus 1", is(s, 200) && docOf(s)?.docstatus === 1, 1, { status: s.status, docstatus: docOf(s)?.docstatus });
    } },
  { id: "F-SUBMIT-2", area: "Security", feature: "Writer cannot submit (server rejection)", kind: "reject", automated: "api", users: ["writer"],
    rows: ["FV.D5", "FV.H8"],
    pre: "a fresh draft parent owned by writer", steps: ["writer: savedocs Submit directly", "writer: frappe.client.submit directly"],
    expect: "403 PermissionError for both; docstatus stays 0", cite: ["model/document.py:894-895 check_permission('submit')", "client.py:261 submit"], evidence: "statuses, docstatus after",
    async run(ctx) {
      const d = await newParent(ctx, "writer", { title: "writer submit" });
      if (!d) return;
      const a = await savedocs(ctx.as("writer"), d, "Submit");
      ctx.check("writer savedocs Submit → 403", is(a, 403, "PermissionError"), "403 PermissionError", { status: a.status, exc_type: a.exc_type });
      const b = await ctx.as("writer").call("frappe.client.submit", { doc: J(d) });
      ctx.check("writer client.submit → 403", is(b, 403, "PermissionError"), "403 PermissionError", { status: b.status, exc_type: b.exc_type });
    } },
  { id: "F-AOS-1", area: "Form", feature: "allow_on_submit / update after submit", kind: "write", automated: "api", users: ["manager"],
    rows: ["FV.H4", "FV.N1", "FV.N2", "FV.N3"],
    pre: "a fresh submitted parent", steps: ["manager: savedocs Update changing allowed_after_submit (allow_on_submit)", "manager: savedocs Update changing title (not allow_on_submit)"],
    expect: "first 200; second 417 UpdateAfterSubmitError ('Not allowed to change Title after submission')",
    cite: ["model/document.py:905-906 (update_after_submit + submit permission)", "model/document.py:1150 _validate_update_after_submit"], evidence: "statuses",
    async run(ctx) {
      const d = await newParent(ctx, "manager", { title: "aos" });
      if (!d) return;
      const s = docOf(await savedocs(ctx.as("manager"), d, "Submit"));
      if (!s) return ctx.check("submitted", false, 1, null);
      const a = await savedocs(ctx.as("manager"), { ...s, allowed_after_submit: "SFUI after submit" }, "Update");
      ctx.check("allow_on_submit field → 200", is(a, 200), 200, { status: a.status, exc_type: a.exc_type });
      const s2 = docOf(a) ?? s;
      const b = await savedocs(ctx.as("manager"), { ...s2, title: `${ctx.tag} changed` }, "Update");
      ctx.check("non-allow_on_submit field → 417 UpdateAfterSubmitError", is(b, 417, "UpdateAfterSubmitError"), "417 UpdateAfterSubmitError", { status: b.status, exc_type: b.exc_type });
    } },
  { id: "F-CANCEL-1", area: "Form", feature: "cancel; cancelled is read-only", kind: "write", automated: "api", users: ["manager"],
    rows: ["FV.H5", "FV.J4", "FV.N4", "FV.N6"],
    pre: "a fresh submitted parent", steps: ["manager: frappe.desk.form.save.cancel", "manager: get_submitted_linked_docs on it (Cancel All discovery)", "manager: savedocs Save on the cancelled doc"],
    expect: "cancel → docstatus 2; linked submitted docs: none; saving a cancelled doc → 417 ValidationError 'Cannot edit cancelled document'",
    cite: ["desk/form/save.py:51-60 cancel", "model/document.py:908-909", "model/document.py:918", "desk/form/linked_with.py:17 get_submitted_linked_docs"], evidence: "docstatus, statuses",
    async run(ctx) {
      const m = ctx.as("manager");
      const d = await newParent(ctx, "manager", { title: "cancel" });
      if (!d) return;
      const s = docOf(await savedocs(m, d, "Submit"));
      if (!s) return ctx.check("submitted", false, 1, null);
      const c = await m.call("frappe.desk.form.save.cancel", { doctype: "SFUI Test Parent", name: s.name });
      ctx.check("cancel → 200", is(c, 200), 200, { status: c.status, exc_type: c.exc_type });
      const l = await m.call("frappe.desk.form.linked_with.get_submitted_linked_docs", { doctype: "SFUI Test Parent", name: s.name });
      ctx.check("no linked submitted docs", is(l, 200), 200, l.status);
      const g = docOf(await getdoc(m, "SFUI Test Parent", s.name));
      ctx.check("docstatus 2", g?.docstatus === 2, 2, g?.docstatus);
      if (!g) return;
      const e = await savedocs(m, { ...g, notes: "SFUI edit cancelled", docstatus: 2 }, "Save");
      ctx.check("editing a cancelled doc is refused (417)", e.status === 417, 417, { status: e.status, exc_type: e.exc_type });
    } },
  { id: "F-CANCEL-2", area: "Security", feature: "Writer cannot cancel", kind: "reject", automated: "api", users: ["writer"],
    rows: ["FV.D6"],
    pre: "a seeded submitted parent", steps: ["writer: frappe.desk.form.save.cancel directly", "writer: frappe.client.cancel directly"],
    expect: "403 PermissionError; docstatus stays 1", cite: ["model/document.py:908-909 check_permission('cancel')", "client.py:275"], evidence: "statuses, docstatus after",
    async run(ctx) {
      const p = ctx.X.parents.submitted[0];
      const a = await ctx.as("writer").call("frappe.desk.form.save.cancel", { doctype: "SFUI Test Parent", name: p });
      ctx.check("writer cancel → 403", is(a, 403, "PermissionError"), "403 PermissionError", { status: a.status, exc_type: a.exc_type });
      const b = await ctx.as("writer").call("frappe.client.cancel", { doctype: "SFUI Test Parent", name: p });
      ctx.check("writer client.cancel → 403", is(b, 403, "PermissionError"), "403 PermissionError", { status: b.status, exc_type: b.exc_type });
    } },
  { id: "F-AMEND-1", area: "Form", feature: "amend (naming -1, -2)", kind: "write", automated: "api", users: ["manager"],
    rows: ["FV.H6", "FV.N5"],
    pre: "a fresh cancelled parent", steps: ["manager: savedocs Save of a copy with amended_from = <name>", "manager: frappe.client.is_document_amended", "cancel + amend the amendment"],
    expect: "the amendment is named <name>-1, then <name>-2; is_document_amended → the amendment's name (frappe.db.exists, client.py:425-430); amending a doc that is not cancelled → 417 'cannot be amended because it is not cancelled'",
    cite: ["model/naming.py:526-541 _set_amended_name", "model/document.py:439-444 validate_amended_from", "client.py:425 is_document_amended"], evidence: "names",
    async run(ctx) {
      const m = ctx.as("manager");
      const d = await newParent(ctx, "manager", { title: "amend" });
      if (!d) return;
      const s = docOf(await savedocs(m, d, "Submit"));
      if (!s) return ctx.check("submitted", false, 1, null);
      const early = await savedocs(m, parentDoc(ctx.X, { title: `${ctx.tag} amend early`, amended_from: s.name }));
      ctx.check("amending a submitted (not cancelled) doc → 417", early.status === 417, 417, { status: early.status, exc_type: early.exc_type });
      await m.call("frappe.desk.form.save.cancel", { doctype: "SFUI Test Parent", name: s.name });
      const a = await savedocs(m, parentDoc(ctx.X, { title: `${ctx.tag} amend`, amended_from: s.name }));
      ctx.check("amendment named <name>-1", docOf(a)?.name === `${s.name}-1`, `${s.name}-1`, docOf(a)?.name);
      const q = await m.call("frappe.client.is_document_amended", { doctype: "SFUI Test Parent", docname: s.name });
      ctx.check("is_document_amended → the amendment's name", q.message === `${s.name}-1`, `${s.name}-1`, q.message);
    } },
  { id: "F-AMEND-2", area: "Security", feature: "amend without the amend right", kind: "reject", automated: "api", users: ["writer"],
    rows: ["FV.D7"],
    pre: "a cancelled parent (created by manager in this test)", steps: ["writer (create, no amend): savedocs Save of a copy with amended_from = <cancelled name>"],
    expect: "RECORD what Frappe does: the server checks `create` for the insert and that amended_from is cancelled (document.py:300, 439-444); 15.110 has no server-side `amend` check on this path, so 200 is the expected Frappe behaviour — the 'amend needs amend + create' rule (C-native F8) is client-side gating only",
    cite: ["model/document.py:300", "model/document.py:439-444", "permissions.py:20 (amend is a ptype; not checked by insert)"], evidence: "status, name",
    async run(ctx) {
      const m = ctx.as("manager");
      const d = await newParent(ctx, "manager", { title: "amend2" });
      if (!d) return;
      const s = docOf(await savedocs(m, d, "Submit"));
      if (!s) return;
      await m.call("frappe.desk.form.save.cancel", { doctype: "SFUI Test Parent", name: s.name });
      const a = await savedocs(ctx.as("writer"), parentDoc(ctx.X, { title: `${ctx.tag} writer amend`, amended_from: s.name }));
      ctx.check("Frappe 15.110: writer's amendment insert is accepted (server checks create only)", is(a, 200), "200 (documented: client-side gate only)", { status: a.status, exc_type: a.exc_type, name: docOf(a)?.name });
    } },
  { id: "F-PERMLEVEL-1", area: "Security", feature: "field-level read (permlevel 1)", kind: "read", automated: "api", users: ["writer", "field", "manager"],
    rows: ["FV.D1", "FV.D11", "FV.D2"],
    pre: "seeded parents carry level1_field", steps: ["writer, field, manager: getdoc the same parent"],
    expect: "writer: level1_field absent / null (stripped); field and manager: the seeded value",
    cite: ["desk/form/load.py:53 apply_fieldlevel_read_permissions", "model/document.py:754 apply_fieldlevel_read_permissions"], evidence: "level1_field per account (value redacted to present / absent)",
    async run(ctx) {
      const p = ctx.X.parents.draft_owned_by_writer[0];
      const v = async (who) => (await getdoc(ctx.as(who), "SFUI Test Parent", p)).body?.docs?.[0]?.level1_field ?? null;
      const [w, f, m] = [await v("writer"), await v("field"), await v("manager")];
      ctx.check("writer does not receive the permlevel-1 value", w === null || w === undefined || w === "", "absent", w ? "present" : "absent");
      ctx.check("field and manager receive it", f === ctx.X.level1_value && m === ctx.X.level1_value, "present", { field: f ? "present" : "absent", manager: m ? "present" : "absent" });
    } },
  { id: "F-PERMLEVEL-2", area: "Security", feature: "field-level write (permlevel 1 read-only)", kind: "reject", automated: "api", users: ["field"],
    rows: ["FV.D1", "FV.D9"],
    pre: "a draft parent the field account can write at level 0", steps: ["field: getdoc", "field: savedocs Save with level1_field changed"],
    expect: "200 — NOT an error: Frappe silently resets fields of a permlevel the user cannot write to the stored value; level1_field keeps the seeded value",
    cite: ["model/document.py:783-806 validate_higher_perm_levels → reset_values_if_no_permlevel_access"], evidence: "status, stored level1_field after (present / changed)",
    async run(ctx) {
      const p = ctx.X.parents.draft_owned_by_writer[1] ?? ctx.X.parents.draft_owned_by_writer[0];
      const d = (await getdoc(ctx.as("field"), "SFUI Test Parent", p)).body?.docs?.[0];
      if (!d) return ctx.check("field reads the parent", false, "doc", null);
      const r = await savedocs(ctx.as("field"), { ...d, level1_field: `${ctx.tag} overwrite` });
      ctx.check("save returns 200", is(r, 200), 200, { status: r.status, exc_type: r.exc_type });
      const after = (await getdoc(ctx.as("manager"), "SFUI Test Parent", p)).body?.docs?.[0]?.level1_field;
      ctx.check("permlevel-1 value unchanged (reset by the server)", after === ctx.X.level1_value, "unchanged", after === ctx.X.level1_value ? "unchanged" : "CHANGED");
    } },
  { id: "F-WF-1", area: "Form", feature: "workflow transitions by role", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.I1", "FV.I3", "FV.I4", "FV.I8", "FV.J5", "FV.I5"],
    pre: "a fresh workflow doc in SFUI Draft owned by writer", steps: ["writer: frappe.model.workflow.get_transitions", "writer: apply_workflow 'SFUI Request Approval'"],
    expect: "transitions = ['SFUI Request Approval'] only (role SFUI Writer); apply → workflow_state 'SFUI Pending', docstatus 0, and a 'Workflow' comment on the doc",
    cite: ["model/workflow.py:39-90 get_transitions (roles at :64-67)", "model/workflow.py:99-148 apply_workflow (comment :148)"], evidence: "transition actions, state after",
    async run(ctx) {
      const w = ctx.as("writer");
      const c = docOf(await savedocs(w, { doctype: "SFUI Test Workflow", name: "new-sfui-test-workflow-2", __islocal: 1, subject: `${ctx.tag} wf1`, amount: 100, workflow_state: "SFUI Draft" }));
      if (!c) return ctx.check("workflow doc created", false, "doc", null);
      const t = await w.call("frappe.model.workflow.get_transitions", { doc: J(c) });
      ctx.check("writer's transitions", J((t.message ?? []).map((x) => x.action)) === J(["SFUI Request Approval"]), ["SFUI Request Approval"], (t.message ?? []).map((x) => x.action));
      const a = await w.call("frappe.model.workflow.apply_workflow", { doc: J(c), action: "SFUI Request Approval" });
      ctx.check("state → SFUI Pending", a.message?.workflow_state === "SFUI Pending" && a.message?.docstatus === 0, "SFUI Pending / 0", { state: a.message?.workflow_state, docstatus: a.message?.docstatus });
    } },
  { id: "F-WF-2", area: "Form", feature: "workflow conditions + approve (doc_status 1)", kind: "write", automated: "api", users: ["writer", "manager"],
    rows: ["FV.I2", "FV.I7", "FV.I9"],
    pre: "a fresh workflow doc (amount 200) moved to SFUI Pending by writer", steps: ["manager: get_transitions", "manager: apply_workflow 'SFUI Approve'"],
    expect: "manager sees 'SFUI Approve' and 'SFUI Reject' but not 'SFUI Approve Large' (condition doc.amount >= 1000 false); approving → 'SFUI Approved' with docstatus 1 (state doc_status 1 submits)",
    cite: ["model/workflow.py:91-97 is_transition_condition_satisfied", "model/workflow.py:126-147 (docstatus of the next state)"], evidence: "actions, state, docstatus",
    async run(ctx) {
      const w = ctx.as("writer"), m = ctx.as("manager");
      const c = docOf(await savedocs(w, { doctype: "SFUI Test Workflow", name: "new-sfui-test-workflow-3", __islocal: 1, subject: `${ctx.tag} wf2`, amount: 200, workflow_state: "SFUI Draft" }));
      if (!c) return;
      const p = (await w.call("frappe.model.workflow.apply_workflow", { doc: J(c), action: "SFUI Request Approval" })).message;
      if (!p) return ctx.check("pending", false, "SFUI Pending", null);
      const t = ((await m.call("frappe.model.workflow.get_transitions", { doc: J(p) })).message ?? []).map((x) => x.action).sort();
      ctx.check("condition hides Approve Large", J(t) === J(["SFUI Approve", "SFUI Reject"]), ["SFUI Approve", "SFUI Reject"], t);
      const a = await m.call("frappe.model.workflow.apply_workflow", { doc: J(p), action: "SFUI Approve" });
      ctx.check("approved and submitted", a.message?.workflow_state === "SFUI Approved" && a.message?.docstatus === 1, "SFUI Approved / 1", { state: a.message?.workflow_state, docstatus: a.message?.docstatus });
    } },
  { id: "F-WF-3", area: "Security", feature: "workflow self-approval refused", kind: "reject", automated: "api", users: ["manager"],
    rows: ["FV.I2", "FV.I3", "FV.I9"],
    pre: "seeded site (no account holds both SFUI Writer and SFUI Manager, so the doc is created by manager and moved to SFUI Pending by writer)",
    steps: ["manager: create a workflow doc (owner = manager, amount 50)", "writer: apply 'SFUI Request Approval' (writer may: role SFUI Writer, allow_self_approval 1)", "manager (the owner): apply 'SFUI Approve' directly"],
    expect: "417 ValidationError 'Self approval is not allowed' (allow_self_approval 0 and user == owner)",
    cite: ["model/workflow.py:116-117", "model/workflow.py:221-222 has_approval_access"], evidence: "status, exc_type, state unchanged",
    async run(ctx) {
      const w = ctx.as("writer"), m = ctx.as("manager");
      const c = docOf(await savedocs(m, { doctype: "SFUI Test Workflow", name: "new-sfui-test-workflow-4", __islocal: 1, subject: `${ctx.tag} self`, amount: 50, workflow_state: "SFUI Draft" }));
      if (!c) return;
      const p = (await w.call("frappe.model.workflow.apply_workflow", { doc: J(c), action: "SFUI Request Approval" })).message;
      if (!p) return ctx.check("pending", false, "SFUI Pending", null);
      const a = await m.call("frappe.model.workflow.apply_workflow", { doc: J(p), action: "SFUI Approve" });
      ctx.check("owner approving own doc → 417 Self approval is not allowed", a.status === 417, "417", { status: a.status, exc_type: a.exc_type });
    } },
  { id: "F-WF-4", area: "Security", feature: "workflow action not allowed for the role", kind: "reject", automated: "api", users: ["writer"],
    rows: ["FV.I3", "FV.I7"],
    pre: "a workflow doc in SFUI Pending", steps: ["writer: apply_workflow 'SFUI Approve' directly"],
    expect: "417 WorkflowTransitionError 'Not a valid Workflow Action'", cite: ["model/workflow.py:107-114"], evidence: "status, exc_type",
    async run(ctx) {
      const w = ctx.as("writer");
      const c = docOf(await savedocs(w, { doctype: "SFUI Test Workflow", name: "new-sfui-test-workflow-5", __islocal: 1, subject: `${ctx.tag} wf4`, amount: 100, workflow_state: "SFUI Draft" }));
      if (!c) return;
      const p = (await w.call("frappe.model.workflow.apply_workflow", { doc: J(c), action: "SFUI Request Approval" })).message;
      if (!p) return;
      const a = await w.call("frappe.model.workflow.apply_workflow", { doc: J(p), action: "SFUI Approve" });
      ctx.check("writer approve → 417 WorkflowTransitionError", is(a, 417, "WorkflowTransitionError"), "417 WorkflowTransitionError", { status: a.status, exc_type: a.exc_type });
    } },
  { id: "F-WF-5", area: "Security", feature: "workflow allow_edit (state-based edit right)", kind: "reject", automated: "api", users: ["writer"],
    rows: ["FV.D10"],
    pre: "a workflow doc in SFUI Pending (allow_edit = SFUI Manager)", steps: ["writer: savedocs Save with a changed approval_notes"],
    expect: "417 WorkflowPermissionError — the state's allow_edit role is required to save",
    cite: ["model/workflow.py:166-210 validate_workflow (WorkflowPermissionError :203-205)", "model/document.py:687 validate_workflow"], evidence: "status, exc_type",
    async run(ctx) {
      const w = ctx.as("writer");
      const c = docOf(await savedocs(w, { doctype: "SFUI Test Workflow", name: "new-sfui-test-workflow-6", __islocal: 1, subject: `${ctx.tag} wf5`, amount: 100, workflow_state: "SFUI Draft" }));
      if (!c) return;
      const p = (await w.call("frappe.model.workflow.apply_workflow", { doc: J(c), action: "SFUI Request Approval" })).message;
      if (!p) return;
      const s = await savedocs(w, { ...p, approval_notes: `${ctx.tag} edit while pending` });
      ctx.check("writer edit in SFUI Pending → 417", s.status === 417, "417 WorkflowPermissionError", { status: s.status, exc_type: s.exc_type });
    } },
  { id: "F-DIRTY-1", area: "Form", feature: "dirty state, undo / redo, Ctrl+S, unsaved guard", kind: "browser", automated: "browser", users: ["writer"],
    rows: ["FV.E6", "FV.G11", "FV.H13", "FV.H14", "FV.K14", "FV.J11", "FV.H10"],
    pre: "a draft parent owned by writer", steps: ["type in Notes → 'Not Saved' indicator", "Ctrl/⌘+Z → value restored, Ctrl/⌘+Shift+Z → re-applied", "Ctrl/⌘+S → one savedocs request, indicator cleared", "edit again and navigate → the unsaved-changes guard asks"],
    expect: "Desk-like client behaviour; exactly one savedocs per Ctrl+S (no duplicate submit)", cite: ["public/js/frappe/form/form.js (Desk) — client-only"], evidence: "screenshots + the list of POSTs (method names only)" },
  { id: "F-QE-1", area: "Form", feature: "Quick Entry (create from list / link)", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.F6", "LV.G1", "LV.G3", "LV.G5", "LV.G8"],
    pre: "SFUI Test Contact has quick_entry = 1", steps: ["writer: savedocs Save of a new SFUI Test Contact with only contact_name (what the dialog sends)", "browser (optional): list '+ Add SFUI Test Contact' → dialog → Save → list reloads with the new row"],
    expect: "200, autoname SFUI-CON-####, default status 'Active' applied by the server", cite: ["desk/form/save.py:16-45", "model/document.py:833 _set_defaults"], evidence: "name, status",
    async run(ctx) {
      const r = await savedocs(ctx.as("writer"), { doctype: "SFUI Test Contact", name: "new-sfui-test-contact-1", __islocal: 1, contact_name: `${ctx.tag} QE` });
      ctx.check("quick-entry insert", is(r, 200) && /^SFUI-CON-\d{4,}$/.test(docOf(r)?.name ?? "") && docOf(r)?.status === "Active", "SFUI-CON-#### Active", { status: r.status, name: docOf(r)?.name, st: docOf(r)?.status });
    } },
  { id: "F-ATT-1", area: "Form", feature: "attachments: upload, max_attachments, rejection", kind: "write", automated: "api", users: ["writer", "reader"],
    rows: ["FV.A20", "FV.A21", "FV.G10"],
    pre: "SFUI Test Attachments (max_attachments 3); the test creates its own probe document as writer", steps: ["writer: create an SFUI Test Attachments doc", "writer: upload_file ×3 (tiny synthetic text files, is_private 1) attached to the probe", "writer: a 4th upload", "reader: one upload"],
    expect: "3 × 200 with File docs; the 4th → 417 'Maximum Attachment Limit of 3 has been reached'; reader → 403 (write on the target required)",
    cite: ["handler.py:175-271 upload_file (write check :271)", "core/doctype/file/file.py:333-350 validate_attachment_limit"], evidence: "statuses, File names",
    async run(ctx) {
      const c = await savedocs(ctx.as("writer"), { doctype: "SFUI Test Attachments", name: "new-sfui-test-attachments-1", __islocal: 1, title: `${ctx.tag} attach` });
      const name = docOf(c)?.name;
      ctx.check("writer creates the probe", is(c, 200) && !!name, 200, c.status);
      if (!name) return;
      const up = (who, i) => ctx.as(who).upload({ doctype: "SFUI Test Attachments", docname: name, is_private: "1", filename: `sfui-p36-${i}.txt`, content: `SFUI P36 synthetic ${i}` });
      const ok = [];
      for (let i = 1; i <= 3; i++) ok.push(await up("writer", i));
      ctx.check("3 uploads accepted", ok.every((r) => r.status === 200), [200, 200, 200], ok.map((r) => r.status));
      const fourth = await up("writer", 4);
      ctx.check("4th upload → 417 attachment limit", fourth.status === 417, 417, { status: fourth.status, exc_type: fourth.exc_type });
      const rd = await up("reader", 5);
      ctx.check("reader upload → 403", rd.status === 403, 403, { status: rd.status, exc_type: rd.exc_type });
    } },
  { id: "F-PRINT-1", area: "Form", feature: "print preview (server HTML), format list", kind: "read", automated: "api", users: ["reader", "manager"],
    rows: ["FV.L1", "FV.L2", "FV.L5", "FV.L6", "FV.K4"],
    pre: "seeded print format 'SFUI P36 Print' (Jinja) for SFUI Test Parent", steps: ["manager: getdoctype SFUI Test Parent → __print_formats", "reader (print right): get_html_and_style for a SUBMITTED parent with print_format 'SFUI P36 Print'"],
    expect: "the format list contains 'SFUI P36 Print'; the HTML contains SFUI-P36-PRINT-MARKER and the doc's status; printing a draft follows Print Settings (allow_print_for_draft) — 403 'Not allowed to print draft documents' when off",
    cite: ["www/printview.py:305 get_html_and_style", "www/printview.py:113-142 get_rendered_template (draft / cancelled rules)", "www/printview.py:367 validate_print_permission"], evidence: "format names, HTML length + marker present (HTML not stored)",
    async run(ctx) {
      const meta = await ctx.as("manager").call("frappe.desk.form.load.getdoctype", { doctype: "SFUI Test Parent" }, "GET");
      const pfs = (meta.body?.docs ?? []).flatMap((d) => (d.__print_formats ?? []).map((p) => p.name));
      ctx.check("format list includes SFUI P36 Print", pfs.includes(ctx.X.names.print_format), ctx.X.names.print_format, pfs);
      const r = await ctx.as("reader").call("frappe.www.printview.get_html_and_style", { doc: "SFUI Test Parent", name: ctx.X.parents.submitted[0], print_format: ctx.X.names.print_format, no_letterhead: 1 });
      const html = r.message?.html ?? "";
      ctx.check("server-rendered HTML carries the marker", is(r, 200) && html.includes(ctx.X.print_marker), "marker present", { status: r.status, length: html.length, marker: html.includes(ctx.X.print_marker) });
    } },
  { id: "F-PRINT-2", area: "Form", feature: "letter head + real print format (BLOCKED row FV.L7)", kind: "read", automated: "api", users: ["manager"],
    rows: ["FV.L7"],
    pre: "seeded Letter Head 'SFUI P36 Letter Head'", steps: ["manager: get_html_and_style with letterhead = 'SFUI P36 Letter Head', no_letterhead 0"],
    expect: "HTML contains SFUI-P36-LETTERHEAD and SFUI-P36-PRINT-MARKER", cite: ["www/printview.py:305-366"], evidence: "markers present",
    async run(ctx) {
      const r = await ctx.as("manager").call("frappe.www.printview.get_html_and_style", { doc: "SFUI Test Parent", name: ctx.X.parents.submitted[0], print_format: ctx.X.names.print_format, letterhead: ctx.X.names.letter_head, no_letterhead: 0 });
      const html = r.message?.html ?? "";
      ctx.check("letter head + format rendered", html.includes(ctx.X.letterhead_marker) && html.includes(ctx.X.print_marker), "both markers", { letterhead: html.includes(ctx.X.letterhead_marker), format: html.includes(ctx.X.print_marker) });
    } },
  { id: "F-PDF-1", area: "Form", feature: "PDF download", kind: "infra", automated: "manual", infra: "the staging site's PDF engine (wkhtmltopdf 0.12.x patched Qt, or the configured pdf_generator)", users: ["reader"],
    rows: ["FV.L3", "LV.F7"],
    pre: "PDF engine installed on staging", steps: ["reader: GET /api/method/frappe.utils.print_format.download_pdf?doctype=SFUI Test Parent&name=<submitted>&format=SFUI P36 Print", "manager: download_multi_pdf for 2 submitted parents"],
    expect: "200 application/pdf, %PDF header; multi-PDF 200 (or task id for the async variant)", cite: ["utils/print_format.py:236-247 download_pdf", "utils/print_format.py:28-60 download_multi_pdf(_async)"], evidence: "content-type, byte length, first 4 bytes" },
  { id: "F-CONN-1", area: "Form", feature: "connections: counts + permission", kind: "read", automated: "api", users: ["manager", "restricted"],
    rows: ["FV.M2", "FV.M3", "FV.M4", "FV.M5", "FV.M6", "FV.K12"],
    pre: "SFUI Test Contact has a DocType link (SFUI Test Parent.contact, group SFUI)", steps: ["manager: getdoctype SFUI Test Contact → __dashboard", "manager: get_open_count(SFUI Test Contact, contact #1)", "restricted: the same for contact #5 (not allowed)"],
    expect: "the dashboard lists SFUI Test Parent; manager's count = number of parents linking contact #1; restricted on a disallowed contact → 403 (the reference document must be readable)",
    cite: ["model/meta.py:652-700 get_dashboard_data / add_doctype_links", "desk/notifications.py:246-262 (1 s timeout)", "desk/notifications.py:267-269 (doc.check_permission on the reference)", "desk/notifications.py:361 (counts via frappe.get_all)"], evidence: "count, statuses",
    async run(ctx) {
      const c1 = ctx.X.names.contacts[0];
      const r = await ctx.as("manager").call("frappe.desk.notifications.get_open_count", { doctype: "SFUI Test Contact", name: c1 });
      const count = (r.message?.count?.external_links_found ?? []).find((x) => x.doctype === "SFUI Test Parent")?.count;
      ctx.check("manager's count = parents linking contact #1", count === ctx.X.contacts.linked_by_parents[c1], ctx.X.contacts.linked_by_parents[c1], count ?? r.message);
      const hidden = ctx.X.names.contacts[4];
      const q = await ctx.as("restricted").call("frappe.desk.notifications.get_open_count", { doctype: "SFUI Test Contact", name: hidden });
      ctx.check("restricted on a disallowed contact → 403 (or empty)", q.status === 403, 403, { status: q.status, exc_type: q.exc_type });
    } },
  { id: "F-MENU-1", area: "Form", feature: "rename", kind: "write", automated: "api", users: ["reader", "writer"],
    rows: ["FV.K8"],
    pre: "a fresh draft parent (allow_rename = 1)", steps: ["reader: frappe.model.rename_doc.update_document_title(name = <new>)", "writer: the same"],
    expect: "Frappe has no separate rename right: the server checks `write` on the document and the DocType's allow_rename — reader → 403 PermissionError; writer → 200 returning the new name (links follow)",
    cite: ["model/rename_doc.py:22-91 update_document_title (check_permission write :59)", "model/rename_doc.py:349-382 validate_rename (allow_rename, write :382)"], evidence: "statuses, new name",
    async run(ctx) {
      const d = await newParent(ctx, "writer", { title: "rename" });
      if (!d) return;
      const target = `${d.name}-SFUI-RN`;
      const r = await ctx.as("reader").call("frappe.model.rename_doc.update_document_title", { doctype: "SFUI Test Parent", docname: d.name, name: target });
      ctx.check("reader rename → 403", is(r, 403, "PermissionError"), 403, { status: r.status, exc_type: r.exc_type });
      const w = await ctx.as("writer").call("frappe.model.rename_doc.update_document_title", { doctype: "SFUI Test Parent", docname: d.name, name: target });
      ctx.check("writer rename → new name", is(w, 200) && w.message === target, target, { status: w.status, message: w.message });
    } },
  { id: "F-MENU-2", area: "Security", feature: "delete: rights, submitted, linked", kind: "reject", automated: "api", users: ["writer", "manager"],
    rows: ["FV.K9", "LV.F10"],
    pre: "a fresh draft parent; seeded submitted parent; contact #4 linked by parents", steps: ["writer: frappe.client.delete the draft", "manager: frappe.client.delete a submitted parent", "manager: frappe.client.delete contact #4", "manager: frappe.client.delete the draft"],
    expect: "writer → 403; submitted → 417 'Submitted Record cannot be deleted'; linked contact → 417 LinkExistsError; manager on the draft → 200",
    cite: ["model/delete_doc.py:240 check_permission_and_not_submitted", "model/delete_doc.py:334-444 check_if_doc_is_linked (LinkExistsError)", "client.py:287"], evidence: "statuses, exc_types",
    async run(ctx) {
      const d = await newParent(ctx, "manager", { title: "delete" });
      const w = await ctx.as("writer").call("frappe.client.delete", { doctype: "SFUI Test Parent", name: d?.name });
      ctx.check("writer delete → 403", is(w, 403, "PermissionError"), "403", { status: w.status, exc_type: w.exc_type });
      const s = await ctx.as("manager").call("frappe.client.delete", { doctype: "SFUI Test Parent", name: ctx.X.parents.submitted[0] });
      ctx.check("delete submitted → 417", s.status === 417, 417, { status: s.status, exc_type: s.exc_type });
      const l = await ctx.as("manager").call("frappe.client.delete", { doctype: "SFUI Test Contact", name: ctx.X.names.contacts[3] });
      ctx.check("delete linked contact → 417 LinkExistsError", is(l, 417, "LinkExistsError"), "417 LinkExistsError", { status: l.status, exc_type: l.exc_type });
      const m = await ctx.as("manager").call("frappe.client.delete", { doctype: "SFUI Test Parent", name: d?.name });
      ctx.check("manager deletes the draft", is(m, 200), 200, m.status);
    } },
  { id: "F-MENU-3", area: "Form", feature: "duplicate (copy insert)", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.K6", "FV.K15"],
    pre: "a fresh draft parent with 2 child rows", steps: ["writer: savedocs Save of a local copy (new name, __islocal, child rows without names, amended_from cleared)"],
    expect: "200 with a new SFUI-PAR-#### name; child rows copied with new names; no_copy fields (amended_from) empty", cite: ["model/document.py:261 insert", "model/naming.py:196 set_name_from_naming_options"], evidence: "names",
    async run(ctx) {
      const d = await newParent(ctx, "writer", { title: "dup", items: [childRow(1), childRow(2)] });
      if (!d) return;
      const copy = { ...d, name: "new-sfui-test-parent-copy", __islocal: 1, amended_from: null, items: (d.items ?? []).map((r, i) => ({ ...r, name: `new-sfui-test-child-c${i}`, parent: undefined, __islocal: 1 })) };
      const r = await savedocs(ctx.as("writer"), copy);
      ctx.check("copy inserted with a new name", is(r, 200) && docOf(r)?.name !== d.name && docOf(r)?.items?.length === 2, "new name, 2 rows", { status: r.status, name: docOf(r)?.name });
    } },
  { id: "F-MENU-4", area: "Form", feature: "Remind Me", kind: "write", automated: "api", users: ["writer"],
    rows: ["FV.K13"],
    pre: "seeded site", steps: ["writer: frappe.automation.doctype.reminder.reminder.create_new_reminder (remind_at = now + 2 days)", "writer: the same with a past remind_at"],
    expect: "Reminder created for the writer; past time → 417 'Reminder cannot be created in past'", cite: ["automation/doctype/reminder/reminder.py:36-40 validate", "automation/doctype/reminder/reminder.py:60-73"], evidence: "statuses",
    async run(ctx) {
      const at = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 19).replace("T", " ");
      const ok = await ctx.as("writer").call("frappe.automation.doctype.reminder.reminder.create_new_reminder", { remind_at: at(2), description: `${ctx.tag} reminder`, reminder_doctype: "SFUI Test Parent", reminder_docname: ctx.X.parents.draft_owned_by_writer[0] });
      ctx.check("future reminder → 200", is(ok, 200), 200, ok.status);
      const past = await ctx.as("writer").call("frappe.automation.doctype.reminder.reminder.create_new_reminder", { remind_at: at(-2), description: `${ctx.tag} past`, reminder_doctype: "SFUI Test Parent", reminder_docname: ctx.X.parents.draft_owned_by_writer[0] });
      ctx.check("past reminder → 417", past.status === 417, 417, { status: past.status, exc_type: past.exc_type });
    } },
  { id: "F-EMAIL-1", area: "Form", feature: "e-mail template rendering", kind: "read", automated: "api", users: ["manager"],
    rows: ["FV.O3"],
    pre: "seeded Email Template 'SFUI P36 Template'", steps: ["manager: frappe.email.doctype.email_template.email_template.get_email_template(template_name, doc=<parent as JSON>)"],
    expect: "subject 'SFUI about <title>', message containing SFUI-P36-TEMPLATE and the doc's status (server Jinja)", cite: ["email/doctype/email_template/email_template.py:30-60"], evidence: "subject, marker present",
    async run(ctx) {
      const d = (await getdoc(ctx.as("manager"), "SFUI Test Parent", ctx.X.names.parents[0])).body?.docs?.[0];
      const r = await ctx.as("manager").call("frappe.email.doctype.email_template.email_template.get_email_template", { template_name: ctx.X.names.email_template, doc: J(d ?? {}) });
      ctx.check("rendered with the document", (r.message?.subject ?? "").includes(d?.title ?? "#") && (r.message?.message ?? "").includes(ctx.X.template_marker), "subject + marker", { subject: r.message?.subject, marker: (r.message?.message ?? "").includes(ctx.X.template_marker) });
    } },
  { id: "F-EMAIL-2", area: "Form", feature: "send e-mail (communication.email.make)", kind: "infra", automated: "manual", infra: "an outgoing Email Account on staging that delivers only to a capture mailbox (e.g. MailHog) — never to real recipients", users: ["writer"],
    rows: ["FV.O8"],
    pre: "Email Account configured as above", steps: ["writer: frappe.core.doctype.communication.email.make(doctype, name, recipients='sfui-capture@example.com', subject, content, send_email=1)", "check the capture mailbox"],
    expect: "Communication linked to the parent, an Email Queue row, the mail in the capture box; without an outgoing account the server says so (email.py:182)", cite: ["core/doctype/communication/email.py:28-84, 182, 225-237"], evidence: "Communication name, queue status, capture screenshot" },
  { id: "F-EMAIL-3", area: "Security", feature: "e-mail without the email right", kind: "reject", automated: "api", users: ["reader"],
    rows: ["FV.O9"],
    pre: "reader has no `email` right on SFUI Test Parent", steps: ["reader: communication.email.make for a parent (send_email=0)"],
    expect: "403 PermissionError before any Communication is created", cite: ["core/doctype/communication/email.py:84 has_permission(ptype='email', throw=True)"], evidence: "status",
    async run(ctx) {
      const r = await ctx.as("reader").call("frappe.core.doctype.communication.email.make", { doctype: "SFUI Test Parent", name: ctx.X.names.parents[0], recipients: "sfui-capture@example.com", subject: `${ctx.tag} reader mail`, content: "SFUI", send_email: 0 });
      ctx.check("reader email.make → 403", is(r, 403, "PermissionError"), "403", { status: r.status, exc_type: r.exc_type });
    } },
  { id: "F-WEB-1", area: "Form", feature: "See on Website / route", kind: "infra", automated: "manual", infra: "a website-generator DocType (has_web_view, is_published_field, route) — the SFUI DocTypes are not; use the owner's project DocType on staging", users: ["manager"],
    rows: ["FV.P3"],
    pre: "a published document of a website-generator DocType", steps: ["getdoc → __onload.is_website_generator / published, route", "open /<route> anonymously"],
    expect: "the package's link = /<route>; the page answers 200 when published, 404 when not", cite: ["desk/form/load.py:366 run_onload", "website/website_generator.py"], evidence: "URL, statuses" },

  // ---------------------------------------------------------------- LIST ------------------------------------------
  { id: "L-FETCH-1", area: "List", feature: "fetch, pagination, sort, filters, counts", kind: "read", automated: "api", users: ["manager"],
    rows: ["LV.A1", "LV.B1", "LV.B2", "LV.B4", "LV.B5", "LV.B12", "LV.C1", "LV.C3", "LV.C4", "LV.I1", "LV.I3", "LV.I7"],
    pre: "24 seeded parents", steps: ["manager: reportview.get_count (no filter, status = Open, status = Open OR status = Closed)", "manager: frappe.client.get_list page 1 (20) and page 2, order_by 'modified desc'"],
    expect: "counts = expected.json (computed in Python by the seed); page 1 has 20 rows, page 2 the rest; no name repeats across pages",
    cite: ["desk/reportview.py:55-75 get_count", "client.py:28-80 get_list", "model/db_query.py:99 execute"], evidence: "counts, row names per page",
    async run(ctx) {
      const m = ctx.as("manager"), P = ctx.X.parents;
      const cnt = async (filters, or) => (await m.call("frappe.desk.reportview.get_count", { doctype: "SFUI Test Parent", filters: J([SEEDED, ...filters]), or_filters: J(or ?? []) })).message;
      ctx.check("total", (await cnt([])) === P.total, P.total, await cnt([]));
      ctx.check("status = Open", (await cnt([["status", "=", "Open"]])) === P.by_status.Open, P.by_status.Open, await cnt([["status", "=", "Open"]]));
      const any = await cnt([], [["status", "=", "Open"], ["status", "=", "Closed"]]);
      ctx.check("Open OR Closed", any === P.by_status.Open + P.by_status.Closed, P.by_status.Open + P.by_status.Closed, any);
      const page = async (start) => (await m.call("frappe.client.get_list", { doctype: "SFUI Test Parent", fields: J(["name"]), filters: J([SEEDED]), order_by: "modified desc, name desc", limit_start: start, limit_page_length: 20 })).message?.map((r) => r.name) ?? [];
      const [a, b] = [await page(0), await page(20)];
      ctx.check("pages 20 + rest, no overlap", a.length === Math.min(20, P.total) && b.length === Math.max(0, P.total - 20) && !a.some((n) => b.includes(n)), `${Math.min(20, P.total)} + ${Math.max(0, P.total - 20)}`, `${a.length} + ${b.length}`);
    } },
  { id: "L-PERM-1", area: "Security", feature: "User Permissions: restricted records", kind: "read", automated: "api", users: ["restricted"],
    rows: ["FV.D8", "FV.D9", "LV.A9"],
    pre: "restricted is limited to 2 contacts (apply_to_all_doctypes)", steps: ["restricted: get_count SFUI Test Parent", "restricted: get_list names", "restricted: getdoc a parent whose contact is NOT allowed", "restricted: frappe.client.get of the same"],
    expect: "count = expected restricted_visible; every listed name ∈ restricted_allowed; getdoc / client.get of a hidden parent → 403 PermissionError (rows are filtered silently in lists, refused on direct access)",
    cite: ["model/db_query.py:993-1125 build_match_conditions / add_user_permissions", "desk/form/load.py:40-45", "permissions.py:320 has_user_permission"], evidence: "count, names (synthetic), statuses",
    async run(ctx) {
      const r = ctx.as("restricted"), P = ctx.X.parents;
      const c = (await r.call("frappe.desk.reportview.get_count", { doctype: "SFUI Test Parent", filters: J([SEEDED]) })).message;
      ctx.check("restricted count", c === P.restricted_visible, P.restricted_visible, c);
      const names = ((await r.call("frappe.client.get_list", { doctype: "SFUI Test Parent", fields: J(["name"]), filters: J([SEEDED]), limit_page_length: 0 })).message ?? []).map((x) => x.name);
      ctx.check("only allowed rows listed", names.every((n) => P.restricted_allowed.includes(n)), "subset of restricted_allowed", names.filter((n) => !P.restricted_allowed.includes(n)));
      const hidden = P.restricted_hidden[0];
      const g = await getdoc(r, "SFUI Test Parent", hidden);
      ctx.check("getdoc hidden → 403", is(g, 403, "PermissionError"), 403, { status: g.status, exc_type: g.exc_type });
      const h = await r.call("frappe.client.get", { doctype: "SFUI Test Parent", name: hidden }, "GET");
      ctx.check("client.get hidden → 403", is(h, 403, "PermissionError"), 403, { status: h.status, exc_type: h.exc_type });
    } },
  { id: "L-PERM-2", area: "Security", feature: "permlevel > 0 columns in lists", kind: "read", automated: "api", users: ["writer", "field"],
    rows: ["LV.A10", "FV.D1"],
    pre: "seeded parents carry level1_field", steps: ["writer and field: frappe.client.get_list fields = [name, level1_field]"],
    expect: "writer: level1_field silently dropped from the selection (not an error); field: the value is returned",
    cite: ["model/db_query.py:686-760 (get_permitted_fields)"], evidence: "keys of the first row per account",
    async run(ctx) {
      const q = async (who) => ((await ctx.as(who).call("frappe.client.get_list", { doctype: "SFUI Test Parent", fields: J(["name", "level1_field"]), limit_page_length: 1 })).message ?? [])[0] ?? {};
      const [w, f] = [await q("writer"), await q("field")];
      ctx.check("writer: level1_field not returned", !("level1_field" in w) || !w.level1_field, "absent", Object.keys(w));
      ctx.check("field: level1_field returned", f.level1_field === ctx.X.level1_value, "present", f.level1_field ? "present" : "absent");
    } },
  { id: "L-CHILD-1", area: "List", feature: "child-table filters + distinct count", kind: "read", automated: "api", users: ["manager"],
    rows: ["LV.B6", "LV.I9"],
    pre: "parents with 0 / 2 / 12 child rows", steps: ["manager: reportview.get_count with filter [SFUI Test Child, qty, >=, 1] and distinct", "the same through get_list (names)"],
    expect: "count = number of PARENTS having such a row (not child rows); the list has no duplicate names",
    cite: ["desk/reportview.py:55-75 get_count (distinct)", "model/db_query.py (child-table join)"], evidence: "count, duplicate check",
    async run(ctx) {
      const m = ctx.as("manager");
      const expected = ctx.X.parents.with_child_rows;
      const c = (await m.call("frappe.desk.reportview.get_count", { doctype: "SFUI Test Parent", filters: J([SEEDED, ["SFUI Test Child", "qty", ">=", 1]]), distinct: "true" })).message;
      ctx.check("distinct parent count", c === expected, expected, c);
      const n = ((await m.call("frappe.desk.reportview.get", { doctype: "SFUI Test Parent", fields: J(["`tabSFUI Test Parent`.`name`"]), filters: J([SEEDED, ["SFUI Test Child", "qty", ">=", 1]]), group_by: "`tabSFUI Test Parent`.`name`", page_length: 500 })).message?.values ?? []).map((v) => v[0]);
      ctx.check("no duplicates", new Set(n).size === n.length, "unique", n.length);
    } },
  { id: "L-GROUP-1", area: "List", feature: "sidebar group-by counts (server aggregate)", kind: "read", automated: "api", users: ["manager", "restricted"],
    rows: ["LV.D6", "LV.D3", "LV.D11"],
    pre: "seeded statuses / owners / assignments", steps: ["manager: get_group_by_count(status), (owner), (assigned_to)", "restricted: get_group_by_count(status) and (assigned_to)"],
    expect: "manager: status / owner counts = expected.json; restricted: status counts sum to restricted_visible (frappe.get_list applies User Permissions). RECORD the restricted assigned_to counts: that branch builds its sub-query with frappe.qb.get_query (listview.py:36-58), which in 15.110 does not add User Permission conditions — any count above the restricted rows is a Frappe disclosure the package must not amplify",
    cite: ["desk/listview.py:33-92 get_group_by_count"], evidence: "count maps per account",
    async run(ctx) {
      const g = async (who, field) => (await ctx.as(who).call("frappe.desk.listview.get_group_by_count", { doctype: "SFUI Test Parent", current_filters: J([SEEDED]), field })).message ?? [];
      const st = Object.fromEntries((await g("manager", "status")).map((x) => [x.name, x.count]));
      ctx.check("manager status counts", J(Object.fromEntries(Object.entries(st).sort())) === J(Object.fromEntries(Object.entries(ctx.X.parents.by_status).filter(([, v]) => v).sort())), ctx.X.parents.by_status, st);
      const rs = (await g("restricted", "status")).reduce((a, x) => a + x.count, 0);
      ctx.check("restricted status counts sum to visible rows", rs === ctx.X.parents.restricted_visible, ctx.X.parents.restricted_visible, rs);
      const ra = (await g("restricted", "assigned_to")).reduce((a, x) => a + x.count, 0);
      ctx.record("restricted assigned_to total (recorded, see expected)", { restricted_assigned_total: ra, restricted_visible: ctx.X.parents.restricted_visible });
    } },
  { id: "L-TAGS-1", area: "List", feature: "tag stats, tag filter, tags on rows", kind: "read", automated: "api", users: ["manager"],
    rows: ["LV.D7", "LV.B13", "LV.E7", "LV.D4"],
    pre: "seeded tags sfui-red / sfui-blue", steps: ["manager: reportview.get_sidebar_stats(stats=['_user_tags'])", "manager: get_count with _user_tags like %sfui-red%"],
    expect: "tag counts = expected.json; the like filter count = the sfui-red count", cite: ["desk/reportview.py:625-660 get_sidebar_stats / get_stats"], evidence: "count maps",
    async run(ctx) {
      const m = ctx.as("manager");
      const s = (await m.call("frappe.desk.reportview.get_sidebar_stats", { stats: J(["_user_tags"]), doctype: "SFUI Test Parent", filters: J([SEEDED]) })).message?.stats?._user_tags ?? [];
      const map = Object.fromEntries(s.map(([k, v]) => [k, v]));
      ctx.check("tag stats", map["sfui-red"] === ctx.X.parents.tags["sfui-red"] && map["sfui-blue"] === ctx.X.parents.tags["sfui-blue"], ctx.X.parents.tags, map);
      const c = (await m.call("frappe.desk.reportview.get_count", { doctype: "SFUI Test Parent", filters: J([SEEDED, ["_user_tags", "like", "%sfui-red%"]]) })).message;
      ctx.check("tag filter", c === ctx.X.parents.tags["sfui-red"], ctx.X.parents.tags["sfui-red"], c);
    } },
  { id: "L-SAVED-1", area: "List", feature: "saved filters: per-user, duplicates", kind: "write", automated: "api", users: ["writer"],
    rows: ["LV.C7", "LV.C8", "LV.C12", "LV.C11"],
    pre: "seeded site", steps: ["writer: frappe.client.insert List Filter (for_user = writer)", "writer: insert the same filter_name again", "writer: frappe.client.delete the first"],
    expect: "insert 200; the duplicate is ACCEPTED by the server (List Filter has no unique rule) — the package's duplicate rejection (LV.C12) is client-side; delete 200",
    cite: ["desk/doctype/list_filter/list_filter.json (fields; no unique)", "desk/doctype/list_filter/list_filter.py (no validation)"], evidence: "statuses, names",
    async run(ctx) {
      const w = ctx.as("writer");
      const doc = { doctype: "List Filter", reference_doctype: "SFUI Test Parent", filter_name: `${ctx.tag} mine`, for_user: ctx.X.accounts.writer, filters: J([["SFUI Test Parent", "status", "=", "Open"]]) };
      const a = await w.call("frappe.client.insert", { doc: J(doc) });
      ctx.check("insert per-user filter", is(a, 200), 200, a.status);
      const b = await w.call("frappe.client.insert", { doc: J(doc) });
      ctx.record("duplicate filter_name (server rule)", { status: b.status, exc_type: b.exc_type });
      const c = await w.call("frappe.client.delete", { doctype: "List Filter", name: a.message?.name });
      ctx.check("delete own filter", is(c, 200), 200, c.status);
    } },
  { id: "L-SAVED-2", area: "Security", feature: "global saved filters + deleting another user's filter", kind: "reject", automated: "api", users: ["writer"],
    rows: ["LV.C9", "LV.C14"],
    pre: "seeded List Filters owned by manager: 'SFUI P36 Manager only' (for_user manager) and 'SFUI P36 Global' (for_user '')", steps: ["writer: insert a List Filter with for_user = '' (global)", "writer: get_list List Filter for SFUI Test Parent", "writer: frappe.client.delete manager's per-user filter"],
    expect: "RECORD Frappe's rules: List Filter grants read / write / create / delete to role 'Desk User' with no if_owner and no permission query (list_filter.json permissions), so in 15.110 any Desk user can create global filters, list everyone's filters and delete another user's filter — the package's 'Is Global' gate (LV.C9) is client-side only. A 200 on the delete is the expected Frappe behaviour, recorded as a finding for the owner",
    cite: ["desk/doctype/list_filter/list_filter.json:44-56 (Desk User, no if_owner)", "hooks.py:99-110 (no List Filter permission_query_conditions)"], evidence: "statuses; whether manager's filter is listed / deleted",
    async run(ctx) {
      const w = ctx.as("writer");
      const g = await w.call("frappe.client.insert", { doc: J({ doctype: "List Filter", reference_doctype: "SFUI Test Parent", filter_name: `${ctx.tag} global`, for_user: "", filters: "[]" }) });
      ctx.record("writer creates a global filter", { status: g.status, exc_type: g.exc_type });
      const l = ((await w.call("frappe.client.get_list", { doctype: "List Filter", filters: J([["reference_doctype", "=", "SFUI Test Parent"]]), fields: J(["name", "for_user"]), limit_page_length: 0 })).message ?? []);
      ctx.record("filters visible to writer", { count: l.length, includes_manager_only: l.some((x) => x.name === ctx.X.names.list_filters.lf_manager) });
      const d = await w.call("frappe.client.delete", { doctype: "List Filter", name: ctx.X.names.list_filters.lf_manager });
      ctx.record("writer deletes manager's per-user filter", { status: d.status, exc_type: d.exc_type });
    } },
  { id: "L-USERSET-1", area: "List", feature: "user_settings: page size + the List.sf_ui merge", kind: "write", automated: "api", users: ["writer"],
    rows: ["LV.A6b", "LV.I4", "LV.C6", "LV.D12"],
    pre: "seeded site", steps: ["writer: user_settings.save({List: {sf_ui: {pageSize: 100}}})", "writer: user_settings.get", "writer: user_settings.save({List: {filters: [], sort_by: 'modified', sort_order: 'desc'}}) — what a Desk list save sends when its in-memory copy lacks sf_ui", "writer: user_settings.get"],
    expect: "the server merge is SHALLOW (current.update(new), user_settings.py:30-42): after the 2nd save, List.sf_ui is GONE unless the sender included it. Desk's client (public/js/frappe/model/user_settings.js:9-34) sends its merged copy, so sf_ui survives a Desk save only if Desk loaded it first. Record both reads",
    cite: ["model/utils/user_settings.py:30-42 update_user_settings", "model/utils/user_settings.py:67-70 save"], evidence: "the two reads (List keys only)",
    async run(ctx) {
      const w = ctx.as("writer");
      await w.call("frappe.model.utils.user_settings.save", { doctype: "SFUI Test Parent", user_settings: J({ List: { sf_ui: { pageSize: 100 } } }) });
      const a = JSON.parse((await w.call("frappe.model.utils.user_settings.get", { doctype: "SFUI Test Parent" })).message ?? "{}");
      ctx.check("sf_ui stored", a?.List?.sf_ui?.pageSize === 100, 100, a?.List?.sf_ui);
      await w.call("frappe.model.utils.user_settings.save", { doctype: "SFUI Test Parent", user_settings: J({ List: { filters: [], sort_by: "modified", sort_order: "desc" } }) });
      const b = JSON.parse((await w.call("frappe.model.utils.user_settings.get", { doctype: "SFUI Test Parent" })).message ?? "{}");
      ctx.record("after a Desk-shaped List save", { list_keys: Object.keys(b?.List ?? {}), sf_ui_kept: !!b?.List?.sf_ui });
    } },
  { id: "L-LVS-1", area: "Security", feature: "List Settings write needs System Manager", kind: "reject", automated: "api", users: ["writer", "sysmgr"],
    rows: ["LV.J7", "LV.A2"],
    pre: "optional sysmgr account (--with-system-manager); otherwise the System-Manager half is BLOCKED", steps: ["writer: save_listview_settings(SFUI Test Parent, {total_fields: 4}, [])", "sysmgr: the same; then frappe.desk.listview.get_list_settings"],
    expect: "writer → 403 (List View Settings: create / write for System Manager only); sysmgr → 200 and get_list_settings returns total_fields 4",
    cite: ["desk/doctype/list_view_settings/list_view_settings.py:30-48", "desk/doctype/list_view_settings/list_view_settings.json:86-93", "desk/listview.py:13-30"], evidence: "statuses, settings read back",
    async run(ctx) {
      const args = { doctype: "SFUI Test Parent", listview_settings: J({ total_fields: 4 }), removed_listview_fields: "[]" };
      const w = await ctx.as("writer").call("frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings", args);
      ctx.check("writer → 403", is(w, 403, "PermissionError"), 403, { status: w.status, exc_type: w.exc_type });
      if (!ctx.has("sysmgr")) return ctx.block("no sysmgr account (seed without --with-system-manager)");
      const s = await ctx.as("sysmgr").call("frappe.desk.doctype.list_view_settings.list_view_settings.save_listview_settings", args);
      ctx.check("sysmgr → 200", is(s, 200), 200, s.status);
    } },
  { id: "L-BULK-1", area: "List", feature: "bulk edit (update)", kind: "write", automated: "api", users: ["writer"],
    rows: ["LV.F1", "LV.F18", "LV.F14"],
    pre: "2 fresh drafts by writer", steps: ["writer: frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs(action='update', data={notes: …})"],
    expect: "response lists 0 failed (synchronous below 20 documents); both notes updated", cite: ["desk/doctype/bulk_update/bulk_update.py:52-111"], evidence: "failed list, values after",
    async run(ctx) {
      const a = await newParent(ctx, "writer", { title: "bulk1a" }), b = await newParent(ctx, "writer", { title: "bulk1b" });
      const r = await ctx.as("writer").call("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", { doctype: "SFUI Test Parent", docnames: J([a?.name, b?.name]), action: "update", data: J({ notes: `${ctx.tag} bulk` }) });
      ctx.check("no failures", is(r, 200) && (r.message ?? []).length === 0, [], r.message);
    } },
  { id: "L-BULK-2", area: "Security", feature: "bulk submit / cancel: rights per document (BLOCKED row LV.F19)", kind: "reject", automated: "api", users: ["writer", "manager"],
    rows: ["LV.F8", "LV.F9", "LV.F13", "LV.F18", "LV.F19", "LV.F12"],
    pre: "fresh drafts", steps: ["writer: submit_cancel_or_update_docs(action='submit') on 2 drafts", "manager: the same on 2 drafts, then action='cancel' on them"],
    expect: "writer: HTTP 200 but BOTH names in the returned failed list (per-document PermissionError is caught and logged, bulk_update.py:74-111) and docstatus stays 0; manager: none failed, docstatus 1 then 2",
    cite: ["desk/doctype/bulk_update/bulk_update.py:52-111", "model/document.py:894-895, 908-909"], evidence: "failed lists, docstatus after",
    async run(ctx) {
      const w1 = await newParent(ctx, "writer", { title: "b2w1" }), w2 = await newParent(ctx, "writer", { title: "b2w2" });
      const bw = await ctx.as("writer").call("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", { doctype: "SFUI Test Parent", docnames: J([w1?.name, w2?.name]), action: "submit" });
      ctx.check("writer: both fail per document", J([...(bw.message ?? [])].sort()) === J([w1?.name, w2?.name].sort()), "both failed", bw.message);
      const m1 = await newParent(ctx, "manager", { title: "b2m1" }), m2 = await newParent(ctx, "manager", { title: "b2m2" });
      const bs = await ctx.as("manager").call("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", { doctype: "SFUI Test Parent", docnames: J([m1?.name, m2?.name]), action: "submit" });
      ctx.check("manager submit: none failed", is(bs, 200) && (bs.message ?? []).length === 0, [], bs.message);
      const bc = await ctx.as("manager").call("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", { doctype: "SFUI Test Parent", docnames: J([m1?.name, m2?.name]), action: "cancel" });
      ctx.check("manager cancel: none failed", is(bc, 200) && (bc.message ?? []).length === 0, [], bc.message);
    } },
  { id: "L-BULK-3", area: "List", feature: "bulk delete", kind: "write", automated: "api", users: ["writer", "manager"],
    rows: ["LV.F10", "LV.F13"],
    pre: "fresh drafts", steps: ["writer: reportview.delete_items on 1 draft", "manager: delete_items on 2 drafts"],
    expect: "writer: 200 but the draft still exists (the failure is reported by a realtime msgprint, reportview.py:588-620); manager: both gone",
    cite: ["desk/reportview.py:575-620 delete_items / delete_bulk"], evidence: "existence after",
    async run(ctx) {
      const w = await newParent(ctx, "writer", { title: "b3w" });
      await ctx.as("writer").call("frappe.desk.reportview.delete_items", { items: J([w?.name]), doctype: "SFUI Test Parent" });
      const still = await getdoc(ctx.as("manager"), "SFUI Test Parent", w?.name);
      ctx.check("writer's bulk delete did not delete", !!still.body?.docs?.[0], "exists", still.status);
      const a = await newParent(ctx, "manager", { title: "b3a" }), b = await newParent(ctx, "manager", { title: "b3b" });
      await ctx.as("manager").call("frappe.desk.reportview.delete_items", { items: J([a?.name, b?.name]), doctype: "SFUI Test Parent" });
      const gone = await ctx.as("manager").call("frappe.client.get_count", { doctype: "SFUI Test Parent", filters: J([["name", "in", [a?.name, b?.name]]]) });
      ctx.check("manager's bulk delete removed both", gone.message === 0, 0, gone.message);
    } },
  { id: "L-BULK-4", area: "List", feature: "bulk workflow approval", kind: "write", automated: "api", users: ["writer", "manager"],
    rows: ["LV.F11"],
    pre: "2 fresh workflow docs (amount 100) in SFUI Pending", steps: ["manager: frappe.model.workflow.bulk_workflow_approval(docnames, 'SFUI Test Workflow', 'SFUI Approve')"],
    expect: "both reach SFUI Approved (docstatus 1); below 20 documents it runs synchronously", cite: ["model/workflow.py:238-300 bulk_workflow_approval"], evidence: "states after",
    async run(ctx) {
      const w = ctx.as("writer");
      const names = [];
      for (const i of [1, 2]) {
        const c = docOf(await savedocs(w, { doctype: "SFUI Test Workflow", name: `new-sfui-test-workflow-b${i}`, __islocal: 1, subject: `${ctx.tag} bulk wf ${i}`, amount: 100, workflow_state: "SFUI Draft" }));
        if (c) { await w.call("frappe.model.workflow.apply_workflow", { doc: J(c), action: "SFUI Request Approval" }); names.push(c.name); }
      }
      await ctx.as("manager").call("frappe.model.workflow.bulk_workflow_approval", { docnames: J(names), doctype: "SFUI Test Workflow", action: "SFUI Approve" });
      const st = ((await ctx.as("manager").call("frappe.client.get_list", { doctype: "SFUI Test Workflow", filters: J([["name", "in", names]]), fields: J(["workflow_state"]) })).message ?? []).map((x) => x.workflow_state);
      ctx.check("both approved", st.length === 2 && st.every((s) => s === "SFUI Approved"), ["SFUI Approved", "SFUI Approved"], st);
    } },
  { id: "L-ASSIGN-1", area: "List", feature: "assign / clear assignment / assignment rule", kind: "write", automated: "api", users: ["writer"],
    rows: ["LV.F3", "LV.F4", "LV.F5", "LV.B14", "LV.D2", "LV.E6"],
    pre: "2 fresh drafts by writer", steps: ["writer: frappe.desk.form.assign_to.add_multiple(doctype, name=[a, b], assign_to=[reader])", "writer: assign_to.remove_multiple", "writer: assignment_rule.bulk_apply (no SFUI rule exists)"],
    expect: "ToDos created and _assign holds the reader; the reader (read right) gets no DocShare; remove clears _assign; bulk_apply → no rule applies (message), nothing assigned",
    cite: ["desk/form/assign_to.py:43-139 add (share when the assignee lacks permission :101-113)", "automation/doctype/assignment_rule/assignment_rule.py:232 bulk_apply"], evidence: "_assign before / after",
    async run(ctx) {
      const w = ctx.as("writer");
      const a = await newParent(ctx, "writer", { title: "assign" });
      const r = await w.call("frappe.desk.form.assign_to.add_multiple", { doctype: "SFUI Test Parent", name: J([a?.name]), assign_to: J([ctx.X.accounts.reader]), description: `${ctx.tag} assign`, bulk_assign: true });
      ctx.check("assign → 200", is(r, 200), 200, { status: r.status, exc_type: r.exc_type });
      const g = (await getdoc(ctx.as("manager"), "SFUI Test Parent", a?.name)).body?.docs?.[0];
      ctx.check("_assign holds the reader", (g?._assign ?? "").includes(ctx.X.accounts.reader), "reader assigned", g?._assign ? "set" : "empty");
      const x = await w.call("frappe.desk.form.assign_to.remove_multiple", { doctype: "SFUI Test Parent", names: J([a?.name]), ignore_permissions: false });
      ctx.record("remove_multiple", { status: x.status, exc_type: x.exc_type });
    } },
  { id: "L-TAG-2", area: "Security", feature: "add tags needs write", kind: "reject", automated: "api", users: ["writer", "reader"],
    rows: ["LV.F6"],
    pre: "a seeded parent", steps: ["writer: frappe.desk.doctype.tag.tag.add_tags(['sfui-green'], dt, [name])", "reader: the same"],
    expect: "writer 200 (_user_tags contains sfui-green); reader 403 (update_tags checks write)", cite: ["desk/doctype/tag/tag.py:43-52 add_tags → DocTags.add :87-94", "desk/doctype/tag/tag.py:105-126 DocTags.update (set_value, then update_tags; errors re-raised → the request rolls back)", "desk/doctype/tag/tag.py:147-152 update_tags (check_permission write)"], evidence: "statuses",
    async run(ctx) {
      const d = await newParent(ctx, "writer", { title: "tags" });
      const w = await ctx.as("writer").call("frappe.desk.doctype.tag.tag.add_tags", { tags: J(["sfui-green"]), dt: "SFUI Test Parent", docs: J([d?.name]) });
      ctx.check("writer add_tags → 200", is(w, 200), 200, w.status);
      const r = await ctx.as("reader").call("frappe.desk.doctype.tag.tag.add_tags", { tags: J(["sfui-green"]), dt: "SFUI Test Parent", docs: J([d?.name]) });
      ctx.check("reader add_tags → 403", is(r, 403, "PermissionError"), 403, { status: r.status, exc_type: r.exc_type });
    } },
  { id: "L-LIKE-1", area: "List", feature: "like heart", kind: "write", automated: "api", users: ["reader"],
    rows: ["LV.E5"],
    pre: "a seeded parent", steps: ["reader: frappe.desk.like.toggle_like(dt, name, 'Yes')", "reader: toggle_like(…, 'No')"],
    expect: "RECORD: 15.110's toggle_like has no permission check (like.py:16-60), so any logged-in user can like — 200 is the expected Frappe behaviour; _liked_by contains the reader, then not",
    cite: ["desk/like.py:16-60"], evidence: "statuses, _liked_by membership",
    async run(ctx) {
      const p = ctx.X.names.parents[1];
      const a = await ctx.as("reader").call("frappe.desk.like.toggle_like", { doctype: "SFUI Test Parent", name: p, add: "Yes" });
      const b = await ctx.as("reader").call("frappe.desk.like.toggle_like", { doctype: "SFUI Test Parent", name: p, add: "No" });
      ctx.record("toggle_like as reader", { like: a.status, unlike: b.status });
    } },
  { id: "L-EXPORT-1", area: "List", feature: "export (Data Exporter template, Report export)", kind: "read", automated: "api", users: ["manager", "reader"],
    rows: ["LV.F2", "LV.J2", "LV.J3"],
    pre: "manager has export; reader has none", steps: ["manager: frappe.core.doctype.data_import.data_import.download_template(SFUI Test Parent, export_records='5_records')", "manager: frappe.desk.reportview.export_query (CSV)", "reader: export_query"],
    expect: "manager 200 (a file); reader export_query → 403 'You are not allowed to export' — NOTE: an Access Log row is written BEFORE that check (reportview.py:410-427). download_template checks only `read` (data_import.py:188), so the reader may download a template (recorded)",
    cite: ["core/doctype/data_import/data_import.py:179-200", "desk/reportview.py:354-427 export_query (make_access_log :410, can_export :419)"], evidence: "statuses, content-type, size",
    async run(ctx) {
      const t = await ctx.as("manager").call("frappe.core.doctype.data_import.data_import.download_template", { doctype: "SFUI Test Parent", export_fields: J({ "SFUI Test Parent": ["name", "title"] }), export_records: "5_records", file_type: "CSV" });
      ctx.check("manager template", t.status === 200, 200, { status: t.status, type: t.contentType });
      const q = { doctype: "SFUI Test Parent", file_format_type: "CSV", fields: J(["`tabSFUI Test Parent`.`name`", "`tabSFUI Test Parent`.`title`"]), filters: "[]", title: "SFUI P36" };
      const m = await ctx.as("manager").call("frappe.desk.reportview.export_query", q);
      ctx.check("manager export_query", m.status === 200, 200, { status: m.status, type: m.contentType });
      const r = await ctx.as("reader").call("frappe.desk.reportview.export_query", q);
      ctx.check("reader export_query → 403", r.status === 403, 403, { status: r.status, exc_type: r.exc_type });
    } },
  { id: "L-IMPORT-1", area: "List", feature: "Data Import", kind: "infra", automated: "manual", infra: "a background worker on the staging site (form_start_import enqueues the import)", users: ["manager", "reader"],
    rows: ["LV.J1"],
    pre: "worker running; a CSV of 3 synthetic contacts", steps: ["manager: insert Data Import (reference SFUI Test Contact, Insert New Records) + attach the CSV", "manager: form_start_import; poll status", "reader: form_start_import on it"],
    expect: "3 contacts imported, status Success; reader → 403 (write on the Data Import / no import right)", cite: ["core/doctype/data_import/data_import.py:71, 116-160"], evidence: "status, import log" },
  { id: "L-REALTIME-1", area: "List", feature: "realtime list refresh", kind: "infra", automated: "manual", infra: "the staging site's socket.io (redis_socketio) reachable from the runner, and a socket.io client (the package's createSocketRealtime is a skeleton)", users: ["manager", "writer"],
    rows: ["LV.E8"],
    pre: "socket.io reachable", steps: ["manager: open the harness list (subscribes to doctype room)", "writer: save a parent through the API", "observe the manager's list"],
    expect: "server publishes list_update {doctype, name, user} after commit; the list reloads within a few seconds without a manual refresh",
    cite: ["model/document.py:1218-1233 notify_update", "realtime.py:23-52 publish_realtime (list_update room)"], evidence: "socket frames (event names), screenshot timestamps" },
  { id: "L-HDR-1", area: "List", feature: "selection header: Add ↔ Actions", kind: "browser", automated: "browser", users: ["manager"],
    rows: ["LV.F16", "LV.F17", "LV.F15", "LV.G1"],
    pre: "harness list with the package default selection (selectionMode=\"header\", Desk header actions — P36 owner decision)", steps: ["no selection → '+ Add SFUI Test Parent' visible in the header action area", "tick one row → the same area shows the Actions control instead of Add", "clear the selection → Add is back", "tick every row on the page → 'Select all N matching' → Actions applies to all N"],
    expect: "Desk list_view.js:590-598, 1613-1634 behaviour", cite: ["public/js/frappe/list/list_view.js:590-598, 1613-1634 (Desk)"], evidence: "3 screenshots (none / some / cleared) + the bounding box of the action area" },
  { id: "L-PAGE-1", area: "List", feature: "page sizes / load more", kind: "browser", automated: "browser", users: ["manager"],
    rows: ["LV.I5", "LV.I6", "LV.I8"],
    pre: "harness list", steps: ["choose 100 → one get_list with limit_page_length 100", "group by status → 'Load more'"],
    expect: "requests match the chosen size; counts unchanged", cite: ["client.py:28-80"], evidence: "request args, screenshots" },

  // ---------------------------------------------------------------- VIEWS -----------------------------------------
  { id: "V-REPORT-1", area: "Views", feature: "Report view: child columns + inline edit", kind: "write", automated: "api", users: ["writer", "reader"],
    rows: ["LV.H1"],
    pre: "a parent with 12 child rows", steps: ["writer: reportview.get with fields [parent.name, `tabSFUI Test Child`.`qty`] for that parent", "writer: frappe.client.set_value(SFUI Test Parent, name, 'notes', …) — the inline edit", "reader: the same set_value"],
    expect: "one row per child row (12); writer set_value 200; reader 403", cite: ["desk/reportview.py:27-50 get", "client.py:174-210 set_value"], evidence: "row count, statuses",
    async run(ctx) {
      const d = await newParent(ctx, "writer", { title: "report", items: Array.from({ length: 12 }, (_, i) => childRow(i + 1)) });
      const r = await ctx.as("writer").call("frappe.desk.reportview.get", { doctype: "SFUI Test Parent", fields: J(["`tabSFUI Test Parent`.`name`", "`tabSFUI Test Child`.`qty`"]), filters: J([["name", "=", d?.name]]), page_length: 100 });
      ctx.check("one row per child row", (r.message?.values ?? []).length === 12, 12, (r.message?.values ?? []).length);
      const w = await ctx.as("writer").call("frappe.client.set_value", { doctype: "SFUI Test Parent", name: d?.name, fieldname: "notes", value: `${ctx.tag} inline` });
      ctx.check("writer inline edit → 200", is(w, 200), 200, w.status);
      const x = await ctx.as("reader").call("frappe.client.set_value", { doctype: "SFUI Test Parent", name: d?.name, fieldname: "notes", value: `${ctx.tag} reader inline` });
      ctx.check("reader inline edit → 403", is(x, 403, "PermissionError"), 403, { status: x.status, exc_type: x.exc_type });
    } },
  { id: "V-IMAGE-1", area: "Views", feature: "Image view field", kind: "read", automated: "api", users: ["manager"],
    rows: ["LV.H5"],
    pre: "SFUI Test Parent image_field = attach_image (overlay)", steps: ["manager: getdoctype → image_field", "manager: reportview.get with the attach_image column"],
    expect: "meta image_field = 'attach_image'; the column is returned (values may be empty)", cite: ["desk/reportview.py:27-50"], evidence: "meta key, response keys",
    async run(ctx) {
      const meta = await ctx.as("manager").call("frappe.desk.form.load.getdoctype", { doctype: "SFUI Test Parent" }, "GET");
      const d = (meta.body?.docs ?? []).find((x) => x.name === "SFUI Test Parent");
      ctx.check("image_field from the meta", d?.image_field === "attach_image", "attach_image", d?.image_field);
      const r = await ctx.as("manager").call("frappe.desk.reportview.get", { doctype: "SFUI Test Parent", fields: J(["`tabSFUI Test Parent`.`name`", "`tabSFUI Test Parent`.`attach_image`"]), page_length: 5 });
      ctx.check("attach_image column returned", (r.message?.keys ?? []).includes("attach_image"), "attach_image", r.message?.keys);
    } },
  { id: "V-KANBAN-1", area: "Views", feature: "Kanban: boards, move card, rights", kind: "write", automated: "api", users: ["writer", "reader"],
    rows: ["LV.H2"],
    pre: "seeded board 'SFUI P36 Board' (status)", steps: ["writer: kanban_board.get_kanban_boards(SFUI Test Parent)", "writer: frappe.client.set_value status Draft → Open for a fresh draft (what a column move sends)", "writer: update_order_for_single_card", "reader: update_order_for_single_card"],
    expect: "the board is listed; writer's moves 200; reader 403 (write on the reference DocType required). Known: with a filtered list the server pops old_index blindly (kanban_board.py:147-151)",
    cite: ["desk/doctype/kanban_board/kanban_board.py:58-69, 132-151 (write check :137)", "client.py:174"], evidence: "statuses, column order after",
    async run(ctx) {
      const b = await ctx.as("writer").call("frappe.desk.doctype.kanban_board.kanban_board.get_kanban_boards", { doctype: "SFUI Test Parent" });
      ctx.check("board listed", (b.message ?? []).some((x) => x.name === ctx.X.names.kanban_board), ctx.X.names.kanban_board, (b.message ?? []).map((x) => x.name));
      const d = await newParent(ctx, "writer", { title: "kanban" });
      const s = await ctx.as("writer").call("frappe.client.set_value", { doctype: "SFUI Test Parent", name: d?.name, fieldname: "status", value: "Open" });
      ctx.check("writer moves the card (status)", is(s, 200), 200, s.status);
      const args = { board_name: ctx.X.names.kanban_board, docname: d?.name, from_colname: "Draft", to_colname: "Open", old_index: 0, new_index: 0 };
      const o = await ctx.as("writer").call("frappe.desk.doctype.kanban_board.kanban_board.update_order_for_single_card", args);
      ctx.record("writer order update", { status: o.status, exc_type: o.exc_type });
      const r = await ctx.as("reader").call("frappe.desk.doctype.kanban_board.kanban_board.update_order_for_single_card", args);
      ctx.check("reader order update → 403", is(r, 403, "PermissionError"), 403, { status: r.status, exc_type: r.exc_type });
    } },
  { id: "V-CAL-1", area: "Views", feature: "Calendar (month) events", kind: "read", automated: "api", users: ["manager", "restricted"],
    rows: ["LV.H3"],
    pre: "parents with due_date across December 2026", steps: ["manager: frappe.desk.calendar.get_events(SFUI Test Parent, 2026-12-01, 2026-12-31, field_map {start: due_date, end: due_date, id: name, title: title})", "restricted: the same"],
    expect: "manager: due_in_dec_2026 events; restricted: only allowed parents (get_list applies User Permissions)", cite: ["desk/calendar.py:25-57 get_events"], evidence: "event counts",
    async run(ctx) {
      const args = { doctype: "SFUI Test Parent", start: "2026-12-01", end: "2026-12-31", field_map: J({ start: "due_date", end: "due_date", id: "name", title: "title", allDay: "allDay" }), filters: J([SEEDED]) };
      const m = (await ctx.as("manager").call("frappe.desk.calendar.get_events", args)).message ?? [];
      ctx.check("manager: December events", m.length === ctx.X.parents.due_in_dec_2026, ctx.X.parents.due_in_dec_2026, m.length);
      const r = (await ctx.as("restricted").call("frappe.desk.calendar.get_events", args)).message ?? [];
      ctx.check("restricted: only allowed parents", r.every((e) => ctx.X.parents.restricted_allowed.includes(e.name)), "subset", r.length);
    } },
  { id: "V-SWITCH-1", area: "Views", feature: "view switcher carries filters", kind: "browser", automated: "browser", users: ["manager"],
    rows: ["LV.H0"],
    pre: "harness `?view=views&doctype=SFUI Test Parent`", steps: ["filter status = Open in List", "switch to Report, Image, Kanban, Calendar"],
    expect: "only available views offered (Image: image_field; Kanban: a board; Calendar: date field); the filter carries to every view", cite: ["(package) src/frappe/views/FrappeViews.tsx"], evidence: "screenshots per view, request filters" },

  // ---------------------------------------------------------------- SECURITY (direct API) -----------------------
  { id: "S-CSRF-1", area: "Security", feature: "CSRF on state-changing requests", kind: "read", automated: "api", users: ["reader"],
    rows: ["FV.D9"],
    pre: "a logged-in session", steps: ["reader: POST reportview.get_count WITHOUT X-Frappe-CSRF-Token", "the same WITH the token"],
    expect: "without → 400 CSRFTokenError; with → 200", cite: ["auth.py:83-98 validate_csrf_token", "exceptions.py:75-76 (400)"], evidence: "statuses",
    async run(ctx) {
      const r = ctx.as("reader");
      const a = await r.call("frappe.desk.reportview.get_count", { doctype: "SFUI Test Parent", filters: "[]" }, "POST", { csrf: false });
      ctx.check("no token → 400 CSRFTokenError", is(a, 400, "CSRFTokenError"), "400 CSRFTokenError", { status: a.status, exc_type: a.exc_type });
      const b = await r.call("frappe.desk.reportview.get_count", { doctype: "SFUI Test Parent", filters: "[]" });
      ctx.check("with token → 200", is(b, 200), 200, b.status);
    } },
  { id: "S-API-1", area: "Security", feature: "Reader direct writes rejected (client.* API)", kind: "reject", automated: "api", users: ["reader"],
    rows: ["FV.D9", "FV.D3", "LV.F12"],
    pre: "a seeded draft parent", steps: ["reader: frappe.client.save", "reader: frappe.client.set_value", "reader: frappe.client.delete", "reader: frappe.client.submit"],
    expect: "every call 403 PermissionError; nothing changes", cite: ["client.py:174, 236, 261, 287", "model/document.py:404, 895", "model/delete_doc.py:240"], evidence: "statuses",
    async run(ctx) {
      const r = ctx.as("reader"), p = ctx.X.parents.draft_owned_by_writer[0];
      const d = (await getdoc(r, "SFUI Test Parent", p)).body?.docs?.[0] ?? { doctype: "SFUI Test Parent", name: p };
      for (const [m, a] of [
        ["frappe.client.save", { doc: J({ ...d, notes: `${ctx.tag} r` }) }],
        ["frappe.client.set_value", { doctype: "SFUI Test Parent", name: p, fieldname: "notes", value: `${ctx.tag} r` }],
        ["frappe.client.delete", { doctype: "SFUI Test Parent", name: p }],
        ["frappe.client.submit", { doc: J(d) }],
      ]) {
        const x = await r.call(m, a);
        ctx.check(`reader ${m} → 403`, is(x, 403, "PermissionError"), 403, { status: x.status, exc_type: x.exc_type });
      }
    } },
  { id: "S-API-2", area: "Security", feature: "Restricted direct writes on hidden records rejected", kind: "reject", automated: "api", users: ["restricted"],
    rows: ["FV.D8", "FV.D9"],
    pre: "a parent whose contact is not allowed for restricted", steps: ["restricted: frappe.client.set_value on it", "restricted: savedocs Save of a NEW parent whose contact is not allowed"],
    expect: "both 403 PermissionError (User Permission checked on write and on create)", cite: ["permissions.py:77-196 has_permission → has_user_permission :320", "model/document.py:300, 404"], evidence: "statuses",
    async run(ctx) {
      const r = ctx.as("restricted");
      const a = await r.call("frappe.client.set_value", { doctype: "SFUI Test Parent", name: ctx.X.parents.restricted_hidden[0], fieldname: "notes", value: `${ctx.tag} x` });
      ctx.check("set_value on a hidden parent → 403", is(a, 403, "PermissionError"), 403, { status: a.status, exc_type: a.exc_type });
      const notAllowed = ctx.X.names.contacts.find((c) => !ctx.X.contacts.allowed.includes(c));
      const b = await savedocs(r, parentDoc(ctx.X, { title: `${ctx.tag} restricted create`, contact: notAllowed }));
      ctx.check("create with a disallowed contact → 403", is(b, 403, "PermissionError"), 403, { status: b.status, exc_type: b.exc_type });
    } },
  { id: "S-API-3", area: "Security", feature: "permission matrix per account (asked, not attempted)", kind: "read", automated: "api", users: ["manager", "writer", "reader", "restricted", "field"],
    rows: ["FV.D2", "FV.D3", "FV.D5", "FV.D6", "FV.D7", "FV.H8", "FV.K16", "LV.F12", "LV.J10", "FV.G8"],
    pre: "seeded draft + submitted parents", steps: ["each account: frappe.client.has_permission(SFUI Test Parent, <draft>, read / write / create / submit / cancel / delete / amend)", "the same on <submitted>"],
    expect: "answers equal fixtures/staging/permissions.json evaluated per role (restricted: Writer rights only on allowed rows; field: Writer rights)", cite: ["client.py:315-325 has_permission", "permissions.py:77-196"], evidence: "the 5 × 7 × 2 matrix",
    async run(ctx) {
      const want = {
        manager: { read: 1, write: 1, create: 1, submit: 1, cancel: 1, delete: 1, amend: 1 },
        writer: { read: 1, write: 1, create: 1, submit: 0, cancel: 0, delete: 0, amend: 0 },
        reader: { read: 1, write: 0, create: 0, submit: 0, cancel: 0, delete: 0, amend: 0 },
        field: { read: 1, write: 1, create: 1, submit: 0, cancel: 0, delete: 0, amend: 0 },
      };
      const p = ctx.X.parents.draft_owned_by_writer.find((n) => ctx.X.parents.restricted_allowed.includes(n)) ?? ctx.X.parents.draft_owned_by_writer[0];
      for (const [who, perms] of Object.entries(want)) {
        const got = {};
        for (const pt of Object.keys(perms)) got[pt] = (await ctx.as(who).call("frappe.client.has_permission", { doctype: "SFUI Test Parent", docname: p, perm_type: pt }, "GET")).message?.has_permission ? 1 : 0;
        ctx.check(`${who} rights on a draft`, J(got) === J(perms), perms, got);
      }
    } },
  { id: "S-UI-1", area: "Security", feature: "UI hides what the server refuses (and the server still refuses)", kind: "browser", automated: "browser", users: ["reader", "writer"],
    rows: ["FV.H8", "FV.K16", "LV.F12", "LV.J10", "FV.D10"],
    pre: "harness form + list", steps: ["reader: form shows no Save / Submit / Delete / Duplicate; list shows no '+ Add', no bulk Delete / Edit", "writer: no Submit / Cancel / Delete", "S-API-1 / F-SUBMIT-2 / F-MENU-2 must also FAIL the direct calls — UI hiding alone is not proof"],
    expect: "UI and server agree", cite: ["(server side) S-API-1, F-SUBMIT-2, F-CANCEL-2, F-MENU-2"], evidence: "screenshots per account" },
  // ---------------------------------------------------------------- P36b (batch 2, 0.7.0-dev.3) ------------------------
  // Server behaviour behind the batch-2 UI (Report view Submit / Cancel, Form Sidebar, Share / Like / Comments, Global
  // Search). The package UI for these is not in the harness: these API tests validate Frappe's answers the package relies
  // on, not the package's screens. Tests without `rows` cover features that have no COVERAGE row (COVERAGE.md §10).
  { id: "L-BULK-5", area: "List", feature: "P36b — bulk Submit / Cancel: docstatus eligibility, unknown name, 20 / 500 thresholds", kind: "write", automated: "api", users: ["manager"],
    rows: ["LV.F8", "LV.F9", "LV.F18"],
    pre: "fresh drafts created by manager (SFUI Test Parent is submittable; SFUI Manager has submit + cancel); the 20-name step needs the site's background worker only for its recorded outcome",
    steps: ["manager: create drafts A, B, C, D", "submit_cancel_or_update_docs(action='submit', [A])", "action='submit' on [A, B] (A is already submitted)", "action='cancel' on [A, C] (C is a draft)", "action='submit' on [C, 'SFUI-P36B-NOPE']", "action='submit' with 501 names (non-existent)", "action='submit' with D repeated 20 times"],
    expect: "[A] → failed []; [A, B] → failed [A] (submit only takes drafts), B submitted; cancel [A, C] → failed [C] (cancel only takes submitted), A cancelled; [C, unknown] → 404 DoesNotExistError (get_doc is outside the try) and C STAYS submitted (commit per document); 501 names → 417 ValidationError 'Bulk operations only support up to 500 documents.' (title 'Too Many Documents'); 20 names → 200 with NO `message` and the alert 'Bulk operation is enqueued in background.' (D's docstatus afterwards depends on the worker: recorded)",
    cite: ["desk/doctype/bulk_update/bulk_update.py:51-71 submit_cancel_or_update_docs (< 20 sync, 20–500 enqueue, > 500 throw)", "desk/doctype/bulk_update/bulk_update.py:74-114 _bulk_action (get_doc :82 outside the try; draft-only submit :85; submitted-only cancel :92; else failed :99-100; commit :101)"],
    evidence: "failed lists, statuses / exc_type, docstatus after each step, `_server_messages` of the 20-name call (redacted)",
    async run(ctx) {
      const m = ctx.as("manager");
      const bulk = (names, action) => m.call("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", { doctype: "SFUI Test Parent", docnames: J(names), action });
      const ds = async (n) => docOf(await getdoc(m, "SFUI Test Parent", n))?.docstatus;
      const [A, B, C, D] = [await newParent(ctx, "manager", { title: "b5a" }), await newParent(ctx, "manager", { title: "b5b" }), await newParent(ctx, "manager", { title: "b5c" }), await newParent(ctx, "manager", { title: "b5d" })].map((d) => d?.name);
      const s1 = await bulk([A], "submit");
      ctx.check("submit [draft] → no failure", is(s1, 200) && J(s1.message) === "[]", [], s1.message);
      const s2 = await bulk([A, B], "submit");
      ctx.check("submit [submitted, draft] → the submitted one fails", is(s2, 200) && J(s2.message) === J([A]), [A], s2.message);
      ctx.check("B submitted", (await ds(B)) === 1, 1, await ds(B));
      const c1 = await bulk([A, C], "cancel");
      ctx.check("cancel [submitted, draft] → the draft fails", is(c1, 200) && J(c1.message) === J([C]), [C], c1.message);
      ctx.check("A cancelled", (await ds(A)) === 2, 2, await ds(A));
      const u = await bulk([C, "SFUI-P36B-NOPE"], "submit");
      ctx.check("unknown name → the whole request fails (404)", is(u, 404, "DoesNotExistError"), "404 DoesNotExistError", { status: u.status, exc_type: u.exc_type });
      ctx.check("…but C, handled before it, stays submitted", (await ds(C)) === 1, 1, await ds(C));
      const big = await bulk(Array.from({ length: 501 }, (_, i) => `SFUI-P36B-NOPE-${i}`), "submit");
      ctx.check("501 names → 417 ValidationError", is(big, 417, "ValidationError"), "417 ValidationError", { status: big.status, exc_type: big.exc_type });
      const q = await bulk(Array.from({ length: 20 }, () => D), "submit");
      ctx.check("20 names → 200, no message, enqueued alert", is(q, 200) && q.message === undefined && /enqueued/i.test(String(q.body?._server_messages ?? "")), "200, no message, 'enqueued'", { status: q.status, message: q.message, alert: /enqueued/i.test(String(q.body?._server_messages ?? "")) });
      ctx.record("D after the queued job (worker-dependent)", { docstatus: await ds(D) });
    } },
  { id: "V-REPORT-2", area: "Views", feature: "P36b — Report view Submit / Cancel: one name per checked row (Desk) vs once per document (package)", kind: "write", automated: "api", users: ["manager"],
    rows: ["LV.H1", "LV.F8", "LV.F9", "LV.F14"],
    pre: "a fresh draft P with 2 child rows and a fresh draft Q without rows, both by manager", steps: ["manager: reportview.get with fields [parent.name, `tabSFUI Test Child`.`item_code`] filtered on P (what the Report view draws)", "manager: submit_cancel_or_update_docs(action='submit', [P, P, Q]) — what Desk sends when both of P's rows and Q are checked (get_checked_items: one name per datatable row)", "manager: action='cancel' with [P, Q] — what the package sends (`uniqueNames`)", "browser (optional, not in the harness): FrappeReportView bulk — check P's two rows + Q → Actions → Submit → the confirmation counts 2 documents"],
    expect: "2 report rows named P; submit [P, P, Q] → failed [P] (the second copy is no longer a draft) although P and Q are both submitted — the false failure the package's de-duplication avoids; cancel [P, Q] → failed [], both docstatus 2",
    cite: ["public/js/frappe/views/reports/report_view.js:9 (extends ListView), :360 (checkboxColumn), :371-374 (onCheckRow → Actions), :1339-1352 get_checked_items", "desk/reportview.py:27-50 get (one row per child row)", "desk/doctype/bulk_update/bulk_update.py:85, 99-100"],
    evidence: "row count, failed lists, docstatus after",
    async run(ctx) {
      const m = ctx.as("manager");
      const P = (await newParent(ctx, "manager", { title: "report-bulk", items: [childRow(1), childRow(2)] }))?.name;
      const Q = (await newParent(ctx, "manager", { title: "report-bulk-q" }))?.name;
      const r = await m.call("frappe.desk.reportview.get", { doctype: "SFUI Test Parent", fields: J(["`tabSFUI Test Parent`.`name`", "`tabSFUI Test Child`.`item_code`"]), filters: J([["name", "=", P]]), page_length: 100 });
      ctx.check("one report row per child row (2)", (r.message?.values ?? []).length === 2, 2, (r.message?.values ?? []).length);
      const bulk = (names, action) => m.call("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", { doctype: "SFUI Test Parent", docnames: J(names), action });
      const d = await bulk([P, P, Q], "submit");
      ctx.check("Desk's per-row names: the repeated P is reported failed", is(d, 200) && J(d.message) === J([P]), [P], d.message);
      const c = await bulk([P, Q], "cancel");
      ctx.check("unique names: none failed", is(c, 200) && J(c.message) === "[]", [], c.message);
      const st = [docOf(await getdoc(m, "SFUI Test Parent", P))?.docstatus, docOf(await getdoc(m, "SFUI Test Parent", Q))?.docstatus];
      ctx.check("both cancelled", J(st) === J([2, 2]), [2, 2], st);
    } },
  { id: "F-SB-ASSIGN-1", area: "Form", feature: "P36b — Form Sidebar Assign: add (read right), share when the assignee cannot read (assigner needs share), Done (assignee only), remove (read right)", kind: "reject", automated: "api", users: ["writer", "reader", "restricted", "manager"],
    rows: [],
    pre: "a fresh draft by writer linked to contact #12 (restricted cannot read it: its User Permissions allow contacts 1–2 only); sharing not disabled on the site", steps: ["restricted: frappe.desk.form.assign_to.add {doctype, name, assign_to: [reader]} (cannot read the document)", "reader: assign_to.add {…, assign_to: [writer], description, date, priority: 'Medium'} (read only)", "writer: assign_to.add {…, assign_to: [reader]}; writer: the same again (duplicate)", "writer: assign_to.add {…, assign_to: [restricted]} (assignee without read; writer holds no share right)", "manager: assign_to.add {…, assign_to: [restricted]} (manager holds share)", "manager: getdoc → docinfo.assignments; frappe.share.get_users", "writer: assign_to.close {…, assign_to: reader} (not the assignee)", "reader: assign_to.close {…, assign_to: reader}", "reader: assign_to.remove {…, assign_to: writer} (someone else's assignment, read only)"],
    expect: "restricted → 403 (check_permission = read); reader → 200 (the server needs read, not write — Desk shows '+' to readers); writer → 200, then the duplicate → 200 + msgprint 'Already in the following Users ToDo list'; writer assigning restricted → 403 PermissionError 'No permission to share' (the automatic share runs as the assigner: frappe.share.add → check_share_permission) and no ToDo is left (the request rolls back); manager assigning restricted → 200, a DocShare (read) for restricted + msgprint 'Shared with the following Users with Read access'; docinfo.assignments lists the open ToDos (owner = allocated_to); close by a non-assignee → 417 'Only the assignee can complete this to-do.'; close by reader → 200 (ToDo Closed, gone from docinfo.assignments); reader's remove of writer's assignment → 200 (server: read only; Desk's client offers remove only to the assignee or a writer — RECORDED as a Desk-vs-server difference)",
    cite: ["desk/form/assign_to.py:42-139 add (check_permission :67-68; duplicate :70-71, 135-137; share when the assignee lacks read :101-113)", "share.py:20-33 add → add_docshare :51-52 → check_share_permission :223-226 (the assigner's share right)", "desk/form/assign_to.py:195-200 close (:197-198 assignee only)", "desk/form/assign_to.py:176-178 remove → set_status :203-232 (read check :206-207)", "desk/form/load.py:100-143 get_docinfo (assignments :128)", "public/js/frappe/form/sidebar/assign_to.js:94-131, 344-370 (Desk UI)"],
    evidence: "statuses / exc_type, _server_messages (redacted), docinfo.assignments owners, DocShare rows of the document",
    async run(ctx) {
      const d = await newParent(ctx, "writer", { title: "sb-assign" });
      if (!d) return;
      const add = (who, to) => ctx.as(who).call("frappe.desk.form.assign_to.add", { doctype: "SFUI Test Parent", name: d.name, assign_to: J([to]), description: `${ctx.tag} sidebar assign`, priority: "Medium" });
      const acc = ctx.X.accounts;
      const rs = await add("restricted", acc.reader);
      ctx.check("restricted (no read) → 403", is(rs, 403, "PermissionError"), 403, { status: rs.status, exc_type: rs.exc_type });
      const rd = await add("reader", acc.writer);
      ctx.check("reader (read only) may assign → 200", is(rd, 200), 200, { status: rd.status, exc_type: rd.exc_type });
      const w1 = await add("writer", acc.reader);
      ctx.check("writer assigns reader → 200", is(w1, 200), 200, w1.status);
      const w2 = await add("writer", acc.reader);
      ctx.check("duplicate → 200 with 'Already in … ToDo list'", is(w2, 200) && /Already in/i.test(String(w2.body?._server_messages ?? "")), "200 + msgprint", { status: w2.status, msg: /Already in/i.test(String(w2.body?._server_messages ?? "")) });
      const owners = () => getdoc(ctx.as("manager"), "SFUI Test Parent", d.name).then((g) => (g.body?.docinfo?.assignments ?? []).map((a) => a.owner).sort());
      const w3 = await add("writer", acc.restricted);
      ctx.check("writer (no share right) assigning a user without read → 403, nothing assigned", is(w3, 403, "PermissionError") && !(await owners()).includes(acc.restricted), "403, no ToDo", { status: w3.status, exc_type: w3.exc_type });
      const m3 = await add("manager", acc.restricted);
      ctx.check("manager (share right) assigning a user without read → 200 + shared", is(m3, 200) && /Shared with/i.test(String(m3.body?._server_messages ?? "")), "200 + 'Shared with…'", { status: m3.status, exc_type: m3.exc_type });
      const shares = (await ctx.as("manager").call("frappe.share.get_users", { doctype: "SFUI Test Parent", name: d.name })).message ?? [];
      ctx.check("restricted got a read DocShare", shares.some((s) => s.user === acc.restricted && s.read === 1), "share row for restricted", shares.map((s) => ({ read: s.read, everyone: s.everyone })));
      ctx.check("docinfo.assignments lists writer, reader, restricted", J(await owners()) === J([acc.reader, acc.restricted, acc.writer].sort()), "3 owners", (await owners()).length);
      const cl = await ctx.as("writer").call("frappe.desk.form.assign_to.close", { doctype: "SFUI Test Parent", name: d.name, assign_to: acc.reader });
      ctx.check("close by a non-assignee → 417", is(cl, 417), 417, { status: cl.status, exc_type: cl.exc_type });
      const ok = await ctx.as("reader").call("frappe.desk.form.assign_to.close", { doctype: "SFUI Test Parent", name: d.name, assign_to: acc.reader });
      ctx.check("close by the assignee → 200, gone from docinfo.assignments", is(ok, 200) && !(await owners()).includes(acc.reader), "200, reader gone", ok.status);
      const rm = await ctx.as("reader").call("frappe.desk.form.assign_to.remove", { doctype: "SFUI Test Parent", name: d.name, assign_to: acc.writer });
      ctx.record("reader removes writer's assignment (server checks read only; Desk's UI gates it on write)", { status: rm.status, exc_type: rm.exc_type, writer_still_assigned: (await owners()).includes(acc.writer) });
    } },
  { id: "F-SB-ATTACH-1", area: "Form", feature: "P36b — Form Sidebar Attachments: upload, Library, Link, max_attachments, remove", kind: "reject", automated: "api", users: ["writer", "reader", "manager"],
    rows: [],
    pre: "SFUI Test Parent has max_attachments 3; two fresh drafts by writer (P receives the attachments, L is the library source)", steps: ["writer: upload_file (multipart) to L — the library source file", "writer: upload_file (multipart, is_private 1) to P", "writer: upload_file JSON {doctype, docname: P, library_file_name: <L's File>} (Library tab)", "writer: upload_file JSON {doctype, docname: P, file_url: 'https://example.com/sfui-p36b.txt', is_private: 0} (Link tab; no file part)", "writer: a 4th upload to P", "manager: getdoc P → docinfo.attachments", "reader: upload_file to P", "reader: frappe.desk.form.utils.remove_attach {fid, dt, dn} (POST) on the multipart file", "writer: remove_attach on it"],
    expect: "3 × 200 (File docs attached to P; the Library copy takes the source's is_private / file_url / file_name; the Link one is a remote file_url); the 4th → 417 AttachmentLimitReached 'Maximum Attachment Limit of 3 has been reached…'; docinfo.attachments has 3 rows (name, file_name, file_url, is_private); reader upload → 403 (write on P); reader remove → 403 (File.has_permission delete → owner or write on the attached document); writer remove → 200, 2 attachments left and an 'Attachment Removed' comment",
    cite: ["handler.py:174-263 upload_file (library_file_name :208-218, check_write_permission :220-221, 266-282)", "core/doctype/file/file.py:93-124 before_insert (validate_attachment_limit :100, 333-357)", "core/doctype/file/file.py:872-911 has_permission (owner :883-884; write on the attached document :906-907)", "core/doctype/file/file.py:183-190 on_trash ('Attachment Removed')", "desk/form/utils.py:19-23 remove_attach (DELETE / POST)", "desk/form/load.py:124 docinfo.attachments", "public/js/frappe/form/sidebar/attachments.js:30-55, 137-146, 161-174, 211-236 (Desk UI)"],
    evidence: "statuses / exc_type, File names, docinfo.attachments shape before / after",
    async run(ctx) {
      const w = ctx.as("writer");
      const P = (await newParent(ctx, "writer", { title: "sb-attach" }))?.name, L = (await newParent(ctx, "writer", { title: "sb-attach-lib" }))?.name;
      if (!P || !L) return;
      const file = (who, dn, i) => ctx.as(who).upload({ doctype: "SFUI Test Parent", docname: dn, is_private: "1", filename: `sfui-p36b-${i}.txt`, content: `SFUI P36b synthetic ${i}` });
      const src = await file("writer", L, "lib");
      const a = await file("writer", P, 1);
      ctx.check("multipart upload → 200", a.status === 200 && !!a.message?.name, 200, a.status);
      const b = await w.call("upload_file", { doctype: "SFUI Test Parent", docname: P, library_file_name: src.message?.name });
      ctx.check("Library (library_file_name) → 200", b.status === 200 && !!b.message?.name, 200, { status: b.status, exc_type: b.exc_type });
      const c = await w.call("upload_file", { doctype: "SFUI Test Parent", docname: P, file_url: "https://example.com/sfui-p36b.txt", is_private: 0 });
      ctx.check("Link (file_url, no file part) → 200", c.status === 200 && !!c.message?.name, 200, { status: c.status, exc_type: c.exc_type });
      const d = await file("writer", P, 4);
      ctx.check("4th attachment → 417 AttachmentLimitReached", d.status === 417, 417, { status: d.status, exc_type: d.exc_type });
      const atts = async () => (await getdoc(ctx.as("manager"), "SFUI Test Parent", P)).body?.docinfo?.attachments ?? [];
      const before = await atts();
      ctx.check("docinfo.attachments: 3 rows", before.length === 3, 3, before.length);
      const ru = await file("reader", P, 5);
      ctx.check("reader upload → 403", ru.status === 403, 403, { status: ru.status, exc_type: ru.exc_type });
      const rr = await ctx.as("reader").call("frappe.desk.form.utils.remove_attach", { fid: a.message?.name, dt: "SFUI Test Parent", dn: P });
      ctx.check("reader remove → 403", is(rr, 403, "PermissionError"), 403, { status: rr.status, exc_type: rr.exc_type });
      const wr = await w.call("frappe.desk.form.utils.remove_attach", { fid: a.message?.name, dt: "SFUI Test Parent", dn: P });
      ctx.check("writer (owner) remove → 200, 2 left", is(wr, 200) && (await atts()).length === 2, "200, 2 left", wr.status);
    } },
  { id: "F-SB-ATTACH-2", area: "Form", feature: "P36b — protect_attached_files: remove on draft / submitted / cancelled", kind: "write", automated: "api", users: ["manager", "writer"],
    rows: [],
    pre: "**needs `protect_attached_files = 1` on SFUI Test Parent** (Customize Form / Property Setter — the staging seed does not set it; without it the test is BLOCKED); fresh documents by manager", steps: ["manager: getdoctype SFUI Test Parent → protect_attached_files (BLOCK if 0)", "manager: draft D with one attachment → writer remove_attach (write on D)", "manager: submitted S with one attachment → manager remove_attach", "manager: cancelled C (submit, attach, cancel) → writer remove_attach (no delete right), manager remove_attach (delete right)"],
    expect: "draft: removed (200); submitted: 417 'This file is attached to a protected document and cannot be deleted.' (title 'Protected File'); cancelled: writer 417, manager 200 (delete permission on the document). Desk hides × in the same cases (attachments.js:161-174)",
    cite: ["core/doctype/file/file.py:510-538 validate_protected_file", "core/doctype/file/file.py:183-190 on_trash", "public/js/frappe/form/sidebar/attachments.js:161-174 can_delete_attachment (Desk UI)"],
    evidence: "the meta flag, statuses / exc_type per case",
    async run(ctx) {
      const m = ctx.as("manager");
      const meta = await m.call("frappe.desk.form.load.getdoctype", { doctype: "SFUI Test Parent" }, "GET");
      const flag = (meta.body?.docs ?? []).find((x) => x.name === "SFUI Test Parent")?.protect_attached_files;
      ctx.record("protect_attached_files", { value: flag ?? 0 });
      if (!flag) return ctx.block("SFUI Test Parent has protect_attached_files = 0 (owner: set it on the staging site, then re-run)");
      const attach = (dn, i) => m.upload({ doctype: "SFUI Test Parent", docname: dn, is_private: "1", filename: `sfui-p36b-protect-${i}.txt`, content: `SFUI P36b protect ${i}` });
      const remove = (who, f, dn) => ctx.as(who).call("frappe.desk.form.utils.remove_attach", { fid: f, dt: "SFUI Test Parent", dn });
      const D = await newParent(ctx, "manager", { title: "protect-draft" });
      const fd = (await attach(D?.name, 1)).message?.name;
      const rd = await remove("writer", fd, D?.name);
      ctx.check("draft: writer removes → 200", is(rd, 200), 200, { status: rd.status, exc_type: rd.exc_type });
      const S = docOf(await savedocs(m, (await newParent(ctx, "manager", { title: "protect-sub" })) ?? {}, "Submit"));
      const fs = (await attach(S?.name, 2)).message?.name;
      const rs = await remove("manager", fs, S?.name);
      ctx.check("submitted: refused (417 Protected File)", is(rs, 417), 417, { status: rs.status, exc_type: rs.exc_type });
      const C0 = docOf(await savedocs(m, (await newParent(ctx, "manager", { title: "protect-cancel" })) ?? {}, "Submit"));
      const fc = (await attach(C0?.name, 3)).message?.name;
      await m.call("frappe.desk.form.save.cancel", { doctype: "SFUI Test Parent", name: C0?.name });
      const rw = await remove("writer", fc, C0?.name);
      ctx.check("cancelled: writer (no delete) refused (417)", is(rw, 417), 417, { status: rw.status, exc_type: rw.exc_type });
      const rm = await remove("manager", fc, C0?.name);
      ctx.check("cancelled: manager (delete) removes → 200", is(rm, 200), 200, { status: rm.status, exc_type: rm.exc_type });
    } },
  // P36b mid-batch attachimage — Desk's Attach / Attach Image control (FrappeAttachField). Simulator-only in the package;
  // these confirm the server half. The runner's `upload` helper sends a text/plain part with doctype / docname / is_private
  // only (run-matrix.mjs:132-137), so `fieldname` goes through the JSON form (`file_url`, app.py:302-314) and Optimize is manual.
  { id: "F-ATTIMG-1", area: "Form", feature: "P36b — Attach Image upload with Optimize (server optimize_image)", kind: "infra", automated: "manual",
    infra: "a multipart upload of a real image with the `optimize` field — run-matrix.mjs's upload helper sends only a text/plain part with doctype / docname / is_private (run-matrix.mjs:132-137); use the package Showcase or a harness page pointed at staging, Desk itself, or extend the helper",
    users: ["writer", "manager"],
    rows: ["FV.A21"],
    pre: "a fresh draft SFUI Test Parent P by writer; a JPEG of > 200 KB and about 2000 × 1500 px, and an SVG", steps: ["writer: upload_file multipart {file: the large JPEG, is_private 1, folder 'Home', doctype 'SFUI Test Parent', docname P, fieldname 'attach_image', optimize 'true'} — what FrappeAttachField sends with the row's Optimize on (the default above 200 KB)", "writer: the same JPEG without `optimize`", "writer: the SVG with `optimize`", "writer: savedocs P with attach_image = the first file_url", "manager: frappe.client.get_value File (file_size, attached_to_field) for the three Files; download them and read the image dimensions"],
    expect: "all 200; the optimized JPEG is smaller (file_size) and fits min(1024, 0.8 × width) × min(768, 0.8 × height), never below 200 px, same format, quality 85; the copy without `optimize` keeps the original bytes; the SVG is stored unchanged; attached_to_field = 'attach_image'. Any non-empty `optimize` value is truthy on the server — the package sends the field only when the switch is on (as Desk)",
    cite: ["handler.py:205 (optimize read), :223-235 (optimize_image only for an image/* file part; max_width / max_height :231-234)", "utils/image.py:45-72 optimize_image (SVG returned as is :46-47; bounds :53-54; quality 85 :45; kept only if smaller :69)", "public/js/frappe/file_uploader/FileUploader.vue:428-434 (default on above 200 KB, never SVG), :693-695 (multipart optimize)", "handler.py:251-263 File insert (attached_to_field = fieldname :256)"],
    evidence: "statuses, file_size and image dimensions before / after (images not stored in the results)" },
  { id: "F-ATTIMG-2", area: "Form", feature: "P36b — Attach Clear: remove_attach, then save the emptied field", kind: "write", automated: "api", users: ["writer", "reader", "manager"],
    rows: ["FV.A20", "FV.A21"],
    pre: "a fresh draft SFUI Test Parent P by writer", steps: ["writer: upload_file (multipart, is_private 1) to P", "writer: savedocs Save of P with attach = the File's file_url (what the package does after an upload, attach.js:137-144)", "manager: getdoc P → docinfo.attachments (the package finds the File id by file_url, attachments.js:199-207)", "reader: remove_attach {fid, dt, dn} (POST)", "writer: remove_attach {fid, dt, dn} (POST)", "writer: savedocs Save of the returned P with attach = null (attach.js:36-46)", "manager: getdoc P"],
    expect: "upload 200; save 200 with attach = file_url; docinfo.attachments has a row with that file_url and the File's name; reader remove → 403 (File has_permission delete: owner or write on the document); writer remove → 200; save 200 with attach empty; docinfo.attachments no longer lists the File and an 'Attachment Removed' comment exists",
    cite: ["public/js/frappe/form/controls/attach.js:36-55 (Clear → remove_attachment_by_filename → save), :137-144 (save after upload)", "public/js/frappe/form/sidebar/attachments.js:199-236 remove_attachment_by_filename / remove_attach", "desk/form/utils.py:19-23 remove_attach", "core/doctype/file/file.py:183-190 on_trash ('Attachment Removed'), :872-911 has_permission", "desk/form/load.py:124 docinfo.attachments"],
    evidence: "statuses / exc_type, the attach value after each save, docinfo.attachments before / after",
    async run(ctx) {
      const w = ctx.as("writer");
      const d = await newParent(ctx, "writer", { title: "attimg-clear" });
      if (!d) return;
      const up = await w.upload({ doctype: "SFUI Test Parent", docname: d.name, is_private: "1", filename: "sfui-p36b-attimg-clear.txt", content: "SFUI P36b attach clear" });
      const fid = up.message?.name, url = up.message?.file_url;
      ctx.check("upload → 200", up.status === 200 && !!fid, 200, { status: up.status, exc_type: up.exc_type });
      if (!fid) return;
      const s1 = await savedocs(w, { ...d, attach: url });
      ctx.check("save after upload → 200, attach = file_url", is(s1, 200) && docOf(s1)?.attach === url, url, { status: s1.status, attach: docOf(s1)?.attach });
      const atts = async () => (await getdoc(ctx.as("manager"), "SFUI Test Parent", d.name)).body?.docinfo?.attachments ?? [];
      ctx.check("docinfo.attachments lists the File by file_url", (await atts()).some((a) => a.name === fid && a.file_url === url), fid, (await atts()).map((a) => a.name));
      const rr = await ctx.as("reader").call("frappe.desk.form.utils.remove_attach", { fid, dt: "SFUI Test Parent", dn: d.name });
      ctx.check("reader remove_attach → 403", is(rr, 403), 403, { status: rr.status, exc_type: rr.exc_type });
      const wr = await w.call("frappe.desk.form.utils.remove_attach", { fid, dt: "SFUI Test Parent", dn: d.name });
      ctx.check("writer remove_attach → 200", is(wr, 200), 200, { status: wr.status, exc_type: wr.exc_type });
      const s2 = await savedocs(w, { ...(docOf(s1) ?? d), attach: null });
      ctx.check("save after Clear → 200, attach empty", is(s2, 200) && !docOf(s2)?.attach, "empty", { status: s2.status, attach: docOf(s2)?.attach ?? null });
      const after = await getdoc(ctx.as("manager"), "SFUI Test Parent", d.name);
      ctx.check("File gone from docinfo.attachments", !(after.body?.docinfo?.attachments ?? []).some((a) => a.name === fid), "absent", (after.body?.docinfo?.attachments ?? []).map((a) => a.name));
      ctx.record("Attachment Removed comment", { present: (after.body?.docinfo?.comments ?? []).some((c) => /Attachment Removed/i.test(`${c.comment_type ?? ""} ${c.content ?? ""}`)) });
    } },
  { id: "F-ATTIMG-3", area: "Form", feature: "P36b — upload on a new document (new-… name) and the relink on savedocs", kind: "write", automated: "api", users: ["writer", "reader"],
    rows: ["FV.A20", "FV.A21"],
    pre: "none (the test names its own unsaved document new-sfui-test-parent-…)", steps: ["writer: upload_file JSON {doctype 'SFUI Test Parent', docname N = 'new-sfui-test-parent-<random>', fieldname 'attach_image', file_url U (unique https URL), is_private 0, folder 'Home'} — FrappeAttachField's request for an unsaved document (Link source; a file part is the same for the server)", "writer: the same with no fieldname and another URL U2 (a File not owned by an Attach field)", "reader: upload_file JSON with docname 'new-sfui-test-parent-<other>'", "writer: savedocs Save {doctype, name N, __islocal 1, attach_image U, …}", "writer: frappe.client.get_value File (attached_to_name, attached_to_field) for both Files"],
    expect: "writer uploads 200 (check_write_permission: a missing document → write on a new doc of the DocType); reader → 403; savedocs 200 → name P; the attach_image File now has attached_to_name = P (relinked: same file_url, attached_to_field, created in the last 60 min); the File without fieldname stays on N (orphan) — relinking covers Attach / Attach Image fields only",
    cite: ["handler.py:266-282 check_write_permission (new_doc(doctype).check_permission('write') :279)", "handler.py:251-263 File insert (attached_to_name = the new-… name, attached_to_field :256)", "desk/form/save.py:20-22 savedocs keeps __temporary_name for 'new-<doctype slug>'", "model/document.py:333 relink_mismatched_files on insert", "core/doctype/file/utils.py:377-419 relink_files (60-minute window :395) / relink_mismatched_files", "public/js/frappe/form/controls/attach.js:80-87 (doctype / docname / fieldname from frm, also for a new doc)"],
    evidence: "statuses / exc_type, attached_to_name of both Files before / after the insert",
    async run(ctx) {
      const w = ctx.as("writer");
      const rnd = () => Math.random().toString(36).slice(2, 8);
      const N = `new-sfui-test-parent-${rnd()}`, U = `https://example.com/sfui-p36b-relink-${rnd()}.png`, U2 = `https://example.com/sfui-p36b-orphan-${rnd()}.png`;
      const a = await w.call("upload_file", { doctype: "SFUI Test Parent", docname: N, fieldname: "attach_image", file_url: U, is_private: 0, folder: "Home" });
      ctx.check("writer upload to a new-… name → 200", a.status === 200 && !!a.message?.name, 200, { status: a.status, exc_type: a.exc_type });
      const b = await w.call("upload_file", { doctype: "SFUI Test Parent", docname: N, file_url: U2, is_private: 0, folder: "Home" });
      const r = await ctx.as("reader").call("upload_file", { doctype: "SFUI Test Parent", docname: `new-sfui-test-parent-${rnd()}`, fieldname: "attach_image", file_url: `https://example.com/sfui-p36b-reader-${rnd()}.png`, is_private: 0 });
      ctx.check("reader upload to a new-… name → 403", is(r, 403), 403, { status: r.status, exc_type: r.exc_type });
      if (!a.message?.name) return;
      const s = await savedocs(w, parentDoc(ctx.X, { name: N, title: `${ctx.tag} attimg-relink`, attach_image: U }));
      const P = docOf(s)?.name;
      ctx.check("savedocs insert → 200", is(s, 200) && !!P, 200, { status: s.status, exc_type: s.exc_type });
      const file = async (name) => (await w.call("frappe.client.get_value", { doctype: "File", fieldname: J(["attached_to_name", "attached_to_field"]), filters: J({ name }) })).message ?? {};
      const fa = await file(a.message.name);
      ctx.check("the attach_image File is relinked to the saved name", !!P && fa.attached_to_name === P && fa.attached_to_field === "attach_image", P, fa);
      if (b.message?.name) { const fb = await file(b.message.name); ctx.check("a File without fieldname stays on the new-… name", fb.attached_to_name === N, N, fb); }
    } },
  { id: "F-ATTIMG-4", area: "Form", feature: "P36b — max_file_size: the site's limit and the refusal of a larger upload", kind: "reject", automated: "api", users: ["writer", "manager"],
    rows: ["FV.A20", "FV.A21"],
    pre: "a fresh draft SFUI Test Parent P by writer; the site's limit must be ≤ 30 MiB (else BLOCKED: the runner will not send more)", steps: ["writer: GET frappe.core.api.file.get_max_file_size (the package asks on every uploader opening, as FileUploader.vue:352-356)", "writer: upload_file (multipart) of limit + 1 bytes to P", "writer: upload_file of 1 KiB to P (control)", "manager: getdoc P → docinfo.attachments"],
    expect: "get_max_file_size = System Settings max_file_size (MB) × 1048576, else site_config max_file_size, else 25 MiB; the larger upload → 413 (Werkzeug: request.max_content_length = get_max_file_size() for /api/method/upload_file, so the body is refused before the handler; a front proxy with a smaller client_max_body_size also answers 413 — recorded) and no File is created; File.check_max_file_size (417 MaxFileSizeReachedError) is the second line, reached only when the body fits; the 1 KiB upload → 200. The package, like Desk, skips a file of size ≥ limit client-side (`size < max`) and never sends it",
    cite: ["core/api/file.py:85-91 get_max_file_size", "app.py:197-200 request.max_content_length for upload_file", "core/doctype/file/file.py:711, 757-767 check_max_file_size (MaxFileSizeReachedError, a ValidationError → 417)", "public/js/frappe/file_uploader/FileUploader.vue:352-356, 491-492 (client check size < max_file_size), :619-653 (413 message)"],
    evidence: "the limit (bytes), statuses / exc_type / content type of the refusal, docinfo.attachments count",
    async run(ctx) {
      const w = ctx.as("writer");
      const lim = await w.call("frappe.core.api.file.get_max_file_size", {}, "GET");
      const max = Number(lim.message);
      ctx.record("max_file_size (bytes)", { status: lim.status, value: lim.message });
      ctx.check("get_max_file_size → 200, a positive number", lim.status === 200 && max > 0, "> 0", lim.message);
      if (!(max > 0)) return;
      if (max > 30 * 1024 * 1024) return ctx.block(`the site's max_file_size is ${max} bytes (> 30 MiB): the runner does not send a larger body`);
      const d = await newParent(ctx, "writer", { title: "attimg-size" });
      if (!d) return;
      const big = await w.upload({ doctype: "SFUI Test Parent", docname: d.name, is_private: "1", filename: "sfui-p36b-attimg-big.txt", content: "x".repeat(max + 1) });
      ctx.record("refusal", { status: big.status, exc_type: big.exc_type, content_type: big.contentType });
      ctx.check("limit + 1 bytes refused (413, or 417 MaxFileSizeReachedError)", big.status === 413 || is(big, 417, "MaxFileSizeReachedError"), "413", { status: big.status, exc_type: big.exc_type });
      const small = await w.upload({ doctype: "SFUI Test Parent", docname: d.name, is_private: "1", filename: "sfui-p36b-attimg-small.txt", content: "x".repeat(1024) });
      ctx.check("1 KiB upload → 200", small.status === 200, 200, { status: small.status, exc_type: small.exc_type });
      const atts = (await getdoc(ctx.as("manager"), "SFUI Test Parent", d.name)).body?.docinfo?.attachments ?? [];
      ctx.check("only the small File is attached", atts.length === 1, 1, atts.map((a) => a.file_name));
    } },
  { id: "F-ATTIMG-5", area: "Form", feature: "P36b — private by default: is_private as sent, make_attachments_public", kind: "write", automated: "api", users: ["manager", "writer"],
    rows: ["FV.A20", "FV.A21"],
    pre: "a fresh draft SFUI Test Parent P by writer", steps: ["manager: getdoctype SFUI Test Parent → make_attachments_public (the package's default switch = private unless the DocType or the field's make_attachment_public says public)", "writer: upload_file (multipart) to P with is_private 1 (the default the package sends)", "writer: upload_file to P with is_private 0 (switch turned off)"],
    expect: "make_attachments_public is 0 / unset on SFUI Test Parent (so the package starts each file private); is_private 1 → File.is_private 1 and file_url under /private/files/; is_private 0 → is_private 0 and /files/. The server stores `cint(is_private)`: a client that omits the field gets a PUBLIC file — the private default is the client's job (Desk: `private = !make_attachments_public`)",
    cite: ["public/js/frappe/form/controls/attach.js:84-86 (make_attachments_public from the field or the DocType)", "public/js/frappe/file_uploader/FileUploader.vue:443 (private: !make_attachments_public)", "handler.py:197, 260 (is_private = cint(form_dict.is_private))", "core/doctype/file/file.py:811-813 set_is_private (from a /private file_url)"],
    evidence: "the meta flag, is_private and the file_url prefix of both Files",
    async run(ctx) {
      const meta = await ctx.as("manager").call("frappe.desk.form.load.getdoctype", { doctype: "SFUI Test Parent" }, "GET");
      const flag = (meta.body?.docs ?? []).find((x) => x.name === "SFUI Test Parent")?.make_attachments_public ?? 0;
      ctx.check("make_attachments_public is off (the package's default is private)", !Number(flag), 0, flag);
      const d = await newParent(ctx, "writer", { title: "attimg-private" });
      if (!d) return;
      const up = (p, i) => ctx.as("writer").upload({ doctype: "SFUI Test Parent", docname: d.name, is_private: p, filename: `sfui-p36b-attimg-priv-${i}.txt`, content: `SFUI P36b private ${i}` });
      const a = await up("1", 1), b = await up("0", 2);
      ctx.check("is_private 1 → private File under /private/files/", a.status === 200 && Number(a.message?.is_private) === 1 && String(a.message?.file_url ?? "").startsWith("/private/files/"), "/private/files/…", { status: a.status, is_private: a.message?.is_private, file_url: a.message?.file_url });
      ctx.check("is_private 0 → public File under /files/", b.status === 200 && !Number(b.message?.is_private) && String(b.message?.file_url ?? "").startsWith("/files/"), "/files/…", { status: b.status, is_private: b.message?.is_private, file_url: b.message?.file_url });
    } },
  { id: "F-SB-TAGS-1", area: "Form", feature: "P36b — Form Sidebar Tags: add_tag / remove_tag / get_tags; write refusal rolls back", kind: "reject", automated: "api", users: ["writer", "reader", "manager"],
    rows: [],
    pre: "a fresh draft by writer", steps: ["writer: frappe.desk.doctype.tag.tag.add_tag {tag: 'sfui-p36b', dt, dn}", "writer: get_tags {doctype, txt: 'sfui-p3'}", "manager: getdoc → _user_tags, modified, docinfo.tags", "reader: add_tag {tag: 'sfui-p36b-reader', dt, dn}", "reader: remove_tag {tag: 'sfui-p36b', dt, dn}", "writer: remove_tag {tag: 'sfui-p36b', dt, dn}"],
    expect: "writer add → 200 (returns the tag); get_tags lists 'sfui-p36b' (Tag list, txt matched case-insensitively); _user_tags contains it, `modified` unchanged (set_value update_modified=False), docinfo.tags contains it; reader add → 403 PermissionError (update_tags checks write AFTER _user_tags was set — the request rolls back, so _user_tags is unchanged); reader remove → 403, tag kept; writer remove → 200, tag gone",
    cite: ["desk/doctype/tag/tag.py:34-39 add_tag, :52-55 remove_tag, :65-70 get_tags", "desk/doctype/tag/tag.py:87-99 DocTags.add / remove, :105-126 update (set_value :114, update_tags :116, re-raise :125-126)", "desk/doctype/tag/tag.py:147-152 update_tags (check_permission write)", "desk/form/load.py:136, 387-395 docinfo.tags", "public/js/frappe/ui/tag_editor.js:35-63, 84-101 (Desk UI, no client gate)"],
    evidence: "statuses / exc_type, _user_tags and modified before / after each step",
    async run(ctx) {
      const d = await newParent(ctx, "writer", { title: "sb-tags" });
      if (!d) return;
      const ref = { dt: "SFUI Test Parent", dn: d.name };
      const read = async () => { const g = await getdoc(ctx.as("manager"), "SFUI Test Parent", d.name); return { tags: docOf(g)?._user_tags ?? "", modified: docOf(g)?.modified, info: g.body?.docinfo?.tags ?? "" }; };
      const before = await read();
      const a = await ctx.as("writer").call("frappe.desk.doctype.tag.tag.add_tag", { tag: "sfui-p36b", ...ref });
      const after = await read();
      ctx.check("writer add_tag → 200, tag stored, modified unchanged", is(a, 200) && after.tags.includes("sfui-p36b") && after.modified === before.modified, "200, stored, same modified", { status: a.status, stored: after.tags.includes("sfui-p36b"), sameModified: after.modified === before.modified });
      ctx.check("docinfo.tags carries it", String(after.info).includes("sfui-p36b"), "sfui-p36b", after.info);
      const s = await ctx.as("writer").call("frappe.desk.doctype.tag.tag.get_tags", { doctype: "SFUI Test Parent", txt: "sfui-p3" });
      ctx.check("get_tags suggests it", (s.message ?? []).includes("sfui-p36b"), "includes sfui-p36b", s.message);
      const r = await ctx.as("reader").call("frappe.desk.doctype.tag.tag.add_tag", { tag: "sfui-p36b-reader", ...ref });
      const afterR = await read();
      ctx.check("reader add_tag → 403 and _user_tags unchanged (rollback)", is(r, 403, "PermissionError") && afterR.tags === after.tags, "403, unchanged", { status: r.status, exc_type: r.exc_type, unchanged: afterR.tags === after.tags });
      const rr = await ctx.as("reader").call("frappe.desk.doctype.tag.tag.remove_tag", { tag: "sfui-p36b", ...ref });
      ctx.check("reader remove_tag → 403, tag kept", is(rr, 403, "PermissionError") && (await read()).tags.includes("sfui-p36b"), "403, kept", { status: rr.status, exc_type: rr.exc_type });
      const wr = await ctx.as("writer").call("frappe.desk.doctype.tag.tag.remove_tag", { tag: "sfui-p36b", ...ref });
      ctx.check("writer remove_tag → 200, tag gone", is(wr, 200) && !(await read()).tags.includes("sfui-p36b"), "200, gone", wr.status);
    } },
  { id: "S-SHARE-1", area: "Security", feature: "P36b — Share: get_users, add, set_permission per level, cascade, refusal without the share right", kind: "reject", automated: "api", users: ["manager", "writer", "reader", "restricted"],
    rows: [],
    pre: "a fresh draft by manager linked to contact #12 (restricted cannot read it); only SFUI Manager holds `share` on SFUI Test Parent and SFUI Test Contact; document sharing not disabled on the site", steps: ["manager: frappe.share.get_users {doctype, name}", "writer: frappe.share.add {…, user: reader} (no share right)", "manager: set_permission {…, user: reader, permission_to: 'share', value: 1} (reader gets share only)", "reader: add {…, user: restricted, write: 1} (reader holds no write)", "reader: add {…, user: restricted, read: 1}", "restricted: getdoc of the document", "manager: set_permission {…, user: reader, permission_to: 'submit', value: 1}", "reader: savedocs Save of the document (write through the share)", "manager: set_permission {…, user: reader, permission_to: 'read', value: 0}; the same for restricted", "manager: set_permission on SFUI Test Contact #12 {user: reader, permission_to: 'submit', value: 1}"],
    expect: "get_users → 200, a list (fields name, user, read, write, submit, share, everyone, owner, creation); writer add → 403 'No permission to share'; reader's share row = share 1 + read 1 (cascade); reader granting write → 403 'You cannot share `write` …'; reader granting read → 200 (read forced 1); restricted getdoc → 200 (DocShare grants read despite its User Permissions); submit → the row has submit 1, write 1, read 1 (cascade); reader's Save → 200; un-ticking read deletes the row (response WITHOUT `message`) and writes 'Unshared'; submit on the non-submittable Contact → refused (403: the sharer holds no submit there; Administrator would get 417 'not submittable')",
    cite: ["share.py:20-33 add → add_docshare :36-72 (read forced :43-49, check_share_permission :51-52)", "share.py:82-122 set_permission (un-set read clears all :113-114; row deleted → None :118-120)", "share.py:125-152 get_users ([] without read)", "share.py:216-244 check_share_permission (share right :223-226; grant only held rights :233-244)", "core/doctype/docshare/docshare.py:33-69 validate (cascade :40-44, submittable :63-69), :71-91 Shared / Unshared comments", "public/js/frappe/form/sidebar/share.js:12-202 (Desk UI)"],
    evidence: "statuses / exc_type, DocShare rows (rights only) after each step, presence of `message`",
    async run(ctx) {
      const m = ctx.as("manager");
      const d = await newParent(ctx, "manager", { title: "share" });
      if (!d) return;
      const acc = ctx.X.accounts, ref = { doctype: "SFUI Test Parent", name: d.name };
      const rows = async () => (await m.call("frappe.share.get_users", ref)).message ?? [];
      const rowOf = async (u) => (await rows()).find((s) => s.user === u);
      const g = await m.call("frappe.share.get_users", ref);
      ctx.check("get_users → 200 list", is(g, 200) && Array.isArray(g.message), "array", typeof g.message);
      const wa = await ctx.as("writer").call("frappe.share.add", { ...ref, user: acc.reader });
      ctx.check("writer (no share right) → 403", is(wa, 403, "PermissionError"), 403, { status: wa.status, exc_type: wa.exc_type });
      const ms = await m.call("frappe.share.set_permission", { ...ref, user: acc.reader, permission_to: "share", value: 1 });
      const r1 = await rowOf(acc.reader);
      ctx.check("share only → share 1 + read 1 (cascade)", is(ms, 200) && r1?.share === 1 && r1?.read === 1 && !r1?.write, "share 1, read 1, write 0", r1 && { read: r1.read, write: r1.write, share: r1.share });
      const rw = await ctx.as("reader").call("frappe.share.add", { ...ref, user: acc.restricted, write: 1 });
      ctx.check("reader cannot grant write it does not hold → 403", is(rw, 403, "PermissionError"), 403, { status: rw.status, exc_type: rw.exc_type });
      const rr = await ctx.as("reader").call("frappe.share.add", { ...ref, user: acc.restricted, read: 1 });
      ctx.check("reader grants read → 200", is(rr, 200), 200, { status: rr.status, exc_type: rr.exc_type });
      const rg = await getdoc(ctx.as("restricted"), "SFUI Test Parent", d.name);
      ctx.check("restricted can now open it (DocShare read)", is(rg, 200) && !!docOf(rg), 200, rg.status);
      await m.call("frappe.share.set_permission", { ...ref, user: acc.reader, permission_to: "submit", value: 1 });
      const r2 = await rowOf(acc.reader);
      ctx.check("submit → submit, write, read (cascade)", r2?.submit === 1 && r2?.write === 1 && r2?.read === 1, "1/1/1", r2 && { read: r2.read, write: r2.write, submit: r2.submit });
      const cur = docOf(await getdoc(ctx.as("reader"), "SFUI Test Parent", d.name));
      const sv = await savedocs(ctx.as("reader"), { ...cur, notes: `${ctx.tag} shared write` });
      ctx.check("reader saves through the shared write → 200", is(sv, 200), 200, { status: sv.status, exc_type: sv.exc_type });
      const un = await m.call("frappe.share.set_permission", { ...ref, user: acc.reader, permission_to: "read", value: 0 });
      ctx.check("un-tick read → 200, no message, row deleted", is(un, 200) && un.message == null && !(await rowOf(acc.reader)), "200, no message, gone", { status: un.status, message: un.message === undefined ? "absent" : un.message });
      await m.call("frappe.share.set_permission", { ...ref, user: acc.restricted, permission_to: "read", value: 0 });
      const cs = await m.call("frappe.share.set_permission", { doctype: "SFUI Test Contact", name: RUN_CONTACT(ctx.X), user: acc.reader, permission_to: "submit", value: 1 });
      ctx.check("submit share on a non-submittable DocType → refused", cs.status === 403 || cs.status === 417, "403 (or 417 for Administrator)", { status: cs.status, exc_type: cs.exc_type });
    } },
  { id: "F-SB-LIKE-1", area: "Form", feature: "P36b — Form Sidebar Like: toggle_like, _liked_by, Like comment, modified untouched", kind: "write", automated: "api", users: ["writer", "reader", "restricted", "manager"],
    rows: ["LV.E5"],
    pre: "a fresh draft by writer linked to contact #12 (restricted cannot read it)", steps: ["reader: frappe.desk.like.toggle_like {doctype, name, add: 'Yes'}", "manager: getdoc → _liked_by, modified, docinfo.like_logs", "reader: toggle_like {…, add: 'No'}", "restricted: toggle_like {…, add: 'Yes'} then 'No' (cannot read the document)"],
    expect: "reader like → 200, _liked_by = [reader] (JSON list), `modified` unchanged (update_modified=False), a 'Like' comment ('Liked') in docinfo.like_logs; unlike → _liked_by without reader and the Like comment deleted; restricted → RECORDED: toggle_like has no permission check, so 200 is Frappe's behaviour (a user can like a document it cannot read)",
    cite: ["desk/like.py:15-27 toggle_like (no permission check)", "desk/like.py:30-65 _toggle_like (set_value update_modified=False :55-58)", "desk/like.py:68-91 remove_like / add_comment", "desk/form/load.py:146-180 add_comments (like_logs)", "public/js/frappe/form/sidebar/form_sidebar.js:51-61, 237-251; public/js/frappe/ui/like.js:12-57 (Desk UI)"],
    evidence: "statuses, _liked_by membership (redacted to booleans), modified before / after, like_logs count",
    async run(ctx) {
      const d = await newParent(ctx, "writer", { title: "sb-like" });
      if (!d) return;
      const acc = ctx.X.accounts, ref = { doctype: "SFUI Test Parent", name: d.name };
      const read = async () => { const g = await getdoc(ctx.as("manager"), "SFUI Test Parent", d.name); const doc = docOf(g); return { liked: JSON.parse(doc?._liked_by || "[]"), modified: doc?.modified, likes: (g.body?.docinfo?.like_logs ?? []).length }; };
      const before = await read();
      const a = await ctx.as("reader").call("frappe.desk.like.toggle_like", { ...ref, add: "Yes" });
      const after = await read();
      ctx.check("like → 200, reader in _liked_by, modified unchanged, a Like comment", is(a, 200) && after.liked.includes(acc.reader) && after.modified === before.modified && after.likes === before.likes + 1, "liked, same modified, +1 like_log", { status: a.status, liked: after.liked.includes(acc.reader), sameModified: after.modified === before.modified, likeLogs: after.likes - before.likes });
      const b = await ctx.as("reader").call("frappe.desk.like.toggle_like", { ...ref, add: "No" });
      const un = await read();
      ctx.check("unlike → 200, removed, Like comment deleted", is(b, 200) && !un.liked.includes(acc.reader) && un.likes === before.likes, "removed", { status: b.status, liked: un.liked.includes(acc.reader), likeLogs: un.likes - before.likes });
      const x = await ctx.as("restricted").call("frappe.desk.like.toggle_like", { ...ref, add: "Yes" });
      const y = await ctx.as("restricted").call("frappe.desk.like.toggle_like", { ...ref, add: "No" });
      ctx.record("restricted likes a document it cannot read (no permission check in toggle_like)", { like: x.status, unlike: y.status });
    } },
  { id: "F-SB-COMMENT-1", area: "Form", feature: "P36b — Comments: add, edit, publish, delete, @mention notification", kind: "reject", automated: "api", users: ["writer", "reader", "restricted", "manager", "sysmgr"],
    rows: [],
    pre: "a fresh draft by writer linked to contact #12 (restricted cannot read it); the Mention notification needs the site's background worker (enqueue_create_notification) — recorded, not asserted; the Delete positive needs the optional sysmgr account", steps: ["writer: frappe.desk.form.utils.add_comment {reference_doctype, reference_name, content: '<p>… <span class=\"mention\" data-id=\"<reader>\" …>@SFUI Reader</span></p>', comment_email: writer, comment_by: 'SFUI Writer'}", "restricted: add_comment on the same document", "reader: update_comment {name, content}", "writer: update_comment {name, content}", "reader: update_comment_publicity {name, publish: 1}", "writer: update_comment_publicity {name, publish: 1}; manager: getdoc → docinfo.comments", "writer, then manager: frappe.client.delete {doctype: 'Comment', name}", "sysmgr (optional): frappe.client.delete", "reader: Notification Log list (type Mention, document_name = the document) after a few seconds"],
    expect: "writer add → 200 (a Comment doc, comment_type 'Comment'); restricted → 403 (read on the reference document); reader edit → 403 'Comment can only be edited by the owner'; writer edit → 200; reader publicity → 417 (frappe.throw without an exception class = ValidationError); writer publicity → 200 and docinfo.comments has published 1; writer and manager delete → 403 (Comment DocPerm: System Manager / Website Manager only — authorship does not grant delete); sysmgr delete → 200; Mention: a Notification Log for reader (enabled System User, allowed_in_mentions) — RECORDED (depends on the worker)",
    cite: ["desk/form/utils.py:26-50 add_comment (check_permission :31-32)", "desk/form/utils.py:53-69 update_comment (owner or Administrator :58-59)", "desk/form/utils.py:72-79 update_comment_publicity (owner or System Manager :75-76)", "core/doctype/comment/comment.json (permissions: System Manager, Website Manager)", "core/doctype/comment/comment.py:58-59 after_insert → notify_mentions", "desk/notifications.py:390-440 notify_mentions / extract_mentions", "desk/doctype/notification_log/notification_log.py:73-100 enqueue_create_notification", "desk/form/load.py:146-160 add_comments (published :158)", "public/js/frappe/form/footer/form_timeline.js:607-676, 723-760 (Desk UI)"],
    evidence: "statuses / exc_type, the comment's published flag in docinfo, Notification Log count (recorded)",
    async run(ctx) {
      const d = await newParent(ctx, "writer", { title: "sb-comment" });
      if (!d) return;
      const acc = ctx.X.accounts;
      const body = (txt) => ({ reference_doctype: "SFUI Test Parent", reference_name: d.name, content: `<p>${ctx.tag} ${txt} <span class="mention" data-id="${acc.reader}" data-value="SFUI Reader" data-denotation-char="@">@SFUI Reader</span></p>`, comment_email: acc.writer, comment_by: "SFUI Writer" });
      const a = await ctx.as("writer").call("frappe.desk.form.utils.add_comment", body("comment"));
      const c = a.message?.name;
      ctx.check("writer add_comment → 200", is(a, 200) && !!c && a.message?.comment_type === "Comment", 200, { status: a.status, exc_type: a.exc_type });
      const rs = await ctx.as("restricted").call("frappe.desk.form.utils.add_comment", body("restricted"));
      ctx.check("restricted (no read) → 403", is(rs, 403, "PermissionError"), 403, { status: rs.status, exc_type: rs.exc_type });
      const re = await ctx.as("reader").call("frappe.desk.form.utils.update_comment", { name: c, content: `${ctx.tag} reader edit` });
      ctx.check("reader edits another's comment → 403", is(re, 403, "PermissionError"), 403, { status: re.status, exc_type: re.exc_type });
      const we = await ctx.as("writer").call("frappe.desk.form.utils.update_comment", { name: c, content: `${ctx.tag} edited` });
      ctx.check("author edits → 200", is(we, 200), 200, we.status);
      const rp = await ctx.as("reader").call("frappe.desk.form.utils.update_comment_publicity", { name: c, publish: 1 });
      ctx.check("reader publishes another's comment → 417", is(rp, 417), 417, { status: rp.status, exc_type: rp.exc_type });
      const wp = await ctx.as("writer").call("frappe.desk.form.utils.update_comment_publicity", { name: c, publish: 1 });
      const info = (await getdoc(ctx.as("manager"), "SFUI Test Parent", d.name)).body?.docinfo?.comments ?? [];
      ctx.check("author publishes → 200, docinfo.comments published 1", is(wp, 200) && info.find((x) => x.name === c)?.published === 1, "published 1", info.find((x) => x.name === c)?.published);
      const wd = await ctx.as("writer").call("frappe.client.delete", { doctype: "Comment", name: c });
      ctx.check("author delete → 403 (role, not authorship)", is(wd, 403, "PermissionError"), 403, { status: wd.status, exc_type: wd.exc_type });
      const md = await ctx.as("manager").call("frappe.client.delete", { doctype: "Comment", name: c });
      ctx.check("SFUI Manager delete → 403", is(md, 403, "PermissionError"), 403, { status: md.status, exc_type: md.exc_type });
      await new Promise((r) => setTimeout(r, 5000));
      const n = await ctx.as("reader").call("frappe.client.get_list", { doctype: "Notification Log", filters: J([["type", "=", "Mention"], ["document_name", "=", d.name]]), fields: J(["name"]) });
      ctx.record("Mention Notification Log for reader (needs the worker)", { status: n.status, count: (n.message ?? []).length });
      if (!ctx.has("sysmgr")) return ctx.block("no sysmgr account: the Comment delete positive is not run (seed without --with-system-manager)");
      const sd = await ctx.as("sysmgr").call("frappe.client.delete", { doctype: "Comment", name: c });
      ctx.check("System Manager delete → 200", is(sd, 200), 200, { status: sd.status, exc_type: sd.exc_type });
    } },
  { id: "S-GSEARCH-1", area: "Security", feature: "P36b — Global Search: DocType-level permission filtering, response shape, paging arguments", kind: "read", automated: "api", users: ["manager", "writer", "reader", "restricted", "sysmgr"],
    rows: [],
    pre: "seeded site; Global Search Settings as installed (SFUI DocTypes are not in it; ToDo is in Frappe's defaults and the seed's assignments create ToDos); the `__global_search` index syncs every 15 minutes, so result contents are recorded, not asserted", steps: ["each account: frappe.utils.global_search.search {text: 'sfui', start: 0, limit: 100, doctype: ''} (the dialog's first call)", "each account: the same with doctype 'SFUI Test Parent'", "reader, manager: the same with doctype 'Workflow' (System Manager-only DocType)", "reader: search {text: 'sfui', start: 0, limit: 1, doctype: ''} and {start: 1, limit: 1} (the 'More' arguments)", "reader: search {text: 'writer', …} — ToDos allocated to sfui-writer@example.com (a single alphanumeric token: in MyISAM boolean mode '-' in '+sfui-writer*' is the NOT operator)", "sysmgr (optional; recorded only): frappe.client.get Global Search Settings → allowed_in_global_search order"],
    expect: "200 for every account; every row has exactly doctype, name, content, rank (+ image only for DocTypes with an image_field); doctype 'SFUI Test Parent' → [] (not in Global Search Settings); doctype 'Workflow' → [] for reader and manager (not in get_can_read); limit 1 → at most 1 row; RECORDED: the DocTypes each account gets, and whether reader receives ToDo rows allocated to writer — Frappe filters only by DocType (Settings ∩ get_can_read), never per row, so it is expected once the index is synced",
    cite: ["utils/global_search.py:465-526 search (allowed = Settings ∩ get_can_read :482-484; per-word MATCH :486-511; DocType loop :513-524)", "utils/user.py:130-185 build_permissions (can_read incl. DocShare doctypes :175-178)", "desk/doctype/global_search_settings/global_search_settings.py:46-51 get_doctypes_for_global_search", "hooks.py:376-393 global_search_doctypes", "desk/doctype/todo/todo.json (in_global_search: status, description, allocated_to)", "public/js/frappe/ui/toolbar/search_utils.js:447-489 get_global_results; search.js:54, 164-186 (Desk UI)"],
    evidence: "statuses, row key sets, DocType sets per account (no content), counts",
    async run(ctx) {
      const q = (who, args) => ctx.as(who).call("frappe.utils.global_search.search", { text: "sfui", start: 0, limit: 100, doctype: "", ...args });
      const KEYS = ["content", "doctype", "name", "rank"];
      for (const who of ["manager", "writer", "reader", "restricted"]) {
        const r = await q(who, {});
        const rows = r.message ?? [];
        ctx.check(`${who}: 200 and Desk's row shape`, is(r, 200) && rows.every((x) => J(Object.keys(x).filter((k) => k !== "image").sort()) === J(KEYS)), "doctype, name, content, rank", { status: r.status, rows: rows.length });
        ctx.record(`${who}: DocTypes returned`, [...new Set(rows.map((x) => x.doctype))].sort());
        const p = await q(who, { doctype: "SFUI Test Parent" });
        ctx.check(`${who}: SFUI Test Parent (not in Settings) → []`, is(p, 200) && (p.message ?? []).length === 0, [], (p.message ?? []).length);
      }
      for (const who of ["reader", "manager"]) {
        const w = await q(who, { doctype: "Workflow" });
        ctx.check(`${who}: Workflow (System Manager only) → []`, is(w, 200) && (w.message ?? []).length === 0, [], (w.message ?? []).length);
      }
      const p1 = await q("reader", { limit: 1 }), p2 = await q("reader", { start: 1, limit: 1 });
      ctx.check("limit 1 → at most one row per page", (p1.message ?? []).length <= 1 && (p2.message ?? []).length <= 1, "≤ 1", [(p1.message ?? []).length, (p2.message ?? []).length]);
      const t = await q("reader", { text: "writer" }); // not "sfui-writer": '-' is MyISAM boolean NOT
      ctx.record("reader: ToDo rows allocated to writer (DocType-level filtering only)", { todo_rows: (t.message ?? []).filter((x) => x.doctype === "ToDo").length });
      if (!ctx.has("sysmgr")) return ctx.record("Global Search Settings order", "not read: no sysmgr account (seed without --with-system-manager)");
      const s = await ctx.as("sysmgr").call("frappe.client.get", { doctype: "Global Search Settings", name: "Global Search Settings" }, "GET");
      ctx.record("Global Search Settings order (idx)", (s.message?.allowed_in_global_search ?? []).map((x) => x.document_type));
    } },
  { id: "S-GSEARCH-2", area: "Security", feature: "P36b — Global Search Settings, indexing lag and the dialog's 'More' on real rows", kind: "infra", automated: "manual", infra: "a System Manager on the staging site, the scheduler running (sync_global_search every 15 min) and a Customize Form change that marks an SFUI field In Global Search — the seed creates none of these", users: ["sysmgr", "manager", "reader", "restricted"],
    rows: [],
    pre: "sysmgr: Customize Form SFUI Test Contact → contact_name In Global Search (rebuild_for_doctype is enqueued); Global Search Settings → add SFUI Test Contact (module SFUI Test, not Core); wait for sync", steps: ["sysmgr: try to add a Core-module DocType (e.g. User) and a duplicate row to Global Search Settings", "reader / restricted: search {text: 'SFUI Contact', start 0, limit 100}", "reader: 'More' — search {text, start: 20, limit: 20, doctype: 'SFUI Test Contact'}", "manager: create a contact; search for it at once, then after the next sync", "browser (optional, harness has no search bar): the package dialog over the same server — All Results (4 + More), group list (20 + More, '<N> results found')"],
    expect: "Core module → 'Core Modules … cannot be searched in Global Search.'; duplicate → 'Document Type … has been repeated.'; reader and restricted both get SFUI Test Contact rows — restricted also for contacts outside its User Permissions (no row-level filter; opening them is still 403); More returns the next page; a new contact appears only after the sync (≤ 15 min)",
    cite: ["desk/doctype/global_search_settings/global_search_settings.py:22-40 validate, :46-51 order by idx", "utils/global_search.py:233-279 update_global_search (queue), :362-413 sync_global_search, :465-526 search", "hooks.py:201-206 (sync every 15 min)", "core/doctype/doctype/doctype.py:588-602 rebuild_for_doctype", "model/meta.py:217-223 get_global_search_fields"],
    evidence: "validation messages, row counts per account (names only), timestamps of the sync" },

  // ---------------------------------------------------------------- P36c (owner decisions, 0.7.0-dev.4) ----------------
  // Server behaviour behind the P36c package changes: Image view Actions (decision 5), Assign To User Group (decision 6) and
  // the Report view's per-document de-duplication for every name-taking action (decision 3). LinkInput (decision 1) and the
  // phone Navbar (decision 2) are client-only: no real-site test. In the package these are jsdom + simulator evidence only.
  { id: "V-IMAGE-2", area: "Views", feature: "P36c — Image view Actions: rows carry docstatus, bulk Submit / Cancel on checked cards", kind: "write", automated: "api", users: ["manager"],
    rows: ["LV.H5", "LV.F8", "LV.F9"],
    pre: "SFUI Test Parent image_field = attach_image (overlay); fresh drafts A and B by manager (SFUI Manager: submit + cancel)", steps: ["manager: reportview.get with [name, title, attach_image, docstatus] filtered on A, B — what FrappeImageView requests (the package adds docstatus; Desk's image_view.js set_fields does not)", "manager: submit_cancel_or_update_docs(action='submit', [A, B]) — Actions → Submit on both cards", "manager: the same reportview.get (the reload)", "manager: action='cancel', [A]", "browser (optional, not in the harness): FrappeViews bulk on SFUI Test Parent, Image view → tick 2 cards → 'Add' gives way to Actions, the strip shows '2 items selected' + Clear → Submit → the confirmation counts 2 → cleared and reloaded"],
    expect: "the keys include attach_image and docstatus, both rows docstatus 0; submit → failed [] and both docstatus 1 on the reload; cancel [A] → failed [], A docstatus 2. Desk's Image view rows carry no docstatus (image_view.js:23-31), so its Print check (bulk_operations.js:16-40) refuses every card for a non-Administrator — the package's rows carry it (documented difference)",
    cite: ["public/js/frappe/views/image/image_view.js:6 (extends ListView), :17-21 setup_view, :23-31 set_fields (no docstatus), :113-114 card checkbox", "public/js/frappe/list/list_view.js:1855-2128 get_actions_menu_items (inherited)", "public/js/frappe/list/bulk_operations.js:16-40 (Print's docstatus check)", "desk/reportview.py:27-50 get", "desk/doctype/bulk_update/bulk_update.py:51-114 submit_cancel_or_update_docs / _bulk_action"],
    evidence: "response keys, docstatus per step, failed lists",
    async run(ctx) {
      const m = ctx.as("manager");
      const [A, B] = [await newParent(ctx, "manager", { title: "image-a" }), await newParent(ctx, "manager", { title: "image-b" })].map((d) => d?.name);
      if (!A || !B) return;
      const rows = async () => {
        const r = await m.call("frappe.desk.reportview.get", { doctype: "SFUI Test Parent", fields: J(["`tabSFUI Test Parent`.`name`", "`tabSFUI Test Parent`.`title`", "`tabSFUI Test Parent`.`attach_image`", "`tabSFUI Test Parent`.`docstatus`"]), filters: J([["name", "in", [A, B]]]), page_length: 20 });
        const keys = r.message?.keys ?? [];
        const ds = Object.fromEntries((r.message?.values ?? []).map((v) => [v[keys.indexOf("name")], v[keys.indexOf("docstatus")]]));
        return { keys, ds };
      };
      const r0 = await rows();
      ctx.check("image rows carry attach_image and docstatus", r0.keys.includes("attach_image") && r0.keys.includes("docstatus"), ["attach_image", "docstatus"], r0.keys);
      ctx.check("both drafts (docstatus 0)", r0.ds[A] === 0 && r0.ds[B] === 0, [0, 0], [r0.ds[A], r0.ds[B]]);
      const bulk = (names, action) => m.call("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", { doctype: "SFUI Test Parent", docnames: J(names), action });
      const s = await bulk([A, B], "submit");
      ctx.check("submit both cards → none failed", is(s, 200) && J(s.message) === "[]", [], s.message);
      const r1 = await rows();
      ctx.check("reload: both submitted", r1.ds[A] === 1 && r1.ds[B] === 1, [1, 1], [r1.ds[A], r1.ds[B]]);
      const c = await bulk([A], "cancel");
      const r2 = await rows();
      ctx.check("cancel one card → none failed, A cancelled", is(c, 200) && J(c.message) === "[]" && r2.ds[A] === 2, "[] + docstatus 2", { failed: c.message, docstatus: r2.ds[A] });
    } },
  { id: "F-SB-ASSIGN-2", area: "Form", feature: "P36c — Assign To User Group: group read right, members read (child get_list + limit), assign_to.add / add_multiple with the members", kind: "reject", automated: "api", users: ["sysmgr", "reader", "writer", "manager"],
    rows: ["LV.F3"],
    pre: "a System Manager account (seed with --with-system-manager: User Group create / delete = System Manager, user_group.json); the run creates one User Group named after the run tag with 5 members (manager, writer, reader, restricted, field) and deletes it at the end (the teardown does not know User Group); 2 fresh drafts A, B by writer (restricted cannot read them)", steps: ["sysmgr: frappe.client.insert User Group {name: '<tag> group', user_group_members: 5 rows}", "reader: frappe.desk.search.search_link('User Group', <tag>) — the dialog's group field", "reader: frappe.desk.reportview.get_list {doctype: 'User Group Member', parent_doctype: 'User Group', filters: {parent: group}, fields: ['user']} without a limit, then with limit 2 (Desk's frappe.db.get_list sends limit 20)", "reader: the same without parent_doctype; then with parent_doctype 'SFUI Test Parent'", "writer: assign_to.add {doctype, name: A, assign_to: the members who can read A} — the sidebar's Add to ToDo after picking the group", "writer: assign_to.add on B with every member incl. restricted (RECORDED)", "writer: assign_to.add_multiple {name: [A, B], assign_to: the readable members, bulk_assign, re_assign} — the list Actions → Assign To dialog", "sysmgr: frappe.client.delete the User Group"],
    expect: "reader (Desk User has read on User Group) finds the group and reads its 5 members; limit 2 → 2 rows (limit becomes limit_page_length, so Desk expands a group to its first 20 members); no parent_doctype → 403 (check_read_permission falls back to the child itself as the parent, a table → '… is not a valid parent DocType'); a parent without a User Group Member table → 403 (same message); add on A → 200, one open ToDo per member; add on B with restricted → expected 403 and a rollback (the automatic share runs as writer, who holds no share right — as F-SB-ASSIGN-1; recorded); add_multiple → 200, B gets the members, A's repeats answer 'Already in the following Users ToDo list'. Not producible with the seed (not run): a site that removed Desk User's read on User Group (search and members read → 403)",
    cite: ["public/js/frappe/form/sidebar/assign_to.js:142-160 user_group_list (set_value replaces the users; assign_to_me unticked)", "public/js/frappe/db.js:5-26 get_list (limit 20 when absent)", "desk/reportview.py:40-50 get_list → execute", "model/db_query.py:566-586 check_read_permission (parent_doctype, else the queried DocType itself :582)", "permissions.py:763-846 has_child_permission (invalid parent — a table, or no table of the child — :792-805; read on the parent :839-846)", "core/doctype/user_group/user_group.json (autoname Prompt; System Manager all, Desk User read)", "desk/form/assign_to.py:43-139 add, :143-151 add_multiple"],
    evidence: "member rows (user ids), statuses / exc_type, docinfo.assignments owners per document, the cleanup status",
    async run(ctx) {
      if (!ctx.has("sysmgr")) return ctx.block("no sysmgr account: User Group create / delete needs System Manager (seed without --with-system-manager)");
      const acc = ctx.X.accounts;
      const members = ["manager", "writer", "reader", "restricted", "field"].map((k) => acc[k]).filter(Boolean);
      const group = `${ctx.tag} group`;
      const ins = await ctx.as("sysmgr").call("frappe.client.insert", { doc: J({ doctype: "User Group", name: group, user_group_members: members.map((u) => ({ doctype: "User Group Member", user: u })) }) });
      ctx.check("sysmgr creates the User Group", is(ins, 200), 200, { status: ins.status, exc_type: ins.exc_type });
      if (!is(ins, 200)) return;
      try {
        const s = await ctx.as("reader").call("frappe.desk.search.search_link", { doctype: "User Group", txt: ctx.tag, page_length: 10 });
        ctx.check("reader finds the group (Desk User read)", is(s, 200) && (s.message ?? []).some((x) => x.value === group), group, (s.message ?? []).length);
        const read = (args) => ctx.as("reader").call("frappe.desk.reportview.get_list", { doctype: "User Group Member", filters: J({ parent: group }), fields: J(["user"]), ...args });
        const all = await read({ parent_doctype: "User Group" });
        ctx.check("members read with parent_doctype User Group → the 5 members", is(all, 200) && J((all.message ?? []).map((x) => x.user).sort()) === J([...members].sort()), members.length, (all.message ?? []).length);
        const two = await read({ parent_doctype: "User Group", limit: 2 });
        ctx.check("limit 2 → 2 rows (Desk's frappe.db.get_list sends limit 20)", is(two, 200) && (two.message ?? []).length === 2, 2, (two.message ?? []).length);
        const none = await read({});
        ctx.check("no parent_doctype → 403", is(none, 403, "PermissionError"), 403, { status: none.status, exc_type: none.exc_type });
        const bad = await read({ parent_doctype: "SFUI Test Parent" });
        ctx.check("a parent without a User Group Member table → 403", is(bad, 403, "PermissionError"), 403, { status: bad.status, exc_type: bad.exc_type });
        const [A, B] = [await newParent(ctx, "writer", { title: "group-a" }), await newParent(ctx, "writer", { title: "group-b" })].map((d) => d?.name);
        if (!A || !B) return;
        const owners = async (n) => ((await getdoc(ctx.as("manager"), "SFUI Test Parent", n)).body?.docinfo?.assignments ?? []).map((a) => a.owner).sort();
        const readable = members.filter((u) => u !== acc.restricted);
        const add = await ctx.as("writer").call("frappe.desk.form.assign_to.add", { doctype: "SFUI Test Parent", name: A, assign_to: J(readable), description: `${ctx.tag} user group` });
        const onA = await owners(A);
        ctx.check("add with the members who can read A → 200, one ToDo each", is(add, 200) && J(onA) === J([...readable].sort()), readable.length, onA.length);
        const withR = await ctx.as("writer").call("frappe.desk.form.assign_to.add", { doctype: "SFUI Test Parent", name: B, assign_to: J(members), description: `${ctx.tag} user group` });
        ctx.record("add on B with every member incl. restricted (no read on B; writer holds no share right)", { status: withR.status, exc_type: withR.exc_type, owners_on_B: (await owners(B)).length });
        const multi = await ctx.as("writer").call("frappe.desk.form.assign_to.add_multiple", { doctype: "SFUI Test Parent", name: J([A, B]), assign_to: J(readable), description: `${ctx.tag} user group bulk`, bulk_assign: true, re_assign: true });
        const onB = await owners(B);
        ctx.check("add_multiple [A, B] → 200, B has every readable member, A's repeats answer 'Already in'", is(multi, 200) && readable.every((u) => onB.includes(u)) && /Already in/i.test(String(multi.body?._server_messages ?? "")), "200 + B assigned + 'Already in'", { status: multi.status, owners_on_B: onB.length });
      } finally {
        const del = await ctx.as("sysmgr").call("frappe.client.delete", { doctype: "User Group", name: group });
        ctx.check("sysmgr deletes the User Group (cleanup)", is(del, 200), 200, { status: del.status, exc_type: del.exc_type });
      }
    } },
  { id: "V-REPORT-3", area: "Views", feature: "P36c — Report view de-dup: what each name-taking bulk method does with a name sent twice (Desk's per-row names)", kind: "write", automated: "api", users: ["manager"],
    rows: ["LV.F14", "LV.H1", "LV.F1", "LV.F3", "LV.F6", "LV.F10"],
    pre: "fresh drafts P and D by manager, each with 2 child rows (two Report rows per document)", steps: ["manager: submit_cancel_or_update_docs(action='update', [P, P], data {notes})", "manager: assign_to.add_multiple(name=[P, P], assign_to=[reader])", "manager: tag.add_tags(['sfui-p36c'], dt, docs=[P, P])", "manager: reportview.delete_items(items=[D, D])", "(Submit / Cancel with a repeat: V-REPORT-2. The package sends each name once for all of these — P36C.views.20–31)"],
    expect: "update [P, P] → failed [] (P saved twice; Version rows recorded); add_multiple → 200, ONE open ToDo for reader on P and the msgprint 'Already in the following Users ToDo list' for the repeat; add_tags → 200, the tag once in _user_tags; delete_items [D, D] → 200, D deleted, the repeat fails, is retried once (delete_bulk) and ends in the REALTIME msgprint 'Failed to delete 1 documents: D' — not in the HTTP answer (recorded)",
    cite: ["public/js/frappe/views/reports/report_view.js:1339-1352 get_checked_items (one name per checked row)", "desk/doctype/bulk_update/bulk_update.py:74-114 _bulk_action (update :95-98)", "desk/form/assign_to.py:43-139 add (duplicate open ToDo :69-70, :135-137), :143-151 add_multiple", "desk/doctype/tag/tag.py:43-49 add_tags, :87-94 DocTags.add (no-op when present)", "desk/reportview.py:575-615 delete_items / delete_bulk (retry :608-610, realtime msgprint :611-615)"],
    evidence: "failed lists, ToDo owners, _user_tags, getdoc status of D, Version count of P (recorded)",
    async run(ctx) {
      const m = ctx.as("manager");
      const P = (await newParent(ctx, "manager", { title: "report-dedup", items: [childRow(1), childRow(2)] }))?.name;
      const D = (await newParent(ctx, "manager", { title: "report-dedup-del", items: [childRow(1), childRow(2)] }))?.name;
      if (!P || !D) return;
      const u = await m.call("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs", { doctype: "SFUI Test Parent", docnames: J([P, P]), action: "update", data: J({ notes: `${ctx.tag} dedup` }) });
      ctx.check("update [P, P] → none failed", is(u, 200) && J(u.message) === "[]", [], u.message);
      const versions = await m.call("frappe.client.get_count", { doctype: "Version", filters: J([["ref_doctype", "=", "SFUI Test Parent"], ["docname", "=", P]]) });
      ctx.record("Version rows of P after the repeated update", { status: versions.status, count: versions.message });
      const a = await m.call("frappe.desk.form.assign_to.add_multiple", { doctype: "SFUI Test Parent", name: J([P, P]), assign_to: J([ctx.X.accounts.reader]), description: `${ctx.tag} dedup`, bulk_assign: true, re_assign: true });
      const owners = ((await getdoc(m, "SFUI Test Parent", P)).body?.docinfo?.assignments ?? []).map((x) => x.owner);
      ctx.check("add_multiple [P, P] → one ToDo + 'Already in' for the repeat", is(a, 200) && owners.filter((o) => o === ctx.X.accounts.reader).length === 1 && /Already in/i.test(String(a.body?._server_messages ?? "")), "1 ToDo + msgprint", { status: a.status, todos: owners.length });
      const t = await m.call("frappe.desk.doctype.tag.tag.add_tags", { tags: J(["sfui-p36c"]), dt: "SFUI Test Parent", docs: J([P, P]) });
      const tags = String(docOf(await getdoc(m, "SFUI Test Parent", P))?._user_tags ?? "").split(",").filter((x) => x === "sfui-p36c");
      ctx.check("add_tags [P, P] → 200, the tag once", is(t, 200) && tags.length === 1, 1, tags.length);
      const del = await m.call("frappe.desk.reportview.delete_items", { items: J([D, D]), doctype: "SFUI Test Parent" });
      const gone = await getdoc(m, "SFUI Test Parent", D);
      ctx.check("delete_items [D, D] → 200 and D deleted", is(del, 200) && gone.status === 404, "200, then getdoc 404", { status: del.status, after: gone.status });
      ctx.record("delete_items repeat: the 'Failed to delete' msgprint is realtime (not in the HTTP answer)", { server_messages_in_answer: !!del.body?._server_messages });
    } },
];

// ------------------------------------------------------------------------------------------------------------------
// Row → category. (a) unit · (b) simulator · (c) real-server write / aggregate / permission / realtime · (d) BLOCKED ·
// (e) real-site read / render, or infrastructure the seed cannot create. Rows not listed here fall back to their P35
// evidence: "simulator" anywhere → (b), else (a). N/A rows are outside the denominator.
// ------------------------------------------------------------------------------------------------------------------
const C = (sub, note) => ({ cat: "c", sub, note });
const E = (note) => ({ cat: "e", note });
export const ROW_CLASS = {
  // FORM — writes / permissions / server rules
  "FV.A20": C("W"), "FV.A21": C("W"), "FV.A43": C("W"), "FV.G10": C("W", "PARTIAL: row context tested at FrappeField level only (P36b); SFUI Test Child has no Attach field"),
  "FV.C3": C("W", "server does not enforce it; the package must"), "FV.C5": C("W", "PARTIAL"),
  "FV.D1": C("P"), "FV.D2": C("P"), "FV.D3": C("P"), "FV.D4": C("P", "PARTIAL"), "FV.D5": C("P"), "FV.D6": C("P"), "FV.D7": C("P"),
  "FV.D8": C("P", "PARTIAL"), "FV.D9": C("P"), "FV.D10": C("P"), "FV.D11": C("P"),
  "FV.E3": C("W"), "FV.F6": C("W"), "FV.F7": C("W"), "FV.F8": C("P"), "FV.G7": C("W"), "FV.G12": C("W"),
  "FV.H1": C("W"), "FV.H3": C("W"), "FV.H4": C("W"), "FV.H5": C("W"), "FV.H6": C("W"), "FV.H8": C("P"), "FV.H11": C("W"), "FV.H13": C("W"),
  "FV.I1": C("W"), "FV.I2": C("W"), "FV.I3": C("P"), "FV.I4": C("W"),
  "FV.K6": C("W"), "FV.K8": C("W"), "FV.K9": C("W"), "FV.K13": C("W"), "FV.K16": C("P"),
  "FV.M3": C("A"), "FV.M4": C("A"), "FV.M6": C("P"),
  "FV.N1": C("W"), "FV.N2": C("W"), "FV.N4": C("W"), "FV.N5": C("W"), "FV.N6": C("W"),
  "FV.O8": C("W", "needs an outgoing Email Account to a capture mailbox (manual)"), "FV.O9": C("P"),
  // FORM — real-site reads / renders / infrastructure
  "FV.F10": E("getdoc _link_titles shape"), "FV.L1": E("site print formats"), "FV.L2": E("server-rendered HTML"), "FV.L5": E("print refusals / Print Settings"),
  "FV.L6": E("server-rendered HTML"), "FV.L3": E("PARTIAL; needs the staging PDF engine"), "FV.O3": E("server Jinja"), "FV.P3": E("needs a website-generator DocType"),
  // LIST
  "LV.B6": C("A"), "LV.I9": C("A"), "LV.A10": C("P"),
  "LV.C7": C("W"), "LV.C8": C("W"), "LV.C9": C("W"), "LV.C12": C("W"),
  "LV.D6": C("A"), "LV.D7": C("A"), "LV.D11": C("A", "PARTIAL"),
  "LV.E5": C("W"), "LV.E8": C("R", "needs socket.io reachable + a socket client (manual)"),
  "LV.F1": C("W"), "LV.F3": C("W"), "LV.F4": C("W"), "LV.F5": C("W"), "LV.F6": C("W"), "LV.F7": C("W", "needs the staging PDF engine (manual)"),
  "LV.F8": C("W"), "LV.F9": C("W"), "LV.F10": C("W"), "LV.F11": C("W"), "LV.F12": C("P"), "LV.F13": C("W"), "LV.F18": C("W"),
  "LV.G1": C("W"), "LV.G3": C("W"), "LV.G8": C("W"),
  "LV.H1": C("A", "PARTIAL: child columns + inline set_value"), "LV.H2": C("W"),
  "LV.I4": C("W"), "LV.J1": C("W", "needs a background worker (manual)"), "LV.J7": C("W", "System-Manager half needs --with-system-manager"), "LV.J10": C("P"),
  "LV.F2": E("download_template on a site"), "LV.J2": E("download_template on a site"), "LV.J3": E("export_query; writes an Access Log"),
  "LV.H3": E("PARTIAL; get_events read"), "LV.H5": E("image_field column read"),
  // MISSING rows: no test until implemented; route of the evidence they would need
  "FV.G9": { cat: "a", note: "MISSING — nothing to validate until implemented" }, "FV.O5": { cat: "a", note: "MISSING — nothing to validate until implemented" },
  "LV.B15": { cat: "a", note: "MISSING" }, "LV.H4": { cat: "a", note: "MISSING" }, "LV.H7": { cat: "a", note: "MISSING" }, "LV.H8": { cat: "a", note: "MISSING" },
  "LV.E11": { cat: "b", note: "MISSING (would read _seen)" }, "LV.H6": { cat: "b", note: "MISSING (Dashboard Chart documents)" },
  "LV.H9": { cat: "b", note: "MISSING (Communication)" }, "LV.J9": { cat: "b", note: "MISSING (developer_mode)" },
};

export const CATEGORY_LABEL = {
  a: "(a) package unit tests",
  b: "(b) simulator only",
  c: "(c) needs real-server validation",
  d: "(d) BLOCKED (real-site behaviour by definition)",
  e: "(e) not validatable now — real-site read / render, or infrastructure",
  na: "N/A (outside the denominator)",
};

/** Category of a parsed COVERAGE row ({ id, now, ev }). */
export function categorize(row) {
  if (row.now === "N/A") return { cat: "na" };
  if (row.now === "BLOCKED") return { cat: "d" };
  if (ROW_CLASS[row.id]) return ROW_CLASS[row.id];
  return { cat: /simulator/.test(row.ev) ? "b" : "a" };
}

export const testsForRow = (id) => TESTS.filter((t) => t.rows.includes(id)).map((t) => t.id);

/** Parse the §4a / §4b matrices of docs/audit/p35/COVERAGE.md (ids, requirement, P35 status, evidence level). */
export function parseCoverage(markdown) {
  const out = [];
  let section = null;
  for (const line of markdown.split("\n")) {
    if (/^## 5\./.test(line)) break;
    const h = line.match(/^### ((?:FV|LV)\.[A-Z])\. (.*)$/);
    if (h) { section = `${h[1]}. ${h[2]}`; continue; }
    const m = line.match(/^\| ((?:FV|LV)\.[A-Z]\d+[a-z]?) \|/);
    if (!m || !section) continue;
    const c = line.trim().replace(/^\||\|$/g, "").split("|").map((s) => s.trim());
    out.push({ id: c[0], section, req: c[1], baseline: c[2], now: c[3].replace(/\*/g, ""), ev: c[8] ?? "", lim: c[9] ?? "" });
  }
  return out;
}

/** Row ids of COVERAGE.md §5 "Needs real-site validation" (62 rows). */
export function parseSection5(markdown) {
  const start = markdown.indexOf("## 5. Needs real-site validation");
  const end = markdown.indexOf("## 6.", start);
  return [...markdown.slice(start, end).matchAll(/^\| ((?:FV|LV)\.[A-Z]\d+[a-z]?) \|/gm)].map((m) => m[1]);
}
