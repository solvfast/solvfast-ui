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
const STANDARD: { name: string; key: keyof Messages; type: FieldType; fieldtype: string }[] = [
  { name: "name", key: "fieldId", type: "text", fieldtype: "Data" },
  { name: "creation", key: "fieldCreated", type: "date", fieldtype: "Datetime" },
  { name: "modified", key: "fieldModified", type: "date", fieldtype: "Datetime" },
];

export interface FrappeListMeta {
  doctype: string;
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

function toFilterField(df: DocField): FilterField | null {
  const type = TYPE_MAP[df.fieldtype];
  if (!type) return null;
  const f: FilterField = { name: df.fieldname, label: df.label || df.fieldname, type, fieldtype: df.fieldtype };
  if (type === "select") f.options = selectOptions(df);
  if (df.fieldtype === "Link") f.link_doctype = df.options;
  return f;
}

/** Filter fields for a DocType: its usable fields, then ID / Created On / Last Updated in the UI language. */
export function filterFieldsFromMeta(meta: DocMeta, t: (k: keyof Messages) => string): FilterField[] {
  const usable = (meta.fields || []).filter((df) => !SKIP.has(df.fieldtype) && !df.hidden);
  return [
    ...usable.map(toFilterField).filter((f): f is FilterField => !!f),
    ...STANDARD.map((s) => ({ name: s.name, label: t(s.key), type: s.type, fieldtype: s.fieldtype })),
  ];
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

export function buildFrappeListMeta(meta: DocMeta, t: (k: keyof Messages) => string): FrappeListMeta {
  const filterFields = filterFieldsFromMeta(meta, t);
  const known = new Set([...(meta.fields || []).filter((df) => !SKIP.has(df.fieldtype)).map((df) => df.fieldname), ...STANDARD_FIELDNAMES]);
  const fieldtypes = new Map<string, string>([
    ...(meta.fields || []).map((df) => [df.fieldname, df.fieldtype] as [string, string]),
    ["name", "Data"], ["owner", "Link"], ["creation", "Datetime"], ["modified", "Datetime"], ["modified_by", "Link"], ["docstatus", "Int"], ["idx", "Int"],
  ]);
  const titleField = titleOf(meta, filterFields);
  const searchFields = [titleField, ...(meta.search_fields || "").split(",").map((s) => s.trim()), "name"]
    .filter((f, i, a) => !!f && a.indexOf(f) === i && known.has(f));
  const sortField = meta.sort_field && known.has(meta.sort_field) ? meta.sort_field : "modified";
  const sortOrder = (meta.sort_order || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  return {
    doctype: meta.name, titleField, searchFields, defaultOrderBy: `${sortField} ${sortOrder}`, filterFields,
    columns: columnsFromMeta(meta, t),
    quickFilterFields: (meta.fields || []).filter((df) => df.in_standard_filter && !df.hidden && TYPE_MAP[df.fieldtype]).map((df) => df.fieldname),
    known, fieldtypes,
  };
}
