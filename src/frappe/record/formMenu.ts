/**
 * formMenuItems — which entries of Desk's form "⋯" menu apply, as a pure function (Frappe 15.110
 * `public/js/frappe/form/toolbar.js` `make_menu_items` :340-530 and `make_customize_buttons` :532-579). Desk order:
 *
 *  | id        | Desk rule (toolbar.js)                                                                                     |
 *  |-----------|------------------------------------------------------------------------------------------------------------|
 *  | print     | :345-355 not submittable, or submitted, or cancelled + Print Settings `allow_print_for_cancelled`, or draft  |
 *  |           | + `allow_print_for_draft`; and `frm.perm[0].print` (model.js:452-455) and not single. Package: also hidden  |
 *  |           | on a NEW document (the PDF / full page need a saved name — DIFFERS-INTENTIONALLY).                         |
 *  | email     | :379-391 `perm[0].email` and docstatus < 2; condition: not new. Shortcut Ctrl+E.                           |
 *  | links     | :404-412 not single. Package: also not new (nothing links to an unsaved name) and only when the host can   |
 *  |           | show the Connections (`has.links`).                                                                       |
 *  | duplicate | :413-422 boot `can_create` includes the DocType and NOT `meta.allow_copy` ("Hide Copy"). Shift+D.          |
 *  |           | Package: `can("create")`; needs the host's `onDuplicate` (`has.duplicate`).                                 |
 *  | copy      | :424-431 always ("Copy to Clipboard": `JSON.stringify(frm.doc)`).                                         |
 *  | rename    | :433-442 `can_rename()` :107-109 = `perm[0].write && meta.allow_rename && !doc.__islocal`.                 |
 *  | reload    | :444-451 always (reload_doc does nothing on a new doc, form.js:1309-1318). Package: not new; needs          |
 *  |           | `has.reload`; asks first when the form is dirty (Desk does not — DIFFERS-INTENTIONALLY, audit K10).        |
 *  | delete    | :453-473 docstatus != 1, not new, not single, `frappe.model.can_delete(doctype)` (boot, model.js:390-393). |
 *  |           | Package: `can("delete")`. Shift+Ctrl+D. Destructive, asks first (model.js:703-729 "Permanently delete").   |
 *  | remind    | :475-486 condition: not new. Shift+R.                                                                    |
 *  | undo/redo | :488-511 always (condition: not the form builder). Package: only with the host's undo state (`undo`);     |
 *  |           | disabled when nothing to undo / redo. Ctrl+Z / Ctrl+Y.                                                    |
 *  | customize | :532-563 `can_create("Custom Field") && can_create("Property Setter")` — both DocTypes grant create to     |
 *  |           | System Manager / Administrator only (custom_field.json, property_setter.json) — the DocType is not        |
 *  |           | "DocType", and `meta.issingle === 0`. Target: the DocType form for a custom DocType, else Customize Form.   |
 *  | new       | :514-529 `perm[0].create`, not single, not `meta.in_create`; condition: not new. Shortcut Ctrl+B.          |
 *
 * Not reproduced: "Jump to field" (Ctrl+J), "Edit DocType" (developer mode), "Repeat" (Auto Repeat), "Print" action
 * icon. Shortcuts are HINTS: the menu does not bind keys (the host may).
 * The rights are the client's mirror (`usePermissions`); the server re-checks every action.
 */
import type { DocTypeMeta, FrappeDoc, PermType } from "../contract";
import type { PrintSettingsInput } from "../list/print";

export type FormMenuId = "print" | "email" | "links" | "duplicate" | "copy" | "rename" | "reload" | "delete" | "remind" | "undo" | "redo" | "customize" | "new";
export const FORM_MENU_ORDER: readonly FormMenuId[] = ["print", "email", "links", "duplicate", "copy", "rename", "reload", "delete", "remind", "undo", "redo", "customize", "new"];

export interface FormMenuEntry {
  id: FormMenuId;
  /** Separator groups: output (print, email, links), document, history (undo / redo), setup (customize, new). */
  group: "output" | "document" | "history" | "setup";
  shortcut?: string;
  destructive?: boolean;
  /** Ask before running. */
  confirm?: boolean;
  disabled?: boolean;
}

export interface FormMenuInput {
  meta: DocTypeMeta;
  doc: FrappeDoc;
  /** Level-0 rights (`usePermissions(...).can`). */
  can: (ptype: PermType) => boolean;
  /** The form has unsaved changes. */
  dirty?: boolean;
  /** Print Settings from the host's boot (`allow_print_for_draft` default 1, `allow_print_for_cancelled` default 0). */
  printSettings?: PrintSettingsInput;
  /** The session's roles (Customize needs System Manager / Administrator). Unknown → no Customize. */
  roles?: readonly string[];
  /** Host capabilities: entries whose action the host must provide are left out when false / missing. */
  has?: Partial<Record<"links" | "duplicate" | "reload" | "new" | "remind" | "print" | "email" | "customize", boolean>>;
  /** Host undo state: undo / redo appear only with it. */
  undo?: { canUndo: boolean; canRedo: boolean };
  /** Leave these ids out. */
  exclude?: readonly string[];
}

const on = (v: unknown) => v === true || v === 1 || v === "1";
const isNew = (doc: FrappeDoc) => on(doc.__islocal);

/** Desk's print status rule (toolbar.js:345-355). */
export function printAllowedForStatus(meta: DocTypeMeta, doc: FrappeDoc, settings?: PrintSettingsInput): boolean {
  const ds = Number(doc.docstatus ?? 0);
  const draft = settings?.allow_print_for_draft ?? 1;
  const cancelled = settings?.allow_print_for_cancelled ?? 0;
  return !on(meta.is_submittable) || ds === 1 || (on(cancelled) && ds === 2) || (on(draft) && ds === 0);
}

/** Customize target (toolbar.js:545-559): a custom DocType opens its DocType form, any other Customize Form. Desk URLs. */
export function customizeHref(meta: DocTypeMeta): string {
  return on(meta.custom) ? `/app/doctype/${encodeURIComponent(meta.name)}` : `/app/customize-form?doc_type=${encodeURIComponent(meta.name)}`;
}

/** The applicable menu entries in Desk order (see the table above). */
export function formMenuItems(input: FormMenuInput): FormMenuEntry[] {
  const { meta, doc, can, printSettings, roles, has = {}, undo, exclude = [] } = input;
  const single = on(meta.issingle);
  const fresh = isNew(doc);
  const ds = Number(doc.docstatus ?? 0);
  const out: FormMenuEntry[] = [];
  const add = (e: FormMenuEntry, when: boolean) => { if (when && !exclude.includes(e.id)) out.push(e); };

  add({ id: "print", group: "output" }, has.print !== false && !single && !fresh && can("print") && printAllowedForStatus(meta, doc, printSettings));
  add({ id: "email", group: "output", shortcut: "Ctrl+E" }, has.email !== false && !fresh && can("email") && ds < 2);
  add({ id: "links", group: "output" }, !!has.links && !single && !fresh);
  add({ id: "duplicate", group: "document", shortcut: "Shift+D" }, !!has.duplicate && can("create") && !on(meta.allow_copy));
  add({ id: "copy", group: "document" }, true);
  add({ id: "rename", group: "document" }, !fresh && can("write") && on(meta.allow_rename));
  add({ id: "reload", group: "document", confirm: !!input.dirty }, !!has.reload && !fresh);
  add({ id: "delete", group: "document", shortcut: "Shift+Ctrl+D", destructive: true, confirm: true }, ds !== 1 && !fresh && !single && can("delete"));
  add({ id: "remind", group: "document", shortcut: "Shift+R" }, has.remind !== false && !fresh);
  add({ id: "undo", group: "history", shortcut: "Ctrl+Z", disabled: !undo?.canUndo }, !!undo);
  add({ id: "redo", group: "history", shortcut: "Ctrl+Y", disabled: !undo?.canRedo }, !!undo);
  const manager = !!roles && (roles.includes("System Manager") || roles.includes("Administrator"));
  add({ id: "customize", group: "setup" }, has.customize !== false && manager && meta.name !== "DocType" && !single);
  add({ id: "new", group: "setup", shortcut: "Ctrl+B" }, !!has.new && !fresh && can("create") && !single && !on(meta.in_create));
  return out;
}
