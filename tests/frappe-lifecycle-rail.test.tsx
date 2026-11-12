/** FrappeWorkflowActions variant="rail" (the CRM record page's Lifecycle on Frappe data) over a stub client — request /
 *  response SHAPES only, not Frappe behaviour. Fixtures as in record-frappe-ui.test.tsx. */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeProvider } from "../src/frappe";
import { FrappeWorkflowActions } from "../src/frappe/record";
import type { FrappeApi } from "../src/frappe/client";
type RecordClient = Partial<FrappeApi>;
import type { DocInfo, FrappeDoc, MetaBundle } from "../src/frappe/contract";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const wfDocs = [
  { doctype: "Workflow", name: "WF", document_type: "Deal", workflow_state_field: "workflow_state", override_status: 0,
    states: [{ state: "Draft", doc_status: "0", allow_edit: "Sales User" }, { state: "Approved", doc_status: "1", allow_edit: "Sales Manager" }],
    transitions: [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "Sales Manager", allow_self_approval: 0 }] },
  { doctype: "Workflow State", name: "Draft" }, { doctype: "Workflow State", name: "Approved", style: "Success" },
];
const bundle: MetaBundle = {
  doctype: "Deal",
  meta: { name: "Deal", is_submittable: 1, fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }], __workflow_docs: wfDocs } as never,
  children: {},
};
const info: DocInfo = {
  attachments: [], communications: [], comments: [{ name: "K1", content: "<p>hi</p>", owner: "me@x", creation: "2026-11-02 11:00:00" }], versions: [],
  assignments: [{ name: "T1", owner: "bob@x", description: "d", status: "Open" }], assignment_logs: [], shared: [], views: [], permissions: {},
  user_info: { "bob@x": { fullname: "Bob Ray" } },
};
const doc: FrappeDoc = { doctype: "Deal", name: "D1", owner: "creator@x", workflow_state: "Draft", docstatus: 0, creation: "2026-11-01 10:00:00", modified: "2026-11-01 10:00:00", modified_by: "creator@x" };

let current: RecordClient = {};
function stub(over: Partial<RecordClient> = {}): RecordClient & Record<string, ReturnType<typeof vi.fn>> {
  current = {
    call: vi.fn(async () => ({ message: [] })), searchLink: vi.fn(async () => [{ value: "cy@x", label: "Cy" }]),
    getMetaBundle: vi.fn(async () => bundle), subscribeMessages: () => () => {}, getDoc: vi.fn(async () => ({ doc, docinfo: info })),
    getWorkflowTransitions: vi.fn(async () => [{ state: "Draft", action: "Approve", next_state: "Approved", allowed: "Sales Manager", allow_self_approval: 0 }]),
    applyWorkflow: vi.fn(async (d: FrappeDoc) => ({ ...d, workflow_state: "Approved", docstatus: 1 })),
    getDocInfo: vi.fn(async () => info), addAssignment: vi.fn(async () => []), removeAssignment: vi.fn(async () => []),
    addComment: vi.fn(async () => ({}) as never), updateComment: vi.fn(async () => {}), deleteComment: vi.fn(async () => {}), ...over,
  } as never;
  return current as never;
}
const mount = (ui: React.ReactElement, qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => render(<QueryClientProvider client={qc}><FrappeProvider client={current as never} session={{ user: "me@x", roles: ["Sales User"] }}><ThemeProvider>{ui}</ThemeProvider></FrappeProvider></QueryClientProvider>);


const reopenDocs = [
  { ...wfDocs[0], transitions: [...wfDocs[0].transitions as object[], { state: "Approved", action: "Reopen", next_state: "Draft", allowed: "Sales Manager", allow_self_approval: 1 }] },
  ...wfDocs.slice(1),
];
const withWf = (docs: unknown[]): MetaBundle => ({ ...bundle, meta: { ...bundle.meta, __workflow_docs: docs } as never });

describe("FrappeWorkflowActions rail", () => {
  it("applyFromRail: renders the LifecycleRail: the current state, the way forward as a button that applies the transition", async () => {
    const c = stub(); const applied = vi.fn();
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="rail" applyFromRail onApplied={applied} />);
    await waitFor(() => expect(container.querySelector("[data-lifecycle-rail]")).not.toBeNull());
    expect(Array.from(container.querySelectorAll("li[data-step]")).map((l) => l.textContent)).toEqual([expect.stringContaining("Draft")]);
    const opt = await screen.findByRole("button", { name: "Approved" });
    fireEvent.click(opt);
    await waitFor(() => expect(c.applyWorkflow).toHaveBeenCalledWith(doc, "Approve"));
    await waitFor(() => expect(applied).toHaveBeenCalled());
  });

  it("the path is the states entered, oldest first, with who · when; a move to an earlier state is tagged back", async () => {
    stub({
      getMetaBundle: vi.fn(async () => withWf(reopenDocs)) as never,
      getWorkflowTransitions: vi.fn(async () => [{ state: "Approved", action: "Reopen", next_state: "Draft", allowed: "Sales Manager", allow_self_approval: 1 }]) as never,
      getDocInfo: vi.fn(async () => ({ ...info, workflow_logs: [{ owner: "bob@x", creation: "2026-11-03 10:00:00", content: "Approved" }, { owner: "bob@x", creation: "2026-11-02 10:00:00", content: "Draft" }] })) as never,
    });
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, workflow_state: "Approved", docstatus: 1 }} user="boss@x" roles={["Sales Manager"]} variant="rail" />);
    await waitFor(() => expect(container.querySelectorAll("li[data-step]").length).toBe(2));
    const rows = Array.from(container.querySelectorAll("li[data-step]"));
    expect(rows.map((r) => r.getAttribute("data-step"))).toEqual(["past", "current"]);
    expect(rows[0].textContent).toContain("Draft");
    expect(rows[0].querySelector("[data-meta]")?.textContent).toMatch(/^Bob Ray · /);
    const row = await waitFor(() => { const r = container.querySelector("[data-next='row']"); if (!r) throw new Error("no next"); return r; });
    expect(row.textContent).toContain("back");
  });

  it("End of lifecycle when no transition leaves the state for anyone", async () => {
    stub({ getWorkflowTransitions: vi.fn(async () => []) as never });
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, workflow_state: "Approved", docstatus: 1 }} user="boss@x" roles={["Sales Manager"]} variant="rail" />);
    await waitFor(() => expect(container.querySelector("[data-next='end']")).not.toBeNull());
  });

  it("applyFromRail: no End of lifecycle when transitions exist but not for this user", async () => {
    stub({ getWorkflowTransitions: vi.fn(async () => []) as never });
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="u@x" roles={["Sales User"]} variant="rail" applyFromRail />);
    await waitFor(() => expect(container.querySelector("[data-lifecycle-rail]")).not.toBeNull());
    expect(container.querySelector("[data-next]")).toBeNull();
  });

  it("applyFromRail: confirm asks first; a server refusal is shown", async () => {
    stub({ applyWorkflow: vi.fn(async () => { throw new Error("Not a valid Workflow Action"); }) as never });
    mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="rail" applyFromRail confirm />);
    fireEvent.click(await screen.findByRole("button", { name: "Approved" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirm" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Not a valid Workflow Action");
  });

  it("applyFromRail: an unsaved document: no way forward is offered (no transitions are asked for) and the reason is said", async () => {
    const c = stub();
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, __unsaved: 1 }} user="boss@x" roles={["Sales Manager"]} variant="rail" applyFromRail />);
    await waitFor(() => expect(container.querySelector("[data-workflow-note]")).not.toBeNull());
    expect(container.querySelector("[data-workflow-note]")!.textContent).toBeTruthy();
    expect(container.querySelector("[data-next]")).toBeNull();
    expect(c.getWorkflowTransitions).not.toHaveBeenCalled();
  });

  it("onViewAll shows View full lifecycle; railLabels localise the chrome", async () => {
    stub({ getWorkflowTransitions: vi.fn(async () => []) as never });
    const onViewAll = vi.fn();
    mount(<FrappeWorkflowActions doc={{ ...doc, workflow_state: "Approved", docstatus: 1 }} user="boss@x" roles={["Sales Manager"]} variant="rail" onViewAll={onViewAll} railLabels={{ viewAll: "Whole lifecycle", end: "Done here" }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Whole lifecycle" }));
    expect(onViewAll).toHaveBeenCalled();
    expect(screen.getByText("Done here")).toBeTruthy();
  });
});

describe("FrappeWorkflowActions (0.8.0-dev.5, E2): read-only rail by default + the header Actions menu", () => {
  it("rail (default): read-only — where the workflow goes (rows, no buttons), even when this user may not run it", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="u@x" roles={["Sales User"]} variant="rail" />);
    await waitFor(() => expect(container.querySelector("[data-lifecycle-rail]")).not.toBeNull());
    const rail = container.querySelector("[data-lifecycle-rail]")!;
    expect(rail.querySelector('[data-step="current"]')?.textContent).toContain("Draft");
    expect(rail.querySelector("[data-next]")?.getAttribute("data-next")).toBe("row");
    expect(rail.querySelector("[data-next]")?.textContent).toContain("Approved");
    expect(rail.querySelectorAll("[data-next-option]").length).toBe(0);
    expect(container.querySelectorAll("button").length).toBe(0);
  });
  it("rail (default): an unsaved document still shows where it can go (no note: transitions run from the Actions menu)", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, __unsaved: 1 }} user="boss@x" roles={["Sales Manager"]} variant="rail" />);
    await waitFor(() => expect(container.querySelector("[data-next]")?.textContent).toContain("Approved"));
    expect(container.querySelector("[data-workflow-note]")).toBeNull();
  });
  it("rail (default): End of lifecycle when no transition leaves the state", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, workflow_state: "Approved", docstatus: 1 }} user="boss@x" roles={["Sales Manager"]} variant="rail" />);
    await waitFor(() => expect(container.querySelector('[data-next="end"]')).not.toBeNull());
  });
  it("actions: the Actions menu alone (no badge); choosing an item applies the transition at once", async () => {
    const c = stub(); const applied = vi.fn();
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="actions" onApplied={applied} />);
    fireEvent.keyDown(await screen.findByRole("button", { name: "Actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(c.applyWorkflow).toHaveBeenCalled());
    await waitFor(() => expect(applied).toHaveBeenCalled());
    expect(container.querySelector("[data-status]")).toBeNull();
  });
  it("actions: blocked while the document is unsaved, and with the host's reason (e.g. unsaved page): disabled button + tooltip", async () => {
    stub();
    const a = mount(<FrappeWorkflowActions doc={{ ...doc, __unsaved: 1 }} user="boss@x" roles={["Sales Manager"]} variant="actions" />);
    const b1 = await screen.findByRole("button", { name: /Actions/ });
    expect((b1 as HTMLButtonElement).disabled).toBe(true); expect(b1.getAttribute("title")).toBeTruthy();
    a.unmount();
    mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="actions" blockedReason="Save your changes first" />);
    const b2 = await screen.findByRole("button", { name: /Actions/ });
    expect((b2 as HTMLButtonElement).disabled).toBe(true); expect(b2.getAttribute("title")).toBe("Save your changes first");
  });
});

describe("FrappeWorkflowActions variant=\"steps\" (deprecated 0.8.0-dev.5)", () => {
  it("still renders the stepper with the Actions menu (unchanged), and warns once", async () => {
    stub(); const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="steps" />);
    await waitFor(() => expect(container.querySelector('ol[aria-label="lifecycle"]')).not.toBeNull());
    expect(await screen.findByRole("button", { name: "Actions" })).toBeTruthy();
    cleanup(); mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} variant="steps" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Actions" })).toBeTruthy());
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('variant="steps" is deprecated')).length).toBe(1);
    warn.mockRestore();
  });
});
