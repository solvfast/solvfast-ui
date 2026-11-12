// A field defined on the form itself (FieldDesigner's own fields): every property a field of a field set has, in Sayr's
// Field Library terms. Which properties a type takes is the adapter's field-type registry, not a list here.

import type { Localized } from "../lib/localized";

/** A record link's filter: only records where `field operator value` are offered. */
export interface FieldLinkFilter { field: string; operator: string; value?: unknown }

export interface FieldDefinition {
  /** The field's name in conditions and its column's stem; fixed once saved (derived from the label until then). */
  key?: string;
  /** A registry type key (`text`, `dropdown`, `record_link` …). */
  type: string;
  label: string;
  labelAr?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  /** Choice types: the options, in order. */
  choices?: { en: string; ar?: string }[];
  /** A record type (record link), a child table (table, multi-select) or a sibling field's key (dynamic link, image). */
  linkTarget?: string;
  linkFilters?: FieldLinkFilter[];
  dataSubtype?: string;
  maxRating?: number;
  precision?: string;
  nonNegative?: boolean;
  unique?: boolean;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  /** Conditions, as written (e.g. `priority == "High"`): may name any field of the form. */
  showWhen?: string;
  requiredWhen?: string;
  readOnlyWhen?: string;
  /** Auto-fill: the key of a record link on this form, and the field of the linked record to copy. */
  fetchFrom?: string;
  fetchSource?: string;
  fetchOnlyWhenEmpty?: boolean;
  inListView?: boolean;
  useAsFilter?: boolean;
  globalSearch?: boolean;
  bold?: boolean;
  hidden?: boolean;
  readOnly?: boolean;
  translatable?: boolean;
}

/** A registry property a type's inspector asks for. */
export type FieldTypeProperty =
  | "choices" | "doctype_target" | "child_target" | "sibling_field" | "data_subtype" | "max_rating" | "precision"
  | "non_negative" | "max_length" | "bounds" | "default" | "placeholder" | "unique" | "autofill" | "collapsible";

/** Every registry property the inspector has a control for. `collapsible` is not one: only a Section Break takes it,
 *  and sections are placed on the form, not defined as fields. */
export const INSPECTED_PROPERTIES: readonly FieldTypeProperty[] = [
  "choices", "doctype_target", "child_target", "sibling_field", "data_subtype", "max_rating", "precision",
  "non_negative", "max_length", "bounds", "default", "placeholder", "unique", "autofill",
];

export interface FieldTypeInfo {
  key: string;
  label: Localized;
  group: string;
  props: FieldTypeProperty[];
}

/** The field types a form's own fields may take (layout types are placed, not defined). */
export interface FieldTypeRegistry {
  types: FieldTypeInfo[];
  groups: { group: string; types: string[] }[];
  dataSubtypes: string[];
  linkOperators?: string[];
}

export const LINK_OPERATORS = ["=", "!=", "like", "not like", "in", "not in", "is", ">", "<", ">=", "<="];

/** Frappe's rule for a Custom Field's name, in English letters only and starting with a letter (Sayr's field key). */
export const keyFromLabel = (text: string) =>
  text.replace(/ /g, "_").replace(/[^A-Za-z0-9_]/g, "").toLowerCase().replace(/^_+/, "").replace(/^(\d)/, "f$1");

/** A key for a new field: from its label, numbered past those taken. */
export function deriveKey(label: string, taken: Set<string>, fallback = "field"): string {
  const base = keyFromLabel(label) || fallback;
  let key = base;
  for (let n = 2; taken.has(key); n++) key = `${base}_${n}`;
  taken.add(key);
  return key;
}

/** What a type change keeps: the label, help text, conditions and display; what the old type alone took is dropped. */
export function retype(def: FieldDefinition, type: string): FieldDefinition {
  const { key, label, labelAr, description, required, showWhen, requiredWhen, readOnlyWhen,
    inListView, useAsFilter, globalSearch, bold, hidden, readOnly, translatable } = def;
  return { key, type, label, labelAr, description, required, showWhen, requiredWhen, readOnlyWhen,
    inListView, useAsFilter, globalSearch, bold, hidden, readOnly, translatable };
}

/** Why a definition cannot be saved yet, or null: the field set's own rules that the inspector can see. */
export function definitionProblem(def: FieldDefinition, info: FieldTypeInfo | undefined): "label" | "choices" | "target" | null {
  if (!(def.label ?? "").trim() && !(def.labelAr ?? "").trim()) return "label";
  const asks = (p: FieldTypeProperty) => !!info?.props.includes(p);
  if (asks("choices") && !(def.choices ?? []).some((c) => c.en.trim())) return "choices";
  if ((asks("doctype_target") || asks("child_target") || asks("sibling_field")) && !def.linkTarget) return "target";
  return null;
}

/** Every own field's key by item id, in form order: a saved key stays, a new field's comes from its label, numbered
 *  past the keys already taken. The designer's preview and the adapter's save use the same answer. */
export function ownKeys(items: { id: string; definition?: FieldDefinition }[]): Map<string, string> {
  const own = items.filter((i) => i.definition);
  const taken = new Set(own.map((i) => i.definition!.key).filter(Boolean) as string[]);
  return new Map(own.map((i) => [i.id, i.definition!.key || deriveKey(i.definition!.label || "", taken)]));
}
