/**
 * Form builder — the form model a type's form is designed in, and every builder operation as a pure function.
 *
 *   Form { wizard, steps }
 *    └─ Step          (shown only in wizard mode; with wizard off there is one implicit step)
 *        └─ Section   (1–4 field columns; sections sharing a `rowId` sit side by side, up to 3 per row)
 *            └─ Field (in a logical column — never left/right, so RTL mirrors)
 *
 * The shape is the one the SOLV FAST Field Library / CRM type forms persist (a stored form loads unchanged). Toggling
 * wizard never destroys sections or fields. A `core` field is an entity's standard field: it may be placed anywhere but
 * never removed, made optional or re-typed (`lockCore`). UI: `FormBuilder.tsx`. docs/components/form-builder.md
 */

/** Every field type the builder knows (the registry in `fieldTypes.ts` describes each). */
export type FormFieldTypeKey =
  | "text" | "long_text" | "rich_text"
  | "dropdown" | "multi_select" | "radio" | "checkbox" | "rating" | "color"
  | "number" | "decimal" | "currency" | "percent" | "duration"
  | "date" | "datetime" | "time"
  | "email" | "phone"
  | "file_upload" | "image_upload" | "signature"
  | "record_link" | "map_location" | "barcode"
  | "heading"
  | "table" | "display_value";

export interface FormFieldOption {
  id: string;
  label: string;
  labelAr?: string;
  /** Stored value when distinct from the label. */
  value?: string;
}
/** A field's logical column inside its section. */
export type FieldCol = 1 | 2 | 3 | 4;
/** Where a Table field's rows come from: the user adds them, or a named source fills them. */
export type RowsFrom = "user" | { source: string };

export interface TableColumn {
  id: string;
  title: string;
  titleAr?: string;
  type: FormFieldTypeKey;
  /** `derived`: filled from a source (read-only); `entered` (default): the user types it. */
  kind?: "derived" | "entered";
  /** The source a derived column is bound to. */
  sourceId?: string;
  options?: FormFieldOption[];
  /** A live option list (source id) for a choice column. */
  optionsFrom?: string;
  /** A nested table's columns (one level). */
  columns?: TableColumn[];
}
/** "Limit the records shown" on a record link: `field operator value`. */
export interface FieldFilterRule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export interface FormBuilderField {
  id: string;
  type: FormFieldTypeKey;
  title: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  required: boolean;
  options?: FormFieldOption[];
  allowedFileTypes?: string[];
  placeholder?: string;
  /** Multi-select defaults are joined with `||`; a checkbox's is "true" / "false". */
  defaultValue?: string;
  linkTarget?: string;
  linkFilters?: FieldFilterRule[];
  unique?: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  pattern?: string;
  patternMessage?: string;
  patternMessageAr?: string;
  /** Conditions, as written (they may name other fields on the form). */
  showWhen?: string;
  requiredWhen?: string;
  readOnlyWhen?: string;
  /** Auto-fill: a record-link field on this form, and the field of the linked record to copy. */
  fetchFromField?: string;
  fetchFromSource?: string;
  fetchOnlyWhenEmpty?: boolean;
  inListView?: boolean;
  hideInPrint?: boolean;
  editableWhenClosed?: boolean;
  standardFilter?: boolean;
  globalSearch?: boolean;
  bold?: boolean;
  hidden?: boolean;
  readOnly?: boolean;
  translatable?: boolean;
  column?: FieldCol;
  /** Spans every column of its section. */
  fullWidth?: boolean;
  /** The entity's standard field (locked). */
  core?: boolean;
  columns?: TableColumn[];
  rowsFrom?: RowsFrom;
  /** The source a Display Value shows. */
  sourceId?: string;
  /** A live option list (source id) for a choice field. */
  optionsFrom?: string;
  renderAs?: "cards";
}

export interface FormBuilderSection<F extends FormBuilderField = FormBuilderField> {
  id: string;
  title?: string;
  titleAr?: string;
  description?: string;
  descriptionAr?: string;
  /** An app's renderer hint (e.g. a specially treated section); the builder only stores it. */
  role?: string;
  columns: FieldCol;
  rowId?: string;
  collapsible?: boolean;
  startCollapsed?: boolean;
  /** A section that cannot be deleted (its shell may still be renamed and re-laid-out). */
  system?: boolean;
  fields: F[];
}
export interface FormBuilderStep<S extends FormBuilderSection = FormBuilderSection> {
  id: string;
  title: string;
  titleAr?: string;
  description?: string;
  /** A Lucide icon name shown on the step. */
  icon?: string;
  /** A condition under which the step is shown (stored; evaluated by the form renderer). */
  showWhen?: string;
  sections: S[];
}
/** A form as designed: `wizard` off → one implicit step whose sections render in order. */
export interface FormBuilderValue<S extends FormBuilderSection = FormBuilderSection> {
  wizard: boolean;
  steps: FormBuilderStep<S>[];
}

// ── ids ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
let n = 0;
/** A new unique id with a prefix (`fld_…`, `sec_…`, `row_…`, `step_…`, `opt_…`, `col_…`, `flt_…`). */
export const formBuilderId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const newRowId = () => formBuilderId("row");

// ── constructors ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Types that span every column by default. */
export const FULL_WIDTH_TYPES: readonly FormFieldTypeKey[] = ["long_text", "rich_text", "map_location", "signature", "table"];

export const newSection = <S extends FormBuilderSection = FormBuilderSection>(patch: Partial<S> = {}): S =>
  ({ id: formBuilderId("sec"), rowId: newRowId(), columns: 1, collapsible: false, startCollapsed: false, fields: [], ...patch }) as unknown as S;
export const newStep = <S extends FormBuilderSection = FormBuilderSection>(patch: Partial<FormBuilderStep<S>> = {}): FormBuilderStep<S> =>
  ({ id: formBuilderId("step"), title: "", sections: [], ...patch });
export const newTableColumn = (type: FormFieldTypeKey = "text"): TableColumn => ({ id: formBuilderId("col"), title: "", type, kind: "entered" });
export const newOption = (label: string): FormFieldOption => ({ id: formBuilderId("opt"), label });

/** A new field of a type, with the type's defaults (choices get two options, uploads their file types, a table two
 *  user-entered text columns; long / rich text, map, signature and table span the section). */
export function newFormField(type: FormFieldTypeKey): FormBuilderField {
  const f: FormBuilderField = { id: formBuilderId("fld"), type, title: "", description: "", required: false, column: 1, fullWidth: FULL_WIDTH_TYPES.includes(type) };
  if (type === "dropdown" || type === "multi_select" || type === "radio") f.options = [newOption("Option 1"), newOption("Option 2")];
  if (type === "file_upload") f.allowedFileTypes = ["PDF", "PNG", "JPG"];
  if (type === "image_upload") f.allowedFileTypes = ["PNG", "JPG"];
  if (type === "table") {
    f.rowsFrom = "user";
    f.columns = [{ ...newTableColumn("text"), title: "Column 1" }, { ...newTableColumn("text"), title: "Column 2" }];
    f.fullWidth = true;
  }
  return f;
}
/** A field placed in a section: normalises its column and full-width hints. */
export const placeField = <F extends FormBuilderField>(f: F, column: FieldCol = 1): F =>
  ({ ...f, column: f.column ?? column, fullWidth: f.fullWidth ?? FULL_WIDTH_TYPES.includes(f.type) });

// ── reading ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const allSections = <S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[]): S[] => steps.flatMap((s) => s.sections);
export const allFields = <S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[]): S["fields"][number][] =>
  allSections(steps).flatMap((s) => s.fields);
export const findField = <S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string) => allFields(steps).find((f) => f.id === id);
export const findSection = <S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string) => allSections(steps).find((s) => s.id === id);
export const sectionOfField = <S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], fieldId: string) =>
  allSections(steps).find((s) => s.fields.some((f) => f.id === fieldId));
export const stepOfSection = <S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], sectionId: string) =>
  steps.find((st) => st.sections.some((s) => s.id === sectionId));

/** Consecutive sections sharing a `rowId` form one visual row. */
export function rowGroups<S extends FormBuilderSection>(sections: readonly S[]): S[][] {
  const rows: S[][] = [];
  for (const s of sections) {
    const last = rows[rows.length - 1];
    if (last && last[0].rowId && last[0].rowId === s.rowId) last.push(s);
    else rows.push([s]);
  }
  return rows;
}
/** How many sections share `sectionId`'s row. */
export function rowCountOf(sections: readonly FormBuilderSection[], sectionId: string): number {
  return rowGroups(sections).find((r) => r.some((s) => s.id === sectionId))?.length ?? 1;
}
/** The most field columns a section may have given its row's size (1 alone → 4, 2 → 2, 3 → 1). */
export const maxFieldCols = (rowCount: number): FieldCol => (rowCount >= 3 ? 1 : rowCount === 2 ? 2 : 4);
/** Steps with no section (a wizard step needs at least one before the form is saved). */
export const emptySteps = <S extends FormBuilderSection>(value: FormBuilderValue<S>) => (value.wizard ? value.steps.filter((s) => s.sections.length === 0) : []);

const clampCols = (c: number): FieldCol => (c >= 4 ? 4 : c === 3 ? 3 : c === 2 ? 2 : 1);

/** Normalise a stored form: every section gets a row, every field its column hints, and field columns are capped by
 *  the row's width. A legacy flat field list becomes one section titled with the record's name. */
export function normalizeForm<S extends FormBuilderSection = FormBuilderSection>(input: {
  name?: string; nameAr?: string; fields?: S["fields"]; wizard?: boolean; steps?: FormBuilderStep<S>[];
}): FormBuilderValue<S> {
  if (input.steps && input.steps.length) {
    const steps = input.steps.map((st) => {
      const withRows = st.sections.map((sec) => ({ ...sec, rowId: sec.rowId ?? newRowId(), fields: sec.fields.map((f) => placeField(f, f.column ?? 1)) }));
      const sections = withRows.map((sec) => ({ ...sec, columns: Math.min(clampCols(sec.columns), maxFieldCols(rowCountOf(withRows, sec.id))) as FieldCol }));
      return { ...st, sections };
    });
    return { wizard: !!input.wizard, steps };
  }
  const section = newSection<S>({ title: input.name, titleAr: input.nameAr, columns: 1, fields: (input.fields ?? []).map((f) => placeField(f, 1)) } as Partial<S>);
  return { wizard: false, steps: [newStep<S>({ title: input.name ?? "", titleAr: input.nameAr, sections: [section] })] };
}

// ── wizard ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Wizard ON: every section becomes its own step (titled like the section). */
export function enableWizard<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[]): FormBuilderStep<S>[] {
  const sections = allSections(steps);
  if (!sections.length) return [newStep<S>({ title: "" })];
  return sections.map((sec) => newStep<S>({ title: sec.title || "", titleAr: sec.titleAr, sections: [sec] }));
}
/** Wizard OFF: every step collapses into one implicit step; sections keep their order. Nothing is lost. */
export function disableWizard<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[]): FormBuilderStep<S>[] {
  return [newStep<S>({ id: "main", title: "", sections: allSections(steps) })];
}
export function setWizard<S extends FormBuilderSection>(value: FormBuilderValue<S>, on: boolean): FormBuilderValue<S> {
  if (on === value.wizard) return value;
  return { ...value, wizard: on, steps: on ? enableWizard(value.steps) : disableWizard(value.steps) };
}

// ── steps ───────────────────────────────────────────────────────────────────────────────────────────────────────────
export function addStep<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], patch: Partial<FormBuilderStep<S>> = {}) {
  const step = newStep<S>({ title: "", ...patch });
  return { steps: [...steps, step], step };
}
export const updateStep = <S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, patch: Partial<FormBuilderStep<S>>) =>
  steps.map((s) => (s.id === id ? { ...s, ...patch } : s));
/** Move step `id` to where `beforeId` is. */
export function reorderStep<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, beforeId: string): FormBuilderStep<S>[] {
  const from = steps.findIndex((s) => s.id === id);
  const to = steps.findIndex((s) => s.id === beforeId);
  if (from < 0 || to < 0 || from === to) return [...steps];
  const next = [...steps];
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}
/**
 * Delete a step (never the last one). `move`: its sections go to the end of `targetId`. `with-sections`: they go,
 * except standard (`core`) fields, which are rescued into the last section of the first step that has one (or a new
 * section on the first step).
 */
export function removeStep<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, mode: "move" | "with-sections", targetId?: string): FormBuilderStep<S>[] {
  if (steps.length <= 1) return [...steps];
  const moving = steps.find((s) => s.id === id);
  if (!moving) return [...steps];
  let next = steps.filter((s) => s.id !== id);
  if (mode === "move" && targetId && moving.sections.length) {
    return next.map((s) => (s.id === targetId ? { ...s, sections: [...s.sections, ...moving.sections] } : s));
  }
  const rescue = moving.sections.flatMap((sec) => sec.fields.filter((f) => f.core));
  if (!rescue.length) return next;
  const toCol1 = rescue.map((f) => ({ ...f, column: 1 as const }));
  const host = next.find((s) => s.sections.length > 0);
  if (host) {
    const lastId = host.sections[host.sections.length - 1].id;
    next = next.map((s) => (s.id === host.id ? { ...s, sections: s.sections.map((sec) => (sec.id === lastId ? { ...sec, fields: [...sec.fields, ...toCol1] } : sec)) } : s));
  } else {
    next = next.map((s, i) => (i === 0 ? { ...s, sections: [...s.sections, newSection<S>({ columns: 1, fields: toCol1 } as Partial<S>)] } : s));
  }
  return next;
}

// ── sections ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Add a new one-column section to a step: at the end, or right after `afterId`. */
export function addSection<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], stepId: string, afterId?: string) {
  const section = newSection<S>({ columns: 1 } as Partial<S>);
  const next = steps.map((st) => {
    if (st.id !== stepId) return st;
    if (!afterId) return { ...st, sections: [...st.sections, section] };
    const i = st.sections.findIndex((s) => s.id === afterId);
    const sections = [...st.sections];
    sections.splice(i + 1, 0, section);
    return { ...st, sections };
  });
  return { steps: next, section };
}
export const updateSection = <S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, patch: Partial<S>) =>
  steps.map((st) => ({ ...st, sections: st.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

/** Change a section's field columns (1–4), keeping every field: 1 merges the columns in order; fewer clamps fields to
 *  the last column; more leaves fields where they are. */
export function setSectionColumns<S extends FormBuilderSection>(sec: S, columns: FieldCol): S {
  if (columns === sec.columns) return sec;
  if (columns === 1) {
    const ordered = ([1, 2, 3, 4] as const).flatMap((c) => sec.fields.filter((f) => (f.column ?? 1) === c));
    return { ...sec, columns: 1, fields: ordered.map((f) => ({ ...f, column: 1 as const })) };
  }
  return { ...sec, columns, fields: sec.fields.map((f) => ({ ...f, column: Math.min(f.column ?? 1, columns) as FieldCol })) };
}

/**
 * Delete a section (not a `system` one). `move`: all its fields go to `targetId` (column 1). `with-fields`: its fields
 * go, except standard ones, which are rescued into `targetId` or the first remaining section; when no section remains
 * the section is kept with only its standard fields.
 */
export function deleteSection<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, mode: "move" | "with-fields", targetId?: string): FormBuilderStep<S>[] {
  const sec = findSection(steps, id);
  if (!sec || sec.system) return [...steps];
  const rescue = sec.fields.filter((f) => f.core);
  const carry = mode === "move" ? sec.fields : rescue;
  let next = steps.map((st) => ({ ...st, sections: st.sections.filter((s) => s.id !== id) }));
  if (!carry.length) return next;
  const dest = (mode === "move" ? targetId : undefined) || allSections(next)[0]?.id;
  if (dest) {
    next = next.map((st) => ({ ...st, sections: st.sections.map((s) => (s.id === dest ? { ...s, fields: [...s.fields, ...carry.map((f) => ({ ...f, column: 1 as const }))] } : s)) }));
    return next;
  }
  return steps.map((st) => ({ ...st, sections: st.sections.map((s) => (s.id === id ? { ...s, fields: rescue } : s)) }));
}

/** Move a section to a step, as its own full-width row (a new `rowId`): before `beforeId`, or at the end. */
export function moveSection<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, toStepId: string, beforeId?: string): FormBuilderStep<S>[] {
  const found = findSection(steps, id);
  if (!found) return [...steps];
  const moving = { ...found, rowId: newRowId() };
  return steps.map((st) => {
    let sections = st.sections.filter((s) => s.id !== id);
    if (st.id === toStepId) {
      const i = beforeId ? sections.findIndex((s) => s.id === beforeId) : -1;
      sections = i < 0 ? [...sections, moving] : [...sections.slice(0, i), moving, ...sections.slice(i)];
    }
    return { ...st, sections };
  });
}

/** Put a section beside `targetId` (`start` / `end` side): it joins the target's row and every section of the row is
 *  capped to the row's column limit. A full row (3) refuses a fourth: the section is stacked before the target instead. */
export function placeAside<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, targetId: string, side: "start" | "end"): FormBuilderStep<S>[] {
  if (id === targetId) return [...steps];
  const target = findSection(steps, targetId);
  const found = findSection(steps, id);
  const step = stepOfSection(steps, targetId);
  if (!target || !found || !step) return [...steps];
  const count = rowCountOf(step.sections, targetId);
  if (count >= 3) return moveSection(steps, id, step.id, targetId);
  const rowId = target.rowId ?? newRowId();
  const cap = maxFieldCols(count + 1);
  const moving = { ...setSectionColumns(found, Math.min(found.columns, cap) as FieldCol), rowId };
  return steps.map((st) => {
    let sections = st.sections.filter((s) => s.id !== id);
    if (st.id === step.id) {
      sections = sections.map((s) => (s.id === targetId ? { ...s, rowId } : s));
      const i = sections.findIndex((s) => s.id === targetId);
      const at = side === "end" ? i + 1 : i;
      sections = [...sections.slice(0, at), moving, ...sections.slice(at)];
      sections = sections.map((s) => (s.rowId === rowId ? setSectionColumns(s, Math.min(s.columns, cap) as FieldCol) : s));
    }
    return { ...st, sections };
  });
}

// ── fields ──────────────────────────────────────────────────────────────────────────────────────────────────────────
export function addField<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], sectionId: string, column: FieldCol, field: S["fields"][number]) {
  const placed = placeField(field, column);
  return steps.map((st) => ({ ...st, sections: st.sections.map((s) => (s.id === sectionId ? { ...s, fields: [...s.fields, placed] } : s)) }));
}
/** Remove a field. A standard (`core`) field is never removed. */
export const removeField = <S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string) =>
  findField(steps, id)?.core ? [...steps] : steps.map((st) => ({ ...st, sections: st.sections.map((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== id) })) }));

/** Change a field. A standard field can never be made optional; with `lockCore` its type, title and options never
 *  change either (only its layout and other hints). */
export function updateField<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, patch: Partial<S["fields"][number]>, lockCore = false): FormBuilderStep<S>[] {
  const cur = findField(steps, id);
  let safe: Partial<FormBuilderField> = cur?.core && patch.required === false ? { ...patch, required: true } : { ...patch };
  if (lockCore && cur?.core) {
    const { type: _t, title: _ti, titleAr: _ta, options: _o, ...rest } = safe;
    safe = rest;
  }
  return steps.map((st) => ({ ...st, sections: st.sections.map((s) => ({ ...s, fields: s.fields.map((f) => (f.id === id ? { ...f, ...safe } : f)) })) }));
}

/** Move a field (standard ones too) into a section and column: before `beforeId`, or at the end. */
export function moveField<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, toSectionId: string, column: FieldCol, beforeId?: string): FormBuilderStep<S>[] {
  const moving = findField(steps, id);
  if (!moving || id === beforeId) return [...steps];
  return steps.map((st) => ({
    ...st,
    sections: st.sections.map((s) => {
      let fields = s.fields.filter((f) => f.id !== id);
      if (s.id === toSectionId) {
        const placed = { ...moving, column };
        const i = beforeId ? fields.findIndex((f) => f.id === beforeId) : -1;
        fields = i < 0 ? [...fields, placed] : [...fields.slice(0, i), placed, ...fields.slice(i)];
      }
      return { ...s, fields };
    }),
  }));
}
/** Swap a field with its neighbour in its section's order (keyboard reorder). */
export function nudgeField<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, delta: -1 | 1): FormBuilderStep<S>[] {
  const sec = sectionOfField(steps, id);
  if (!sec) return [...steps];
  const i = sec.fields.findIndex((f) => f.id === id);
  const j = i + delta;
  if (j < 0 || j >= sec.fields.length) return [...steps];
  const fields = [...sec.fields];
  [fields[i], fields[j]] = [fields[j], fields[i]];
  return updateSection(steps, sec.id, { fields } as Partial<S>);
}
/** Swap a section with its neighbour in its step (keyboard reorder; it keeps its row). */
export function nudgeSection<S extends FormBuilderSection>(steps: readonly FormBuilderStep<S>[], id: string, delta: -1 | 1): FormBuilderStep<S>[] {
  return steps.map((st) => {
    const i = st.sections.findIndex((s) => s.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= st.sections.length) return st;
    const sections = [...st.sections];
    [sections[i], sections[j]] = [sections[j], sections[i]];
    return { ...st, sections };
  });
}
