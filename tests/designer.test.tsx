/**
 * Families — FieldDesigner (Core, a type's Form section, placement only), its layout model (fieldLayout), and the Sayr
 * adapter (`@solvfast/ui/sayr`). The adapter is driven over a recording stand-in for the Frappe client that answers
 * as Sayr's Field Library does (sear_product apis/field_library/deployments.py) — SIMULATED, never a real site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import * as core from "../src";
import { FieldDesigner, type DesignerItem, type DesignerState, type FieldDesignerAdapter } from "../src/record";
import {
  appendTab, fromLayout, insertItem, insertSectionAfter, removeSection, removeTab, stepItem, toLayout,
} from "../src/record/fieldLayout";
import { createSayrFieldDesignerAdapter, sayrToken, type SayrApi } from "../src/sayr";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const f = (id: string, extra: Partial<DesignerItem> = {}): DesignerItem => ({ id, kind: "field", label: id, ...extra });
const brk = (id: string, kind: DesignerItem["kind"], extra: Partial<DesignerItem> = {}): DesignerItem => ({ id, kind, label: id, ...extra });
const ids = (items: DesignerItem[]) => items.map((i) => i.id);

describe("FD.layout — the form as tabs → sections → columns (pure)", () => {
  it("FD.layout.1 flat order ↔ layout, with an implicit first tab, section and column", () => {
    const items = [f("a"), brk("c1", "column_break"), f("b"), brk("s1", "section_break"), f("c")];
    const tabs = toLayout(items);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].sections).toHaveLength(2);
    expect(tabs[0].sections[0].columns.map((c) => c.fields.map((x) => x.id))).toEqual([["a"], ["b"]]);
    expect(ids(fromLayout(tabs))).toEqual(ids(items));
  });

  it("FD.layout.2 a step moves past the neighbour, then into the next column; never out of the tab", () => {
    const items = [f("a"), f("b"), brk("c1", "column_break"), f("c"), brk("t2", "tab_break"), f("d")];
    expect(ids(stepItem(items, "a", 1))).toEqual(["b", "a", "c1", "c", "t2", "d"]);
    expect(ids(stepItem(items, "b", 1))).toEqual(["a", "c1", "b", "c", "t2", "d"]);
    expect(ids(stepItem(items, "c", -1))).toEqual(["a", "b", "c", "c1", "t2", "d"]);
    expect(ids(stepItem(items, "c", 1))).toEqual(ids(items));
    expect(ids(stepItem(items, "a", -1))).toEqual(ids(items));
  });

  it("FD.layout.3 a section after another, a tab at the end; removing them keeps what they held", () => {
    let items = [f("a"), brk("s1", "section_break"), f("b")];
    items = insertSectionAfter(items, { tab: 0, section: 0 }, brk("new", "section_break"));
    items = insertItem(items, f("x"), { tab: 0, section: 1, column: 0 });
    expect(ids(items)).toEqual(["a", "new", "x", "s1", "b"]);
    expect(ids(removeSection(items, { tab: 0, section: 1 }))).toEqual(["a", "x", "s1", "b"]);
    items = appendTab(items, brk("t", "tab_break"));
    items = insertItem(items, f("y"), { tab: 1, section: 0, column: 0 });
    expect(ids(items)).toEqual(["a", "new", "x", "s1", "b", "t", "y"]);
    expect(ids(removeTab(items, 1))).toEqual(["a", "new", "x", "s1", "b", "y"]);
  });
});

// ── FieldDesigner over an in-memory adapter ──────────────────────────────────────────────────────────────────────

const LOADED: DesignerItem[] = [
  f("title", { label: "Title", native: true, movable: true, fieldtype: "Data" }),
  f("sear_state", { label: "Status", native: true, fieldtype: "Data" }),
  brk("refund_section", "section_break", { label: "Refund Set", source: "Refund Set" }),
  f("custom_amount", { label: "Amount", fieldtype: "Currency", source: "Refund Set" }),
  f("custom_note", { label: "Note", fieldtype: "Small Text", source: "Refund Set" }),
];

function memoryAdapter(initial: DesignerState = { items: LOADED }) {
  let current = initial;
  const adapter: FieldDesignerAdapter & { save: ReturnType<typeof vi.fn> } = {
    load: vi.fn(async () => current),
    listFieldSets: vi.fn(async () => [{ name: "SET-2", label: { en: "Contact Set", ar: "بيانات الاتصال" } }]),
    fieldsOf: vi.fn(async () => [{ id: "@SET-2::phone", label: { en: "Phone", ar: "الهاتف" }, kind: "field" as const, fieldtype: "phone" }]),
    sectionOf: (set: string, label: string) => ({ id: `@${set}::__section`, kind: "section_break", label, source: label }),
    makeTab: (label: string) => ({ id: `@tab::${label}`, kind: "tab_break", label }),
    removalImpact: vi.fn(async (gone: string[]) => gone.map((id) => ({ id, label: id === "custom_amount" ? "Amount" : id, rowsWithData: id === "custom_amount" ? 3 : 0 }))),
    save: vi.fn(async (items: DesignerItem[]) => { current = { items }; return current; }),
  };
  return adapter;
}
function mount(adapter: FieldDesignerAdapter, language: "en" | "ar" = "en") {
  return render(<ThemeProvider defaultLanguage={language} storageKeys={null}><FieldDesigner adapter={adapter} /></ThemeProvider>);
}
const card = (label: string) => screen.getByText(label).closest("[data-field]") as HTMLElement;

describe("FD.ui — FieldDesigner (in-memory adapter)", () => {
  it("FD.ui.1 is the core entry's export; a locked field stays put, a shared one moves, an added one moves and goes", async () => {
    expect(core.FieldDesigner).toBe(FieldDesigner);
    mount(memoryAdapter());
    await screen.findByText("Amount");
    expect(within(card("Status")).queryByRole("button")).toBeNull();
    expect(within(card("Title")).getByRole("button", { name: "Move down: Title" })).toBeTruthy();
    expect(within(card("Title")).queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(within(card("Amount")).getByRole("button", { name: "Remove: Amount" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save form" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("FD.ui.2 a move is saved as the new order", async () => {
    const adapter = memoryAdapter();
    mount(adapter);
    fireEvent.click(await screen.findByRole("button", { name: "Move down: Title" }));
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());
    expect(ids(adapter.save.mock.calls[0][0])).toEqual(["sear_state", "title", "refund_section", "custom_amount", "custom_note"]);
    expect(await screen.findByText("Form saved")).toBeTruthy();
  });

  it("FD.ui.3 fields of a field set are added as a new section under the one asked for", async () => {
    const adapter = memoryAdapter();
    mount(adapter);
    await screen.findByText("Amount");
    fireEvent.click(screen.getAllByRole("button", { name: "Add fields here" })[1]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(within(dialog).getByRole("combobox"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Contact Set" }));
    expect(await within(dialog).findByLabelText("Phone")).toBeTruthy();
    expect((within(dialog).getByRole("checkbox", { name: "Add them as a new section" }) as HTMLElement).getAttribute("data-state")).toBe("checked");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Phone")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());
    expect(ids(adapter.save.mock.calls[0][0]).slice(-2)).toEqual(["@SET-2::__section", "@SET-2::phone"]);
  });

  it("FD.ui.4 removing a field that holds values asks first, naming how many records", async () => {
    const adapter = memoryAdapter();
    mount(adapter);
    fireEvent.click(await screen.findByRole("button", { name: "Remove: Amount" }));
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    const alert = await screen.findByRole("alertdialog");
    expect(within(alert).getByText("Amount: 3 records")).toBeTruthy();
    expect(adapter.save).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "Save anyway" }));
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());
    expect(ids(adapter.save.mock.calls[0][0])).not.toContain("custom_amount");
  });

  it("FD.ui.5 removing every added field asks before withdrawing", async () => {
    const adapter = memoryAdapter();
    mount(adapter);
    fireEvent.click(await screen.findByRole("button", { name: "Remove: Amount" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove: Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    const alert = await screen.findByRole("alertdialog");
    expect(within(alert).getByText("Remove every added field?")).toBeTruthy();
  });

  it("FD.ui.6 a refusal replaces the tools; Arabic", async () => {
    mount(memoryAdapter({ items: [], refusal: "لا يمكن" }), "ar");
    expect(await screen.findByText("النموذج")).toBeTruthy();
    expect(screen.getByText("لا يمكن")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

// ── the Sayr adapter over a recording client ─────────────────────────────────────────────────────────────────────

const SCREEN = {
  refusal: null,
  family: { role: "child", shared: ["title"] },
  deployment: {
    name: "SRF Ticket Refund Request", status: "deployed",
    fields: [
      { field_preset: "SET-1", field_key: "__section", row_kind: "section", label: null, insert_after: "sear_state", fieldname: "sear_set_1__section" },
      { field_preset: "SET-1", field_key: "amount", row_kind: "field", label: null, insert_after: "sear_set_1__section", fieldname: "custom_field_set_amount" },
    ],
  },
  target_fields: [
    { fieldname: "title", label: "Title", fieldtype: "Data" },
    { fieldname: "sear_state", label: "Status", fieldtype: "Data" },
    { fieldname: "sear_set_1__section", label: "sear_set_1__section", fieldtype: "Section Break" },
    { fieldname: "custom_field_set_amount", label: "Amount", fieldtype: "Currency" },
  ],
};

function recordingApi(over: Partial<Record<string, (args: Record<string, unknown>) => unknown>> = {}) {
  const calls: { method: string; args: Record<string, unknown> }[] = [];
  const answers: Record<string, (args: Record<string, unknown>) => unknown> = {
    "sear_product.apis.field_library.deployments.doctype_deployment": () => SCREEN,
    "frappe.client.get": (a) => a.doctype === "Sear Field Preset"
      ? { name: a.name, fields: [{ field_key: "amount", field_type: "currency", label_en: "Amount" }, { field_key: "brk", field_type: "section_break" }, { field_key: "iban", field_type: "text", label_en: "IBAN", label_ar: "آيبان" }] }
      : { doctype: "Sear Field Deployment", name: a.name, target_doctype: "SRF Ticket Refund Request", modified: "2026-11-10 09:00:00", fields: SCREEN.deployment.fields },
    "frappe.client.save": () => ({}),
    "sear_product.apis.field_library.deployments.save_field_order": () => [],
    "sear_product.apis.field_library.deployments.deployment_removal_impact": () => ({ fields: [{ field_key: "amount", fieldname: "custom_field_set_amount", rows_with_data: 4 }] }),
    ...over,
  };
  const api: SayrApi = {
    call: vi.fn(async (method: string, args: Record<string, unknown>) => {
      calls.push({ method, args });
      const answer = answers[method];
      if (!answer) throw new Error(`unexpected ${method}`);
      return { message: answer(args) };
    }) as SayrApi["call"],
    getList: vi.fn(async (doctype: string) => (doctype === "Sear Field Preset" ? [{ name: "SET-1", preset_name: "Refund Set", preset_name_ar: "الاسترداد" }] : [])) as SayrApi["getList"],
  };
  return { api, calls };
}

describe("FD.sayr — createSayrFieldDesignerAdapter (SIMULATED)", () => {
  it("FD.sayr.1 the type's form in order: shared fields movable, standard ones locked, a set's fields its own", async () => {
    const { api } = recordingApi();
    const state = await createSayrFieldDesignerAdapter(api, "SRF Ticket Refund Request").load();
    expect(state.items).toEqual([
      { id: "title", kind: "field", label: "Title", fieldtype: "Data", native: true, movable: true },
      { id: "sear_state", kind: "field", label: "Status", fieldtype: "Data", native: true, movable: false },
      { id: "sear_set_1__section", kind: "section_break", label: "Refund Set", fieldtype: undefined, source: "Refund Set" },
      { id: "custom_field_set_amount", kind: "field", label: "Amount", fieldtype: "Currency", source: "Refund Set" },
    ]);
  });

  it("FD.sayr.2 a set's addable fields leave out breaks and what is already deployed; Arabic names kept", async () => {
    const { api } = recordingApi();
    const adapter = createSayrFieldDesignerAdapter(api, "SRF Ticket Refund Request");
    await adapter.load();
    expect(await adapter.fieldsOf("SET-1")).toEqual([{ id: "@SET-1::iban", kind: "field", label: { en: "IBAN", ar: "آيبان" }, fieldtype: "text" }]);
  });

  it("FD.sayr.3 save writes the rows anchored on what precedes them, then the type's whole order", async () => {
    const { api, calls } = recordingApi();
    const adapter = createSayrFieldDesignerAdapter(api, "SRF Ticket Refund Request");
    const { items } = await adapter.load();
    const next = [...items, { id: "@SET-1::iban", kind: "field" as const, label: "IBAN" }];
    await adapter.save(next);
    const saved = JSON.parse(calls.find((c) => c.method === "frappe.client.save")!.args.doc as string);
    expect(saved.fields.map((r: { row_kind: string; field_key: string; insert_after: string }) => [r.row_kind, r.field_key, r.insert_after])).toEqual([
      ["section", "__section", "sear_state"],
      ["field", "amount", "sear_set_1__section"],
      ["field", "iban", "custom_field_set_amount"],
    ]);
    const order = calls.find((c) => c.method.endsWith("save_field_order"))!;
    expect(JSON.parse(order.args.order as string)).toEqual(["title", "sear_state", "sear_set_1__section", "custom_field_set_amount", "@SET-1::iban"]);
    expect(calls.findIndex((c) => c.method === "frappe.client.save")).toBeLessThan(calls.findIndex((c) => c.method.endsWith("save_field_order")));
  });

  it("FD.sayr.4 rows whose places did not change are not redeployed (no DDL); a move that re-anchors a row is", async () => {
    const { api, calls } = recordingApi();
    const adapter = createSayrFieldDesignerAdapter(api, "SRF Ticket Refund Request");
    const { items } = await adapter.load();
    await adapter.save(items);
    expect(calls.some((c) => c.method === "frappe.client.save" || c.method === "frappe.client.insert")).toBe(false);
    expect(calls.some((c) => c.method.endsWith("save_field_order"))).toBe(true);
    calls.length = 0;
    await adapter.save(stepItem(items, "title", 1));
    const saved = JSON.parse(calls.find((c) => c.method === "frappe.client.save")!.args.doc as string);
    expect(saved.fields[0]).toMatchObject({ row_kind: "section", insert_after: "title" });
    expect(JSON.parse(calls.find((c) => c.method.endsWith("save_field_order"))!.args.order as string).slice(0, 2)).toEqual(["sear_state", "title"]);
  });

  it("FD.sayr.5 no right → a refusal, not an error; a removal says how many records hold values", async () => {
    const denied = recordingApi({ "sear_product.apis.field_library.deployments.doctype_deployment": () => { throw Object.assign(new Error("Not permitted"), { status: 403 }); } });
    expect((await createSayrFieldDesignerAdapter(denied.api, "X", { language: "ar" }).load()).refusal).toMatch(/مسؤول منصة سير/);
    const { api } = recordingApi();
    const adapter = createSayrFieldDesignerAdapter(api, "SRF Ticket Refund Request");
    await adapter.load();
    expect(await adapter.removalImpact!(["custom_field_set_amount"])).toEqual([{ id: "custom_field_set_amount", label: "Amount", rowsWithData: 4 }]);
  });

  it("FD.sayr.6 tokens are Sayr's: a tab by its label, a set's section, a set's field; the core entry has no Sayr code", () => {
    expect(sayrToken({ row_kind: "tab", label: " Details ", field_preset: "", field_key: "" })).toBe("@tab::Details");
    expect(sayrToken({ row_kind: "section", field_preset: "SET-1", field_key: "", label: null })).toBe("@SET-1::__section");
    expect(sayrToken({ row_kind: "field", field_preset: "SET-1", field_key: "iban", label: null })).toBe("@SET-1::iban");
    expect("createSayrFieldDesignerAdapter" in core).toBe(false);
  });
});

void act;
