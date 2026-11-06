/**
 * 0.5.1 — Core Export / Import (no backend): the ExportDialog's states (default selection, mandatory lock, validation,
 * loading, error, success → closed), the CSV helpers, and the DataImportDialog with a client adapter (read, auto-map,
 * per-row validation, duplicates, map columns, disabled run with its reason, a real run's result).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  DataImportDialog, ExportDialog, ThemeProvider, autoMapColumns, buildCsv, importableRows, parseCsv, validateImport,
  DATA_IMPORT_LABELS_EN, IMPORT_DIALOG_LABELS_EN, IMPORT_DIALOG_LABELS_AR, DATA_IMPORT_LABELS_AR,
  type DataImportAdapter, type ExportGroup, type ExportRequest, type ImportField,
} from "../src";

beforeAll(() => {
  configure({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const L = { ...DATA_IMPORT_LABELS_EN, ...IMPORT_DIALOG_LABELS_EN };
const wrap = (ui: React.ReactNode, language: "en" | "ar" = "en") => render(<ThemeProvider defaultTheme="light" defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>);

const GROUPS: ExportGroup[] = [{
  key: "contacts", label: "Contacts", reqd: true,
  fields: [
    { fieldname: "name", label: "Name", reqd: true, mandatory: true },
    { fieldname: "email", label: "Email", reqd: false, mandatory: false },
    { fieldname: "phone", label: "Phone", reqd: false, mandatory: false },
  ],
}];

describe("CSV helpers", () => {
  it("buildCsv: BOM, CRLF, RFC 4180 quoting; parseCsv reads it back (quotes, commas, line breaks, Arabic)", () => {
    const csv = buildCsv(["Name", "Note"], [["A, B", 'say "hi"'], ["سعد", "line1\nline2"], [null, 3]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"A, B","say ""hi"""');
    expect(parseCsv(csv)).toEqual([["Name", "Note"], ["A, B", 'say "hi"'], ["سعد", "line1\nline2"], ["", "3"]]);
    expect(parseCsv("a,b\r\n\r\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
    expect(buildCsv(["x"], [], { bom: false })).toBe("x");
  });
});

describe("ExportDialog (Core)", () => {
  it("fields with label, key and (Mandatory); mandatory + defaultSelection pre-checked; counts on the Export Type; Selected (n) when rows are checked", () => {
    wrap(<ExportDialog open onOpenChange={() => {}} groups={GROUPS} onExport={() => {}} description="Contacts" selectedCount={2} defaultSelection={{ contacts: ["email"] }} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Export Data")).toBeTruthy();
    expect(within(dialog).getByText("name (Mandatory)")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: "Contacts: Name" }) as HTMLElement).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("checkbox", { name: "Contacts: Email" }).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("checkbox", { name: "Contacts: Phone" }).getAttribute("data-state")).toBe("unchecked");
    expect(within(dialog).getByRole("combobox", { name: "Export Type" }).textContent).toContain("Selected Records (2)");
  });

  it("lockMandatory: the mandatory field cannot be unchecked, Unselect All keeps it; without the lock Unselect All empties → validation message, Export disabled", () => {
    const { unmount } = wrap(<ExportDialog open onOpenChange={() => {}} groups={GROUPS} onExport={() => {}} lockMandatory />);
    const name = screen.getByRole("checkbox", { name: "Contacts: Name" });
    expect(name.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Unselect All" }));
    expect(screen.getByRole("checkbox", { name: "Contacts: Name" }).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("button", { name: "Export" }).hasAttribute("disabled")).toBe(false);
    unmount();
    wrap(<ExportDialog open onOpenChange={() => {}} groups={GROUPS} onExport={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Unselect All" }));
    expect(screen.getByRole("button", { name: "Export" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Select at least one field to export.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select All" }));
    expect(screen.queryByText("Select at least one field to export.")).toBeNull();
  });

  it("Export: loading while the host writes, the request (file type, records, fields in field order), then closed; a rejection is shown and the dialog stays", async () => {
    let resolve!: () => void;
    const onExport = vi.fn((_: ExportRequest) => new Promise<void>((r) => { resolve = r; }));
    const onOpenChange = vi.fn();
    wrap(<ExportDialog open onOpenChange={onOpenChange} groups={GROUPS} onExport={onExport} defaultRecords="by_filter" defaultFileType="Excel" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Contacts: Phone" }));
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(onExport).toHaveBeenCalledWith({ fileType: "Excel", records: "by_filter", fields: { contacts: ["name", "phone"] } });
    expect(await screen.findByRole("button", { name: "Downloading…" })).toBeTruthy();
    await act(async () => resolve());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    cleanup();
    const failing = vi.fn(() => Promise.reject(new Error("Disk full")));
    const close = vi.fn();
    wrap(<ExportDialog open onOpenChange={close} groups={GROUPS} onExport={failing} />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Disk full");
    expect(close).not.toHaveBeenCalled();
  });

  it("a host re-render with new-but-equal groups keeps the user's picks (reset only on open / a structural change)", () => {
    const clone = () => GROUPS.map((g) => ({ ...g, fields: g.fields.map((f) => ({ ...f })) }));
    const ui = (groups: ExportGroup[]) => <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><ExportDialog open onOpenChange={() => {}} groups={groups} onExport={() => {}} defaultSelection={{ contacts: ["email"] }} /></ThemeProvider>;
    const { rerender } = render(ui(clone()));
    fireEvent.click(screen.getByRole("checkbox", { name: "Contacts: Phone" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Contacts: Email" }));
    rerender(ui(clone()));
    expect(screen.getByRole("checkbox", { name: "Contacts: Phone" }).getAttribute("data-state")).toBe("checked");
    expect(screen.getByRole("checkbox", { name: "Contacts: Email" }).getAttribute("data-state")).toBe("unchecked");
    const changed = clone(); changed[0].fields.push({ fieldname: "city", label: "City", reqd: false, mandatory: false });
    rerender(ui(changed));
    expect(screen.getByRole("checkbox", { name: "Contacts: Phone" }).getAttribute("data-state")).toBe("unchecked");
    expect(screen.getByRole("checkbox", { name: "Contacts: Email" }).getAttribute("data-state")).toBe("checked");
  });

  it("Arabic from the catalogue, right-to-left", () => {
    wrap(<ExportDialog open onOpenChange={() => {}} groups={GROUPS} onExport={() => {}} />, "ar");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("تصدير البيانات")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "تحديد الإلزامي" })).toBeTruthy();
    expect(within(dialog).getByText("name (إلزامي)")).toBeTruthy();
    expect(document.documentElement.getAttribute("dir") ?? dialog.closest("[dir]")?.getAttribute("dir")).toBe("rtl");
  });
});

const FIELDS: ImportField[] = [
  { key: "name", label: "Name", mandatory: true, aliases: ["الاسم"] },
  { key: "email", label: "Email", validate: (v) => (/^[^@\s]+@[^@\s]+$/.test(v) ? null : "Invalid email") },
  { key: "city", label: "City" },
];
const existing = new Map([["a@x.io", "Alice (C-1)"]]);
const dupCheck = { identity: (r: Record<string, string>) => r.email?.toLowerCase() || null, existing: (id: string) => existing.get(id) ?? null };

describe("Import model (Core)", () => {
  it("auto-map by label / key / alias, case- and spacing-insensitive; a field takes the first matching column", () => {
    expect(autoMapColumns(["NAME", "e-mail", "Email", "Notes", "الاسم"], FIELDS)).toEqual(["name", null, "email", null, null]);
  });
  it("validate: unmatched column (info), mandatory missing value, invalid value, duplicate of an existing record and within the file; counts; importable rows", () => {
    const file = { headers: ["Name", "Email", "Notes"], rows: [["Bob", "b@x.io", ""], ["", "c@x.io", ""], ["Al", "A@x.io", ""], ["Cy", "nope", ""], ["Bo2", "b@x.io", ""]] };
    const v = validateImport(file, autoMapColumns(file.headers, FIELDS), FIELDS, L, dupCheck);
    expect(v.counts).toEqual({ total: 5, errors: 2, duplicates: 2, ready: 1 });
    expect(v.warnings.other).toEqual([{ col: 3, header: "Notes", message: "Cannot match column Notes with any field: it will not be imported.", type: "info" }]);
    expect(v.warnings.rows.map((r) => r.row)).toEqual([3, 4, 5, 6]);
    expect(v.rows[1].errors[0].message).toBe("Value missing for mandatory field Name");
    expect(v.rows[2].duplicate?.message).toBe("Duplicate: matches the existing record Alice (C-1)");
    expect(v.rows[3].errors[0].message).toBe("Invalid email");
    expect(v.rows[4].duplicate?.message).toBe("Duplicate: same as row 2 of this file");
    expect(importableRows(v, false).map((r) => r.rowNumber)).toEqual([2]);
    expect(importableRows(v, true).map((r) => r.rowNumber)).toEqual([2, 4, 6]);
    const unmapped = validateImport(file, [null, "email", null], FIELDS, L, dupCheck);
    expect(unmapped.missingMandatory).toEqual(["name"]);
    expect(unmapped.counts.ready).toBe(0);
    expect(unmapped.warnings.other.some((w) => w.message === "Mandatory field Name is not mapped to any column.")).toBe(true);
  });
});

const csvFile = (text: string, name = "contacts.csv") => {
  const f = new File([text], name, { type: "text/csv" });
  Object.defineProperty(f, "text", { value: () => Promise.resolve(text) });
  return f;
};
const adapterOf = (o: Partial<DataImportAdapter> = {}): DataImportAdapter => ({
  fields: FIELDS, parse: async (f) => { const [headers = [], ...rows] = parseCsv(await f.text()); return { headers, rows }; },
  duplicates: dupCheck, runUnavailable: "needs the server", ...o,
});
const choose = (f: File) => fireEvent.change(document.querySelector("[data-import-file-input]")!, { target: { files: [f] } });

describe("DataImportDialog (Core)", () => {
  it("upload → preview: counts, grid with the mapped fields, warnings by row, duplicates; Start Import disabled with the reason — nothing imported", async () => {
    const run = vi.fn();
    wrap(<DataImportDialog adapter={adapterOf({ run })} description="Contacts" />);
    expect(screen.getByRole("button", { name: "Upload and Preview" }).hasAttribute("disabled")).toBe(true);
    choose(csvFile("Name,Email,Notes\nBob,b@x.io,\n,c@x.io,\nAl,a@x.io,\n"));
    expect(screen.getByText("contacts.csv")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upload and Preview" }));
    await screen.findByText("contacts.csv: 3 rows, 3 columns");
    const step = document.querySelector("[data-import-step=preview]") as HTMLElement;
    expect(step.querySelector("[data-count-ready]")!.getAttribute("data-count-ready")).toBe("1");
    expect(step.querySelector("[data-count-errors]")!.getAttribute("data-count-errors")).toBe("1");
    expect(step.querySelector("[data-count-duplicates]")!.getAttribute("data-count-duplicates")).toBe("1");
    expect(step.querySelector("th[data-col='1']")!.textContent).toContain("→ Name");
    expect(step.querySelector("th[data-col='3']")!.hasAttribute("data-skipped")).toBe(true);
    expect(step.querySelector("tr[data-row='3']")!.getAttribute("data-row-status")).toBe("error");
    expect(step.querySelector("tr[data-row='4']")!.getAttribute("data-row-status")).toBe("duplicate");
    expect(within(step).getByText("Value missing for mandatory field Name")).toBeTruthy();
    const start = screen.getByRole("button", { name: "Start Import" });
    expect(start.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Import is not available here: needs the server")).toBeTruthy();
    expect(start.getAttribute("aria-describedby")).toBe(step.querySelector("[data-import-unavailable]")!.id);
    fireEvent.click(start);
    expect(run).not.toHaveBeenCalled();
    expect(document.querySelector("[data-import-result]")).toBeNull();
  });

  it("Map Columns: map the unmatched column to a field (picker), save → re-validated preview", async () => {
    wrap(<DataImportDialog adapter={adapterOf()} />);
    choose(csvFile("Full name,Email\nBob,b@x.io\n"));
    fireEvent.click(screen.getByRole("button", { name: "Upload and Preview" }));
    await screen.findByText("Mandatory field Name is not mapped to any column.");
    fireEvent.click(screen.getByRole("button", { name: "Map Columns" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Full name" }));
    fireEvent.click(await screen.findByRole("option", { name: /^Name/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save Mapping" }));
    await waitFor(() => expect(document.querySelector("[data-import-step=preview]")).toBeTruthy());
    expect(screen.queryByText("Mandatory field Name is not mapped to any column.")).toBeNull();
    expect(document.querySelector("[data-count-ready]")!.getAttribute("data-count-ready")).toBe("1");
  });

  it("Map Columns: a host re-render (new-but-equal adapter) keeps an unsaved pick", async () => {
    const ui = () => <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><DataImportDialog adapter={adapterOf()} /></ThemeProvider>;
    const { rerender } = render(ui());
    choose(csvFile("Full name,Email\nBob,b@x.io\n"));
    fireEvent.click(screen.getByRole("button", { name: "Upload and Preview" }));
    await screen.findByText("contacts.csv: 1 rows, 2 columns");
    fireEvent.click(screen.getByRole("button", { name: "Map Columns" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Full name" }));
    fireEvent.click(await screen.findByRole("option", { name: /^Name/ }));
    expect(screen.getByRole("combobox", { name: "Full name" }).getAttribute("data-value")).toBe("name");
    rerender(ui());
    expect(screen.getByRole("combobox", { name: "Full name" }).getAttribute("data-value")).toBe("name");
  });

  it("a run that is available: progress, then the result from the run's counts (Partial Success, failed rows)", async () => {
    const run = vi.fn(async (input, onProgress: (d: number, t: number) => void) => { onProgress(1, input.rows.length); return { success: 1, failed: 1, errors: [{ rowNumber: 3, message: "Rejected" }] }; });
    const onFinished = vi.fn();
    wrap(<DataImportDialog adapter={adapterOf({ run, runUnavailable: undefined, duplicates: undefined })} onFinished={onFinished} />);
    choose(csvFile("Name,Email\nBob,b@x.io\nCy,c@x.io\n"));
    fireEvent.click(screen.getByRole("button", { name: "Upload and Preview" }));
    await screen.findByText("contacts.csv: 2 rows, 2 columns");
    fireEvent.click(screen.getByRole("button", { name: "Start Import" }));
    expect((await screen.findByText(/Successfully imported 1 record out of 2/)).textContent).toContain("Export Errored Rows");
    expect(run.mock.calls[0][0].rows.map((r: { rowNumber: number }) => r.rowNumber)).toEqual([2, 3]);
    expect(screen.getByText("Partial Success")).toBeTruthy();
    expect(screen.getByText("Row 3: Rejected")).toBeTruthy();
    expect(onFinished).toHaveBeenCalledWith(expect.objectContaining({ status: "Partial Success", total: 2 }));
  });

  it("a file that cannot be read / has no rows: the error on the Upload step, no preview", async () => {
    wrap(<DataImportDialog adapter={adapterOf({ parse: () => Promise.reject(new Error("bad zip")) })} />);
    choose(csvFile("x"));
    fireEvent.click(screen.getByRole("button", { name: "Upload and Preview" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The file could not be read: bad zip");
    expect(document.querySelector("[data-import-step=preview]")).toBeNull();
    cleanup();
    wrap(<DataImportDialog adapter={adapterOf()} />);
    choose(csvFile("Name,Email\n"));
    fireEvent.click(screen.getByRole("button", { name: "Upload and Preview" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The file has no rows below its header.");
  });

  it("Download Template opens the Core ExportDialog on Blank Template; Arabic labels under 'ar'", async () => {
    const onExport = vi.fn();
    wrap(<DataImportDialog adapter={adapterOf({ template: { groups: GROUPS, onExport } })} open onOpenChange={() => {}} description="جهات الاتصال" />, "ar");
    expect(screen.getByRole("heading", { name: DATA_IMPORT_LABELS_AR.title })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: DATA_IMPORT_LABELS_AR.downloadTemplate }));
    const exp = await screen.findByText("تصدير البيانات");
    const dialog = exp.closest("[role=dialog]") as HTMLElement;
    expect(within(dialog).getByRole("combobox", { name: "نوع التصدير" }).textContent).toContain("قالب فارغ");
    fireEvent.click(within(dialog).getByRole("button", { name: "تصدير" }));
    await waitFor(() => expect(onExport).toHaveBeenCalledWith({ fileType: "CSV", records: "blank_template", fields: { contacts: ["name"] } }));
    expect(IMPORT_DIALOG_LABELS_AR.runUnavailable).toContain("{0}");
  });
});
