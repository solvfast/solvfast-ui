/**
 * SayrRecordPage (`@solvfast/ui/sayr`) on the in-package SIMULATOR: Sayr's `record_page`, `execute_transition` and the
 * playbook checklist answered by fixture handlers. SIMULATED, never a real site.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocPerm, DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import { AssignDialog } from "../src/record/AssignDialog";
import { RECORD_PAGE_METHOD, SayrRecordPage, TRANSITION_METHOD, type RecordPageData } from "../src/sayr";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); window.localStorage.clear(); });

const T = "2026-11-10 09:00:00.000000";
const ALL: DocPerm[] = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }];
const BUG: DocTypeMeta = {
  name: "Ticket Bug", autoname: "hash", title_field: "title", permissions: ALL,
  fields: [
    { fieldname: "title", fieldtype: "Data", label: "Title" },
    { fieldname: "workflow_state", fieldtype: "Data", label: "State", hidden: 1 },
    { fieldname: "change_tab", fieldtype: "Tab Break", label: "Booking Change Request" },
    { fieldname: "booking", fieldtype: "Data", label: "Booking Reference" },
  ],
};
const doc = { doctype: "Ticket Bug", name: "TKT-00008", owner: "omar@x.test", creation: T, modified: T, modified_by: "Administrator", docstatus: 0, title: "Login does nothing", workflow_state: "New" } as FrappeDoc;

const LIFECYCLE: NonNullable<RecordPageData["lifecycle"]> = {
  lifecycle: "SEAR-LC-00001", title: "Support", status: "tst_new", phase: "open", status_label_en: "New", status_label_ar: "جديد", playbook: null,
  states: [
    { state_key: "tst_new", name_en: "New", name_ar: "جديد", phase: "open", color: "blue", is_current: true },
    { state_key: "tst_in_progress", name_en: "In Progress", name_ar: "قيد المعالجة", phase: "open", color: "orange", is_current: false },
  ],
  actions: [{ transition_key: "tst_new__tst_in_progress_1", action_en: "Start Work", action_ar: "بدء العمل", to_state: "tst_in_progress", to_phase: "open" }],
};
const task = (i: number) => ({ name: `TD-${i}`, allocated_to: "omar@x.test", allocated_to_name: "Omar Ali", status: "Open", priority: "High", date: null, description: `<p>Call guest ${i}</p>` });
const PAGE = (over: Partial<RecordPageData> = {}): RecordPageData => ({
  header: { owner: "omar@x.test", owner_name: "Omar Ali", creation: T, modified_by: "Administrator", modified_by_name: "Administrator", modified: T },
  lifecycle_deployed: true,
  lifecycle: LIFECYCLE,
  sla: {
    deployed: true, policy: "SEAR-SLA-00001", policy_name: "Test Support SLA", level: "Service", calendar_name: "Egypt Business Hours", priority: "High",
    targets: { first_response: 3600, resolution: 28800 },
    clock: { status: "Running", first_response: { due: "2026-11-11 10:00:00", met_on: null, breached: false }, resolution: { due: "2026-11-11 17:00:00", met_on: null, breached: false } },
  },
  assignment: { todo_description: "Follow up within the hour" },
  tasks: [task(1)],
  ...over,
});

function site(page: RecordPageData, calls: string[] = []) {
  const t = createFixtureTransport(
    { meta: { "Ticket Bug": [BUG] }, docs: { "Ticket Bug": [doc] } },
    {
      handlers: {
        [RECORD_PAGE_METHOD]: () => { calls.push(RECORD_PAGE_METHOD); return { message: page }; },
        [TRANSITION_METHOD]: (args) => { calls.push(`${TRANSITION_METHOD}:${String(args.transition_key)}`); return { message: {} }; },
      },
    },
  );
  return createFrappeClient({ transport: t });
}

function mount(page: RecordPageData, language: "en" | "ar" = "en", calls: string[] = []) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={site(page, calls)} queryClient={qc} session={{ user: "Administrator", fullName: "Administrator", roles: ["System Manager"] }}>
        <ThemeProvider defaultLanguage={language} storageKeys={null}>
          <SayrRecordPage doctype="Ticket Bug" name="TKT-00008" typeLabel="Bug" onBack={() => {}} />
        </ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
}

describe("RP.header — the header card and the type's tabs", () => {
  it("RP.header.1 shows the title, the name, the status, the owner's name (not id) and when it was created", async () => {
    const { container } = mount(PAGE());
    const header = await waitFor(() => {
      const el = container.querySelector("[data-record-header]");
      if (!el) throw new Error("no header yet");
      return el as HTMLElement;
    });
    await waitFor(() => expect(within(header).getByText("Omar Ali")).toBeTruthy());
    expect(within(header).getByText("Login does nothing")).toBeTruthy();
    expect(within(header).getByText("#TKT-00008")).toBeTruthy();
    expect(within(header).getByText("New")).toBeTruthy();
    expect(within(header).queryByText("omar@x.test")).toBeNull();
    expect(within(header).getByText(/^Created /)).toBeTruthy();
  });

  it("RP.header.2 the tab bar is the type DocType's own tabs, full width", async () => {
    const { container } = mount(PAGE());
    await waitFor(() => expect(screen.getByRole("tab", { name: "Booking Change Request" })).toBeTruthy());
    expect(screen.getByRole("tab", { name: "Details" })).toBeTruthy();
    expect(container.querySelector("[data-tab-bar='record']")).toBeTruthy();
  });
});

describe("RP.lifecycle — current status, next actions, the builder link", () => {
  it("RP.lifecycle.1 a next action runs Sayr's transition", async () => {
    const calls: string[] = [];
    mount(PAGE(), "en", calls);
    const action = await waitFor(() => screen.getByRole("button", { name: "Start Work" }));
    fireEvent.click(action);
    await waitFor(() => expect(calls).toContain(`${TRANSITION_METHOD}:tst_new__tst_in_progress_1`));
    expect(screen.getByRole("button", { name: "View full lifecycle" })).toBeTruthy();
  });

  it("RP.lifecycle.2 no lifecycle on the type says so", async () => {
    mount(PAGE({ lifecycle: null, lifecycle_deployed: false }));
    await waitFor(() => expect(screen.getByText("No lifecycle on this type")).toBeTruthy());
  });
});

describe("RP.cards — empty states, tasks, customize", () => {
  it("RP.cards.1 SLA shows the policy, its status and both due times; none deployed says so", async () => {
    const { container, unmount } = mount(PAGE());
    await waitFor(() => expect(screen.getByText("Test Support SLA")).toBeTruthy());
    expect(container.querySelector("[data-sla-status='Running']")).toBeTruthy();
    expect(screen.getByText("First response")).toBeTruthy();
    unmount();
    mount(PAGE({ sla: { deployed: false } }));
    await waitFor(() => expect(screen.getByText("No SLA deployed")).toBeTruthy());
  });

  it("RP.cards.2 tasks are listed as text; more than five scroll", async () => {
    const { container, unmount } = mount(PAGE());
    await waitFor(() => expect(screen.getByText("Call guest 1")).toBeTruthy());
    expect(container.querySelector("[data-tasks-scroll]")).toBeNull();
    unmount();
    const many = mount(PAGE({ tasks: [1, 2, 3, 4, 5, 6].map(task) }));
    await waitFor(() => expect(many.container.querySelector("[data-tasks-scroll]")).toBeTruthy());
  });

  it("RP.cards.3 Customize sections hides a card, and the choice is kept for the DocType", async () => {
    const { container, unmount } = mount(PAGE());
    await waitFor(() => expect(container.querySelector("[data-rail-card='sla']")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Customize sections" }));
    fireEvent.click(await waitFor(() => document.querySelector("[data-rail-toggle='sla']") as HTMLElement));
    await waitFor(() => expect(container.querySelector("[data-rail-card='sla']")).toBeNull());
    expect(container.querySelector("[data-rail-card='lifecycle']")).toBeTruthy();
    unmount();
    const again = mount(PAGE());
    await waitFor(() => expect(again.container.querySelector("[data-rail-card='tasks']")).toBeTruthy());
    expect(again.container.querySelector("[data-rail-card='sla']")).toBeNull();
  });

  it("RP.cards.4 Arabic labels", async () => {
    mount(PAGE({ sla: { deployed: false } }), "ar");
    await waitFor(() => expect(screen.getByText("لا توجد اتفاقية خدمة منشورة")).toBeTruthy());
    expect(screen.getByRole("button", { name: "تخصيص الأقسام" })).toBeTruthy();
  });
});

describe("RP.assign — AssignDialog threePriorities", () => {
  it("RP.assign.1 offers only Low / Medium / High, Medium first, and keeps the given comment", async () => {
    render(
      <ThemeProvider storageKeys={null}>
        <AssignDialog open onOpenChange={() => {}} searchUsers={async () => []} onAssign={() => {}} details threePriorities
          defaultDetails={{ description: "Follow up within the hour" }} />
      </ThemeProvider>,
    );
    expect((screen.getByLabelText("Comment") as HTMLTextAreaElement).value).toBe("Follow up within the hour");
    const priority = screen.getByLabelText("Priority");
    expect(priority.textContent).toContain("Medium");
    fireEvent.click(priority);
    await waitFor(() => expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Low", "Medium", "High"]));
  });
});
