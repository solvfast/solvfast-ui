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
import { RECORD_PAGE_METHOD, SayrNewRecordPage, SayrRecordPage, TRANSITION_METHOD, TYPE_PREVIEW_METHOD, WALK_TREE_METHOD, type RecordPageData, type TypePreviewData } from "../src/sayr";
import type { FamilyDescriptor } from "../src/frappe";

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

describe("RP.notes — Pinned Notes are the record's comments", () => {
  it("RP.notes.1 an empty list says No notes yet", async () => {
    mount(PAGE());
    await waitFor(() => expect(screen.getByText("No notes yet")).toBeTruthy());
  });
});

const REGISTRY: DocTypeMeta = {
  name: "Ticket Type", autoname: "field:type_name", title_field: "type_name", permissions: ALL,
  fields: [
    { fieldname: "type_name", fieldtype: "Data", label: "Name" },
    { fieldname: "type_doctype", fieldtype: "Link", label: "Records DocType", options: "DocType" },
    { fieldname: "enabled", fieldtype: "Check", label: "Enabled" },
  ],
};
const FAMILY: FamilyDescriptor = { parent: "Ticket", registry: "Ticket Type", labelField: "type_name" };
const PREVIEW: TypePreviewData = {
  lifecycle: { lifecycle: "SEAR-LC-00001", title: "Support", states_count: 4, initial: { state_key: "tst_new", name_en: "New", name_ar: "جديد", phase: "open" } },
  sla: { deployed: true, policy: "SEAR-SLA-00001", policy_name: "Test Support SLA", level: "Service", calendar_name: "Egypt Business Hours",
    targets: [{ priority: "urgent", first_response: 1800, resolution: 14400 }, { priority: "high", first_response: 3600, resolution: 28800 }] },
  assignment: [{ profile: "SEAR-AP-00001", profile_name: "Test Support Assignment", strategy: "Round Robin" }],
};

function mountNew(defaultType?: string, decisionTree?: string, ends: "Bug" | "Elsewhere" = "Bug") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const t = createFixtureTransport(
    { meta: { "Ticket Type": [REGISTRY], "Ticket Bug": [BUG] },
      docs: { "Ticket Type": [{ doctype: "Ticket Type", name: "Bug", type_name: "Bug", type_doctype: "Ticket Bug", enabled: 1, owner: "Administrator", creation: T, modified: T, docstatus: 0 } as FrappeDoc] } },
    { handlers: {
      [TYPE_PREVIEW_METHOD]: () => ({ message: PREVIEW }),
      [WALK_TREE_METHOD]: (args) => {
        const answers = JSON.parse(String(args.answers ?? "[]")) as string[];
        if (!answers.length) return { message: { kind: "question", question_en: "Is something broken?", options: [{ option_id: "o_yes", label_en: "Yes" }] } };
        return { message: ends === "Bug" ? { kind: "outcome", registry_doctype: "Ticket Type", type: "Bug" }
          : { kind: "outcome", registry_doctype: "Sear Organization Unit Types", type: "Section" } };
      },
    } },
  );
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={createFrappeClient({ transport: t })} queryClient={qc} session={{ user: "Administrator", fullName: "Administrator", roles: ["System Manager"] }}>
        <ThemeProvider storageKeys={null}>
          <SayrNewRecordPage family={FAMILY} defaultType={defaultType} decisionTree={decisionTree} onCreated={() => {}} onCancel={() => {}} backLabel="Tickets"
            labels={{ title: { en: "New Ticket", ar: "تذكرة جديدة" } }} />
        </ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
}

describe("RP.new — a new record laid out like the record page", () => {
  it("RP.new.1 header card with the title, Not saved and the type picker; Back and Create on top", async () => {
    const { container } = mountNew();
    await waitFor(() => expect(container.querySelector("[data-new-record-page]")).toBeTruthy());
    const header = container.querySelector("[data-record-header]") as HTMLElement;
    expect(within(header).getByText("New Ticket")).toBeTruthy();
    expect(within(header).getByText("Not Saved")).toBeTruthy();
    await waitFor(() => expect(within(header).getByLabelText(/Type/)).toBeTruthy());
    expect(screen.getByRole("button", { name: "Tickets" })).toBeTruthy();
    expect(screen.getAllByText("Choose a type to see what it brings.").length).toBeGreaterThan(0);
  });

  it("RP.new.2 with a type: the rail previews its lifecycle, SLA targets and assignment; the rest waits for the record", async () => {
    const { container } = mountNew("Bug");
    await waitFor(() => expect(screen.getByText("Test Support SLA")).toBeTruthy());
    expect(screen.getByText("Test Support Assignment")).toBeTruthy();
    expect(container.querySelector("[data-sla-preview='SEAR-SLA-00001']")?.textContent).toContain("30 min");
    expect(screen.getByRole("button", { name: "View full lifecycle" })).toBeTruthy();
    expect(screen.getAllByText("Available after the record is created.").length).toBe(4);
    // Not a wizard type: one form, no tabs; the type's own fields follow the shared ones.
    await waitFor(() => expect(screen.getByText("Booking Reference")).toBeTruthy());
    expect(screen.queryByRole("tab", { name: "Booking Change Request" })).toBeNull();
  });
});

describe("RP.oneForm — the record page follows the type's wizard mode", () => {
  it("RP.oneForm.1 oneForm: every field in one form, no tab bar", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <FrappeProvider client={site(PAGE())} queryClient={qc} session={{ user: "Administrator", fullName: "Administrator", roles: ["System Manager"] }}>
          <ThemeProvider storageKeys={null}><SayrRecordPage doctype="Ticket Bug" name="TKT-00008" oneForm /></ThemeProvider>
        </FrappeProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("Booking Reference")).toBeTruthy());
    expect(screen.queryByRole("tab", { name: "Booking Change Request" })).toBeNull();
  });
});

describe("RP.finder — Not sure? Find the right type", () => {
  it("RP.finder.1 no decision tree, no link", async () => {
    const { container } = mountNew();
    await waitFor(() => expect(container.querySelector("[data-new-record-page]")).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText(/Type/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Not sure? Find the right type" })).toBeNull();
  });

  it("RP.finder.2 the walk ends on a type offered here: Use this type picks it", async () => {
    mountNew(undefined, "SEAR-DT-00001");
    fireEvent.click(await screen.findByRole("button", { name: "Not sure? Find the right type" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use this type" }));
    // The type is chosen: the rail previews what it brings.
    await waitFor(() => expect(screen.getByText("Test Support SLA")).toBeTruthy());
  });

  it("RP.finder.3 the walk ends elsewhere: a warning, and the type stays empty; Back goes to the question", async () => {
    mountNew(undefined, "SEAR-DT-00001", "Elsewhere");
    fireEvent.click(await screen.findByRole("button", { name: "Not sure? Find the right type" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(document.querySelector("[data-type-finder-warning]")?.textContent).toContain("Section"));
    expect(screen.queryByRole("button", { name: "Use this type" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText("Is something broken?")).toBeTruthy();
    expect(screen.getAllByText("Choose a type to see what it brings.").length).toBeGreaterThan(0);
  });
});

