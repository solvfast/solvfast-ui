/**
 * Phase 26 D — permission matrix. SIMULATED — test doubles; the server remains the authority.
 *
 * Nothing here talks to a Frappe site: DocPerm rows are fixtures, `docinfo` is hand-written as `get_doc_permissions`
 * would answer, 403s are thrown by a stub transport. What is asserted is the PACKAGE's side of the contract: which right
 * gates which action (as Desk's model/perm.js, model.js:434-450 and list_view.js decide), that a refusal arrives as a
 * `FrappeError` of kind "permission" and changes no cache, and that missing information denies (rule 9).
 * Real-server verification of permission-limited users is `tests/real/sada-real.test.tsx` (two full-rights holders
 * only; no restricted test users exist and none may be created — see docs/release/PERMISSION-AUDIT.md §4).
 *
 * Native references: frappe/permissions.py `rights` :12-30, `has_permission` :77-195 (import needs `allow_import` :142),
 * `get_doc_permissions` :196-250 (`permissions["import"] = 0` :221, if_owner overlay :224-230, User Permissions :232-244),
 * `get_role_permissions` :251-330, `can_import` / `can_export` :600-615; model/perm.js `get_perm` :42-117,
 * `get_field_display_status` :191-267; list_view.js `get_actions_menu_items` :1855-2128; assign_to.py :60-68.
 */
import { describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import todoEn from "../fixtures/real-15.110/todo.en.json";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { createFrappeClient, FrappeError, type FrappeTransport } from "../../src/frappe/client";
import { FrappeProvider } from "../../src/frappe/FrappeProvider";
import { frappeKeys, type DocInfo, type DocPerm, type DocTypeMeta, type FrappeDoc, type MetaBundle } from "../../src/frappe/contract";
import { useDocAction, usePermissions, useSaveDoc } from "../../src/frappe/hooks";
import { FrappeForm } from "../../src/frappe/form/FrappeForm";
import { buildDocPermissions, canExport, canImport, fieldDisplayStatus, permissionsKnown, readableFields, rolePermissions } from "../../src/frappe/services/permissions";
import { bulkDelete, bulkMenu, bulkSubmitCancelOrUpdate } from "../../src/frappe/list/bulk";

// ---- fixtures ---------------------------------------------------------------------------------------------------------

const COLUMNS = ["read", "create", "write", "delete", "import", "export"] as const;
type Column = (typeof COLUMNS)[number];
type Row = Record<Column, boolean>;
const row = (on: Partial<Row>): Row => ({ read: false, create: false, write: false, delete: false, import: false, export: false, ...on });

/** The six scenarios of the brief as DocPerm rows for one role each (permlevel 0, no if_owner). */
const SCENARIOS: { name: string; role: string; perm: Partial<DocPerm>; expect: Row }[] = [
  { name: "Read only", role: "Reader", perm: { read: 1 }, expect: row({ read: true }) },
  { name: "Read + Export", role: "Exporter", perm: { read: 1, export: 1 }, expect: row({ read: true, export: true }) },
  { name: "Read + Import", role: "Importer", perm: { read: 1, create: 1, import: 1 }, expect: row({ read: true, create: true, import: true }) },
  { name: "Read + Create", role: "Creator", perm: { read: 1, create: 1 }, expect: row({ read: true, create: true }) },
  { name: "Read + Write", role: "Editor", perm: { read: 1, write: 1 }, expect: row({ read: true, write: true }) },
  { name: "Full", role: "Owner", perm: { read: 1, write: 1, create: 1, delete: 1, import: 1, export: 1, report: 1, print: 1, email: 1, share: 1 }, expect: row({ read: true, create: true, write: true, delete: true, import: true, export: true }) },
];
// "Read + Import" carries create too: the server refuses an import right without create (doctype.py:1792-1793
// "Cannot set Import without Create"), so a DocPerm row with import and no create cannot exist.

const DOC_PERMS: DocPerm[] = [
  ...SCENARIOS.map((s) => ({ role: s.role, permlevel: 0, ...s.perm }) as DocPerm),
  { role: "Administrator", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, import: 1, export: 1 },
  // permlevel 1 (a "restricted" field): only the Full role may read it
  { role: "Owner", permlevel: 1, read: 1, write: 1 },
];

const meta = (allow_import: 0 | 1 = 1, permissions: DocPerm[] = DOC_PERMS): DocTypeMeta => ({
  name: "Deal", allow_import,
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title" },
    { fieldname: "amount", fieldtype: "Currency", label: "Amount" },
    { fieldname: "margin", fieldtype: "Percent", label: "Margin", permlevel: 1 },
  ],
  permissions,
});
const bundleOf = (m: DocTypeMeta): MetaBundle => ({ meta: m, children: {}, fetchedAt: 0 } as unknown as MetaBundle);
const saved = (extra: Partial<FrappeDoc> = {}): FrappeDoc => ({ doctype: "Deal", name: "D-1", owner: "u@x", docstatus: 0, title: "t", amount: 5, margin: 10, ...extra });
const NEW_DOC: FrappeDoc = { doctype: "Deal", name: "new-deal-1", __islocal: 1 };
const docinfo = (permissions: Record<string, 0 | 1>, extra: Partial<DocInfo> = {}): DocInfo =>
  ({ permissions, shared: [], attachments: [], comments: [], versions: [], assignments: [], assignment_logs: [], views: [], communications: [], user_info: {}, ...extra }) as unknown as DocInfo;

const level0 = (roles: string[], perms: DocPerm[] = DOC_PERMS) => rolePermissions(perms, roles).levels[0];
/** The six columns as the PACKAGE decides them for a DocType-level decision (no document): rolePermissions × canImport / canExport. */
const columnsFor = (roles: string[], m: DocTypeMeta): Row => {
  const l0 = level0(roles, m.permissions);
  return { read: !!l0.read, create: !!l0.create, write: !!l0.write, delete: !!l0.delete, import: canImport(m, roles, l0), export: canExport(roles, l0) };
};

const noop: FrappeTransport = async () => ({});
/** A stub transport that answers 403 PermissionError (as Frappe's `frappe.PermissionError` → HTTP 403) for `methods`. */
const deny = (methods: string[], otherwise: FrappeTransport = noop): FrappeTransport => async (method, args) => {
  if (methods.includes(method)) throw new FrappeError("User u@x does not have access to this document", 403, "PermissionError");
  return otherwise(method, args);
};

function harness(transport: FrappeTransport, session?: { user: string; roles?: string[] }) {
  const client = createFrappeClient({ transport });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={session}>{children}</FrappeProvider></QueryClientProvider>
    </ThemeProvider>
  );
  return { client, qc, wrapper };
}

// ---- 1. the six scenarios, all six columns ------------------------------------------------------------------------

describe("SIMULATED permission matrix: six DocPerm scenarios × rolePermissions / canImport / canExport / bulkMenu / usePermissions", () => {
  for (const s of SCENARIOS) {
    it(`${s.name} (role "${s.role}"): exactly ${COLUMNS.filter((c) => s.expect[c]).join(", ")}`, () => {
      expect(columnsFor([s.role], meta(1))).toEqual(s.expect);
      // usePermissions with FrappeProvider session (no doc → role rights, perm.js:50-52): same five doc-level columns
      const { wrapper } = harness(noop, { user: "u@x", roles: [s.role] });
      const { result } = renderHook(() => usePermissions(bundleOf(meta(1))), { wrapper });
      for (const c of ["read", "create", "write", "delete"] as const) expect(result.current.can(c), c).toBe(s.expect[c]);
      expect(result.current.known).toBe(true);
      // Import and Export are DocType-level decisions (model.js:434-450), never `can()` on a document
      expect(canImport(meta(1), [s.role], result.current.levels[0])).toBe(s.expect.import);
      expect(canExport([s.role], result.current.levels[0])).toBe(s.expect.export);
      // the list's Actions menu (list_view.js:1855-2128 as the package reproduces it)
      const menu = bulkMenu({ permissions: result.current.levels[0], isSubmittable: false, hasWorkflow: false, allowEdit: false, hasEditableFields: true });
      expect(menu.includes("delete")).toBe(s.expect.delete);
      expect(menu.includes("edit")).toBe(s.expect.write);
      expect(menu.includes("assign")).toBe(s.expect.read || s.expect.write); // assign_to.py:67-68: read on each document
      expect(menu).not.toContain("submit"); expect(menu).not.toContain("cancel"); // not submittable
    });
  }

  it("rights are not interchangeable: Write ⇏ Delete, Create ⇏ Import, Export ⇏ Import, Import ⇏ Export", () => {
    const editor = columnsFor(["Editor"], meta(1)); expect(editor.write).toBe(true); expect(editor.delete).toBe(false);
    const creator = columnsFor(["Creator"], meta(1)); expect(creator.create).toBe(true); expect(creator.import).toBe(false);
    const exporter = columnsFor(["Exporter"], meta(1)); expect(exporter.export).toBe(true); expect(exporter.import).toBe(false);
    const importer = columnsFor(["Importer"], meta(1)); expect(importer.import).toBe(true); expect(importer.export).toBe(false);
    // and Read alone grants none of the others
    expect(columnsFor(["Reader"], meta(1))).toEqual(row({ read: true }));
  });

  it("Import needs the DocType's allow_import (permissions.py:142, 221; data_import.py:64; model.js:435): allow_import 0 → false even with the import right", () => {
    expect(columnsFor(["Importer"], meta(0))).toEqual(row({ read: true, create: true }));
    expect(canImport(meta(0), ["System Manager"], undefined)).toBe(false); // even System Manager (model.js:435 is checked first; the server's can_import :599-605 would say yes, but Data Import refuses allow_import 0 at data_import.py:64)
    expect(canImport(meta(1), ["System Manager"], undefined)).toBe(true); // System Manager may import an importable DocType without a row
    expect(canExport(["System Manager"], undefined)).toBe(true); // can_export :609-611
  });

  it("a loaded document's docinfo.permissions.import is always 0 (permissions.py:221): doc-level can('import') is false while canImport is true", () => {
    const { wrapper } = harness(noop, { user: "u@x", roles: ["Importer"] });
    const { result } = renderHook(() => usePermissions(bundleOf(meta(1)), saved(), docinfo({ read: 1, create: 1, import: 0 })), { wrapper });
    expect(result.current.can("import")).toBe(false);
    expect(canImport(meta(1), ["Importer"], level0(["Importer"]))).toBe(true);
  });
});

// ---- 2. missing information (rule 9) --------------------------------------------------------------------------------

describe("SIMULATED rule 9: missing information denies", () => {
  it("no roles, no meta → nothing; known === false", () => {
    const { wrapper } = harness(noop, { user: "u@x" });
    const { result } = renderHook(() => usePermissions(undefined, NEW_DOC), { wrapper });
    for (const c of COLUMNS) expect(result.current.can(c), c).toBe(false);
    expect(result.current.known).toBe(false);
    expect(canImport(undefined, undefined, undefined)).toBe(false);
    expect(canExport(undefined, undefined)).toBe(false);
    expect(readableFields(meta(1).fields, undefined)).toEqual([]);
    expect(bulkMenu({ permissions: undefined, isSubmittable: true, hasWorkflow: false, allowEdit: true, hasEditableFields: true })).toEqual([]);
  });

  it("no roles, meta present, NEW doc → no read / create / write; every field None; known === false", () => {
    const { wrapper } = harness(noop, { user: "u@x" });
    const { result } = renderHook(() => usePermissions(bundleOf(meta(1)), NEW_DOC), { wrapper });
    for (const c of COLUMNS) expect(result.current.can(c), c).toBe(false);
    for (const f of meta(1).fields) expect(result.current.fieldStatus(f, NEW_DOC), f.fieldname).toBe("None");
    expect(result.current.known).toBe(false);
    expect(permissionsKnown({ doc: NEW_DOC, session: { user: "u@x" } })).toBe(false);
  });

  it("no session at all → the same denial", () => {
    expect(buildDocPermissions({ meta: meta(1), doc: NEW_DOC })[0]).toEqual({});
    expect(buildDocPermissions({ meta: meta(1) })[0]).toEqual({});
    expect(buildDocPermissions({ doc: saved(), docinfo: docinfo({ read: 1, write: 1 }) })).toEqual([{ read: false }]); // no meta: perm.js:62-70 (read only for the Administrator)
  });

  it("no roles, SAVED doc with server docinfo → exactly the server's level 0, nothing at permlevel 1; known === true", () => {
    const { wrapper } = harness(noop, { user: "u@x" });
    const { result } = renderHook(() => usePermissions(bundleOf(meta(1)), saved(), docinfo({ read: 1, write: 1, create: 1, delete: 0, export: 1 })), { wrapper });
    expect(result.current.can("read")).toBe(true); expect(result.current.can("write")).toBe(true); expect(result.current.can("create")).toBe(true);
    expect(result.current.can("delete")).toBe(false); expect(result.current.can("export")).toBe(true); expect(result.current.can("import")).toBe(false);
    expect(result.current.can("read", 1)).toBe(false); expect(result.current.can("write", 1)).toBe(false); // no inference from the doc carrying `margin`
    expect(result.current.fieldStatus(meta(1).fields[2], saved())).toBe("None");
    expect(result.current.known).toBe(true);
  });

  it("the form for a new doc without roles renders the read-only notice and no Save (FrappeForm → usePermissions().known)", async () => {
    const transport: FrappeTransport = async (method) => {
      if (method === "frappe.desk.form.load.getdoctype") return { docs: (todoEn as { docs: DocTypeMeta[] }).docs, user_settings: "{}" };
      return {};
    };
    const { wrapper: Wrapper } = harness(transport, { user: "u@x" });
    render(<Wrapper><FrappeForm doctype="ToDo" /></Wrapper>);
    const notice = await screen.findByText("Read only"); // the skeleton's loading status is also role="status"
    expect(notice.getAttribute("data-permissions")).toBe("unknown");
    expect(notice.getAttribute("role")).toBe("status");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    cleanup();
  });

  it("the Administrator user is not 'missing information': the server grants it everything (permissions.py:107-109)", () => {
    const l = buildDocPermissions({ meta: meta(1), doc: NEW_DOC, session: { user: "Administrator" } });
    for (const c of COLUMNS) expect(l[0][c], c).toBe(true);
    expect(l[1]?.read).toBe(true); expect(l[1]?.write).toBe(true);
    expect(permissionsKnown({ doc: NEW_DOC, session: { user: "Administrator" } })).toBe(true);
    expect(canImport(meta(0), ["Administrator"], l[0])).toBe(false); // allow_import still gates Import (model.js:435)
  });
});

// ---- 3. permission-denied responses -----------------------------------------------------------------------------------

describe("SIMULATED permission-denied responses: FrappeError kind 'permission' surfaces; no optimistic cache change", () => {
  const seeded = saved({ title: "server copy", modified: "2026-11-03 10:00:00" });

  it("savedocs 403 → useSaveDoc rejects with kind permission; the cached doc is untouched", async () => {
    const { qc, wrapper } = harness(deny(["frappe.desk.form.save.savedocs"]), { user: "u@x", roles: ["Editor"] });
    qc.setQueryData(frappeKeys.doc("Deal", "D-1"), seeded);
    const inv = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useSaveDoc(), { wrapper });
    let err: unknown;
    await act(async () => { try { await result.current.mutateAsync({ doc: { ...seeded, title: "edited", __unsaved: 1 }, action: "Save" }); } catch (e) { err = e; } });
    expect(err).toBeInstanceOf(FrappeError);
    expect((err as FrappeError).kind).toBe("permission");
    expect((err as FrappeError).status).toBe(403);
    expect(qc.getQueryData(frappeKeys.doc("Deal", "D-1"))).toEqual(seeded);
    expect(inv).not.toHaveBeenCalled();
  });

  it("frappe.client.delete 403 → useDocAction().remove rejects with kind permission; doc and docinfo stay cached", async () => {
    const { qc, wrapper } = harness(deny(["frappe.client.delete"]), { user: "u@x", roles: ["Editor"] });
    qc.setQueryData(frappeKeys.doc("Deal", "D-1"), seeded);
    qc.setQueryData(frappeKeys.docinfo("Deal", "D-1"), docinfo({ read: 1, write: 1 }));
    const { result } = renderHook(() => useDocAction(), { wrapper });
    await expect(act(() => result.current.remove.mutateAsync({ doctype: "Deal", name: "D-1" }))).rejects.toMatchObject({ kind: "permission", status: 403 });
    expect(qc.getQueryData(frappeKeys.doc("Deal", "D-1"))).toEqual(seeded);
    expect(qc.getQueryData(frappeKeys.docinfo("Deal", "D-1"))).toBeDefined();
  });

  it("direct invocation: bulkDelete with a 403 stub rejects (kind permission); nothing is reported as deleted", async () => {
    const client = createFrappeClient({ transport: deny(["frappe.desk.reportview.delete_items"]) });
    await expect(bulkDelete(client, "Deal", ["A", "B"])).rejects.toMatchObject({ kind: "permission" });
  });

  it("direct invocation: api.download with a 403 files transport rejects with kind permission (export / print)", async () => {
    const client = createFrappeClient({
      transport: noop,
      files: { download: async () => { throw new FrappeError("You are not allowed to export Deal doctype", 403, "PermissionError"); }, upload: async () => { throw new Error("unused"); } },
    });
    await expect(client.download("frappe.core.doctype.data_export.exporter.export_data", { doctype: "Deal" })).rejects.toMatchObject({ kind: "permission", status: 403 });
  });

  it("bulk mixed outcome: submit_cancel_or_update_docs answers the failed names → BulkOutcome.failed is exactly them", async () => {
    const client = createFrappeClient({ transport: async (method) => (method.endsWith("submit_cancel_or_update_docs") ? { message: ["B", "D"] } : {}) });
    const out = await bulkSubmitCancelOrUpdate(client, "Deal", ["A", "B", "C", "D"], "submit");
    expect(out).toEqual({ failed: ["B", "D"], queued: false });
    // delete_items answers nothing (reportview.py:575-620: failures arrive as a realtime msgprint), so failed is [] by contract
    const del = await bulkDelete(createFrappeClient({ transport: async () => ({ message: null }) }), "Deal", ["A", "B"]);
    expect(del).toEqual({ failed: [], queued: false });
  });
});

// ---- 4. document-level overlays ----------------------------------------------------------------------------------------

describe("SIMULATED document-level overlays (get_doc_permissions → docinfo.permissions; shared; revocation)", () => {
  it("permission revoked after load: docinfo.permissions.write 0 beats the role's write; a re-render with new docinfo flips can('write')", () => {
    const { wrapper } = harness(noop, { user: "u@x", roles: ["Editor"] });
    let info = docinfo({ read: 1, write: 1 });
    const { result, rerender } = renderHook(() => usePermissions(bundleOf(meta(1)), saved(), info), { wrapper });
    expect(result.current.can("write")).toBe(true);
    info = docinfo({ read: 1, write: 0 });
    rerender();
    expect(result.current.can("write")).toBe(false);
    expect(result.current.fieldStatus(meta(1).fields[0], saved())).toBe("Read");
  });

  it("User Permissions: docinfo.permissions.read 0 beats role read on a saved doc (permissions.py:232-244)", () => {
    const { wrapper } = harness(noop, { user: "u@x", roles: ["Owner"] });
    const { result } = renderHook(() => usePermissions(bundleOf(meta(1)), saved({ owner: "someone@else" }), docinfo({ read: 0, write: 0, create: 0, delete: 0 })), { wrapper });
    for (const c of ["read", "write", "create", "delete"] as const) expect(result.current.can(c), c).toBe(false);
    expect(result.current.fieldStatus(meta(1).fields[0], saved())).toBe("None");
  });

  it("empty docinfo.permissions {} with roles keeps the role rights (Desk parity perm.js:78-82; the server refuses getdoc before {} can reach a client, load.py:40) — documented, not inferred", () => {
    const l = buildDocPermissions({ meta: meta(1), doc: saved(), docinfo: docinfo({}), session: { user: "u@x", roles: ["Editor"] } });
    expect(l[0].write).toBe(true);
    // without roles the same {} grants nothing (rule 9)
    expect(buildDocPermissions({ meta: meta(1), doc: saved(), docinfo: docinfo({}), session: { user: "u@x" } })[0]).toEqual({});
  });

  it("shared document: the user's docinfo.shared row grants read / write / submit / share only; export, import, delete, create stay false", () => {
    const shared = docinfo({ read: 0, write: 0, create: 0, delete: 0, export: 0, import: 0 }, { shared: [{ user: "u@x", read: 1, write: 1, submit: 1, share: 1 }] } as never);
    for (const session of [{ user: "u@x", roles: ["Reader"] }, { user: "u@x" }]) {
      const l = buildDocPermissions({ meta: meta(1), doc: saved({ owner: "someone@else" }), docinfo: shared, session });
      expect(l[0]).toMatchObject({ read: true, write: true, submit: true, share: true, export: false, create: false, delete: false });
      expect(l[0].import).toBeFalsy();
    }
    // another user's share row is ignored (perm.js:90)
    const other = docinfo({ read: 0, write: 0 }, { shared: [{ user: "v@x", read: 1, write: 1 }] } as never);
    expect(buildDocPermissions({ meta: meta(1), doc: saved({ owner: "someone@else" }), docinfo: other, session: { user: "u@x", roles: ["Reader"] } })[0].write).toBe(false);
  });

  it("if_owner: rights granted only by if_owner rows are removed for a non-owner (perm.js:84-88)", () => {
    const perms: DocPerm[] = [{ role: "Scoped", permlevel: 0, read: 1, write: 1, delete: 1, if_owner: 1 }, { role: "Scoped", permlevel: 0, read: 1 }];
    const m = meta(1, perms);
    const mine = buildDocPermissions({ meta: m, doc: saved({ owner: "u@x" }), docinfo: docinfo({ read: 1, write: 1, delete: 1 }), session: { user: "u@x", roles: ["Scoped"] } });
    expect(mine[0]).toMatchObject({ read: true, write: true, delete: true });
    const theirs = buildDocPermissions({ meta: m, doc: saved({ owner: "v@x" }), docinfo: docinfo({ read: 1, write: 1, delete: 1 }), session: { user: "u@x", roles: ["Scoped"] } });
    expect(theirs[0]).toMatchObject({ read: true, write: false, delete: false });
  });
});

// ---- 5. restricted fields (permlevel) ----------------------------------------------------------------------------------

describe("SIMULATED restricted fields: permlevel 1 without read → None; readableFields drops them", () => {
  const m = meta(1);
  const margin = m.fields[2];
  it("a role without a permlevel-1 row: the field is None and not readable", () => {
    const levels = buildDocPermissions({ meta: m, doc: saved(), docinfo: docinfo({ read: 1, write: 1 }), session: { user: "u@x", roles: ["Editor"] } });
    expect(levels[1]).toEqual({});
    expect(fieldDisplayStatus(margin, saved(), levels)).toBe("None");
    expect(readableFields(m.fields, levels).map((f) => f.fieldname)).toEqual(["title", "amount"]);
    // the server strips the value (db_query.py:668-760 apply_fieldlevel_read_permissions; load.py:53): a doc WITHOUT the key is the normal case
    const stripped = saved(); delete stripped.margin;
    expect(fieldDisplayStatus(margin, stripped, levels)).toBe("None");
    expect(readableFields(m.fields, levels).some((f) => f.fieldname in stripped)).toBe(true);
  });
  it("the Full role (permlevel-1 read + write): Write on a draft, Read on a submitted doc", () => {
    const levels = buildDocPermissions({ meta: m, doc: saved(), docinfo: docinfo({ read: 1, write: 1 }), session: { user: "u@x", roles: ["Owner"] } });
    expect(fieldDisplayStatus(margin, saved(), levels)).toBe("Write");
    expect(fieldDisplayStatus(margin, saved({ docstatus: 1 }), levels)).toBe("Read");
    expect(readableFields(m.fields, levels).map((f) => f.fieldname)).toEqual(["title", "amount", "margin"]);
  });
  it("level 0 without read → no field is readable, whatever the higher levels say", () => {
    expect(readableFields(m.fields, [{ read: false }, { read: true }])).toEqual([]);
  });
});

// ---- 6. Administrator vs normal user -----------------------------------------------------------------------------------

describe("SIMULATED Administrator vs normal user", () => {
  it("the Administrator role holder gets everything the DocPerm rows allow it (rolePermissions), and the Administrator user everything regardless", () => {
    const viaRows = level0(["Administrator"]);
    expect(viaRows).toMatchObject({ read: true, write: true, create: true, delete: true, import: true, export: true });
    expect(viaRows.submit).toBeFalsy(); // the rows did not grant submit — rolePermissions reads rows only
    const viaUser = buildDocPermissions({ meta: meta(1), doc: saved(), docinfo: docinfo({ read: 1 }), session: { user: "Administrator" } });
    expect(viaUser[0].submit).toBe(true); expect(viaUser[0].delete).toBe(true); expect(viaUser[1]?.write).toBe(true);
    expect(canImport(meta(1), ["Administrator"], viaRows)).toBe(true);
    expect(canExport(["Administrator"], viaRows)).toBe(true);
  });
  it("the 'Administrator' ROLE on another user is just a role: its DocPerm rows, no blanket grant (permissions.py:107 is keyed on the user name; role.py:92-95)", () => {
    const l = buildDocPermissions({ meta: meta(1), doc: saved(), docinfo: docinfo({ read: 1, write: 1, create: 1, delete: 1 }), session: { user: "u@x", roles: ["Administrator"] } });
    expect(l[0]).toMatchObject({ read: true, write: true, create: true, delete: true, import: true, export: true });
    expect(l[0].submit).toBeFalsy(); // no row grants it
    expect(l[1]).toEqual({}); // no permlevel-1 row for the role
    expect(buildDocPermissions({ doc: saved(), session: { user: "u@x", roles: ["Administrator"] } })).toEqual([{ read: true }]); // no meta: perm.js:62-64
  });

  it("a normal user with no matching role gets nothing: no action, no field, no menu entry", () => {
    const { wrapper } = harness(noop, { user: "u@x", roles: ["All", "Desk User", "Unrelated Role"] });
    const { result } = renderHook(() => usePermissions(bundleOf(meta(1)), saved(), docinfo({ read: 0 })), { wrapper });
    for (const c of COLUMNS) expect(result.current.can(c), c).toBe(false);
    for (const f of meta(1).fields) expect(result.current.fieldStatus(f, saved()), f.fieldname).toBe("None");
    expect(result.current.known).toBe(true); // known AND denied — not "unknown"
    expect(canImport(meta(1), ["Unrelated Role"], result.current.levels[0])).toBe(false);
    expect(canExport(["Unrelated Role"], result.current.levels[0])).toBe(false);
    expect(bulkMenu({ permissions: result.current.levels[0], isSubmittable: true, hasWorkflow: false, allowEdit: true, hasEditableFields: true })).toEqual([]);
    expect(readableFields(meta(1).fields, result.current.levels)).toEqual([]);
  });
});

