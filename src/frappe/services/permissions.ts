/**
 * Permissions as Desk computes them on the client (model/perm.js; docs 10 §C6, 11 §2.5). Re-implemented from the
 * documented behaviour. The SERVER is the authority: these reproduce Desk's UX (what is shown, enabled, read-only);
 * nothing is skipped because the client checked it.
 *
 * Inputs Desk has and a React app must supply (see `FrappeSession`): the user and their ROLES. Desk builds the rights
 * per permlevel from the DocType's DocPerm rows × the user's roles (perm.js get_role_permissions), then overlays the
 * document's `docinfo.permissions` (server-evaluated: ownership, user permissions, sharing) on level 0.
 * Without roles (no session supplied) nothing is inferred: Phase 26 rule 9 — missing information DENIES (see
 * `buildDocPermissions`, `permissionsKnown`). The Administrator is the one exception (the server grants it everything).
 */
import type { DocInfo, DocPerm, DocPermissions, DocTypeMeta, FieldDisplayStatus, FrappeDoc, FrappeDocField, PermType, WorkflowInfo } from "../contract";

export const PERM_TYPES: PermType[] = ["select", "read", "write", "create", "delete", "submit", "cancel", "amend", "report", "import", "export", "print", "email", "share"];

/** Who is logged in. Desk has it in `frappe.session.user` and `frappe.user_roles` (boot). */
export interface FrappeSession {
  user: string;
  fullName?: string;
  /** The user's roles (incl. "All", "Guest" as Frappe lists them). Without them, permissions are approximated. */
  roles?: string[];
}

const truthy = (v: unknown) => !!v && v !== "0";

/** Role permissions per permlevel (perm.js get_role_permissions): a right at a level if ANY of the user's roles grants
 *  it. For level 0 also the rights granted by rows without `if_owner` (`rightsWithoutIfOwner`). */
export function rolePermissions(perms: DocPerm[] | undefined, roles: string[]): { levels: DocPermissions; rightsWithoutIfOwner: Set<PermType> } {
  const levels: DocPermissions = [{ read: false }];
  const withoutIfOwner = new Set<PermType>();
  for (const p of perms ?? []) {
    const level = Number(p.permlevel) || 0;
    const cur = (levels[level] ??= {});
    if (!roles.includes(p.role)) continue;
    for (const right of PERM_TYPES) {
      if (!truthy(p[right])) continue;
      cur[right] = true;
      if (level === 0 && !truthy(p.if_owner)) withoutIfOwner.add(right);
    }
  }
  for (let i = 0; i < levels.length; i++) levels[i] ??= {};
  return { levels, rightsWithoutIfOwner: withoutIfOwner };
}

/** Permlevels the DocType uses (fields and DocPerm rows), always including 0. */
function permlevelsOf(meta: DocTypeMeta | undefined, children?: Record<string, DocTypeMeta>): number[] {
  const set = new Set<number>([0]);
  for (const f of meta?.fields ?? []) set.add(Number(f.permlevel) || 0);
  for (const c of Object.values(children ?? {})) for (const f of c.fields ?? []) set.add(Number(f.permlevel) || 0);
  for (const p of meta?.permissions ?? []) set.add(Number(p.permlevel) || 0);
  return [...set].sort((a, b) => a - b);
}

export interface BuildPermissionsInput {
  meta?: DocTypeMeta;
  /** Child-table metas (their permlevels count for the Administrator's levels). */
  children?: Record<string, DocTypeMeta>;
  doc?: FrappeDoc;
  docinfo?: DocInfo;
  session?: FrappeSession;
}

/** The server grants the Administrator everything, unconditionally (permissions.py:107-109 `has_permission`,
 *  :288-290 `allow_everything`); Desk lists every role in `frappe.user_roles` for it (perm.js:62-64 sets read). */
export const isAdministrator = (session: FrappeSession | undefined) => session?.user === "Administrator" || !!session?.roles?.includes("Administrator");

/** The server's `docinfo.shared` row of this user adds read / write / submit / share (perm.js:88-96; share.py:155). */
function applyShared(base: Partial<Record<PermType, boolean>>, docinfo: DocInfo | undefined, user: string | undefined) {
  if (!user) return;
  for (const s of (docinfo?.shared ?? []) as Record<string, unknown>[]) {
    if (s.user !== user) continue;
    for (const right of ["read", "write", "submit", "share"] as const) if (!base[right]) base[right] = truthy(s[right]);
  }
}

/**
 * Whether the rights `buildDocPermissions` returns are KNOWN (computed from the information Desk has) or the rule-9
 * denial for missing information: true with `session.roles`, for the Administrator, and for a saved doc whose
 * `docinfo.permissions` the server evaluated (level 0 only — permlevels > 0 stay denied without roles).
 * A UI shows "permissions unknown / read only" when this is false (`usePermissions().known`).
 */
export function permissionsKnown({ doc, docinfo, session }: Pick<BuildPermissionsInput, "doc" | "docinfo" | "session">): boolean {
  if (isAdministrator(session) || !!session?.roles) return true;
  return !!doc && !doc.__islocal && !!docinfo?.permissions;
}

/**
 * `frappe.perm.get_perm(doctype, doc)` (perm.js:42-117):
 *  - a new doc (`__islocal`) or no doc → role permissions only;
 *  - a saved doc → role permissions, then every key of `docinfo.permissions` copied onto level 0, then for a
 *    non-owner the level-0 rights granted ONLY by `if_owner` rows are removed, then the user's `docinfo.shared` row
 *    adds read / write / submit / share (Desk also sets email / print from boot `can_email` / `can_print` — not
 *    available here, left as they are).
 *  - Administrator: every right at every permlevel (the server never checks further, permissions.py:107-109).
 *  - No meta → read for the Administrator only (perm.js:62-70; boot `can_read` is not available here).
 * RULE 9 (Phase 26 D: missing information DENIES) without `session.roles` and not Administrator:
 *  - a saved doc: level 0 = exactly the server-evaluated `docinfo.permissions` (ownership, user permissions and
 *    `if_owner` already applied by `get_doc_permissions`, permissions.py:196-250) plus the user's `docinfo.shared` row
 *    (server-evaluated too, load.py:130). Permlevels > 0: nothing — Desk reads them from the role rows, which are
 *    missing; the former inference from "the doc carries a field of that level" is no longer made.
 *  - a NEW doc or no doc: nothing (no read / write / create). Before dev.26 this was optimistic (read / write / create).
 *  `permissionsKnown` tells a UI that this denial is for lack of information.
 */
export function buildDocPermissions({ meta, children, doc, docinfo, session }: BuildPermissionsInput): DocPermissions {
  const roles = session?.roles;
  const saved = !!doc && !doc.__islocal;
  const admin = isAdministrator(session);
  if (!meta) return [{ read: admin }];

  if (admin) {
    const levels: DocPermissions = [];
    const everything = Object.fromEntries(PERM_TYPES.map((r) => [r, true])) as Partial<Record<PermType, boolean>>;
    for (const level of permlevelsOf(meta, children)) levels[level] = { ...everything };
    for (let i = 0; i < levels.length; i++) levels[i] ??= {};
    return levels;
  }

  if (!roles) {
    const base: Partial<Record<PermType, boolean>> = {};
    if (saved && docinfo?.permissions) {
      for (const [k, v] of Object.entries(docinfo.permissions)) if (PERM_TYPES.includes(k as PermType)) base[k as PermType] = truthy(v);
      applyShared(base, docinfo, session?.user);
    }
    const levels: DocPermissions = [base];
    for (const level of permlevelsOf(meta, children)) levels[level] ??= {};
    return levels;
  }

  const { levels, rightsWithoutIfOwner } = rolePermissions(meta.permissions, roles);
  if (saved) {
    const base = levels[0];
    for (const [k, v] of Object.entries(docinfo?.permissions ?? {})) if (PERM_TYPES.includes(k as PermType)) base[k as PermType] = truthy(v);
    if (doc.owner !== session?.user) for (const right of PERM_TYPES) if (base[right] && !rightsWithoutIfOwner.has(right)) base[right] = false;
    applyShared(base, docinfo, session?.user);
  }
  return levels;
}

/** `frm.set_read_only()` (form.js:1763): keep only read / cancel / share / print / email at every level. */
export function readOnlyPermissions(levels: DocPermissions): DocPermissions {
  return levels.map((p) => ({ read: p?.read, cancel: p?.cancel, share: p?.share, print: p?.print, email: p?.email }));
}

/**
 * `frappe.workflow.is_read_only` (model/workflow.js:53-70): a saved doc in a workflow is read-only when the user has none
 * of the roles in `allow_edit` of the doc's current state (state field, else the default state for its docstatus).
 * Needs the roles. Without them → read-only (rule 9: missing information denies; before dev.26 this answered false),
 * except for the Administrator (`user`), who holds every role (perm.js:62-64). The server validates transitions anyway.
 */
export function isWorkflowReadOnly(workflow: WorkflowInfo | null | undefined, doc: FrappeDoc | undefined, roles: string[] | undefined, user?: string): boolean {
  if (!workflow || !doc || doc.__islocal) return false;
  if (user === "Administrator" || roles?.includes("Administrator")) return false;
  if (!roles) return true;
  const state = (doc[workflow.workflow_state_field] as string | undefined) || workflow.states.find((s) => Number(s.doc_status) === Number(doc.docstatus ?? 0))?.state;
  if (!state) return false;
  const allowed = workflow.states.filter((s) => s.state === state).map((s) => s.allow_edit);
  return !roles.some((r) => allowed.includes(r));
}

/** Desk's `cint`: numbers truncate, booleans count (Desk sets `hidden_due_to_dependency = true`), strings parse. */
const cint = (v: unknown) => (typeof v === "number" ? Math.trunc(v) : typeof v === "boolean" ? Number(v) : parseInt(String(v ?? ""), 10) || 0);

/**
 * `frappe.perm.get_field_display_status(df, doc, perm)` (perm.js:191-267; docs 11 §2.5), step by step:
 *  0. no `perm` → hidden / hidden_due_to_dependency → None; read_only / is_virtual → Read; else Write.
 *  1. permission at `df.permlevel` (0): write and not `disabled` and not `is_virtual` → Write; else read → Read; else None.
 *  2. `hidden` → None.  3. `hidden_due_to_dependency` → None (set on the df by whoever evaluates depends_on — forms).
 *     No doc → stop here.
 *  4. Write on a doc with docstatus > 0 → Read.
 *  5. Read + `allow_on_submit` + docstatus 1 + write at that level → Write.
 *  6. Workflow: in Desk this step only re-asserts Read on a field that is already Read (it can never change the
 *     status) — reproduced as a no-op. Workflow read-only comes from the shrunk `perm` (`readOnlyPermissions`).
 *  7. Write + (`read_only` or fieldtype "Read Only") → Read.
 *  8. Write + `set_only_once` + saved doc → Read.
 */
export function fieldDisplayStatus(df: FrappeDocField, doc: FrappeDoc | undefined, perm: DocPermissions | undefined): FieldDisplayStatus {
  if (!perm) {
    if (cint(df.hidden) || cint(df.hidden_due_to_dependency)) return "None";
    return cint(df.read_only) || cint(df.is_virtual) ? "Read" : "Write";
  }
  const p = perm[Number(df.permlevel) || 0];
  let status: FieldDisplayStatus = "None";
  if (p) {
    if (p.write && !df.disabled && !df.is_virtual) status = "Write";
    else if (p.read) status = "Read";
  }
  if (cint(df.hidden)) status = "None";
  if (cint(df.hidden_due_to_dependency)) status = "None";
  if (!doc) return status;
  if (status === "Write" && cint(doc.docstatus) > 0) status = "Read";
  if (status === "Read" && cint(df.allow_on_submit) && cint(doc.docstatus) === 1 && p?.write) status = "Write";
  // step 6 (workflow) intentionally a no-op — see above
  if (status === "Write" && (cint(df.read_only) || df.fieldtype === "Read Only")) status = "Read";
  if (status === "Write" && df.set_only_once && !doc.__islocal) status = "Read";
  return status;
}

/** Blank as Desk's `is_null`: null, undefined or a string of spaces. 0 is a value. */
export const isNullValue = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/**
 * The form control's extra rules on top of `fieldDisplayStatus` (BaseControl.get_status, base_control.js:94-133):
 *  - inside a child table whose own status is Read, a Write cell becomes Read (except `allow_on_submit` fields in the row
 *    form; Desk's grid cells inherit even then — `gridCell: true`);
 *  - a Read field whose value is blank is hidden (None), except HTML / Image / Button / Geolocation, and except when only
 *    the input is rendered (grid cells, `onlyInput`).
 */
export function controlDisplayStatus(
  status: FieldDisplayStatus, df: FrappeDocField, value: unknown,
  opts: { gridStatus?: FieldDisplayStatus; gridCell?: boolean; onlyInput?: boolean } = {},
): FieldDisplayStatus {
  let s = status;
  if (s === "Write" && opts.gridStatus === "Read" && (opts.gridCell || !cint(df.allow_on_submit))) s = "Read";
  if (s === "Read" && !opts.onlyInput && isNullValue(value) && !["HTML", "Image", "Button", "Geolocation"].includes(df.fieldtype)) s = "None";
  return s;
}

/** `read_only_because_of_fetch_from` (base_input.js:56-62): a fetched field (not `fetch_if_empty`) is shown read-only
 *  while its source link field has a value, whatever its status. */
export function isFetchLocked(df: FrappeDocField, doc: FrappeDoc | undefined): boolean {
  if (!df.fetch_from || cint(df.fetch_if_empty) || !doc) return false;
  const link = df.fetch_from.split(".")[0];
  return !isNullValue(doc[link]);
}

// ---- DocType-level rights Desk checks on the client before offering Import / Export (model.js:434-450) ---------------

/** Rights at level 0 as `rolePermissions(meta.permissions, roles).levels[0]`, or `usePermissions().levels[0]`. */
export type Level0Rights = Partial<Record<PermType, boolean>> | undefined;
const isSystemManager = (roles: readonly string[] | undefined) => !!roles?.includes("System Manager") || !!roles?.includes("Administrator");

/**
 * `frappe.model.can_import(doctype, frm, meta)` (model.js:434-442) and the server's `can_import` (permissions.py:600-606):
 * the DocType must have `allow_import`; then System Manager always may, otherwise the level-0 `import` right.
 * NEVER read this off a loaded document's `docinfo.permissions`: the server forces `permissions["import"] = 0` there
 * (permissions.py:221); Import is a DocType-level right. No roles → false (Phase 26 rule 9: missing information denies).
 * The server re-validates on `Data Import` insert (data_import.py:59-75); this only decides what the UI offers.
 */
export function canImport(meta: Pick<DocTypeMeta, "allow_import"> | undefined, roles: readonly string[] | undefined, level0: Level0Rights): boolean {
  if (!meta || !truthy(meta.allow_import)) return false;
  if (isSystemManager(roles)) return true;
  return !!roles && !!level0?.import;
}

/**
 * `frappe.model.can_export(doctype, frm)` (model.js:444-450) and the server's `can_export` (permissions.py:609-615):
 * System Manager always may; otherwise the level-0 `export` right, which `rolePermissions` already takes from `if_owner`
 * rows too (the server then checks every exported row's owner — data_import/exporter.py:116-124). No roles → false.
 * Desk shows the list's Export entry to everyone (`list_view.js:2092`) and lets the server refuse; the package hides it
 * (Phase 26 rule D.1). Either way the server decides.
 */
export function canExport(roles: readonly string[] | undefined, level0: Level0Rights): boolean {
  if (isSystemManager(roles)) return true;
  return !!roles && !!level0?.export;
}

/**
 * Fields the user may READ, by permlevel: a field at level N is kept when `levels[N].read`. Frappe strips the values of
 * unreadable permlevel fields from `getdoc` and `reportview.get` rows (docs 10 §C5); list columns, export field pickers
 * and import templates must not offer them. Level 0 unreadable → nothing. Without `levels` → nothing (rule 9).
 */
export function readableFields<F extends Pick<FrappeDocField, "permlevel">>(fields: readonly F[] | undefined, levels: DocPermissions | undefined): F[] {
  if (!fields || !levels || !levels[0]?.read) return [];
  return fields.filter((f) => !!levels[Number(f.permlevel) || 0]?.read);
}
