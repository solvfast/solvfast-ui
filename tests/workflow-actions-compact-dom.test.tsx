/**
 * 0.8.0-dev.10 — FrappeWorkflowActions after the removal of the legacy LifecycleBar.
 *
 * The compact variant (the default: state badge + Actions menu, FrappeForm's toolbar) used to be rendered by
 * LifecycleBar variant="compact". Its DOM is compared, scenario by scenario, with HTML captured on the UNMODIFIED tree
 * at c7e5adc (0.8.0-dev.9) and committed before the removal: tests/fixtures/workflow-actions-compact.before.json.
 * Capture (only ever on the unmodified tree):  SF_CAPTURE_COMPACT_FIXTURE=1 npx vitest run tests/workflow-actions-compact-dom.test.tsx
 * The comparison is a plain string equality (no snapshot tooling that could rewrite the "before").
 * Normalisation: React `useId` / Radix ids (`:r1:`, `radix-:r1:`) depend on render order, so they are replaced by
 * `:id:` — nothing else is changed.
 *
 * Also: the compact / actions / rail variants still apply transitions through the SIMULATED fixture transport
 * (createFixtureTransport — an approximation of Frappe, not a site).
 */
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeProvider, createFrappeClient } from "../src/frappe";
import { FrappeWorkflowActions } from "../src/frappe/record";
import { FrappeForm } from "../src/frappe/form";
import type { FrappeApi } from "../src/frappe/client";
import type { DocInfo, DocTypeMeta, FrappeDoc, MetaBundle } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";

type RecordClient = Partial<FrappeApi>;

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const FIXTURE = path.resolve(__dirname, "fixtures/workflow-actions-compact.before.json");
const CAPTURE = process.env.SF_CAPTURE_COMPACT_FIXTURE === "1";
const captured: Record<string, string> = {};
const before: Record<string, string> = CAPTURE ? {} : JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
const norm = (html: string) => html.replace(/radix-:r[0-9a-z]+:/g, "radix-:id:").replace(/:r[0-9a-z]+:/g, ":id:");
/** Records (capture mode) or compares (normal mode) one scenario's HTML. */
function same(name: string, html: string) {
  const h = norm(html);
  if (CAPTURE) { captured[name] = h; fs.writeFileSync(FIXTURE, JSON.stringify(captured, null, 2) + "\n"); return; }
  expect(before[name], `fixture has scenario ${name}`).toBeTypeOf("string");
  expect(h).toBe(before[name]);
}
/** Lets pending queries settle, then waits until the HTML stops changing. */
async function settled(el: () => string) {
  let prev = "";
  for (let i = 0; i < 20; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 25)); });
    const now = el();
    if (now === prev) return now;
    prev = now;
  }
  return prev;
}

// ─── stub client (request / response SHAPES only, as in record-frappe-ui.test.tsx) ─────────────────────────────────
const wfDocs = [
  { doctype: "Workflow", name: "WF", document_type: "Deal", workflow_state_field: "workflow_state", override_status: 0,
    states: [{ state: "Draft", doc_status: "0", allow_edit: "Sales User" }, { state: "Approved", doc_status: "1", allow_edit: "Sales Manager" }, { state: "Rejected", doc_status: "0", allow_edit: "Sales Manager" }],
    transitions: [
      { state: "Draft", action: "Approve", next_state: "Approved", allowed: "Sales Manager", allow_self_approval: 0 },
      { state: "Draft", action: "Reject", next_state: "Rejected", allowed: "Sales Manager", allow_self_approval: 0 },
    ] },
  { doctype: "Workflow State", name: "Draft" }, { doctype: "Workflow State", name: "Approved", style: "Success" }, { doctype: "Workflow State", name: "Rejected", style: "Danger" },
];
const bundle: MetaBundle = {
  doctype: "Deal",
  meta: { name: "Deal", is_submittable: 1, fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }], __workflow_docs: wfDocs } as never,
  children: {},
};
const info: DocInfo = { attachments: [], communications: [], comments: [], versions: [], assignments: [], assignment_logs: [], shared: [], views: [], permissions: {}, user_info: {} };
const doc: FrappeDoc = { doctype: "Deal", name: "D1", owner: "creator@x", title: "T", workflow_state: "Draft", docstatus: 0, creation: "2026-11-01 10:00:00", modified: "2026-11-01 10:00:00", modified_by: "creator@x" };
const TRANSITIONS = (wfDocs[0] as { transitions: unknown[] }).transitions;

let current: RecordClient = {};
function stub(over: Partial<RecordClient> = {}): RecordClient & Record<string, ReturnType<typeof vi.fn>> {
  current = {
    call: vi.fn(async () => ({ message: [] })), getMetaBundle: vi.fn(async () => bundle), subscribeMessages: () => () => {},
    getDoc: vi.fn(async () => ({ doc, docinfo: info })), getDocInfo: vi.fn(async () => info), addComment: vi.fn(async () => ({}) as never),
    getWorkflowTransitions: vi.fn(async () => TRANSITIONS),
    applyWorkflow: vi.fn(async (d: FrappeDoc, action: string) => ({ ...d, workflow_state: action === "Approve" ? "Approved" : "Rejected", docstatus: action === "Approve" ? 1 : 0 })),
    ...over,
  } as never;
  return current as never;
}
const mount = (ui: React.ReactElement, opts: { lang?: "en" | "ar"; translations?: Record<string, string> } = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FrappeProvider client={current as never} session={{ user: "me@x", roles: ["Sales User"] }} translations={opts.translations}>
        <ThemeProvider defaultTheme="light" defaultLanguage={opts.lang ?? "en"} storageKeys={null}>{ui}</ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );

describe("FrappeWorkflowActions compact (default) — DOM equals the c7e5adc capture (LifecycleBar variant=\"compact\")", () => {
  it("draft, two actions: badge + Actions menu", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} />);
    await screen.findByRole("button", { name: "Actions" });
    same("draft-actions", await settled(() => container.innerHTML));
    // the compact structure: div.flex.flex-col.gap-3 › div.flex.flex-wrap.items-center.justify-between.gap-2 › badge + ActionBar
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe("flex flex-col gap-3");
    expect((root.firstElementChild as HTMLElement).className).toBe("flex flex-wrap items-center justify-between gap-2");
    expect(root.firstElementChild!.children.length).toBe(2);
    expect(root.querySelector("ol")).toBeNull();
  });
  it("draft, menu open: the items", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} />);
    fireEvent.keyDown(await screen.findByRole("button", { name: "Actions" }), { key: "Enter" });
    const menu = await screen.findByRole("menu");
    await settled(() => document.body.innerHTML);
    same("draft-menu-open-container", container.innerHTML);
    same("draft-menu-open-menu", menu.outerHTML);
  });
  it("owner may not self-approve: badge only", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, owner: "boss@x" }} user="boss@x" roles={["Sales Manager"]} />);
    await screen.findByText("Draft");
    const html = await settled(() => container.innerHTML);
    expect(screen.queryByRole("button", { name: "Actions" })).toBeNull();
    same("self-approval-badge-only", html);
  });
  it("unsaved: actions disabled with the reason", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, __unsaved: 1 }} user="boss@x" roles={["Sales Manager"]} />);
    await screen.findByText("Draft");
    same("unsaved", await settled(() => container.innerHTML));
  });
  it("approved (Success tone), no transitions", async () => {
    stub({ getWorkflowTransitions: vi.fn(async () => []) as never });
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, workflow_state: "Approved", docstatus: 1 }} user="boss@x" roles={["Sales Manager"]} />);
    await screen.findByText("Approved");
    const html = await settled(() => container.innerHTML);
    expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("success");
    same("approved-success", html);
  });
  it("rejected (Danger tone) with no transitions", async () => {
    stub({ getWorkflowTransitions: vi.fn(async () => []) as never });
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, workflow_state: "Rejected" }} user="boss@x" roles={["Sales Manager"]} />);
    await screen.findByText("Rejected");
    same("rejected-danger", await settled(() => container.innerHTML));
  });
  it("a state the workflow does not list: its (translated) name, neutral", async () => {
    stub({ getWorkflowTransitions: vi.fn(async () => []) as never });
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, workflow_state: "Legacy" }} user="boss@x" roles={["Sales Manager"]} />, { translations: { Legacy: "Old state" } });
    await screen.findByText("Old state");
    same("unlisted-state", await settled(() => container.innerHTML));
  });
  it("no state on the document: the first state (Desk's default) or the dash", async () => {
    stub({ getWorkflowTransitions: vi.fn(async () => []) as never });
    const { container } = mount(<FrappeWorkflowActions doc={{ ...doc, workflow_state: undefined }} user="boss@x" roles={["Sales Manager"]} />);
    await waitFor(() => expect(container.querySelector("[data-tone]")).not.toBeNull());
    same("no-state", await settled(() => container.innerHTML));
  });
  it("Arabic with the provider's translations", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} />, { lang: "ar", translations: { Draft: "مسودة", Approve: "اعتماد", Reject: "رفض" } });
    await screen.findByText("مسودة");
    await waitFor(() => expect(container.querySelector("button")).not.toBeNull());
    same("arabic", await settled(() => container.innerHTML));
  });
  it("className and actionLabels", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} className="my-x" actionLabels={{ actions: "Workflow" }} />);
    await screen.findByRole("button", { name: "Workflow" });
    same("classname-labels", await settled(() => container.innerHTML));
  });
  it("transitions call failed: the badge stays, the error is shown (unavailable)", async () => {
    stub({ getWorkflowTransitions: vi.fn(async () => { throw new Error("boom"); }) as never });
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} />);
    await waitFor(() => expect(container.querySelector('[data-workflow-actions="unavailable"]')).not.toBeNull());
    same("unavailable", await settled(() => container.innerHTML));
  });
  it("user unknown: the read-only notice (unknown)", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="" />);
    await waitFor(() => expect(container.querySelector('[data-workflow-actions="unknown"]')).not.toBeNull());
    same("unknown-user", await settled(() => container.innerHTML));
  });
  it("busy while apply_workflow runs", async () => {
    const c = stub({ applyWorkflow: vi.fn(() => new Promise<FrappeDoc>(() => {})) as never });
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} checkMandatory={false} />);
    fireEvent.keyDown(await screen.findByRole("button", { name: "Actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(c.applyWorkflow).toHaveBeenCalled());
    same("busy", await settled(() => container.innerHTML));
  });
  it("confirm: the confirmation dialog", async () => {
    stub();
    const { container } = mount(<FrappeWorkflowActions doc={doc} user="boss@x" roles={["Sales Manager"]} confirm />);
    fireEvent.keyDown(await screen.findByRole("button", { name: "Actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    const dlg = await screen.findByRole("alertdialog");
    await settled(() => document.body.innerHTML);
    same("confirm-container", container.innerHTML);
    same("confirm-dialog", dlg.outerHTML);
  });
});

// ─── SIMULATED fixture transport (createFixtureTransport) ─────────────────────────────────────────────────────────
const SM = { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, submit: 1, cancel: 1, delete: 1 };
const FLOW: DocTypeMeta = {
  name: "Flow Memo", is_submittable: 1, autoname: "hash", title_field: "title",
  fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }, { fieldname: "workflow_state", fieldtype: "Link", label: "Workflow State", options: "Workflow State", hidden: 1 }],
  permissions: [SM],
} as DocTypeMeta;
const FLOW_WF = {
  name: "Flow", document_type: "Flow Memo", workflow_state_field: "workflow_state",
  states: [{ state: "Draft", doc_status: "0", allow_edit: "System Manager" }, { state: "Review", doc_status: "0", allow_edit: "System Manager" }, { state: "Approved", doc_status: "1", allow_edit: "System Manager" }],
  transitions: [
    { state: "Draft", action: "Send for review", next_state: "Review", allowed: "System Manager", allow_self_approval: 1 },
    { state: "Review", action: "Approve", next_state: "Approved", allowed: "System Manager", allow_self_approval: 1 },
  ],
};
const T0 = "2026-11-01 10:00:00.000000";
function site() {
  return createFixtureTransport({
    meta: { "Flow Memo": [FLOW] }, workflows: { "Flow Memo": FLOW_WF as never },
    docs: { "Flow Memo": [{ doctype: "Flow Memo", name: "FM-1", title: "Plan", docstatus: 0, workflow_state: "Draft", modified: T0, creation: T0, owner: "Administrator" }] as FrappeDoc[] },
  });
}
const stored = (t: ReturnType<typeof site>) => t.store.docs.get("Flow Memo")!.get("FM-1")!;
function mountSim(t: ReturnType<typeof site>, ui: (d: FrappeDoc) => React.ReactElement) {
  const client = createFrappeClient({ transport: t });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={client} queryClient={qc} session={{ user: "Administrator", roles: ["System Manager"] }} serverMessages={false}>
        <ThemeProvider defaultTheme="light" storageKeys={null}>{ui({ ...stored(t) })}</ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
}
const applyCalls = (t: ReturnType<typeof site>) => t.store.calls.filter((c) => c.method === "frappe.model.workflow.apply_workflow");

describe("FrappeWorkflowActions applies transitions through the SIMULATED fixture transport", () => {
  it("compact (default): Actions → Send for review → the stored document is in Review", async () => {
    const t = site(); const applied = vi.fn();
    mountSim(t, (d) => <FrappeWorkflowActions doc={d} user="Administrator" roles={["System Manager"]} onApplied={applied} />);
    fireEvent.keyDown(await screen.findByRole("button", { name: "Actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Send for review" }));
    await waitFor(() => expect(applied).toHaveBeenCalledWith(expect.objectContaining({ workflow_state: "Review" }), "Send for review"));
    expect(applyCalls(t).length).toBe(1);
    expect(stored(t).workflow_state).toBe("Review");
  });
  it("actions: the header menu applies the transition", async () => {
    const t = site(); const applied = vi.fn();
    mountSim(t, (d) => <FrappeWorkflowActions doc={d} user="Administrator" roles={["System Manager"]} variant="actions" onApplied={applied} />);
    fireEvent.keyDown(await screen.findByRole("button", { name: "Actions" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Send for review" }));
    await waitFor(() => expect(applied).toHaveBeenCalledWith(expect.objectContaining({ workflow_state: "Review" }), "Send for review"));
    expect(stored(t).workflow_state).toBe("Review");
  });
  it("rail (applyFromRail): the way forward applies the transition; read-only rail lists it and applies nothing", async () => {
    const t = site(); const applied = vi.fn();
    const { container } = mountSim(t, (d) => <FrappeWorkflowActions doc={d} user="Administrator" roles={["System Manager"]} variant="rail" applyFromRail onApplied={applied} />);
    await waitFor(() => expect(container.querySelector('[data-workflow-actions="rail"]')).not.toBeNull());
    fireEvent.click(await within(container).findByRole("button", { name: /Review/ }));
    await waitFor(() => expect(applied).toHaveBeenCalledWith(expect.objectContaining({ workflow_state: "Review" }), "Send for review"));
    expect(stored(t).workflow_state).toBe("Review");
    cleanup();
    const t2 = site();
    const r = mountSim(t2, (d) => <FrappeWorkflowActions doc={d} user="Administrator" roles={["System Manager"]} variant="rail" />);
    await waitFor(() => expect(r.container.textContent).toContain("Review"));
    expect(within(r.container).queryByRole("button", { name: /Review/ })).toBeNull();
    expect(applyCalls(t2).length).toBe(0);
  });
  it("FrappeForm's toolbar (SIMULATED): the compact badge + Actions menu DOM equals the c7e5adc capture; the action applies", async () => {
    const t = site();
    const client = createFrappeClient({ transport: t });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <FrappeProvider client={client} queryClient={qc} session={{ user: "Administrator", roles: ["System Manager"] }} serverMessages={false}>
          <ThemeProvider defaultTheme="light" storageKeys={null}><FrappeForm doctype="Flow Memo" name="FM-1" guardUnload={false} /></ThemeProvider>
        </FrappeProvider>
      </QueryClientProvider>,
    );
    const btn = await screen.findByRole("button", { name: "Actions" });
    const root = () => btn.closest("div.flex.flex-col.gap-3") as HTMLElement;
    expect(root()).not.toBeNull();
    same("frappe-form-toolbar", await settled(() => root().outerHTML));
    fireEvent.keyDown(btn, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Send for review" }));
    await waitFor(() => expect(stored(t).workflow_state).toBe("Review"));
    expect(applyCalls(t).length).toBe(1);
  });
});
