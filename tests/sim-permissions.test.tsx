/**
 * SIMULATED server-side permissions (`createFixtureTransport(backend, { permissions })`, src/frappe/testing/permissions.ts).
 * Each named scenario × getdoc / lists / save / delete / field stripping / User Permissions / sharing / Administrator,
 * plus if_owner, workflow, assignment, comments and download_template. Every expectation is the simulator's
 * APPROXIMATION of Frappe 15.110 (rules cited in permissions.ts) — Simulated & tested, never verified against a site.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient, FrappeError, withFrappeApi } from "../src/frappe/client";
import { startDataImport, getImportStatus, getImportLogs, remapImportColumns } from "../src/frappe/list/import";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeForm } from "../src/frappe/form";
import type { DocPerm, DocTypeMeta, FrappeDoc, WorkflowInfo } from "../src/frappe/contract";
import { BUILTIN_FIXTURE_META, createFixtureTransport, simScenario, SIM_SCENARIO_NAMES, type FixtureTransport, type SimulatedPermissions } from "../src/frappe/testing";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const ALL_RIGHTS = { read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1, select: 1, report: 1, export: 1, import: 1, print: 1, email: 1, share: 1 } as const;
const SM: DocPerm = { role: "System Manager", permlevel: 0, ...ALL_RIGHTS };
const TRAVEL: DocTypeMeta = {
  name: "Travel Request", autoname: "hash", title_field: "purpose", allow_import: 1,
  permissions: [
    SM,
    { role: "System Manager", permlevel: 1, read: 1, write: 1 },
    { role: "Sales User", permlevel: 0, read: 1, report: 1, print: 1, email: 1, select: 1 },
    { role: "Data Entry", permlevel: 0, read: 1, write: 1, create: 1, import: 1, report: 1, select: 1 },
    { role: "Exporter", permlevel: 0, read: 1, export: 1, report: 1, select: 1 },
  ],
  fields: [
    { fieldname: "purpose", fieldtype: "Data", label: "Purpose", reqd: 1, in_list_view: 1 },
    { fieldname: "traveller", fieldtype: "Link", label: "Lead traveller", options: "User", in_list_view: 1 },
    { fieldname: "budget", fieldtype: "Currency", label: "Budget" },
    { fieldname: "companions", fieldtype: "Table MultiSelect", label: "Companions", options: "Travel Companion" },
    { fieldname: "section_internal", fieldtype: "Section Break", label: "Internal" },
    { fieldname: "internal_notes", fieldtype: "Small Text", label: "Internal notes", permlevel: 1 },
  ],
};
const COMPANION: DocTypeMeta = {
  name: "Travel Companion", istable: 1,
  fields: [{ fieldname: "user", fieldtype: "Link", label: "User", options: "User", reqd: 1 }, { fieldname: "note", fieldtype: "Data", label: "Note", permlevel: 1 }],
};
const MEMO: DocTypeMeta = {
  name: "Approval Memo", is_submittable: 1, autoname: "hash", title_field: "title",
  permissions: [
    SM,
    { role: "Memo Writer", permlevel: 0, read: 1, write: 1, create: 1 },
    { role: "Memo Submitter", permlevel: 0, read: 1, write: 1, create: 1, submit: 1 },
    { role: "Memo Approver", permlevel: 0, read: 1, write: 1, submit: 1 },
  ],
  fields: [{ fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 }, { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State", hidden: 1 }],
};
const WF: WorkflowInfo = {
  name: "Memo Flow", document_type: "Approval Memo", workflow_state_field: "workflow_state",
  states: [
    { state: "Draft", doc_status: "0", allow_edit: "Memo Writer" },
    { state: "Pending", doc_status: "0", allow_edit: "Memo Approver" },
  ],
  transitions: [
    { state: "Draft", action: "Request", next_state: "Pending", allowed: "Memo Writer", allow_self_approval: 1 },
    { state: "Draft", action: "Fast-track", next_state: "Pending", allowed: "Memo Approver", allow_self_approval: 0 },
  ],
};
/** `if_owner` DocType: Employees see / edit their own notes only; approvers see all. */
const EXPENSE: DocTypeMeta = {
  name: "Expense Note", autoname: "hash",
  permissions: [{ role: "Employee", permlevel: 0, if_owner: 1, read: 1, write: 1, create: 1, delete: 1 }, { role: "Expense Approver", permlevel: 0, read: 1, write: 1 }],
  fields: [{ fieldname: "amount", fieldtype: "Currency", label: "Amount" }],
};
const USER_META: DocTypeMeta = { ...BUILTIN_FIXTURE_META.User[0], permissions: [SM, { role: "Desk User", permlevel: 0, select: 1 }] };
const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const T = "2026-11-02 09:00:00.000000";
const users = ["sara@example.com", "lina@example.com", "omar@example.com", "khaled@example.com"].map((u) => ({ doctype: "User", name: u, email: u, full_name: u.split("@")[0], first_name: u.split("@")[0], enabled: 1, user_type: "System User" })) as FrappeDoc[];
const travels = (): FrappeDoc[] => [
  { doctype: "Travel Request", name: "TR-0001", purpose: "Riyadh offsite", traveller: "sara@example.com", budget: 4200, internal_notes: "Approved by finance", owner: "Administrator", modified: T, creation: T, docstatus: 0,
    companions: [{ doctype: "Travel Companion", name: "tc1", idx: 1, user: "khaled@example.com", note: "needs a visa", parent: "TR-0001", parentfield: "companions", parenttype: "Travel Request" }] },
  { doctype: "Travel Request", name: "TR-0002", purpose: "Jeddah client visit", traveller: "lina@example.com", budget: 1800, owner: "Administrator", modified: T, creation: T, docstatus: 0, companions: [] },
  { doctype: "Travel Request", name: "TR-0003", purpose: "London trade fair", traveller: "omar@example.com", budget: 9800, internal_notes: "Book early", owner: "Administrator", modified: T, creation: T, docstatus: 0, companions: [] },
  { doctype: "Travel Request", name: "TR-0004", purpose: "Unassigned trip", owner: "omar@example.com", modified: T, creation: T, docstatus: 0, companions: [] },
] as FrappeDoc[];

function site(permissions?: SimulatedPermissions) {
  return createFixtureTransport({
    meta: { "Travel Request": [TRAVEL, COMPANION], "Approval Memo": [MEMO], "Expense Note": [EXPENSE], ToDo: docsOf(todoEn), User: [USER_META] },
    workflows: { "Approval Memo": WF },
    docs: {
      User: users,
      "Travel Request": travels(),
      "Approval Memo": [
        { doctype: "Approval Memo", name: "AM-1", title: "Budget", workflow_state: "Draft", owner: "omar@example.com", modified: T, creation: T, docstatus: 0 },
        { doctype: "Approval Memo", name: "AM-2", title: "Deposit", owner: "Administrator", modified: T, creation: T, docstatus: 1 },
      ] as FrappeDoc[],
      "Expense Note": [
        { doctype: "Expense Note", name: "EN-1", amount: 10, owner: "lina@example.com", modified: T, creation: T },
        { doctype: "Expense Note", name: "EN-2", amount: 20, owner: "omar@example.com", modified: T, creation: T },
      ] as FrappeDoc[],
      ToDo: [
        { doctype: "ToDo", name: "TD-1", description: "Lina's task", status: "Open", allocated_to: "lina@example.com", assigned_by: "sara@example.com", owner: "sara@example.com", modified: T },
        { doctype: "ToDo", name: "TD-2", description: "Sara's task", status: "Open", allocated_to: "sara@example.com", assigned_by: "khaled@example.com", owner: "khaled@example.com", modified: T },
      ] as FrappeDoc[],
    },
  }, { permissions, now: () => new Date(2026, 10, 3, 10, 0, 0) });
}

async function refused(p: Promise<unknown>): Promise<FrappeError> {
  try { await p; } catch (e) { if (e instanceof FrappeError) return e; throw e; }
  throw new Error("expected the simulated server to refuse");
}
const getdoc = (t: FixtureTransport, doctype: string, name: string) => t("frappe.desk.form.load.getdoc", { doctype, name });
const doc0 = async (t: FixtureTransport, doctype: string, name: string) => (await getdoc(t, doctype, name)).docs![0] as FrappeDoc;
const listNames = async (t: FixtureTransport, doctype: string, args: Record<string, unknown> = {}) => {
  const r = (await t("frappe.desk.reportview.get", { doctype, fields: JSON.stringify(["name"]), order_by: "name asc", ...args })).message as { values: string[][] } | [];
  return Array.isArray(r) ? [] : r.values.map((v) => v[0]);
};
const save = (t: FixtureTransport, doc: FrappeDoc, action = "Save") => t("frappe.desk.form.save.savedocs", { doc: JSON.stringify(doc), action });
const del = (t: FixtureTransport, doctype: string, name: string) => t("frappe.client.delete", { doctype, name });

/** The seven scenarios over Travel Request (the same rows the showcase uses). */
const SCENARIOS = {
  administrator: simScenario.administrator(),
  fullAccess: simScenario.fullAccess("sara@example.com", ["System Manager"]),
  readOnly: simScenario.readOnly("lina@example.com", ["Sales User"]),
  restrictedDoctype: simScenario.restrictedDoctype("khaled@example.com", ["Purchase User"]),
  restrictedFields: simScenario.restrictedFields("omar@example.com", ["Data Entry"]),
  userPermissions: simScenario.userPermissions("omar@example.com", ["Data Entry"], [{ allow: "User", for_value: "omar@example.com", applicable_for: "Travel Request" }],
    { shares: [{ share_doctype: "Travel Request", share_name: "TR-0002", user: "omar@example.com", read: 1 }] }),
  unknownRoles: simScenario.unknownRoles("lina@example.com"),
};

describe("SIMULATED permissions: opt-in and backward compatible", () => {
  it("without `permissions` the simulator answers every right and lets anyone do anything (historical behaviour)", async () => {
    const t = site();
    const r = await getdoc(t, "Travel Request", "TR-0001");
    expect((r.docs![0] as FrappeDoc).internal_notes).toBe("Approved by finance");
    expect((r.docinfo as { permissions: Record<string, number> }).permissions).toMatchObject({ read: 1, write: 1, delete: 1, submit: 0 });
    expect(t.store.session).toBeUndefined();
    expect(t.permissions).toBeNull();
    await del(t, "Travel Request", "TR-0002");
    expect(t.store.docs.get("Travel Request")!.has("TR-0002")).toBe(false);
  });
  it("names the seven scenarios; each builder records its scenario and the client session follows `clientRoles`", () => {
    expect(SIM_SCENARIO_NAMES).toEqual(["administrator", "full-access", "read-only", "restricted-doctype", "restricted-fields", "user-permissions", "unknown-roles"]);
    expect(Object.values(SCENARIOS).map((s) => s.scenario)).toEqual([...SIM_SCENARIO_NAMES]);
    // get_roles: assigned roles + All + Guest (+ Desk User for a System User), permissions.py:508-523
    expect(site(SCENARIOS.readOnly).store.session).toEqual({ user: "lina@example.com", fullName: "lina", roles: ["Sales User", "All", "Guest", "Desk User"] });
    expect(site(SCENARIOS.unknownRoles).store.session).toEqual({ user: "lina@example.com", fullName: "lina", roles: undefined });
    expect(site(SCENARIOS.administrator).store.session!.roles).toEqual(expect.arrayContaining(["System Manager", "Sales User", "Data Entry", "All", "Guest"]));
  });
});

describe("Administrator (permissions.py:107-109)", () => {
  it("reads, lists, saves and deletes everything; nothing is stripped", async () => {
    const t = site(SCENARIOS.administrator);
    const r = await getdoc(t, "Travel Request", "TR-0001");
    expect((r.docs![0] as FrappeDoc).internal_notes).toBe("Approved by finance");
    // get_doc_permissions does not short-cut the Administrator: submit / import follow the DocType (permissions.py:217-221)
    expect((r.docinfo as { permissions: Record<string, number> }).permissions).toMatchObject({ read: 1, write: 1, delete: 1, submit: 0, import: 1, cancel: 1 });
    expect(await listNames(t, "Travel Request")).toEqual(["TR-0001", "TR-0002", "TR-0003", "TR-0004"]);
    await save(t, { ...(r.docs![0] as FrappeDoc), internal_notes: "changed" });
    expect(t.store.docs.get("Travel Request")!.get("TR-0001")!.internal_notes).toBe("changed");
    await del(t, "Travel Request", "TR-0002");
    expect(await listNames(t, "Approval Memo")).toEqual(["AM-1", "AM-2"]);
  });
});

describe("full-access role (System Manager — evaluated, not bypassed)", () => {
  it("reads the permlevel-1 field, saves it, deletes; docinfo.permissions come from the rows", async () => {
    const t = site(SCENARIOS.fullAccess);
    const r = await getdoc(t, "Travel Request", "TR-0001");
    const doc = r.docs![0] as FrappeDoc;
    expect(doc.internal_notes).toBe("Approved by finance");
    expect((doc.companions as FrappeDoc[])[0].note).toBe("needs a visa");
    expect((r.docinfo as { permissions: Record<string, unknown> }).permissions).toMatchObject({ read: 1, write: 1, create: 1, delete: 1, submit: 0, import: 1, export: 1, has_if_owner_enabled: false });
    await save(t, { ...doc, internal_notes: "Re-approved" });
    expect(t.store.docs.get("Travel Request")!.get("TR-0001")!.internal_notes).toBe("Re-approved");
    await del(t, "Travel Request", "TR-0004");
  });
});

describe("read-only role (Sales User: read / report / print / email / select)", () => {
  it("getdoc: the doc without its permlevel-1 values; docinfo.permissions has no write", async () => {
    const t = site(SCENARIOS.readOnly);
    const r = await getdoc(t, "Travel Request", "TR-0001");
    const doc = r.docs![0] as FrappeDoc;
    expect(doc.purpose).toBe("Riyadh offsite");
    expect("internal_notes" in doc).toBe(false); // getdoc: as_dict(no_nulls=True) after apply_fieldlevel_read_permissions
    expect("note" in (doc.companions as FrappeDoc[])[0]).toBe(false);
    expect((r.docinfo as { permissions: Record<string, unknown> }).permissions).toMatchObject({ read: 1, write: 0, create: 0, delete: 0, report: 1, print: 1, email: 1, export: 0 });
  });
  it("save → 403 (write), new → 403 (create), delete → 403; the store is untouched", async () => {
    const t = site(SCENARIOS.readOnly);
    const doc = await doc0(t, "Travel Request", "TR-0002");
    const e = await refused(save(t, { ...doc, purpose: "Changed" }));
    expect(e.status).toBe(403);
    expect(e.kind).toBe("permission");
    // _handle_permission_failure (document.py:245-248): the DocType-level check answers first — no role grants write
    expect(e.message).toBe("No permission for Travel Request");
    expect(e.messages[0].message).toMatch(/does not have doctype access via role permission for document <strong>Travel Request<\/strong>/);
    const n = await refused(save(t, { doctype: "Travel Request", name: "new-travel-request-1", __islocal: 1, purpose: "New" } as FrappeDoc));
    expect(n.status).toBe(403);
    const d = await refused(del(t, "Travel Request", "TR-0002"));
    expect(d.status).toBe(403);
    expect(d.messages.map((m) => m.message).join(" ")).toMatch(/User not allowed to delete Travel Request: TR-0002/);
    expect(t.store.docs.get("Travel Request")!.get("TR-0002")!.purpose).toBe("Jeddah client visit");
  });
  it("lists: every row, but the permlevel-1 column is dropped from the keys (db_query.py:668-760)", async () => {
    const t = site(SCENARIOS.readOnly);
    const r = (await t("frappe.desk.reportview.get", { doctype: "Travel Request", fields: JSON.stringify(["name", "purpose", "internal_notes"]) })).message as { keys: string[] };
    expect(r.keys).toEqual(["name", "purpose"]);
    const star = (await t("frappe.client.get_list", { doctype: "Travel Request", fields: JSON.stringify(["*"]), limit_page_length: 0 })).message as FrappeDoc[];
    expect(star).toHaveLength(4);
    expect(star.every((row) => !("internal_notes" in row))).toBe(true);
    const v = (await t("frappe.client.get_value", { doctype: "Travel Request", fieldname: JSON.stringify(["purpose", "internal_notes"]), filters: JSON.stringify({ name: "TR-0001" }) })).message as Record<string, unknown>;
    expect(v).toEqual({ purpose: "Riyadh offsite" });
  });
  it("the CLIENT given store.session renders the saved doc read-only: no Save, the permlevel-1 field absent", async () => {
    const t = site(SCENARIOS.readOnly);
    const client = createFrappeClient({ transport: t });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <QueryClientProvider client={qc}>
          <FrappeProvider client={client} queryClient={qc} session={t.store.session}>
            <FrappeForm doctype="Travel Request" name="TR-0001" guardUnload={false} />
          </FrappeProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    await waitFor(() => expect(document.querySelector('[data-sf-readonly][id^="sf-ff-purpose"]')?.textContent).toBe("Riyadh offsite"));
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByText("Internal notes")).toBeNull();
  });
});

describe("the built-in User / List Filter metas carry their native rows", () => {
  it("a read-only session keeps its saved filters (List Filter: Desk User) and searches users (User: Desk User select)", async () => {
    const t = createFixtureTransport({ meta: { "Travel Request": [TRAVEL, COMPANION] }, docs: { User: users } }, { permissions: SCENARIOS.readOnly });
    await t("frappe.client.insert", { doc: JSON.stringify({ doctype: "List Filter", filter_name: "Mine", reference_doctype: "Travel Request", for_user: "lina@example.com", filters: "[]" }) });
    const rows = (await t("frappe.client.get_list", { doctype: "List Filter", fields: JSON.stringify(["name", "filter_name"]), filters: JSON.stringify({ for_user: "lina@example.com" }) })).message as FrappeDoc[];
    expect(rows.map((r) => r.filter_name)).toEqual(["Mine"]);
    const found = (await t("frappe.desk.search.search_link", { doctype: "User", txt: "sara" })).message as { value: string }[];
    expect(found.map((x) => x.value)).toEqual(["sara@example.com"]);
  });
});

describe("restricted DocType permissions (a role with no row on Travel Request)", () => {
  it("meta still loads (load.py:62-79); getdoc, lists and counts answer 403 'No permission for Travel Request'", async () => {
    const t = site(SCENARIOS.restrictedDoctype);
    const meta = await t("frappe.desk.form.load.getdoctype", { doctype: "Travel Request" });
    expect((meta.docs![0] as DocTypeMeta).name).toBe("Travel Request");
    const g = await refused(getdoc(t, "Travel Request", "TR-0001"));
    expect(g.status).toBe(403);
    expect(g.message).toBe("No permission for Travel Request");
    expect((await refused(listNames(t, "Travel Request"))).message).toBe("No permission for Travel Request");
    expect((await refused(t("frappe.desk.reportview.get_count", { doctype: "Travel Request" }))).status).toBe(403);
    expect((await refused(t("frappe.client.get_list", { doctype: "Travel Request" }))).status).toBe(403);
    // a missing name: still 403 before "not found" (load.py:33-35 check_doctype_permission)
    expect((await refused(getdoc(t, "Travel Request", "TR-9999"))).status).toBe(403);
  });
  it("other DocTypes keep working (ToDo's 'All' row), filtered by ToDo's controller hook (todo.py:148-171)", async () => {
    const t = site(simScenario.restrictedDoctype("lina@example.com", ["Purchase User"]));
    expect(await listNames(t, "ToDo")).toEqual(["TD-1"]); // allocated to (or assigned by) the user only
    expect((await doc0(t, "ToDo", "TD-1")).description).toBe("Lina's task");
    expect((await refused(getdoc(t, "ToDo", "TD-2"))).status).toBe(403);
  });
});

describe("restricted field permissions (Data Entry: level-0 rights, nothing at permlevel 1)", () => {
  it("values stripped on read; a save keeps the stored permlevel-1 values (validate_higher_perm_levels)", async () => {
    const t = site(SCENARIOS.restrictedFields);
    const doc = await doc0(t, "Travel Request", "TR-0001");
    expect("internal_notes" in doc).toBe(false);
    // the client posts what it has (no internal_notes) and even tries to set one: the server resets both to the stored value
    const r = await save(t, { ...doc, purpose: "Riyadh offsite (2 days)", internal_notes: "overwritten?", companions: [{ ...(doc.companions as FrappeDoc[])[0], note: "hacked" }] });
    const stored = t.store.docs.get("Travel Request")!.get("TR-0001")!;
    expect(stored.purpose).toBe("Riyadh offsite (2 days)");
    expect(stored.internal_notes).toBe("Approved by finance");
    expect((stored.companions as FrappeDoc[])[0].note).toBe("needs a visa");
    // send_updated_docs: as_dict() after stripping → the key is present as null (save.py:62-70)
    const echoed = r.docs![0] as FrappeDoc;
    expect(echoed.internal_notes).toBeNull();
    expect((echoed.companions as FrappeDoc[])[0].note).toBeNull();
  });
  it("a new doc gets the field default for a permlevel it cannot write; delete is refused (no delete right)", async () => {
    const t = site(SCENARIOS.restrictedFields);
    const r = await save(t, { doctype: "Travel Request", name: "new-travel-request-1", __islocal: 1, purpose: "Dubai", internal_notes: "should not stick" } as FrappeDoc);
    const name = String((r.docs![0] as FrappeDoc).name);
    expect(t.store.docs.get("Travel Request")!.get(name)!.internal_notes).toBeNull();
    expect(t.store.docs.get("Travel Request")!.get(name)!.owner).toBe("omar@example.com");
    expect((await refused(del(t, "Travel Request", name))).status).toBe(403);
  });
});

describe("User Permissions (permissions.py:320-433, db_query.py:1065-1123) and sharing", () => {
  it("lists only the rows whose Link values are allowed — plus the doc shared with the user (OR, db_query.py:1051)", async () => {
    const t = site(SCENARIOS.userPermissions);
    // TR-0003 (traveller omar), TR-0004 (no traveller: an empty value passes unless strict), TR-0002 (shared)
    expect(await listNames(t, "Travel Request")).toEqual(["TR-0002", "TR-0003", "TR-0004"]);
    const strict = site({ ...SCENARIOS.userPermissions, strictUserPermissions: true, shares: [] });
    expect(await listNames(strict, "Travel Request")).toEqual(["TR-0003"]);
  });
  it("getdoc of a row outside the restriction → 403 with the linked-value reason", async () => {
    const t = site(SCENARIOS.userPermissions);
    const e = await refused(getdoc(t, "Travel Request", "TR-0001"));
    expect(e.status).toBe(403);
    expect(e.message).toMatch(/Insufficient Permission for Travel Request TR-0001/);
    expect(e.messages[0].message).toMatch(/linked to User 'sara@example.com' in field Lead traveller/);
  });
  it("the shared doc opens (share.py), docinfo.shared lists the share, docinfo.permissions is {} — and a save is refused", async () => {
    const t = site(SCENARIOS.userPermissions);
    const r = await getdoc(t, "Travel Request", "TR-0002");
    const info = r.docinfo as { permissions: Record<string, unknown>; shared: Record<string, unknown>[] };
    expect(info.permissions).toEqual({});
    expect(info.shared).toEqual([expect.objectContaining({ user: "omar@example.com", read: 1, write: 0 })]);
    // the role grants write on the DocType, so the doc-level refusal speaks (document.py:250-258)
    expect((await refused(save(t, r.docs![0] as FrappeDoc))).message).toBe("You need the 'write' permission on Travel Request TR-0002 to perform this action.");
  });
  it("an allowed doc saves; moving it to a disallowed Link value is refused", async () => {
    const t = site(SCENARIOS.userPermissions);
    const doc = await doc0(t, "Travel Request", "TR-0003");
    const saved = (await save(t, { ...doc, budget: 9900 })).docs![0] as FrappeDoc;
    expect((await refused(save(t, { ...saved, traveller: "sara@example.com" }))).messages[0].message).toMatch(/linked to User 'sara@example.com'/);
  });
  it("applicable_for scopes the rule: link searches with reference_doctype see only omar, others see every user", async () => {
    const t = site(SCENARIOS.userPermissions);
    const scoped = (await t("frappe.desk.search.search_link", { doctype: "User", txt: "", reference_doctype: "Travel Request" })).message as { value: string }[];
    expect(scoped.map((x) => x.value)).toEqual(["omar@example.com"]);
    const all = (await t("frappe.desk.search.search_link", { doctype: "User", txt: "" })).message as { value: string }[];
    expect(all.length).toBeGreaterThan(1);
  });
  it("a User Permission on the DocType itself (STEP 1) limits names; a new doc cannot be created (no name yet)", async () => {
    const t = site(simScenario.userPermissions("omar@example.com", ["Data Entry"], [{ allow: "Travel Request", for_value: "TR-0002" }]));
    expect(await listNames(t, "Travel Request")).toEqual(["TR-0002"]);
    expect((await refused(getdoc(t, "Travel Request", "TR-0003"))).messages[0].message).toMatch(/Not allowed for Travel Request: TR-0003/);
    expect((await refused(save(t, { doctype: "Travel Request", name: "new-travel-request-1", __islocal: 1, purpose: "x" } as FrappeDoc))).status).toBe(403);
  });
  it("a write share lets a user with no role on the DocType open and save — not delete; the list is the shared names only", async () => {
    const t = site(simScenario.restrictedDoctype("khaled@example.com", ["Purchase User"], { shares: [{ share_doctype: "Travel Request", share_name: "TR-0003", user: "khaled@example.com", read: 1, write: 1 }] }));
    expect(await listNames(t, "Travel Request")).toEqual(["TR-0003"]);
    const doc = await doc0(t, "Travel Request", "TR-0003");
    expect("internal_notes" in doc).toBe(false);
    await save(t, { ...doc, budget: 100 });
    expect((await refused(del(t, "Travel Request", "TR-0003"))).status).toBe(403);
    expect((await refused(getdoc(t, "Travel Request", "TR-0001"))).message).toBe("No permission for Travel Request");
  });
  it("an `everyone` share reaches every user", async () => {
    const t = site(simScenario.restrictedDoctype("khaled@example.com", ["Purchase User"], { shares: [{ share_doctype: "Travel Request", share_name: "TR-0002", everyone: 1, read: 1 }] }));
    expect(await listNames(t, "Travel Request")).toEqual(["TR-0002"]);
  });
});

describe("unknown / missing role information", () => {
  it("the client gets no roles (rule 9); the server evaluates the automatic roles only (All, Guest, Desk User)", async () => {
    const t = site(SCENARIOS.unknownRoles);
    expect(t.store.session!.roles).toBeUndefined();
    expect(t.permissions!.rolesOf()).toEqual(["All", "Guest", "Desk User"]);
    expect((await refused(getdoc(t, "Travel Request", "TR-0002"))).message).toBe("No permission for Travel Request");
    // ToDo's "All" row grants read / write / create / delete; the hook keeps it to the user's own ToDos
    const r = await getdoc(t, "ToDo", "TD-1");
    expect((r.docinfo as { permissions: Record<string, unknown> }).permissions).toMatchObject({ read: 1, write: 1, create: 1, delete: 1 });
    expect(await listNames(t, "ToDo")).toEqual(["TD-1"]);
  });
  it("the CLIENT shows the rule-9 'unknown' state on a new document although the server would accept it", async () => {
    const t = site(SCENARIOS.unknownRoles);
    const client = createFrappeClient({ transport: t });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <QueryClientProvider client={qc}>
          <FrappeProvider client={client} queryClient={qc} session={t.store.session}>
            <FrappeForm doctype="ToDo" guardUnload={false} />
          </FrappeProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    await waitFor(() => expect(container.querySelector('[data-permissions="unknown"]')).not.toBeNull());
    await save(t, { doctype: "ToDo", name: "new-todo-1", __islocal: 1, description: "server accepts", allocated_to: "lina@example.com" } as FrappeDoc);
  });
});

describe("if_owner (permissions.py:251-310, db_query.py:1024-1028)", () => {
  it("an Employee lists and opens only their own notes; docinfo shows the owner rights; others answer 403", async () => {
    const t = site({ user: "lina@example.com", roles: ["Employee"] });
    expect(await listNames(t, "Expense Note")).toEqual(["EN-1"]);
    const r = await getdoc(t, "Expense Note", "EN-1");
    expect((r.docinfo as { permissions: Record<string, unknown> }).permissions).toMatchObject({ read: 1, write: 1, delete: 1, has_if_owner_enabled: true, if_owner: { read: 1, write: 1, delete: 1 } });
    expect((await refused(getdoc(t, "Expense Note", "EN-2"))).status).toBe(403);
    expect((await refused(del(t, "Expense Note", "EN-2"))).status).toBe(403);
    await del(t, "Expense Note", "EN-1");
  });
  it("a role without if_owner sees every row", async () => {
    expect(await listNames(site({ user: "sara@example.com", roles: ["Expense Approver"] }), "Expense Note")).toEqual(["EN-1", "EN-2"]);
  });
});

describe("submit / cancel / workflow / assignment / comments", () => {
  it("submit needs submit; cancel needs cancel (document.py:880-915)", async () => {
    const writer = site({ user: "omar@example.com", roles: ["Memo Writer"] });
    const am1 = await doc0(writer, "Approval Memo", "AM-1");
    expect((await refused(save(writer, am1, "Submit"))).message).toBe("No permission for Approval Memo");
    const submitter = site({ user: "omar@example.com", roles: ["Memo Submitter"] });
    await save(submitter, await doc0(submitter, "Approval Memo", "AM-1"), "Submit");
    expect(Number(submitter.store.docs.get("Approval Memo")!.get("AM-1")!.docstatus)).toBe(1);
    expect((await refused(submitter("frappe.desk.form.save.cancel", { doctype: "Approval Memo", name: "AM-2" }))).message).toBe("No permission for Approval Memo");
  });
  it("transitions follow the evaluated roles; self-approval is refused when not allowed (workflow.py:221-222)", async () => {
    const t = site({ user: "omar@example.com", roles: ["Memo Writer", "Memo Approver"] });
    const am1 = await doc0(t, "Approval Memo", "AM-1");
    const tr = (await t("frappe.model.workflow.get_transitions", { doc: JSON.stringify(am1) })).message as { action: string }[];
    expect(tr.map((x) => x.action)).toEqual(["Request", "Fast-track"]);
    const e = await refused(t("frappe.model.workflow.apply_workflow", { doc: JSON.stringify(am1), action: "Fast-track" }));
    expect(e.messages[0].message).toBe("Self approval is not allowed");
    const only = site({ user: "lina@example.com", roles: ["Memo Writer"] });
    expect(((await only("frappe.model.workflow.get_transitions", { doc: JSON.stringify(am1) })).message as { action: string }[]).map((x) => x.action)).toEqual(["Request"]);
  });
  it("assign_to.add: 403 without read; an assignee without read gets a read share; an assigner without share right is refused", async () => {
    const reader = site(SCENARIOS.readOnly);
    expect((await refused(reader("frappe.desk.form.assign_to.add", { doctype: "Approval Memo", name: "AM-1", assign_to: JSON.stringify(["sara@example.com"]) }))).status).toBe(403);
    const sm = site(SCENARIOS.fullAccess);
    const r = await sm("frappe.desk.form.assign_to.add", { doctype: "Travel Request", name: "TR-0001", assign_to: JSON.stringify(["khaled@example.com"]) });
    expect(JSON.stringify(r._server_messages)).toMatch(/Shared with the following Users with Read access/);
    expect(((await getdoc(sm, "Travel Request", "TR-0001")).docinfo as { shared: Record<string, unknown>[] }).shared).toEqual([expect.objectContaining({ user: "khaled@example.com", read: 1 })]);
    const entry = site(SCENARIOS.restrictedFields); // Data Entry has no share right
    const e = await refused(entry("frappe.desk.form.assign_to.add", { doctype: "Travel Request", name: "TR-0003", assign_to: JSON.stringify(["khaled@example.com"]) }));
    expect(e.messages[0].message).toMatch(/No permission to share Travel Request TR-0003/);
    expect([...entry.store.todos.values()].some((x) => x.reference_name === "TR-0003")).toBe(false);
    const closer = await refused(sm("frappe.desk.form.assign_to.close", { doctype: "Travel Request", name: "TR-0001", assign_to: "khaled@example.com" }));
    expect(closer.messages[0].message).toBe("Only the assignee can complete this to-do.");
  });
  it("comments: adding needs read on the document; deleting needs the Comment delete right (comment.json)", async () => {
    const t = site(SCENARIOS.readOnly);
    const c = (await t("frappe.desk.form.utils.add_comment", { reference_doctype: "Travel Request", reference_name: "TR-0001", content: "ok", comment_email: "lina@example.com", comment_by: "Lina" })).message as FrappeDoc;
    expect((await refused(del(t, "Comment", c.name))).status).toBe(403);
    expect((await refused(t("frappe.desk.form.utils.add_comment", { reference_doctype: "Approval Memo", reference_name: "AM-1", content: "no", comment_email: "lina@example.com", comment_by: "Lina" }))).status).toBe(403);
  });
  it("delete_items: failures are not in the answer — they are published as the realtime msgprint (reportview.py:588-616)", async () => {
    const t = site(SCENARIOS.readOnly);
    expect(await t("frappe.desk.reportview.delete_items", { doctype: "Travel Request", items: JSON.stringify(["TR-0001", "TR-0002"]) })).toEqual({});
    expect(t.store.published.at(-1)).toEqual({ event: "msgprint", title: "Bulk Operation Failed", message: "Failed to delete 2 documents: TR-0002, TR-0001" });
    expect(t.store.docs.get("Travel Request")!.size).toBe(4);
  });
});

describe("download_template (data_import.py:178-202, exporter.py:116-126) — the simulated file server", () => {
  const args = { doctype: "Travel Request", file_type: "CSV", export_records: "all", export_fields: JSON.stringify({ "Travel Request": ["name", "purpose", "budget"] }), export_filters: null };
  it("403 without the export right; a blank template needs read only; no read at all → 'No permission for X'", async () => {
    const reader = site(SCENARIOS.readOnly);
    const e = await refused(reader.files.download("frappe.core.doctype.data_import.data_import.download_template", args));
    expect(e.status).toBe(403);
    expect(e.message).toMatch(/You are not allowed to export Travel Request doctype/);
    await reader.files.download("frappe.core.doctype.data_import.data_import.download_template", { ...args, export_records: "blank_template" });
    expect((await refused(site(SCENARIOS.restrictedDoctype).files.download("frappe.core.doctype.data_import.data_import.download_template", args))).message).toBe("No permission for Travel Request");
  });
  it("the exporter gets a file that says it is simulated and carries labels and the request, never document values", async () => {
    const t = site(simScenario.readOnly("khaled@example.com", ["Exporter"]));
    const f = await t.files.download("frappe.core.doctype.data_import.data_import.download_template", args);
    const text = await new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(f.blob); });
    expect(f.filename).toBe("SIMULATED-Travel-Request-not-an-export.txt");
    expect(text).toMatch(/^SIMULATED — in-browser Frappe simulator/);
    expect(text).toMatch(/NOT AN EXPORT/);
    expect(text).toMatch(/Columns \(labels only\): ID \| Purpose \| Budget/);
    for (const value of ["Riyadh offsite", "Jeddah client visit", "4200", "Approved by finance"]) expect(text).not.toContain(value);
    await expect(t.files.upload(new Blob(["x"]), "x.csv", {} as never)).rejects.toMatchObject({ status: 417 });
  });
});

describe("ToDo docinfo quirk reproduced", () => {
  it("System Manager on someone else's ToDo: getdoc passes (hook with ptype read) but docinfo.permissions is {null: 0} (hook with ptype None)", async () => {
    const t = site({ user: "omar@example.com", roles: ["System Manager"] });
    const r = await getdoc(t, "ToDo", "TD-1");
    expect((r.docinfo as { permissions: Record<string, unknown> }).permissions).toEqual({ null: 0 });
  });
});

const readText = (b: Blob) => new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsText(b); });

describe("Phase 27 list actions on the simulated server (handlers + permission checks)", () => {
  const openTodo = (t: FixtureTransport, name: string, ref: string, user: string) =>
    t.store.todos.set(name, { doctype: "ToDo", name, reference_type: "Travel Request", reference_name: ref, allocated_to: user, status: "Open", description: "x", modified: T } as FrappeDoc);
  it("assign_to.remove_multiple: Desk's ignore_permissions → no check (assign_to.py:181-207); without it read is checked", async () => {
    const t = site(SCENARIOS.restrictedDoctype);
    openTodo(t, "TD-X", "TR-0002", "sara@example.com");
    expect((await refused(t("frappe.desk.form.assign_to.remove_multiple", { doctype: "Travel Request", names: JSON.stringify(["TR-0002"]) }))).status).toBe(403);
    await t("frappe.desk.form.assign_to.remove_multiple", { doctype: "Travel Request", names: JSON.stringify(["TR-0002"]), ignore_permissions: true });
    expect(t.store.todos.get("TD-X")!.status).toBe("Cancelled");
  });
  it("assignment_rule.bulk_apply: no check, no rule → no-op; a missing name fails in the synchronous path", async () => {
    const t = site(SCENARIOS.readOnly);
    expect(await t("frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply", { doctype: "Travel Request", docnames: JSON.stringify(["TR-0001"]) })).toEqual({});
    expect((await refused(t("frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply", { doctype: "Travel Request", docnames: JSON.stringify(["TR-9"]) }))).status).toBe(404);
  });
  it("tag.add_tags: no permission check (tag.py:42-116); the Tag master is created and found by search_link (All: read)", async () => {
    const t = site(SCENARIOS.restrictedDoctype);
    await t("frappe.desk.doctype.tag.tag.add_tags", { tags: JSON.stringify(["urgent", "q4"]), dt: "Travel Request", docs: JSON.stringify(["TR-0001", "TR-0002"]) });
    expect(t.store.docs.get("Travel Request")!.get("TR-0001")!._user_tags).toBe(",urgent,q4");
    const found = (await t("frappe.desk.search.search_link", { doctype: "Tag", txt: "urg" })).message as { value: string }[];
    expect(found.map((x) => x.value)).toEqual(["urgent"]);
  });
  it("workflow: common actions per evaluated roles, self-approval from the row's owner; bulk approval publishes the log", async () => {
    const t = site({ user: "omar@example.com", roles: ["Memo Writer", "Memo Approver"] });
    const common = async (owner: string) => (await t("frappe.model.workflow.get_common_transition_actions", { doctype: "Approval Memo", docs: JSON.stringify([{ name: "AM-1", owner }]) })).message;
    expect(await common("omar@example.com")).toEqual(["Request"]);
    expect(await common("sara@example.com")).toEqual(["Request", "Fast-track"]);
    expect(await t("frappe.model.workflow.bulk_workflow_approval", { doctype: "Approval Memo", docnames: JSON.stringify(["AM-1"]), action: "Request" })).toEqual({});
    expect(t.store.docs.get("Approval Memo")!.get("AM-1")!.workflow_state).toBe("Pending");
    expect(t.store.published.at(-1)).toMatchObject({ title: "Workflow Status", message: expect.stringContaining("Successful Transactions") });
    const big = await refused(t("frappe.model.workflow.bulk_workflow_approval", { doctype: "Approval Memo", docnames: JSON.stringify(Array.from({ length: 501 }, (_, i) => `x${i}`)), action: "Request" }));
    expect(big.status).toBe(417);
    const reader = site(SCENARIOS.readOnly);
    expect((await refused(reader("frappe.model.workflow.get_common_transition_actions", { doctype: "Approval Memo", docs: JSON.stringify([{ name: "AM-1", owner: "x" }]) }))).status).toBe(403);
  });
  it("download_multi_pdf: unprintable documents are left out silently; the file is labelled SIMULATED and carries no values", async () => {
    const args = { doctype: "Travel Request", name: JSON.stringify(["TR-0001", "TR-0002"]), format: "Standard", no_letterhead: "1" };
    const ok = await site(SCENARIOS.readOnly).files.download("frappe.utils.print_format.download_multi_pdf", args);
    const text = await readText(ok.blob);
    expect(ok.filename).toBe("SIMULATED-Travel-Request-not-a-pdf.txt");
    expect(text).toMatch(/NOT A PDF/);
    expect(text).toMatch(/Printable \(simulated decision\): 2 of 2/);
    expect(text).not.toContain("Riyadh offsite");
    const none = await readText((await site(SCENARIOS.restrictedDoctype).files.download("frappe.utils.print_format.download_multi_pdf", args)).blob);
    expect(none).toMatch(/Printable \(simulated decision\): 0 of 2/);
    const t = site(SCENARIOS.readOnly);
    const task = (await t("frappe.utils.print_format.download_multi_pdf_async", args)).message as { task_id: string };
    expect(t.store.published.at(-1)!.event).toBe(`task_complete:${task.task_id}`);
  });
  it("export_query: Access Log first, then read (403) and can_export (403); the exporter gets a labelled file with a count, no values", async () => {
    const args = { doctype: "Travel Request", fields: JSON.stringify(["name", "purpose", "internal_notes"]), filters: "[]", file_format_type: "CSV", title: "Trips" };
    const reader = site(SCENARIOS.readOnly);
    const e = await refused(reader.files.download("frappe.desk.reportview.export_query", args));
    expect(e.status).toBe(403);
    expect(e.message).toMatch(/You are not allowed to export Travel Request doctype/);
    expect(reader.store.docs.get("Access Log")!.size).toBe(1); // written before the check, as on a site
    const exporter = site(simScenario.readOnly("khaled@example.com", ["Exporter"]));
    const f = await exporter.files.download("frappe.desk.reportview.export_query", args);
    const text = await readText(f.blob);
    expect(f.filename).toBe("SIMULATED-Trips-not-a-csv.txt");
    expect(text).toMatch(/Columns \(labels only\): Sr \| ID \| Purpose$/m); // the permlevel-1 column is dropped
    expect(text).not.toMatch(/Rows the simulated server matched/); // no counts in a simulated file (owner decision 6, Phase 27)
    expect(text).toMatch(/no document values and no counts/);
    expect(text).not.toContain("Riyadh offsite");
    const bg = await exporter("frappe.desk.reportview.export_query", { ...args, export_in_background: "1" });
    expect(String(bg._server_messages)).toMatch(/generated in the background/);
    expect((await refused(site(SCENARIOS.restrictedDoctype).files.download("frappe.desk.reportview.export_query", args))).message).toBe("No permission for Travel Request");
  });
});

describe("Data Import on the simulated server (data_import.py:44-256) — dry run by default", () => {
  const csv = "Purpose,Lead traveller,Budget,Unknown column\nDubai fair,omar@example.com,500,x\n,lina@example.com,10,y\nGhost trip,ghost@example.com,1,z\n";
  const apiOf = (t: FixtureTransport) => withFrappeApi(createFrappeClient({ transport: t, files: t.files }));
  const file = (text: string, type = "text/csv") => new Blob([text], { type });
  it("System Manager: create → upload → preview (columns matched, warnings) → start: logs per row, NOTHING written", async () => {
    const t = site(SCENARIOS.fullAccess);
    const api = apiOf(t);
    const r = await startDataImport(api, { referenceDoctype: "Travel Request", importType: "Insert New Records", file: file(csv), filename: "trips.csv", start: true });
    const cols = (r.preview!.columns as { header_title: string; df?: { fieldname: string } | null; skip_import: boolean }[]);
    expect(cols.map((c) => [c.header_title, c.df?.fieldname ?? null, c.skip_import])).toEqual([["Sr. No", null, true], ["Purpose", "purpose", false], ["Lead traveller", "traveller", false], ["Budget", "budget", false], ["Unknown column", null, true]]);
    expect(r.preview!.data).toEqual([[2, "Dubai fair", "omar@example.com", "500", "x"], [3, "", "lina@example.com", "10", "y"], [4, "Ghost trip", "ghost@example.com", "1", "z"]]);
    expect(JSON.stringify(r.preview!.warnings)).toMatch(/Cannot match column <strong>Unknown column<\/strong>/);
    expect(r.started).toBe(true);
    const status = await getImportStatus(api, r.name);
    expect(status).toMatchObject({ status: "Partial Success", success: 1, failed: 2, total: 3 });
    const logs = await getImportLogs(api, r.name);
    expect(logs.map((l) => [l.row_indexes, l.success])).toEqual([["[2]", 1], ["[3]", 0], ["[4]", 0]]);
    expect(logs[0].messages).toMatch(/SIMULATED dry run/);
    expect(logs[1].exception).toMatch(/MandatoryError: .*Value missing for Travel Request: Purpose/);
    expect(logs[2].exception).toMatch(/LinkValidationError: Could not find Lead traveller: ghost@example.com/);
    expect(t.store.docs.get("Travel Request")!.size).toBe(4); // dry run: nothing written
  });
  it("the column map is honoured on the re-parse (template_options.column_to_field_map, Don't Import)", async () => {
    const t = site(SCENARIOS.fullAccess);
    const api = apiOf(t);
    const r = await startDataImport(api, { referenceDoctype: "Travel Request", importType: "Insert New Records", file: file(csv), filename: "trips.csv", start: false });
    const { preview } = await remapImportColumns(api, r.doc, { "3": "internal_notes", "2": "Don't Import" });
    const cols = (preview!.columns as { header_title: string; df?: { fieldname: string } | null; skip_import: boolean }[]).slice(1);
    // Column.parse (importer.py:884-933): "Don't Import" keeps the header's match but skips it
    expect(cols.map((c) => [c.df?.fieldname ?? null, c.skip_import])).toEqual([["purpose", false], ["traveller", false], ["budget", true], ["internal_notes", false]]);
  });
  it("dataImport: \"insert\" — the simulator plays the server and inserts the valid rows (labelled)", async () => {
    const t = createFixtureTransport({ meta: { "Travel Request": [TRAVEL, COMPANION], User: [USER_META] }, docs: { User: users } }, { permissions: SCENARIOS.fullAccess, dataImport: "insert" });
    const r = await startDataImport(apiOf(t), { referenceDoctype: "Travel Request", importType: "Insert New Records", file: file("Purpose,Lead traveller\nDubai fair,omar@example.com\nGhost,ghost@example.com\n"), filename: "t.csv" });
    const logs = await getImportLogs(apiOf(t), r.name);
    expect(logs[0].messages).toMatch(/SIMULATED: the in-browser simulator inserted/);
    expect(logs[1]).toMatchObject({ success: 0, exception: expect.stringMatching(/LinkValidationError/) });
    expect(t.store.docs.get("Travel Request")!.size).toBe(1);
    expect(t.store.docs.get("Travel Request")!.get(String(logs[0].docname))!.purpose).toBe("Dubai fair");
  });
  it("refusals: Data Entry cannot create a Data Import (System Manager only → 403); no import right → 403; xlsx → labelled 417; bad template → 417", async () => {
    const entry = site(SCENARIOS.restrictedFields);
    expect((await refused(startDataImport(apiOf(entry), { referenceDoctype: "Travel Request", importType: "Insert New Records", file: file(csv), filename: "t.csv" }))).status).toBe(403);
    const sm = site(SCENARIOS.fullAccess);
    const noImport = await refused(startDataImport(apiOf(sm), { referenceDoctype: "Approval Memo", importType: "Insert New Records", file: file(csv), filename: "t.csv" }));
    expect(noImport.messages[0].message).toMatch(/Data Import is not allowed for Approval Memo/);
    const x = await refused(startDataImport(apiOf(sm), { referenceDoctype: "Travel Request", importType: "Insert New Records", file: file("PK..", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"), filename: "t.xlsx" }));
    expect(x.messages[0].message).toMatch(/^SIMULATED: the in-browser simulator reads CSV files only/);
    const bad = await refused(startDataImport(apiOf(sm), { referenceDoctype: "Travel Request", importType: "Insert New Records", file: file("Purpose\n"), filename: "t.csv" }));
    expect(bad.messages[0].message).toBe("Import template should contain a Header and atleast one row.");
  });
});
