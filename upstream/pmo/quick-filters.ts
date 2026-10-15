/**
 * Quick-filter helpers. Quick filters are inline dropdowns/inputs for a small, per-page-customizable set
 * of fields. They write into the SAME FilterQuery as the advanced builder (so the two stay in sync), using
 * a stable `q:<field>` condition id per quick field. Which fields appear as quick filters is persisted per
 * list view in localStorage (mirrors Frappe CRM's customizable quick filters).
 */
import { mockStore } from "@/lib/api";
import type { FilterQuery, FilterField, Operator } from "@/lib/filter-engine";

export const QUICK_ANY = "__any__";

const PREFS_KEY = "pmo_quick_filter_prefs";

type Prefs = Record<string, string[]>; // viewKey -> [fieldName]

const readPrefs = (): Prefs => mockStore.read<Prefs>(PREFS_KEY, {});

/** The fields currently shown as quick filters for a view (falls back to `defaults` when unset). */
export function getQuickPrefs(view: string, defaults: string[]): string[] {
  const stored = readPrefs()[view];
  return stored ?? defaults;
}

export function setQuickPrefs(view: string, fields: string[]): void {
  const prefs = readPrefs();
  prefs[view] = fields;
  mockStore.write(PREFS_KEY, prefs);
}

/** Default operator used by a quick filter of a given field type. */
export function quickOperator(field: FilterField): Operator {
  switch (field.type) {
    case "text": return "like";
    default: return "equals";
  }
}

const quickId = (field: string) => `q:${field}`;

/** Current value of the quick filter for a field (empty string if none). */
export function getQuickValue(query: FilterQuery, field: string): string {
  const c = query.conditions.find((x) => x.id === quickId(field));
  return c ? c.value : "";
}

/** Upsert (or clear, when value is empty) the quick condition for a field. */
export function setQuickValue(query: FilterQuery, field: FilterField, value: string): FilterQuery {
  const id = quickId(field.name);
  const conditions = query.conditions.filter((c) => c.id !== id);
  if (value !== "" && value !== QUICK_ANY) {
    conditions.push({ id, field: field.name, operator: quickOperator(field), value });
  }
  return { ...query, conditions };
}
