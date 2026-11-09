/**
 * P36e submit — Frappe's docstatus rules as Core pure functions (src/record/docstatus.ts) and the SIMULATED server rules
 * the base simulator lacked (src/frappe/testing/handlers/submit.ts `withSubmitRules`). Frappe 15.110 sources are cited
 * in the modules; every rule has a negative control. Simulator results are SIMULATED, never evidence of Frappe behaviour.
 */
import { describe, expect, it } from "vitest";
import {
  DOCSTATUS_DESCRIPTION_KEY, DOCSTATUS_LABEL_KEY, SUBMIT_MESSAGE_TEXT, amendRefusal, amendedName, deleteRefusal, docstatusTransition, formatDocMessage,
  hasMandatoryValue, isEditableAtDocstatus, missingMandatory, stateDocStatus, toDocStatus, updateAfterSubmitViolations, validateWorkflowDocstatus,
  workflowDocAction, type DocstatusField,
} from "../src/record";
import * as root from "../src";
import { defaultMessages } from "../src/theme/messages";
import { submitAr, submitEn } from "../src/theme/messages-ws/submit";
import type { DocTypeMeta, FixtureBackend, FrappeDoc, WorkflowInfo } from "../src/frappe/contract";
import { createFixtureTransport, withSubmitRules } from "../src/frappe/testing";
import { FrappeError } from "../src/frappe/client";

const tAr = (k: string) => (defaultMessages.ar as Record<string, string>)[k] ?? k;
const tEn = (k: string) => (defaultMessages.en as Record<string, string>)[k] ?? k;

describe("P36E.submit — Core docstatus rules", () => {
  it("P36E.submit.1 check_docstatus_transition: 0→0 save, 0→1 submit, 1→1 update after submit, 1→2 cancel; 1→0, 0→2, from 2 refused", () => {
    expect(docstatusTransition(0, 0)).toEqual({ ok: true, action: "save" });
    expect(docstatusTransition(undefined, 0)).toEqual({ ok: true, action: "save" });
    expect(docstatusTransition(0, 1)).toEqual({ ok: true, action: "submit" });
    expect(docstatusTransition(1, 1)).toEqual({ ok: true, action: "update_after_submit" });
    expect(docstatusTransition(1, 2)).toEqual({ ok: true, action: "cancel" });
    const r10 = docstatusTransition(1, 0);
    expect(r10.ok).toBe(false);
    expect(!r10.ok && r10.error.text).toBe("Cannot change docstatus from 1 (Submitted) to 0 (Draft)");
    const r02 = docstatusTransition(0, 2);
    expect(!r02.ok && r02.error.text).toBe("Cannot change docstatus from 0 (Draft) to 2 (Cancelled)");
    for (const to of [0, 1, 2] as const) {
      const r = docstatusTransition(2, to);
      expect(!r.ok && r.error.key).toBe("subCannotEditCancelled");
    }
  });

  it("P36E.submit.2 apply_workflow's docstatus step: the next state's doc_status picks save / submit / update / cancel, else 'Illegal Document Status'", () => {
    expect(workflowDocAction(0, 0, "Draft")).toEqual({ ok: true, action: "save" });
    expect(workflowDocAction(0, 1, "Sent")).toEqual({ ok: true, action: "submit" });
    expect(workflowDocAction(1, 1, "Approved")).toEqual({ ok: true, action: "update" });
    expect(workflowDocAction(1, 2, "Rejected")).toEqual({ ok: true, action: "cancel" });
    for (const [f, t] of [[1, 0], [0, 2], [2, 0], [2, 1], [2, 2]] as const) {
      const r = workflowDocAction(f, t, "Draft");
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error.text).toBe("Illegal Document Status for Draft");
      expect(!r.ok && formatDocMessage(r.error, tAr)).toBe("حالة المستند غير مسموح بها لـ Draft");
    }
  });

  it("P36E.submit.3 Workflow.validate_docstatus: a lifecycle with Draft 0 / Sent 1 / Approved 1 / Rejected 2 / Expired 2 is valid; 1→0, 0→2 and out-of-2 rows are refused with their row number", () => {
    const states = [{ state: "Draft", docStatus: 0 }, { state: "Sent", docStatus: 1 }, { state: "Approved", docStatus: 1 }, { state: "Rejected", docStatus: 2 }, { state: "Expired", docStatus: "2" }];
    const ok = [{ state: "Draft", nextState: "Sent" }, { state: "Sent", nextState: "Approved" }, { state: "Sent", nextState: "Rejected" }, { state: "Sent", nextState: "Expired" }];
    expect(validateWorkflowDocstatus(states, ok)).toEqual({ errors: [], unknownStates: [] });
    const bad = validateWorkflowDocstatus(states, [...ok, { state: "Sent", nextState: "Draft" }, { state: "Draft", nextState: "Rejected" }, { state: "Rejected", nextState: "Draft" }, { state: "Sent", nextState: "Nowhere" }]);
    expect(bad.errors.map((e) => e.text)).toEqual([
      "Submitted Document cannot be converted back to draft. Transition row 5",
      "Cannot cancel before submitting. See Transition 6",
      "Cannot change state of Cancelled Document. Transition row 7",
    ]);
    expect(bad.unknownStates).toEqual(["Nowhere"]);
    expect(stateDocStatus(states, "Expired")).toBe(2);
    expect(stateDocStatus(states, "Unknown")).toBe(0); // `doc_status or 0`
    expect(toDocStatus("1")).toBe(1);
    expect(toDocStatus(undefined)).toBe(0);
  });

  it("P36E.submit.4 _validate_mandatory: reqd fields without content, Frappe's message per field (HTML-only and blank strings are empty; an <img> is content in a Text Editor)", () => {
    const fields: DocstatusField[] = [
      { fieldname: "title", label: "Title", reqd: 1 },
      { fieldname: "client", label: "Client", reqd: 1 },
      { fieldname: "notes", label: "Notes", reqd: 1, fieldtype: "Text Editor" },
      { fieldname: "items", label: "Items", reqd: 1, fieldtype: "Table" },
      { fieldname: "value", label: "Value" },
    ];
    const r = missingMandatory(fields, { title: "A", client: "  ", notes: "<p> </p>", items: [] }, "Serve Fast Proposal");
    expect(r.fieldnames).toEqual(["client", "notes", "items"]);
    expect(r.messages[0].text).toBe("Error: Value missing for Serve Fast Proposal: Client");
    expect(formatDocMessage(r.messages[0], tAr)).toBe("خطأ: قيمة مفقودة ل Serve Fast Proposal: Client");
    // negative control: complete document
    expect(missingMandatory(fields, { title: "A", client: "B", notes: "<img src=x>", items: [{}] }, "X").fieldnames).toEqual([]);
    expect(hasMandatoryValue({}, 0)).toBe(true); // cstr(0) = "0" has content
    expect(hasMandatoryValue({}, null)).toBe(false);
  });

  it("P36E.submit.5 editable at docstatus (report_view.js:758-770): draft all, submitted only allow_on_submit, cancelled none, read-only never", () => {
    const plain = {}, aos = { allow_on_submit: 1 as const }, ro = { read_only: 1 as const, allow_on_submit: 1 as const };
    expect([0, 1, 2].map((d) => isEditableAtDocstatus(plain, d as 0 | 1 | 2))).toEqual([true, false, false]);
    expect([0, 1, 2].map((d) => isEditableAtDocstatus(aos, d as 0 | 1 | 2))).toEqual([true, true, false]);
    expect([0, 1, 2].map((d) => isEditableAtDocstatus(ro, d as 0 | 1 | 2))).toEqual([false, false, false]);
  });

  it("P36E.submit.6 _validate_update_after_submit: only allow_on_submit fields may change; unchanged / empty-to-empty values pass", () => {
    const fields: DocstatusField[] = [{ fieldname: "client", label: "Client" }, { fieldname: "owner_name", label: "Owner", allow_on_submit: 1 }, { fieldname: "note", label: "Note" }];
    const v = updateAfterSubmitViolations(fields, { client: "Acme", owner_name: "A", note: "" }, { client: "Beta", owner_name: "B", note: null });
    expect(v.map((m) => m.text)).toEqual(["Not allowed to change Client after submission from Acme to Beta"]);
    expect(updateAfterSubmitViolations(fields, { client: "Acme", owner_name: "A" }, { client: "Acme", owner_name: "Z" })).toEqual([]);
  });

  it("P36E.submit.7 delete: a submitted document of a submittable DocType is refused (delete_doc.py:252-262); drafts, cancelled and non-submittable go", () => {
    const m = deleteRefusal(1, { isSubmittable: true, doctype: "Serve Fast Proposal", name: "PRP-1002" });
    expect(m?.text).toBe("Serve Fast Proposal PRP-1002: Submitted Record cannot be deleted. You must Cancel it first.");
    expect(deleteRefusal(0, { isSubmittable: true, doctype: "X", name: "1" })).toBeNull();
    expect(deleteRefusal(2, { isSubmittable: true, doctype: "X", name: "1" })).toBeNull();
    expect(deleteRefusal(1, { isSubmittable: false, doctype: "X", name: "1" })).toBeNull();
  });

  it("P36E.submit.8 amend: <name>-1, an amendment of an amendment increments (naming.py:526-543); only a cancelled document, only once", () => {
    expect(amendedName("PRP-1002", false)).toBe("PRP-1002-1");
    expect(amendedName("PRP-1002-1", true)).toBe("PRP-1002-2");
    expect(amendedName("PRP-1002-9", true)).toBe("PRP-1002-10");
    expect(amendRefusal(2, { alreadyAmended: false, name: "PRP-1" })).toBeNull();
    expect(amendRefusal(2, { alreadyAmended: true, name: "PRP-1" })?.text).toBe("This document is already amended, you cannot ammend it again");
    expect(amendRefusal(1, { alreadyAmended: false, name: "PRP-1" })?.key).toBe("subAmendNotCancelled");
  });

  it("P36E.submit.9 catalogue: every message key has en (= Frappe's text) and ar; indicator words and tooltips resolve in both languages; root export", () => {
    for (const k of Object.keys(SUBMIT_MESSAGE_TEXT)) {
      expect((submitEn as Record<string, string>)[k]).toBe((SUBMIT_MESSAGE_TEXT as Record<string, string>)[k]);
      expect((submitAr as Record<string, string>)[k]).toBeTruthy();
    }
    expect(Object.keys(submitAr).sort()).toEqual(Object.keys(submitEn).sort());
    expect([0, 1, 2].map((d) => tEn(DOCSTATUS_DESCRIPTION_KEY[d as 0 | 1 | 2]))).toEqual(["Document is in draft state", "Document has been submitted", "Document has been cancelled"]);
    expect([0, 1, 2].map((d) => tEn(DOCSTATUS_LABEL_KEY[d as 0 | 1 | 2]))).toEqual(["Draft", "Submitted", "Cancelled"]);
    expect(tAr(DOCSTATUS_DESCRIPTION_KEY[1])).toBe("تم تقديم المستند");
    expect(typeof root.docstatusTransition).toBe("function");
    expect(typeof root.workflowDocAction).toBe("function");
  });
});

// ---- SIMULATED: a submittable DocType with a workflow whose states carry doc_status ------------------------------------
const PROPOSAL: DocTypeMeta = {
  name: "Sim Proposal", autoname: "hash", is_submittable: 1,
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 },
    { fieldname: "client_name", fieldtype: "Data", label: "Client", reqd: 1 },
    { fieldname: "proposal_owner", fieldtype: "Data", label: "Owner", allow_on_submit: 1 },
    { fieldname: "workflow_state", fieldtype: "Link", label: "Status", options: "Workflow State", allow_on_submit: 1, read_only: 1, no_copy: 1 },
    { fieldname: "amended_from", fieldtype: "Link", label: "Amended From", options: "Sim Proposal", read_only: 1, no_copy: 1 },
  ],
} as DocTypeMeta;
const WF: WorkflowInfo = {
  name: "Sim Proposal Lifecycle", document_type: "Sim Proposal", workflow_state_field: "workflow_state",
  states: [
    { state: "Draft", doc_status: "0", allow_edit: "All" }, { state: "Sent", doc_status: "1", allow_edit: "All" },
    { state: "Approved", doc_status: "1", allow_edit: "All" }, { state: "Rejected", doc_status: "2", allow_edit: "All" },
  ],
  transitions: [
    { state: "Draft", action: "Send", next_state: "Sent", allowed: "All", allow_self_approval: 1 },
    { state: "Sent", action: "Approve", next_state: "Approved", allowed: "All", allow_self_approval: 1 },
    { state: "Sent", action: "Reject", next_state: "Rejected", allowed: "All", allow_self_approval: 1 },
  ],
} as WorkflowInfo;
const M = "2026-11-01 10:00:00.000000";
const pdoc = (name: string, docstatus: 0 | 1 | 2, state: string, extra: Record<string, unknown> = {}) =>
  ({ doctype: "Sim Proposal", name, title: `T ${name}`, client_name: `C ${name}`, proposal_owner: "Layla", workflow_state: state, docstatus, modified: M, ...extra }) as unknown as FrappeDoc;
function sim(wrap = true) {
  const backend: FixtureBackend = {
    meta: { "Sim Proposal": [PROPOSAL] },
    docs: { "Sim Proposal": [pdoc("P-1", 0, "Draft"), pdoc("P-2", 0, "Draft", { client_name: "" }), pdoc("P-3", 1, "Sent"), pdoc("P-4", 2, "Rejected")] },
    workflows: { "Sim Proposal": WF },
  };
  const base = createFixtureTransport(backend, { roles: ["All"] });
  const t = wrap ? withSubmitRules(base) : base;
  const get = (n: string) => t.store.docs.get("Sim Proposal")?.get(n);
  const msg = async (p: Promise<unknown>) => { try { await p; return ""; } catch (e) { return e instanceof FrappeError ? `${e.excType}: ${e.messages.map((m) => m.message).join(" | ")}` : String(e); } };
  return { t, get, msg };
}

describe("P36E.submit — SIMULATED submit / cancel / amend / update after submit", () => {
  it("P36E.submit.10 apply_workflow into a doc_status-1 state submits (docstatus 1); a missing mandatory field refuses it with Frappe's message", async () => {
    const { t, get, msg } = sim();
    await t("frappe.model.workflow.apply_workflow", { doc: JSON.stringify(get("P-1")), action: "Send" });
    expect(get("P-1")).toMatchObject({ docstatus: 1, workflow_state: "Sent" });
    const err = await msg(t("frappe.model.workflow.apply_workflow", { doc: JSON.stringify(get("P-2")), action: "Send" }));
    expect(err).toContain("MandatoryError");
    expect(err).toContain("Error: Value missing for Sim Proposal: Client");
    expect(get("P-2")).toMatchObject({ docstatus: 0, workflow_state: "Draft" }); // negative control: nothing changed
  });

  it("P36E.submit.11 1→1 keeps it submitted, 1→2 cancels, 1→0 is refused, nothing leaves a cancelled document", async () => {
    const { t, get, msg } = sim();
    await t("frappe.model.workflow.apply_workflow", { doc: JSON.stringify(get("P-3")), action: "Reject" });
    expect(get("P-3")).toMatchObject({ docstatus: 2, workflow_state: "Rejected" });
    expect(await msg(t("frappe.desk.form.save.savedocs", { doc: JSON.stringify({ ...get("P-3"), title: "x" }), action: "Save" }))).toContain("Cannot edit cancelled document");
    const s = sim();
    await s.t("frappe.model.workflow.apply_workflow", { doc: JSON.stringify(s.get("P-3")), action: "Approve" });
    expect(s.get("P-3")).toMatchObject({ docstatus: 1, workflow_state: "Approved" });
    expect(await s.msg(s.t("frappe.desk.form.save.savedocs", { doc: JSON.stringify({ ...s.get("P-3"), docstatus: 0 }), action: "Save" }))).toContain("Cannot change docstatus from 1 (Submitted) to 0 (Draft)");
  });

  it("P36E.submit.12 amend: inserting a copy with amended_from names it <name>-1 as a draft; amending a document that is not cancelled is refused", async () => {
    const { t, get, msg } = sim();
    const src = get("P-4")!;
    const res = await t("frappe.desk.form.save.savedocs", { doc: JSON.stringify({ doctype: "Sim Proposal", __islocal: 1, name: "new-sim-proposal-1", title: src.title, client_name: src.client_name, amended_from: "P-4", docstatus: 0 }), action: "Save" });
    const saved = (res.docs as FrappeDoc[])[0];
    expect(saved).toMatchObject({ name: "P-4-1", docstatus: 0, amended_from: "P-4", workflow_state: "Draft" });
    expect((await t("frappe.client.is_document_amended", { doctype: "Sim Proposal", docname: "P-4" })).message).toBe("P-4-1");
    expect(await msg(t("frappe.desk.form.save.savedocs", { doc: JSON.stringify({ doctype: "Sim Proposal", __islocal: 1, title: "x", client_name: "y", amended_from: "P-3" }), action: "Save" })))
      .toContain("cannot be amended because it is not cancelled");
  });

  it("P36E.submit.13 update after submit: savedocs Update / client.set_value refuse a non-allow_on_submit change and accept an allow_on_submit one; the base simulator alone did not refuse (negative control)", async () => {
    const { t, get, msg } = sim();
    const err = await msg(t("frappe.desk.form.save.savedocs", { doc: JSON.stringify({ ...get("P-3"), client_name: "Other" }), action: "Update" }));
    expect(err).toContain("UpdateAfterSubmitError");
    expect(err).toContain("Not allowed to change <strong>Client</strong> after submission from <strong>C P-3</strong> to <strong>Other</strong>");
    expect(await msg(t("frappe.client.set_value", { doctype: "Sim Proposal", name: "P-3", fieldname: "client_name", value: "Other" }))).toContain("UpdateAfterSubmitError");
    await t("frappe.client.set_value", { doctype: "Sim Proposal", name: "P-3", fieldname: "proposal_owner", value: "Omar" });
    expect(get("P-3")).toMatchObject({ proposal_owner: "Omar", client_name: "C P-3", docstatus: 1 });
    const raw = sim(false);
    await raw.t("frappe.desk.form.save.savedocs", { doc: JSON.stringify({ ...raw.get("P-3"), client_name: "Other" }), action: "Update" });
    expect(raw.get("P-3")?.client_name).toBe("Other");
  });

  it("P36E.submit.14 bulk Edit (submit_cancel_or_update_docs update): drafts updated; submitted fail for a non-allow_on_submit field and pass for an allow_on_submit one; cancelled always fail", async () => {
    const { t, get } = sim();
    const call = (data: Record<string, unknown>) => t("frappe.desk.doctype.bulk_update.bulk_update.submit_cancel_or_update_docs",
      { doctype: "Sim Proposal", docnames: JSON.stringify(["P-1", "P-3", "P-4"]), action: "update", data: JSON.stringify(data) });
    expect((await call({ client_name: "Bulk" })).message).toEqual(["P-3", "P-4"]);
    expect(get("P-1")?.client_name).toBe("Bulk");
    expect(get("P-3")?.client_name).toBe("C P-3");
    expect((await call({ proposal_owner: "Sara" })).message).toEqual(["P-4"]);
    expect(get("P-3")?.proposal_owner).toBe("Sara");
    expect(get("P-4")?.proposal_owner).toBe("Layla");
  });

  it("P36E.submit.15 bulk Delete (delete_items): drafts and cancelled go, the submitted one stays and is reported as failed (permissions off — the base stopped at the first refusal)", async () => {
    const { t, get } = sim();
    await t("frappe.desk.reportview.delete_items", { doctype: "Sim Proposal", items: JSON.stringify(["P-1", "P-3", "P-4"]) });
    expect(get("P-1")).toBeUndefined();
    expect(get("P-4")).toBeUndefined();
    expect(get("P-3")).toBeDefined();
    expect(t.store.published.at(-1)).toMatchObject({ title: "Bulk Operation Failed", message: "Failed to delete 1 documents: P-3" });
  });
});

// ---- the list indicator pill (FrappeListView): workflow state shown, docstatus in the title ------------------------------
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";
import { ThemeProvider } from "../src";
import { IndicatorCell } from "../src/frappe/list/cells";
import type { IndicatorConfig } from "../src/frappe/list/indicator";

afterEach(() => cleanup());
describe("P36E.submit — list indicator", () => {
  const words = { draft: "Draft", cancelled: "Cancelled", submitted: "Submitted", enabled: "Enabled", disabled: "Disabled" };
  const cfg = (isSubmittable: boolean): IndicatorConfig => ({
    isSubmittable, hasField: (f) => f === "workflow_state", words,
    workflow: { stateField: "workflow_state", styles: { Sent: "Primary", Rejected: "Danger" } },
  });
  it("P36E.submit.16 a workflow DocType's pill shows the workflow state; its title is Desk's docstatus description (en / ar); not on a non-submittable DocType", () => {
    const { rerender } = render(<ThemeProvider language="en"><IndicatorCell row={{ name: "P-3", docstatus: 1, workflow_state: "Sent" }} config={cfg(true)} /></ThemeProvider>);
    const pill = screen.getByText("Sent");
    expect(pill.getAttribute("title")).toBe("Document has been submitted");
    expect(pill.getAttribute("data-docstatus")).toBe("1");
    rerender(<ThemeProvider language="ar"><IndicatorCell row={{ name: "P-4", docstatus: 2, workflow_state: "Rejected" }} config={cfg(true)} /></ThemeProvider>);
    expect(screen.getByText("Rejected").getAttribute("title")).toBe("تم إلغاء المستند");
    rerender(<ThemeProvider language="en"><IndicatorCell row={{ name: "P-5", docstatus: 0, workflow_state: "Sent" }} config={cfg(false)} /></ThemeProvider>);
    expect(screen.getByText("Sent").getAttribute("title")).toBeNull();
  });
});

// ---- Amend under a workflow (the package's FrappeForm amend): the local copy starts in the default draft state --------
import { amendDoc } from "../src/frappe/form/model/copy";
describe("P36E.submit — amend under a workflow", () => {
  it("P36E.submit.17 amendDoc: amended_from set, the copied workflow state reset to the docstatus-0 default (form/workflow.js:58-62); without a workflow the copy keeps its values", () => {
    const wfDocs = [
      { doctype: "Workflow", name: "WF", document_type: "Sim Proposal", workflow_state_field: "workflow_state", is_active: 1,
        states: [{ state: "Draft", doc_status: "0" }, { state: "Sent", doc_status: "1" }, { state: "Rejected", doc_status: "2" }], transitions: [] },
    ];
    const src = pdoc("P-4", 2, "Rejected");
    const withWf = amendDoc({ meta: { ...PROPOSAL, __workflow_docs: wfDocs } as never, children: {} } as never, src);
    expect(withWf).toMatchObject({ amended_from: "P-4", workflow_state: "Draft", docstatus: 0, client_name: "C P-4" });
    const noWf = amendDoc({ meta: PROPOSAL, children: {} } as never, src);
    expect(noWf.workflow_state).toBe("Rejected"); // copy_doc copies no_copy fields on amend (create_new.js:281-292)
  });
});
