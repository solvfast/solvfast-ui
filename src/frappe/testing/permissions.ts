/**
 * Server-side permission evaluation for the SIMULATED backend — opt-in: `createFixtureTransport(backend, { permissions })`.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 * │ SIMULATED. An APPROXIMATION of what a Frappe 15.110 server decides for one session, rebuilt from the source     │
 * │ (frappe/permissions.py, model/db_query.py, model/document.py, desk/form/load.py — each rule cites its lines).   │
 * │ It evaluates DocPerm rows × the session's roles, `if_owner`, User Permissions, DocShare rows and controller    │
 * │ hooks you declare. No Custom DocPerm, no Role Profiles, no nested-set (tree) User Permissions, no permission     │
 * │ query hooks other than ToDo's, no website (Guest) permissions. Nothing observed here is evidence of how a site  │
 * │ behaves; report results on it as "Simulated". See docs/qa/simulator-caveats.md §4.                             │
 * └──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 */
import { toFrappeError, type FrappeError } from "../client";
import type { DocPerm, DocTypeMeta, FrappeDoc, FrappeDocField, PermType } from "../contract";
import type { FrappeSession } from "../services/permissions";

type Row = Record<string, unknown>;
type Check = 0 | 1 | boolean;

/** `rights` (permissions.py:12-27), in Frappe's order. */
export const SIM_RIGHTS: PermType[] = ["select", "read", "write", "create", "delete", "submit", "cancel", "amend", "print", "email", "report", "import", "export", "share"];
/** Roles Frappe assigns by user type, never through Has Role (permissions.py:31-37). */
export const AUTOMATIC_ROLES = ["Guest", "All", "Desk User", "Administrator"] as const;
/** `core_doctypes_list` (model/__init__.py:100-121): lists of these are never field-stripped (get_permitted_fields :227). */
const CORE_DOCTYPES = new Set(["DefaultValue", "DocType", "DocField", "DocPerm", "DocType Action", "DocType Link", "User", "Role", "Has Role", "Page", "Module Def", "Print Format", "Report", "Customize Form", "Customize Form Field", "Property Setter", "Custom Field", "Client Script"]);
/** `default_fields` + `optional_fields` + `child_table_fields` (model/__init__.py) — always selectable. */
const DEFAULT_FIELDS = new Set(["doctype", "name", "owner", "creation", "modified", "modified_by", "docstatus", "idx"]);
const OPTIONAL_FIELDS = new Set(["_user_tags", "_comments", "_assign", "_liked_by", "_seen"]);
const CHILD_TABLE_FIELDS = new Set(["parent", "parentfield", "parenttype"]);
const LAYOUT = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Heading", "Fold", "Button", "Image", "Page Break"]);
const TABLES = new Set(["Table", "Table MultiSelect"]);
/** The Comment DocType's rows (core/doctype/comment/comment.json): System Manager and Website Manager may delete. */
export const COMMENT_PERMISSIONS: DocPerm[] = [
  { role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 },
  { role: "Website Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 },
];

/** A User Permission row (core/doctype/user_permission): restricts Link values of DocType `allow` to `for_value`. */
export interface SimUserPermission {
  allow: string;
  for_value: string;
  /** Only for this DocType (empty = everywhere, `filter_allowed_docs_for_doctype` permissions.py:741-752). */
  applicable_for?: string;
  is_default?: Check;
}
/** A DocShare row (core/doctype/docshare). `user` or `everyone`. */
export interface SimDocShare {
  share_doctype: string;
  share_name: string;
  user?: string;
  everyone?: Check;
  read?: Check;
  write?: Check;
  submit?: Check;
  share?: Check;
  owner?: string;
  creation?: string;
  name?: string;
}
export interface SimPermissionContext {
  /** The user the check is for. */
  user: string;
  /** `frappe.get_roles(user)` as the simulator computes it. */
  roles: string[];
  /** `get_doctype_roles(doctype, access_type)` (permissions.py:534-537): roles of the DocPerm rows granting it. */
  doctypeRoles(doctype: string, ptype?: string | null): string[];
}
/** A controller permission hook (hooks.py `has_permission` / `permission_query_conditions`) — SIMULATED by you. */
export interface SimControllerHook {
  /** `has_permission` hook (permissions.py:436-454): false denies; true / null / undefined leave the role evaluation
   *  alone (controllers can only deny). `ptype` is null when Frappe calls it for `docinfo.permissions`. */
  hasPermission?(doc: FrappeDoc, ptype: PermType | null, ctx: SimPermissionContext): boolean | null | undefined;
  /** `permission_query_conditions` (db_query.py:1125-1140): null for "no condition", else a row predicate ANDed into
   *  every list query. */
  queryCondition?(ctx: SimPermissionContext): ((row: FrappeDoc) => boolean) | null;
}
/** Another user the server may evaluate (an assignee in `assign_to.add`). */
export interface SimUser {
  roles?: string[];
  userType?: "System User" | "Website User";
  userPermissions?: SimUserPermission[];
}

/**
 * The simulated session and what the SERVER knows about it. Passing this turns the permission model on; without it the
 * simulator keeps its historical behaviour (every right; `docinfo.permissions` = everything).
 */
export interface SimulatedPermissions {
  /** The session user (also `owner` / `modified_by` of what it writes). "Administrator" bypasses every check. */
  user: string;
  /** Roles assigned to the user (Has Role). The automatic ones are added as `get_roles` does (permissions.py:497-528):
   *  "All", "Guest", and "Desk User" for a System User. Omitted or [] = no assigned role. */
  roles?: string[];
  /** Default: the stored User's `user_type`, else "System User". */
  userType?: "System User" | "Website User";
  /** This user's User Permission rows. */
  userPermissions?: SimUserPermission[];
  /** DocShare rows seeded into the site (any user). `assign_to.add` adds more, as Frappe does. */
  shares?: SimDocShare[];
  /** Other users' roles / User Permissions (assignees). A user not listed holds the automatic roles only. */
  users?: Record<string, SimUser>;
  /** Controller hooks by DocType ("*" = every DocType). Merged over the built-in ToDo hooks (todo.py:148-171);
   *  `{ ToDo: {} }` switches those off. */
  hooks?: Record<string, SimControllerHook>;
  /** System Settings "Apply Strict User Permissions": an empty Link value no longer passes a User Permission. */
  strictUserPermissions?: boolean;
  /** System Settings "Disable Document Sharing" (permissions.py:111-113; assign_to.py:103-110). */
  disableSharing?: boolean;
  /** What the CLIENT is told: "known" (default) → `FrappeSession.roles` = the evaluated roles; "unknown" → no roles
   *  (Phase 26 rule 9 on the client). The server always knows the roles (`get_roles` never answers "unknown"). */
  clientRoles?: "known" | "unknown";
  /** A scenario name for labels (`simScenario.*`). */
  scenario?: SimScenarioName;
  /** Display name for the client session. */
  fullName?: string;
}

/** Per-permlevel-0 rights as `get_role_permissions` / `get_doc_permissions` answer them (permissions.py:196-310). */
export type SimDocPermissions = Partial<Record<PermType, 0 | 1>> & { if_owner?: Partial<Record<PermType, 0 | 1>>; has_if_owner_enabled?: boolean; [key: string]: unknown };

export interface PermissionDeps {
  config: SimulatedPermissions;
  metaOf(doctype: string): DocTypeMeta | undefined;
  allMetas(): DocTypeMeta[];
  /** Extra role names the site knows (workflow `allowed` / `allow_edit`). */
  knownRoles(): string[];
  userDoc(user: string): FrappeDoc | undefined;
  shares(): FrappeDoc[];
  /** The stored document (for a child row's parent). */
  stored(doctype: string, name: string): FrappeDoc | undefined;
}

const truthy = (v: unknown) => !!v && v !== "0";
const bold = (s: string) => `<strong>${s}</strong>`;
const sm = (...messages: Row[]) => JSON.stringify(messages.map((m) => JSON.stringify(m)));

/** A 403 PermissionError body as `report_error` builds it: `_error_message` (frappe.flags.error_message,
 *  utils/response.py:194-195) and the msgprinted check logs (`print_has_permission_check_logs`, permissions.py:41-59). */
export function permissionError(errorMessage: string | undefined, messages: string[] = [], raise = false): FrappeError {
  const body: Row = { exc_type: "PermissionError" };
  if (errorMessage) body._error_message = errorMessage;
  const logs = messages.filter(Boolean);
  if (logs.length) body._server_messages = sm(...logs.map((message) => ({ message, indicator: "red", ...(raise ? { raise_exception: 1, title: "Not Permitted" } : {}) })));
  return toFrappeError(403, body);
}

/** The built-in controller hooks: ToDo (`todo.py:148-171`, wired in hooks.py:101,122). */
export const BUILTIN_PERMISSION_HOOKS: Record<string, SimControllerHook> = {
  ToDo: {
    // has_permission: a user whose roles grant `ptype` on ToDo (automatic roles excluded) passes; else only the
    // assignee or the assigner. `get_doctype_roles("ToDo", None)` is empty, so for docinfo every non-party is denied.
    hasPermission(doc, ptype, ctx) {
      const todoRoles = ctx.doctypeRoles("ToDo", ptype).filter((r) => !(AUTOMATIC_ROLES as readonly string[]).includes(r));
      if (ctx.roles.some((r) => todoRoles.includes(r))) return true;
      return doc.allocated_to === ctx.user || doc.assigned_by === ctx.user;
    },
    queryCondition(ctx) {
      const todoRoles = ctx.doctypeRoles("ToDo", "read").filter((r) => !(AUTOMATIC_ROLES as readonly string[]).includes(r));
      if (ctx.roles.some((r) => todoRoles.includes(r))) return null;
      return (row) => row.allocated_to === ctx.user || row.assigned_by === ctx.user;
    },
  },
};

export type PermissionEngine = ReturnType<typeof createPermissionEngine>;

/** The evaluator. Every function is for the session user unless `user` is passed. */
export function createPermissionEngine(deps: PermissionDeps) {
  const config = deps.config;
  const sessionUser = config.user;
  const hooks: Record<string, SimControllerHook> = { ...BUILTIN_PERMISSION_HOOKS, ...(config.hooks ?? {}) };
  const isAdmin = (u: string) => u === "Administrator";

  const metaFor = (doctype: string): DocTypeMeta | undefined => (doctype === "Comment" ? deps.metaOf("Comment") ?? { name: "Comment", fields: [], permissions: COMMENT_PERMISSIONS } : deps.metaOf(doctype));
  const userSpec = (u: string): SimUser | undefined => (u === sessionUser ? { roles: config.roles, userType: config.userType, userPermissions: config.userPermissions } : config.users?.[u]);

  /** Every role the site knows (DocPerm rows, workflows, the declared users): `get_roles("Administrator")` returns all Role records. */
  function allRoles(): string[] {
    const set = new Set<string>([...AUTOMATIC_ROLES]);
    for (const m of deps.allMetas()) for (const p of m.permissions ?? []) set.add(p.role);
    for (const p of COMMENT_PERMISSIONS) set.add(p.role);
    for (const r of deps.knownRoles()) set.add(r);
    for (const r of config.roles ?? []) set.add(r);
    for (const u of Object.values(config.users ?? {})) for (const r of u.roles ?? []) set.add(r);
    return [...set];
  }
  /** `get_roles` (permissions.py:497-528): Guest → [Guest]; Administrator → every role; else the assigned roles
   *  (automatic ones dropped) + All + Guest (+ Desk User for a System User). */
  function rolesOf(u: string = sessionUser): string[] {
    if (!u || u === "Guest") return ["Guest"];
    if (isAdmin(u)) return allRoles();
    const spec = userSpec(u);
    const assigned = (spec?.roles ?? []).filter((r) => !(AUTOMATIC_ROLES as readonly string[]).includes(r));
    const out = [...new Set(assigned), "All", "Guest"];
    const userType = spec?.userType ?? (deps.userDoc(u)?.user_type as string | undefined) ?? "System User";
    if (userType === "System User") out.push("Desk User");
    return out;
  }
  const ctxFor = (u: string): SimPermissionContext => ({
    user: u, roles: rolesOf(u),
    doctypeRoles: (doctype, ptype) => (metaFor(doctype)?.permissions ?? []).filter((p) => ptype && truthy((p as unknown as Row)[ptype])).map((p) => p.role),
  });

  /** `get_role_permissions` (permissions.py:251-310), permlevel 0 only. */
  function rolePermissions(meta: DocTypeMeta, u: string = sessionUser, isOwner = false): SimDocPermissions {
    if (isAdmin(u)) return Object.fromEntries(SIM_RIGHTS.map((r) => [r, 1])) as SimDocPermissions; // allow_everything :727-732
    const roles = rolesOf(u);
    const applicable = (meta.permissions ?? []).filter((p) => roles.includes(p.role) && (Number(p.permlevel) || 0) === 0);
    const hasIfOwner = applicable.some((p) => truthy(p.if_owner));
    const ifOwner: Partial<Record<PermType, 0 | 1>> = {};
    const perms: SimDocPermissions = { if_owner: ifOwner, has_if_owner_enabled: hasIfOwner };
    for (const ptype of SIM_RIGHTS) {
      const pvalue = applicable.some((p) => truthy(p[ptype]));
      perms[ptype] = pvalue ? 1 : 0;
      if (pvalue && hasIfOwner && ptype !== "create" && !applicable.some((p) => truthy(p[ptype]) && !truthy(p.if_owner))) {
        ifOwner[ptype] = isOwner ? 1 : 0;
        // only select / read stay, so the list can show the owner's rows (db_query filters them by owner)
        perms[ptype] = ptype === "select" || ptype === "read" ? 1 : 0;
      }
    }
    return perms;
  }
  /** `get_permlevel_access` (document.py:808-816, meta.py:633-641): permlevels where a role of the user grants `ptype`. */
  function permlevelAccess(meta: DocTypeMeta, ptype: string, u: string = sessionUser): number[] {
    const roles = rolesOf(u);
    const out: number[] = [];
    for (const p of meta.permissions ?? []) if (roles.includes(p.role) && truthy((p as unknown as Row)[ptype]) && !out.includes(Number(p.permlevel) || 0)) out.push(Number(p.permlevel) || 0);
    return out;
  }
  const onlyHasSelect = (meta: DocTypeMeta, u: string = sessionUser) => { const rp = rolePermissions(meta, u); return !!rp.select && !rp.read; }; // __init__.py:1016-1025

  /** `get_user_permissions` (user_permission.py:85-) grouped by `allow`; none for Administrator / Guest. */
  function userPermissionsOf(u: string): Record<string, SimUserPermission[]> {
    if (!u || isAdmin(u) || u === "Guest") return {};
    const out: Record<string, SimUserPermission[]> = {};
    for (const p of userSpec(u)?.userPermissions ?? []) (out[p.allow] ??= []).push(p);
    return out;
  }
  /** `get_allowed_docs_for_doctype` (permissions.py:735-752). */
  const allowedDocs = (ups: SimUserPermission[] | undefined, doctype: string) => (ups ?? []).filter((p) => !p.applicable_for || p.applicable_for === doctype).map((p) => String(p.for_value));
  /** `meta.get_link_fields()` (meta.py:179-180). */
  const linkFields = (meta: DocTypeMeta | undefined): FrappeDocField[] => (meta?.fields ?? []).filter((f) => f.fieldtype === "Link" && f.options && f.options !== "[Select]");
  const tableFields = (meta: DocTypeMeta | undefined) => (meta?.fields ?? []).filter((f) => TABLES.has(f.fieldtype) && f.options);

  /** `has_user_permission` (permissions.py:320-433). Returns the log line when it denies. */
  function userPermissionDenial(doc: FrappeDoc, u: string, ptype?: PermType | null): string | null {
    const ups = userPermissionsOf(u);
    if (!Object.keys(ups).length) return null;
    const meta = metaFor(doc.doctype);
    const strict = !!config.strictUserPermissions && !truthy(meta?.issingle);
    const doctype = doc.doctype, docname = doc.name;
    // STEP 1 (:340-371): User Permissions on the DocType itself (tree "create" inheritance not simulated)
    const own = allowedDocs(ups[doctype], doctype);
    if (ups[doctype] && own.length && (!docname || !own.includes(String(docname)))) return `Not allowed for ${doctype}: ${String(docname ?? "")}`;
    void ptype;
    // STEP 2 (:373-433): every Link field of the doc and of its child rows (allowed docs filtered for the PARENT doctype)
    const check = (d: Row, m: DocTypeMeta | undefined, isChild: boolean): string | null => {
      for (const f of linkFields(m)) {
        if (truthy(f.ignore_user_permissions)) continue;
        const v = d[f.fieldname];
        if ((v === null || v === undefined || v === "") && !strict) continue;
        if (!ups[f.options!]) continue;
        const allowed = allowedDocs(ups[f.options!], doctype);
        if (allowed.length && !allowed.includes(String(v ?? ""))) {
          const label = f.label || f.fieldname;
          return isChild
            ? `You are not allowed to access this ${m!.name} record because it is linked to ${f.options} '${String(v || "empty")}' in row ${String(d.idx ?? "")}, field ${label}`
            : `You are not allowed to access this ${m!.name} record because it is linked to ${f.options} '${String(v || "empty")}' in field ${label}`;
        }
      }
      return null;
    };
    const top = check(doc, meta, false);
    if (top) return top;
    for (const tf of tableFields(meta)) {
      const cm = metaFor(tf.options!);
      for (const r of (doc[tf.fieldname] as Row[] | undefined) ?? []) { const c = check(r, cm, true); if (c) return c; }
    }
    return null;
  }

  /** `has_controller_permissions` (permissions.py:436-454): the first hook with an opinion decides; it can only deny. */
  function controllerAllows(doc: FrappeDoc, ptype: PermType | null, u: string): boolean {
    for (const key of ["*", doc.doctype]) {
      const r = hooks[key]?.hasPermission?.(doc, ptype, ctxFor(u));
      if (r !== null && r !== undefined) return !!r;
    }
    return true;
  }

  /** `get_doc_permissions` (permissions.py:196-250). `logs` collects why a right is missing. */
  function docPermissions(doc: FrappeDoc, u: string = sessionUser, ptype: PermType | null = null, logs: string[] = []): SimDocPermissions {
    const meta = metaFor(doc.doctype);
    if (!meta) return {};
    const isOwner = String(doc.owner ?? "").toLowerCase() === u.toLowerCase();
    if (!controllerAllows(doc, ptype, u)) {
      logs.push("Not allowed via controller permission check");
      return { [String(ptype)]: 0 } as SimDocPermissions; // `{ptype: 0}` — `{"null": 0}` when ptype is None (docinfo)
    }
    let perms: SimDocPermissions = JSON.parse(JSON.stringify(rolePermissions(meta, u, isOwner)));
    if (!truthy(meta.is_submittable)) perms.submit = 0;
    if (!truthy(meta.allow_import)) perms.import = 0;
    if (perms.has_if_owner_enabled) Object.assign(perms, perms.if_owner ?? {});
    const denial = userPermissionDenial(doc, u, ptype);
    if (denial) {
      logs.push(denial);
      // the owner keeps its if_owner rights (never create); everyone else gets nothing
      perms = isOwner ? { ...(perms.if_owner ?? {}), create: 0 } : {};
    }
    return perms;
  }

  /** Names shared with the user for the rights (`get_shared`, share.py:155-185; `everyone` rows count except for Guest). */
  function sharedNames(doctype: string, u: string = sessionUser, rights: string[] = ["read"]): string[] {
    return deps.shares()
      .filter((s) => s.share_doctype === doctype && rights.every((r) => truthy(s[r])) && (s.user === u || (u !== "Guest" && truthy(s.everyone))))
      .map((s) => String(s.share_name));
  }
  /** `false_if_not_shared` (permissions.py:162-187). */
  function sharedRight(doctype: string, ptype: PermType, doc: FrappeDoc | undefined, u: string): boolean {
    if (!["read", "write", "share", "submit", "email", "print"].includes(ptype)) return false;
    const right = ptype === "email" || ptype === "print" ? "read" : ptype;
    const names = sharedNames(doctype, u, [right]);
    return doc ? names.includes(String(doc.name)) : names.length > 0;
  }

  /**
   * `has_permission` (permissions.py:77-193): Administrator → yes (:107-109); share disabled (:111-113); child DocTypes
   * via the parent (:122-123, :763-845, permlevel of the table field not checked); with a doc → `get_doc_permissions`;
   * without → role rights (+ not submittable / not importable, :133-139); then DocShare (:189-191) unless ignored.
   */
  function hasPermission(doctype: string, ptype: PermType = "read", doc?: FrappeDoc, opts: { user?: string; ignoreShare?: boolean; parentDoctype?: string; logs?: string[] } = {}): boolean {
    const u = opts.user ?? sessionUser;
    const logs = opts.logs ?? [];
    if (isAdmin(u)) return true;
    if (ptype === "share" && config.disableSharing) { logs.push("Document sharing is disabled"); return false; }
    const meta = metaFor(doctype);
    if (!meta) return false;
    if (truthy(meta.istable)) {
      const parentDt = (doc?.parenttype as string | undefined) ?? opts.parentDoctype;
      if (!parentDt) { logs.push(`Please specify a valid parent DocType for ${bold(doctype)}`); return false; }
      const parentDoc = doc?.parent ? deps.stored(parentDt, String(doc.parent)) : undefined;
      return hasPermission(parentDt, ptype, parentDoc, { ...opts, user: u, logs });
    }
    let perm: boolean;
    if (doc) {
      const own: string[] = [];
      perm = truthy(docPermissions(doc, u, ptype, own)[ptype]);
      if (!perm) {
        logs.push(...own);
        let msg = `User ${bold(u)} does not have access to this document`;
        if (hasPermission(doctype, "read", undefined, { user: u })) msg += `: ${doctype} - ${doc.name}`;
        logs.push(msg);
      }
    } else {
      if (ptype === "submit" && !truthy(meta.is_submittable)) { logs.push("Document Type is not submittable"); return false; }
      if (ptype === "import" && !truthy(meta.allow_import)) { logs.push("Document Type is not importable"); return false; }
      perm = truthy(rolePermissions(meta, u)[ptype]);
      if (!perm) logs.push(`User ${bold(u)} does not have doctype access via role permission for document ${bold(doctype)}`);
    }
    if (!perm && !opts.ignoreShare) perm = sharedRight(doctype, ptype, doc, u);
    return perm;
  }

  /**
   * `Document.check_permission` → `_handle_permission_failure` (document.py:225-258): a DocType-level refusal first
   * (`check_doctype_permission`, permissions.py:852-867: "No permission for X"), else "You need the 'p' permission on …".
   */
  function assertDoc(doc: FrappeDoc, ptype: PermType = "read", u: string = sessionUser): void {
    const logs: string[] = [];
    if (hasPermission(doc.doctype, ptype, doc, { user: u, logs })) return;
    assertDoctype(doc.doctype, ptype, { ignoreShare: true });
    throw permissionError(`You need the '${ptype}' permission on ${bold(doc.doctype)} ${doc.name ?? ""} to perform this action.`, [logs.join("<br>")]);
  }
  /** `frappe.has_permission(doctype, ptype, throw=True)` (__init__.py:1028-1073): 403 "No permission for {doctype}". */
  function assertDoctype(doctype: string, ptype: PermType = "read", opts: { ignoreShare?: boolean; parentDoctype?: string } = {}): void {
    const logs: string[] = [];
    if (hasPermission(doctype, ptype, undefined, { ...opts, logs })) return;
    throw permissionError(`No permission for ${doctype}`, [logs.join("<br>")]);
  }

  /** `requires_owner_constraint` (db_query.py:1445-1462). */
  function requiresOwnerConstraint(rp: SimDocPermissions): boolean {
    if (!rp.has_if_owner_enabled) return false;
    const io = rp.if_owner ?? {};
    if (!Object.keys(io).length) return false;
    for (const p of ["select", "read"] as const) if (rp[p] && !(p in io)) return false;
    return true;
  }

  /**
   * The row filter of a list query for the session user — `DatabaseQuery.execute` → `check_read_permission`
   * (db_query.py:135, 566-585: 403 "No permission for X" without select/read and no share) and `build_match_conditions`
   * (:993-1057): no role read but shared → shared names only; `if_owner`-only read → owner = user (:1024-1028); else
   * User Permissions on every Link field and on `name` (`add_user_permissions` :1065-1123, empty values pass unless
   * strict); the DocType's query hook ANDed (:1045-1049); shared names ORed in when there are conditions (:1051-1052).
   */
  function listFilter(doctype: string, opts: { referenceDoctype?: string; ignorePermissions?: boolean } = {}): (row: FrappeDoc) => boolean {
    if (opts.ignorePermissions) return () => true;
    const meta = metaFor(doctype);
    if (!meta) return () => true;
    const rp = rolePermissions(meta);
    assertDoctype(doctype, onlyHasSelect(meta) ? "select" : "read", { parentDoctype: opts.referenceDoctype });
    const ctx = ctxFor(sessionUser);
    const hook = [hooks["*"]?.queryCondition?.(ctx), hooks[doctype]?.queryCondition?.(ctx)].filter((h): h is (row: FrappeDoc) => boolean => typeof h === "function");
    const hookOk = (r: FrappeDoc) => hook.every((h) => h(r));
    const ups = userPermissionsOf(sessionUser);
    const hasAnyUp = (ups[doctype] ?? []).some((p) => !p.applicable_for || p.applicable_for === opts.referenceDoctype); // :1349-1357
    if (!truthy(meta.istable) && !(rp.select || rp.read) && !hasAnyUp) {
      const shared = sharedNames(doctype);
      if (!shared.length) throw toFrappeError(403, { exc_type: "PermissionError", _server_messages: sm({ message: `No permission to read ${doctype}`, indicator: "red", raise_exception: 1, title: "Not Permitted" }) });
      return (r) => shared.includes(String(r.name)) && hookOk(r);
    }
    let match: ((r: FrappeDoc) => boolean) | undefined;
    let fetchShared = false;
    if (requiresOwnerConstraint(rp)) {
      fetchShared = true;
      match = (r) => String(r.owner ?? "") === sessionUser;
    } else if (rp.read || rp.select) {
      const strict = !!config.strictUserPermissions;
      const parts: ((r: FrappeDoc) => boolean)[] = [];
      for (const df of [...linkFields(meta), { fieldname: "name", options: doctype, fieldtype: "Link" } as FrappeDocField]) {
        if (truthy(df.ignore_user_permissions)) continue;
        const values = ups[df.options!];
        if (!values?.length) continue;
        const docs: string[] = [];
        for (const p of values) {
          if (!p.applicable_for) docs.push(String(p.for_value));
          else if (df.fieldname === "name" && opts.referenceDoctype) { if (p.applicable_for === opts.referenceDoctype) docs.push(String(p.for_value)); }
          else if (p.applicable_for === doctype) docs.push(String(p.for_value));
        }
        if (docs.length) parts.push((r) => (!strict && (r[df.fieldname] === null || r[df.fieldname] === undefined || r[df.fieldname] === "")) || docs.includes(String(r[df.fieldname])));
      }
      if (parts.length) { fetchShared = true; match = (r) => parts.every((p) => p(r)); }
    }
    const shared = fetchShared ? sharedNames(doctype) : [];
    const hasConditions = !!match || hook.length > 0;
    return (r) => {
      const c = (match ? match(r) : true) && hookOk(r);
      return hasConditions && shared.length ? c || shared.includes(String(r.name)) : c;
    };
  }

  /**
   * `get_permitted_fields` (model/__init__.py:216-261) + `get_permitted_fieldnames` (meta.py:589-631): the columns a list
   * may return; null = every column. Core DocTypes and DocTypes without DocPerm rows are not restricted; select-only →
   * search fields; else the fields of the permlevels the user can read (level 0 added when a doc is shared).
   */
  function permittedFields(doctype: string, parentDoctype?: string): Set<string> | null {
    const meta = metaFor(doctype);
    if (!meta || CORE_DOCTYPES.has(doctype)) return null;
    const valueFields = meta.fields.filter((f) => !LAYOUT.has(f.fieldtype) && !TABLES.has(f.fieldtype));
    if (!valueFields.length) return null;
    const istable = truthy(meta.istable);
    if (istable && !parentDoctype) return new Set([...DEFAULT_FIELDS, ...OPTIONAL_FIELDS]);
    const permMeta = istable && parentDoctype ? metaFor(parentDoctype) ?? meta : meta;
    if (!istable && onlyHasSelect(meta)) {
      const search = String(meta.search_fields || "name").split(",").map((s) => s.trim()).filter(Boolean);
      return new Set([...DEFAULT_FIELDS, ...search, "name"]);
    }
    if (!(permMeta.permissions ?? []).length) return null;
    const access = permlevelAccess(permMeta, "read");
    if (!access.includes(0) && sharedNames(istable && parentDoctype ? parentDoctype : doctype).length) access.push(0);
    const out = new Set([...DEFAULT_FIELDS, ...OPTIONAL_FIELDS]);
    if (istable) for (const f of CHILD_TABLE_FIELDS) out.add(f);
    for (const f of valueFields) if (access.includes(Number(f.permlevel) || 0)) out.add(f.fieldname);
    return out;
  }

  /**
   * `apply_fieldlevel_read_permissions` (document.py:754-781): the values of permlevel > 0 fields (parent and child rows)
   * the user cannot read are removed. Administrator and DocTypes without permlevels are untouched. `mode`: getdoc
   * serialises with `as_dict(no_nulls=True)` (utils/response.py:225-226) so the keys are ABSENT; `send_updated_docs`
   * / `frappe.client.get` use `as_dict()` (save.py:62-70, client.py:109-111) so the keys are present as null.
   */
  function stripDoc<T extends Row>(doc: T, mode: "absent" | "null" = "absent", u: string = sessionUser): T {
    if (isAdmin(u)) return doc;
    const meta = metaFor(String(doc.doctype));
    if (!meta) return doc;
    const tables = tableFields(meta);
    const all = [...meta.fields, ...tables.flatMap((tf) => metaFor(tf.options!)?.fields ?? [])];
    if (all.every((f) => !Number(f.permlevel))) return doc;
    const access = permlevelAccess(meta, "read", u);
    const drop = (r: Row, fields: FrappeDocField[]) => { for (const f of fields) if (Number(f.permlevel) && !access.includes(Number(f.permlevel))) { if (mode === "null") r[f.fieldname] = null; else delete r[f.fieldname]; } };
    const out: Row = { ...doc };
    drop(out, meta.fields.filter((f) => !TABLES.has(f.fieldtype)));
    for (const tf of tables) {
      const cf = metaFor(tf.options!)?.fields ?? [];
      if (Array.isArray(out[tf.fieldname])) out[tf.fieldname] = (out[tf.fieldname] as Row[]).map((r) => { const c = { ...r }; drop(c, cf); return c; });
    }
    return out as T;
  }

  /**
   * `validate_higher_perm_levels` → `reset_values_if_no_permlevel_access` (document.py:783-806, base_document.py:1263-):
   * values of permlevel > 0 fields the user cannot WRITE are reset — to the stored values on an existing doc (child rows
   * matched by name; new rows untouched), to the field default on a new one. Administrator: nothing.
   */
  function resetUnwritable(meta: DocTypeMeta, doc: FrappeDoc, previous: FrappeDoc | undefined, u: string = sessionUser): void {
    if (isAdmin(u)) return;
    const access = permlevelAccess(meta, "write", u);
    const high = (m: DocTypeMeta | undefined) => (m?.fields ?? []).filter((f) => Number(f.permlevel) > 0 && !access.includes(Number(f.permlevel)) && !LAYOUT.has(f.fieldtype));
    const fallback = (f: FrappeDocField) => (f.fieldtype === "Check" ? Number(f.default ?? 0) || 0 : f.default ?? null);
    for (const f of high(meta)) {
      if (TABLES.has(f.fieldtype)) { if (previous) doc[f.fieldname] = previous[f.fieldname] ?? []; continue; }
      doc[f.fieldname] = previous ? previous[f.fieldname] ?? null : fallback(f);
    }
    if (!previous) return;
    for (const tf of tableFields(meta)) {
      const cf = high(metaFor(tf.options!));
      if (!cf.length) continue;
      const stored = (previous[tf.fieldname] as Row[] | undefined) ?? [];
      for (const r of (doc[tf.fieldname] as Row[] | undefined) ?? []) {
        const old = stored.find((x) => x.name === r.name);
        if (old) for (const f of cf) r[f.fieldname] = old[f.fieldname] ?? null;
      }
    }
  }

  /** `can_export` (permissions.py:608-616): System Manager, else the export right (or its if_owner variant). */
  function canExport(doctype: string, isOwner = false): boolean {
    if (isAdmin(sessionUser) || rolesOf().includes("System Manager")) return true;
    const meta = metaFor(doctype);
    if (!meta) return false;
    const rp = rolePermissions(meta, sessionUser, isOwner);
    return !!(rp.export || rp.if_owner?.export);
  }

  /** The DocShare rows of a document as `docinfo.shared` lists them (share.py:132-152) — empty without read. */
  function docShares(doc: FrappeDoc): Row[] {
    if (!hasPermission(doc.doctype, "read", doc)) return [];
    return deps.shares().filter((s) => s.share_doctype === doc.doctype && String(s.share_name) === String(doc.name))
      .map((s) => ({ name: s.name, user: s.user ?? null, read: Number(truthy(s.read)), write: Number(truthy(s.write)), submit: Number(truthy(s.submit)), share: Number(truthy(s.share)), everyone: Number(truthy(s.everyone)), owner: s.owner ?? "Administrator", creation: s.creation ?? null }));
  }

  /** What the CLIENT should be told for this session (`FrappeProvider session`): the evaluated roles, or none when the
   *  scenario says the client does not know them. */
  function clientSession(): FrappeSession {
    const full = config.fullName ?? (deps.userDoc(sessionUser)?.full_name as string | undefined) ?? sessionUser;
    return { user: sessionUser, fullName: full, roles: config.clientRoles === "unknown" ? undefined : rolesOf(sessionUser) };
  }

  return {
    user: sessionUser, config, rolesOf, rolePermissions, permlevelAccess, docPermissions, hasPermission, assertDoc, assertDoctype,
    listFilter, permittedFields, stripDoc, resetUnwritable, canExport, docShares, sharedNames, userPermissionDenial, clientSession, ctxFor,
  };
}

// ---- named scenarios ------------------------------------------------------------------------------------------------

export type SimScenarioName = "administrator" | "full-access" | "read-only" | "restricted-doctype" | "restricted-fields" | "user-permissions" | "unknown-roles";
/** The seven scenarios, in display order. */
export const SIM_SCENARIO_NAMES: readonly SimScenarioName[] = ["administrator", "full-access", "read-only", "restricted-doctype", "restricted-fields", "user-permissions", "unknown-roles"];

/**
 * Builders for the named scenarios. The NAME states the intent; the rights that result come from YOUR DocType's DocPerm
 * rows × the roles you pass (pick a role that really is read-only on the DocType under test, …). SIMULATED.
 */
export const simScenario = {
  /** The Administrator user: every check passes (permissions.py:107-109; get_roles → every role, :506-507). */
  administrator: (extra: Partial<SimulatedPermissions> = {}): SimulatedPermissions => ({ scenario: "administrator", ...extra, user: "Administrator" }),
  /** A user whose roles grant everything on the DocType, permlevels > 0 included (still evaluated, not bypassed). */
  fullAccess: (user: string, roles: string[], extra: Partial<SimulatedPermissions> = {}): SimulatedPermissions => ({ scenario: "full-access", ...extra, user, roles }),
  /** Roles granting read (and report / print / email) but no write / create / delete. */
  readOnly: (user: string, roles: string[], extra: Partial<SimulatedPermissions> = {}): SimulatedPermissions => ({ scenario: "read-only", ...extra, user, roles }),
  /** Roles with no DocPerm row on the DocType under test: getdoc / lists answer 403 (meta still loads). */
  restrictedDoctype: (user: string, roles: string[], extra: Partial<SimulatedPermissions> = {}): SimulatedPermissions => ({ scenario: "restricted-doctype", ...extra, user, roles }),
  /** Roles with level-0 rights but none at permlevel ≥ 1: those values are stripped on read and kept on save. */
  restrictedFields: (user: string, roles: string[], extra: Partial<SimulatedPermissions> = {}): SimulatedPermissions => ({ scenario: "restricted-fields", ...extra, user, roles }),
  /** User Permission rows restricting Link values (and the DocType's own names). */
  userPermissions: (user: string, roles: string[], userPermissions: SimUserPermission[], extra: Partial<SimulatedPermissions> = {}): SimulatedPermissions => ({ scenario: "user-permissions", ...extra, user, roles, userPermissions }),
  /**
   * The client is not told the roles (FrappeSession.roles undefined → Phase 26 rule 9: missing information denies).
   * The SERVER always has them: `get_roles` (permissions.py:508-523) appends All + Guest (+ Desk User for a System User)
   * to the assigned roles, so a user without assigned roles is evaluated with exactly those automatic roles — the
   * DocPerm rows for "All" / "Desk User" still apply (e.g. ToDo's "All" row). Pass `roles` if the server should know more.
   */
  unknownRoles: (user: string, extra: Partial<SimulatedPermissions> = {}): SimulatedPermissions => ({ scenario: "unknown-roles", roles: [], ...extra, user, clientRoles: "unknown" }),
};
