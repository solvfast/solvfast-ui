/**
 * Phase 26 list-io — Import / Export / permlevel columns / bulk outcomes of `FrappeListView`. SIMULATED: stub transports
 * and a stub file transport; the assertions are about the METHOD NAMES and ARGUMENT SHAPES Desk sends, read from the
 * Frappe 15.110 source (citations inline). Nothing here is evidence of behaviour on a real site, and no file is ever
 * produced from client data: `download` is stubbed to return a blob that stands for the server's answer.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, configure, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, FrappeError, type FrappeTransport } from "../src/frappe";
import { dataImportListUrl } from "../src/frappe/FrappeListView";
import type { FrappeFilesTransport } from "../src/frappe/client";
import type { DocPermissions, FrappeDocField, MetaBundle } from "../src/frappe/contract";
import type { DocMeta } from "../src/frappe/client";
import { DOWNLOAD_TEMPLATE_METHOD, downloadExportTemplate, exportPickerGroups, mandatorySelection, saveFile, selectedNamesFilter } from "../src/frappe/list/export";
import { DATA_IMPORT_METHODS, getImportStatus, parseTemplateWarnings, startDataImport, useImportStatus } from "../src/frappe/list/import";
import { buildFrappeListMeta, restrictMetaToReadable } from "../src/frappe/meta";
import { canExport, canImport, readableFields, rolePermissions } from "../src/frappe/services/permissions";
import { defaultMessages } from "../src/theme/messages";
import { TODO_META, createMockFrappe, type MockFrappe } from "../playground/src/demo/mock-frappe";

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const en = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && tr.querySelectorAll("td").length > 1);
const openMenu = (name: string | RegExp) => fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" }); // Radix menus open from the keyboard in jsdom
const t = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];

/** ToDo with DocPerm rows and `allow_import`; `secret` sits at permlevel 1 (only System Manager reads level 1). */
const PERMS = [
  { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, import: 1, export: 1 },
  { role: "System Manager", permlevel: 1, read: 1, write: 1 },
  { role: "Guest", permlevel: 0, read: 1 },
  { role: "Importer", permlevel: 0, read: 1, import: 1 },
  { role: "Exporter", permlevel: 0, read: 1, write: 1, export: 1 },
];
const META = (over: Record<string, unknown> = {}) => ({
  ...TODO_META, allow_import: 1, permissions: PERMS,
  fields: [...TODO_META.fields, { fieldname: "secret", label: "Secret", fieldtype: "Data", permlevel: 1, in_list_view: 1 }],
  ...over,
});

const dl = (answer: () => Promise<{ blob: Blob; filename: string; contentType: string }> = async () => ({ blob: new Blob(["server"]), filename: "ToDo.csv", contentType: "text/csv" })) => {
  const seen: { method: string; args: Record<string, unknown> }[] = [];
  const files: FrappeFilesTransport = { download: async (method, args) => { seen.push({ method, args }); return answer(); }, upload: async () => { throw new Error("not used"); } };
  return { seen, files };
};

function mountList(roles: string[] | undefined, meta: Record<string, unknown>, props: Partial<React.ComponentProps<typeof FrappeListView>> = {}, extra?: (m: string, a: Record<string, unknown>, next: () => Promise<Record<string, unknown>>) => Promise<Record<string, unknown>> | undefined, files?: FrappeFilesTransport) {
  const mock: MockFrappe = createMockFrappe();
  const transport: FrappeTransport = async (m, a) => {
    // the playground mock only knows ToDo's real fields: a request for the extra `secret` column is served without it
    const strip = (args: Record<string, unknown>) => (typeof args.fields === "string" ? { ...args, fields: JSON.stringify((JSON.parse(args.fields) as string[]).filter((f) => !f.includes("secret"))) } : args);
    const next = () => (m === "frappe.desk.form.load.getdoctype" ? Promise.resolve({ docs: [meta], user_settings: "{}" }) : mock.transport(m, strip(a)));
    return (extra?.(m, a, next) ?? next()) as never;
  };
  const client = createFrappeClient({ transport, files });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={roles ? { user: "u@x.com", roles } : undefined}><FrappeListView doctype="ToDo" storage={null} {...props} /></FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...ui, mock, calls: (method: string) => mock.calls.filter((c) => c.method === method) };
}

// ---------------------------------------------------------------------------------------------------------------------
describe("Export request (data_exporter.js:104-132 → data_import.py:178-202)", () => {
  it("downloadExportTemplate POSTs download_template with Desk's five fields; objects JSON-encoded as open_url_post does (urllib.js:66-67)", async () => {
    const { seen, files } = dl();
    const api = createFrappeClient({ transport: async () => ({}), files });
    const file = await downloadExportTemplate(api, { doctype: "ToDo", fileType: "Excel", exportRecords: "by_filter", exportFields: { ToDo: ["name", "status"], items: ["name", "qty"] }, exportFilters: selectedNamesFilter("ToDo", ["A", "B"]) });
    expect(seen).toHaveLength(1);
    expect(seen[0].method).toBe(DOWNLOAD_TEMPLATE_METHOD);
    expect(seen[0].args).toEqual({
      doctype: "ToDo", file_type: "Excel", export_records: "by_filter",
      export_fields: JSON.stringify({ ToDo: ["name", "status"], items: ["name", "qty"] }),
      export_filters: JSON.stringify([["ToDo", "name", "in", ["A", "B"]]]), // bulk_operations.js:470-472, sliced to 4 (data_exporter.js:259-263)
    });
    expect(file.filename).toBe("ToDo.csv");
  });

  it("export_filters is null unless by_filter (data_exporter.js:120-123); blank_template sends no data", async () => {
    const { seen, files } = dl();
    const api = createFrappeClient({ transport: async () => ({}), files });
    await downloadExportTemplate(api, { doctype: "ToDo", fileType: "CSV", exportRecords: "blank_template", exportFields: { ToDo: ["name"] }, exportFilters: [["ToDo", "status", "=", "Open"]] });
    expect(seen[0].args.export_filters).toBeNull();
    expect(seen[0].args.export_records).toBe("blank_template");
  });

  it("a 403 from the server is a permission FrappeError and NO file (exporter.py:116-126 / download_template's read check)", async () => {
    const { files } = dl(async () => { throw new FrappeError("You are not allowed to export ToDo doctype", 403, "PermissionError"); });
    const api = createFrappeClient({ transport: async () => ({}), files });
    const err = await downloadExportTemplate(api, { doctype: "ToDo", fileType: "CSV", exportRecords: "all", exportFields: { ToDo: ["name"] } }).catch((e) => e as FrappeError);
    expect(err).toBeInstanceOf(FrappeError);
    expect((err as FrappeError).kind).toBe("permission");
    expect((err as FrappeError).status).toBe(403);
  });

  it("saveFile only hands the server's blob to the browser; without createObjectURL (jsdom) it declines and never builds a file", () => {
    const file = { blob: new Blob(["x"]), filename: "ToDo.csv", contentType: "text/csv" };
    const u = globalThis.URL as unknown as { createObjectURL?: unknown };
    const had = u.createObjectURL;
    delete u.createObjectURL;
    expect(saveFile(file)).toBe(false);
    const create = vi.fn(() => "blob:x"), revoke = vi.fn();
    Object.assign(globalThis.URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    expect(saveFile(file)).toBe(true);
    expect(create).toHaveBeenCalledWith(file.blob);
    expect(click).toHaveBeenCalled();
    if (had) u.createObjectURL = had; else delete u.createObjectURL;
  });
});

describe("Export field picker (data_exporter.js:265-357, exporter.py:52-110)", () => {
  const bundle: MetaBundle = {
    doctype: "Order",
    meta: { name: "Order", autoname: "field:code", fields: [
      { fieldname: "sec", fieldtype: "Section Break" }, { fieldname: "code", label: "Code", fieldtype: "Data", reqd: 1 },
      { fieldname: "lft", fieldtype: "Int" }, { fieldname: "virt", label: "Virtual", fieldtype: "Data", is_virtual: 1 },
      { fieldname: "note", label: "Note", fieldtype: "Small Text", permlevel: 1 }, { fieldname: "photo", label: "Photo", fieldtype: "Attach" },
      { fieldname: "items", label: "Items", fieldtype: "Table", options: "Order Item", reqd: 1 }, { fieldname: "tags", label: "Tags", fieldtype: "Table MultiSelect", options: "Order Tag" },
    ] },
    children: { "Order Item": { name: "Order Item", fields: [{ fieldname: "item", label: "Item", fieldtype: "Link", options: "Item", reqd: 1 }, { fieldname: "qty", label: "Qty", fieldtype: "Float" }] },
      "Order Tag": { name: "Order Tag", fields: [{ fieldname: "tag", label: "Tag", fieldtype: "Link", options: "Tag" }] } },
  } as unknown as MetaBundle;

  it("groups: the DocType under its name, child tables under the TABLE FIELDNAME (exporter.py:63-67); ID first, autoname field hides ID", () => {
    const groups = exportPickerGroups(bundle);
    expect(groups.map((g) => g.key)).toEqual(["Order", "items", "tags"]);
    expect(groups[0].fields.map((f) => f.fieldname)).toEqual(["code", "note", "photo"]); // no Section Break / lft / virtual / Table; Attach IS exportable; no "name" (autoname field:)
    expect(groups[0].fields.find((f) => f.fieldname === "code")?.mandatory).toBe(true);
    expect(groups[1].fields.map((f) => f.fieldname)).toEqual(["name", "item", "qty"]);
    expect(groups[1].reqd).toBe(true);
    expect(groups[2].doctype).toBe("Order Tag");
  });

  it("Select Mandatory (data_exporter.js:175-198): danger fields of the DocType and of reqd child tables only; Update mode marks only name / autoname", () => {
    expect(mandatorySelection(exportPickerGroups(bundle))).toEqual({ Order: ["code"], items: ["name", "item"] });
    expect(mandatorySelection(exportPickerGroups(bundle, { importType: "Update Existing Records" }))).toEqual({ Order: ["code"], items: ["name"] });
  });

  it("with the user's levels the picker drops permlevel fields they cannot read (package addition; the server strips them anyway)", () => {
    const levels: DocPermissions = [{ read: true, export: true }, { read: false }];
    expect(exportPickerGroups(bundle, { levels })[0].fields.map((f) => f.fieldname)).toEqual(["code", "photo"]);
    expect(exportPickerGroups(bundle, { levels: [{ read: true }, { read: true }] })[0].fields.map((f) => f.fieldname)).toEqual(["code", "note", "photo"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("Import sequence (data_import.js; attach.js:137-144; handler.py:175-260)", () => {
  it("startDataImport: savedocs → upload_file (Data Import / import_file / private) → savedocs with import_file → get_preview_from_template → form_start_import", async () => {
    const seen: { method: string; args: Record<string, unknown> }[] = [];
    const uploads: { filename: string; opts: Record<string, unknown> }[] = [];
    const transport: FrappeTransport = async (method, args) => {
      seen.push({ method, args });
      if (method === DATA_IMPORT_METHODS.save) { const doc = JSON.parse(String(args.doc)) as Record<string, unknown>; const { __islocal, __unsaved, ...rest } = doc; void __islocal; void __unsaved; return { docs: [{ ...rest, name: "DI-0001", modified: "2026-11-03 10:00:00.000000", status: "Pending" }] }; }
      if (method === DATA_IMPORT_METHODS.preview) return { message: { columns: [{ header_title: "ID" }], data: [["x"]], warnings: [] } };
      if (method === DATA_IMPORT_METHODS.start) return { message: true };
      throw new Error(method);
    };
    const files: FrappeFilesTransport = { download: async () => { throw new Error("no"); }, upload: async (_file, filename, opts) => { seen.push({ method: "upload_file", args: opts as Record<string, unknown> }); uploads.push({ filename, opts: opts as Record<string, unknown> }); return { doctype: "File", name: "F-1", file_url: "/private/files/todos.csv" }; } };
    const api = createFrappeClient({ transport, files });
    const out = await startDataImport(api, { referenceDoctype: "ToDo", importType: "Insert New Records", file: new Blob(["ID\n"]), filename: "todos.csv" });

    expect(seen.map((s) => s.method)).toEqual([DATA_IMPORT_METHODS.save, "upload_file", DATA_IMPORT_METHODS.save, DATA_IMPORT_METHODS.preview, DATA_IMPORT_METHODS.start]);
    // 1. the new Data Import, as frm.save sends it (local name, __islocal; save.py:16-23 / set_local_name)
    const first = JSON.parse(String(seen[0].args.doc)) as Record<string, unknown>;
    expect(seen[0].args.action).toBe("Save");
    expect(first).toMatchObject({ doctype: "Data Import", __islocal: 1, reference_doctype: "ToDo", import_type: "Insert New Records", submit_after_import: 0, mute_emails: 1 });
    expect(String(first.name)).toMatch(/^new-data-import-/);
    expect(first.import_file).toBeUndefined();
    // 2. the file attached to the saved document (handler.py:201-204 form fields; FileUploader's doctype/docname/fieldname)
    expect(uploads[0]).toEqual({ filename: "todos.csv", opts: { doctype: "Data Import", docname: "DI-0001", fieldname: "import_file", isPrivate: true } });
    // 3. the second save carries import_file = file_url (attach.js:139-141); the server parses the template in validate
    const second = JSON.parse(String(seen[2].args.doc)) as Record<string, unknown>;
    expect(second).toMatchObject({ name: "DI-0001", import_file: "/private/files/todos.csv" });
    expect(second.__islocal).toBeUndefined();
    // 4. + 5. (data_import.js:265-271, 202-206)
    expect(seen[3].args).toEqual({ data_import: "DI-0001", import_file: "/private/files/todos.csv" });
    expect(seen[4].args).toEqual({ data_import: "DI-0001" });
    expect(out).toMatchObject({ name: "DI-0001", started: true });
    expect(out.preview?.columns).toHaveLength(1);
  });

  it("a refusal on the first save (no import right: data_import.py:71-75, or no create on Data Import) stops the sequence — nothing uploaded", async () => {
    const seen: string[] = [];
    const transport: FrappeTransport = async (method) => { seen.push(method); throw new FrappeError("You do not have import permission for ToDo", 403, "PermissionError"); };
    const upload = vi.fn();
    const api = createFrappeClient({ transport, files: { download: async () => { throw new Error("no"); }, upload } });
    const err = await startDataImport(api, { referenceDoctype: "ToDo", importType: "Insert New Records", file: new Blob(), filename: "x.csv" }).catch((e) => e as FrappeError);
    expect((err as FrappeError).kind).toBe("permission");
    expect(seen).toEqual([DATA_IMPORT_METHODS.save]);
    expect(upload).not.toHaveBeenCalled();
  });

  it("getImportStatus maps get_import_status (data_import.py:219-242); template_warnings parse to a list", async () => {
    const api = createFrappeClient({ transport: async (m, a) => { expect(m).toBe(DATA_IMPORT_METHODS.status); expect(a).toEqual({ data_import_name: "DI-1" }); return { message: { status: "Partial Success", success: 3, failed: 1, total_records: 4 } }; } });
    expect(await getImportStatus(api, "DI-1")).toEqual({ status: "Partial Success", success: 3, failed: 1, total: 4 });
    expect(parseTemplateWarnings({ template_warnings: JSON.stringify([{ col: 2, message: "Cannot match column X with any field" }]) })).toEqual([{ col: 2, message: "Cannot match column X with any field" }]);
    expect(parseTemplateWarnings({ template_warnings: null })).toEqual([]);
    expect(parseTemplateWarnings(undefined)).toEqual([]);
  });
});

describe("useImportStatus (polling stand-in for data_import_refresh / data_import_progress)", () => {
  const hook = (statuses: Record<string, unknown>[], doc: Record<string, unknown> = {}) => {
    let i = 0;
    const calls: string[] = [];
    const api = {
      call: async (m: string) => { calls.push(m); return { message: statuses[Math.min(i++, statuses.length - 1)] }; },
      getDoc: async (dt: string, n: string) => { calls.push(`getdoc:${dt}/${n}`); return { doc: { doctype: dt, name: n, ...doc }, docinfo: {} as never }; },
    };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const r = renderHook(() => useImportStatus(api as never, "DI-9", { intervalMs: 30 }), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });
    return { ...r, calls };
  };

  it("keeps polling while Pending without warnings, stops once the status leaves Pending", async () => {
    const { result, calls } = hook([{ status: "Pending", total_records: 4 }, { status: "Pending", success: 2, total_records: 4 }, { status: "Success", success: 4, total_records: 4 }]);
    await waitFor(() => expect(result.current.progress?.running).toBe(true));
    expect(calls.filter((c) => c === DATA_IMPORT_METHODS.status).length).toBeGreaterThanOrEqual(1);
    expect(calls).toContain("getdoc:Data Import/DI-9");
    await waitFor(() => expect(result.current.progress?.status).toBe("Success"));
    expect(result.current.progress).toMatchObject({ running: false, success: 4, total: 4, warnings: [] });
    const n = calls.filter((c) => c === DATA_IMPORT_METHODS.status).length;
    await act(() => new Promise((r) => setTimeout(r, 120)));
    expect(calls.filter((c) => c === DATA_IMPORT_METHODS.status).length).toBe(n); // no further polls
  });

  it("template warnings stop the job before importing (importer.py:81-90): Pending, not running, warnings surfaced", async () => {
    const { result } = hook([{ status: "Pending", total_records: 3 }], { template_warnings: JSON.stringify([{ col: 1, message: "Cannot match column Foo with any field" }]) });
    await waitFor(() => expect(result.current.progress).toBeTruthy());
    expect(result.current.progress).toMatchObject({ status: "Pending", running: false });
    expect(result.current.progress?.warnings[0].message).toMatch(/Cannot match column/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("Menu gating in FrappeListView (model.js:434-450; list_view.js:1703-1712, 2075-2092; owner decision Phase 27 #1)", () => {
  it("canImport / canExport against the DocPerm rows", () => {
    const lv = (roles: string[]) => rolePermissions(PERMS as never, roles).levels[0];
    expect(canImport({ allow_import: 1 }, ["Importer"], lv(["Importer"]))).toBe(true);
    expect(canImport({ allow_import: 0 }, ["Importer"], lv(["Importer"]))).toBe(false);
    expect(canImport({ allow_import: 0 }, ["System Manager"], lv(["System Manager"]))).toBe(false); // allow_import wins even for System Manager (permissions.py:142-144)
    expect(canImport({ allow_import: 1 }, ["Guest"], lv(["Guest"]))).toBe(false);
    expect(canExport(["Exporter"], lv(["Exporter"]))).toBe(true);
    expect(canExport(["Guest"], lv(["Guest"]))).toBe(false);
    expect(canExport(undefined, undefined)).toBe(false);
  });

  it("System Manager: the menu offers Import and Export; Import calls onImport", async () => {
    const onImport = vi.fn();
    mountList(["System Manager"], META(), { onImport });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    openMenu("More actions");
    expect(screen.getByRole("menuitem", { name: /Import/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Export/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: /Import/ }));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  // Owner decision Phase 27 #1: Export is offered like Desk — pushed unconditionally (list_view.js:2075-2092) — and the
  // server refuses a user without the right (data_import/exporter.py:116-126 `can_export`). This REVERSES the Phase 26
  // rule D.1 assertions ("a read-only role sees no menu", "Export hidden for an importer").
  it("a read-only role (no export right) still gets Export in the menu and in the selection bar, as Desk; no Import", async () => {
    const { unmount } = mountList(["Guest"], META(), { onImport: vi.fn(), selectable: true });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    openMenu("More actions");
    expect(screen.getByRole("menuitem", { name: /Export/ })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Import/ })).toBeNull(); // Import keeps Desk's can_import gate (list_view.js:1703)
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(await screen.findByRole("button", { name: "Export" })).toBeTruthy();
    unmount();
    // no session roles: Import is denied (rule 9), Export is still offered — the server decides
    mountList(undefined, META(), { bulk: {} });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    openMenu("More actions");
    expect(screen.getByRole("menuitem", { name: /Export/ })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Import/ })).toBeNull();
  });

  it("menu={{ export: false }} (or an app's own canExport) still hides Export; menu={false} removes the menu", async () => {
    const { unmount } = mountList(["Guest"], META(), { menu: { export: canExport(["Guest"], rolePermissions(PERMS as never, ["Guest"]).levels[0]) } });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    unmount();
    mountList(["System Manager"], META(), { menu: false, onImport: vi.fn() });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("Import is hidden when the DocType has allow_import = 0, even for a role with the import right; Export stays", async () => {
    const { unmount } = mountList(["Importer"], META({ allow_import: 0 }), { onImport: vi.fn() });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    openMenu("More actions");
    expect(screen.queryByRole("menuitem", { name: /Import/ })).toBeNull();
    expect(screen.getByRole("menuitem", { name: /Export/ })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    unmount();
    mountList(["Importer"], META(), { onImport: vi.fn() });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    openMenu("More actions");
    expect(screen.getByRole("menuitem", { name: /Import/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Export/ })).toBeTruthy(); // Desk shows Export here too (list_view.js:2092)
  });

  it("Import without onImport navigates to Desk's Data Import LIST filtered on the DocType (set_route('list','data-import',{reference_doctype}))", async () => {
    // router.js:431-440 keeps {reference_doctype} in frappe.route_options and pushes /app/data-import; from outside Desk the
    // options travel as the query string, which router.js:548-566 reads back into route_options
    expect(dataImportListUrl("Sales Order")).toBe("/app/data-import?reference_doctype=Sales%20Order");
    expect(new URLSearchParams(dataImportListUrl("A&B/C").split("?")[1]).get("reference_doctype")).toBe("A&B/C");
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    try {
      mountList(["System Manager"], META());
      await waitFor(() => expect(bodyRows()).toHaveLength(20));
      openMenu("More actions");
      fireEvent.click(screen.getByRole("menuitem", { name: /Import/ }));
      expect(assign).toHaveBeenCalledWith("/app/data-import?reference_doctype=ToDo");
    } finally { vi.unstubAllGlobals(); }
  });

  it("Exporter role: Export in the menu; with `selectable` also in the selection bar; the bar's Export posts by_filter on the checked names", async () => {
    const { seen, files } = dl();
    const { mock } = mountList(["Exporter"], META(), { onImport: vi.fn(), selectable: true }, undefined, files);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    openMenu("More actions");
    expect(screen.queryByRole("menuitem", { name: /Import/ })).toBeNull();
    expect(screen.getByRole("menuitem", { name: /Export/ })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(screen.getAllByRole("checkbox")[2]);
    fireEvent.click(await screen.findByRole("button", { name: "Export" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Export Data")).toBeTruthy();
    // permlevel 1 `secret` is not offered to this role; the ID and the DocType's own fields are
    expect(within(dialog).queryByText("secret")).toBeNull();
    expect(within(dialog).getByText("status")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Select All" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(seen).toHaveLength(1));
    const names = mock.rows.slice().sort((a, b) => String(b.modified).localeCompare(String(a.modified))).slice(0, 2).map((r) => r.name);
    expect(seen[0].method).toBe(DOWNLOAD_TEMPLATE_METHOD);
    expect(seen[0].args.export_records).toBe("by_filter");
    const filters = JSON.parse(String(seen[0].args.export_filters)) as unknown[][];
    expect(filters).toHaveLength(1);
    expect(filters[0].slice(0, 3)).toEqual(["ToDo", "name", "in"]);
    expect((filters[0][3] as string[]).slice().sort()).toEqual(names.slice().sort());
    const fields = JSON.parse(String(seen[0].args.export_fields)) as Record<string, string[]>;
    expect(fields.ToDo).toContain("name");
    expect(fields.ToDo).toContain("status");
    expect(fields.ToDo).not.toContain("secret");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); // closed after the server answered; no toast
  });

  it("a role WITHOUT the export right opens the dialog; the server's 403 is shown as a permission error — no success, no file", async () => {
    const { seen, files } = dl(async () => { throw new FrappeError("You are not allowed to export ToDo doctype", 403, "PermissionError"); });
    const save = vi.fn(() => "blob:x");
    Object.assign(globalThis.URL, { createObjectURL: save });
    mountList(["Guest"], META(), { selectable: true }, undefined, files);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(await screen.findByRole("button", { name: "Export" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Select All" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0].args.export_records).toBe("by_filter"); // the request is Desk's; only the server decides
    expect(await within(dialog).findByText(en("feErrPermission"))).toBeTruthy(); // FrappeErrorState, kind "permission"
    expect(within(dialog).getByText(/not allowed to export/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull(); // no success line anywhere
    delete (globalThis.URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  });

  it("the dialog shows the server's refusal and stays open; no file was saved", async () => {
    const { seen, files } = dl(async () => { throw new FrappeError("You are not allowed to export ToDo doctype", 403, "PermissionError"); });
    const save = vi.fn(() => "blob:x");
    Object.assign(globalThis.URL, { createObjectURL: save });
    mountList(["Exporter"], META(), {}, undefined, files);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    openMenu("More actions");
    fireEvent.click(screen.getByRole("menuitem", { name: /Export/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0].args.export_records).toBe("blank_template"); // Desk's default when exporting for "Insert New Records" (data_exporter.js:45-46)
    expect(await within(dialog).findByText(/not allowed to export/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    delete (globalThis.URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("Permlevel columns", () => {
  it("restrictMetaToReadable drops level-1 fields for a level-0-only user; keeps everything when levels are unknown or level 0 unreadable", () => {
    const meta = META() as unknown as DocMeta;
    const guest = rolePermissions(PERMS as never, ["Guest"]).levels;
    expect(restrictMetaToReadable(meta, {}, guest).meta.fields.map((f: { fieldname: string }) => f.fieldname)).not.toContain("secret");
    const sm = rolePermissions(PERMS as never, ["System Manager"]).levels;
    expect(restrictMetaToReadable(meta, {}, sm).meta.fields.map((f: { fieldname: string }) => f.fieldname)).toContain("secret");
    expect(restrictMetaToReadable(meta, {}, undefined).meta).toBe(meta);
    expect(restrictMetaToReadable(meta, {}, rolePermissions(PERMS as never, ["Nobody"]).levels).meta).toBe(meta); // level 0 unreadable: untouched, the server's 403 explains
    expect(readableFields(META().fields as unknown as FrappeDocField[], guest).map((f) => f.fieldname)).not.toContain("secret");
    const built = buildFrappeListMeta(restrictMetaToReadable(meta, {}, guest).meta, (k) => k as string);
    expect(built.columns.map((c) => c.key)).not.toContain("secret");
    expect(built.known.has("secret")).toBe(false);
  });

  it("in the list: a level-0 role never sees the Secret column and never requests the field", async () => {
    const { calls } = mountList(["Guest"], META());
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    expect([...document.querySelectorAll("thead th")].map((h) => h.textContent?.trim())).not.toContain("Secret");
    expect(calls("frappe.desk.reportview.get").length).toBeGreaterThan(0);
    for (const c of calls("frappe.desk.reportview.get")) expect((Array.isArray(c.args.fields) ? c.args.fields : JSON.parse(String(c.args.fields))) as string[]).not.toContain("secret");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("Bulk outcomes (FrappeBulkActions)", () => {
  it("mixed result: the server's failed names are shown, no success line; the list reloads for the ones that passed", async () => {
    let failed: string[] = [];
    const { mock, calls } = mountList(["System Manager"], META(), { bulk: {} }, (m, a) => {
      if (m !== "frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs") return undefined;
      expect(a.action).toBe("update");
      const names = JSON.parse(String(a.docnames)) as string[];
      failed = [names[1], names[3]];
      return Promise.resolve({ message: failed });
    });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    for (const i of [1, 2, 3, 4]) fireEvent.click(screen.getAllByRole("checkbox")[i]);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkEdit") }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(en("listBulkValue")), { target: { value: "x" } });
    const before = calls("frappe.desk.reportview.get").length;
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkApply") }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status.textContent).toContain("2 succeeded, 2 failed"));
    expect(status.textContent).toContain(`${failed[0]}, ${failed[1]}`);
    await waitFor(() => expect(calls("frappe.desk.reportview.get").length).toBeGreaterThan(before));
    void mock;
  });

  it("a 403 on delete: the server's message, no reload, rows untouched", async () => {
    const { calls } = mountList(["System Manager"], META(), { bulk: {} }, (m) => {
      if (m !== "frappe.desk.reportview.delete_items") return undefined;
      return Promise.reject(new FrappeError("Not permitted", 403, "PermissionError"));
    });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkDelete") }));
    const before = calls("frappe.desk.reportview.get").length;
    fireEvent.click(await screen.findByRole("button", { name: t("confirm") }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status.textContent).toContain("Not permitted"));
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(calls("frappe.desk.reportview.get").length).toBe(before);
    expect(bodyRows()).toHaveLength(20);
  });
});
