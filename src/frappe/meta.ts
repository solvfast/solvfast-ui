/**
 * DocType meta → what the List View needs (Sear lib/data-grid/frappe-meta.ts `buildGridMeta`, same fieldtype map as
 * Frappe CRM): columns, filter fields, default visible columns (`in_list_view`), quick filters (`in_standard_filter`),
 * title field, search fields and the default sort. Pure TS.
 * Fixes: the standard fields (ID, Created On, Last Updated) are localized (Sear's were English-only); a Dynamic Link is
 * filtered as text (its `options` names another FIELD, not a DocType, so link search on it could only fail).
 */
import type { ColumnDef } from "../list/model/columns";
import type { FieldType, FilterField } from "../list/model/filters";
import type { Messages } from "../theme/messages";
import type { DocField, DocMeta } from "./client";
import type { DocPermissions, FrappeDocField } from "./contract";
import { readableFields } from "./services/permissions";

const TYPE_MAP: Record<string, FieldType> = {
  Data: "text", "Small Text": "text", Text: "text", "Long Text": "text", "Text Editor": "text",
  Code: "text", "Read Only": "text", Phone: "text", Time: "text",
  Select: "select",
  Link: "link", "Dynamic Link": "text",
  Date: "date", Datetime: "date",
  Int: "number", Float: "number", Currency: "number", Percent: "number",
  Check: "boolean",
};
// Layout / presentational / unfilterable fieldtypes — never offered as columns or filters.
const SKIP = new Set([
  "Section Break", "Column Break", "Tab Break", "HTML", "HTML Editor", "Heading", "Fold",
  "Table", "Table MultiSelect", "Button", "Image", "Attach", "Attach Image", "Signature",
  "Geolocation", "Barcode", "Password", "JSON",
]);
/** Columns every DocType has; Frappe's filter validation accepts them without a DocField. */
export const STANDARD_FIELDNAMES = ["name", "owner", "creation", "modified", "modified_by", "docstatus", "idx"];
/** Optional std columns of list rows (the server drops them silently when the table lacks them); not offered as filters or sort. */
export const ROW_OPTIONAL_FIELDNAMES = ["_assign", "_comments", "_liked_by", "_user_tags"];
const STANDARD: { name: string; key: keyof Messages; type: FieldType; fieldtype: string }[] = [
  { name: "name", key: "fieldId", type: "text", fieldtype: "Data" },
  { name: "creation", key: "fieldCreated", type: "date", fieldtype: "Datetime" },
  { name: "modified", key: "fieldModified", type: "date", fieldtype: "Datetime" },
];

/** What the list reads beyond `DocMeta` (getdoctype sends these on the DocType). */
export type ListDocMeta = DocMeta & { is_submittable?: number; is_large_table?: number; states?: { title: string; color?: string }[]; track_seen?: number };

/** A filter field that lives on a child table: composite name `<Child DocType>.<fieldname>`. */
export interface ChildFieldRef { doctype: string; fieldname: string; table: string }

export interface FrappeListMeta {
  doctype: string;
  isSubmittable: boolean;
  isLargeTable: boolean;
  /** `meta.states` (DocType State rows: title + colour), for the indicator. */
  states: { title: string; color?: string }[];
  /** Composite filter-field name → child table field. */
  childOf: Map<string, ChildFieldRef>;
  /** Fields a bulk Edit may set (value types, not read-only / hidden / virtual). */
  editable: { name: string; label: string; type: FieldType; fieldtype: string; options?: { value: string; label: string }[] }[];
  /** The DocType's fields (and creation / modified) as `formatValue` wants them, by fieldname. */
  fieldDefs: Record<string, FrappeDocField>;
  /** True for DocFields (or standard columns) of this DocType. */
  hasField: (fieldname: string) => boolean;
  titleField: string;
  /** `title_field` + the DocType's `search_fields` + `name`, de-duplicated. */
  searchFields: string[];
  /** Frappe's default list order, e.g. "modified desc". */
  defaultOrderBy: string;
  filterFields: FilterField[];
  /** Every usable field as a column (hidden unless `in_list_view`), then ID / Created On / Last Updated (hidden). */
  columns: ColumnDef<Record<string, unknown>>[];
  quickFilterFields: string[];
  /** Fieldnames a request may use (DocFields + standard columns). */
  known: Set<string>;
  /** Fieldtype by fieldname (standard columns included). */
  fieldtypes: Map<string, string>;
}

const selectOptions = (df: DocField) =>
  (df.options || "").split("\n").map((o) => o.trim()).filter(Boolean).map((o) => ({ value: o, label: o }));

/** DocTypes known to be trees (nested set). Desk's list: `frappe.boot.nested_set_doctypes`. */
export type TreeDoctypes = ReadonlySet<string> | readonly string[];
const isTreeTarget = (trees: TreeDoctypes | undefined, doctype: string | undefined) =>
  !!doctype && !!trees && (Array.isArray(trees) ? (trees as readonly string[]).includes(doctype) : (trees as ReadonlySet<string>).has(doctype));

/**
 * Of the metas at hand (the DocType and its child tables), those that are trees by Desk's own rule: boot's
 * `nested_set_doctypes` are the parents of every DocField named `lft` (`frappe/boot.py:70-72`); `is_tree` (the DocType
 * flag of the Tree view, `JS/model/model.js:424-427`) counts too. Link targets the page has no meta for are unknown:
 * the app names them (`treeDoctypes`).
 */
export function treeDoctypesOf(metas: DocMeta[]): string[] {
  return metas.filter((m) => !!(m as { is_tree?: unknown }).is_tree || (m.fields || []).some((df) => df.fieldname === "lft")).map((m) => m.name);
}

function toFilterField(df: DocField, trees?: TreeDoctypes): FilterField | null {
  const type = TYPE_MAP[df.fieldtype];
  if (!type) return null;
  const f: FilterField = { name: df.fieldname, label: df.label || df.fieldname, type, fieldtype: df.fieldtype };
  if (type === "select") f.options = selectOptions(df);
  if (df.fieldtype === "Link") f.link_doctype = df.options;
  // Desk offers the nested-set operators on a Link whose target is a nested-set DocType (filter.js:440-446)
  if (df.fieldtype === "Link" && isTreeTarget(trees, df.options)) f.tree = true;
  return f;
}

/** Filter fields for a DocType: its usable fields, then ID / Created On / Last Updated in the UI language. */
export function filterFieldsFromMeta(meta: DocMeta, t: (k: keyof Messages) => string, children: Record<string, DocMeta> = {}, trees?: TreeDoctypes): FilterField[] {
  const usable = (meta.fields || []).filter((df) => !SKIP.has(df.fieldtype) && !df.hidden);
  const submittable = !!(meta as ListDocMeta).is_submittable;
  const extra: FilterField[] = [
    { name: "owner", label: t("listOwner"), type: "link", fieldtype: "Link", link_doctype: "User" },
    { name: "modified_by", label: t("listModifiedBy"), type: "link", fieldtype: "Link", link_doctype: "User" },
    ...(submittable ? [{ name: "docstatus", label: t("listIndicator"), type: "select" as const, fieldtype: "Int",
      options: [{ value: "0", label: t("listDraft") }, { value: "1", label: t("listSubmitted") }, { value: "2", label: t("listCancelled") }] }] : []),
  ];
  return [
    ...usable.map((df) => toFilterField(df, trees)).filter((f): f is FilterField => !!f),
    ...STANDARD.map((s) => ({ name: s.name, label: t(s.key), type: s.type, fieldtype: s.fieldtype })),
    ...extra.filter((e) => !usable.some((df) => df.fieldname === e.name)),
    ...childFilterFields(meta, children, t, trees).map((c) => c.field),
  ];
}

/** Fields of the DocType's child tables as filter fields (Desk's field_select lists them, labelled with the table). */
export function childFilterFields(meta: DocMeta, children: Record<string, DocMeta>, t: (k: keyof Messages) => string, trees?: TreeDoctypes): { field: FilterField; ref: ChildFieldRef }[] {
  const out: { field: FilterField; ref: ChildFieldRef }[] = [];
  for (const table of (meta.fields || []).filter((df) => df.fieldtype === "Table" && !df.hidden && df.options && children[df.options])) {
    const child = children[table.options!];
    for (const df of (child.fields || []).filter((d) => !SKIP.has(d.fieldtype) && !d.hidden)) {
      const f = toFilterField(df, trees);
      if (!f) continue;
      const composite = `${child.name}.${df.fieldname}`;
      out.push({
        field: { ...f, name: composite, label: t("listChildTable").replace("{field}", f.label).replace("{table}", table.label || table.fieldname) },
        ref: { doctype: child.name, fieldname: df.fieldname, table: table.fieldname },
      });
    }
  }
  return out;
}

/** Columns for a DocType (`in_list_view` fields visible; others offered in the column manager). */
export function columnsFromMeta(meta: DocMeta, t: (k: keyof Messages) => string): ColumnDef<Record<string, unknown>>[] {
  const fields = filterFieldsFromMeta(meta, t);
  const usable = new Map((meta.fields || []).map((df) => [df.fieldname, df]));
  const listed = fields.filter((f) => usable.get(f.name)?.in_list_view).map((f) => f.name);
  const title = titleOf(meta, fields);
  // Sear's fallback when nothing is marked in_list_view: the title field first, then the first few fields.
  const ordered = listed.length ? fields : [...fields.filter((f) => f.name === title), ...fields.filter((f) => f.name !== title)];
  const visible = new Set(listed.length ? listed : ordered.map((f) => f.name).slice(0, 5));
  return ordered.map((f) => ({
    key: f.name, label: f.label, type: f.type, fieldtype: f.fieldtype, options: f.options, hidden: !visible.has(f.name),
  }));
}

const titleOf = (meta: DocMeta, fields: FilterField[]) =>
  meta.title_field || fields.find((f) => f.type === "text" && f.name !== "name")?.name || "name";

/**
 * Drop the fields the user cannot read, by permlevel (`readableFields`): the server strips their values from
 * `reportview.get` rows and refuses them as filters, so the list must not offer them as columns / filters / editable
 * fields. Applied only when the rights are KNOWN and level 0 is readable (`levels[0].read`); otherwise (no session
 * roles, or a DocType whose `permissions` rows the user's roles do not match — the server's 403 then explains) the
 * metas are returned untouched, which is the pre-0.4.0 behaviour. Child metas are filtered the same way.
 */
export function restrictMetaToReadable<M extends DocMeta>(meta: M, children: Record<string, DocMeta>, levels: DocPermissions | undefined): { meta: M; children: Record<string, DocMeta> } {
  if (!levels || !levels[0]?.read) return { meta, children };
  const keep = <F extends DocField>(fields: F[] | undefined) => readableFields((fields ?? []) as (F & { permlevel?: number })[], levels);
  return {
    meta: { ...meta, fields: keep(meta.fields) },
    children: Object.fromEntries(Object.entries(children).map(([k, c]) => [k, { ...c, fields: keep(c.fields) }])),
  };
}

/**
 * `opts.treeDoctypes`: Link targets that are trees (Desk: `frappe.boot.nested_set_doctypes`), added to the ones the
 * metas at hand reveal (`treeDoctypesOf`); their Link fields get `tree: true` and the nested-set operators.
 */
export function buildFrappeListMeta(meta: DocMeta, t: (k: keyof Messages) => string, children: Record<string, DocMeta> = {}, opts: { treeDoctypes?: readonly string[] } = {}): FrappeListMeta {
  const trees = new Set([...treeDoctypesOf([meta, ...Object.values(children)]), ...(opts.treeDoctypes ?? [])]);
  const filterFields = filterFieldsFromMeta(meta, t, children, trees);
  const childFields = childFilterFields(meta, children, t, trees);
  const known = new Set([...(meta.fields || []).filter((df) => !SKIP.has(df.fieldtype)).map((df) => df.fieldname), ...STANDARD_FIELDNAMES, ...ROW_OPTIONAL_FIELDNAMES]);
  const fieldtypes = new Map<string, string>([
    ...(meta.fields || []).map((df) => [df.fieldname, df.fieldtype] as [string, string]),
    ["name", "Data"], ["owner", "Link"], ["creation", "Datetime"], ["modified", "Datetime"], ["modified_by", "Link"], ["docstatus", "Int"], ["idx", "Int"],
  ]);
  for (const c of childFields) { known.add(c.field.name); fieldtypes.set(c.field.name, c.field.fieldtype ?? "Data"); }
  const titleField = titleOf(meta, filterFields);
  const searchFields = [titleField, ...(meta.search_fields || "").split(",").map((s) => s.trim()), "name"]
    .filter((f, i, a) => !!f && a.indexOf(f) === i && known.has(f));
  const sortField = meta.sort_field && known.has(meta.sort_field) ? meta.sort_field : "modified";
  const sortOrder = (meta.sort_order || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  return {
    doctype: meta.name, isSubmittable: !!(meta as ListDocMeta).is_submittable, isLargeTable: !!(meta as ListDocMeta).is_large_table,
    states: (meta as ListDocMeta).states ?? [], childOf: new Map(childFields.map((c) => [c.field.name, c.ref])),
    editable: filterFields.filter((f) => !f.name.includes(".") && (meta.fields || []).some((df) => df.fieldname === f.name && !df.hidden && !(df as { read_only?: number }).read_only && !(df as { is_virtual?: number }).is_virtual && df.fieldtype !== "Read Only"))
      .map((f) => ({ name: f.name, label: f.label, type: f.type, fieldtype: f.fieldtype ?? "Data", options: f.options })),
    fieldDefs: {
      ...Object.fromEntries((meta.fields || []).map((df) => [df.fieldname, df as unknown as FrappeDocField])),
      creation: { fieldname: "creation", fieldtype: "Datetime" }, modified: { fieldname: "modified", fieldtype: "Datetime" },
    },
    hasField: (f: string) => known.has(f) && !f.includes("."), titleField, searchFields, defaultOrderBy: `${sortField} ${sortOrder}`, filterFields,
    columns: columnsFromMeta(meta, t),
    quickFilterFields: (meta.fields || []).filter((df) => df.in_standard_filter && !df.hidden && TYPE_MAP[df.fieldtype]).map((df) => df.fieldname),
    known, fieldtypes,
  };
}
