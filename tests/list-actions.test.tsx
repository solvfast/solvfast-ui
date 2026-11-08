/**
 * Phase 27 list-actions — the rest of Desk's Actions menu on `FrappeListView`: Print, Clear Assignment, Apply Assignment
 * Rule, Add Tags, workflow bulk approval, in Desk's order. SIMULATED: stub transports (the playground mock + handlers per
 * method) and a stub file transport. The assertions are about the METHOD NAMES, ARGUMENT SHAPES and CLIENT GATES Desk
 * uses, read from the Frappe 15.110 source (citations inline). Nothing here is evidence of behaviour on a real site; no
 * PDF is ever produced from client rows — `download` is stubbed to return a blob that stands for the server's answer.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, FrappeError, type FrappeTransport } from "../src/frappe";
import type { FrappeFilesTransport } from "../src/frappe/client";
import { bulkAddTags, bulkApplyAssignmentRule, bulkClearAssignment } from "../src/frappe/list/bulk";
import {
  BACKGROUND_PRINT_THRESHOLD, MAX_PRINT_LIMIT, NO_LETTERHEAD, PRINT_METHODS, checkPrintable, downloadMultiPdf, downloadMultiPdfAsync, letterheadOptions,
  multiPdfArgs, pdfOptions, printFormatOptions,
} from "../src/frappe/list/print";
import { FrappePrintDialog } from "../src/frappe/list/FrappePrintDialog";
import { WORKFLOW_BULK_METHODS, bulkWorkflowApproval, commonTransitionActions, workflowDocs } from "../src/frappe/list/workflowBulk";
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
const openMenu = (el: HTMLElement) => fireEvent.keyDown(el, { key: "Enter" }); // Radix menus open from the keyboard in jsdom
const bar = () => screen.getByRole("region", { name: /selected/ });
const requested = (action: string, n: number) => en("listBulkRequested").replace("{action}", action).replace("{n}", String(n));

/** DocPerm rows: System Manager has everything incl. print; Reader reads only; Printer reads and prints. */
const PERMS = [
  { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, print: 1, export: 1 },
  { role: "Reader", permlevel: 0, read: 1 },
  { role: "Printer", permlevel: 0, read: 1, print: 1 },
];
const META = (over: Record<string, unknown> = {}) => ({ ...TODO_META, permissions: PERMS, ...over });
const WORKFLOW = {
  doctype: "Workflow", name: "ToDo Approval", document_type: "ToDo", workflow_state_field: "workflow_state", is_active: 1,
  states: [{ state: "Pending", doc_status: "0", allow_edit: "Reader" }, { state: "Approved", doc_status: "0", allow_edit: "Reader" }],
  transitions: [{ state: "Pending", action: "Approve", next_state: "Approved", allowed: "Reader" }, { state: "Pending", action: "Reject", next_state: "Pending", allowed: "Reader" }],
};

type Extra = (m: string, a: Record<string, unknown>) => Promise<Record<string, unknown>> | undefined;
function mountList(roles: string[] | undefined, meta: Record<string, unknown>, props: Partial<React.ComponentProps<typeof FrappeListView>> = {}, extra?: Extra, files?: FrappeFilesTransport, rowPatch?: (r: Record<string, unknown>, i: number) => void, lang: "en" | "ar" = "en") {
  const mock: MockFrappe = createMockFrappe();
  if (rowPatch) mock.rows.forEach((r, i) => rowPatch(r as Record<string, unknown>, i));
  const transport: FrappeTransport = async (m, a) => {
    const own = extra?.(m, a);
    if (own) { mock.calls.push({ method: m, args: a } as never); return own as never; }
    if (m === "frappe.desk.form.load.getdoctype") return { docs: [meta], user_settings: "{}" } as never;
    return mock.transport(m, a);
  };
  const client = createFrappeClient({ transport, files });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = render(
    <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} session={roles ? { user: "u@x.com", roles } : undefined}><FrappeListView doctype="ToDo" storage={null} bulk={{}} selectionMode="bar" {...props} /></FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
  const calls = (method: string) => mock.calls.filter((c) => c.method === method);
  const firstNames = (n: number) => mock.rows.slice().sort((a, b) => String(b.modified).localeCompare(String(a.modified))).slice(0, n).map((r) => String(r.name));
  return { ...ui, mock, calls, firstNames };
}
const check = (...idx: number[]) => { for (const i of idx) fireEvent.click(screen.getAllByRole("checkbox")[i]); };
const ok = (message: unknown = null) => Promise.resolve({ message });

// ---------------------------------------------------------------------------------------------------------------------
describe("request shapes (bulk_operations.js; server methods read from 15.110)", () => {
  const rec = (message?: unknown) => {
    const calls: { method: string; args: Record<string, unknown> }[] = [];
    return { calls, client: createFrappeClient({ transport: async (method, args) => { calls.push({ method, args }); return { message }; } }) };
  };

  it("Clear Assignment: remove_multiple with Desk's ignore_permissions (bulk_operations.js:247-252); the answer is empty → silent", async () => {
    const r = rec();
    expect(await bulkClearAssignment(r.client, "ToDo", ["a", "b"])).toEqual({ failed: [], queued: false, silent: true });
    expect(r.calls[0]).toEqual({ method: "frappe.desk.form.assign_to.remove_multiple", args: { doctype: "ToDo", names: '["a","b"]', ignore_permissions: true } });
  });

  it("Apply Assignment Rule: bulk_apply(doctype, docnames); more than 5 are enqueued per document (assignment_rule.py:231-245)", async () => {
    const r = rec();
    expect(await bulkApplyAssignmentRule(r.client, "ToDo", ["a", "b", "c", "d", "e"])).toEqual({ failed: [], queued: false, silent: true });
    expect(r.calls[0]).toEqual({ method: "frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply", args: { doctype: "ToDo", docnames: '["a","b","c","d","e"]' } });
    expect((await bulkApplyAssignmentRule(r.client, "ToDo", ["a", "b", "c", "d", "e", "f"])).queued).toBe(true);
  });

  it("Add Tags: add_tags(tags, dt, docs) — lists JSON-encoded as frappe.call does (bulk_operations.js:445-451)", async () => {
    const r = rec();
    expect(await bulkAddTags(r.client, "ToDo", ["a", "b"], ["urgent", "vip"])).toEqual({ failed: [], queued: false, silent: true });
    expect(r.calls[0]).toEqual({ method: "frappe.desk.doctype.tag.tag.add_tags", args: { tags: '["urgent","vip"]', dt: "ToDo", docs: '["a","b"]' } });
  });

  it("workflow: get_common_transition_actions gets the checked ROWS (owner included, list_view.js:1838-1842); bulk_workflow_approval the names", async () => {
    const r = rec(["Approve", "Reject"]);
    const docs = workflowDocs(["a", "z"], [{ name: "a", owner: "o@x.com", workflow_state: "Pending" }]);
    expect(docs).toEqual([{ name: "a", owner: "o@x.com", workflow_state: "Pending" }, { name: "z" }]); // a name without a loaded row is sent as {name}
    expect(await commonTransitionActions(r.client, "ToDo", docs)).toEqual(["Approve", "Reject"]);
    expect(r.calls[0]).toEqual({ method: WORKFLOW_BULK_METHODS.commonActions, args: { docs: JSON.stringify(docs), doctype: "ToDo" } });
    expect(await commonTransitionActions(rec(null).client, "ToDo", docs)).toEqual([]); // nothing in common → nothing offered
    const w = rec();
    expect(await bulkWorkflowApproval(w.client, "ToDo", ["a", "b"], "Approve")).toEqual({ failed: [], queued: false, silent: true });
    expect(w.calls[0]).toEqual({ method: WORKFLOW_BULK_METHODS.approve, args: { docnames: '["a","b"]', doctype: "ToDo", action: "Approve" } });
    // < 20 in the request, 20–500 enqueued, > 500 refused by the server (workflow.py:237-253)
    expect((await bulkWorkflowApproval(w.client, "ToDo", Array.from({ length: 19 }, (_, i) => `n${i}`), "Approve")).queued).toBe(false);
    expect((await bulkWorkflowApproval(w.client, "ToDo", Array.from({ length: 20 }, (_, i) => `n${i}`), "Approve")).queued).toBe(true);
    const refusing = createFrappeClient({ transport: async () => { throw new FrappeError("Bulk approval only support up to 500 documents.", 417, "ValidationError"); } });
    await expect(bulkWorkflowApproval(refusing, "ToDo", Array.from({ length: 501 }, (_, i) => `n${i}`), "Approve")).rejects.toThrow(/up to 500/);
  });

  it("Print: Desk's filter (bulk_operations.js:16-45) — submitted only for a submittable DocType, drafts / cancelled per Print Settings, Administrator role exempt", () => {
    const rows = [{ name: "d", docstatus: 0 }, { name: "s", docstatus: 1 }, { name: "c", docstatus: 2 }];
    const sub = { isSubmittable: true };
    expect(checkPrintable(["s"], rows, sub)).toEqual({ ok: true, names: ["s"], background: false });
    expect(checkPrintable(["d", "s"], rows, sub)).toEqual({ ok: true, names: ["d", "s"], background: false }); // DocType default: allow_print_for_draft = 1
    expect(checkPrintable(["d", "s"], rows, { ...sub, settings: { allow_print_for_draft: 0 } })).toEqual({ ok: false, reason: "draft_or_cancelled" });
    expect(checkPrintable(["c"], rows, sub)).toEqual({ ok: false, reason: "draft_or_cancelled" }); // default: allow_print_for_cancelled = 0
    expect(checkPrintable(["c"], rows, { ...sub, settings: { allow_print_for_cancelled: 1 } }).ok).toBe(true);
    expect(checkPrintable(["c", "d"], rows, { ...sub, settings: { allow_print_for_draft: 0 }, roles: ["Administrator"] }).ok).toBe(true);
    expect(checkPrintable(["x"], rows, sub)).toEqual({ ok: false, reason: "draft_or_cancelled" }); // no row → docstatus unknown → refused, as in Desk
    expect(checkPrintable(["x"], [], { isSubmittable: false })).toEqual({ ok: true, names: ["x"], background: false }); // not submittable: anything
    expect(checkPrintable([], [], { isSubmittable: false })).toEqual({ ok: false, reason: "none" });
    const many = (n: number) => Array.from({ length: n }, (_, i) => `n${i}`);
    expect(checkPrintable(many(BACKGROUND_PRINT_THRESHOLD), [], { isSubmittable: false })).toMatchObject({ ok: true, background: false });
    expect(checkPrintable(many(BACKGROUND_PRINT_THRESHOLD + 1), [], { isSubmittable: false })).toMatchObject({ ok: true, background: true });
    expect(checkPrintable(many(MAX_PRINT_LIMIT), [], { isSubmittable: false }).ok).toBe(true);
    expect(checkPrintable(many(MAX_PRINT_LIMIT + 1), [], { isSubmittable: false })).toEqual({ ok: false, reason: "too_many" });
  });

  it("Print formats (meta.js:253-282 over getdoctype's __print_formats); letterheads (bulk_operations.js:169-193); pdf options (:103-114)", async () => {
    const meta = { default_print_format: "Fancy", __print_formats: [
      { name: "Plain" }, { name: "Fancy" }, { name: "Script", print_format_type: "JS" }, { name: "Raw", raw_printing: 1 },
    ] };
    expect(printFormatOptions(meta)).toEqual(["Fancy", "Standard", "Plain"]);
    expect(printFormatOptions(meta, { enable_raw_printing: 1 })).toEqual(["Fancy", "Standard", "Plain", "Raw"]);
    expect(printFormatOptions({ default_print_format: "Gone", __print_formats: [{ name: "Plain" }] })).toEqual(["Gone", "Standard", "Plain"]); // Desk would drop "Plain" (splice(-1))
    expect(printFormatOptions(undefined)).toEqual(["Standard"]);
    const getList = vi.fn(async () => [{ name: "Plain LH", is_default: 0 }, { name: "Main LH", is_default: 1 }]) as never;
    expect(await letterheadOptions({ getList })).toEqual(["Main LH", NO_LETTERHEAD, "Plain LH"]);
    expect((getList as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual(["Letter Head", { fields: ["name", "is_default"], filters: [["disabled", "=", 0]], limit_page_length: 0 }]);
    expect(pdfOptions("A4")).toBe('{"page-size":"A4"}');
    expect(pdfOptions("Custom", 100, 50)).toBe('{"page-height":100,"page-width":50}');
    expect(() => pdfOptions("Custom", 0, 50)).toThrow(/cannot be zero/);
  });

  it("download_multi_pdf through api.download with Desk's arguments (bulk_operations.js:144-158); async answers {task_id}", async () => {
    const seen: { method: string; args: Record<string, unknown> }[] = [];
    const api = { download: async (method: string, args: Record<string, unknown>) => { seen.push({ method, args }); return { blob: new Blob(["%PDF server"]), filename: "ToDo.pdf", contentType: "application/pdf" }; } };
    const o = { doctype: "ToDo", names: ["a", "b"], format: "Standard", letterhead: NO_LETTERHEAD, options: pdfOptions("A4") };
    const file = await downloadMultiPdf(api, o);
    expect(file.filename).toBe("ToDo.pdf");
    expect(seen[0]).toEqual({ method: PRINT_METHODS.pdf, args: { doctype: "ToDo", name: '["a","b"]', format: "Standard", no_letterhead: "1", letterhead: "No Letterhead", options: '{"page-size":"A4"}' } });
    expect(multiPdfArgs({ ...o, letterhead: "Main LH" })).toMatchObject({ no_letterhead: "0", letterhead: "Main LH" });
    const calls: unknown[] = [];
    const client = createFrappeClient({ transport: async (method, args) => { calls.push({ method, args }); return { message: { task_id: "t-1" } }; } });
    expect(await downloadMultiPdfAsync(client, o)).toEqual({ taskId: "t-1" });
    expect(calls[0]).toEqual({ method: PRINT_METHODS.pdfAsync, args: multiPdfArgs(o) });
    await expect(downloadMultiPdfAsync(createFrappeClient({ transport: async () => ({ message: {} }) }), o)).rejects.toThrow(/task_id/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("the selection bar: Desk's order and gates (list_view.js:2088-2128)", () => {
  it("System Manager (print right, not submittable): Edit, Export, Assign To, Clear Assignment, Apply Assignment Rule, Add Tags, Print, Delete", async () => {
    mountList(["System Manager"], META());
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    await screen.findByRole("button", { name: en("listBulkDelete") });
    const labels = within(bar()).getAllByRole("button").map((b) => b.textContent?.trim()).filter((l) => l && l !== en("clearSelection"));
    expect(labels).toEqual(["Edit", "Export", "Assign to", "Clear Assignment", "Apply Assignment Rule", "Add Tags", "Print", "Delete"]);
  });

  it("submittable: Submit and Cancel sit between Print and Delete", async () => {
    mountList(["System Manager"], META({ is_submittable: 1 }));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    await screen.findByRole("button", { name: en("listBulkDelete") });
    const labels = within(bar()).getAllByRole("button").map((b) => b.textContent?.trim());
    expect(labels.slice(labels.indexOf("Print"), labels.indexOf("Delete") + 1)).toEqual(["Print", "Submit", "Cancel documents", "Delete"]);
  });

  it("a read-only role: Export and the read-level actions; no Print (can_print = perm[0].print, model.js:452-455), no Edit, no Delete", async () => {
    const { unmount } = mountList(["Reader"], META());
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    await screen.findByRole("button", { name: en("listBulkAddTags") });
    const labels = within(bar()).getAllByRole("button").map((b) => b.textContent?.trim()).filter((l) => l !== en("clearSelection"));
    expect(labels).toEqual(["Export", "Assign to", "Clear Assignment", "Apply Assignment Rule", "Add Tags"]);
    unmount();
    mountList(["Printer"], META());
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    expect(await screen.findByRole("button", { name: en("listBulkPrint") })).toBeTruthy();
  });

  it("Arabic: the labels come from the frappe:list message block (ar)", async () => {
    mountList(["System Manager"], META(), {}, undefined, undefined, undefined, "ar");
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    const ar = defaultMessages.ar;
    await screen.findByRole("button", { name: ar.listBulkDelete });
    const region = screen.getByRole("region", { name: ar.selectedCount.replace("{n}", "1") });
    const labels = within(region).getAllByRole("button").map((b) => b.textContent?.trim()).filter((l) => l !== ar.clearSelection);
    expect(labels).toEqual([ar.listBulkEdit, ar.listBulkExport, ar.listBulkAssign, ar.listBulkClearAssignment, ar.listBulkAssignmentRule, ar.listBulkAddTags, ar.listBulkPrint, ar.listBulkDelete]);
    expect(screen.getByRole("button", { name: ar.listMenuMore })).toBeTruthy();
  });

  it("no session roles: only Export (Desk pushes it unconditionally); every permission-gated action is withheld (rule 9)", async () => {
    mountList(undefined, META());
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    await screen.findByRole("button", { name: "Export" });
    const labels = within(bar()).getAllByRole("button").map((b) => b.textContent?.trim()).filter((l) => l !== en("clearSelection"));
    expect(labels).toEqual(["Export"]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("Clear Assignment / Apply Assignment Rule / Add Tags in the list", () => {
  it("Clear Assignment confirms with Desk's text, sends remove_multiple for the checked names, says 'requested', reloads; Cancel sends nothing and (Desk's reject action) clears the selection", async () => {
    const seen: Record<string, unknown>[] = [];
    const { calls, firstNames } = mountList(["Reader"], META(), {}, (m, a) => (m === "frappe.desk.form.assign_to.remove_multiple" ? (seen.push(a), ok()) : undefined));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkClearAssignment") }));
    expect(await screen.findByText(en("listBulkClearAssignmentConfirm"))).toBeTruthy(); // list_view.js:1910
    fireEvent.click(screen.getByRole("button", { name: en("cancel") }));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(seen).toHaveLength(0);
    // Desk's frappe.confirm reject action (list_view.js:1919-1921): No / Escape clears the checks and refreshes — the bar goes
    await waitFor(() => expect(screen.queryByRole("region", { name: /selected/ })).toBeNull());
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkClearAssignment") }));
    const before = calls("frappe.desk.reportview.get").length;
    fireEvent.click(await screen.findByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({ doctype: "ToDo", names: JSON.stringify(firstNames(2)), ignore_permissions: true });
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status.textContent).toBe(requested("Clear Assignment", 2))); // never a success count: the server answers nothing
    await waitFor(() => expect(calls("frappe.desk.reportview.get").length).toBeGreaterThan(before));
  });

  it("a refusal is shown as the server's message; no reload, the selection stays", async () => {
    const { calls } = mountList(["Reader"], META(), {}, (m) => (m === "frappe.desk.form.assign_to.remove_multiple" ? Promise.reject(new FrappeError("Insufficient Permission for ToDo", 403, "PermissionError")) : undefined));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkClearAssignment") }));
    const before = calls("frappe.desk.reportview.get").length;
    fireEvent.click(await screen.findByRole("button", { name: en("confirm") }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status.textContent).toContain("Insufficient Permission"));
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(calls("frappe.desk.reportview.get").length).toBe(before);
    expect(bar()).toBeTruthy();
  });

  it("Apply Assignment Rule runs without a confirmation (list_view.js:1929-1942); 6 names → queued by the server", async () => {
    const seen: Record<string, unknown>[] = [];
    const { firstNames } = mountList(["Reader"], META(), {}, (m, a) => (m === "frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply" ? (seen.push(a), ok()) : undefined));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkAssignmentRule") }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(seen[0]).toEqual({ doctype: "ToDo", docnames: JSON.stringify(firstNames(2)) });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(requested("Apply Assignment Rule", 2)));
    check(1, 2, 3, 4, 5, 6);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkAssignmentRule") }));
    await waitFor(() => expect(seen).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(en("listBulkQueued")));
  });

  it("Add Tags: Tag suggestions from search_link, a new tag is accepted (the server creates it, tag.py:92-93), Add is disabled until a tag is chosen", async () => {
    const seen: Record<string, unknown>[] = [];
    const searched: Record<string, unknown>[] = [];
    const { firstNames } = mountList(["Reader"], META(), {}, (m, a) => {
      if (m === "frappe.desk.doctype.tag.tag.add_tags") { seen.push(a); return ok(); }
      if (m === "frappe.desk.search.search_link" && a.doctype === "Tag") { searched.push(a); return ok([{ value: "urgent", description: "" }, { value: "vip", description: "" }]); }
      return undefined;
    });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkAddTags") }));
    // the dialog focuses the tag input, which opens its suggestion popover (also role "dialog"): find ours by its title
    const dialog = await screen.findByRole("dialog", { name: en("listBulkAddTags") });
    const add = within(dialog).getByRole("button", { name: en("listBulkAdd") });
    expect((add as HTMLButtonElement).disabled).toBe(true); // reqd (bulk_operations.js:433)
    const input = within(dialog).getByRole("combobox", { name: en("listBulkTags") });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "urg" } });
    fireEvent.click(await screen.findByRole("option", { name: /urgent/ }));
    fireEvent.change(input, { target: { value: "brand-new," } });
    await waitFor(() => expect(within(dialog).getByText("brand-new")).toBeTruthy());
    expect(searched.length).toBeGreaterThan(0);
    fireEvent.click(add);
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({ tags: '["urgent","brand-new"]', dt: "ToDo", docs: JSON.stringify(firstNames(2)) });
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(requested("Add Tags", 2)));
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("Print in the list (bulk_operations.js:7-167)", () => {
  const pdf = () => {
    const seen: { method: string; args: Record<string, unknown> }[] = [];
    const served: Blob[] = [];
    let answer: () => Promise<{ blob: Blob; filename: string; contentType: string }> = async () => { const blob = new Blob(["%PDF server bytes"]); served.push(blob); return { blob, filename: "ToDo.pdf", contentType: "application/pdf" }; };
    const files: FrappeFilesTransport = { download: async (method, args) => { seen.push({ method, args }); return answer(); }, upload: async () => { throw new Error("not used"); } };
    return { seen, served, files, refuse: (e: Error) => { answer = async () => { throw e; }; } };
  };
  const letterheads = (m: string, a: Record<string, unknown>) => (m === "frappe.client.get_list" && a.doctype === "Letter Head" ? ok([{ name: "Main LH", is_default: 1 }, { name: "Plain LH", is_default: 0 }]) : undefined);

  it("not submittable: the dialog loads the letterheads (default first) and posts download_multi_pdf with Desk's arguments; the server's blob is saved, nothing else", async () => {
    const { seen, served, files } = pdf();
    const created: Blob[] = [];
    Object.assign(globalThis.URL, { createObjectURL: (b: Blob) => { created.push(b); return "blob:server"; }, revokeObjectURL: () => {} });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {}); // jsdom cannot navigate to a blob URL
    const { firstNames, calls } = mountList(["Printer"], META({ default_print_format: "Fancy", __print_formats: [{ name: "Fancy" }] }), {}, letterheads, files);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkPrint") }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(en("listPrintTitle"))).toBeTruthy();
    await waitFor(() => expect(calls("frappe.client.get_list").some((c) => c.args.doctype === "Letter Head")).toBe(true));
    await waitFor(() => expect(within(dialog).getByRole("combobox", { name: en("listPrintLetterhead") }).textContent).toContain("Main LH"));
    expect(within(dialog).getByRole("combobox", { name: en("listPrintFormat") }).textContent).toContain("Fancy");
    expect(within(dialog).getByRole("combobox", { name: en("listPrintPageSize") }).textContent).toContain("A4");
    expect((within(dialog).getByRole("checkbox", { name: en("listPrintBackground") }) as HTMLButtonElement).getAttribute("data-state")).toBe("unchecked");
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkPrint") }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({ method: PRINT_METHODS.pdf, args: { doctype: "ToDo", name: JSON.stringify(firstNames(2)), format: "Fancy", no_letterhead: "0", letterhead: "Main LH", options: '{"page-size":"A4"}' } });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(created).toHaveLength(1);
    expect(created[0]).toBe(served[0]); // only the blob the server sent reaches the browser
    delete (globalThis.URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  });

  it("the server's refusal stays in the dialog as FrappeErrorState; no file", async () => {
    const { seen, files, refuse } = pdf();
    refuse(new FrappeError("Not permitted", 403, "PermissionError"));
    const save = vi.fn(() => "blob:x");
    Object.assign(globalThis.URL, { createObjectURL: save });
    mountList(["Printer"], META(), {}, letterheads, files);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkPrint") }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkPrint") }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(await within(dialog).findByText(en("feErrPermission"))).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    delete (globalThis.URL as unknown as { createObjectURL?: unknown }).createObjectURL;
  });

  it("submittable with drafts: blocked before any request when Print Settings forbid drafts ('You selected Draft or Cancelled documents'); allowed by default", async () => {
    const { seen, files } = pdf();
    const drafts = (r: Record<string, unknown>) => { r.docstatus = 0; };
    const { unmount } = mountList(["Printer"], META({ is_submittable: 1 }), { bulk: { print: { settings: { allow_print_for_draft: 0 } } } }, letterheads, files, drafts);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkPrint") }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(en("listPrintDraftOrCancelled")));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(seen).toHaveLength(0);
    unmount();
    // without `bulk.print.settings` the Print Settings DocType defaults apply (print_settings.json: allow_print_for_draft = 1)
    mountList(["Printer"], META({ is_submittable: 1 }), {}, letterheads, files, drafts);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkPrint") }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("background (> 25): forced and read-only; download_multi_pdf_async → task id; without a task subscriber the dialog says queued, never 'ready'", async () => {
    const calls: { method: string; args: Record<string, unknown> }[] = [];
    const api = {
      download: vi.fn(async () => { throw new Error("must not download"); }),
      call: (async (method: string, args: Record<string, unknown>) => { calls.push({ method, args }); return { message: { task_id: "task-9" } }; }) as never,
      getList: (async () => []) as never,
    };
    const names = Array.from({ length: 30 }, (_, i) => `n${i}`);
    const onDone = vi.fn();
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><FrappePrintDialog api={api} doctype="ToDo" names={names} open onOpenChange={() => {}} onDone={onDone} /></ThemeProvider>);
    const dialog = await screen.findByRole("dialog");
    const bg = within(dialog).getByRole("checkbox", { name: en("listPrintBackground") });
    expect(bg.getAttribute("data-state")).toBe("checked");
    expect((bg as HTMLButtonElement).disabled).toBe(true);
    // p275: the label is the DS Label next to the checkbox (peer), so it dims with the forced, read-only checkbox
    const bgLabel = within(dialog).getByText(en("listPrintBackground"));
    expect(bgLabel.previousElementSibling).toBe(bg);
    expect(bgLabel.className).toContain("peer-disabled:opacity-70");
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkPrint") }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].method).toBe(PRINT_METHODS.pdfAsync);
    expect(calls[0].args).toMatchObject({ doctype: "ToDo", name: JSON.stringify(names), format: "Standard", no_letterhead: "1", letterhead: NO_LETTERHEAD });
    expect(await within(dialog).findByText(en("listPrintQueuedNoLink"))).toBeTruthy();
    expect(within(dialog).queryByText(en("listPrintReady"))).toBeNull();
    expect(api.download).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({ taskId: "task-9" });
  });

  it("background with a task subscriber: waits for task_complete:<task_id>, then offers the server's file_url; unsubscribes", async () => {
    let complete: ((d: { file_url?: string }) => void) | undefined;
    const off = vi.fn();
    const subscribeTask = vi.fn((id: string, cb: (d: { file_url?: string }) => void) => { expect(id).toBe("task-7"); complete = cb; return off; });
    const api = { download: vi.fn(), call: (async () => ({ message: { task_id: "task-7" } })) as never, getList: (async () => []) as never };
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><FrappePrintDialog api={api as never} doctype="ToDo" names={["a"]} open onOpenChange={() => {}} subscribeTask={subscribeTask} /></ThemeProvider>);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: en("listPrintBackground") })); // optional below 26
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkPrint") }));
    expect(await within(dialog).findByText(en("listPrintQueued"))).toBeTruthy();
    expect(within(dialog).queryByRole("link")).toBeNull();
    act(() => complete?.({ file_url: "/private/files/ToDo_task-7.pdf?fid=abc" }));
    expect(await within(dialog).findByText(en("listPrintReady"))).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: en("listPrintDownload") }).getAttribute("href")).toBe("/private/files/ToDo_task-7.pdf?fid=abc");
    expect(off).toHaveBeenCalledTimes(1);
  });

  it("Custom page size without height / width: refused on the client ('cannot be zero'), no request", async () => {
    const api = { download: vi.fn(), call: vi.fn(), getList: (async () => []) as never };
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><FrappePrintDialog api={api as never} doctype="ToDo" names={["a"]} settings={{ pdf_page_size: "Custom" }} open onOpenChange={() => {}} /></ThemeProvider>);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(en("listPrintPageHeight"))).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkPrint") }));
    expect(await within(dialog).findByRole("alert")).toBeTruthy();
    expect(within(dialog).getByText(en("listPrintSizeZero"))).toBeTruthy();
    expect(api.download).not.toHaveBeenCalled();
    expect(api.call).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("workflow bulk approval in the list (list_view.js:1802-1853)", () => {
  const WF_META = () => META({ __workflow_docs: [WORKFLOW] });
  const owners = (r: Record<string, unknown>, i: number) => { r.owner = i % 2 ? "a@x.com" : "b@x.com"; };

  it("a Workflow hides Edit / Delete (no allow_edit) and adds the Workflow menu; opening it asks the server with the checked rows; an action runs bulk_workflow_approval", async () => {
    const common: Record<string, unknown>[] = [];
    const approved: Record<string, unknown>[] = [];
    const { firstNames, calls } = mountList(["System Manager"], WF_META(), {}, (m, a) => {
      if (m === WORKFLOW_BULK_METHODS.commonActions) { common.push(a); return ok(["Approve", "Reject"]); }
      if (m === WORKFLOW_BULK_METHODS.approve) { approved.push(a); return ok(); }
      return undefined;
    }, undefined, owners);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    const trigger = await screen.findByTestId("sf-bulk-workflow");
    const labels = within(bar()).getAllByRole("button").map((b) => b.textContent?.trim());
    expect(labels).not.toContain("Edit");
    expect(labels).not.toContain("Delete");
    expect(labels[labels.length - 2]).toBe("Lifecycle"); // last action, before "Clear selection"
    expect(common).toHaveLength(0); // asked only when the menu opens (show.bs.dropdown, list_view.js:1426-1428)
    openMenu(trigger);
    await waitFor(() => expect(common).toHaveLength(1));
    const docs = JSON.parse(String(common[0].docs)) as Record<string, unknown>[];
    expect(common[0].doctype).toBe("ToDo");
    expect(docs.map((d) => d.name)).toEqual(firstNames(2));
    expect(docs.every((d) => typeof d.owner === "string")).toBe(true); // has_approval_access reads the row's owner (workflow.py:221-222)
    const before = calls("frappe.desk.reportview.get").length;
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(approved).toHaveLength(1));
    expect(approved[0]).toEqual({ docnames: JSON.stringify(firstNames(2)), doctype: "ToDo", action: "Approve" });
    // < 20: applied in the request, but the per-document result comes as a realtime msgprint — never a success count
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(requested("Approve", 2)));
    await waitFor(() => expect(calls("frappe.desk.reportview.get").length).toBeGreaterThan(before));
  });

  it("an empty answer offers no action; every opening asks again", async () => {
    const common: Record<string, unknown>[] = [];
    const approved: unknown[] = [];
    mountList(["Reader"], WF_META(), {}, (m, a) => {
      if (m === WORKFLOW_BULK_METHODS.commonActions) { common.push(a); return ok([]); }
      if (m === WORKFLOW_BULK_METHODS.approve) { approved.push(a); return ok(); }
      return undefined;
    });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    openMenu(await screen.findByTestId("sf-bulk-workflow"));
    await waitFor(() => expect(common).toHaveLength(1));
    const none = await screen.findByRole("menuitem", { name: en("listBulkWorkflowNone") });
    expect(none.getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByRole("menuitem", { name: "Approve" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    openMenu(screen.getByTestId("sf-bulk-workflow"));
    await waitFor(() => expect(common).toHaveLength(2));
    expect(approved).toHaveLength(0);
  });

  it("the server's refusal of the approval (e.g. > 500 documents, workflow.py:253) is shown; no reload", async () => {
    const { calls } = mountList(["Reader"], WF_META(), {}, (m) => {
      if (m === WORKFLOW_BULK_METHODS.commonActions) return ok(["Approve"]);
      if (m === WORKFLOW_BULK_METHODS.approve) return Promise.reject(new FrappeError("Bulk approval only support up to 500 documents.", 417, "ValidationError"));
      return undefined;
    });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    openMenu(await screen.findByTestId("sf-bulk-workflow"));
    const before = calls("frappe.desk.reportview.get").length;
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("up to 500 documents"));
    await act(() => new Promise((r) => setTimeout(r, 100)));
    expect(calls("frappe.desk.reportview.get").length).toBe(before);
  });

  it("a DocType without a Workflow has no Workflow menu; `bulk.hasWorkflow` overrides", async () => {
    const { unmount } = mountList(["Reader"], META());
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    await screen.findByRole("button", { name: en("listBulkAddTags") });
    expect(screen.queryByTestId("sf-bulk-workflow")).toBeNull();
    unmount();
    mountList(["Reader"], WF_META(), { bulk: { hasWorkflow: false } });
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    await screen.findByRole("button", { name: en("listBulkAddTags") });
    expect(screen.queryByTestId("sf-bulk-workflow")).toBeNull();
  });
});
