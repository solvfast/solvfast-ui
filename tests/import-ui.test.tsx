/**
 * Phase 27 import — the Data Import UI over the Phase 26 sequence: preview grid, warnings, column mapper, start,
 * progress and result. SIMULATED: stub transports (`createFrappeClient({ transport, files })`); the assertions are about
 * the METHOD NAMES, ARGUMENT SHAPES and ORDER Desk sends (Frappe 15.110 source, cited inline) and about what the UI does
 * with the server's answers. Nothing here is evidence of behaviour on a real site: every import step is a write there
 * (BLOCKED). No import is ever simulated on the client: the stubs stand for the server's answers.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, configure, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeError, createFrappeClient, type FrappeTransport } from "../src/frappe";
import type { MetaBundle } from "../src/frappe/contract";
import type { FrappeFilesTransport, UploadFileOptions } from "../src/frappe/client";
import { FrappeDataImport, type ImportRealtimeSubscribe } from "../src/frappe/list/FrappeDataImport";
import { DATA_IMPORT_METHODS, attachImportFile, createDataImport, importRunning, remapImportColumns, startDataImport, useImportStatus, type DataImportDoc, type ImportLogRow, type ImportPreview } from "../src/frappe/list/import";
import {
  DATA_IMPORT_LABELS_AR, DATA_IMPORT_LABELS_EN as L, DONT_IMPORT, changedColumnMap, columnMappingValue, displayDateFormat, groupImportWarnings, importPickerOptions,
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
    expect(importRunning(st("Error", 0, 4), [], undefined, "m1")).toBe(true); // the document read failed: poll again
    expect(importRunning(st("Error", 0, 4), [], undefined)).toBe(false); // no `since`: Phase 26 behaviour
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

// =====================================================================================================================
// FrappeDataImport — the UI. A stub "server": every answer below stands for what Frappe would send; the poll answers
// whatever `sim.state` holds until the test changes it (so "not yet" states are observed deterministically).
// =====================================================================================================================
interface PollState { status: Record<string, unknown>; doc: Record<string, unknown> }
interface SimOptions {
  previews?: ImportPreview[];
  logs?: ImportLogRow[];
  failSave?: (n: number) => FrappeError | undefined;
  failUpload?: (n: number) => FrappeError | undefined;
  failStart?: FrappeError;
  startAnswer?: boolean;
}
interface Sim {
  seen: Seen[];
  state: PollState | null;
  methods(): string[];
  count(method: string): number;
  sent(method: string, i?: number): Record<string, unknown> | undefined;
  transport: FrappeTransport;
  files: FrappeFilesTransport;
}
function makeSim(o: SimOptions = {}): Sim {
  const seen: Seen[] = [];
  let saves = 0, uploads = 0, previews = 0;
  const sim: Sim = {
    seen,
    state: null,
    methods: () => seen.map((s) => s.method),
    count: (m: string) => seen.filter((s) => s.method === m).length,
    sent: (m: string, i = 0) => seen.filter((s) => s.method === m)[i]?.args,
    transport: (async (method, args) => {
      seen.push({ method, args });
      switch (method) {
        case DATA_IMPORT_METHODS.save: {
          saves++;
          const err = o.failSave?.(saves);
          if (err) throw err;
          return saved(args, { modified: `m${saves}`, status: (JSON.parse(String(args.doc)) as { status?: string }).status ?? "Pending" });
        }
        case DATA_IMPORT_METHODS.preview: { const list = o.previews ?? [PREVIEW]; return { message: list[Math.min(previews++, list.length - 1)] }; }
        case DATA_IMPORT_METHODS.start: if (o.failStart) throw o.failStart; return { message: o.startAnswer ?? true };
        case DATA_IMPORT_METHODS.status: return { message: sim.state?.status ?? { status: "Pending" } };
        case "frappe.desk.form.load.getdoc": return { docs: [{ doctype: "Data Import", name: "DI-0001", reference_doctype: "Sales Order", import_file: "/private/files/orders.csv", ...sim.state?.doc }], docinfo: {} };
        case DATA_IMPORT_METHODS.logs: return { message: o.logs ?? [] };
        case "frappe.desk.form.load.getdoctype": return { docs: [ORDER_META, ITEM_META] };
        default: throw new Error(`unexpected ${method}`);
      }
    }) as FrappeTransport,
    files: {
      upload: async (_file, filename, opts) => {
        seen.push({ method: "upload_file", args: { filename, ...opts } });
        const err = o.failUpload?.(++uploads);
        if (err) throw err;
        return { doctype: "File", name: `F-${uploads}`, file_url: `/private/files/${filename}` };
      },
      download: async (method, args) => { seen.push({ method, args }); return { blob: new Blob(["server csv"]), filename: "Sales Order.csv", contentType: "text/csv" }; },
    } as FrappeFilesTransport,
  };
  return sim;
}

function mount(sim: Sim, props: Partial<React.ComponentProps<typeof FrappeDataImport>> = {}, language: "en" | "ar" = "en") {
  const api = createFrappeClient({ transport: sim.transport, files: sim.files });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage={language} storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeDataImport api={api} doctype="Sales Order" bundle={BUNDLE} pollIntervalMs={20} {...props} /></QueryClientProvider>
    </ThemeProvider>,
  );
}

const chooseFile = (name = "orders.csv", content = "Title,Customer Name\nSO-A,ACME\n") =>
  fireEvent.change(screen.getByLabelText(L.importFile), { target: { files: [new File([content], name, { type: "text/csv" })] } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
async function uploadAndPreview(file?: string) {
  chooseFile(file);
  click(L.upload);
  return screen.findByRole("region", { name: L.preview });
}
const ON_SERVER = (modified: string, status: Record<string, unknown>, doc: Record<string, unknown> = {}): PollState => ({ status, doc: { modified, status: status.status, import_type: "Insert New Records", ...doc } });

describe("FrappeDataImport — upload, preview, warnings (data_import.js:250-406; import_preview.js:48-171)", () => {
  it("p275: the file picker is a DS button + the chosen file's name, translated — not the browser's 'Choose File / No file chosen'", () => {
    mount(makeSim(), {}, "ar");
    const input = screen.getByLabelText(DATA_IMPORT_LABELS_AR.importFile);
    expect(input.getAttribute("type")).toBe("file");
    expect(input.className).toContain("sr-only");
    expect(input.getAttribute("tabindex")).toBe("-1");
    const pick = screen.getByRole("button", { name: DATA_IMPORT_LABELS_AR.chooseFile });
    expect(pick.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText(DATA_IMPORT_LABELS_AR.noFileChosen!)).toBeTruthy();
    const clicked = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(pick);
    expect(clicked).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { files: [new File(["a"], "orders.csv", { type: "text/csv" })] } });
    expect(screen.getByText("orders.csv")).toBeTruthy();
    expect(screen.queryByText(DATA_IMPORT_LABELS_AR.noFileChosen!)).toBeNull();
  });
  it("Upload and Preview: savedocs → upload_file → savedocs → get_preview_from_template; the server's grid, mapped / skipped columns, max-rows notice and grouped warnings", async () => {
    const sim = makeSim();
    mount(sim);
    expect(screen.getByRole("button", { name: L.upload })).toHaveProperty("disabled", true); // no file yet
    expect(screen.getByLabelText(L.importFile).getAttribute("accept")).toBe(".csv,.xls,.xlsx"); // data_import.js:62-66
    expect(screen.getByRole("checkbox", { name: L.submitAfterImport })).toBeTruthy(); // submittable DocType (data_import.js:227-236)
    const grid = await uploadAndPreview();
    expect(sim.methods()).toEqual([DATA_IMPORT_METHODS.save, "upload_file", DATA_IMPORT_METHODS.save, DATA_IMPORT_METHODS.preview]);
    expect(sim.sent("upload_file")).toMatchObject({ filename: "orders.csv", doctype: "Data Import", docname: "DI-0001", fieldname: "import_file", isPrivate: true });
    expect(sim.sent(DATA_IMPORT_METHODS.preview)).toEqual({ data_import: "DI-0001", import_file: "/private/files/orders.csv" });

    const heads = within(grid).getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["Sr. No", "Title→ Title", `Customer Name${L.skipped}`, "Item Code (Items)→ Item Code (Items)", "Delivery Date (dd-mm-yyyy)→ Delivery Date"]);
    expect(grid.querySelector('[data-col="2"]')?.hasAttribute("data-skipped")).toBe(true);
    const rows = within(grid).getAllByRole("row").slice(1);
    expect(rows.map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent))).toEqual([["2", "SO-A", "ACME", "ITEM-1", "03-11-2026"], ["3", "SO-B", "", "ITEM-2", ""]]);
    expect(rows[0].hasAttribute("data-imported")).toBe(true); // import_log success for row 2 (import_preview.js:326-331)
    expect(screen.getByText("Showing only first 10 rows out of 25")).toBeTruthy();
    expect(screen.getByRole("button", { name: L.exportErroredRows })).toBeTruthy(); // the preview's import_log has a failure (import_preview.js:200-204)

    const w = screen.getByRole("region", { name: L.warnings });
    expect([...w.querySelectorAll("[data-row]")].map((e) => e.getAttribute("data-row"))).toEqual(["2", "3"]);
    expect(within(w.querySelector('[data-row="3"]') as HTMLElement).getByText(/Item Code \(Sales Order Item\):/)).toBeTruthy();
    expect(w.querySelector('[data-col="2"]')?.textContent).toMatch(/^Column 2 \(Customer Name\)Cannot match column Customer Name with any field$/);
    expect(w.querySelector('[data-col="2"] strong')?.textContent).toBe("Customer Name"); // server HTML through the allow-list, not as text
    expect(screen.getByRole("button", { name: L.startImport })).toBeTruthy();
    expect(screen.queryByText(/Successfully/)).toBeNull();
  });

  it("an empty file / no rows: the SECOND save's 417 is shown as the server sent it; another file goes to the SAME Data Import (one create)", async () => {
    const sim = makeSim({ failSave: (n) => (n === 2 ? new FrappeError("Import template should contain a Header and atleast one row.", 417, "ValidationError") : undefined) });
    mount(sim);
    chooseFile("empty.csv", "");
    click(L.upload);
    await screen.findByText("Import template should contain a Header and atleast one row.");
    expect(document.querySelector('[data-import-error="upload"] [data-kind]')?.getAttribute("data-kind")).toBe("validation");
    expect(sim.count(DATA_IMPORT_METHODS.preview)).toBe(0);
    expect(screen.queryByRole("region", { name: L.preview })).toBeNull();
    expect(screen.getByRole("combobox", { name: L.importType })).toHaveProperty("disabled", true); // the Data Import exists: its type is fixed
    await uploadAndPreview("fixed.csv");
    expect(sim.methods()).toEqual([DATA_IMPORT_METHODS.save, "upload_file", DATA_IMPORT_METHODS.save, "upload_file", DATA_IMPORT_METHODS.save, DATA_IMPORT_METHODS.preview]);
    expect(seen(sim, "upload_file").map((a) => [a.filename, a.docname])).toEqual([["empty.csv", "DI-0001"], ["fixed.csv", "DI-0001"]]);
    expect(JSON.parse(String(sim.sent(DATA_IMPORT_METHODS.save, 2)?.doc))).toMatchObject({ name: "DI-0001", modified: "m1", import_file: "/private/files/fixed.csv" });
  });

  it("an upload refusal (403 / 413 from upload_file): shown, nothing saved after it, no preview", async () => {
    const sim = makeSim({ failUpload: () => new FrappeError("File size exceeded the maximum allowed size of 10.0 MB", 413) });
    mount(sim);
    chooseFile();
    click(L.upload);
    await waitFor(() => expect(document.querySelector('[data-import-error="upload"]')).toBeTruthy());
    expect(document.querySelector('[data-import-error="upload"] [data-kind]')?.getAttribute("data-kind")).toBe("too_large");
    expect(sim.methods()).toEqual([DATA_IMPORT_METHODS.save, "upload_file"]);
  });

  it("403 on the first save (Data Import `create` is System Manager-only): the server's refusal + the role hint; nothing uploaded; in a dialog it stays open", async () => {
    const sim = makeSim({ failSave: () => new FrappeError("No permission for Data Import", 403, "PermissionError") });
    const onOpenChange = vi.fn();
    mount(sim, { open: true, onOpenChange, bundle: undefined }); // the meta is read with getdoctype when no bundle is given
    expect(await screen.findByRole("dialog")).toBeTruthy();
    await screen.findByRole("checkbox", { name: L.submitAfterImport });
    chooseFile();
    click(L.upload);
    await waitFor(() => expect(document.querySelector("[data-create-refused]")).toBeTruthy());
    expect(document.querySelector('[data-import-error="create"] [data-kind]')?.getAttribute("data-kind")).toBe("permission");
    expect(screen.getByText("No permission for Data Import")).toBeTruthy();
    expect(sim.methods()).toEqual(["frappe.desk.form.load.getdoctype", DATA_IMPORT_METHODS.save]);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("Download Template (data_import.js:214-221): the exporter dialog for the import type; the file is the server's download_template answer", async () => {
    const sim = makeSim();
    mount(sim);
    click(L.downloadTemplate);
    const dialog = await screen.findByRole("dialog", { name: "Export Data" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(sim.count("frappe.core.doctype.data_import.data_import.download_template")).toBe(1));
    expect(sim.sent("frappe.core.doctype.data_import.data_import.download_template")).toMatchObject({ doctype: "Sales Order", export_records: "blank_template", file_type: "CSV" });
    expect(sim.count(DATA_IMPORT_METHODS.save)).toBe(0); // no Data Import is created for a template
  });

  it("dialog mode: closing keeps the import (state + poll live in the component); reopened, the mapper works inside the dialog", async () => {
    const sim = makeSim();
    const api = createFrappeClient({ transport: sim.transport, files: sim.files });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Host() {
      const [open, setOpen] = React.useState(true);
      return (
        <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
          <QueryClientProvider client={qc}>
            <button type="button" onClick={() => setOpen(true)}>reopen</button>
            <FrappeDataImport api={api} doctype="Sales Order" bundle={BUNDLE} pollIntervalMs={20} open={open} onOpenChange={setOpen} />
          </QueryClientProvider>
        </ThemeProvider>
      );
    }
    render(<Host />);
    await uploadAndPreview();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "reopen" }));
    await screen.findByRole("dialog");
    expect(screen.getByRole("region", { name: L.preview })).toBeTruthy(); // same Data Import, no new requests
    expect(sim.methods()).toEqual([DATA_IMPORT_METHODS.save, "upload_file", DATA_IMPORT_METHODS.save, DATA_IMPORT_METHODS.preview]);

    click(L.mapColumns);
    const form = await screen.findByRole("form", { name: L.mapColumns });
    fireEvent.click(within(form).getByRole("combobox", { name: "Customer Name" }));
    fireEvent.click(await screen.findByRole("option", { name: "Customer customer" }));
    await waitFor(() => expect(within(form).getByRole("combobox", { name: "Customer Name" }).getAttribute("data-value")).toBe("customer"));
    expect(screen.getByRole("dialog")).toBeTruthy(); // picking in the popover did not dismiss the dialog
    fireEvent.click(within(form).getByRole("button", { name: L.saveMapping }));
    await waitFor(() => expect(sim.count(DATA_IMPORT_METHODS.preview)).toBe(2));
    expect(JSON.parse(String(JSON.parse(String(sim.sent(DATA_IMPORT_METHODS.save, 2)?.doc)).template_options))).toEqual({ column_to_field_map: { "1": "customer" } });
  });

  it("Arabic labels by default under language 'ar' (labels prop still overrides)", async () => {
    const sim = makeSim();
    mount(sim, { labels: { upload: "ارفع" } }, "ar");
    expect(screen.getByRole("heading", { name: "استيراد البيانات" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ارفع" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "تنزيل القالب" })).toBeTruthy();
  });
});

function seen(sim: Sim, method: string) { return sim.seen.filter((s) => s.method === method).map((s) => s.args); }

describe("FrappeDataImport — column mapping (import_preview.js:239-325; data_import.js:302-309)", () => {
  it("map a column, set one to Don't Import, map one to a CHILD-table field: savedocs template_options, then the preview AGAIN; the grid shows the server's new answer", async () => {
    const remapped: ImportPreview = {
      ...PREVIEW,
      columns: [
        PREVIEW.columns![0],
        { ...PREVIEW.columns![1], skip_import: true, map_to_field: DONT_IMPORT },
        { ...PREVIEW.columns![2], skip_import: false, map_to_field: "customer", df: { fieldname: "customer", label: "Customer", fieldtype: "Link", parent: "Sales Order" } },
        { ...PREVIEW.columns![3], map_to_field: "items.qty", df: { fieldname: "qty", label: "Quantity", fieldtype: "Float", parent: "Sales Order Item" } },
        PREVIEW.columns![4],
      ],
      warnings: [{ message: "Mapping column <b>Customer Name</b> to field <b>Customer</b>", type: "info" }],
      max_rows_exceeded: false,
    };
    const sim = makeSim({ previews: [PREVIEW, remapped] });
    mount(sim);
    await uploadAndPreview();
    click(L.mapColumns);
    const form = await screen.findByRole("form", { name: L.mapColumns });
    expect(within(form).getByText("Map columns from orders.csv to fields in Sales Order")).toBeTruthy();
    // pre-set to what the SERVER matched (import_preview.js:246-255)
    expect(within(form).getAllByRole("combobox").map((c) => c.getAttribute("data-value"))).toEqual(["title", DONT_IMPORT, "items.item_code", "delivery_date"]);

    const pick = async (column: string, option: string) => {
      fireEvent.click(within(form).getByRole("combobox", { name: column }));
      fireEvent.click(await screen.findByRole("option", { name: option }));
      await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    };
    await pick("Customer Name", "Customer customer");
    await pick("Title", DONT_IMPORT);
    await pick("Item Code (Items)", "Quantity (Items) items.qty");
    expect(within(form).getByRole("combobox", { name: "Customer Name" }).textContent).toBe("Customer");
    expect(sim.count(DATA_IMPORT_METHODS.save)).toBe(2); // nothing saved while picking
    fireEvent.click(within(form).getByRole("button", { name: L.saveMapping }));

    await waitFor(() => expect(sim.count(DATA_IMPORT_METHODS.preview)).toBe(2));
    expect(sim.methods().slice(4)).toEqual([DATA_IMPORT_METHODS.save, DATA_IMPORT_METHODS.preview]);
    const sent = JSON.parse(String(sim.sent(DATA_IMPORT_METHODS.save, 2)?.doc)) as Record<string, unknown>;
    expect(sent).toMatchObject({ name: "DI-0001", modified: "m2", import_file: "/private/files/orders.csv" });
    // FILE column indexes (preview index − 1): Title = 0, Customer Name = 1, Item Code (Items) = 2
    expect(JSON.parse(String(sent.template_options))).toEqual({ column_to_field_map: { "0": DONT_IMPORT, "1": "customer", "2": "items.qty" } });
    expect(sim.sent(DATA_IMPORT_METHODS.preview, 1)).toEqual({ data_import: "DI-0001", import_file: "/private/files/orders.csv" });

    const grid = await screen.findByRole("region", { name: L.preview });
    const heads = within(grid).getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads.slice(1, 4)).toEqual([`Title${L.skipped}`, "Customer Name→ Customer", "Item Code (Items)→ Quantity (Items)"]);
    expect(screen.getByRole("region", { name: L.warnings }).textContent).toMatch(/Mapping column Customer Name to field Customer/);
    expect(screen.queryByText(/Showing only first/)).toBeNull();
  });

  it("Save with nothing changed: no request (Desk: `if (changed.length > 0)`), back to the preview", async () => {
    const sim = makeSim();
    mount(sim);
    await uploadAndPreview();
    click(L.mapColumns);
    const form = await screen.findByRole("form", { name: L.mapColumns });
    fireEvent.click(within(form).getByRole("button", { name: L.saveMapping }));
    await screen.findByRole("region", { name: L.preview });
    expect(sim.count(DATA_IMPORT_METHODS.save)).toBe(2);
    expect(sim.count(DATA_IMPORT_METHODS.preview)).toBe(1);
  });
});

describe("FrappeDataImport — start, progress, result (data_import.js:6-52, 85-176, 202-212, 315-331, 412-502)", () => {
  const LOGS: ImportLogRow[] = [
    { success: 1, docname: "SO-0001", row_indexes: "[2]", messages: JSON.stringify("[]"), exception: null },
    { success: 0, docname: null, row_indexes: "[3, 4]", messages: JSON.stringify([{ message: "Value missing for <b>Customer</b>", title: "Mandatory", indicator: "red", raise_exception: 1 }]), exception: "Traceback (most recent call last):\nfrappe.exceptions.MandatoryError: customer" },
  ];

  it("success ONLY after the server says Success: queued → in progress (server counts) → Success; then the log; Go to list; onFinished once", async () => {
    const sim = makeSim({ logs: [LOGS[0]] });
    const onFinished = vi.fn();
    const onGoToList = vi.fn();
    mount(sim, { onFinished, onGoToList, docHref: (dt, n) => `/app/${dt.toLowerCase().replace(/ /g, "-")}/${n}` });
    await uploadAndPreview();
    sim.state = ON_SERVER("m2", { status: "Pending", total_records: 4 }); // the job has not written the document yet
    click(L.startImport);
    await screen.findByText(L.queued);
    expect(sim.sent(DATA_IMPORT_METHODS.start)).toEqual({ data_import: "DI-0001" });
    await waitFor(() => expect(sim.count(DATA_IMPORT_METHODS.status)).toBeGreaterThanOrEqual(2));
    expect(sim.sent(DATA_IMPORT_METHODS.status)).toEqual({ data_import_name: "DI-0001" });
    expect(document.querySelector("[data-import-result]")).toBeNull();
    expect(sim.count(DATA_IMPORT_METHODS.logs)).toBe(0);
    expect(screen.queryByText(/Successfully/)).toBeNull();

    sim.state = ON_SERVER("m3", { status: "Partial Success", success: 2, total_records: 4 }); // mid-run (importer.py:183-184)
    await screen.findByText("2 imported, 0 failed, of 4");
    expect(screen.getByText(L.inProgress)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    expect(document.querySelector("[data-import-result]")).toBeNull();
    expect(onFinished).not.toHaveBeenCalled();

    sim.state = ON_SERVER("m4", { status: "Success", success: 4, total_records: 4 });
    await screen.findByText("Successfully imported 4 records.");
    await screen.findByRole("region", { name: L.importLog });
    expect(sim.sent(DATA_IMPORT_METHODS.logs)).toEqual({ data_import: "DI-0001" });
    const link = screen.getByRole("link", { name: "SO-0001" });
    expect(link.getAttribute("href")).toBe("/app/sales-order/SO-0001");
    expect(link.parentElement?.textContent).toBe("Successfully imported SO-0001");
    expect(screen.queryByRole("button", { name: L.exportErroredRows })).toBeNull(); // Partial Success only (data_import.js:85-89)
    expect(screen.queryByRole("button", { name: L.retry })).toBeNull(); // nothing to retry after Success (:108)
    expect(screen.queryByRole("button", { name: L.mapColumns })).toBeNull(); // (import_preview.js:198)
    click("Go to Sales Order List");
    expect(onGoToList).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished.mock.calls[0][0]).toMatchObject({ status: "Success", success: 4, total: 4 });
    const n = sim.count(DATA_IMPORT_METHODS.status);
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(sim.count(DATA_IMPORT_METHODS.status)).toBe(n); // polling stopped
  });

  it("Partial Success (Update): headline from the server's counts, Export Errored Rows → download_errored_template, failure messages + traceback; Retry restarts with the new marker", async () => {
    const sim = makeSim({ logs: LOGS });
    mount(sim, { importType: "Update Existing Records" });
    await uploadAndPreview();
    expect(JSON.parse(String(sim.sent(DATA_IMPORT_METHODS.save)?.doc))).toMatchObject({ import_type: "Update Existing Records" });
    sim.state = ON_SERVER("m7", { status: "Partial Success", success: 1, failed: 1, total_records: 2 }, { import_type: "Update Existing Records" });
    click(L.startImport);
    await screen.findByText("Successfully updated 1 record out of 2. Click on Export Errored Rows, fix the errors and import again.");
    const log = await screen.findByRole("region", { name: L.importLog });
    expect(within(log).getByText("Successfully updated")).toBeTruthy();
    const failed = log.querySelector('[data-log-success="0"]') as HTMLElement;
    expect(failed.querySelector("td")?.textContent).toBe("3, 4");
    expect(within(failed).getByText("Mandatory").tagName).toBe("STRONG");
    expect(within(failed).getByText("Customer").tagName).toBe("B");
    expect(within(failed).queryByText(/MandatoryError/)).toBeNull();
    fireEvent.click(within(failed).getByRole("button", { name: L.showTraceback }));
    expect(within(failed).getByText(/frappe.exceptions.MandatoryError: customer/)).toBeTruthy();
    // Show Only Failed Logs: a display filter of the server's rows (data_import.js:468-470)
    fireEvent.click(within(log).getByRole("checkbox", { name: L.showFailedOnly }));
    expect(log.querySelectorAll('[data-log-success="1"]')).toHaveLength(0);

    click(L.exportErroredRows);
    await waitFor(() => expect(sim.count(DATA_IMPORT_METHODS.erroredRows)).toBe(1));
    expect(sim.sent(DATA_IMPORT_METHODS.erroredRows)).toEqual({ data_import_name: "DI-0001" });

    const starts = sim.count(DATA_IMPORT_METHODS.start);
    click(L.retry);
    await screen.findByText(L.queued); // m7 is still the document's modified: the old Partial Success is not taken as the new result
    expect(sim.count(DATA_IMPORT_METHODS.start)).toBe(starts + 1);
    expect(document.querySelector("[data-import-result]")).toBeNull();
  });

  it("Error: the log's failures are shown; Error with no log rows says so and never asks for the log", async () => {
    const sim = makeSim({ logs: [LOGS[1]] });
    mount(sim);
    await uploadAndPreview();
    sim.state = ON_SERVER("m9", { status: "Error", failed: 1, total_records: 1 });
    click(L.startImport);
    await screen.findByText("Successfully imported 0 records out of 1. Click on Export Errored Rows, fix the errors and import again."); // Desk's own sentence for failed > 0
    await screen.findByRole("region", { name: L.importLog });
    expect(screen.getByRole("button", { name: L.retry })).toBeTruthy();
    expect(screen.queryByRole("button", { name: L.exportErroredRows })).toBeNull();

    cleanup();
    const sim2 = makeSim();
    mount(sim2);
    await uploadAndPreview();
    sim2.state = ON_SERVER("m9", { status: "Error", total_records: 0 }); // the job raised before logging (data_import.py:169-171)
    click(L.startImport);
    await screen.findByText(L.errorNoLog);
    expect(sim2.count(DATA_IMPORT_METHODS.logs)).toBe(0);
  });

  it("template warnings stop the job (importer.py:81-90): back to the preview with the server's warnings; no result", async () => {
    const sim = makeSim();
    mount(sim);
    await uploadAndPreview();
    sim.state = ON_SERVER("m5", { status: "Pending", total_records: 2 }, { template_warnings: JSON.stringify([{ col: 2, message: "The following values do not exist for Customer: ACME", type: "warning" }]) });
    click(L.startImport);
    await screen.findByText(L.stoppedByWarnings);
    expect(screen.getByRole("region", { name: L.warnings }).textContent).toMatch(/The following values do not exist for Customer: ACME/);
    expect(screen.getByRole("button", { name: L.startImport })).toBeTruthy();
    expect(document.querySelector("[data-import-result]")).toBeNull();
    expect(sim.count(DATA_IMPORT_METHODS.logs)).toBe(0);
  });

  it("417 on start ('Scheduler is inactive'): shown, still on the preview, nothing polled", async () => {
    const sim = makeSim({ failStart: new FrappeError("Scheduler is inactive. Cannot import data.", 417, "ValidationError") });
    mount(sim);
    await uploadAndPreview();
    click(L.startImport);
    await screen.findByText("Scheduler is inactive. Cannot import data.");
    expect(document.querySelector('[data-import-error="start"] [data-kind]')?.getAttribute("data-kind")).toBe("validation");
    expect(screen.getByRole("region", { name: L.preview })).toBeTruthy();
    await act(() => new Promise((r) => setTimeout(r, 60)));
    expect(sim.count(DATA_IMPORT_METHODS.status)).toBe(0);
  });

  it("form_start_import answers false (already queued): said so, then the same polling", async () => {
    const sim = makeSim({ startAnswer: false });
    mount(sim);
    await uploadAndPreview();
    sim.state = ON_SERVER("m2", { status: "Pending", total_records: 4 });
    click(L.startImport);
    await screen.findByText(L.alreadyQueued);
    await waitFor(() => expect(sim.count(DATA_IMPORT_METHODS.status)).toBeGreaterThanOrEqual(1));
  });

  it("realtime (optional): data_import_progress of THIS import drives the progress line; data_import_refresh re-polls at once; completion still from get_import_status", async () => {
    const handlers: Record<string, ((d: Record<string, unknown>) => void)[]> = {};
    const subscribe: ImportRealtimeSubscribe = (event, h) => { (handlers[event] ??= []).push(h); return () => { handlers[event] = handlers[event].filter((x) => x !== h); }; };
    const emit = (event: string, d: Record<string, unknown>) => act(async () => { for (const h of handlers[event] ?? []) h(d); });
    const sim = makeSim();
    mount(sim, { subscribe, pollIntervalMs: 60_000 });
    await uploadAndPreview();
    expect(handlers.data_import_progress ?? []).toHaveLength(0); // subscribed only while importing
    sim.state = ON_SERVER("m2", { status: "Pending", total_records: 10 });
    click(L.startImport);
    await screen.findByText(L.queued);
    await emit("data_import_progress", { data_import: "DI-0099", current: 9, total: 10, eta: 1, success: true });
    expect(document.querySelector("[data-realtime-progress]")).toBeNull();
    await emit("data_import_progress", { data_import: "DI-0001", current: 3, total: 10, eta: 30, success: true });
    expect(screen.getByText("Importing 3 of 10, About 30 seconds remaining")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("30");
    expect(document.querySelector("[data-import-result]")).toBeNull(); // progress is not completion

    const polls = sim.count(DATA_IMPORT_METHODS.status);
    sim.state = ON_SERVER("m3", { status: "Success", success: 10, total_records: 10 });
    await emit("data_import_refresh", { data_import: "DI-0001" });
    await screen.findByText("Successfully imported 10 records.");
    expect(sim.count(DATA_IMPORT_METHODS.status)).toBe(polls + 1);
    expect(handlers.data_import_progress).toHaveLength(0); // unsubscribed once finished
  });
});
