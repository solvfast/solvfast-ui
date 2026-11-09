/** Fieldtype groups (Frappe 15.110 `frappe.model` lists, as described in docs `11`/`12`). */

/** Containers that only shape the layout. */
export const LAYOUT_TYPES = new Set(["Section Break", "Column Break", "Tab Break", "Fold", "Page Break"]);
/** Fields with no stored value. */
export const DISPLAY_TYPES = new Set(["HTML", "Heading", "Button", "Image"]);
export const NO_VALUE_TYPES = new Set([...LAYOUT_TYPES, ...DISPLAY_TYPES]);
/** Table fields: the value is an array of child rows. */
export const TABLE_TYPES = new Set(["Table", "Table MultiSelect"]);
export const NUMERIC_TYPES = new Set(["Int", "Long Int", "Float", "Currency", "Percent", "Check", "Rating", "Duration"]);
export const INT_TYPES = new Set(["Int", "Long Int", "Check"]);
export const FLOAT_TYPES = new Set(["Float", "Currency", "Percent"]);
/** Read fields that still show when empty (BaseControl.get_status, docs `12` §1.3). */
export const SHOW_WHEN_EMPTY = new Set(["HTML", "Image", "Button", "Geolocation", "Heading"]);

/** `frappe.router.slug`: lower case, spaces → "-". */
export const slug = (s: string) => s.toLowerCase().replace(/\s+/g, "-");

/** 10 random lower-case alphanumerics (`frappe.utils.get_random`). */
export function randomString(n = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  const bytes = g.crypto?.getRandomValues ? g.crypto.getRandomValues(new Uint8Array(n)) : Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
  for (const b of bytes) s += chars[b % chars.length];
  return s;
}

/** Desk's local name for a new document or row: `new-<slug>-<10 chars>` (create_new.js:77-80). */
export const newLocalName = (doctype: string) => `new-${slug(doctype)}-${randomString(10)}`;

/**
 * Fieldtypes FrappeField has a control (or display) for (P35). Anything else — an app's custom type — is reported
 * (`analyzeFieldtypes`, the form's issues banner) and its value shown read-only, never edited through a plain text box
 * that could corrupt it (before 0.7 it silently fell back to one).
 * P36e ftypes: Signature and Icon have full controls; Barcode and Geolocation have PARTIAL ones (`PARTIAL_FIELDTYPES`:
 * a safe read-only display in every status, editing needs a generator / map library the package does not include).
 */
export const SUPPORTED_FIELDTYPES = new Set([
  ...LAYOUT_TYPES, ...DISPLAY_TYPES, ...TABLE_TYPES,
  "Data", "Link", "Dynamic Link", "Select", "Autocomplete", "Read Only", "Password", "Phone",
  "Small Text", "Text", "Long Text", "Text Editor", "Code", "JSON", "HTML Editor", "Markdown Editor",
  "Int", "Long Int", "Float", "Currency", "Percent", "Check", "Rating", "Duration",
  "Date", "Datetime", "Time", "Color", "Attach", "Attach Image",
  // P36e ftypes
  "Signature", "Icon", "Barcode", "Geolocation",
]);
/** P36e ftypes: supported types whose control only DISPLAYS the stored value (no editing yet; see FrappeField). */
export const PARTIAL_FIELDTYPES = new Set(["Barcode", "Geolocation"]);

export interface FieldtypeIssue { doctype: string; fieldname: string; fieldtype: string; label?: string }

/** Fields of the bundle (parent and child DocTypes) whose fieldtype has no control here. */
export function analyzeFieldtypes(bundle: { meta: { name: string; fields?: { fieldname: string; fieldtype: string; label?: string }[] }; children?: Record<string, { name: string; fields?: { fieldname: string; fieldtype: string; label?: string }[] }> }): FieldtypeIssue[] {
  const out: FieldtypeIssue[] = [];
  for (const m of [bundle.meta, ...Object.values(bundle.children ?? {})]) {
    for (const f of m.fields ?? []) if (!SUPPORTED_FIELDTYPES.has(f.fieldtype)) out.push({ doctype: m.name, fieldname: f.fieldname, fieldtype: f.fieldtype, label: f.label });
  }
  return out;
}
