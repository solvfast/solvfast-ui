/**
 * Turn a Frappe doctype's built-in meta (from `frappe.desk.form.load.getdoctype`) into everything <DataGrid>
 * needs — filter fields, default columns, quick-filter fields, the title field — with NO per-doctype backend.
 * The fieldtype→UI-type mapping mirrors Frappe-CRM so operators + inputs adapt automatically.
 */
import type { FilterField, FieldType } from "./filter-engine";

export interface DocField {
  fieldname: string;
  label?: string;
  fieldtype: string;
  options?: string;
  in_list_view?: number;
  in_standard_filter?: number;
  hidden?: number;
  reqd?: number;
}

export interface DocMeta {
  doctype: string;
  fields: DocField[];
  title_field?: string;
}

export interface GridMeta {
  doctype: string;
  titleField: string; // best display field for a row
  filterFields: FilterField[]; // for the advanced filter
  columns: ColumnMeta[]; // all selectable columns
  defaultColumns: string[]; // fieldnames Frappe marks in_list_view (or a sensible fallback)
  quickFilterFields: FilterField[]; // fields Frappe marks in_standard_filter
}

export interface ColumnMeta {
  key: string; // fieldname
  label: string;
  fieldtype: string;
  type: FieldType;
  options?: string;
}

// Frappe fieldtype → the filter-engine FieldType.
const TYPE_MAP: Record<string, FieldType> = {
  Data: "text", "Small Text": "text", Text: "text", "Long Text": "text", "Text Editor": "text",
  Code: "text", "Read Only": "text", Phone: "text", Time: "text",
  Select: "select",
  Link: "link", "Dynamic Link": "link",
  Date: "date", Datetime: "date",
  Int: "number", Float: "number", Currency: "number", Percent: "number",
  Check: "boolean",
};

// Layout / presentational / unfilterable fieldtypes — never offered as filter/column fields.
const SKIP = new Set([
  "Section Break", "Column Break", "Tab Break", "HTML", "HTML Editor", "Heading", "Fold",
  "Table", "Table MultiSelect", "Button", "Image", "Attach", "Attach Image", "Signature",
  "Geolocation", "Barcode", "Password", "JSON",
]);

const selectOptions = (df: DocField) =>
  (df.options || "").split("\n").map((o) => o.trim()).filter(Boolean).map((o) => ({ value: o, label: o }));

const toFilterField = (df: DocField): FilterField | null => {
  const type = TYPE_MAP[df.fieldtype];
  if (!type) return null;
  const f: FilterField = { name: df.fieldname, label: df.label || df.fieldname, type, fieldtype: df.fieldtype };
  if (type === "select") f.options = selectOptions(df);
  if (type === "link") f.link_doctype = df.options;
  return f;
};

/** Derive the grid model from a doctype meta. Adds the standard name/created/modified fields. */
export function buildGridMeta(meta: DocMeta): GridMeta {
  const usable = (meta.fields || []).filter((df) => !SKIP.has(df.fieldtype) && !df.hidden);

  const filterFields: FilterField[] = [];
  const columns: ColumnMeta[] = [];
  const defaultColumns: string[] = [];
  const quickFilterFields: FilterField[] = [];

  for (const df of usable) {
    const ff = toFilterField(df);
    if (!ff) continue;
    filterFields.push(ff);
    columns.push({ key: df.fieldname, label: ff.label, fieldtype: df.fieldtype, type: ff.type, options: df.options });
    if (df.in_list_view) defaultColumns.push(df.fieldname);
    if (df.in_standard_filter) quickFilterFields.push(ff);
  }

  // Always-useful standard fields.
  filterFields.push(
    { name: "name", label: "ID", type: "text", fieldtype: "Data" },
    { name: "creation", label: "Created On", type: "date", fieldtype: "Datetime" },
    { name: "modified", label: "Last Updated", type: "date", fieldtype: "Datetime" },
  );

  const titleField = meta.title_field || (columns.find((c) => c.type === "text")?.key ?? "name");
  // Fallback columns if the doctype marks none for the list view: title + first few scalar fields.
  const fallback = [titleField, ...columns.map((c) => c.key)].filter((k, i, a) => a.indexOf(k) === i).slice(0, 5);
  return {
    doctype: meta.doctype,
    titleField,
    filterFields,
    columns,
    defaultColumns: defaultColumns.length ? defaultColumns : fallback,
    quickFilterFields,
  };
}
