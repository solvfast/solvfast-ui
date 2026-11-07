/**
 * Toolbar primary / secondary action (toolbar.js `get_action_status` :668 + `set_page_actions` :694; docs `11` §7,
 * §5.1–5.4), as a pure function. First match wins:
 *  1. Submit — docstatus 0, saved, not dirty, submit permission, submittable, no active workflow;
 *  2. Save — docstatus 0, save not disabled; with a workflow only when dirty;
 *  3. Update — docstatus 1, saved, submit permission, dirty;
 *  4. Cancel — docstatus 1, cancel permission; a SECONDARY button; with a workflow only when no transition leads to a
 *     cancelled state (`canCancelWithWorkflow`, from `can_cancel_document`). NOT while Update is offered: Desk's
 *     ladder is an else-if chain (toolbar.js:668-689), and cancelling a dirty submitted doc would reload it from the
 *     database and drop the `allow_on_submit` edits (P35 F5; before 0.7 both buttons showed);
 *  5. Amend — docstatus 2, amend AND create permission (Desk's `amend_doc` → `copy_doc` → `validate_form_action("Create")`,
 *     form.js:1297-1298; P35 F8 — before 0.7 amend alone), disabled when already amended.
 * The chosen action is then re-checked against the permission it maps to (Save → write — `create` for a new document
 * (UNVERIFIED: Desk checks `write` in frm.perm, which for new documents normally comes with `create`), Submit/Update →
 * submit, Cancel → cancel, Amend → amend). When workflow actions exist and the form is clean, the workflow replaces
 * these buttons (decided by the caller via `workflowActionsShown`).
 */
export type FormAction = "Save" | "Submit" | "Update" | "Cancel" | "Amend";

export interface ActionInput {
  docstatus: 0 | 1 | 2;
  isNew: boolean;
  dirty: boolean;
  isSubmittable: boolean;
  perms: Partial<Record<"write" | "create" | "submit" | "cancel" | "amend", boolean>>;
  hasWorkflow?: boolean;
  /** `can_cancel_document` for a workflow DocType (default true). */
  canCancelWithWorkflow?: boolean;
  saveDisabled?: boolean;
  /** Workflow action buttons are showing (they hide primary and secondary). */
  workflowActionsShown?: boolean;
  alreadyAmended?: boolean;
}

export interface ActionResult {
  primary: FormAction | null;
  secondary: "Cancel" | null;
  /** Amend is shown but disabled ("Already amended"). */
  primaryDisabled?: boolean;
}

export function formActions(a: ActionInput): ActionResult {
  if (a.workflowActionsShown && !a.dirty) return { primary: null, secondary: null };
  const can = (p: keyof ActionInput["perms"]) => !!a.perms[p];
  let primary: FormAction | null = null;
  let secondary: "Cancel" | null = null;
  if (a.docstatus === 0) {
    if (!a.isNew && !a.dirty && a.isSubmittable && can("submit") && !a.hasWorkflow) primary = "Submit";
    else if (!a.saveDisabled && (!a.hasWorkflow || a.dirty)) primary = "Save";
  } else if (a.docstatus === 1) {
    if (!a.isNew && a.dirty && can("submit")) primary = "Update";
    else if (can("cancel") && (!a.hasWorkflow || a.canCancelWithWorkflow !== false)) secondary = "Cancel";
  } else if (a.docstatus === 2) {
    if (can("amend") && can("create")) primary = "Amend";
  }
  if (primary === "Save" && !(a.isNew ? can("create") || can("write") : can("write"))) primary = null;
  if ((primary === "Submit" || primary === "Update") && !can("submit")) primary = null;
  return { primary, secondary, primaryDisabled: primary === "Amend" && !!a.alreadyAmended };
}
