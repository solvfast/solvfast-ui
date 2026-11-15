/**
 * Type configuration page — the pure rules (planFieldImport / appendImportedSections / fieldImportStatus /
 * typeFormConflicts / typeFormReservedWarnings / typeSaveBlock) and the UI parts (TypeConfigPage, TypeConfigSection,
 * TypeSettingField, TypeConfigFooter, TypeWizardToggle, TypeFormIssues, TypeFieldPicker in both modes, TypeFormSection,
 * useFieldImportSummary), then a whole non-CRM type page ("Asset Type") built from them.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import type { Language } from "../src/theme/messages";
import * as pkg from "../src";
import {
  TypeConfigFooter, TypeConfigPage, TypeConfigSection, TypeFieldPicker, TypeFormIssues, TypeFormSection, TypeSettingField,
  TypeSettingsGrid, TypeWizardToggle, TypeAppearanceSection, useFieldImportSummary, appendImportedSections, fieldImportStatus,
  planFieldImport, typeFormConflicts, typeFormFields, typeFormReservedWarnings, typeSaveBlock, type TypeFieldGroup,
  type TypeFieldImport, type TypeFormLike,
} from "../src/record";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const wrap = (ui: React.ReactElement, language: Language = "en") =>
  render(<ThemeProvider defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>);

interface F { id: string; title: string; titleAr?: string; core?: boolean; type?: string }
interface S { id: string; rowId?: string; title?: string; fields: F[] }
const RESERVED = [{ en: "Name", ar: "الاسم" }, { en: "Owner", ar: "المالك" }];
let n = 0;
const ids = { newFieldId: () => `new_${++n}`, newRowId: () => `row_${++n}`, makeSection: (from: S, fields: F[], rowId: string | undefined): S => ({ id: `sec_${++n}`, title: from.title, rowId, fields }) };

describe("planFieldImport", () => {
  const current: S[] = [{ id: "s1", fields: [{ id: "c1", title: "Name", titleAr: "الاسم", core: true }, { id: "a", title: "Budget", titleAr: "الميزانية" }] }];
  const source: S[] = [
    { id: "p1", rowId: "r1", title: "Left", fields: [
      { id: "x1", title: "Owner", core: true },          // core: never copied, not counted
      { id: "x2", title: "  name " },                     // reserved (trimmed, case-insensitive)
      { id: "x3", title: "Region" },
      { id: "x4", title: "budget" },                      // already on the form
    ] },
    { id: "p2", rowId: "r1", title: "Right", fields: [{ id: "x5", title: "Other", titleAr: "الميزانية" }, { id: "x6", title: "REGION" }] }, // ar present; dup within import
    { id: "p3", title: "Empty", fields: [{ id: "x7", title: "Owner" }] }, // only a reserved field: section dropped
    { id: "p4", rowId: "r2", title: "Solo", fields: [{ id: "x8", title: "Site" }] },
  ];

  it("all: copies every eligible field, counts what it skips and why, keeps rows together with fresh ids", () => {
    const plan = planFieldImport<F, S>({ current, source, reserved: RESERVED, ...ids });
    expect(plan.added).toBe(2);
    expect(plan.skippedReserved).toBe(2);         // x2, x7
    expect(plan.skippedExisting).toBe(3);         // x4 (en), x5 (ar), x6 (taken earlier in this import)
    expect(plan.sections.map((s) => s.title)).toEqual(["Left", "Solo"]);
    const [left, solo] = plan.sections;
    expect(left.fields.map((f) => f.title)).toEqual(["Region"]);
    expect(left.fields[0].id).not.toBe("x3");     // one-time copy: never the library's id
    expect(left.rowId).toBeDefined();
    expect(left.rowId).not.toBe("r1");
    expect(solo.rowId).not.toBe(left.rowId);
  });

  it("all: sections that sat side by side share one new row id", () => {
    const plan = planFieldImport<F, S>({ current: [], source: [
      { id: "a", rowId: "r", fields: [{ id: "1", title: "A" }] }, { id: "b", rowId: "r", fields: [{ id: "2", title: "B" }] },
    ], reserved: [], ...ids });
    expect(plan.sections).toHaveLength(2);
    expect(plan.sections[0].rowId).toBe(plan.sections[1].rowId);
  });

  it("selected: copies only the picked fields; fields not picked are not counted as skipped", () => {
    const plan = planFieldImport<F, S>({ current, source, reserved: RESERVED, mode: "selected", selected: ["x8", "x2"], ...ids });
    expect(plan.added).toBe(1);
    expect(plan.skippedReserved).toBe(1);
    expect(plan.skippedExisting).toBe(0);
    expect(plan.sections.map((s) => s.fields.map((f) => f.title))).toEqual([["Site"]]);
  });

  it("selected with nothing picked adds nothing", () => {
    const plan = planFieldImport<F, S>({ current, source, reserved: RESERVED, mode: "selected", ...ids });
    expect(plan).toMatchObject({ added: 0, skippedReserved: 0, skippedExisting: 0, sections: [] });
  });
});

describe("appendImportedSections / typeFormFields", () => {
  const form: TypeFormLike<S> = { wizard: false, steps: [{ id: "a", sections: [{ id: "s1", fields: [{ id: "f1", title: "One" }] }] }, { id: "b", sections: [] }] };
  const add: S[] = [{ id: "new", fields: [{ id: "f2", title: "Two" }] }];
  it("adds to the single step, or to the last step in wizard mode", () => {
    expect(appendImportedSections(form, add).steps[0].sections.map((s) => s.id)).toEqual(["s1", "new"]);
    const w = appendImportedSections({ ...form, wizard: true }, add);
    expect(w.steps[0].sections.map((s) => s.id)).toEqual(["s1"]);
    expect(w.steps[1].sections.map((s) => s.id)).toEqual(["new"]);
  });
  it("returns the same form when there is nothing to add", () => {
    expect(appendImportedSections(form, [])).toBe(form);
  });
  it("lists every field in order", () => {
    expect(typeFormFields<F, S>(appendImportedSections(form, add)).map((f) => f.id)).toEqual(["f1", "f2"]);
  });
});

describe("fieldImportStatus", () => {
  it("says why each library field can or cannot be added", () => {
    const s = fieldImportStatus([{ id: "a", title: "Budget", titleAr: "الميزانية" }], [
      { id: "1", title: "Owner", core: true }, { id: "2", title: "owner" }, { id: "3", title: "BUDGET" },
      { id: "4", title: "X", titleAr: "الميزانية" }, { id: "5", title: "Region" },
    ], RESERVED);
    expect(Object.fromEntries(s)).toEqual({ 1: "core", 2: "reserved", 3: "present", 4: "present", 5: "available" });
  });
});

describe("typeFormConflicts / typeFormReservedWarnings", () => {
  const fields: F[] = [
    { id: "c", title: "Name", titleAr: "الاسم", core: true },
    { id: "1", title: "name" },                       // reserved
    { id: "2", title: "Region" }, { id: "3", title: " region " }, // duplicate (reported once)
    { id: "4", title: "X", titleAr: "المالك" },        // reserved (ar)
    { id: "fd_1", title: "Owner" },                   // migrated: exempt
    { id: "5", title: "" },                           // no label: ignored
  ];
  it("reports reserved and duplicate labels once each; standard and exempt fields never", () => {
    const c = typeFormConflicts(fields, RESERVED, { exempt: (f) => f.id.startsWith("fd_") });
    expect(c.map((x) => [x.reason, x.fieldId])).toEqual([["reserved", "1"], ["duplicate", "2"], ["reserved", "4"]]);
    expect(c[0].key).toBe("reserved:name");
  });
  it("without an exemption a migrated field is checked too", () => {
    expect(typeFormConflicts(fields, RESERVED).some((x) => x.fieldId === "fd_1")).toBe(true);
  });
  it("warns about every non-standard field with a standard label", () => {
    expect(typeFormReservedWarnings(fields, RESERVED).map((f) => f.id)).toEqual(["1", "4", "fd_1"]);
  });
});

describe("typeSaveBlock", () => {
  it("name, conflicts, unchanged, busy — in that order of precedence after busy", () => {
    expect(typeSaveBlock({ name: "  " })).toBe("name");
    expect(typeSaveBlock({ name: "A", conflicts: 1, requireChange: true, dirty: false })).toBe("conflicts");
    expect(typeSaveBlock({ name: "A", requireChange: true, dirty: false })).toBe("unchanged");
    expect(typeSaveBlock({ name: "A", requireChange: true, dirty: true })).toBeNull();
    expect(typeSaveBlock({ name: "A" })).toBeNull();          // a valid page may be saved unchanged by default
    expect(typeSaveBlock({ name: "A", busy: true })).toBe("busy");
  });
});

describe("TypeConfigPage and its parts", () => {
  it("one header: the app's title, no invented subtitle or description", () => {
    const onBack = vi.fn();
    const { container } = wrap(
      <TypeConfigPage title="Create Asset Type" onBack={onBack} footer={<TypeConfigFooter mode="create" onSave={() => {}} onCancel={() => {}} />}>
        <TypeConfigSection title="General Information"><span>body</span></TypeConfigSection>
      </TypeConfigPage>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Create Asset Type");
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const section = screen.getByRole("heading", { level: 2, name: "General Information" }).closest("section")!;
    expect(section.querySelectorAll("p")).toHaveLength(0);
    const header = screen.getByRole("heading", { level: 1 }).parentElement!.parentElement!;
    expect(header.querySelectorAll("p")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
  });

  it("shows a subtitle and section description only when the app passes them", () => {
    wrap(<TypeConfigPage title="Edit" subtitle="Configure settings."><TypeConfigSection title="Form" description="Design it.">x</TypeConfigSection></TypeConfigPage>);
    expect(screen.getByText("Configure settings.")).toBeTruthy();
    expect(screen.getByText("Design it.")).toBeTruthy();
  });

  it("setting field: label (required mark), manage link in a new tab, control, string and node hints", () => {
    wrap(
      <TypeSettingsGrid>
        <TypeSettingField label="SLA Policy" htmlFor="sla" required manageLink={{ href: "/sla", label: "Manage" }} hints={["Falls back to the baseline.", null, <em key="h">custom</em>]}>
          <input id="sla" />
        </TypeSettingField>
      </TypeSettingsGrid>,
    );
    expect(screen.getByLabelText("SLA Policy *")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Manage" });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("Falls back to the baseline.")).toBeTruthy();
    expect(screen.getByText("custom").tagName).toBe("EM");
  });

  it("footer: Save for edit, Create for create, disabled when blocked, Arabic words", () => {
    const onSave = vi.fn();
    wrap(<TypeConfigFooter onSave={onSave} saveDisabled />);
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    cleanup();
    wrap(<TypeConfigFooter mode="create" onSave={onSave} onCancel={() => {}} />, "ar");
    fireEvent.click(screen.getByRole("button", { name: "إنشاء" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeTruthy();
  });

  it("appearance: the package picker by default, the app's picker as children", () => {
    const onIcon = vi.fn();
    const { rerender } = wrap(<TypeAppearanceSection icon={null} color={null} onIconChange={onIcon} onColorChange={() => {}} />);
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Rocket" }));
    expect(onIcon).toHaveBeenCalledWith("Rocket");
    rerender(<ThemeProvider storageKeys={null}><TypeAppearanceSection icon={null} color={null} onIconChange={onIcon} onColorChange={() => {}}><div>app picker</div></TypeAppearanceSection></ThemeProvider>);
    expect(screen.getByText("app picker")).toBeTruthy();
  });

  it("wizard toggle reports changes and is labelled", () => {
    const onChange = vi.fn();
    wrap(<TypeWizardToggle checked={false} onCheckedChange={onChange} />);
    const sw = screen.getByRole("switch", { name: "Wizard mode" });
    expect(sw.getAttribute("aria-describedby")).toBeTruthy();
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("issues: conflicts as an alert (default or app wording, Arabic label in Arabic), warnings beside", () => {
    const conflicts = typeFormConflicts([{ id: "1", title: "Name", titleAr: "الاسم" }, { id: "2", title: "A" }, { id: "3", title: "a" }], RESERVED);
    wrap(<TypeFormIssues conflicts={conflicts} warnings={[{ key: "w", title: "Owner" }]} />);
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("“Name” already exists as a standard field. It cannot be added again.")).toBeTruthy();
    expect(within(alert).getByText("“A” is already on this form.")).toBeTruthy();
    expect(screen.getByText("Duplicates the standard field “Owner”")).toBeTruthy();
    cleanup();
    wrap(<TypeFormIssues conflicts={conflicts} renderConflict={(c, l) => `${c.reason}:${l}`} />, "ar");
    expect(screen.getByText("reserved:الاسم")).toBeTruthy();
  });

  it("issues: nothing at all when there are none", () => {
    const { container } = wrap(<TypeFormIssues />);
    expect(container.textContent).toBe("");
  });
});

const GROUPS: TypeFieldGroup[] = [
  { id: "g1", label: { en: "Warranty", ar: "الضمان" }, description: "Warranty terms", fields: [
    { id: "w1", label: "Provider", type: "Text" }, { id: "w2", label: "Ends on", type: "Date" }, { id: "w3", label: "Name", status: "reserved" },
  ] },
  { id: "g2", label: "Location", fieldCount: 9, fields: [{ id: "l1", label: "Site" }, { id: "l2", label: "Room", status: "present" }] },
];

describe("TypeFieldPicker", () => {
  it("all fields: one click takes a whole group", () => {
    const onImport = vi.fn<(c: TypeFieldImport) => void>();
    wrap(<TypeFieldPicker groups={GROUPS} onImport={onImport} />);
    expect(screen.getByRole("radio", { name: "All fields" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("9 fields")).toBeTruthy();           // fieldCount wins over fields.length
    expect(screen.getByText("Warranty terms")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Warranty/ }));
    expect(onImport).toHaveBeenCalledWith({ mode: "all", groupId: "g1" });
  });

  it("selected fields: pick across groups; unavailable fields are shown with the reason and cannot be picked", () => {
    const onImport = vi.fn<(c: TypeFieldImport) => void>();
    wrap(<TypeFieldPicker groups={GROUPS} onImport={onImport} />);
    fireEvent.click(screen.getByRole("radio", { name: "Selected fields" }));
    const add = () => screen.getByRole("button", { name: /^Add \d+ selected$/ }) as HTMLButtonElement;
    expect(add().disabled).toBe(true);
    const reserved = screen.getByRole("checkbox", { name: "Name" }) as HTMLButtonElement;
    expect(reserved.disabled).toBe(true);
    expect(screen.getByText("Standard field")).toBeTruthy();
    expect(screen.getByText("On the form")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ends on" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Site" }));
    expect(add().textContent).toBe("Add 2 selected");
    fireEvent.click(add());
    expect(onImport).toHaveBeenCalledWith({ mode: "selected", picks: [{ groupId: "g1", fieldIds: ["w2"] }, { groupId: "g2", fieldIds: ["l1"] }] });
  });

  it("selected fields: the group box picks every available field of the group (and only those)", () => {
    const onImport = vi.fn<(c: TypeFieldImport) => void>();
    wrap(<TypeFieldPicker groups={GROUPS} onImport={onImport} defaultMode="selected" />);
    const groupBox = screen.getByRole("checkbox", { name: "Select all in Warranty" });
    fireEvent.click(groupBox);
    expect(groupBox.getAttribute("data-state")).toBe("checked");
    fireEvent.click(screen.getByRole("checkbox", { name: "Provider" }));
    expect(groupBox.getAttribute("data-state")).toBe("indeterminate");
    fireEvent.click(screen.getByRole("button", { name: "Add 1 selected" }));
    expect(onImport).toHaveBeenCalledWith({ mode: "selected", picks: [{ groupId: "g1", fieldIds: ["w2"] }] });
  });

  it("selected fields: search matches field and group labels in both languages", () => {
    wrap(<TypeFieldPicker groups={GROUPS} onImport={() => {}} defaultMode="selected" />);
    const search = screen.getByRole("textbox", { name: "Search fields…" });
    fireEvent.change(search, { target: { value: "site" } });
    expect(screen.queryByRole("checkbox", { name: "Provider" })).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Site" })).toBeTruthy();
    fireEvent.change(search, { target: { value: "الضمان" } });
    expect(screen.getByRole("checkbox", { name: "Provider" })).toBeTruthy();
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No results.")).toBeTruthy();
  });

  it("one mode hides the switch; no groups says so; close button", () => {
    const onClose = vi.fn();
    const { rerender } = wrap(<TypeFieldPicker groups={GROUPS} onImport={() => {}} modes={["all"]} onClose={onClose} />);
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
    rerender(<ThemeProvider storageKeys={null}><TypeFieldPicker groups={GROUPS} onImport={() => {}} modes={["selected"]} /></ThemeProvider>);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Provider" })).toBeTruthy();
    rerender(<ThemeProvider storageKeys={null}><TypeFieldPicker groups={[]} onImport={() => {}} /></ThemeProvider>);
    expect(screen.getByText("No field groups available.")).toBeTruthy();
  });

  it("Arabic chrome and labels", () => {
    wrap(<TypeFieldPicker groups={GROUPS} onImport={() => {}} />, "ar");
    expect(screen.getByRole("radio", { name: "كل الحقول" })).toBeTruthy();
    expect(screen.getByText("الضمان")).toBeTruthy();
  });
});

describe("useFieldImportSummary", () => {
  function Probe({ plan }: { plan: { added: number; skippedReserved: number; skippedExisting: number } }) {
    const s = useFieldImportSummary()(plan);
    return <p data-tone={s.tone}>{s.text}</p>;
  }
  it("words what was added and what was skipped", () => {
    const { rerender, container } = wrap(<Probe plan={{ added: 2, skippedReserved: 1, skippedExisting: 3 }} />);
    expect(container.textContent).toBe("Added 2 fields — skipped: 1 already a standard field · 3 already on this form");
    expect(container.querySelector("p")!.getAttribute("data-tone")).toBe("success");
    rerender(<ThemeProvider storageKeys={null}><Probe plan={{ added: 1, skippedReserved: 0, skippedExisting: 0 }} /></ThemeProvider>);
    expect(container.textContent).toBe("Added 1 field");
    rerender(<ThemeProvider storageKeys={null}><Probe plan={{ added: 0, skippedReserved: 0, skippedExisting: 2 }} /></ThemeProvider>);
    expect(container.textContent).toBe("Nothing added — skipped: 2 already on this form");
    expect(container.querySelector("p")!.getAttribute("data-tone")).toBe("info");
  });
});

/** A complete type page for a non-CRM entity, as an app builds it: local state, the planner, the picker, the gate. */
function AssetTypePage({ onSaved, library = GROUP_SOURCES }: { onSaved: (v: unknown) => void; library?: Record<string, S[]> }) {
  const summary = useFieldImportSummary();
  const [name, setName] = React.useState("");
  const [form, setForm] = React.useState<TypeFormLike<S>>({ wizard: false, steps: [{ id: "main", sections: [{ id: "core", fields: [{ id: "n", title: "Name", titleAr: "الاسم", core: true }] }] }] });
  const [note, setNote] = React.useState("");
  const fields = typeFormFields<F, S>(form);
  const conflicts = typeFormConflicts(fields, RESERVED);
  const block = typeSaveBlock({ name, conflicts: conflicts.length });
  const groups: TypeFieldGroup[] = Object.entries(library).map(([id, secs]) => {
    const all = secs.flatMap((s) => s.fields);
    const status = fieldImportStatus(fields, all, RESERVED);
    return { id, label: id, fields: all.map((f) => ({ id: f.id, label: f.title, status: status.get(f.id) })) };
  });
  const onImport = (c: TypeFieldImport) => {
    const picks = c.mode === "all" ? [{ groupId: c.groupId, fieldIds: undefined }] : c.picks;
    let next = form;
    let total = { added: 0, skippedReserved: 0, skippedExisting: 0 };
    for (const p of picks) {
      const plan = planFieldImport<F, S>({ current: next.steps.flatMap((s) => s.sections), source: library[p.groupId], reserved: RESERVED, mode: c.mode, selected: p.fieldIds, ...ids });
      next = appendImportedSections(next, plan.sections);
      total = { added: total.added + plan.added, skippedReserved: total.skippedReserved + plan.skippedReserved, skippedExisting: total.skippedExisting + plan.skippedExisting };
    }
    setForm(next);
    setNote(summary(total).text);
  };
  return (
    <TypeConfigPage title="Create Asset Type" onBack={() => {}}
      footer={<TypeConfigFooter mode="create" saveDisabled={block !== null} onSave={() => onSaved({ name, form })} />}>
      <TypeConfigSection title="General Information">
        <TypeSettingField label="Asset Type Name" htmlFor="name" required><input id="name" value={name} onChange={(e) => setName(e.target.value)} /></TypeSettingField>
      </TypeConfigSection>
      <TypeFormSection wizard={{ checked: form.wizard, onCheckedChange: (on) => setForm({ ...form, wizard: on }) }}
        issues={{ conflicts }} library={{ groups, onImport }}>
        <ul aria-label="form fields">
          {fields.map((f) => (
            <li key={f.id}>
              {f.core ? f.title : <input aria-label={`title of ${f.id}`} value={f.title} onChange={(e) => setForm({ ...form, steps: form.steps.map((st) => ({ ...st, sections: st.sections.map((sec) => ({ ...sec, fields: sec.fields.map((x) => (x.id === f.id ? { ...x, title: e.target.value } : x)) })) })) })} />}
            </li>
          ))}
        </ul>
      </TypeFormSection>
      <output>{note}</output>
    </TypeConfigPage>
  );
}
const GROUP_SOURCES: Record<string, S[]> = {
  Warranty: [{ id: "w", title: "Warranty", fields: [{ id: "w1", title: "Provider" }, { id: "w2", title: "Ends on" }, { id: "w3", title: "Name" }] }],
  Location: [{ id: "l", title: "Location", fields: [{ id: "l1", title: "Site" }, { id: "l2", title: "Provider" }] }],
};

describe("a non-CRM type page (Asset Type) built from the parts", () => {
  const items = () => within(screen.getByRole("list", { name: "form fields" })).getAllByRole("listitem").map((li) => li.querySelector("input")?.value ?? li.textContent);

  it("all fields, then selected fields, with the same rules; save gated on name and conflicts", () => {
    const onSaved = vi.fn();
    wrap(<AssetTypePage onSaved={onSaved} />);
    const create = () => screen.getByRole("button", { name: "Create" }) as HTMLButtonElement;
    expect(create().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Asset Type Name *"), { target: { value: "Laptop" } });
    expect(create().disabled).toBe(false);

    // all fields from Warranty: Name is reserved
    fireEvent.click(screen.getByRole("button", { name: "Add fields from library" }));
    fireEvent.click(screen.getByRole("button", { name: /^Warranty/ }));
    expect(items()).toEqual(["Name", "Provider", "Ends on"]);
    expect(screen.getByRole("status").textContent).toBe("Added 2 fields — skipped: 1 already a standard field");
    expect(screen.queryByRole("radio")).toBeNull();            // the picker closed after the import

    // selected fields from Location: Provider is now on the form (shown, not pickable), pick Site
    fireEvent.click(screen.getByRole("button", { name: "Add fields from library" }));
    fireEvent.click(screen.getByRole("radio", { name: "Selected fields" }));
    expect((screen.getAllByRole("checkbox", { name: "Provider" }).at(-1) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Site" }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 selected" }));
    expect(items()).toEqual(["Name", "Provider", "Ends on", "Site"]);
    expect(screen.getByRole("status").textContent).toBe("Added 1 field");

    // a label clash blocks saving until it is fixed
    const site = items().indexOf("Site");
    fireEvent.change(screen.getAllByRole("textbox", { name: /^title of / })[site - 1], { target: { value: "name" } });
    expect(screen.getByRole("alert").textContent).toContain("already exists as a standard field");
    expect(create().disabled).toBe(true);
    fireEvent.change(screen.getAllByRole("textbox", { name: /^title of / })[site - 1], { target: { value: "Site" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(create());
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("the wizard switch sets the form's wizard flag", () => {
    wrap(<AssetTypePage onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("switch", { name: "Wizard mode" }));
    expect((screen.getByRole("switch", { name: "Wizard mode" }) as HTMLElement).getAttribute("aria-checked")).toBe("true");
  });
});

describe("package surface", () => {
  it("exports the type configuration parts and rules from the root entry", () => {
    for (const name of ["TypeConfigPage", "TypeConfigSection", "TypeAppearanceSection", "TypeSettingsGrid", "TypeSettingField", "TypeConfigFooter",
      "TypeWizardToggle", "TypeFormIssues", "TypeFieldPicker", "TypeFormSection", "useFieldImportSummary", "planFieldImport",
      "appendImportedSections", "fieldImportStatus", "typeFormConflicts", "typeFormReservedWarnings", "typeFormFields", "typeSaveBlock", "normLabel"]) {
      expect(typeof (pkg as Record<string, unknown>)[name], name).toBe("function");
    }
  });
});
