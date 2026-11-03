/**
 * Display status of a field (docs `11` §2.5, `12` §1.3).
 *
 * `ladderStatus` is the `frappe.perm.get_field_display_status` ladder — the foundation's `fieldStatus` (CONTRACT §2)
 * is the authority in a connected form; this pure copy is the fallback for forms that are not given one (and for
 * tests). Steps: permlevel write (and not disabled / virtual) → Write, read → Read, else None; `hidden` → None;
 * `hidden_due_to_dependency` → None; docstatus > 0 demotes Write to Read; Read + allow_on_submit + docstatus 1 +
 * permlevel write → Write; workflow-controlled fields stay Read (`workflowReadOnly`); read_only / Read Only → Read;
 * set_only_once on a saved document → Read. Without permissions (a dialog / standalone field): hidden → None,
 * read_only / virtual / Read Only → Read, else Write.
 *
 * `controlStatus` adds the control-level rules (BaseControl.get_status, base_input.js): a grid in Read makes its cells
 * Read (except allow_on_submit); a `fetch_from` field is Read while its link has a value (unless fetch_if_empty); a
 * Read field with an empty value is not shown (None), except HTML / Image / Button / Geolocation / Heading.
 */
import type { DocPermissions, FieldDisplayStatus, FrappeDoc, FrappeDocField } from "../../contract";
import { isEmptyValue, type EffectiveField } from "./depends";
import { isReadOnlyByFetch } from "./fetch";
import { SHOW_WHEN_EMPTY } from "./fieldtypes";

export function ladderStatus(df: EffectiveField, doc: FrappeDoc, perms?: DocPermissions, opts: { workflowReadOnly?: boolean } = {}): FieldDisplayStatus {
  const ro = !!df.read_only || df.fieldtype === "Read Only";
  if (!perms) {
    if (df.hidden || df.hidden_due_to_dependency) return "None";
    return ro || df.is_virtual ? "Read" : "Write";
  }
  const level = perms[df.permlevel ?? 0] ?? {};
  let status: FieldDisplayStatus = level.write && !df.disabled && !df.is_virtual ? "Write" : level.read ? "Read" : "None";
  if (df.hidden) status = "None";
  if (df.hidden_due_to_dependency) status = "None";
  if (status === "Write" && (doc.docstatus ?? 0) > 0) status = "Read";
  if (status === "Read" && df.allow_on_submit && doc.docstatus === 1 && level.write) status = "Write";
  if (status === "Write" && opts.workflowReadOnly) status = "Read";
  if (status === "Write" && ro) status = "Read";
  if (status === "Write" && df.set_only_once && !doc.__islocal) status = "Read";
  return status;
}

export function controlStatus(status: FieldDisplayStatus, df: FrappeDocField, doc: FrappeDoc, opts: { gridStatus?: FieldDisplayStatus } = {}): FieldDisplayStatus {
  let s = status;
  if (s === "Write" && opts.gridStatus === "Read" && !df.allow_on_submit) s = "Read";
  if (s === "Write" && isReadOnlyByFetch(df, doc)) s = "Read";
  if (s === "Read" && !SHOW_WHEN_EMPTY.has(df.fieldtype) && isEmptyValue(doc[df.fieldname])) s = "None";
  return s;
}
