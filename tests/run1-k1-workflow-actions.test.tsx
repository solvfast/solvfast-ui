/**
 * Run 1 · D-55 / K1 — `FrappeWorkflowActions variant="actions"` (the P0 header menu) used OUTSIDE FrappeForm runs Desk's
 * pre-apply checks (form/workflow.js:96-121): with `frm` (the host's FrappeFormView controller) the form's check_mandatory
 * and before / after_workflow_action; without it, a mandatory check of the document against its meta (Missing Fields
 * dialog, nothing sent). Stub client — request / response shapes only; real site: pending (I5).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeProvider } from "../src/frappe";
import { FrappeWorkflowActions } from "../src/frappe/record";
import type { FormController } from "../src/frappe/form/events";
import type { FrappeDoc, MetaBundle } from "../src/frappe/contract";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const wfDocs = [
  { doctype: "Workflow", name: "WF", document_type: "Deal", workflow_state_field: "workflow_state", override_status: 0,
    states: [{ state: "Draft", doc_status: "0", allow_edit: "Sales User" }, { state: "Approved", doc_status: "1", allow_edit: "Sales Manager" }],
    transitions: [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "Sales Manager", allow_self_approval: 0 }] },
  { doctype: "Workflow State", name: "Draft" }, { doctype: "Workflow State", name: "Approved", style: "Success" },
];
const bundle: MetaBundle = {
  doctype: "Deal",
  meta: { name: "Deal", is_submittable: 1, __workflow_docs: wfDocs, fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title", reqd: 1 },
    { fieldname: "reason", fieldtype: "Data", label: "Approval Reason", mandatory_depends_on: "eval:doc.amount > 100" },
    { fieldname: "amount", fieldtype: "Currency", label: "Amount" },
  ] } as never,
  children: {},
};
const doc: FrappeDoc = { doctype: "Deal", name: "D1", owner: "creator@x", title: "Big", amount: 500, workflow_state: "Draft", docstatus: 0, modified: "2026-11-01 10:00:00" };

function client() {
  return {
    call: vi.fn(async () => ({ message: [] })), subscribeMessages: () => () => {}, addComment: vi.fn(),
    getMetaBundle: vi.fn(async () => bundle),
    getWorkflowTransitions: vi.fn(async () => [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "Sales Manager", allow_self_approval: 0 }]),
    applyWorkflow: vi.fn(async (d: FrappeDoc) => ({ ...d, workflow_state: "Approved", docstatus: 1 })),
  };
}
const mount = (c: ReturnType<typeof client>, ui: React.ReactElement, lang: "en" | "ar" = "en") => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <FrappeProvider client={c as never} session={{ user: "boss@x", roles: ["Sales Manager"] }}><ThemeProvider defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider></FrappeProvider>
  </QueryClientProvider>,
);
const choose = async (action = "Approve", menu = "Actions") => {
  fireEvent.keyDown(await screen.findByRole("button", { name: menu }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: action }));
};

describe("K1 actions variant outside FrappeForm — own mandatory check", () => {
  it("a mandatory_depends_on field left empty opens Missing Fields and nothing is sent", async () => {
    const c = client();
    mount(c, <FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="actions" />);
    await choose();
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).getByText("Missing Fields")).toBeTruthy();
    expect(dlg.textContent).toContain("Approval Reason");
    expect(c.applyWorkflow).not.toHaveBeenCalled();
  });

  it("with every required value the transition is applied", async () => {
    const c = client(); const applied = vi.fn();
    mount(c, <FrappeWorkflowActions doc={{ ...doc, reason: "ok" }} user="boss@x" roles={["Sales Manager"]} variant="actions" onApplied={applied} />);
    await choose();
    await waitFor(() => expect(c.applyWorkflow).toHaveBeenCalledWith(expect.objectContaining({ name: "D1" }), "Approve"));
    await waitFor(() => expect(applied).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("checkMandatory={false}: the host checks itself — the action goes straight to the server", async () => {
    const c = client();
    mount(c, <FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="actions" checkMandatory={false} />);
    await choose();
    await waitFor(() => expect(c.applyWorkflow).toHaveBeenCalled());
  });

  it("Arabic: the Missing Fields dialog is in Arabic", async () => {
    const c = client();
    mount(c, <FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="actions" />, "ar");
    fireEvent.keyDown(await screen.findByRole("button", { name: /إجراءات|Actions/ }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg.textContent).not.toContain("Missing Fields");
    expect(c.applyWorkflow).not.toHaveBeenCalled();
  });
});

describe("K1 actions variant with the host's form controller (frm)", () => {
  function fakeFrm(opts: { mandatoryOk?: boolean; beforeOk?: boolean } = {}) {
    const log: string[] = [];
    const frm = {
      selectedWorkflowAction: null as string | null,
      checkMandatory: vi.fn(() => { log.push(`mandatory:${frm.selectedWorkflowAction}`); return opts.mandatoryOk ?? true; }),
      trigger: vi.fn(async (ev: string) => { log.push(`${ev}:${frm.selectedWorkflowAction}`); return ev === "before_workflow_action" ? (opts.beforeOk ?? true) : true; }),
    };
    return { frm: frm as unknown as FormController, log, raw: frm };
  }

  it("runs Desk's sequence: selectedWorkflowAction → check_mandatory → before_workflow_action → apply → after_workflow_action", async () => {
    const c = client(); const f = fakeFrm();
    const ref = { current: f.frm };
    mount(c, <FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="actions" frm={ref} />);
    await choose();
    await waitFor(() => expect(f.log).toContain("after_workflow_action:null"));
    expect(f.log).toEqual(["mandatory:Approve", "before_workflow_action:Approve", "after_workflow_action:null"]);
    expect(c.applyWorkflow).toHaveBeenCalledTimes(1);
  });

  it("NEGATIVE: the form's missing field or a before_workflow_action returning false stops it — nothing sent", async () => {
    const c = client(); const f = fakeFrm({ mandatoryOk: false });
    const a = mount(c, <FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="actions" frm={f.frm} />);
    await choose();
    await waitFor(() => expect(f.raw.checkMandatory).toHaveBeenCalled());
    expect(f.raw.trigger).not.toHaveBeenCalled();
    a.unmount();
    const g = fakeFrm({ beforeOk: false });
    mount(c, <FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="actions" frm={g.frm} />);
    await choose();
    await waitFor(() => expect(g.log).toContain("before_workflow_action:Approve"));
    expect(g.raw.selectedWorkflowAction).toBeNull();
    expect(c.applyWorkflow).not.toHaveBeenCalled();
  });
});
