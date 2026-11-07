/**
 * Quick Entry eligibility — a literal port of Frappe 15.110 `QuickEntryForm` (public/js/frappe/form/quick_entry.js:59-110):
 *  - fields: every DocField with `reqd` or `allow_in_quick_entry`, not `read_only`, not `is_virtual`, not a Tab Break
 *    (`set_meta_and_mandatory_fields`, :59-71) — breaks that are `allow_in_quick_entry` stay in (they shape the dialog);
 *  - a Prompt-named DocType gets the "{DocType} Name" (`__newname`) field first (`validate_for_prompt_autoname`, :112-122);
 *  - eligible only when `meta.quick_entry` is 1 (:80-83), no field of the list is a `Table` (Table MultiSelect does not
 *    count, `has_child_table` :96-107) and the list is not empty (:87). `too_many_mandatory_fields` (:89-95) exists in
 *    Desk but is never called — so there is no field-count limit here either.
 */
import type { DocTypeMeta, FrappeDocField } from "../../contract";

export type QuickEntryReason = "not-quick-entry" | "mandatory-table" | "no-fields";

export interface QuickEntryFields {
  eligible: boolean;
  /** The dialog's fields (with `__newname` first for Prompt naming). */
  fields: FrappeDocField[];
  /** Why the full form opens instead (absent when eligible). */
  reason?: QuickEntryReason;
}

const on = (v: unknown) => !!v && v !== "0";

export function quickEntryFields(meta: DocTypeMeta): QuickEntryFields {
  let fields = (meta.fields ?? []).filter((df) => (on(df.reqd) || on(df.allow_in_quick_entry)) && !on(df.read_only) && !on(df.is_virtual) && df.fieldtype !== "Tab Break");
  if (Number(meta.quick_entry) !== 1) return { eligible: false, fields, reason: "not-quick-entry" };
  if (String(meta.autoname ?? "").toLowerCase() === "prompt") {
    fields = [{ fieldname: "__newname", fieldtype: "Data", label: `${meta.name} Name`, reqd: 1 }, ...fields];
  }
  if (fields.some((df) => df.fieldtype === "Table")) return { eligible: false, fields, reason: "mandatory-table" };
  if (!fields.length) return { eligible: false, fields, reason: "no-fields" };
  return { eligible: true, fields };
}

/** The `fieldFilter` for FrappeFormView that shows exactly the Quick Entry fields. */
export function quickEntryFilter(meta: DocTypeMeta): (df: FrappeDocField) => boolean {
  const names = new Set(quickEntryFields(meta).fields.map((f) => f.fieldname));
  return (df) => names.has(df.fieldname);
}
