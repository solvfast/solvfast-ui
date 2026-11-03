/**
 * usePermissions(bundle, doc, docinfo) — Desk's `frm.perm` and field display status (docs 10 §C6, 11 §2.5).
 * Roles and user come from FrappeProvider `session`; without roles nothing is granted beyond what the server said about
 * a saved doc (rule 9, `buildDocPermissions`) and `known` is false so the UI can say "permissions unknown".
 */
import * as React from "react";
import type { DocInfo, DocPermissions, FieldDisplayStatus, FrappeDoc, FrappeDocField, MetaBundle, PermType, WorkflowInfo } from "../contract";
import { workflowFromMeta } from "../client";
import { useFrappeSettings } from "../FrappeProvider";
import { buildDocPermissions, controlDisplayStatus, fieldDisplayStatus, isWorkflowReadOnly, permissionsKnown, readOnlyPermissions } from "../services/permissions";

export interface PermissionsResult {
  /** Rights per permlevel, as Desk's `frm.perm` (shrunk to read / cancel / share / print / email when the workflow
   *  state does not allow the user to edit). */
  levels: DocPermissions;
  can(ptype: PermType, permlevel?: number): boolean;
  /**
   * `frappe.perm.get_field_display_status` — exactly the ladder of docs 11 §2.5 (perm.js:191-267), with `levels`.
   * `doc`: the document the field belongs to (a child row for a table field's columns); `parent`: the form's doc when
   * `doc` is a row (used for the row's docstatus when the row has none). `df.hidden_due_to_dependency` is read from
   * the df: whoever evaluates `depends_on` (the form) sets it.
   */
  fieldStatus(df: FrappeDocField, doc: FrappeDoc, parent?: FrappeDoc): FieldDisplayStatus;
  /** `fieldStatus` + the form control's rules (BaseControl.get_status): a Write cell of a Read table becomes Read, a
   *  Read field with a blank value is hidden (None) except HTML / Image / Button / Geolocation. */
  displayStatus(df: FrappeDocField, doc: FrappeDoc, parent?: FrappeDoc, opts?: { gridCell?: boolean; onlyInput?: boolean }): FieldDisplayStatus;
  /** The DocType's active workflow (from the bundle's `__workflow_docs`), or null. */
  workflow: WorkflowInfo | null;
  /** True when the workflow state makes the doc read-only for this user (needs `session.roles`; without them a saved
   *  doc in a workflow is read-only — rule 9). */
  workflowReadOnly: boolean;
  /** False when the rights are the rule-9 denial for MISSING information (no `session.roles`, not Administrator, and no
   *  server-evaluated `docinfo.permissions` for a saved doc) — show "permissions unknown", not "forbidden". */
  known: boolean;
}

export function usePermissions(bundle?: MetaBundle, doc?: FrappeDoc, docinfo?: DocInfo): PermissionsResult {
  const { session } = useFrappeSettings();
  return React.useMemo(() => {
    const workflow = workflowFromMeta(bundle?.meta);
    const base = buildDocPermissions({ meta: bundle?.meta, children: bundle?.children, doc, docinfo, session });
    const workflowReadOnly = isWorkflowReadOnly(workflow, doc, session?.roles, session?.user);
    const known = permissionsKnown({ doc, docinfo, session });
    const levels = workflowReadOnly ? readOnlyPermissions(base) : base;
    const withRowDocstatus = (row: FrappeDoc, parent?: FrappeDoc): FrappeDoc =>
      parent && row !== parent && row.docstatus === undefined ? { ...row, docstatus: parent.docstatus } : row;
    const fieldStatus = (df: FrappeDocField, d: FrappeDoc, parent?: FrappeDoc) => fieldDisplayStatus(df, withRowDocstatus(d, parent), levels);
    const displayStatus: PermissionsResult["displayStatus"] = (df, d, parent, opts = {}) => {
      let gridStatus: FieldDisplayStatus | undefined;
      if (parent && d !== parent && typeof d.parentfield === "string") {
        const table = bundle?.meta.fields.find((f) => f.fieldname === d.parentfield);
        if (table) gridStatus = fieldDisplayStatus(table, parent, levels);
      }
      return controlDisplayStatus(fieldStatus(df, d, parent), df, d[df.fieldname], { gridStatus, ...opts });
    };
    return {
      levels,
      can: (ptype, permlevel = 0) => !!levels[permlevel]?.[ptype],
      fieldStatus,
      displayStatus,
      workflow,
      workflowReadOnly,
      known,
    };
  }, [bundle, doc, docinfo, session]);
}
