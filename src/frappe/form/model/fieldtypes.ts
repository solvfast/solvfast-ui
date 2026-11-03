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
