/**
 * Run 1 step 3 — one translation path (B-61, G58): the list layer, the exporter, the workflow menus and the timeline
 * read the provider's translations (Desk `__(text, null, context)`), as the form already did. Rows: B-61, B-38, B-39,
 * B-03 (status words; the Status column shown by default), D-54, D-41, A-51. SIMULATED: the playground's ToDo backend and
 * stub clients — the dictionary stands in for a site's boot `__messages` (real site: pending).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle, ThemeProvider } from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, type FrappeTransport } from "../src/frappe";
import { FrappeWorkflowActions } from "../src/frappe/record";
import { FrappeExportDialog } from "../src/frappe/list/FrappeExportDialog";
import { WORKFLOW_BULK_METHODS } from "../src/frappe/list/workflowBulk";
import { buildTimelineItems, deliveryStatusLabel } from "../src/frappe/record/timeline";
import { defaultMessages } from "../src/theme/messages";
import type { DocInfo, FrappeDoc, MetaBundle } from "../src/frappe/contract";
import { TODO_META, createMockFrappe } from "../playground/src/demo/mock-frappe";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const AR: Record<string, string> = {
  ToDo: "مهمة", Status: "الحالة", Priority: "الأولوية", Open: "مفتوحة", Closed: "مغلقة", High: "عالية", Medium: "متوسطة", Low: "منخفضة",
  Approve: "اعتماد", Reject: "رفض", Pending: "قيد الانتظار", ID: "المعرّف", Description: "الوصف", "Priority:ToDo": "أولوية المهمة",
};
const PERMS = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, import: 1, export: 1 }];
const META = (over: Record<string, unknown> = {}) => ({ ...TODO_META, permissions: PERMS, ...over });
const WORKFLOW = {
  doctype: "Workflow", name: "ToDo Approval", document_type: "ToDo", workflow_state_field: "workflow_state", is_active: 1,
  states: [{ state: "Pending", doc_status: "0", allow_edit: "System Manager" }, { state: "Approved", doc_status: "0", allow_edit: "System Manager" }],
  transitions: [{ state: "Pending", action: "Approve", next_state: "Approved", allowed: "System Manager" }, { state: "Pending", action: "Reject", next_state: "Pending", allowed: "System Manager" }],
};

function mountList(meta: Record<string, unknown>, props: Partial<React.ComponentProps<typeof FrappeListView>> = {}, extra?: (m: string, a: Record<string, unknown>) => unknown, translations: Record<string, string> | undefined = AR) {
  const mock = createMockFrappe();
  const transport: FrappeTransport = async (m, a) => {
    const own = extra?.(m, a);
    if (own !== undefined) return own as never;
    if (m === "frappe.desk.form.load.getdoctype") return { docs: [meta], user_settings: "{}" } as never;
    return mock.transport(m, a);
  };
  const client = createFrappeClient({ transport });
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage="ar" storageKeys={null}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FrappeProvider client={client} session={{ user: "u@x.com", roles: ["System Manager"] }} translations={translations}>
          <FrappeListView doctype="ToDo" storage={null} {...props} />
        </FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
const rows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => tr.querySelectorAll("td").length > 1);
const headers = () => [...document.querySelectorAll("thead th")].map((th) => th.textContent?.trim()).filter(Boolean);

describe("B-61 / B-03 the list reads the provider's translations", () => {
  it("column headers (with the DocType as context), Select values in the cells and the DocType's name in the Add label", async () => {
    mountList(META(), { create: {} });
    await waitFor(() => expect(rows().some((r) => (r.textContent ?? "").trim() !== "")).toBe(true));
    expect(headers()).toContain("أولوية المهمة"); // "Priority:ToDo" wins over "Priority" (translate.js context rule)
    expect(headers()).toContain("الحالة"); // the status field's label (ToDo has no indicator: no states, not submittable)
    const statusCells = rows().map((r) => r.textContent ?? "");
    expect(statusCells.some((x) => x.includes("مفتوحة"))).toBe(true);
    expect(statusCells.some((x) => /\bOpen\b/.test(x))).toBe(false);
    expect(screen.getByTestId("sf-list-add").textContent).toContain("مهمة");
  });

  it("the filter builder's fields and Select values are translated", async () => {
    mountList(META());
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const { buildFrappeListMeta } = await import("../src/frappe/meta");
    const tr = (x: string, c?: string) => (c && AR[`${x}:${c}`]) || AR[x] || x;
    const m = buildFrappeListMeta(META() as never, ((k: string) => defaultMessages.ar[k as keyof typeof defaultMessages.ar]) as never, {}, { translate: tr });
    const status = m.filterFields.find((f) => f.name === "status")!;
    expect(status.label).toBe("الحالة");
    expect(status.options?.map((o) => o.label)).toEqual(expect.arrayContaining(["مفتوحة", "مغلقة"]));
    expect(status.options?.map((o) => o.value)).toEqual(expect.arrayContaining(["Open", "Closed"])); // values stay the stored ones
  });

  it("NEGATIVE: without a dictionary the labels are the DocType's own (no change for English sites)", async () => {
    mountList(META(), { create: {} }, undefined, {});
    await waitFor(() => expect(rows().some((r) => (r.textContent ?? "").trim() !== "")).toBe(true));
    expect(headers()).toContain("Priority");
    expect(screen.getByTestId("sf-list-add").textContent).toContain("ToDo");
  });
});

describe("B-38 workflow actions in bulk are translated (header and bar)", () => {
  it("the bar's Workflow menu lists the actions in the session language; the action sent is the stored one", async () => {
    const approved: Record<string, unknown>[] = [];
    mountList(META({ __workflow_docs: [WORKFLOW] }), { bulk: {}, selectionMode: "bar", selectable: true }, (m, a) => {
      if (m === WORKFLOW_BULK_METHODS.commonActions) return Promise.resolve({ message: ["Approve", "Reject"] });
      if (m === WORKFLOW_BULK_METHODS.approve) { approved.push(a); return Promise.resolve({ message: null }); }
      return undefined;
    });
    const box = await waitFor(() => within(rows()[0]!).getByRole("checkbox"));
    fireEvent.click(box);
    fireEvent.keyDown(await screen.findByTestId("sf-bulk-workflow"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "اعتماد" }));
    await waitFor(() => expect(approved).toHaveLength(1));
    expect(approved[0]!.action).toBe("Approve");
  });
});

describe("B-39 the exporter's DocType, groups and field labels", () => {
  it("Arabic: the DocType heading, the ID and the field labels from the dictionary", async () => {
    const bundle: MetaBundle = { doctype: "ToDo", meta: META() as never, children: {} };
    render(
      <ThemeProvider defaultLanguage="ar" storageKeys={null}>
        <QueryClientProvider client={new QueryClient()}>
          <FrappeProvider client={createFrappeClient({ transport: async () => ({}) })} translations={AR}>
            <FrappeExportDialog api={{ download: vi.fn(), call: vi.fn() } as never} bundle={bundle} open onOpenChange={() => {}} />
          </FrappeProvider>
        </QueryClientProvider>
      </ThemeProvider>,
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("مهمة");
    expect(dialog.textContent).toContain("المعرّف");
    expect(dialog.textContent).toContain("الوصف");
    expect(dialog.textContent).not.toMatch(/\bDescription\b/);
  });
});

describe("D-54 workflow actions and state in the session language by default", () => {
  const wfDocs = [WORKFLOW, { doctype: "Workflow State", name: "Pending" }, { doctype: "Workflow State", name: "Approved", style: "Success" }];
  const doc: FrappeDoc = { doctype: "ToDo", name: "T1", owner: "x@x", workflow_state: "Pending", docstatus: 0, modified: "2026-11-01 10:00:00" };
  it("variant=compact: the Actions menu items and the state badge come from the provider's translations", async () => {
    const c = {
      call: vi.fn(async () => ({ message: [] })), subscribeMessages: () => () => {}, addComment: vi.fn(),
      getMetaBundle: vi.fn(async () => ({ doctype: "ToDo", meta: { ...META(), __workflow_docs: wfDocs }, children: {} })),
      getWorkflowTransitions: vi.fn(async () => [{ state: "Pending", action: "Approve", next_state: "Approved", allowed: "System Manager" }]),
    };
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FrappeProvider client={c as never} session={{ user: "u@x.com", roles: ["System Manager"] }} translations={AR}>
        <ThemeProvider defaultLanguage="ar" storageKeys={null}><FrappeWorkflowActions doc={doc} user="u@x.com" roles={["System Manager"]} variant="compact" checkMandatory={false} /></ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>);
    expect(await screen.findByText("قيد الانتظار")).toBeTruthy();
    const trigger = await screen.findByRole("button", { name: new RegExp(defaultMessages.ar.recActions ?? "Actions") });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "اعتماد" })).toBeTruthy();
  });
});

describe("D-41 communication cards: delivery status in the session language", () => {
  it("the site's word first, then the package catalogue, else the server's word", () => {
    const tAr = (k: string) => (defaultMessages.ar as Record<string, string>)[k] ?? k;
    expect(deliveryStatusLabel("Opened", { t: tAr as never })).toBe("مفتوحة");
    expect(deliveryStatusLabel("Opened", { t: tAr as never, translate: (x) => (x === "Opened" ? "تمت القراءة" : x) })).toBe("تمت القراءة");
    expect(deliveryStatusLabel("Custom Status", { t: tAr as never })).toBe("Custom Status");
    const info = { communications: [{ name: "E1", sender: "b@x", subject: "Hi", content: "<p>x</p>", delivery_status: "Sent", communication_medium: "Phone", communication_date: "2026-11-02 10:00:00" }], comments: [], versions: [] } as unknown as DocInfo;
    const items = buildTimelineItems({ doctype: "Lead", name: "L1" } as FrappeDoc, info, { user: "me@x", t: tAr as never, fieldLabel: () => null });
    expect(items.find((i) => i.id === "communication-E1")?.status?.label).toBe(defaultMessages.ar.commStatusSent);
  });
});

describe("A-51 dialog base", () => {
  function D(props: Partial<React.ComponentProps<typeof DialogContent>> & { lang?: "en" | "ar"; onOpenChange?: (o: boolean) => void; indicator?: boolean }) {
    const { lang = "en", onOpenChange = () => {}, indicator, ...rest } = props;
    return (
      <ThemeProvider defaultLanguage={lang} storageKeys={null}>
        <Dialog open onOpenChange={onOpenChange}><DialogContent {...rest}><DialogTitle indicator={indicator ? { tone: "success", label: "Saved" } : undefined}>Title</DialogTitle><DialogDescription>d</DialogDescription></DialogContent></Dialog>
      </ThemeProvider>
    );
  }
  it("the × is named from the catalogue (إغلاق in Arabic; was the English 'Close' everywhere)", () => {
    render(<D lang="ar" />);
    expect(screen.getByRole("button", { name: "إغلاق" })).toBeTruthy();
  });
  it("dismissible={false}: Escape does not close and there is no ×; the default still closes on Escape", async () => {
    const changes: boolean[] = [];
    const { unmount } = render(<D dismissible={false} onOpenChange={(o) => changes.push(o)} />);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    await act(async () => { fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }); });
    expect(changes).toEqual([]);
    unmount();
    render(<D onOpenChange={(o) => changes.push(o)} />);
    await act(async () => { fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" }); });
    expect(changes).toEqual([false]);
  });
  it("hideClose drops the × only; size sets the width class; the title can carry an indicator with a text alternative", () => {
    render(<D hideClose size="xl" indicator />);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.getByRole("dialog").className).toContain("sm:max-w-4xl");
    expect(screen.getByRole("dialog").getAttribute("data-size")).toBe("xl");
    expect(screen.getByRole("heading", { name: /Saved\s*Title/ })).toBeTruthy();
  });
  it("NEGATIVE: the default dialog keeps its 0.4 markup (max-w-lg, ×, no data-size)", () => {
    render(<D />);
    expect(screen.getByRole("dialog").className).toContain("max-w-lg");
    expect(screen.getByRole("dialog").hasAttribute("data-size")).toBe(false);
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });
});

describe("B-03 the Status (indicator) column: shown by default, words translated", () => {
  const STATES = [{ title: "Open", color: "Orange" }, { title: "Closed", color: "Green" }, { title: "Cancelled", color: "Red" }];
  it("a DocType with states: the indicator column is shown without rowMeta, its words translated, the status field column hidden", async () => {
    mountList(META({ states: STATES }));
    await waitFor(() => expect(rows().some((r) => (r.textContent ?? "").trim() !== "")).toBe(true));
    expect(headers()).toContain(defaultMessages.ar.listIndicator);
    const cells = rows().map((r) => r.textContent ?? "");
    expect(cells.some((x) => x.includes("مفتوحة"))).toBe(true);
    expect(headers().filter((h) => h === "الحالة" || h === defaultMessages.ar.listIndicator)).toHaveLength(1); // one Status column
    expect(document.querySelectorAll("tbody [data-indicator]").length).toBeGreaterThan(0); // and it is the indicator's pill
  });
  it("NEGATIVE: rowMeta={false} → no indicator column; rowMeta={{ indicator: false }} too", async () => {
    mountList(META({ states: STATES }), { rowMeta: false });
    await waitFor(() => expect(rows().some((r) => (r.textContent ?? "").trim() !== "")).toBe(true));
    expect(document.querySelectorAll("tbody [data-indicator]").length).toBe(0);
  });
});
