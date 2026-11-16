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
import { RECORD_PAGE_METHOD, SayrNewRecordPage, SayrRecordPage, TRANSITION_METHOD, TYPE_PREVIEW_METHOD, WALK_TREE_METHOD, type RecordPageData, type RecordPageTab, type RecordRailExtraCard, type SayrRecordPageProps, type TypePreviewData } from "../src/sayr";
import type { FamilyDescriptor } from "../src/frappe";
import { User } from "lucide-react";

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
  initial_state: "tst_new",
  transitions: [
    { transition_key: "tst_new__tst_in_progress_1", from_state: "tst_new", to_state: "tst_in_progress", action_en: "Start Work", action_ar: "بدء العمل" },
    { transition_key: "tst_in_progress__tst_new_1", from_state: "tst_in_progress", to_state: "tst_new", action_en: "Reopen", action_ar: "إعادة فتح" },
  ],
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

function mount(page: RecordPageData, language: "en" | "ar" = "en", calls: string[] = [], extraCards?: RecordRailExtraCard[], tabs?: Partial<Omit<SayrRecordPageProps, "doctype" | "name">>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={site(page, calls)} queryClient={qc} session={{ user: "Administrator", fullName: "Administrator", roles: ["System Manager"] }}>
        <ThemeProvider defaultLanguage={language} storageKeys={null}>
          <SayrRecordPage doctype="Ticket Bug" name="TKT-00008" typeLabel="Bug" onBack={() => {}} extraCards={extraCards} {...tabs} />
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

  it("RP.header.3 the record's photo (its DocType's image field) replaces the initials", async () => {
    const withPhoto = { ...BUG, image_field: "photo", fields: [...BUG.fields, { fieldname: "photo", fieldtype: "Attach Image", label: "Photo" }] } as DocTypeMeta;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const t = createFixtureTransport({ meta: { "Ticket Bug": [withPhoto] }, docs: { "Ticket Bug": [{ ...doc, photo: "/files/omar.png" } as FrappeDoc] } },
      { handlers: { [RECORD_PAGE_METHOD]: () => ({ message: PAGE() }) } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <FrappeProvider client={createFrappeClient({ transport: t })} queryClient={qc} session={{ user: "Administrator", fullName: "Administrator", roles: ["System Manager"] }}>
          <ThemeProvider defaultLanguage="en" storageKeys={null}><SayrRecordPage doctype="Ticket Bug" name="TKT-00008" /></ThemeProvider>
        </FrappeProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(container.querySelector("[data-record-photo]")?.getAttribute("src")).toBe("/files/omar.png"));
    const plain = mount(PAGE());
    await waitFor(() => expect(within(plain.container.querySelector("[data-record-header]") as HTMLElement).getByText("Omar Ali")).toBeTruthy());
    expect(plain.container.querySelector("[data-record-photo]")).toBeNull();
  });

  it("RP.header.2 the tab bar is the type DocType's own tabs, full width", async () => {
    const { container } = mount(PAGE());
    await waitFor(() => expect(screen.getByRole("tab", { name: "Booking Change Request" })).toBeTruthy());
    expect(screen.getByRole("tab", { name: "Details" })).toBeTruthy();
    expect(container.querySelector("[data-tab-bar='record']")).toBeTruthy();
  });
});

describe("RP.view — view first, then Edit; the header's key line and buttons", () => {
  it("RP.view.1 viewFirst: the fields read, no Save; Edit beside the code; the key line and the app's buttons in the header", async () => {
    const { container } = mount(PAGE(), "en", [], undefined, { viewFirst: true, headerLine: (d) => `Head of Sales · ${String(d.title)}`, headerActions: <button type="button">Meeting</button> });
    await waitFor(() => expect(container.querySelector("[data-record-edit]")).toBeTruthy());
    const header = container.querySelector("[data-record-header]") as HTMLElement;
    await waitFor(() => expect(within(header).getByText("Head of Sales · Login does nothing")).toBeTruthy());
    expect(within(header).getByRole("button", { name: "Meeting" })).toBeTruthy();
    expect(screen.queryByDisplayValue("Login does nothing")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(container.querySelector("[data-record-cancel-edit]")).toBeNull();
  });

  it("RP.view.2 Edit opens the fields with Cancel and Save; Cancel drops the change and goes back to the view", async () => {
    const { container } = mount(PAGE(), "en", [], undefined, { viewFirst: true });
    fireEvent.click(await waitFor(() => {
      const edit = container.querySelector("[data-record-edit]");
      if (!edit) throw new Error("no Edit yet");
      return edit as HTMLElement;
    }));
    const title = await waitFor(() => screen.getByDisplayValue("Login does nothing") as HTMLInputElement);
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(container.querySelector("[data-record-edit]")).toBeNull();
    fireEvent.change(title, { target: { value: "Changed, then cancelled" } });
    fireEvent.click(container.querySelector("[data-record-cancel-edit]") as HTMLElement);
    await waitFor(() => expect(container.querySelector("[data-record-edit]")).toBeTruthy());
    expect(screen.queryByDisplayValue("Changed, then cancelled")).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("RP.view.3 without viewFirst the page stays editable as before", async () => {
    const { container } = mount(PAGE());
    await waitFor(() => expect(screen.getByDisplayValue("Login does nothing")).toBeTruthy());
    expect(container.querySelector("[data-record-edit]")).toBeNull();
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

  it("RP.lifecycle.3 View full lifecycle opens the whole diagram in a dialog, not Sayr Studio", async () => {
    const opened: unknown[] = [];
    const open = window.open;
    window.open = ((...args: unknown[]) => { opened.push(args); return null; }) as typeof window.open;
    try {
      mount(PAGE());
      fireEvent.click(await waitFor(() => screen.getByRole("button", { name: "View full lifecycle" })));
      const dialog = await waitFor(() => screen.getByRole("dialog"));
      expect(within(dialog).getByText(/lifecycle · Support$/)).toBeTruthy();
      expect(dialog.querySelector('[data-state="tst_new"] [data-kind="current"]')).toBeTruthy();
      expect(dialog.querySelector('[data-state="tst_in_progress"] [data-kind="future"]')).toBeTruthy();
      expect(within(dialog).getByText("Start Work")).toBeTruthy();
      expect(within(dialog).getByText("Reopen")).toBeTruthy();
      expect(dialog.querySelectorAll("[data-lifecycle-graph] path[marker-end]").length).toBe(2);
      expect(opened).toEqual([]);
    } finally {
      window.open = open;
    }
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

  it("RP.cards.5 the app's own cards sit after Playbook, get the record, and hide like the others", async () => {
    const contact: RecordRailExtraCard = { id: "contact", label: "Contact", icon: User, render: (doc) => <p>Contact of {String(doc?.name ?? "")}</p> };
    const { container } = mount(PAGE(), "en", [], [contact]);
    await waitFor(() => expect(screen.getByText("Contact of TKT-00008")).toBeTruthy());
    const order = [...container.querySelectorAll("[data-rail-card]")].map((c) => c.getAttribute("data-rail-card"));
    expect(order.slice(0, 6)).toEqual(["lifecycle", "assignment", "sla", "playbook", "contact", "tasks"]);
    fireEvent.click(screen.getByRole("button", { name: "Customize sections" }));
    fireEvent.click(await waitFor(() => document.querySelector("[data-rail-toggle='contact']") as HTMLElement));
    await waitFor(() => expect(container.querySelector("[data-rail-card='contact']")).toBeNull());
  });

  it("RP.cards.6 an app card with a built-in card's id replaces it in its place, with its title and action", async () => {
    const notes: RecordRailExtraCard = {
      id: "notes", label: "Pinned Notes", title: "Pinned Notes (2)", icon: User,
      action: <button type="button">Add note</button>, render: (doc) => <p>Notes of {String(doc?.name ?? "")}</p>,
    };
    const { container } = mount(PAGE(), "en", [], [notes]);
    await waitFor(() => expect(screen.getByText("Notes of TKT-00008")).toBeTruthy());
    const order = [...container.querySelectorAll("[data-rail-card]")].map((c) => c.getAttribute("data-rail-card"));
    expect(order).toEqual(["lifecycle", "assignment", "sla", "playbook", "tasks", "notes", "attachments"]);
    const card = container.querySelector("[data-rail-card='notes']") as HTMLElement;
    expect(card.textContent).toContain("Pinned Notes (2)");
    expect(card.querySelector("button")?.textContent).toBe("Add note");
    fireEvent.click(screen.getByRole("button", { name: "Customize sections" }));
    await waitFor(() => expect(document.querySelectorAll("[data-rail-toggle='notes']").length).toBe(1));
  });

  it("RP.tabs.1 page tabs: About is the form, History the timeline, the app's tab its own panel; the form keeps its place", async () => {
    const activities: RecordPageTab = { id: "activities", label: "Activities", icon: User, render: (d) => <p>Activities of {String(d?.name ?? "")}</p> };
    const { container } = mount(PAGE(), "en", [], undefined, { pageTabs: [activities] });
    await waitFor(() => expect(container.querySelector("[data-page-tabs]")).toBeTruthy());
    expect([...container.querySelectorAll("[data-page-tab]")].map((tab) => tab.getAttribute("data-page-tab"))).toEqual(["about", "history", "activities"]);
    expect(container.querySelector("[data-page-tab-panel]")).toBeNull();
    fireEvent.mouseDown(container.querySelector("[data-page-tab='activities']") as HTMLElement);
    await waitFor(() => expect(screen.getByText("Activities of TKT-00008")).toBeTruthy());
    expect(container.querySelector("[data-record-header]")).toBeTruthy();
    fireEvent.mouseDown(container.querySelector("[data-page-tab='history']") as HTMLElement);
    await waitFor(() => expect(container.querySelector("[data-page-tab-panel] [data-timeline], [data-page-tab-panel] ol, [data-page-tab-panel] ul")).toBeTruthy());
    fireEvent.mouseDown(container.querySelector("[data-page-tab='about']") as HTMLElement);
    await waitFor(() => expect(container.querySelector("[data-page-tab-panel]")).toBeNull());
  });

  it("RP.tabs.3 an unsaved edit stays while another page tab is open, even typed just before the click", async () => {
    const activities: RecordPageTab = { id: "activities", label: "Activities", icon: User, render: () => <p>Activities panel</p> };
    const { container } = mount(PAGE(), "en", [], undefined, { pageTabs: [activities] });
    const title = await waitFor(() => screen.getByDisplayValue("Login does nothing") as HTMLInputElement);
    title.focus();
    fireEvent.change(title, { target: { value: "Edited, not saved" } });
    fireEvent.mouseDown(container.querySelector("[data-page-tab='activities']") as HTMLElement);
    await waitFor(() => expect(screen.getByText("Activities panel")).toBeTruthy());
    fireEvent.mouseDown(container.querySelector("[data-page-tab='about']") as HTMLElement);
    await waitFor(() => expect(screen.getByDisplayValue("Edited, not saved")).toBeTruthy());
  });

  it("RP.tabs.2 the app opens a tab itself (controlled), and with no page tabs there is no tab bar", async () => {
    const activities: RecordPageTab = { id: "activities", label: "Activities", icon: User, render: () => <p>Opened from the rail</p> };
    mount(PAGE(), "en", [], undefined, { pageTabs: [activities], pageTab: "activities" });
    await waitFor(() => expect(screen.getByText("Opened from the rail")).toBeTruthy());
    const plain = mount(PAGE());
    await waitFor(() => expect(plain.container.querySelector("[data-record-header]")).toBeTruthy());
    expect(plain.container.querySelector("[data-page-tabs]")).toBeNull();
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
  lifecycle: { lifecycle: "SEAR-LC-00001", title: "Support", states_count: 2, initial: { state_key: "tst_new", name_en: "New", name_ar: "جديد", phase: "open" },
    states: [{ state_key: "tst_new", name_en: "New", name_ar: "جديد", phase: "open" }, { state_key: "tst_done", name_en: "Done", name_ar: "تم", phase: "closed" }],
    initial_state: "tst_new",
    transitions: [{ transition_key: "tst_new__tst_done_1", from_state: "tst_new", to_state: "tst_done", action_en: "Finish", action_ar: "إنهاء" }] },
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
    fireEvent.click(screen.getByRole("button", { name: "View full lifecycle" }));
    const diagram = await waitFor(() => screen.getByRole("dialog"));
    expect(diagram.querySelectorAll("[data-state] [data-kind='future']").length).toBe(2);
    expect(within(diagram).getByText("Finish")).toBeTruthy();
    fireEvent.keyDown(diagram, { key: "Escape" });
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

