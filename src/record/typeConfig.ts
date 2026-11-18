/**
 * Type configuration — the rules behind a "type" page (Lead Type, Deal Type, Task Type, Asset Type…): which fields a
 * type's form may take from a field library, which labels clash, and when the page may be saved. Pure functions over
 * structural types: an app's own form model (steps → sections → fields) fits as long as it has these properties.
 * UI: `TypeConfig.tsx`. docs/components/type-config.md
 */

/** A field on a type's form. `core`: the record's own (standard) field — locked, never imported, never a conflict. */
export interface TypeFormFieldLike {
  id: string;
  title?: string;
  titleAr?: string;
  core?: boolean;
}
/** A section of a type's form. Sections sharing a `rowId` sit side by side. */
export interface TypeFormSectionLike<F extends TypeFormFieldLike = TypeFormFieldLike> {
  id: string;
  rowId?: string;
  fields: F[];
}
export interface TypeFormStepLike<S> {
  id: string;
  sections: S[];
}
/** A type's form: one implicit step, or (wizard) ordered steps. */
export interface TypeFormLike<S> {
  wizard: boolean;
  steps: TypeFormStepLike<S>[];
}
/** A label the form may not take again (a standard field's), in both languages. */
export interface ReservedLabel {
  en: string;
  ar?: string;
}

/** Labels compare trimmed and case-insensitive. */
export const normLabel = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

const isReservedField = (f: TypeFormFieldLike, reserved: readonly ReservedLabel[]) =>
  reserved.some((r) => (!!f.title && normLabel(r.en) === normLabel(f.title)) || (!!f.titleAr && !!r.ar && normLabel(r.ar) === normLabel(f.titleAr)));

/** Every field on the form, in order. */
export const typeFormFields = <F extends TypeFormFieldLike, S extends TypeFormSectionLike<F>>(form: TypeFormLike<S>): F[] =>
  form.steps.flatMap((st) => st.sections.flatMap((sec) => sec.fields));

// ── field selection ─────────────────────────────────────────────────────────────────────────────────────────────────

/** How fields are taken from a library group: every field it has, or only the ones picked. */
export type FieldImportMode = "all" | "selected";
/** Why a library field can or cannot be added: `available`; `present` (a field with that label is on the form);
 *  `reserved` (a standard field has that label); `core` (it is a standard field itself). */
export type FieldImportStatus = "available" | "present" | "reserved" | "core";

/** Whether each library field can be added to a form that already holds `current`. Same rules as `planFieldImport`. */
export function fieldImportStatus<F extends TypeFormFieldLike>(
  current: readonly TypeFormFieldLike[],
  candidates: readonly F[],
  reserved: readonly ReservedLabel[],
): Map<string, FieldImportStatus> {
  const seen = new Set<string>();
  for (const f of current) {
    if (f.title) seen.add(normLabel(f.title));
    if (f.titleAr) seen.add(normLabel(f.titleAr));
  }
  const out = new Map<string, FieldImportStatus>();
  for (const f of candidates) {
    if (f.core) out.set(f.id, "core");
    else if (isReservedField(f, reserved)) out.set(f.id, "reserved");
    else {
      const en = normLabel(f.title);
      const ar = f.titleAr ? normLabel(f.titleAr) : "";
      out.set(f.id, seen.has(en) || (!!ar && seen.has(ar)) ? "present" : "available");
    }
  }
  return out;
}

export interface FieldImportPlan<S> {
  /** The new sections to add (fields re-identified, side-by-side rows kept together, empty sections dropped). */
  sections: S[];
  /** Fields added. */
  added: number;
  /** Fields left out because a standard field has their label. */
  skippedReserved: number;
  /** Fields left out because a field with their label is already on the form (or earlier in this import). */
  skippedExisting: number;
}

export interface PlanFieldImportArgs<F extends TypeFormFieldLike, S extends TypeFormSectionLike<F>> {
  /** The form's sections now. */
  current: readonly S[];
  /** The library group's sections (one or several groups, in order). */
  source: readonly S[];
  /** The standard fields' labels. */
  reserved: readonly ReservedLabel[];
  /** `"all"` (default): every field of `source`. `"selected"`: only the ids in `selected`. */
  mode?: FieldImportMode;
  selected?: Iterable<string>;
  /** A new id for a copied field (an import is a one-time copy: ids are never shared with the library). */
  newFieldId: (field: F) => string;
  newRowId: () => string;
  /** The new section holding `fields`, from its library section (`rowId` set when the library section had one). */
  makeSection: (from: S, fields: F[], rowId: string | undefined) => S;
}

/**
 * Plan copying library fields onto a type's form. Standard (`core`) fields are never copied; a field whose label a
 * standard field has, or a field already on the form has (English or Arabic, trimmed, case-insensitive), is skipped
 * and counted; a label is taken once per import. Library sections that end up empty are dropped, and sections that
 * sat side by side stay side by side (a fresh shared `rowId`).
 */
export function planFieldImport<F extends TypeFormFieldLike, S extends TypeFormSectionLike<F>>(args: PlanFieldImportArgs<F, S>): FieldImportPlan<S> {
  const { current, source, reserved, mode = "all", newFieldId, newRowId, makeSection } = args;
  const only = mode === "selected" ? new Set(args.selected ?? []) : null;
  const seen = new Set<string>();
  current.forEach((sec) => sec.fields.forEach((f) => {
    if (f.title) seen.add(normLabel(f.title));
    if (f.titleAr) seen.add(normLabel(f.titleAr));
  }));
  let added = 0, skippedReserved = 0, skippedExisting = 0;
  const rows = new Map<string, string>();
  const sections: S[] = [];
  for (const sec of source) {
    const fields: F[] = [];
    for (const f of sec.fields) {
      if (only && !only.has(f.id)) continue;
      if (f.core) continue;
      if (isReservedField(f, reserved)) { skippedReserved++; continue; }
      const en = normLabel(f.title);
      const ar = f.titleAr ? normLabel(f.titleAr) : "";
      if (seen.has(en) || (ar && seen.has(ar))) { skippedExisting++; continue; }
      seen.add(en);
      if (ar) seen.add(ar);
      added++;
      fields.push({ ...f, id: newFieldId(f) });
    }
    if (!fields.length) continue;
    let rowId: string | undefined;
    if (sec.rowId) {
      rowId = rows.get(sec.rowId);
      if (!rowId) { rowId = newRowId(); rows.set(sec.rowId, rowId); }
    }
    sections.push(makeSection(sec, fields, rowId));
  }
  return { sections, added, skippedReserved, skippedExisting };
}

/** Add imported sections to the form: at the end of the last step in wizard mode, of the single step otherwise. */
export function appendImportedSections<T extends TypeFormLike<unknown>>(form: T, sections: readonly T["steps"][number]["sections"][number][]): T {
  if (!sections.length || !form.steps.length) return form;
  const target = form.wizard ? form.steps.length - 1 : 0;
  return { ...form, steps: form.steps.map((st, i) => (i === target ? { ...st, sections: [...st.sections, ...sections] } : st)) };
}

// ── validation ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TypeFieldConflict {
  /** Stable key (one entry per reason and label). */
  key: string;
  /** `reserved`: a standard field has the label. `duplicate`: another field on the form has it. */
  reason: "reserved" | "duplicate";
  fieldId: string;
  title: string;
  titleAr?: string;
}

/**
 * Labels that block saving: a field added on this form whose label a standard field has, or another field on the form
 * has. Standard fields are never reported; `exempt` leaves out fields the app accepts as they are (e.g. migrated ones).
 */
export function typeFormConflicts<F extends TypeFormFieldLike>(
  fields: readonly F[],
  reserved: readonly ReservedLabel[],
  options: { exempt?: (field: F) => boolean } = {},
): TypeFieldConflict[] {
  const seen = new Set<string>();
  const out: TypeFieldConflict[] = [];
  for (const f of fields) {
    if (f.core || options.exempt?.(f)) continue;
    const en = normLabel(f.title);
    const ar = f.titleAr ? normLabel(f.titleAr) : "";
    if (!en && !ar) continue;
    const reservedHit = reserved.some((r) => (!!en && normLabel(r.en) === en) || (!!ar && !!r.ar && normLabel(r.ar) === ar));
    const dupHit = fields.some((o) => o.id !== f.id && ((!!en && normLabel(o.title) === en) || (!!ar && !!o.titleAr && normLabel(o.titleAr) === ar)));
    if (!reservedHit && !dupHit) continue;
    const reason = reservedHit ? "reserved" : "duplicate";
    const key = `${reason}:${en || ar}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, reason, fieldId: f.id, title: f.title ?? "", titleAr: f.titleAr });
  }
  return out;
}

/** Every non-standard field whose label a standard field has, once each — a non-blocking warning (meant for fields
 *  carried over from older data, which `typeFormConflicts` exempts; fields added here are also reported there). */
export function typeFormReservedWarnings<F extends TypeFormFieldLike>(fields: readonly F[], reserved: readonly ReservedLabel[]): F[] {
  const out: F[] = [];
  const taken = new Set<string>();
  for (const f of fields) {
    if (f.core || taken.has(f.id)) continue;
    if (isReservedField(f, reserved)) { taken.add(f.id); out.push(f); }
  }
  return out;
}

/** Why a type page cannot be saved now, or `null`. */
export type TypeSaveBlock = "name" | "unchanged" | "conflicts" | "busy";
export interface TypeSaveState {
  /** The name in the language being edited. */
  name: string;
  /** Whether anything changed since it was loaded. */
  dirty?: boolean;
  /** Only a changed page may be saved (default false: a valid page may always be saved). */
  requireChange?: boolean;
  /** Blocking label conflicts on the form (`typeFormConflicts(...).length`). */
  conflicts?: number;
  /** A save is running. */
  busy?: boolean;
}
export function typeSaveBlock(s: TypeSaveState): TypeSaveBlock | null {
  if (s.busy) return "busy";
  if (!s.name.trim()) return "name";
  if ((s.conflicts ?? 0) > 0) return "conflicts";
  if (s.requireChange && !s.dirty) return "unchanged";
  return null;
}
