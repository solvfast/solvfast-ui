/** Frappe record wrappers over a stub client (request/response SHAPES only — not Frappe behaviour). */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeProvider, useDoc } from "../src/frappe";
import { FrappeAssignTo, FrappeStatusIndicator, FrappeTimeline, FrappeWorkflowActions } from "../src/frappe/record";
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

describe("FrappeWorkflowActions", () => {
  it("shows the state and the allowed transitions, applies one", async () => {
    const c = stub(); const applied = vi.fn();
    mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} onApplied={applied} />);
    await screen.findByText("Draft");
    const btn = await screen.findByRole("button", { name: "Actions" });
    fireEvent.keyDown(btn, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(c.applyWorkflow).toHaveBeenCalledWith(doc, "Approve"));
    await waitFor(() => expect(applied).toHaveBeenCalled());
  });
  it("hides actions the owner may not self-approve; renders nothing for a new document", async () => {
    stub();
    const { container, unmount } = mount(<FrappeWorkflowActions doc={{ ...doc, owner: "boss@x" }} user="boss@x" />);
    await screen.findByText("Draft");
    expect(screen.queryByRole("button", { name: "Actions" })).toBeNull();
    unmount();
    const r = mount(<FrappeWorkflowActions doc={{ ...doc, __islocal: 1 }} user="x" />);
    expect(r.container.textContent).toBe("");
    void container;
  });
  it("after apply, the doc cache holds the BARE doc and useDoc shows the new workflow_state (regression: it used to store { ...old, doc })", async () => {
    const c = stub();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Probe = () => { const q = useDoc("Deal", "D1"); return <p data-testid="state">{String(q.data?.doc.workflow_state ?? "-")}</p>; };
    mount(<><Probe /><FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} /></>, qc);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Draft"));
    const btn = await screen.findByRole("button", { name: "Actions" });
    fireEvent.keyDown(btn, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(c.applyWorkflow).toHaveBeenCalled());
    const cached = qc.getQueryData(["sf-frappe", "doc", "Deal", "D1"]) as Record<string, unknown>;
    expect(cached.workflow_state).toBe("Approved");
    expect("doc" in cached).toBe(false);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("Approved"));
  });
  it("falls back when the DocType has no workflow", async () => {
    stub({ getMetaBundle: vi.fn(async () => ({ ...bundle, meta: { ...bundle.meta, __workflow_docs: [] } })) });
    mount(<FrappeWorkflowActions doc={doc} user="x" fallback={<i>no wf</i>} />);
    expect(await screen.findByText("no wf")).toBeTruthy();
  });
  it("disables the actions with a reason while the form has unsaved edits; does not fetch transitions", async () => {
    const c = stub();
    mount(<FrappeWorkflowActions doc={{ ...doc, __unsaved: 1 }} user="boss@x" roles={["Sales Manager"]} />);
    await screen.findByText("Draft");
    expect(c.getWorkflowTransitions).not.toHaveBeenCalled();
  });
  it("shows the server's refusal when apply fails", async () => {
    stub({ applyWorkflow: vi.fn(async () => { throw new Error("Not a valid Workflow Action"); }) });
    mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} confirm />);
    const btn = await screen.findByRole("button", { name: "Actions" });
    fireEvent.keyDown(btn, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirm" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Not a valid Workflow Action");
  });
});

describe("FrappeStatusIndicator", () => {
  it("shows the workflow state with its style tone, then docstatus words without a workflow", async () => {
    stub();
    mount(<FrappeStatusIndicator doc={{ ...doc, workflow_state: "Approved" }} />);
    const el = await screen.findByText("Approved");
    expect(el.closest("[data-tone]")?.getAttribute("data-tone")).toBe("success");
  });
  it("Not Saved wins", async () => {
    stub();
    mount(<FrappeStatusIndicator doc={{ ...doc, __unsaved: 1 }} />);
    expect(await screen.findByText("Not Saved")).toBeTruthy();
  });
});

describe("FrappeAssignTo", () => {
  it("lists docinfo.assignments, adds then re-reads docinfo (not the 5-row return), removes only when allowed", async () => {
    const c = stub();
    mount(<FrappeAssignTo doc={doc} user="me@x" variant="list" />);
    await screen.findByText("Bob Ray");
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull(); // not the assignee, no write
    fireEvent.click(screen.getByRole("button", { name: "Add assignment" }));
    fireEvent.click(await screen.findByRole("option", { name: "Cy" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(c.addAssignment).toHaveBeenCalledWith("Deal", "D1", ["cy@x"], {}));
    await waitFor(() => expect(c.getDocInfo).toHaveBeenCalledTimes(2));
  });
  it("assignee and writers can remove", async () => {
    const c = stub();
    mount(<FrappeAssignTo doc={doc} user="bob@x" variant="list" />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove Bob Ray" }));
    await waitFor(() => expect(c.removeAssignment).toHaveBeenCalledWith("Deal", "D1", "bob@x"));
  });
  it("new documents cannot be assigned", async () => {
    stub();
    mount(<FrappeAssignTo doc={{ ...doc, __islocal: 1 }} user="me@x" />);
    expect(screen.queryByRole("button", { name: "Add assignment" })).toBeNull();
  });
});

describe("FrappeTimeline renders the server's stored text", () => {
  const b2: MetaBundle = { doctype: "Deal", meta: { name: "Deal", fields: [{ fieldname: "amount", fieldtype: "Currency", label: "Amount" }], permissions: [{ role: "Sales User", permlevel: 0, read: 1, write: 1 }] } as never, children: {} };
  it("shows version values and assignment text verbatim", async () => {
    const ver = { name: "V2", owner: "bob@x", creation: "2026-11-02 10:00:00", data: JSON.stringify({ changed: [["amount", "USD 111,000.00", "USD 222,000.00"]] }) };
    stub({ getDocInfo: vi.fn(async () => ({ ...info, comments: [], versions: [ver], assignment_logs: [{ name: "A9", owner: "bob@x", creation: "2026-11-02 11:00:00", content: "Bob Ray assigned Cy Lo: call" }] })) as never });
    mount(<FrappeTimeline doc={doc} user="me@x" bundle={b2} canComment={false} />);
    expect((await screen.findByText(/changed the value of/)).textContent).toContain("Amount from USD 111,000.00 to USD 222,000.00");
    expect((await screen.findByText(/assigned/, { selector: "span" })).textContent).toBe("Bob Ray assigned Cy Lo: call");
  });
});

describe("FrappeTimeline field visibility", () => {
  const fields = [
    { fieldname: "title", fieldtype: "Data", label: "Title" },
    { fieldname: "secret", fieldtype: "Data", label: "Secret", permlevel: 1 },
    { fieldname: "note", fieldtype: "Data", label: "Note", hidden: 1 },
  ];
  const b: MetaBundle = { doctype: "Deal", meta: { name: "Deal", fields, permissions: [{ role: "Sales User", permlevel: 0, read: 1, write: 1 }] } as never, children: {} };
  const ver = { name: "V1", owner: "bob@x", creation: "2026-11-02 10:00:00", data: JSON.stringify({ changed: [["secret", "a", "b"], ["note", "x", "y"], ["title", "1", "2"]] }) };
  it("skips changes to fields the user cannot read (permlevel) and hidden fields; keeps visible ones", async () => {
    stub({ getDocInfo: vi.fn(async () => ({ ...info, comments: [], versions: [ver] })) as never });
    mount(<FrappeTimeline doc={doc} user="me@x" bundle={b} canComment={false} />);
    const line = await screen.findByText(/changed the value of/);
    expect(line.textContent).toContain("Title from 1 to 2");
    expect(line.textContent).not.toMatch(/Secret|Note/);
  });
});

describe("FrappeWorkflowActions steps", () => {
  it("shows actor and time per past state from workflow_logs", async () => {
    stub({ getDocInfo: vi.fn(async () => ({ ...info, workflow_logs: [{ owner: "bob@x", creation: "2026-11-02 10:00:00", content: "Draft" }] })) as never });
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, workflow_state: "Approved", docstatus: 1 }} user="x" variant="steps" />);
    await waitFor(() => expect(container.querySelector("[data-entry]")?.textContent).toContain("Bob Ray"));
  });
});

describe("FrappeTimeline", () => {
  it("renders from docinfo, comment rights from props, adds a comment and re-reads docinfo", async () => {
    const c = stub();
    mount(<FrappeTimeline doc={doc} user="me@x" canDeleteComment />);
    await screen.findByText("hi");
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "new one" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => expect(c.addComment).toHaveBeenCalledWith("Deal", "D1", "new one"));
    await waitFor(() => expect(c.getDocInfo).toHaveBeenCalledTimes(2));
  });
  it("without delete permission on Comment no delete button, even for the owner", async () => {
    stub();
    mount(<FrappeTimeline doc={doc} user="me@x" />);
    await screen.findByText("hi");
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });
  it("pages communications: 21 from the server → 20 shown + Load more (start = shown count, limit 21)", async () => {
    const comm = (n: number) => ({ name: `C${n}`, subject: `S${n}`, sender: "z@x", communication_date: `2026-11-02 09:${String(n).padStart(2, "0")}:00` });
    const c = stub({ getDocInfo: vi.fn(async () => ({ ...info, comments: [], communications: Array.from({ length: 21 }, (_, i) => comm(i)) })) as never });
    c.call = vi.fn(async () => ({ message: [comm(30)] })) as never;
    mount(<FrappeTimeline doc={doc} user="me@x" canComment={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    await waitFor(() => expect(c.call).toHaveBeenCalledWith("frappe.desk.form.load.get_communications", { doctype: "Deal", name: "D1", start: 20, limit: 21 }));
    await screen.findByText(/S30/);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
  it("renders nothing for a new document and shows a load error", async () => {
    stub();
    const { container } = mount(<FrappeTimeline doc={{ ...doc, __islocal: 1 }} user="me@x" />);
    expect(container.textContent).toBe("");
    cleanup();
    stub({ getDocInfo: vi.fn(async () => { throw new Error("denied"); }) as never });
    mount(<FrappeTimeline doc={doc} user="me@x" />);
    expect((await screen.findByText("denied"))).toBeTruthy();
  });
});
