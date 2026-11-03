/**
 * Phase 27 list-actions — the rest of Desk's Actions menu on `FrappeListView`: Print, Clear Assignment, Apply Assignment
 * Rule, Add Tags, workflow bulk approval. SIMULATED: stub transports and a stub file transport. The assertions are about
 * the METHOD NAMES and ARGUMENT SHAPES Desk uses, read from the Frappe 15.110 source (citations inline). Nothing here is
 * evidence of behaviour on a real site; no PDF is ever produced from client rows.
 */
import { describe, expect, it, vi } from "vitest";
import { createFrappeClient, FrappeError } from "../src/frappe";
import { bulkAddTags, bulkApplyAssignmentRule, bulkClearAssignment } from "../src/frappe/list/bulk";
import {
  BACKGROUND_PRINT_THRESHOLD, MAX_PRINT_LIMIT, NO_LETTERHEAD, PRINT_METHODS, checkPrintable, downloadMultiPdf, downloadMultiPdfAsync, letterheadOptions,
  multiPdfArgs, pdfOptions, printFormatOptions,
} from "../src/frappe/list/print";
import { WORKFLOW_BULK_METHODS, bulkWorkflowApproval, commonTransitionActions, workflowDocs } from "../src/frappe/list/workflowBulk";

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
