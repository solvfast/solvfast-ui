/**
 * Phase 27 import — the Data Import UI over the Phase 26 sequence: preview grid, warnings, column mapper, start,
 * progress and result. SIMULATED: stub transports (`createFrappeClient({ transport, files })`); the assertions are about
 * the METHOD NAMES, ARGUMENT SHAPES and ORDER Desk sends (Frappe 15.110 source, cited inline) and about what the UI does
 * with the server's answers. Nothing here is evidence of behaviour on a real site: every import step is a write there
 * (BLOCKED). No import is ever simulated on the client: the stubs stand for the server's answers.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, configure, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createFrappeClient, type FrappeTransport } from "../src/frappe";
import type { MetaBundle } from "../src/frappe/contract";
import type { UploadFileOptions } from "../src/frappe/client";
import { DATA_IMPORT_METHODS, attachImportFile, createDataImport, importRunning, remapImportColumns, startDataImport, useImportStatus, type DataImportDoc, type ImportPreview } from "../src/frappe/list/import";
import {
  DATA_IMPORT_LABELS_EN as L, DONT_IMPORT, changedColumnMap, columnMappingValue, displayDateFormat, groupImportWarnings, importPickerOptions,
  importResultMessage, importedRowNumbers, mergeColumnToFieldMap, parseLogMessages, previewCell, previewColumns,
} from "../src/frappe/list/importMapping";

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// ---- fixtures: a submittable DocType with a child table, `autoname: field:title` -----------------------------------
const ITEM_META = {
  name: "Sales Order Item", istable: 1,
  fields: [
    { fieldname: "item_code", label: "Item Code", fieldtype: "Link", options: "Item", reqd: 1 },
    { fieldname: "qty", label: "Quantity", fieldtype: "Float" },
    { fieldname: "sb1", fieldtype: "Section Break" },
  ],
};
const ORDER_META = {
  name: "Sales Order", is_submittable: 1, allow_import: 1, autoname: "field:title",
  fields: [
    { fieldname: "title", label: "Title", fieldtype: "Data", reqd: 1 },
    { fieldname: "customer", label: "Customer", fieldtype: "Link", options: "Customer" },
    { fieldname: "delivery_date", label: "Delivery Date", fieldtype: "Date" },
    { fieldname: "lft", label: "Left", fieldtype: "Int" },
    { fieldname: "computed", label: "Computed", fieldtype: "Data", is_virtual: 1 },
    { fieldname: "cb1", fieldtype: "Column Break" },
    { fieldname: "items", label: "Items", fieldtype: "Table", options: "Sales Order Item" },
    { fieldname: "notes_html", label: "Notes", fieldtype: "HTML" },
  ],
};
const BUNDLE = { doctype: "Sales Order", meta: ORDER_META, children: { "Sales Order Item": ITEM_META } } as unknown as MetaBundle;

/** What `get_preview_from_template` answers for a file `Title, Customer Name, Item Code (Items), Delivery Date` (importer.py:480-513). */
const PREVIEW: ImportPreview = {
  columns: [
    { header_title: "Sr. No", skip_import: true },
    { index: 0, column_number: 1, header_title: "Title", skip_import: false, df: { fieldname: "title", label: "Title", fieldtype: "Data", parent: "Sales Order" } },
    { index: 1, column_number: 2, header_title: "Customer Name", skip_import: true, df: null },
    { index: 2, column_number: 3, header_title: "Item Code (Items)", skip_import: false, df: { fieldname: "item_code", label: "Item Code", fieldtype: "Link", parent: "Sales Order Item" }, is_child_table_field: true, child_table_df: { fieldname: "items", label: "Items", options: "Sales Order Item" } },
    { index: 3, column_number: 4, header_title: "Delivery Date", skip_import: false, date_format: "%d-%m-%Y", df: { fieldname: "delivery_date", label: "Delivery Date", fieldtype: "Date", parent: "Sales Order" } },
  ],
  data: [[2, "SO-A", "ACME", "ITEM-1", "03-11-2026"], [3, "SO-B", null, "ITEM-2"]],
  warnings: [
    { col: "2", message: "Cannot match column <strong>Customer Name</strong> with any field", type: "info" },
    { row: 3, field: { label: "Item Code", parent: "Sales Order Item", fieldname: "item_code" }, message: "Value <strong>ITEM-2</strong> missing for <strong>Item</strong>" },
    { row: 3, message: "Row has less values than columns" },
    { row: 2, field: { label: "Title", parent: "Sales Order", fieldname: "title" }, message: "Value must be one of A, B" },
  ],
  import_log: [{ row_indexes: "[2]", success: 1 }, { row_indexes: "[3]", success: 0 }],
  max_rows_exceeded: true, max_rows_in_preview: 10, total_number_of_rows: 25,
};

// ---------------------------------------------------------------------------------------------------------------------
describe("Column picker (data_exporter.js:311-357 get_columns_for_picker; import_preview.js:334-358 get_fields_as_options)", () => {
  it("ID first for the DocType and every table (even with a field: autoname); child values are <table fieldname>.<fieldname>, labels 'Label (Table Label)'", () => {
    const opts = importPickerOptions(BUNDLE);
    expect(opts.map((o) => o.value)).toEqual(["name", "title", "customer", "delivery_date", "items.name", "items.item_code", "items.qty"]);
    expect(opts.map((o) => o.label)).toEqual(["ID", "Title", "Customer", "Delivery Date", "ID (Items)", "Item Code (Items)", "Quantity (Items)"]);
    // exportable_fields: no layout / HTML / Table, no lft / rgt, no virtual field (data_exporter.js:314-326)
    expect(opts.some((o) => ["lft", "computed", "cb1", "items", "notes_html", "items.sb1"].includes(o.value))).toBe(false);
    expect(opts[5]).toMatchObject({ description: "items.item_code", doctype: "Sales Order Item" });
  });

  it("the pre-selected value per column (import_preview.js:246-255): no df → Don't Import; map_to_field; child → table.field; else fieldname", () => {
    const cols = PREVIEW.columns!;
    expect(columnMappingValue(cols[1])).toBe("title");
    expect(columnMappingValue(cols[2])).toBe(DONT_IMPORT);
    expect(columnMappingValue(cols[3])).toBe("items.item_code");
    expect(columnMappingValue({ header_title: "Cust", map_to_field: "customer", df: { fieldname: "customer", label: "Customer" } })).toBe("customer");
  });

  it("changed_map is keyed by FILE column index = preview index − 1 (import_preview.js:312-315; importer.py:826 reads str(j))", () => {
    expect(changedColumnMap({ 2: "customer", 3: DONT_IMPORT })).toEqual({ "1": "customer", "2": DONT_IMPORT });
    expect(changedColumnMap({ 0: "title" })).toEqual({}); // Sr. No is never mapped
  });

  it("template_options: changed entries Object.assign-ed over column_to_field_map, other keys kept (data_import.js:303-307)", () => {
    const next = JSON.parse(mergeColumnToFieldMap(JSON.stringify({ column_to_field_map: { "0": "title", "5": "customer" }, other: 1 }), { "0": "customer", "2": DONT_IMPORT }));
    expect(next).toEqual({ column_to_field_map: { "0": "customer", "5": "customer", "2": DONT_IMPORT }, other: 1 });
    expect(JSON.parse(mergeColumnToFieldMap(null, { "1": "customer" }))).toEqual({ column_to_field_map: { "1": "customer" } });
    expect(JSON.parse(mergeColumnToFieldMap("not json", { "1": "customer" }))).toEqual({ column_to_field_map: { "1": "customer" } });
  });
});

describe("Preview layout and warnings (import_preview.js:48-131; data_import.js:333-406)", () => {
  it("columns: Sr. No; matched with the server's field (child with its table label) and display date format; skipped with no field", () => {
    const v = previewColumns(PREVIEW);
    expect(v[0]).toMatchObject({ srNo: true });
    expect(v[1]).toMatchObject({ title: "Title", skipped: false, field: "Title" });
    expect(v[2]).toMatchObject({ title: "Customer Name", skipped: true, field: null });
    expect(v[3]).toMatchObject({ title: "Item Code (Items)", skipped: false, field: "Item Code (Items)" });
    expect(v[4]).toMatchObject({ dateFormat: "dd-mm-yyyy" });
    expect(displayDateFormat("%Y-%m-%d %H:%M:%S")).toBe("yyyy-mm-dd HH:mm:ss");
    expect(previewColumns({ columns: [{ header_title: "Sr. No", skip_import: true }, { header_title: "", skip_import: true, df: null }] })[1].title).toBeNull(); // "Untitled Column"
    // null / missing cells are "" (a short row); rows already imported come from SUCCESS logs only
    expect(previewCell(PREVIEW.data![1], 2)).toBe("");
    expect(previewCell(PREVIEW.data![1], 4)).toBe("");
    expect([...importedRowNumbers(PREVIEW)]).toEqual([2]);
  });

  it("warnings: template_warnings first, then the preview's; grouped by row ascending; field label + (parent) for a child field; col '2' heads 'Column 2 (Customer Name)'; duplicates once", () => {
    const template = [{ row: 3, message: "Row has less values than columns" }, { col: 4, message: "Date format could not be determined" }];
    const g = groupImportWarnings([...template, ...PREVIEW.warnings!], PREVIEW.columns, "Sales Order");
    expect(g.rows.map((r) => r.row)).toEqual([2, 3]);
    expect(g.rows[0].items).toEqual([{ field: "Title", message: "Value must be one of A, B", type: undefined }]);
    expect(g.rows[1].items.map((i) => i.field)).toEqual([null, "Item Code (Sales Order Item)"]); // the template's row-3 warning, then the preview's (its duplicate dropped)
    expect(g.other).toEqual([
      { col: 4, header: "Delivery Date", message: "Date format could not be determined", type: undefined },
      { col: 2, header: "Customer Name", message: "Cannot match column <strong>Customer Name</strong> with any field", type: "info" },
    ]);
    expect(g.total).toBe(5);
  });

  it("result headline from the server's counts (data_import.js:139-171): insert / update, singular, partial, Timed Out hint; nothing without a total", () => {
    expect(importResultMessage({ status: "Success", success: 4, failed: 0, total: 4, importType: "Insert New Records" }, L)).toBe("Successfully imported 4 records.");
    expect(importResultMessage({ status: "Success", success: 1, failed: 0, total: 1, importType: "Update Existing Records" }, L)).toBe("Successfully updated 1 record.");
    expect(importResultMessage({ status: "Partial Success", success: 3, failed: 1, total: 4, importType: "Insert New Records" }, L)).toMatch(/^Successfully imported 3 records out of 4\. Click on Export Errored Rows/);
    expect(importResultMessage({ status: "Timed Out", success: 2, failed: 0, total: 4, importType: "Insert New Records" }, L)).toBe("Successfully imported 2 records. Import timed out, please re-try.");
    expect(importResultMessage({ status: "Error", success: 0, failed: 0, total: 0, importType: "Insert New Records" }, L)).toBeNull();
  });

  it("log messages: json.dumps(message_log) of msgprint dicts (importer.py:190, 1284), tolerant of double encoding", () => {
    expect(parseLogMessages({ messages: JSON.stringify([{ message: "Value missing for <b>Customer</b>", title: "Message", indicator: "red", raise_exception: 1 }]) })).toEqual([{ title: "Message", message: "Value missing for <b>Customer</b>" }]);
    expect(parseLogMessages({ messages: JSON.stringify(JSON.stringify([JSON.stringify({ message: "x" })])) })).toEqual([{ message: "x" }]);
    expect(parseLogMessages({ messages: JSON.stringify("[]") })).toEqual([]);
    expect(parseLogMessages({ messages: null })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
type Seen = { method: string; args: Record<string, unknown> };
const saved = (args: Record<string, unknown>, over: Record<string, unknown> = {}) => {
  const doc = JSON.parse(String(args.doc)) as Record<string, unknown>;
  const { __islocal, __unsaved, ...rest } = doc; void __islocal; void __unsaved;
  return { docs: [{ ...rest, name: "DI-0001", status: "Pending", ...over }] };
};

describe("Request shapes (data_import.js; attach.js:137-144)", () => {
  it("createDataImport + attachImportFile = startDataImport's steps 1–3; a second file goes to the SAME Data Import (no second create)", async () => {
    const seen: Seen[] = [];
    let n = 0;
    const transport: FrappeTransport = async (method, args) => { seen.push({ method, args }); if (method === DATA_IMPORT_METHODS.save) return saved(args, { modified: `m${++n}` }); throw new Error(method); };
    const upload = vi.fn(async (_f: Blob, filename: string, _o?: UploadFileOptions) => ({ doctype: "File", name: `F-${filename}`, file_url: `/private/files/${filename}` }));
    const api = createFrappeClient({ transport, files: { download: async () => { throw new Error("no"); }, upload } });
    const doc = await createDataImport(api, { referenceDoctype: "Sales Order", importType: "Update Existing Records", submitAfterImport: true });
    expect(JSON.parse(String(seen[0].args.doc))).toMatchObject({ doctype: "Data Import", __islocal: 1, reference_doctype: "Sales Order", import_type: "Update Existing Records", submit_after_import: 1, mute_emails: 1 });
    const a = await attachImportFile(api, doc, new Blob(["x"]), "a.csv");
    const b = await attachImportFile(api, a, new Blob(["y"]), "b.csv");
    expect(seen.map((s) => s.method)).toEqual([DATA_IMPORT_METHODS.save, DATA_IMPORT_METHODS.save, DATA_IMPORT_METHODS.save]);
    expect(upload.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ["a.csv", { doctype: "Data Import", docname: "DI-0001", fieldname: "import_file", isPrivate: true }],
      ["b.csv", { doctype: "Data Import", docname: "DI-0001", fieldname: "import_file", isPrivate: true }],
    ]);
    expect(JSON.parse(String(seen[2].args.doc))).toMatchObject({ name: "DI-0001", import_file: "/private/files/b.csv", modified: "m2" }); // the saved doc's modified is sent back
    expect(b.import_file).toBe("/private/files/b.csv");
  });

  it("startDataImport (Phase 26 signature) is unchanged: save → upload → save → preview → start", async () => {
    const seen: string[] = [];
    const transport: FrappeTransport = async (method, args) => {
      seen.push(method);
      if (method === DATA_IMPORT_METHODS.save) return saved(args);
      if (method === DATA_IMPORT_METHODS.preview) { expect(args).toEqual({ data_import: "DI-0001", import_file: "/private/files/t.csv" }); return { message: PREVIEW }; }
      if (method === DATA_IMPORT_METHODS.start) return { message: false };
      throw new Error(method);
    };
    const api = createFrappeClient({ transport, files: { download: async () => { throw new Error("no"); }, upload: async () => ({ doctype: "File", name: "F", file_url: "/private/files/t.csv" }) } });
    const out = await startDataImport(api, { referenceDoctype: "Sales Order", importType: "Insert New Records", file: new Blob(["x"]), filename: "t.csv" });
    expect(seen).toEqual([DATA_IMPORT_METHODS.save, DATA_IMPORT_METHODS.save, DATA_IMPORT_METHODS.preview, DATA_IMPORT_METHODS.start]);
    expect(out.started).toBe(false); // "already queued", not an error
  });

  it("remapImportColumns: savedocs with template_options = {column_to_field_map} merged over the saved one, THEN get_preview_from_template again (data_import.js:302-309, 265-271)", async () => {
    const seen: Seen[] = [];
    const transport: FrappeTransport = async (method, args) => {
      seen.push({ method, args });
      if (method === DATA_IMPORT_METHODS.save) return saved(args, { modified: "m-after-map" });
      if (method === DATA_IMPORT_METHODS.preview) return { message: { ...PREVIEW, warnings: [{ message: "Mapping column <b>Customer Name</b> to field <b>Customer</b>", type: "info" }] } };
      throw new Error(method);
    };
    const api = createFrappeClient({ transport });
    const doc = { doctype: "Data Import", name: "DI-0001", modified: "m1", reference_doctype: "Sales Order", import_type: "Insert New Records", import_file: "/private/files/t.csv", template_options: JSON.stringify({ column_to_field_map: { "3": "delivery_date" } }) } as DataImportDoc;
    const out = await remapImportColumns(api, doc, changedColumnMap({ 2: "customer" }));
    expect(seen.map((s) => s.method)).toEqual([DATA_IMPORT_METHODS.save, DATA_IMPORT_METHODS.preview]);
    expect(seen[0].args.action).toBe("Save");
    const sent = JSON.parse(String(seen[0].args.doc)) as Record<string, unknown>;
    expect(sent).toMatchObject({ name: "DI-0001", modified: "m1", import_file: "/private/files/t.csv" });
    expect(JSON.parse(String(sent.template_options))).toEqual({ column_to_field_map: { "3": "delivery_date", "1": "customer" } });
    expect(seen[1].args).toEqual({ data_import: "DI-0001", import_file: "/private/files/t.csv" });
    expect(out.doc.modified).toBe("m-after-map");
    expect(out.preview?.warnings?.[0].message).toMatch(/Mapping column/); // the SERVER's answer, shown as returned
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("Polling stop conditions (importRunning; importer.py:73, 81-90, 183-184, 220-240)", () => {
  const st = (status: string, success = 0, failed = 0, total = 4) => ({ status: status as never, success, failed, total });

  it("matrix: Pending runs unless warnings; Partial Success runs until every payload is logged; Success / Error / Timed Out stop", () => {
    expect(importRunning(st("Pending"), [])).toBe(true);
    expect(importRunning(st("Pending"), [{ message: "x" }])).toBe(false);
    expect(importRunning(st("Partial Success", 1, 0), [])).toBe(true); // set after the FIRST successful row
    expect(importRunning(st("Partial Success", 3, 1), [])).toBe(false);
    expect(importRunning(st("Success", 4), [])).toBe(false);
    expect(importRunning(st("Error", 0, 4), [])).toBe(false);
    expect(importRunning(st("Timed Out", 2), [])).toBe(false);
    // since = modified when Start / Retry was sent: an untouched document means the job has not run yet
    expect(importRunning(st("Error", 0, 4), [], { modified: "m1" }, "m1")).toBe(true);
    expect(importRunning(st("Error", 0, 4), [], { modified: "m2" }, "m1")).toBe(false);
  });

  const hook = (answers: { status: Record<string, unknown>; doc: Record<string, unknown> }[], since?: string) => {
    let i = 0;
    const calls: string[] = [];
    const api = {
      call: async (m: string) => { calls.push(m); return { message: answers[Math.min(i, answers.length - 1)].status }; },
      getDoc: async (dt: string, name: string) => { const a = answers[Math.min(i++, answers.length - 1)]; return { doc: { doctype: dt, name, ...a.doc }, docinfo: {} as never }; },
    };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // every distinct answer the hook reported, in order (the queued phase may last a single poll)
    const history: Record<string, unknown>[] = [];
    const r = renderHook(() => {
      const out = useImportStatus(api as never, "DI-1", { intervalMs: 25, since });
      const p = out.progress;
      if (p && history[history.length - 1]?.doc !== p.doc) history.push({ ...p });
      return out;
    }, { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });
    return { ...r, calls, history };
  };

  it("Retry after Partial Success: the old status is ignored until the server writes the document; mid-run Partial Success keeps polling; stops at every row logged", async () => {
    const { result, calls, history } = hook([
      { status: { status: "Partial Success", success: 3, failed: 1, total_records: 4 }, doc: { modified: "m1" } }, // queued: previous run's numbers
      { status: { status: "Partial Success", success: 3, failed: 0, total_records: 4 }, doc: { modified: "m2" } }, // running: failures deleted, 3 + 0 < 4
      { status: { status: "Partial Success", success: 3, failed: 1, total_records: 4 }, doc: { modified: "m3" } }, // finished
    ], "m1");
    await waitFor(() => expect(result.current.progress?.doc?.modified).toBe("m3"));
    expect(history.map((h) => [(h.doc as { modified: string }).modified, h.queued, h.running])).toEqual([["m1", true, true], ["m2", false, true], ["m3", false, false]]);
    expect(result.current.progress).toMatchObject({ running: false, queued: false, success: 3, failed: 1 });
    const n = calls.length;
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(calls.length).toBe(n);
  });

  it("Start after warnings stopped a run: old template_warnings + same modified = still queued; new warnings after the job wrote = stopped", async () => {
    const w = JSON.stringify([{ col: 2, message: "The following values do not exist for Customer: X", type: "warning" }]);
    const { result, history } = hook([
      { status: { status: "Pending", total_records: 4 }, doc: { modified: "m5", template_warnings: w } },
      { status: { status: "Pending", total_records: 4 }, doc: { modified: "m6", template_warnings: w } },
    ], "m5");
    await waitFor(() => expect(result.current.progress?.doc?.modified).toBe("m6"));
    expect(history.map((h) => [(h.doc as { modified: string }).modified, h.queued, h.running])).toEqual([["m5", true, true], ["m6", false, false]]);
    expect(result.current.progress).toMatchObject({ running: false, status: "Pending" });
    expect(result.current.progress?.warnings).toHaveLength(1);
  });
});
