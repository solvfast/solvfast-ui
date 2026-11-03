/**
 * Form layout from meta (docs `11` §2.1–2.2; layout.js, tab.js, section.js, column.js).
 *  - Field list: a synthetic `__newname` Data field (required; shown only for new documents whose autoname is
 *    Prompt / name) + the DocFields in order.
 *  - If any Tab Break exists and the first field is not a Tab Break, a "Details" tab is inserted first.
 *  - A tab (or the form) whose first field is not a Section Break gets an anonymous section.
 *  - Section Break → new section (one column); Column Break → new column in the current section; Tab Break → new
 *    tab with an implicit section. Fold / Page Break are treated as Section Breaks (UNVERIFIED for Fold's folding).
 *  - Columns split the row equally.
 * Visibility (computed by the renderer from display statuses): a section with no visible control is hidden; a tab
 * that is hidden, unreadable, or has no visible section is hidden; the tab bar is hidden when one tab remains.
 */
import type { DocTypeMeta, FrappeDocField } from "../../contract";

export interface LayoutColumn { key: string; df?: FrappeDocField; fields: FrappeDocField[] }
export interface LayoutSection { key: string; df?: FrappeDocField; columns: LayoutColumn[] }
export interface LayoutTab { key: string; df?: FrappeDocField; /** true for the inserted "Details" tab */ details?: boolean; sections: LayoutSection[] }
export interface FormLayout { tabs: LayoutTab[]; /** The meta has Tab Breaks (a tab bar may show). */ hasTabs: boolean }

const SECTION_LIKE = new Set(["Section Break", "Fold", "Page Break"]);

export function newnameField(meta: DocTypeMeta, isNew: boolean): FrappeDocField | null {
  const autoname = String(meta.autoname ?? "").toLowerCase();
  if (!isNew || (autoname !== "prompt" && autoname !== "name")) return null;
  return { fieldname: "__newname", fieldtype: "Data", label: "Name", reqd: 1 };
}

export function buildLayout(meta: DocTypeMeta, opts: { isNew?: boolean } = {}): FormLayout {
  const fields = [...(meta.fields ?? [])];
  const nn = newnameField(meta, !!opts.isNew);
  const hasTabs = fields.some((f) => f.fieldtype === "Tab Break");
  const tabs: LayoutTab[] = [];
  let tab: LayoutTab | null = null;
  let section: LayoutSection | null = null;
  let column: LayoutColumn | null = null;
  let n = 0;
  const newTab = (df?: FrappeDocField, details = false) => { tab = { key: df?.fieldname ?? `__tab${n++}`, df, details, sections: [] }; tabs.push(tab); section = null; column = null; };
  const newSection = (df?: FrappeDocField) => {
    if (!tab) newTab(undefined, hasTabs);
    section = { key: df?.fieldname ?? `__section${n++}`, df, columns: [] };
    tab!.sections.push(section);
    column = null;
  };
  const newColumn = (df?: FrappeDocField) => {
    if (!section) newSection();
    column = { key: df?.fieldname ?? `__column${n++}`, df, fields: [] };
    section!.columns.push(column);
  };
  if (hasTabs && fields[0]?.fieldtype !== "Tab Break") newTab(undefined, true);
  if (nn) { newColumn(); column!.fields.push(nn); }
  for (const df of fields) {
    if (df.fieldtype === "Tab Break") { newTab(df); newSection(); continue; }
    if (SECTION_LIKE.has(df.fieldtype)) { newSection(df); continue; }
    if (df.fieldtype === "Column Break") { newColumn(df); continue; }
    if (!column) newColumn();
    column!.fields.push(df);
  }
  if (!tabs.length) newTab();
  return { tabs, hasTabs };
}

/** Every field of a section (all columns). */
export const sectionFields = (s: LayoutSection) => s.columns.flatMap((c) => c.fields);
