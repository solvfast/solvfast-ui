// Sayr's FieldDesigner adapter: a type's Form section over Sayr's Field Library (sear_product), the one place in the
// package that calls Sayr's own methods. A type's form is a `Sear Field Deployment` named after its DocType — saving it
// deploys it. Its rows place fields of field sets (linked to their set, as Sayr Studio's deploy does) and the form's own
// fields, whose definitions it keeps in `own_fields` (a field set's field schema, no set created). A family type's
// whole order (its shared fields included) is its `field_order` (`save_field_order`).
import type { FrappeApi } from "../frappe/client";
import type { DesignerFieldSet, DesignerRemoval, DesignerSetField, DesignerState, FieldDesignerAdapter } from "../record/FieldDesigner";
import { kindOfFieldtype, type DesignerItem } from "../record/fieldLayout";
import { ownKeys, type FieldDefinition, type FieldTypeProperty, type FieldTypeRegistry } from "../record/fieldDefinition";

const METHODS = "sear_product.apis.field_library.deployments";
const FIELD_SETS = "sear_product.apis.field_library.field_sets";
const DEPLOYMENT = "Sear Field Deployment";
const FIELD_SET = "Sear Field Preset";
const BREAK_TYPES = new Set(["section_break", "column_break", "tab_break"]);

type RowKind = "field" | "section" | "tab";
interface DeploymentRow {
  field_preset: string | null;
  field_key: string | null;
  row_kind: RowKind;
  label?: string | null;
  insert_after?: string | null;
  fieldname?: string | null;
  overrides?: unknown;
}
/** A field's definition as Sayr stores it (`Sear Field Preset Field`). */
export type SayrFieldRow = Record<string, unknown> & { field_key: string; field_type: string; label_en: string };
interface Screen {
  refusal: string | null;
  deployment: null | { name: string; status: string; fields: DeploymentRow[]; own_fields?: SayrFieldRow[] };
  family: null | { role: "child" | "parent"; shared?: string[] };
  target_fields: { fieldname: string; label?: string; fieldtype: string }[];
}
interface Registry {
  types: { key: string; label_en: string; label_ar: string; group: string; props: FieldTypeProperty[] }[];
  groups: { group: string; types: string[] }[];
  data_subtypes: string[];
}

export type SayrApi = Pick<FrappeApi, "call" | "getList">;
export interface SayrFieldDesignerOptions { language?: "en" | "ar" }

/** `@tab::<label>`, `@section::<label>`, `@own::<key>`, `@<set>::__section`, `@<set>::<key>`: how Sayr names a row
 *  before it has a column. */
export const sayrToken = (row: Pick<DeploymentRow, "row_kind" | "label" | "field_preset" | "field_key">) =>
  row.row_kind === "tab" ? `@tab::${(row.label ?? "").trim()}`
    : !row.field_preset ? (row.row_kind === "section" ? `@section::${(row.label ?? "").trim()}` : `@own::${row.field_key}`)
    : `@${row.field_preset}::${row.row_kind === "section" ? "__section" : row.field_key}`;
const idOf = (row: DeploymentRow) => row.fieldname || sayrToken(row);

function rowOfToken(id: string): DeploymentRow | null {
  const m = /^@(.+?)::(.+)$/.exec(id);
  if (!m) return null;
  return m[2] === "__section"
    ? { field_preset: m[1], field_key: null, row_kind: "section" }
    : { field_preset: m[1], field_key: m[2], row_kind: "field" };
}

const bit = (v: unknown) => (v ? 1 : 0);
const parse = <T,>(v: unknown): T | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") return v as T;
  try { return JSON.parse(v) as T; } catch { return undefined; }
};
const str = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : String(v));
const num = (v: unknown) => (v === undefined || v === null || v === "" || Number(v) === 0 ? undefined : Number(v));

/** Sayr's row → the designer's definition. */
export function definitionOfRow(row: SayrFieldRow): FieldDefinition {
  const choices = parse<{ value_en: string; value_ar?: string }[]>(row.choices);
  return {
    key: row.field_key, type: row.field_type, label: row.label_en ?? "", labelAr: str(row.label_ar),
    description: str(row.description), placeholder: str(row.placeholder), defaultValue: str(row.default_value),
    required: !!row.reqd, choices: choices?.map((c) => ({ en: c.value_en, ar: c.value_ar || undefined })),
    linkTarget: str(row.link_target), linkFilters: parse(row.link_filters),
    dataSubtype: str(row.data_subtype), maxRating: num(row.max_rating), precision: str(row.precision),
    nonNegative: !!row.non_negative, unique: !!row.is_unique, maxLength: num(row.max_length),
    minValue: num(row.min_value), maxValue: num(row.max_value),
    showWhen: str(row.show_when_source), requiredWhen: str(row.required_when_source), readOnlyWhen: str(row.read_only_when_source),
    fetchFrom: str(row.fetch_from_field), fetchSource: str(row.fetch_from_source), fetchOnlyWhenEmpty: !!row.fetch_only_when_empty,
    inListView: !!row.show_in_list_view, useAsFilter: !!row.use_as_filter, globalSearch: !!row.show_in_global_search,
    bold: !!row.is_bold, hidden: !!row.is_hidden, readOnly: !!row.is_read_only, translatable: !!row.is_translatable,
  };
}

/** The designer's definition → Sayr's row. Only what the type takes is sent: Sayr refuses a property that does not
 *  apply (a stale max length left by a type change would fail the save). */
export function rowOfDefinition(def: FieldDefinition, key: string, props: FieldTypeProperty[] | undefined): SayrFieldRow {
  const asks = (p: FieldTypeProperty) => (props ? props.includes(p) : true);
  const filters = (def.linkFilters ?? []).filter((f) => f.field);
  const row: SayrFieldRow = {
    field_key: key, field_type: def.type,
    label_en: def.label.trim() || (def.labelAr ?? "").trim(), label_ar: (def.labelAr ?? "").trim() || null,
    description: def.description?.trim() || null, reqd: bit(def.required),
    placeholder: asks("placeholder") ? def.placeholder || null : null,
    default_value: asks("default") && !def.unique ? def.defaultValue || null : null,
    is_unique: asks("unique") ? bit(def.unique) : 0,
    show_when_source: def.showWhen?.trim() || null, required_when_source: def.requiredWhen?.trim() || null,
    read_only_when_source: def.readOnlyWhen?.trim() || null,
    fetch_from_field: asks("autofill") && def.fetchFrom ? def.fetchFrom : null,
    fetch_from_source: asks("autofill") && def.fetchFrom ? def.fetchSource || null : null,
    fetch_only_when_empty: bit(def.fetchOnlyWhenEmpty),
    show_in_list_view: bit(def.inListView), use_as_filter: bit(def.useAsFilter), show_in_global_search: bit(def.globalSearch),
    is_bold: bit(def.bold), is_hidden: bit(def.hidden), is_read_only: bit(def.readOnly), is_translatable: bit(def.translatable),
  };
  if (asks("choices")) row.choices = (def.choices ?? []).filter((c) => c.en.trim()).map((c) => ({ value_en: c.en.trim(), ...(c.ar?.trim() ? { value_ar: c.ar.trim() } : {}) }));
  if (asks("doctype_target") || asks("child_target") || asks("sibling_field")) row.link_target = def.linkTarget || null;
  if (asks("doctype_target")) row.link_filters = filters.length ? filters : null;
  if (asks("max_length")) row.max_length = def.maxLength ?? null;
  if (asks("bounds")) { row.min_value = def.minValue ?? null; row.max_value = def.maxValue ?? null; }
  if (asks("data_subtype")) row.data_subtype = def.dataSubtype || null;
  if (asks("max_rating")) row.max_rating = def.maxRating ?? null;
  if (asks("precision")) row.precision = def.precision || null;
  if (asks("non_negative")) row.non_negative = bit(def.nonNegative);
  return row;
}

interface Planned { token: string; row: DeploymentRow }

/** What Deploy writes: a section or tab with nothing put into it is dropped, as Sayr's server does — an emptied section
 *  first, then the tab left holding nothing (DeploymentEditorPage `effective`). */
function effective(rows: Planned[]): Planned[] {
  let kept = rows;
  for (;;) {
    const filled = new Set<string>();
    for (const r of kept) {
      const holder = kept.find((h) => h.row.row_kind !== "field" && h.token === r.row.insert_after);
      if (!holder) continue;
      if (r.row.row_kind === "field" || (r.row.row_kind === "section" && holder.row.row_kind === "tab")) filled.add(holder.token);
    }
    const next = kept.filter((r) => r.row.row_kind === "field" || filled.has(r.token));
    if (next.length === kept.length) return kept;
    kept = next;
  }
}

/** A FieldDesigner adapter for one type DocType (a family type, or any DocType Sayr's Field Library can deploy on).
 *  Needs the Sear Platform Administrator role; without it `load` resolves to a refusal. */
export function createSayrFieldDesignerAdapter(api: SayrApi, doctype: string, options: SayrFieldDesignerOptions = {}): FieldDesignerAdapter {
  const ar = options.language === "ar";
  let screen: Screen | null = null;
  let rows: DeploymentRow[] = [];
  let loadedPayload = "";
  let registry: Promise<Registry> | null = null;

  const call = async <T,>(method: string, args: Record<string, unknown>) => (await api.call(method, args)).message as T;
  const types = () => (registry ??= call<Registry>(`${FIELD_SETS}.field_type_registry`, {}));
  const live = () => (screen?.deployment && screen.deployment.status !== "removed" ? screen.deployment : null);

  /** The rows and own definitions the items would deploy, every non-native row anchored by Sayr's tokens (the server
   *  resolves them), and the form's order in the same tokens. */
  const plan = (items: DesignerItem[], reg: Registry) => {
    const props = new Map(reg.types.map((x) => [x.key, x.props]));
    const byId = new Map(rows.map((r) => [idOf(r), r]));
    const keys = ownKeys(items);
    const tokenOf = (i: DesignerItem): string => {
      if (i.native) return i.id;
      if (i.definition) return `@own::${keys.get(i.id)}`;
      if (i.kind === "tab_break") return `@tab::${(i.label ?? "").trim()}`;
      if (i.own && i.kind === "section_break") return `@section::${(i.label ?? "").trim()}`;
      const row = byId.get(i.id);
      return row ? sayrToken(row) : i.id;
    };
    const planned: Planned[] = [];
    items.forEach((i, n) => {
      if (i.native) return;
      const insert_after = n > 0 ? tokenOf(items[n - 1]) : null;
      const token = tokenOf(i);
      const label = (i.label ?? "").trim();
      if (i.definition) planned.push({ token, row: { field_preset: null, field_key: keys.get(i.id)!, row_kind: "field", insert_after } });
      else if (i.kind === "tab_break") planned.push({ token, row: { field_preset: null, field_key: null, row_kind: "tab", label, insert_after } });
      else if (i.own && i.kind === "section_break") planned.push({ token, row: { field_preset: null, field_key: null, row_kind: "section", label, insert_after } });
      else {
        const row = byId.get(i.id) ?? rowOfToken(i.id);
        if (row) planned.push({ token, row: { ...row, label: null, insert_after } });
      }
    });
    const wanted = effective(planned).map(({ row }) => ({
      field_preset: row.field_preset || null, field_key: row.row_kind === "field" ? row.field_key : null, row_kind: row.row_kind,
      label: row.row_kind === "tab" || (row.row_kind === "section" && !row.field_preset) ? row.label ?? null : null,
      insert_after: row.insert_after ?? null, overrides: row.overrides ?? null,
    }));
    const own = items.filter((i) => i.definition).map((i) => rowOfDefinition(i.definition!, keys.get(i.id)!, props.get(i.definition!.type)));
    return { wanted, own, order: items.map(tokenOf) };
  };

  const load = async (): Promise<DesignerState> => {
    let s: Screen;
    try {
      s = await call<Screen>(`${METHODS}.doctype_deployment`, { target_doctype: doctype });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403) return { items: [], refusal: ar ? "يتطلب تصميم النموذج دور مسؤول منصة سير." : "Designing this form needs the Sear Platform Administrator role." };
      throw e;
    }
    screen = s;
    if (s.refusal) { rows = []; return { items: [], refusal: s.refusal }; }
    const deployment = live();
    rows = deployment ? deployment.fields.map((r) => ({ ...r })) : [];
    const definitions = new Map((deployment?.own_fields ?? []).map((f) => [f.field_key, definitionOfRow(f)]));
    const sets = [...new Set(rows.map((r) => r.field_preset).filter(Boolean))] as string[];
    const setLabel = new Map<string, string>();
    if (sets.length) {
      const found = await api.getList<Record<string, string>>(FIELD_SET, {
        fields: ["name", "preset_name", "preset_name_ar"], filters: [["name", "in", sets]], limit_page_length: sets.length,
      });
      for (const r of found) setLabel.set(r.name, (ar && r.preset_name_ar) || r.preset_name || r.name);
    }
    const itemOf = (row: DeploymentRow, id: string, fallbackLabel?: string, fieldtype?: string): DesignerItem => {
      if (row.row_kind === "tab") return { id, kind: "tab_break", label: row.label ?? "", own: true };
      if (!row.field_preset) {
        if (row.row_kind === "section") return { id, kind: "section_break", label: row.label ?? "", own: true };
        const definition = definitions.get(row.field_key ?? "") ?? { key: row.field_key ?? "", type: "text", label: row.field_key ?? "" };
        return { id, kind: "field", own: true, definition, fieldtype: definition.type, label: (ar && definition.labelAr) || definition.label || definition.labelAr || "" };
      }
      const source = setLabel.get(row.field_preset);
      if (row.row_kind === "section") return { id, kind: "section_break", label: source ?? fallbackLabel, source };
      return { id, kind: "field", label: fallbackLabel || row.field_key || "", fieldtype, source };
    };
    const byField = new Map(rows.filter((r) => r.fieldname).map((r) => [r.fieldname as string, r]));
    const shared = new Set(s.family?.role === "child" ? s.family.shared ?? [] : []);
    let items: DesignerItem[] = s.target_fields.map((f) => {
      const kind = kindOfFieldtype(f.fieldtype);
      const label = f.label === f.fieldname ? "" : f.label;
      const row = byField.get(f.fieldname);
      if (row) return itemOf(row, f.fieldname, label, kind === "field" ? f.fieldtype : undefined);
      return { id: f.fieldname, kind, label, fieldtype: kind === "field" ? f.fieldtype : undefined, native: true, movable: kind === "field" && shared.has(f.fieldname) };
    });
    // Rows saved but without a column yet (a failed or pending deploy) sit after their anchors, or at the end.
    for (const row of rows.filter((r) => !r.fieldname || !items.some((i) => i.id === r.fieldname))) {
      const item = itemOf(row, sayrToken(row), row.field_key ?? undefined);
      const at = items.findIndex((i) => i.id === row.insert_after);
      items = at < 0 ? [...items, item] : [...items.slice(0, at + 1), item, ...items.slice(at + 1)];
    }
    const { wanted, own } = plan(items, await types());
    loadedPayload = JSON.stringify([wanted, own]);
    const notice = deployment?.status === "outdated"
      ? (ar ? "تغيّرت مجموعة حقول مستخدمة هنا منذ آخر حفظ. أعد نشرها من مكتبة الحقول في سير ستوديو." : "A field set used here changed since this form was saved. Redeploy it from the Field Library in Sear Studio.")
      : undefined;
    return { items, notice };
  };

  return {
    load,

    async fieldTypes(): Promise<FieldTypeRegistry> {
      const r = await types();
      return {
        types: r.types.map((x) => ({ key: x.key, label: { en: x.label_en, ar: x.label_ar || x.label_en }, group: x.group, props: x.props })),
        groups: r.groups.filter((g) => g.group !== "Layout").map((g) => ({ group: g.group, types: g.types.filter((k) => !BREAK_TYPES.has(k) && k !== "heading") })),
        dataSubtypes: r.data_subtypes,
      };
    },

    linkTargets: (search: string, childTables: boolean) =>
      call<{ name: string; app?: string }[]>(`${FIELD_SETS}.link_target_doctypes`, { search, child_tables: childTables ? 1 : 0 }),

    linkTargetFields: (target: string) =>
      call<{ fieldname: string; label?: string; fieldtype?: string }[]>(`${FIELD_SETS}.link_target_fields`, { target_doctype: target }),

    async listFieldSets(): Promise<DesignerFieldSet[]> {
      const sets = await api.getList<Record<string, string | number>>(FIELD_SET, {
        fields: ["name", "preset_name", "preset_name_ar", "description", "fields_count"], filters: [["status", "=", "published"]],
        order_by: "preset_name asc", limit_page_length: 500,
      });
      return sets.map((r) => ({
        name: String(r.name), description: r.description ? String(r.description) : undefined,
        fieldCount: r.fields_count === undefined || r.fields_count === null ? undefined : Number(r.fields_count),
        label: { en: String(r.preset_name || r.name), ar: String(r.preset_name_ar || r.preset_name || r.name) },
      }));
    },

    async fieldsOf(set: string): Promise<DesignerSetField[]> {
      const doc = (await api.call("frappe.client.get", { doctype: FIELD_SET, name: set })).message as { fields?: Record<string, string>[] };
      const deployed = new Set(rows.filter((r) => r.field_preset === set).map((r) => r.field_key));
      return (doc.fields ?? [])
        .filter((f) => !BREAK_TYPES.has(f.field_type) && !deployed.has(f.field_key))
        .map((f) => ({
          id: `@${set}::${f.field_key}`,
          kind: "field" as const,
          label: { en: f.label_en || f.field_key, ar: f.label_ar || f.label_en || f.field_key },
          fieldtype: f.field_type,
        }));
    },

    sectionOf: (set: string, label: string): DesignerItem => ({ id: `@${set}::__section`, kind: "section_break", label, source: label }),
    makeTab: (label: string): DesignerItem => ({ id: `@tab::${label}`, kind: "tab_break", label, own: true }),
    makeSection: (label: string): DesignerItem => ({ id: `@section::${label}`, kind: "section_break", label, own: true }),

    async save(items: DesignerItem[]): Promise<DesignerState> {
      const { wanted, own, order } = plan(items, await types());
      const deployment = screen?.deployment ?? null;
      const isLive = !!live();
      if (!wanted.length) {
        if (isLive) await call(`${METHODS}.withdraw_deployment`, { name: deployment!.name });
      } else if (!isLive || JSON.stringify([wanted, own]) !== loadedPayload) {
        if (deployment) {
          const doc = (await api.call("frappe.client.get", { doctype: DEPLOYMENT, name: deployment.name })).message as Record<string, unknown>;
          await api.call("frappe.client.save", { doc: JSON.stringify({ ...doc, fields: wanted, own_fields: own }) });
        } else {
          await api.call("frappe.client.insert", { doc: JSON.stringify({ doctype: DEPLOYMENT, target_doctype: doctype, fields: wanted, own_fields: own }) });
        }
      }
      // A family type keeps its form as arranged, its shared fields included; the new rows' tokens resolve now.
      if (screen?.family?.role === "child") {
        await call(`${METHODS}.save_field_order`, { target_doctype: doctype, order: JSON.stringify(order) });
      }
      return load();
    },

    async removalImpact(ids: string[]): Promise<DesignerRemoval[]> {
      const deployment = screen?.deployment;
      if (!deployment) return [];
      const gone = rows.filter((r) => ids.includes(idOf(r)) && r.row_kind === "field");
      if (!gone.length) return [];
      const impact = await call<{ fields: { field_key: string; fieldname?: string; rows_with_data: number }[] }>(
        `${METHODS}.deployment_removal_impact`, { name: deployment.name, field_keys: JSON.stringify(gone.map((r) => r.field_key)) });
      const labels = new Map(screen!.target_fields.map((f) => [f.fieldname, f.label ?? f.fieldname]));
      return impact.fields
        .filter((f) => gone.some((r) => (r.fieldname ? r.fieldname === f.fieldname : r.field_key === f.field_key)))
        .map((f) => ({ id: f.fieldname ?? f.field_key, label: (f.fieldname && labels.get(f.fieldname)) || f.field_key, rowsWithData: f.rows_with_data ?? 0 }));
    },
  };
}
