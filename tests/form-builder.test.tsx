/**
 * Form builder — the model's operations (pure), the field-type registry, and the UI: FieldTypePicker ("Add a field"),
 * FormFieldInspector (every property section), FormBuilder (sections, columns, fields, drag & drop, keyboard, wizard
 * steps, delete flows, locked standard fields), the app slots, TypeFormSection integration, CRM independence.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import * as fs from "node:fs";
import * as path from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import type { Language } from "../src/theme/messages";
import * as pkg from "../src";
import {
  FORM_FIELD_TYPES, FORM_FIELD_GROUPS, FieldTypePicker, FormBuilder, FormFieldInspector, TypeFormSection, addField, addSection,
  addStep, allFields, deleteSection, disableWizard, enableWizard, maxFieldCols, moveField, moveSection, newFormField, newSection,
  normalizeForm, nudgeField, nudgeSection, pickFieldTypes, placeAside, removeField, removeStep, reorderStep, rowCountOf,
  rowGroups, setSectionColumns, setWizard, tableColumnTypes, updateField,
  type FormBuilderField, type FormBuilderProps, type FormBuilderSection, type FormBuilderStep, type FormBuilderValue,
} from "../src/record";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const fld = (id: string, title: string, extra: Partial<FormBuilderField> = {}): FormBuilderField => ({ id, type: "text", title, required: false, column: 1, ...extra });
const sec = (id: string, fields: FormBuilderField[], extra: Partial<FormBuilderSection> = {}): FormBuilderSection => ({ id, title: id.toUpperCase(), columns: 1, rowId: `r_${id}`, fields, ...extra });
const steps1 = (): FormBuilderStep[] => [{ id: "main", title: "", sections: [
  sec("a", [fld("n", "Name", { core: true, required: true }), fld("x", "X"), fld("y", "Y")]),
  sec("b", [fld("z", "Z")]),
] }];
const ids = (steps: FormBuilderStep[]) => steps.map((st) => st.sections.map((s) => `${s.id}:${s.fields.map((f) => f.id).join(",")}`).join(" | "));

describe("model", () => {
  it("new fields carry their type's defaults", () => {
    expect(newFormField("dropdown").options?.map((o) => o.label)).toEqual(["Option 1", "Option 2"]);
    expect(newFormField("radio").options).toHaveLength(2);
    expect(newFormField("multi_select").options).toHaveLength(2);
    expect(newFormField("file_upload").allowedFileTypes).toEqual(["PDF", "PNG", "JPG"]);
    expect(newFormField("image_upload").allowedFileTypes).toEqual(["PNG", "JPG"]);
    const table = newFormField("table");
    expect(table).toMatchObject({ rowsFrom: "user", fullWidth: true });
    expect(table.columns?.map((c) => [c.title, c.type, c.kind])).toEqual([["Column 1", "text", "entered"], ["Column 2", "text", "entered"]]);
    expect(newFormField("long_text").fullWidth).toBe(true);
    expect(newFormField("text")).toMatchObject({ title: "", required: false, column: 1, fullWidth: false });
  });

  it("wizard on: one step per section (titled like it); off: one implicit step; nothing lost", () => {
    const on = enableWizard(steps1());
    expect(on.map((s) => s.title)).toEqual(["A", "B"]);
    expect(on.map((s) => s.sections.map((x) => x.id))).toEqual([["a"], ["b"]]);
    const off = disableWizard(on);
    expect(off).toHaveLength(1);
    expect(off[0].id).toBe("main");
    expect(allFields(off).map((f) => f.id)).toEqual(["n", "x", "y", "z"]);
    expect(enableWizard([{ id: "s", title: "", sections: [] }])).toHaveLength(1);
    const v: FormBuilderValue = { wizard: false, steps: steps1() };
    expect(setWizard(v, false)).toBe(v);
    expect(setWizard(v, true).wizard).toBe(true);
  });

  it("sections: add after, delete moving fields, delete with fields rescuing standard ones, system sections stay", () => {
    const r = addSection(steps1(), "main", "a");
    expect(r.steps[0].sections.map((s) => s.id)).toEqual(["a", r.section.id, "b"]);
    expect(ids(deleteSection(steps1(), "a", "move", "b"))).toEqual(["b:z,n,x,y"]);
    const moved = deleteSection(steps1(), "a", "move", "b");
    expect(moved[0].sections[0].fields.every((f) => f.column === 1)).toBe(true);
    expect(ids(deleteSection(steps1(), "a", "with-fields"))).toEqual(["b:z,n"]);
    expect(ids(deleteSection(steps1(), "b", "with-fields"))).toEqual(["a:n,x,y"]);
    const only = [{ id: "m", title: "", sections: [sec("a", [fld("n", "Name", { core: true }), fld("x", "X")])] }];
    expect(ids(deleteSection(only, "a", "with-fields"))).toEqual(["a:n"]);
    const sys = [{ id: "m", title: "", sections: [sec("a", [], { system: true })] }];
    expect(ids(deleteSection(sys, "a", "with-fields"))).toEqual(["a:"]);
  });

  it("columns: 1 merges in column order, fewer clamps, more leaves fields where they are", () => {
    const s = sec("c", [fld("1", "1", { column: 2 }), fld("2", "2", { column: 1 }), fld("3", "3", { column: 3 })], { columns: 3 });
    expect(setSectionColumns(s, 1).fields.map((f) => [f.id, f.column])).toEqual([["2", 1], ["1", 1], ["3", 1]]);
    expect(setSectionColumns(s, 2).fields.map((f) => f.column)).toEqual([2, 1, 2]);
    expect(setSectionColumns(s, 4).fields.map((f) => f.column)).toEqual([2, 1, 3]);
    expect(setSectionColumns(s, 3)).toBe(s);
  });

  it("fields: move across sections and before a field; keyboard nudge; standard fields move but are never removed", () => {
    expect(ids(moveField(steps1(), "z", "a", 1, "x"))).toEqual(["a:n,z,x,y | b:"]);
    expect(ids(moveField(steps1(), "n", "b", 1))).toEqual(["a:x,y | b:z,n"]);
    expect(ids(nudgeField(steps1(), "y", -1))).toEqual(["a:n,y,x | b:z"]);
    expect(ids(nudgeField(steps1(), "n", -1))).toEqual(["a:n,x,y | b:z"]);
    expect(ids(removeField(steps1(), "n"))).toEqual(["a:n,x,y | b:z"]);
    expect(ids(removeField(steps1(), "x"))).toEqual(["a:n,y | b:z"]);
    expect(ids(addField(steps1(), "b", 1, newFormField("text")))[0]).toMatch(/^a:n,x,y \| b:z,fld_/);
  });

  it("updateField: a standard field stays required; with lockCore its type, title and options never change", () => {
    const s1 = updateField(steps1(), "n", { required: false, title: "Renamed", column: 2 });
    expect(allFields(s1)[0]).toMatchObject({ required: true, title: "Renamed", column: 2 });
    const s2 = updateField(steps1(), "n", { required: false, title: "Renamed", type: "number", column: 2 }, true);
    expect(allFields(s2)[0]).toMatchObject({ required: true, title: "Name", type: "text", column: 2 });
    expect(allFields(updateField(steps1(), "x", { required: true }))[1].required).toBe(true);
  });

  it("side by side: join a row (columns capped), a full row stacks; a moved section gets its own row", () => {
    const base: FormBuilderStep[] = [{ id: "m", title: "", sections: [sec("a", [], { columns: 3 }), sec("b", [], { columns: 3 }), sec("c", []), sec("d", [])] }];
    const two = placeAside(base, "b", "a", "end");
    expect(rowCountOf(two[0].sections, "a")).toBe(2);
    expect(two[0].sections.map((s) => [s.id, s.columns])).toEqual([["a", 2], ["b", 2], ["c", 1], ["d", 1]]);
    const three = placeAside(two, "c", "a", "start");
    expect(three[0].sections.map((s) => s.id)).toEqual(["c", "a", "b", "d"]);
    expect(rowGroups(three[0].sections).map((r) => r.length)).toEqual([3, 1]);
    expect(three[0].sections.slice(0, 3).every((s) => s.columns === 1)).toBe(true);
    const stacked = placeAside(three, "d", "a", "end");
    expect(rowCountOf(stacked[0].sections, "d")).toBe(1);
    expect(stacked[0].sections.map((s) => s.id)).toEqual(["c", "d", "a", "b"]);
    const out = moveSection(two, "b", "m");
    expect(out[0].sections.map((s) => s.id)).toEqual(["a", "c", "d", "b"]);
    expect(rowCountOf(out[0].sections, "a")).toBe(1);
    expect([maxFieldCols(1), maxFieldCols(2), maxFieldCols(3)]).toEqual([4, 2, 1]);
    expect(ids(nudgeSection(base, "c", -1))).toEqual(["a: | c: | b: | d:"]);
  });

  it("steps: add, reorder, delete moving sections or rescuing standard fields; never the last step", () => {
    const st: FormBuilderStep[] = [{ id: "s1", title: "1", sections: [sec("a", [fld("n", "N", { core: true }), fld("x", "X")])] }, { id: "s2", title: "2", sections: [sec("b", [])] }, { id: "s3", title: "3", sections: [] }];
    expect(addStep(st).steps).toHaveLength(4);
    expect(reorderStep(st, "s3", "s1").map((s) => s.id)).toEqual(["s3", "s1", "s2"]);
    expect(removeStep(st, "s1", "move", "s2").map((s) => [s.id, s.sections.map((x) => x.id)])).toEqual([["s2", ["b", "a"]], ["s3", []]]);
    const rescued = removeStep(st, "s1", "with-sections");
    expect(rescued.map((s) => s.id)).toEqual(["s2", "s3"]);
    expect(rescued[0].sections[0].fields.map((f) => f.id)).toEqual(["n"]);
    expect(removeStep([st[0]], "s1", "with-sections")).toHaveLength(1);
    const noHost = removeStep([st[0], { id: "e", title: "", sections: [] }], "s1", "with-sections");
    expect(noHost[0].sections[0].fields.map((f) => f.id)).toEqual(["n"]);
  });

  it("normalizeForm: legacy flat fields become one section; stored layouts get rows and capped columns", () => {
    const legacy = normalizeForm({ name: "Warranty", fields: [fld("a", "A"), { ...fld("b", "B", { type: "long_text" }), column: undefined, fullWidth: undefined }] });
    expect(legacy.wizard).toBe(false);
    expect(legacy.steps[0].sections[0]).toMatchObject({ title: "Warranty", columns: 1 });
    expect(legacy.steps[0].sections[0].fields[1]).toMatchObject({ column: 1, fullWidth: true });
    const stored = normalizeForm({ wizard: true, steps: [{ id: "s", title: "", sections: [sec("a", [], { columns: 4, rowId: "r" }), sec("b", [], { columns: 3, rowId: "r" })] }] });
    expect(stored.steps[0].sections.map((s) => s.columns)).toEqual([2, 2]);
    expect(stored.wizard).toBe(true);
  });
});

describe("field types", () => {
  const CRM_TYPES = ["text", "long_text", "rich_text", "dropdown", "multi_select", "radio", "checkbox", "rating", "color", "number", "decimal", "currency", "percent", "duration", "date", "datetime", "time", "email", "phone", "file_upload", "image_upload", "signature", "record_link", "map_location", "barcode", "heading", "table", "display_value"];
  it("has every Field Library type, each with names in both languages, a description, an icon and a known group", () => {
    expect(FORM_FIELD_TYPES.map((t) => t.key).sort()).toEqual([...CRM_TYPES].sort());
    for (const t of FORM_FIELD_TYPES) {
      expect(typeof t.label === "object" && t.label.en && t.label.ar, t.key).toBeTruthy();
      expect(typeof t.description === "object" && t.description.en && t.description.ar, t.key).toBeTruthy();
      expect(t.icon, t.key).toBeTruthy();
      expect(FORM_FIELD_GROUPS.some((g) => g.id === t.group), t.key).toBe(true);
    }
    expect(FORM_FIELD_TYPES.filter((t) => t.advanced).map((t) => t.key)).toEqual(["table", "display_value"]);
  });
  it("capabilities match the Field Library's matrix where it matters", () => {
    const c = (k: string) => FORM_FIELD_TYPES.find((t) => t.key === k)!.caps;
    expect(c("checkbox").required).toBe(false);
    expect(c("heading")).toMatchObject({ description: false, required: false, conditions: "show", display: "hidden" });
    expect(c("display_value")).toMatchObject({ required: false, conditions: "show" });
    expect(c("record_link")).toMatchObject({ linkTarget: true, placeholder: true, unique: true, autofill: true });
    expect(c("text")).toMatchObject({ unique: true, maxLength: true, placeholder: true });
    expect(c("currency")).toMatchObject({ minMax: true, unique: false });
    expect(c("dropdown").choices && c("radio").choices && c("multi_select").choices).toBe(true);
  });
  it("table columns: one nesting level, in the Field Library's order", () => {
    expect(tableColumnTypes(0)).toEqual(["text", "long_text", "dropdown", "multi_select", "radio", "checkbox", "rating", "number", "decimal", "currency", "percent", "duration", "date", "datetime", "time", "email", "phone", "record_link", "display_value", "table"]);
    expect(tableColumnTypes(1)).not.toContain("table");
    expect(pickFieldTypes(["text", "dropdown"]).map((t) => t.key)).toEqual(["text", "dropdown"]);
  });
});

const wrap = (ui: React.ReactElement, language: Language = "en") => render(<ThemeProvider defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>);

function Harness({ initial, onValue, ...rest }: { initial: FormBuilderValue; onValue?: (v: FormBuilderValue) => void } & Partial<FormBuilderProps>) {
  const [value, setValue] = React.useState(initial);
  return <FormBuilder value={value} onChange={(v) => { setValue(v); onValue?.(v); }} {...rest} />;
}
const start = (): FormBuilderValue => ({ wizard: false, steps: steps1() });

describe("FieldTypePicker", () => {
  it("groups the types, searches name and description in both languages, and picks", () => {
    const onPick = vi.fn();
    wrap(<FieldTypePicker onPick={onPick} />);
    expect(screen.getByRole("group", { name: "Text" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Table/ })).toBeNull();          // advanced types hidden by default
    fireEvent.change(screen.getByRole("textbox", { name: "Search field types…" }), { target: { value: "one option" } });
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("data-fb-type"))).toEqual(["dropdown", "radio"]);
    fireEvent.change(screen.getByRole("textbox", { name: "Search field types…" }), { target: { value: "توقيع" } });
    fireEvent.click(screen.getByRole("button", { name: /Signature/ }));
    expect(onPick).toHaveBeenCalledWith("signature");
    fireEvent.change(screen.getByRole("textbox", { name: "Search field types…" }), { target: { value: "zzz" } });
    expect(screen.getByText("No matching field types")).toBeTruthy();
  });
  it("advanced adds the structured types; Arabic names", () => {
    wrap(<FieldTypePicker onPick={() => {}} advanced />, "ar");
    expect(screen.getByRole("group", { name: "مركّبة" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /جدول/ })).toBeTruthy();
  });
});

describe("FormFieldInspector", () => {
  function Insp({ field: initial, siblings = [], ...rest }: { field: FormBuilderField; siblings?: FormBuilderField[] } & Partial<React.ComponentProps<typeof FormFieldInspector>>) {
    const [field, setField] = React.useState(initial);
    return <><FormFieldInspector field={field} siblings={[field, ...siblings]} onChange={(p) => setField((f) => ({ ...f, ...p }))} {...rest} /><pre data-testid="state">{JSON.stringify(field)}</pre></>;
  }
  const state = () => JSON.parse(screen.getByTestId("state").textContent!) as FormBuilderField;
  const open = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

  it("basics: title, helper, placeholder, required, default value (text)", () => {
    wrap(<Insp field={fld("t", "")} />);
    fireEvent.change(screen.getByLabelText("Field Title"), { target: { value: "Serial number" } });
    fireEvent.change(screen.getByLabelText("Description / Helper Text"), { target: { value: "On the plate" } });
    fireEvent.change(screen.getByLabelText("Placeholder"), { target: { value: "SN-…" } });
    fireEvent.click(screen.getByRole("switch", { name: "Required" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Default value" }), { target: { value: "N/A" } });
    expect(state()).toMatchObject({ title: "Serial number", description: "On the plate", placeholder: "SN-…", required: true, defaultValue: "N/A" });
  });
  it("Arabic edits the Arabic title and helper, keeping the English ones", () => {
    wrap(<Insp field={fld("t", "Serial")} />, "ar");
    fireEvent.change(screen.getByLabelText("عنوان الحقل"), { target: { value: "الرقم التسلسلي" } });
    expect(state()).toMatchObject({ title: "Serial", titleAr: "الرقم التسلسلي" });
  });
  it("choices: add, rename and remove options; multi-select default toggles", () => {
    wrap(<Insp field={{ ...newFormField("multi_select"), id: "m" }} />);
    open("Choices");
    fireEvent.click(screen.getByRole("button", { name: "Option" }));
    expect(state().options?.map((o) => o.label)).toEqual(["Option 1", "Option 2", "Option 3"]);
    fireEvent.change(screen.getByRole("textbox", { name: "Option 1" }), { target: { value: "Red" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove option 2" }));
    expect(state().options?.map((o) => o.label)).toEqual(["Red", "Option 3"]);
    fireEvent.click(screen.getByRole("button", { name: "Red" }));
    fireEvent.click(screen.getByRole("button", { name: "Option 3" }));
    expect(state().defaultValue).toBe("Red||Option 3");
    expect(screen.queryByRole("textbox", { name: "Option 1 — Arabic" })).toBeNull();
  });
  it("advanced choices take Arabic labels", () => {
    wrap(<Insp field={{ ...newFormField("dropdown"), id: "d" }} advanced />);
    open("Choices");
    fireEvent.change(screen.getByRole("textbox", { name: "Option 1 — Arabic" }), { target: { value: "أحمر" } });
    expect(state().options?.[0].labelAr).toBe("أحمر");
  });
  it("validation: unique, max length; min / max for numbers; email notes", () => {
    wrap(<Insp field={fld("t", "T")} />);
    open("Validation");
    fireEvent.click(screen.getByRole("switch", { name: "Unique (no duplicate values)" }));
    fireEvent.change(screen.getByLabelText("Max length"), { target: { value: "40" } });
    expect(state()).toMatchObject({ unique: true, maxLength: 40 });
    cleanup();
    wrap(<Insp field={fld("n", "N", { type: "currency" })} />);
    open("Validation");
    expect(screen.queryByRole("switch", { name: "Unique (no duplicate values)" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Min value"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Max value"), { target: { value: "99" } });
    expect(state()).toMatchObject({ minValue: 0, maxValue: 99 });
    cleanup();
    wrap(<Insp field={fld("e", "E", { type: "email" })} />);
    open("Validation");
    expect(screen.getByText("Email format is checked automatically.")).toBeTruthy();
  });
  it("conditions: show / required / read-only when (the app's control when given); headings only show-when", () => {
    wrap(<Insp field={fld("t", "T")} />);
    open("Conditions");
    fireEvent.change(screen.getByLabelText("Required when…"), { target: { value: 'status == "Open"' } });
    expect(state().requiredWhen).toBe('status == "Open"');
    cleanup();
    const renderCondition = vi.fn(({ label }: { label: string }) => <span key={label}>app:{label}</span>);
    wrap(<Insp field={fld("h", "Head", { type: "heading" })} renderCondition={renderCondition} />);
    open("Conditions");
    expect(screen.getByText("app:Show when…")).toBeTruthy();
    expect(screen.queryByText("app:Required when…")).toBeNull();
    expect(screen.queryByRole("switch", { name: "Required" })).toBeNull();
    expect(screen.queryByLabelText("Description / Helper Text")).toBeNull();
    open("Display");
    expect(screen.getAllByRole("switch").map((s) => s.getAttribute("aria-label") ?? s.id)).toHaveLength(1);
  });
  it("display: every switch for a normal field", () => {
    wrap(<Insp field={fld("t", "T")} />);
    open("Display");
    for (const name of ["Show in list view", "Hide in print", "Editable when closed", "Use as a filter", "Include in global search", "Bold", "Hidden", "Read only", "Translatable"]) {
      fireEvent.click(screen.getByRole("switch", { name }));
    }
    expect(state()).toMatchObject({ inListView: true, hideInPrint: true, editableWhenClosed: true, standardFilter: true, globalSearch: true, bold: true, hidden: true, readOnly: true, translatable: true });
  });
  it("record link: link filters inline; auto-fill from another record link on the section", () => {
    const targets = [{ value: "site", label: { en: "Site", ar: "موقع" }, fields: [{ value: "city", label: "City" }, { value: "zone", label: "Zone" }], records: [{ id: "S1", label: "Riyadh HQ" }] }];
    wrap(<Insp field={fld("l", "Location", { type: "record_link", linkTarget: "site" })} linkTargets={targets} siblings={[fld("o", "Owner", { type: "record_link", linkTarget: "site" })]} />);
    open("Link target");
    fireEvent.click(screen.getByRole("button", { name: /Add filters/ }));
    const region = screen.getByRole("region", { name: "Limit the records shown" });
    expect(within(region).getByText("Only show Site records that match these rules.")).toBeTruthy();
    fireEvent.click(within(region).getByRole("button", { name: "Add filter" }));
    fireEvent.change(within(region).getByRole("textbox", { name: "Value 1" }), { target: { value: "Riyadh" } });
    expect(state().linkFilters).toEqual([expect.objectContaining({ field: "city", operator: "equals", value: "Riyadh" })]);
    expect(screen.getByRole("button", { name: /1 filter/ })).toBeTruthy();
    fireEvent.click(within(region).getByRole("button", { name: "Clear all" }));
    expect(state().linkFilters).toEqual([]);
    open("Auto-fill");
    expect(screen.getByRole("switch", { name: "Only fill when empty" })).toBeTruthy();
  });
  it("no auto-fill section when the section has no record link", () => {
    wrap(<Insp field={fld("t", "T")} />);
    expect(screen.queryByRole("button", { name: "Auto-fill" })).toBeNull();
  });
  it("table: rows source, add / type / remove columns, derived columns", () => {
    wrap(<Insp field={{ ...newFormField("table"), id: "tb" }} sources={[{ id: "src.lines", label: "Order lines", kind: "list" }]} />);
    expect(screen.getAllByRole("textbox", { name: /^Column name/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Column" }));
    expect(state().columns).toHaveLength(3);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove column" })[0]);
    expect(state().columns).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("radio", { name: "Derived per row" })[0]);
    expect(state().columns?.[0].kind).toBe("derived");
    expect(screen.getAllByText("Bound to").length).toBe(1);
  });
  it("a standard field's Required switch is fixed on", () => {
    wrap(<Insp field={fld("n", "Name", { core: true, required: true })} />);
    expect((screen.getByRole("switch", { name: "Required" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("the app's title input and extra sections", () => {
    wrap(<Insp field={fld("t", "T")} renderTitleInput={(p) => <input aria-label={`app ${p["aria-label"]}`} value={p.value} onChange={(e) => p.onChange(e.target.value)} />}
      renderFieldProperties={() => <div>app section</div>} />);
    fireEvent.change(screen.getByLabelText("app Field Title"), { target: { value: "From app" } });
    expect(state().title).toBe("From app");
    expect(screen.getByText("app section")).toBeTruthy();
  });
});

describe("FormBuilder", () => {
  it("draws sections and fields; Add field → the type picker → a new field, selected with its properties", () => {
    let last: FormBuilderValue | undefined;
    wrap(<Harness initial={start()} onValue={(v) => { last = v; }} />);
    expect(screen.getByText("Select an element to edit its properties.")).toBeTruthy();
    const sectionB = document.querySelector('[data-fb-section="b"]') as HTMLElement;
    fireEvent.click(within(sectionB).getByRole("button", { name: "Add field" }));
    expect(screen.getByRole("heading", { name: "Add a field" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Dropdown/ }));
    const added = last!.steps[0].sections[1].fields[1];
    expect(added.type).toBe("dropdown");
    expect(screen.getByRole("heading", { name: "Dropdown" })).toBeTruthy();
    expect(screen.getByLabelText("Field Title")).toBeTruthy();
  });

  it("selecting a field: delete it from the panel; Full width; a standard field cannot be deleted and says why", () => {
    let last: FormBuilderValue | undefined;
    wrap(<Harness initial={start()} onValue={(v) => { last = v; }} lockCore entityLabel={{ en: "Asset", ar: "أصل" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reorder field: X" }));
    fireEvent.click(screen.getByRole("switch", { name: "Full width" }));
    expect(allFields(last!.steps).find((f) => f.id === "x")?.fullWidth).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete field" }));
    expect(allFields(last!.steps).map((f) => f.id)).toEqual(["n", "y", "z"]);
    fireEvent.click(screen.getByRole("button", { name: "Reorder field: Name" }));
    expect(screen.queryByRole("button", { name: "Delete field" })).toBeNull();
    expect(screen.getByText(/always on every Asset/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Field Title"), { target: { value: "Changed" } });
    expect(allFields(last!.steps)[0].title).toBe("Name");                      // lockCore
    expect(screen.getAllByRole("img", { name: "Standard field" })).toHaveLength(1);
  });

  it("drag a field onto another (any section), and reorder with the keyboard", () => {
    let last: FormBuilderValue | undefined;
    wrap(<Harness initial={start()} onValue={(v) => { last = v; }} />);
    fireEvent.dragStart(screen.getByRole("button", { name: "Reorder field: Z" }));
    fireEvent.dragOver(document.querySelector('[data-fb-field="x"]')!);
    fireEvent.drop(document.querySelector('[data-fb-field="x"]')!);
    expect(ids(last!.steps)).toEqual(["a:n,z,x,y | b:"]);
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder field: Y" }), { key: "ArrowUp" });
    expect(ids(last!.steps)).toEqual(["a:n,z,y,x | b:"]);
    // drop on an empty column slot of another section
    fireEvent.dragStart(screen.getByRole("button", { name: "Reorder field: X" }));
    fireEvent.drop(document.querySelector('[data-fb-section="b"] [data-fb-column-drop="1"]')!);
    expect(ids(last!.steps)).toEqual(["a:n,z,y | b:x"]);
  });

  it("sections: columns from the header, side by side by dragging onto an edge, keyboard reorder, collapsible", () => {
    let last: FormBuilderValue | undefined;
    wrap(<Harness initial={start()} onValue={(v) => { last = v; }} />);
    const headerA = document.querySelector('[data-fb-section="a"]') as HTMLElement;
    fireEvent.click(within(headerA).getByRole("radio", { name: "2 field column(s)" }));
    expect(last!.steps[0].sections[0].columns).toBe(2);
    expect(within(headerA).queryByRole("radio", { name: "4 field column(s)" })).toBeNull();   // 3 is the cap by default
    fireEvent.dragStart(screen.getByRole("button", { name: "Reorder section: B" }));
    fireEvent.drop(document.querySelector('[data-fb-section="a"] [data-fb-aside="end"]')!);
    expect(rowCountOf(last!.steps[0].sections, "a")).toBe(2);
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder section: B" }), { key: "ArrowUp" });
    expect(last!.steps[0].sections.map((s) => s.id)).toEqual(["b", "a"]);
    fireEvent.click(screen.getByRole("button", { name: "Reorder section: A" }));
    fireEvent.change(screen.getByLabelText("Section title"), { target: { value: "Identity" } });
    fireEvent.click(screen.getByRole("switch", { name: "Collapsible" }));
    fireEvent.click(screen.getByRole("switch", { name: "Starts collapsed" }));
    expect(last!.steps[0].sections.find((s) => s.id === "a")).toMatchObject({ title: "Identity", collapsible: true, startCollapsed: true });
    expect(document.querySelector('[data-fb-field="x"]')).toBeNull();                       // collapsed on the canvas
    fireEvent.click(screen.getByRole("button", { name: "Expand section" }));
    expect(document.querySelector('[data-fb-field="x"]')).toBeTruthy();
  });

  it("delete a section: move its fields, or delete them (standard fields rescued), or cancel", () => {
    let last: FormBuilderValue | undefined;
    wrap(<Harness initial={start()} onValue={(v) => { last = v; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete section: A" }));
    expect(screen.getByText("This section has 3 field(s). What should happen to them?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/What should happen/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete section: A" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete section and its fields" }));
    expect(ids(last!.steps)).toEqual(["b:z,n"]);
  });

  it("add sections at the end and between sections; empty sections show their add slot", () => {
    let last: FormBuilderValue | undefined;
    wrap(<Harness initial={start()} onValue={(v) => { last = v; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    expect(last!.steps[0].sections).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Section" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Add section here" })[0]);
    expect(last!.steps[0].sections.map((s) => s.id)[0]).toBe("a");
    expect(last!.steps[0].sections).toHaveLength(4);
  });

  it("wizard: switch on → steps; add, select, rename, icon, reorder (drag and Alt+Arrow), move a section, delete", () => {
    let last: FormBuilderValue | undefined;
    wrap(<Harness initial={start()} onValue={(v) => { last = v; }} />);
    fireEvent.click(screen.getByRole("switch", { name: "Wizard mode" }));
    expect(last!.wizard).toBe(true);
    const steps = () => within(screen.getByRole("group", { name: "Steps" })).getAllByRole("button").filter((b) => b.hasAttribute("data-fb-step"));
    expect(steps().map((b) => b.textContent)).toEqual(["1A", "2B"]);
    expect(steps()[0].getAttribute("aria-current")).toBe("step");
    fireEvent.click(screen.getByRole("button", { name: /Add step/ }));
    expect(last!.steps).toHaveLength(3);
    expect(screen.getByText("This step has no sections yet.")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Every step needs at least one section before you can save.");
    fireEvent.change(screen.getByLabelText(/Step title/), { target: { value: "Warranty" } });
    fireEvent.click(screen.getByRole("radio", { name: "Wrench" }));
    expect(last!.steps[2]).toMatchObject({ title: "Warranty", icon: "Wrench" });
    fireEvent.keyDown(steps()[2], { key: "ArrowLeft", altKey: true });
    expect(last!.steps.map((s) => s.title)).toEqual(["A", "Warranty", "B"]);
    fireEvent.dragStart(steps()[2]);
    fireEvent.drop(steps()[0]);
    expect(last!.steps.map((s) => s.title)).toEqual(["B", "A", "Warranty"]);
    // drag a section onto a step pill → it moves to that step
    fireEvent.click(steps()[0]);
    fireEvent.dragStart(screen.getByRole("button", { name: "Reorder section: B" }));
    fireEvent.drop(steps()[2]);
    expect(last!.steps.map((s) => s.sections.map((x) => x.id))).toEqual([[], ["a"], ["b"]]);
    // delete a step with sections → move them
    fireEvent.click(steps()[2]);
    fireEvent.click(screen.getByRole("button", { name: "Delete step" }));
    fireEvent.click(screen.getByRole("button", { name: "Move sections & delete step" }));
    expect(last!.steps.map((s) => s.sections.map((x) => x.id))).toEqual([["b"], ["a"]]);
    // off again → one form, nothing lost
    fireEvent.click(screen.getByRole("switch", { name: "Wizard mode" }));
    expect(last!.wizard).toBe(false);
    expect(allFields(last!.steps).map((f) => f.id).sort()).toEqual(["n", "x", "y", "z"]);
  });

  it("advanced: Table and Display Value in the picker, 4 field columns", () => {
    wrap(<Harness initial={start()} advancedFieldTypes />);
    const headerA = document.querySelector('[data-fb-section="a"]') as HTMLElement;
    expect(within(headerA).getByRole("radio", { name: "4 field column(s)" })).toBeTruthy();
    fireEvent.click(within(document.querySelector('[data-fb-section="b"]') as HTMLElement).getByRole("button", { name: "Add field" }));
    expect(screen.getByRole("button", { name: /^Table/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Display Value/ })).toBeTruthy();
  });

  it("Arabic: chrome and titles in Arabic, Arabic title edits keep the English", () => {
    let last: FormBuilderValue | undefined;
    wrap(<Harness initial={start()} onValue={(v) => { last = v; }} />, "ar");
    fireEvent.click(screen.getByRole("button", { name: "إعادة ترتيب الحقل: X" }));
    fireEvent.change(screen.getByLabelText("عنوان الحقل"), { target: { value: "س" } });
    expect(allFields(last!.steps).find((f) => f.id === "x")).toMatchObject({ title: "X", titleAr: "س" });
    expect(screen.getByRole("switch", { name: "وضع المعالج" })).toBeTruthy();
  });

  it("works with any section shape the app persists (extra properties pass through)", () => {
    type AppSection = FormBuilderSection & { role?: string; appTag?: string };
    let last: FormBuilderValue<AppSection> | undefined;
    const initial: FormBuilderValue<AppSection> = { wizard: false, steps: [{ id: "m", title: "", sections: [{ ...newSection(), id: "q", title: "Q", appTag: "keep", fields: [fld("f", "F")] }] }] };
    function H() {
      const [v, setV] = React.useState(initial);
      return <FormBuilder<AppSection> value={v} onChange={(n) => { setV(n); last = n; }}
        renderSectionProperties={(s, upd) => <button type="button" onClick={() => upd({ role: "special" })}>app role {s.appTag}</button>} />;
    }
    wrap(<H />);
    fireEvent.click(screen.getByRole("button", { name: "Reorder section: Q" }));
    fireEvent.click(screen.getByRole("button", { name: "app role keep" }));
    expect(last!.steps[0].sections[0]).toMatchObject({ role: "special", appTag: "keep" });
  });
});

describe("TypeFormSection with the builder", () => {
  it("one wizard switch (the section's) drives the builder; the builder renders inside the Form section", () => {
    let last: FormBuilderValue | undefined;
    function H() {
      const [v, setV] = React.useState(start());
      return <TypeFormSection builder={{ value: v, onChange: (n) => { setV(n); last = n; } }} />;
    }
    wrap(<H />);
    expect(screen.getAllByRole("switch", { name: "Wizard mode" })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 2, name: "Form" })).toBeTruthy();
    expect(document.querySelector("[data-sf-form-builder]")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Wizard mode" }));
    expect(last!.wizard).toBe(true);
    expect(screen.getByRole("group", { name: "Steps" })).toBeTruthy();
  });
});

describe("independence and package surface", () => {
  it("the builder's sources import nothing outside the package", () => {
    const dir = path.resolve(__dirname, "../src/record/form-builder");
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
      for (const i of imports) expect(i === "react" || i === "lucide-react" || i.startsWith("."), `${f}: ${i}`).toBe(true);
      expect(/crm|sear_studio|senaiy|@\//i.test(src.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "")), f).toBe(false);
    }
  });
  it("exports the builder from the root entry", () => {
    for (const name of ["FormBuilder", "FieldTypePicker", "FormFieldInspector", "FormFieldPreview", "WizardToggle", "FORM_FIELD_TYPES", "newFormField", "moveField", "placeAside", "setWizard", "normalizeForm"]) {
      expect((pkg as Record<string, unknown>)[name], name).toBeTruthy();
    }
  });
});
