/**
 * New-document defaults (docs `11` §1.3, §4.4; `12` §2), in Desk's `create_new.js` order, per field — skipping layout /
 * no-value fields, fields that already have a value, and `no_default`:
 *  1. Link (not to User): a user default for the target DocType or for the fieldname (`userDefaults`; a list counts only
 *     when it has exactly one entry). UNVERIFIED / not available without boot: User Permissions with `is_default`,
 *     `remember_last_selected_value` — supply them through `userDefaults` if the app has them.
 *  2. `df.default` — it runs when there is no value yet OR the field has a default, so a field default overrides a user
 *     default (code behaviour; intent UNVERIFIED per docs `11` §4.4): `__user` / `user` → session user;
 *     `user_fullname`; `Today`; `Now` (Time → current time; Datetime → current date-time; other types → literal);
 *     `:DocType` boot-doc lookups are not available (reported via `onUnsupported`, left empty); the title field's
 *     default is ignored; anything else is the literal default.
 *  3. Select without a default → its first option (not `[Select]` / `Loading...`); Time without a default → now;
 *     tables → `[]`. Int/Check defaults cast like `cint`, Float/Currency/Percent like `flt`.
 * Then `name_field` (autoname `field:x` → x; Prompt → `__newname`; else the title field) and `route_options` (only
 * fields that exist and are not `no_copy`). Mandatory Table fields get one empty row. Times use the browser clock: the
 * system / user time zones from boot are not available here (UNVERIFIED for sites whose zones differ).
 * The server fills only keys still None on save, so client defaults sent in the payload win.
 */
import type { DocTypeMeta, FrappeDoc, FrappeDocField, MetaBundle } from "../../contract";
import { FLOAT_TYPES, INT_TYPES, NO_VALUE_TYPES, TABLE_TYPES, newLocalName } from "./fieldtypes";

export interface DefaultsContext {
  /** Session user (owner of the new document). */
  user?: string;
  userFullname?: string;
  /** User defaults keyed by DocType or fieldname (`frappe.defaults.get_user_default`). */
  userDefaults?: Record<string, string | string[]>;
  routeOptions?: Record<string, unknown>;
  /** Text typed in a Link before "Create a new …" (Desk's `name_field`). */
  nameField?: string;
  now?: Date;
  onUnsupported?: (df: FrappeDocField, reason: string) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const todayString = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const nowTimeString = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const nowDatetimeString = (d = new Date()) => `${todayString(d)} ${nowTimeString(d)}`;

const castDefault = (df: FrappeDocField, v: unknown): unknown => {
  if (v == null || v === "") return v;
  if (INT_TYPES.has(df.fieldtype)) { const n = parseInt(String(v), 10); return Number.isNaN(n) ? 0 : n; }
  if (FLOAT_TYPES.has(df.fieldtype)) { const n = parseFloat(String(v)); return Number.isNaN(n) ? 0 : n; }
  return v;
};

function firstSelectOption(df: FrappeDocField): string | undefined {
  const opts = String(df.options ?? "").split("\n");
  const first = opts[0];
  if (first == null || first === "[Select]" || first === "Loading...") return undefined;
  return first;
}

function userDefault(df: FrappeDocField, ctx: DefaultsContext): string | undefined {
  const pickOne = (v: string | string[] | undefined) => (Array.isArray(v) ? (v.length === 1 ? v[0] : undefined) : v);
  if (df.fieldtype === "Link" && df.options && df.options !== "User") {
    const byDoctype = pickOne(ctx.userDefaults?.[df.options]);
    if (byDoctype) return byDoctype;
  }
  return pickOne(ctx.userDefaults?.[df.fieldname]);
}

function defaultFor(df: FrappeDocField, meta: DocTypeMeta, ctx: DefaultsContext): unknown {
  const now = ctx.now ?? new Date();
  let value: unknown = userDefault(df, ctx);
  const def = df.default;
  if (def != null && def !== "" && df.fieldname !== meta.title_field) {
    const d = String(def);
    if (d === "__user" || d === "user") value = ctx.user;
    else if (d === "user_fullname") value = ctx.userFullname ?? ctx.user;
    else if (d.toLowerCase() === "today") value = todayString(now);
    else if (d.toLowerCase() === "now") value = df.fieldtype === "Time" ? nowTimeString(now) : df.fieldtype === "Datetime" ? nowDatetimeString(now) : d;
    else if (d.startsWith(":")) { ctx.onUnsupported?.(df, `default "${d}" needs a boot document`); }
    else value = d;
  }
  if (value == null || value === "") {
    if (df.fieldtype === "Select") value = firstSelectOption(df);
    else if (df.fieldtype === "Time") value = nowTimeString(now);
  }
  return castDefault(df, value);
}

/** Apply defaults to a document (parent or row) in place; returns it. Existing values are kept. */
export function applyDefaults(doc: FrappeDoc, meta: DocTypeMeta, ctx: DefaultsContext = {}): FrappeDoc {
  for (const df of meta.fields ?? []) {
    if (NO_VALUE_TYPES.has(df.fieldtype) || df.no_default) continue;
    if (TABLE_TYPES.has(df.fieldtype)) { if (!Array.isArray(doc[df.fieldname])) doc[df.fieldname] = []; continue; }
    const cur = doc[df.fieldname];
    if (cur != null && cur !== "") continue;
    const v = defaultFor(df, meta, ctx);
    if (v != null && v !== "") doc[df.fieldname] = v;
  }
  return doc;
}

/** A new child row as Desk's `add_child` makes it (create_new.js:252-278). The caller sets `idx`. */
export function newChildRow(childMeta: DocTypeMeta, parent: FrappeDoc, parentfield: string, ctx: DefaultsContext = {}, values: Record<string, unknown> = {}): FrappeDoc {
  const row: FrappeDoc = {
    doctype: childMeta.name,
    name: newLocalName(childMeta.name),
    __islocal: 1,
    __unsaved: 1,
    docstatus: 0,
    parent: parent.name,
    parenttype: parent.doctype,
    parentfield,
    ...(ctx.user ? { owner: ctx.user } : {}),
  };
  applyDefaults(row, childMeta, ctx);
  for (const [k, v] of Object.entries(values)) if (k !== "idx" && k !== "name") row[k] = v;
  return row;
}

/** A new document (create_new.js `get_new_doc` + `set_default_values`). */
export function newDoc(bundle: MetaBundle, ctx: DefaultsContext = {}): FrappeDoc {
  const meta = bundle.meta;
  const doc: FrappeDoc = {
    doctype: meta.name,
    name: newLocalName(meta.name),
    docstatus: 0,
    __islocal: 1,
    __unsaved: 1,
    __run_link_triggers: 1,
    ...(ctx.user ? { owner: ctx.user } : {}),
  };
  applyDefaults(doc, meta, ctx);
  const fields = new Map((meta.fields ?? []).map((f) => [f.fieldname, f]));
  if (ctx.nameField) {
    const autoname = String(meta.autoname ?? "");
    const target = autoname.startsWith("field:") ? autoname.slice(6) : autoname.toLowerCase() === "prompt" ? "__newname" : meta.title_field;
    if (target) doc[target] = ctx.nameField;
  }
  for (const [k, v] of Object.entries(ctx.routeOptions ?? {})) {
    const df = fields.get(k);
    if (df && !df.no_copy) doc[k] = v;
  }
  for (const df of meta.fields ?? []) {
    if (df.fieldtype === "Table" && df.reqd && df.options && bundle.children[df.options]) {
      const rows = (doc[df.fieldname] as FrappeDoc[] | undefined) ?? [];
      if (!rows.length) {
        const row = newChildRow(bundle.children[df.options], doc, df.fieldname, ctx);
        row.idx = 1;
        doc[df.fieldname] = [row];
      }
    }
  }
  return doc;
}
