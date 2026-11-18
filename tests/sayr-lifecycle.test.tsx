/**
 * Sayr's full lifecycle on the core model (SIMULATED Sayr, fixture transport): the internal adapter (Sayr's lifecycle →
 * `LifecycleDefinition` → `LifecycleGraph` with the record's path), `LifecycleGraphDialog` on it, and "View full
 * lifecycle" on SayrRecordPage / SayrNewRecordPage — the dialog in place by default, the deprecated `lifecycleHref`
 * (0.9.0) still opening its link with one development warning.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocPerm, DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import type { FamilyDescriptor } from "../src/frappe";
import {
  LifecycleGraphDialog, RECORD_PAGE_METHOD, SayrNewRecordPage, SayrRecordPage, TYPE_PREVIEW_METHOD,
  type LifecycleGraphData, type RecordPageData, type TypePreviewData,
} from "../src/sayr";
import * as sayrEntry from "../src/sayr";
import { sayrLifecycleDefinition, sayrLifecycleGraph, sayrPhase } from "../src/sayr/lifecycleModel";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => { cleanup(); window.localStorage.clear(); vi.restoreAllMocks(); });

const LC: LifecycleGraphData = {
  states: [
    { state_key: "s_new", name_en: "New", name_ar: "جديد", phase: "open" },
    { state_key: "s_work", name_en: "In Progress", name_ar: "قيد المعالجة", phase: "Open" },
    { state_key: "s_wait", name_en: "Waiting", name_ar: null, phase: "on_hold" },
    { state_key: "s_done", name_en: "Done", name_ar: "منتهية", phase: "closed" },
  ],
  initial_state: "s_new",
  transitions: [
    { transition_key: "k1", from_state: "s_new", to_state: "s_work", action_en: "Start", action_ar: "ابدأ" },
    { transition_key: "k2", from_state: "s_work", to_state: "s_wait", action_en: "Wait", action_ar: null },
    { transition_key: "", from_state: "s_wait", to_state: "s_work", action_en: "Resume", action_ar: "استئناف" },
    { transition_key: "k1", from_state: "s_work", to_state: "s_done", action_en: "Finish", action_ar: "إنهاء" },
  ],
};

describe("SL.adapter — Sayr's lifecycle → the core model", () => {
  it("SL.adapter.1 states and transitions, labels in the current language (English when Sayr has no Arabic), unique ids", () => {
    const en = sayrLifecycleDefinition(LC, false);
    expect(en.states.map((s) => [s.id, s.label, s.phase])).toEqual([["s_new", "New", "open"], ["s_work", "In Progress", "open"], ["s_wait", "Waiting", "on_hold"], ["s_done", "Done", "closed"]]);
    expect(en.transitions.map((t) => [t.id, t.from, t.to, t.label])).toEqual([
      ["k1", "s_new", "s_work", "Start"], ["k2", "s_work", "s_wait", "Wait"], ["s_wait-s_work", "s_wait", "s_work", "Resume"], ["k1#1", "s_work", "s_done", "Finish"],
    ]);
    const ar = sayrLifecycleDefinition(LC, true);
    expect(ar.states.map((s) => s.label)).toEqual(["جديد", "قيد المعالجة", "Waiting", "منتهية"]);
    expect(ar.transitions.map((t) => t.label)).toEqual(["ابدأ", "Wait", "استئناف", "إنهاء"]);
  });

  it("SL.adapter.2 phases map one to one (case and spaces ignored), anything else is open", () => {
    expect(["open", "on_hold", "closed", "On Hold", "CLOSED", "", null, undefined, "archived"].map(sayrPhase))
      .toEqual(["open", "on_hold", "closed", "on_hold", "closed", "open", "open", "open", "open"]);
  });

  it("SL.adapter.3 with the record's path: current, done with who · when, the taken transitions; no path: nothing guessed", () => {
    const g = sayrLifecycleGraph(LC, { arabic: false, status: "s_work", path: [{ id: "s_new", meta: "Omar · Apr 1", metaTitle: "Omar Ali · 1 Apr" }, { id: "s_work", meta: "Sara · Apr 2" }] });
    expect(g.nodes.map((n) => [n.id, n.kind, n.meta])).toEqual([["s_new", "done", "Omar · Apr 1"], ["s_work", "current", "Sara · Apr 2"], ["s_wait", "future", undefined], ["s_done", "future", undefined]]);
    expect(g.nodes[0]!.metaTitle).toBe("Omar Ali · 1 Apr");
    expect(g.edges.filter((e) => e.taken).map((e) => e.id)).toEqual(["k1"]);
    const bare = sayrLifecycleGraph(LC, { arabic: false, status: "s_done" });
    expect(bare.nodes.map((n) => n.kind)).toEqual(["future", "future", "future", "current"]);
    expect(bare.edges.some((e) => e.taken)).toBe(false);
  });

  it("SL.adapter.4 an older Sayr (no transitions) and a type preview without states do not throw", () => {
    expect(sayrLifecycleGraph({ states: LC.states }, { arabic: false, status: "s_new" }).edges).toEqual([]);
    expect(sayrLifecycleGraph({}, { arabic: true })).toEqual({ nodes: [], edges: [] });
  });

  it("SL.adapter.5 the adapter is internal: not on the ./sayr entry", () => {
    expect(Object.keys(sayrEntry)).not.toContain("sayrLifecycleGraph");
    expect(Object.keys(sayrEntry)).not.toContain("sayrLifecycleDefinition");
    expect(Object.keys(sayrEntry)).toContain("defaultLifecycleHref");
  });
});

describe("SL.dialog — LifecycleGraphDialog", () => {
  const dialog = (lifecycle: LifecycleGraphData, language: "en" | "ar" = "en") => render(
    <ThemeProvider defaultLanguage={language} storageKeys={null}>
      <LifecycleGraphDialog open onOpenChange={() => {}} title="Lifecycle" lifecycle={lifecycle} status="s_work"
        path={[{ id: "s_new", meta: "Omar · Apr 1" }, { id: "s_work" }]} />
    </ThemeProvider>,
  );

  it("SL.dialog.1 core's dialog around LifecycleGraphView: kinds, path, labels and the transitions list", async () => {
    dialog(LC);
    const d = await waitFor(() => screen.getByRole("dialog"));
    const kind = (id: string) => d.querySelector(`[data-state="${id}"] [data-kind]`)!.getAttribute("data-kind");
    expect([kind("s_new"), kind("s_work"), kind("s_wait"), kind("s_done")]).toEqual(["done", "current", "future", "future"]);
    expect(d.querySelector('[data-state="s_new"]')!.textContent).toContain("Open · Omar · Apr 1");
    expect(within(d).getByText("Finish")).toBeTruthy();
    expect(within(d).getByRole("list", { name: "Transitions" }).children.length).toBe(4);
    expect(d.querySelectorAll("path[data-taken]").length).toBe(1);
  });

  it("SL.dialog.2 Arabic: right-to-left dialog and diagram, Arabic labels", async () => {
    dialog(LC, "ar");
    const d = await waitFor(() => screen.getByRole("dialog"));
    expect(d.getAttribute("dir")).toBe("rtl");
    expect(d.querySelector("[data-lifecycle-graph]")!.getAttribute("dir")).toBe("rtl");
    expect(within(d).getByText("استئناف")).toBeTruthy();
  });

  it("SL.dialog.3 an older Sayr without transitions: every state still shows", async () => {
    dialog({ states: LC.states, initial_state: "s_new" });
    const d = await waitFor(() => screen.getByRole("dialog"));
    expect(d.querySelectorAll("[data-state]").length).toBe(4);
    expect(d.querySelectorAll("path[marker-end]").length).toBe(0);
  });
});

// ── the pages ────────────────────────────────────────────────────────────────────────────────────────────────────────
const T = "2026-11-10 09:00:00.000000";
const ALL: DocPerm[] = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }];
const BUG: DocTypeMeta = {
  name: "Ticket Bug", autoname: "hash", title_field: "title", permissions: ALL,
  fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }, { fieldname: "workflow_state", fieldtype: "Data", label: "State", hidden: 1 }],
};
const doc = { doctype: "Ticket Bug", name: "TKT-1", owner: "omar@x.test", creation: T, modified: T, modified_by: "Administrator", docstatus: 0, title: "Login", workflow_state: "In Progress" } as FrappeDoc;
const PAGE: RecordPageData = {
  header: { owner: "omar@x.test", owner_name: "Omar Ali", creation: T, modified_by: "Administrator", modified_by_name: "Administrator", modified: T },
  lifecycle_deployed: true,
  lifecycle: {
    lifecycle: "SEAR-LC-1", title: "Support", status: "s_work", phase: "open", status_label_en: "In Progress", status_label_ar: null, playbook: null,
    states: LC.states.map((s) => ({ ...s, color: null, is_current: s.state_key === "s_work" })),
    actions: [{ transition_key: "k2", action_en: "Wait", action_ar: null, to_state: "s_wait", to_phase: "on_hold" }],
    initial_state: "s_new", transitions: LC.transitions,
  },
  sla: { deployed: false }, assignment: { todo_description: null }, tasks: [],
};
const session = { user: "Administrator", fullName: "Administrator", roles: ["System Manager"] };

function mountRecord(lifecycleHref?: (lc: string) => string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const t = createFixtureTransport({ meta: { "Ticket Bug": [BUG] }, docs: { "Ticket Bug": [doc] } }, { handlers: { [RECORD_PAGE_METHOD]: () => ({ message: PAGE }) } });
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={createFrappeClient({ transport: t })} queryClient={qc} session={session}>
        <ThemeProvider defaultLanguage="en" storageKeys={null}>
          <SayrRecordPage doctype="Ticket Bug" name="TKT-1" lifecycleHref={lifecycleHref} />
        </ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
}

const REGISTRY: DocTypeMeta = {
  name: "Ticket Type", autoname: "field:type_name", title_field: "type_name", permissions: ALL,
  fields: [{ fieldname: "type_name", fieldtype: "Data", label: "Name" }, { fieldname: "type_doctype", fieldtype: "Link", label: "Records DocType", options: "DocType" }, { fieldname: "enabled", fieldtype: "Check", label: "Enabled" }],
};
const FAMILY: FamilyDescriptor = { parent: "Ticket", registry: "Ticket Type", labelField: "type_name" };
const preview = (withStates: boolean): TypePreviewData => ({
  lifecycle: { lifecycle: "SEAR-LC-1", title: "Support", states_count: 4, initial: LC.states[0]!, ...(withStates ? { states: LC.states, initial_state: "s_new", transitions: LC.transitions } : {}) },
  sla: { deployed: false }, assignment: [],
});

function mountNew(lifecycleHref?: (lc: string) => string, withStates = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const t = createFixtureTransport(
    { meta: { "Ticket Type": [REGISTRY], "Ticket Bug": [BUG] },
      docs: { "Ticket Type": [{ doctype: "Ticket Type", name: "Bug", type_name: "Bug", type_doctype: "Ticket Bug", enabled: 1, owner: "Administrator", creation: T, modified: T, docstatus: 0 } as FrappeDoc] } },
    { handlers: { [TYPE_PREVIEW_METHOD]: () => ({ message: preview(withStates) }) } },
  );
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={createFrappeClient({ transport: t })} queryClient={qc} session={session}>
        <ThemeProvider storageKeys={null}>
          <SayrNewRecordPage family={FAMILY} defaultType="Bug" onCreated={() => {}} onCancel={() => {}} lifecycleHref={lifecycleHref}
            labels={{ title: { en: "New Ticket", ar: "تذكرة جديدة" } }} />
        </ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
}

const viewAll = () => waitFor(() => screen.getByRole("button", { name: "View full lifecycle" }));

describe("SL.pages — View full lifecycle", () => {
  it("SL.pages.1 SayrRecordPage without lifecycleHref: the diagram opens in place with the record's path; no new tab, no warning", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mountRecord();
    fireEvent.click(await viewAll());
    const d = await waitFor(() => screen.getByRole("dialog"));
    expect(d.querySelector('[data-state="s_work"] [data-kind="current"]')).toBeTruthy();
    expect(within(d).getByRole("list", { name: "Transitions" })).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("lifecycleHref"))).toEqual([]);
  });

  it("SL.pages.2 SayrRecordPage with the deprecated lifecycleHref: 0.9.0's new tab, one warning however often it is used", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mountRecord((lc) => `/studio/${lc}`);
    fireEvent.click(await viewAll());
    fireEvent.click(await viewAll());
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith("/studio/SEAR-LC-1", "_blank", "noopener");
    expect(screen.queryByRole("dialog")).toBeNull();
    const ours = warn.mock.calls.filter((c) => String(c[0]).includes("lifecycleHref"));
    expect(ours.length).toBe(1);
    expect(String(ours[0]![0])).toMatch(/SayrRecordPage.*deprecated since 0\.10\.0.*0\.11\.0/);
  });

  it("SL.pages.3 SayrNewRecordPage without lifecycleHref: the type's diagram in place, nothing reached; no new tab", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    mountNew();
    fireEvent.click(await viewAll());
    const d = await waitFor(() => screen.getByRole("dialog"));
    expect(d.querySelectorAll("[data-state] [data-kind='future']").length).toBe(4);
    expect(open).not.toHaveBeenCalled();
  });

  it("SL.pages.4 SayrNewRecordPage with the deprecated lifecycleHref: the new tab (even when the preview sends no states), one warning", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mountNew((lc) => `/studio/${lc}`, false);
    fireEvent.click(await viewAll());
    fireEvent.click(await viewAll());
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenCalledWith("/studio/SEAR-LC-1", "_blank", "noopener");
    expect(screen.queryByRole("dialog")).toBeNull();
    const ours = warn.mock.calls.filter((c) => String(c[0]).includes("lifecycleHref"));
    expect(ours.length).toBe(1);
    expect(String(ours[0]![0])).toContain("SayrNewRecordPage");
  });

  it("SL.pages.5 SayrNewRecordPage: no states in the preview and no lifecycleHref → no View full lifecycle button", async () => {
    mountNew(undefined, false);
    await waitFor(() => expect(screen.getByText(/Starts in/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "View full lifecycle" })).toBeNull();
  });
});
