// A form as tabs → sections → columns → fields, and back to Frappe's flat field order. Pure functions: the designer
// owns the list, asks for an edit, keeps the list it gets back. Ported from Sayr's Field Library canvas
// (sear_product sear_studio/pages/FieldLibrary/canvasLayout.ts), where a deployed field set and a DocType's own
// fields are laid out the same way. An implicit first tab, section and column exist whenever the list does not
// begin with a break.

import type { FieldDefinition } from "./fieldDefinition";

export type DesignerKind = "field" | "section_break" | "column_break" | "tab_break";

export interface DesignerItem {
  /** Stable identity, the adapter's: a fieldname, or a token for something not deployed yet. */
  id: string;
  kind: DesignerKind;
  label?: string;
  /** Frappe fieldtype (or the library's type), shown on the card. */
  fieldtype?: string;
  /** The DocType's own field (standard, or shared from a family parent): placement only, never removed. */
  native?: boolean;
  /** A native field that may still be moved (a family type's field shared from its parent). */
  movable?: boolean;
  /** Where an added field comes from (a field set's name), shown on the card. */
  source?: string;
  /** Defined on this form itself (a field with `definition`, or a section / tab it added): edited here. */
  own?: boolean;
  /** An own field's definition (every property a field set's field has). */
  definition?: FieldDefinition;
}

export interface LayoutColumn { breakItem?: DesignerItem; fields: DesignerItem[] }
export interface LayoutSection { breakItem?: DesignerItem; columns: LayoutColumn[] }
export interface LayoutTab { breakItem?: DesignerItem; sections: LayoutSection[] }
/** A place in a column: in front of `before`, or at the column's end. */
export interface DropSlot { tab: number; section: number; column: number; before?: string }

/** Frappe fieldtype → layout kind. */
export const kindOfFieldtype = (fieldtype: string): DesignerKind =>
  fieldtype === "Section Break" ? "section_break" : fieldtype === "Column Break" ? "column_break" : fieldtype === "Tab Break" ? "tab_break" : "field";

export function toLayout(items: DesignerItem[]): LayoutTab[] {
  const tabs: LayoutTab[] = [];
  let tab: LayoutTab | null = null;
  let section: LayoutSection | null = null;
  let column: LayoutColumn | null = null;
  for (const item of items) {
    if (item.kind === "tab_break") {
      tab = { breakItem: item, sections: [] }; tabs.push(tab); section = null; column = null;
    } else if (item.kind === "section_break") {
      if (!tab) { tab = { sections: [] }; tabs.push(tab); }
      section = { breakItem: item, columns: [] }; tab.sections.push(section); column = null;
    } else if (item.kind === "column_break") {
      if (!tab) { tab = { sections: [] }; tabs.push(tab); }
      if (!section) { section = { columns: [] }; tab.sections.push(section); }
      column = { breakItem: item, fields: [] }; section.columns.push(column);
    } else {
      if (!tab) { tab = { sections: [] }; tabs.push(tab); }
      if (!section) { section = { columns: [] }; tab.sections.push(section); }
      if (!column) { column = { fields: [] }; section.columns.push(column); }
      column.fields.push(item);
    }
  }
  if (tabs.length === 0) tabs.push({ sections: [] });
  for (const t of tabs) {
    if (t.sections.length === 0) t.sections.push({ columns: [] });
    for (const s of t.sections) if (s.columns.length === 0) s.columns.push({ fields: [] });
  }
  return tabs;
}

export function fromLayout(tabs: LayoutTab[]): DesignerItem[] {
  const out: DesignerItem[] = [];
  for (const t of tabs) {
    if (t.breakItem) out.push(t.breakItem);
    for (const s of t.sections) {
      if (s.breakItem) out.push(s.breakItem);
      for (const c of s.columns) {
        if (c.breakItem) out.push(c.breakItem);
        out.push(...c.fields);
      }
    }
  }
  return out;
}

const at = <T,>(list: T[], i: number) => list[Math.max(0, Math.min(i, list.length - 1))];

/** Insert an item not yet in `items` at `slot`. Returns a new list. */
export function insertItem(items: DesignerItem[], item: DesignerItem, slot: DropSlot): DesignerItem[] {
  const tabs = toLayout(items);
  const column = at(at(at(tabs, slot.tab).sections, slot.section).columns, slot.column);
  const i = slot.before ? column.fields.findIndex((f) => f.id === slot.before) : -1;
  if (i < 0) column.fields.push(item); else column.fields.splice(i, 0, item);
  return fromLayout(tabs);
}

/** Move `id` to `slot`. */
export function moveItem(items: DesignerItem[], id: string, slot: DropSlot): DesignerItem[] {
  const moving = items.find((r) => r.id === id);
  if (!moving || slot.before === id) return items;
  return insertItem(items.filter((r) => r.id !== id), moving, slot);
}

/** Where a field sits: tab, section, column and its index there. */
export function locateField(items: DesignerItem[], id: string): (DropSlot & { index: number }) | null {
  const tabs = toLayout(items);
  for (let ti = 0; ti < tabs.length; ti++)
    for (let si = 0; si < tabs[ti].sections.length; si++)
      for (let ci = 0; ci < tabs[ti].sections[si].columns.length; ci++) {
        const index = tabs[ti].sections[si].columns[ci].fields.findIndex((f) => f.id === id);
        if (index >= 0) return { tab: ti, section: si, column: ci, index };
      }
  return null;
}

/** Every column of a tab in form order, with its place. */
function columnsOf(tabs: LayoutTab[], tab: number): { slot: DropSlot; fields: DesignerItem[] }[] {
  return tabs[tab].sections.flatMap((s, si) => s.columns.map((c, ci) => ({ slot: { tab, section: si, column: ci }, fields: c.fields })));
}

/** One step up or down: past the neighbouring field, or into the end (up) / start (down) of the neighbouring column of
 *  the same tab. Returns the list unchanged at the tab's edge. */
export function stepItem(items: DesignerItem[], id: string, direction: -1 | 1): DesignerItem[] {
  const here = locateField(items, id);
  if (!here) return items;
  const tabs = toLayout(items);
  const columns = columnsOf(tabs, here.tab);
  const ci = columns.findIndex((c) => c.slot.section === here.section && c.slot.column === here.column);
  const fields = columns[ci].fields;
  if (direction < 0) {
    if (here.index > 0) return moveItem(items, id, { ...columns[ci].slot, before: fields[here.index - 1].id });
    if (ci === 0) return items;
    return moveItem(items, id, columns[ci - 1].slot);
  }
  if (here.index < fields.length - 1) {
    const after = fields[here.index + 2];
    return moveItem(items, id, { ...columns[ci].slot, before: after?.id });
  }
  if (ci === columns.length - 1) return items;
  const next = columns[ci + 1];
  return moveItem(items, id, { ...next.slot, before: next.fields[0]?.id });
}

/** A new, empty section right after the given one. */
export function insertSectionAfter(items: DesignerItem[], where: { tab: number; section: number }, item: DesignerItem): DesignerItem[] {
  const tabs = toLayout(items);
  const tab = at(tabs, where.tab);
  tab.sections.splice(Math.min(where.section + 1, tab.sections.length), 0, { breakItem: item, columns: [{ fields: [] }] });
  return fromLayout(tabs);
}

/** A new tab at the end of the form. */
export function appendTab(items: DesignerItem[], item: DesignerItem): DesignerItem[] {
  const tabs = toLayout(items);
  tabs.push({ breakItem: item, sections: [{ columns: [{ fields: [] }] }] });
  return fromLayout(tabs);
}

/** Remove a section; what it holds moves to the end of the section before it (or after it, for a first section). */
export function removeSection(items: DesignerItem[], where: { tab: number; section: number }): DesignerItem[] {
  const tabs = toLayout(items);
  const sections = tabs[where.tab]?.sections;
  const section = sections?.[where.section];
  if (!section) return items;
  const fields = section.columns.flatMap((c) => c.fields);
  sections.splice(where.section, 1);
  if (sections.length === 0) sections.push({ columns: [{ fields: [] }] });
  const into = sections[Math.max(0, where.section - 1)];
  const last = into.columns[into.columns.length - 1];
  if (where.section === 0) last.fields.unshift(...fields); else last.fields.push(...fields);
  return fromLayout(tabs);
}

/** Remove a tab; its sections move to the end of the tab before it (or the next one, for the first tab). */
export function removeTab(items: DesignerItem[], tab: number): DesignerItem[] {
  const tabs = toLayout(items);
  const gone = tabs[tab];
  if (!gone || tabs.length < 2) return gone?.breakItem ? items.filter((i) => i.id !== gone.breakItem!.id) : items;
  tabs.splice(tab, 1);
  const into = tabs[Math.max(0, tab - 1)];
  if (tab === 0) into.sections.unshift(...gone.sections); else into.sections.push(...gone.sections);
  return fromLayout(tabs);
}

/** Move the tab (step) at `from` to `to`, with all its sections. The first tab stays first (it may have no break and
 *  holds the form's standard fields), so neither index may be 0; anything else returns `items` unchanged. */
export function moveTab(items: DesignerItem[], from: number, to: number): DesignerItem[] {
  const tabs = toLayout(items);
  if (from === to || from < 1 || to < 1 || from >= tabs.length || to >= tabs.length || !tabs[from].breakItem) return items;
  const [tab] = tabs.splice(from, 1);
  tabs.splice(to, 0, tab);
  return fromLayout(tabs);
}

/** The id just before `id` in the flat order, or null when it is first. */
export function previousId(items: DesignerItem[], id: string): string | null {
  const i = items.findIndex((r) => r.id === id);
  return i > 0 ? items[i - 1].id : null;
}
