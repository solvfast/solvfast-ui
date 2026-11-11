/**
 * Families — FieldDesigner (Core, a type's Form section, placement only), its layout model (fieldLayout), and the Sayr
 * adapter (`@solvfast/ui/sayr`). The adapter is driven over a recording stand-in for the Frappe client that answers
 * as Sayr's Field Library does (sear_product apis/field_library/deployments.py) — SIMULATED, never a real site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import * as core from "../src";
import * as React from "react";
import { FieldDesigner, type DesignerItem, type DesignerPending, type DesignerState, type FieldDesignerAdapter } from "../src/record";
import { INSPECTED_PROPERTIES, ownKeys, type FieldTypeRegistry } from "../src/record/fieldDefinition";
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

const REGISTRY: FieldTypeRegistry = {
  types: [
    { key: "text", label: { en: "Data", ar: "البيانات" }, group: "Text", props: ["max_length", "default", "placeholder", "unique", "autofill", "data_subtype"] },
    { key: "dropdown", label: { en: "Select", ar: "اختر" }, group: "Choice", props: ["choices", "default", "autofill"] },
    { key: "number", label: { en: "Int", ar: "رقم" }, group: "Numbers", props: ["bounds", "non_negative", "default", "placeholder", "unique", "autofill"] },
    { key: "record_link", label: { en: "Link", ar: "رابط" }, group: "Relational", props: ["doctype_target", "default", "placeholder", "unique", "autofill"] },
  ],
  groups: [{ group: "Text", types: ["text"] }, { group: "Choice", types: ["dropdown"] }, { group: "Numbers", types: ["number"] }, { group: "Relational", types: ["record_link"] }],
  dataSubtypes: ["Email", "Phone"],
};

function memoryAdapter(initial: DesignerState = { items: LOADED }) {
  let current = initial;
  const adapter: FieldDesignerAdapter & { save: ReturnType<typeof vi.fn> } = {
    load: vi.fn(async () => current),
    listFieldSets: vi.fn(async () => [{ name: "SET-2", label: { en: "Contact Set", ar: "بيانات الاتصال" }, fieldCount: 1 }]),
    fieldsOf: vi.fn(async () => [{ id: "@SET-2::phone", label: { en: "Phone", ar: "الهاتف" }, kind: "field" as const, fieldtype: "phone" }]),
    sectionOf: (set: string, label: string) => ({ id: `@${set}::__section`, kind: "section_break", label, source: label }),
    makeTab: (label: string) => ({ id: `@tab::${label}`, kind: "tab_break", label, own: true }),
    makeSection: (label: string) => ({ id: `@section::${label}`, kind: "section_break", label, own: true }),
    fieldTypes: vi.fn(async () => REGISTRY),
    removalImpact: vi.fn(async (gone: string[]) => gone.map((id) => ({ id, label: id === "custom_amount" ? "Amount" : id, rowsWithData: id === "custom_amount" ? 3 : 0 }))),
    save: vi.fn(async (items: DesignerItem[]) => { current = { items }; return current; }),
  };
  return adapter;
}
function mount(adapter: FieldDesignerAdapter, language: "en" | "ar" = "en", extra: Partial<React.ComponentProps<typeof FieldDesigner>> = {}) {
  return render(<ThemeProvider defaultLanguage={language} storageKeys={null}><FieldDesigner adapter={adapter} {...extra} /></ThemeProvider>);
}
const card = (label: string) => screen.getByText(label).closest("[data-field]") as HTMLElement;
const panel = () => screen.getByRole("complementary", { name: "Properties" });
const select = (label: string) => fireEvent.click(screen.getByRole("button", { name: `Edit field: ${label}` }));

describe("FD.ui — FieldDesigner (in-memory adapter)", () => {
  it("FD.ui.1 is the core entry's export; a locked field stays put, a shared one moves, a set's field moves; the panel says which", async () => {
    expect(core.FieldDesigner).toBe(FieldDesigner);
    mount(memoryAdapter());
    await screen.findByText("Amount");
    expect(within(card("Status")).queryByRole("button", { name: /Move|Reorder/ })).toBeNull();
    expect(within(card("Title")).getByRole("button", { name: "Move down: Title" })).toBeTruthy();
    expect(within(card("Amount")).getByRole("button", { name: "Reorder field: Amount" })).toBeTruthy();
    expect(within(panel()).getByText("Select an element to edit its properties.")).toBeTruthy();
    select("Status");
    expect(within(panel()).getByText(/Standard field/)).toBeTruthy();
    expect(within(panel()).queryByRole("button", { name: /Remove/ })).toBeNull();
    select("Title");
    expect(within(panel()).getByText(/Shared with every type/)).toBeTruthy();
    select("Amount");
    expect(within(panel()).getByText(/Field Library/)).toBeTruthy();
    expect(within(panel()).getByRole("button", { name: "Remove: Amount" })).toBeTruthy();
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

  it("FD.ui.3 Deploy a field set: its fields are added, linked to the set, as a new section", async () => {
    const adapter = memoryAdapter();
    mount(adapter);
    await screen.findByText("Amount");
    fireEvent.click(screen.getByRole("button", { name: "Deploy a field set" }));
    fireEvent.click(await within(panel()).findByRole("combobox"));
    fireEvent.change(screen.getByPlaceholderText("Search field sets…"), { target: { value: "cont" } });
    fireEvent.click(screen.getByRole("option", { name: /Contact Set/ }));
    expect(await within(panel()).findByLabelText("Phone")).toBeTruthy();
    expect(within(panel()).getByRole("checkbox", { name: "Add them as a new section" }).getAttribute("data-state")).toBe("checked");
    fireEvent.click(within(panel()).getByRole("button", { name: "Add to the form" }));
    expect(screen.getByText("Phone")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());
    const saved = adapter.save.mock.calls[0][0] as DesignerItem[];
    expect(ids(saved).slice(-2)).toEqual(["@SET-2::__section", "@SET-2::phone"]);
    expect(saved.at(-1)!.source).toBe("Contact Set");
  });

  it("FD.ui.4 removing a field that holds values asks first, naming how many records", async () => {
    const adapter = memoryAdapter();
    mount(adapter);
    await screen.findByText("Amount");
    select("Amount");
    fireEvent.click(within(panel()).getByRole("button", { name: "Remove: Amount" }));
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    const alert = await screen.findByRole("alertdialog");
    expect(within(alert).getByText("Amount: 3 records")).toBeTruthy();
    expect(adapter.save).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "Save anyway" }));
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());
    expect(ids(adapter.save.mock.calls[0][0])).not.toContain("custom_amount");
  });

  it("FD.ui.5 removing every added field asks before withdrawing; Cancel keeps the form unsaved", async () => {
    const adapter = memoryAdapter();
    mount(adapter);
    await screen.findByText("Amount");
    for (const label of ["Amount", "Note"]) {
      select(label);
      fireEvent.click(within(panel()).getByRole("button", { name: `Remove: ${label}` }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    const alert = await screen.findByRole("alertdialog");
    expect(within(alert).getByText("Remove every added field?")).toBeTruthy();
    fireEvent.click(within(alert).getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("The form's changes were not saved.")).toBeTruthy();
    expect(adapter.save).not.toHaveBeenCalled();
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });

  it("FD.ui.6 a refusal replaces the tools; Arabic", async () => {
    mount(memoryAdapter({ items: [], refusal: "لا يمكن" }), "ar");
    expect(await screen.findByText("النموذج")).toBeTruthy();
    expect(screen.getByText("لا يمكن")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("FD.ui.7 wizard mode off: one form (no tabs, no Add tab); the switch tells the host; on: steps and Add step", async () => {
    const onChange = vi.fn();
    const items = [...LOADED, brk("@tab::Extra", "tab_break", { label: "Extra", own: true }), f("custom_extra", { label: "Extra Field", own: true, fieldtype: "Data" })];
    const { rerender } = render(<ThemeProvider storageKeys={null}><FieldDesigner adapter={memoryAdapter({ items })} wizard={{ on: false, onChange }} /></ThemeProvider>);
    await screen.findByText("Amount");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("button", { name: /Add tab|Add step/ })).toBeNull();
    expect(screen.getByText("Extra Field")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Wizard mode" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    rerender(<ThemeProvider storageKeys={null}><FieldDesigner adapter={memoryAdapter({ items })} wizard={{ on: true, onChange }} /></ThemeProvider>);
    expect(await screen.findByRole("tab", { name: "Step 2 · Extra" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add step" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Step 2 · Extra" }));
    expect(within(panel()).getByRole("textbox", { name: "Step name" })).toBeTruthy();
    expect(within(panel()).getByRole("button", { name: "Remove step" })).toBeTruthy();
  });

  it("FD.ui.7b turning wizard mode off merges the steps into one form, every field kept in order", async () => {
    const adapter = memoryAdapter({ items: [...LOADED, brk("@tab::Extra", "tab_break", { label: "Extra", own: true }), f("custom_extra", { label: "Extra Field", own: true, fieldtype: "Data" })] });
    const onChange = vi.fn();
    mount(adapter, "en", { wizard: { on: true, onChange } });
    await screen.findByRole("tab", { name: "Step 2 · Extra" });
    fireEvent.click(screen.getByRole("switch", { name: "Wizard mode" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());
    const saved = adapter.save.mock.calls[0][0] as DesignerItem[];
    expect(saved.some((i) => i.kind === "tab_break")).toBe(false);
    expect(saved.map((i) => i.id)).toEqual([...LOADED.map((i) => i.id), "custom_extra"]);
  });

  it("FD.ui.7c with wizard mode on, a field dropped on another step moves there", async () => {
    const adapter = memoryAdapter({ items: [...LOADED, brk("@tab::Extra", "tab_break", { label: "Extra", own: true }), f("custom_extra", { label: "Extra Field", own: true, fieldtype: "Data" })] });
    mount(adapter, "en", { wizard: { on: true, onChange: vi.fn() } });
    await screen.findByText("Amount");
    fireEvent.dragStart(within(card("Amount")).getByRole("button", { name: "Reorder field: Amount" }), { dataTransfer: { setData: () => {}, effectAllowed: "" } });
    const step = screen.getByRole("tab", { name: "Step 2 · Extra" });
    fireEvent.dragEnter(step);
    expect(step.getAttribute("data-drop-target")).toBe("true");
    fireEvent.drop(step);
    fireEvent.click(step);
    expect(screen.getByText("Amount")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());
    const ids = (adapter.save.mock.calls[0][0] as DesignerItem[]).map((i) => i.id);
    expect(ids.indexOf("custom_amount")).toBeGreaterThan(ids.indexOf("@tab::Extra"));
  });

  it("FD.ui.7d each field's card shows its control: a text box, a checkbox, an editor, a dropdown, a link search, a map, a table", async () => {
    const items = [
      f("title", { label: "Title", native: true, movable: true, fieldtype: "Data" }),
      f("vip", { label: "VIP", native: true, fieldtype: "Check" }),
      f("description", { label: "Description", native: true, fieldtype: "Text Editor" }),
      f("custom_tier", { label: "Tier", own: true, fieldtype: "dropdown", definition: { type: "dropdown", label: "Tier", choices: [{ en: "Gold" }] } }),
      f("customer", { label: "Customer", native: true, fieldtype: "Link" }),
      f("site", { label: "Site", native: true, fieldtype: "Geolocation" }),
      f("lines", { label: "Lines", native: true, fieldtype: "Table" }),
    ];
    mount(memoryAdapter({ items }));
    await screen.findByText("VIP");
    const kind = (label: string) => card(label).querySelector("[data-field-preview]")?.getAttribute("data-field-preview");
    expect(kind("Title")).toBe("text");
    expect(kind("VIP")).toBe("checkbox");
    expect(kind("Description")).toBe("rich_text");
    expect(kind("Tier")).toBe("dropdown");
    expect(within(card("Tier")).getByText("Gold")).toBeTruthy();
    expect(kind("Customer")).toBe("record_link");
    expect(kind("Site")).toBe("map_location");
    expect(kind("Lines")).toBe("child_table");
  });

  it("FD.ui.8 a field added on the form: a type from the registry, then every property it takes, saved with its key", async () => {
    const adapter = memoryAdapter();
    mount(adapter);
    await screen.findByText("Amount");
    fireEvent.click(screen.getAllByRole("button", { name: "Add field" })[1]);
    fireEvent.click(within(panel()).getByRole("button", { name: "Select" }));
    expect(within(panel()).getByText("Choices")).toBeTruthy();
    fireEvent.change(within(panel()).getByRole("textbox", { name: "Field title" }), { target: { value: "Passport Number" } });
    expect(within(panel()).getByText("passport_number")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit field: Passport Number" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    expect(await screen.findByText(/not finished/)).toBeTruthy();
    expect(adapter.save).not.toHaveBeenCalled();
    fireEvent.click(within(panel()).getByRole("button", { name: "Option" }));
    fireEvent.change(within(panel()).getByRole("textbox", { name: "Option 1" }), { target: { value: "Saudi" } });
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());
    const added = (adapter.save.mock.calls[0][0] as DesignerItem[]).find((i) => i.definition)!;
    expect(added).toMatchObject({ own: true, definition: { type: "dropdown", label: "Passport Number", choices: [{ en: "Saudi" }] } });
  });

  it("FD.ui.9 a changed type keeps the label and drops what the old type alone took", async () => {
    const adapter = memoryAdapter({ items: [...LOADED, f("custom_field_set_score", { own: true, label: "Score", fieldtype: "number",
      definition: { key: "score", type: "number", label: "Score", minValue: 1, maxValue: 9 } })] });
    mount(adapter);
    await screen.findByText("Score");
    select("Score");
    fireEvent.click(within(panel()).getByText("Validation"));
    expect((within(panel()).getByRole("spinbutton", { name: "Max value" }) as HTMLInputElement).value).toBe("9");
    expect(within(panel()).getByText("score")).toBeTruthy();
    fireEvent.keyDown(within(panel()).getByRole("combobox", { name: "Type" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Data" }));
    expect(within(panel()).queryByText("Validation")).toBeTruthy();
    expect(within(panel()).queryByRole("spinbutton", { name: "Max value" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    await waitFor(() => expect(adapter.save).toHaveBeenCalled());
    const def = (adapter.save.mock.calls[0][0] as DesignerItem[]).find((i) => i.definition)!.definition!;
    expect(def).toMatchObject({ key: "score", type: "text", label: "Score" });
    expect(def.maxValue).toBeUndefined();
  });

  it("FD.ui.10 sections and tabs the form adds are named in the panel; a host's Save saves the form (no Save button)", async () => {
    const adapter = memoryAdapter();
    const pending: DesignerPending[] = [];
    mount(adapter, "en", { onPendingChange: (p) => pending.push(p) });
    await screen.findByText("Amount");
    expect(screen.queryByRole("button", { name: "Save form" })).toBeNull();
    expect(pending.at(-1)!.dirty).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    fireEvent.change(within(panel()).getByRole("textbox", { name: "Section title" }), { target: { value: "Extra Details" } });
    expect(screen.getByRole("button", { name: "Section: Extra Details" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add tab" }));
    expect(screen.getByRole("tab", { name: "New tab" })).toBeTruthy();
    await waitFor(() => expect(pending.at(-1)!.dirty).toBe(true));
    await act(() => pending.at(-1)!.save());
    const saved = adapter.save.mock.calls[0][0] as DesignerItem[];
    expect(saved.filter((i) => i.own).map((i) => [i.kind, i.label])).toEqual([["section_break", "Extra Details"], ["tab_break", "New tab"]]);
    await waitFor(() => expect(pending.at(-1)!.dirty).toBe(false));
  });

  it("FD.ui.11 the inspector has a control for every property a field type in Sayr's registry takes", () => {
    const sayrProperties = ["choices", "doctype_target", "child_target", "sibling_field", "data_subtype", "max_rating", "precision",
      "non_negative", "max_length", "bounds", "default", "placeholder", "unique", "autofill", "collapsible"];
    // Sayr's registry (field_types.PROPERTIES): every property but `collapsible`, which only a Section Break takes.
    expect([...INSPECTED_PROPERTIES, "collapsible"].sort()).toEqual([...sayrProperties].sort());
    expect(ownKeys([{ id: "a", definition: { type: "text", label: "Name" } }, { id: "b", definition: { type: "text", label: "Name" } },
      { id: "c", definition: { key: "name_2", type: "text", label: "Other" } }, { id: "d", definition: { type: "text", label: "اسم" } }]))
      .toEqual(new Map([["a", "name"], ["b", "name_3"], ["c", "name_2"], ["d", "field"]]));
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
    own_fields: [] as Record<string, unknown>[],
  },
  target_fields: [
    { fieldname: "title", label: "Title", fieldtype: "Data" },
    { fieldname: "sear_state", label: "Status", fieldtype: "Data" },
    { fieldname: "sear_set_1__section", label: "sear_set_1__section", fieldtype: "Section Break" },
    { fieldname: "custom_field_set_amount", label: "Amount", fieldtype: "Currency" },
  ],
};
/** An own section and field after the set's, as Sayr answers once they are deployed. */
const WITH_OWN = {
  ...SCREEN,
  deployment: {
    ...SCREEN.deployment,
    fields: [
      ...SCREEN.deployment.fields,
      { field_preset: null, field_key: null, row_kind: "section", label: "Extra", insert_after: "custom_field_set_amount", fieldname: "sear_section_extra" },
      { field_preset: null, field_key: "notes", row_kind: "field", label: null, insert_after: "sear_section_extra", fieldname: "custom_field_set_notes" },
    ],
    own_fields: [{ field_key: "notes", field_type: "text", label_en: "Notes", label_ar: "ملاحظات", reqd: 1, max_length: 200, show_when_source: "is_not_empty(title)" }],
  },
  target_fields: [
    ...SCREEN.target_fields,
    { fieldname: "sear_section_extra", label: "Extra", fieldtype: "Section Break" },
    { fieldname: "custom_field_set_notes", label: "Notes", fieldtype: "Data" },
  ],
};
const SAYR_REGISTRY = {
  types: [
    { key: "text", label_en: "Data", label_ar: "البيانات", group: "Text", props: ["max_length", "default", "placeholder", "unique", "autofill", "data_subtype"] },
    { key: "dropdown", label_en: "Select", label_ar: "اختر", group: "Choice", props: ["choices", "default", "autofill"] },
    { key: "section_break", label_en: "Section Break", label_ar: "فاصل قسم", group: "Layout", props: ["collapsible"] },
  ],
  groups: [{ group: "Text", types: ["text"] }, { group: "Choice", types: ["dropdown"] }, { group: "Layout", types: ["section_break"] }],
  data_subtypes: ["Email"],
  properties: [], excluded: [],
};

function recordingApi(over: Partial<Record<string, (args: Record<string, unknown>) => unknown>> = {}) {
  const calls: { method: string; args: Record<string, unknown> }[] = [];
  const answers: Record<string, (args: Record<string, unknown>) => unknown> = {
    "sear_product.apis.field_library.deployments.doctype_deployment": () => SCREEN,
    "sear_product.apis.field_library.field_sets.field_type_registry": () => SAYR_REGISTRY,
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
const savedDoc = (calls: { method: string; args: Record<string, unknown> }[]) =>
  JSON.parse(calls.find((c) => c.method === "frappe.client.save")!.args.doc as string);

describe("FD.sayr — createSayrFieldDesignerAdapter (SIMULATED)", () => {
  it("FD.sayr.1 the type's form in order: shared fields movable, standard ones locked, a set's fields its own", async () => {
    const { api } = recordingApi();
    const state = await createSayrFieldDesignerAdapter(api, "SRF Ticket Refund Request").load();
    expect(state.items).toEqual([
      { id: "title", kind: "field", label: "Title", fieldtype: "Data", native: true, movable: true },
      { id: "sear_state", kind: "field", label: "Status", fieldtype: "Data", native: true, movable: false },
      { id: "sear_set_1__section", kind: "section_break", label: "Refund Set", source: "Refund Set" },
      { id: "custom_field_set_amount", kind: "field", label: "Amount", fieldtype: "Currency", source: "Refund Set" },
    ]);
  });

  it("FD.sayr.2 a set's addable fields leave out breaks and what is already deployed; Arabic names kept", async () => {
    const { api } = recordingApi();
    const adapter = createSayrFieldDesignerAdapter(api, "SRF Ticket Refund Request");
    await adapter.load();
    expect(await adapter.fieldsOf("SET-1")).toEqual([{ id: "@SET-1::iban", kind: "field", label: { en: "IBAN", ar: "آيبان" }, fieldtype: "text" }]);
  });

  it("FD.sayr.3 save writes the rows anchored by Sayr's tokens on what precedes them, then the type's whole order", async () => {
    const { api, calls } = recordingApi();
    const adapter = createSayrFieldDesignerAdapter(api, "SRF Ticket Refund Request");
    const { items } = await adapter.load();
    await adapter.save([...items, { id: "@SET-1::iban", kind: "field" as const, label: "IBAN" }]);
    expect(savedDoc(calls).fields.map((r: { row_kind: string; field_key: string; insert_after: string }) => [r.row_kind, r.field_key, r.insert_after])).toEqual([
      ["section", null, "sear_state"],
      ["field", "amount", "@SET-1::__section"],
      ["field", "iban", "@SET-1::amount"],
    ]);
    const order = calls.find((c) => c.method.endsWith("save_field_order"))!;
    expect(JSON.parse(order.args.order as string)).toEqual(["title", "sear_state", "@SET-1::__section", "@SET-1::amount", "@SET-1::iban"]);
    expect(calls.findIndex((c) => c.method === "frappe.client.save")).toBeLessThan(calls.findIndex((c) => c.method.endsWith("save_field_order")));
  });

  it("FD.sayr.4 a form whose rows did not change is not redeployed (no DDL); a move that re-anchors a row is", async () => {
    const { api, calls } = recordingApi();
    const adapter = createSayrFieldDesignerAdapter(api, "SRF Ticket Refund Request");
    const { items } = await adapter.load();
    await adapter.save(items);
    expect(calls.some((c) => c.method === "frappe.client.save" || c.method === "frappe.client.insert")).toBe(false);
    expect(calls.some((c) => c.method.endsWith("save_field_order"))).toBe(true);
    calls.length = 0;
    await adapter.save(stepItem(items, "title", 1));
    expect(savedDoc(calls).fields[0]).toMatchObject({ row_kind: "section", insert_after: "title" });
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

  it("FD.sayr.6 tokens are Sayr's: a tab by its label, an own section by its label, an own field by its key, a set's section and field; the core entry has no Sayr code", () => {
    expect(sayrToken({ row_kind: "tab", label: " Details ", field_preset: null, field_key: null })).toBe("@tab::Details");
    expect(sayrToken({ row_kind: "section", label: "Extra", field_preset: null, field_key: null })).toBe("@section::Extra");
    expect(sayrToken({ row_kind: "field", label: null, field_preset: null, field_key: "notes" })).toBe("@own::notes");
    expect(sayrToken({ row_kind: "section", field_preset: "SET-1", field_key: "", label: null })).toBe("@SET-1::__section");
    expect(sayrToken({ row_kind: "field", field_preset: "SET-1", field_key: "iban", label: null })).toBe("@SET-1::iban");
    expect("createSayrFieldDesignerAdapter" in core).toBe(false);
  });

  it("FD.sayr.7 the form's own fields load with their definitions and save in own_fields, placed by rows with no field set", async () => {
    const { api, calls } = recordingApi({ "sear_product.apis.field_library.deployments.doctype_deployment": () => WITH_OWN });
    const adapter = createSayrFieldDesignerAdapter(api, "SRF Ticket Refund Request", { language: "ar" });
    const { items } = await adapter.load();
    expect(items.find((i) => i.id === "sear_section_extra")).toMatchObject({ kind: "section_break", label: "Extra", own: true });
    const notes = items.find((i) => i.id === "custom_field_set_notes")!;
    expect(notes).toMatchObject({ own: true, label: "ملاحظات", definition: { key: "notes", type: "text", label: "Notes", required: true, maxLength: 200, showWhen: "is_not_empty(title)" } });
    expect((await adapter.fieldTypes!()).groups.map((g) => g.group)).toEqual(["Text", "Choice"]);

    await adapter.save(items);
    expect(calls.some((c) => c.method === "frappe.client.save")).toBe(false);

    const renamed = items.map((i) => (i.id === "sear_section_extra" ? { ...i, label: "More" } : i));
    const channel: DesignerItem = { id: "new:1", kind: "field", own: true, label: "Channel", definition: { type: "dropdown", label: "Channel", choices: [{ en: "Email" }, { en: "" }], maxLength: 9 } };
    await adapter.save([...renamed, channel]);
    const doc = savedDoc(calls);
    expect(doc.fields.slice(2).map((r: Record<string, unknown>) => [r.row_kind, r.field_preset, r.field_key, r.label, r.insert_after])).toEqual([
      ["section", null, null, "More", "@SET-1::amount"],
      ["field", null, "notes", null, "@section::More"],
      ["field", null, "channel", null, "@own::notes"],
    ]);
    expect(doc.own_fields.map((r: Record<string, unknown>) => r.field_key)).toEqual(["notes", "channel"]);
    const sent = doc.own_fields[1];
    expect(sent).toMatchObject({ field_type: "dropdown", label_en: "Channel", choices: [{ value_en: "Email" }] });
    expect("max_length" in sent).toBe(false);
    expect(doc.own_fields[0]).toMatchObject({ label_ar: "ملاحظات", reqd: 1, max_length: 200, show_when_source: "is_not_empty(title)" });
  });
});

void act;
