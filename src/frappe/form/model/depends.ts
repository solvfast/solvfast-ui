/**
 * depends_on / mandatory_depends_on / read_only_depends_on / collapsible_depends_on (docs `11` §2.3–2.4, `12` §5.2.6).
 *
 * Forms of an expression (layout.js:751-791): `eval:<js>` with `doc` and `parent` (`parent` = the form's doc; for the
 * form itself `doc === parent`; in a child row `doc` is the row), a plain fieldname (truthiness of `doc[name]`, an
 * array counts by length), `fn:<handler>` (a script-manager event — here a handler from `fnHandlers`; without one it is
 * reported, and treated as truthy because Desk's promise result is always truthy), or a boolean / function for
 * programmatic fields. No other syntax (no `!field`). The result sets:
 *  - depends_on → `hidden_due_to_dependency` (a flag separate from `hidden`);
 *  - mandatory_depends_on → `reqd` = 1/0 — it REPLACES a static `reqd` (a statically required field is optional
 *    whenever the condition is false);
 *  - read_only_depends_on → `read_only` = 1/0.
 * None of these is enforced by the server (static `reqd` only).
 */
import type { DocTypeMeta, FrappeDoc, FrappeDocField, MetaBundle } from "../../contract";
import { compileExpression, DEFAULT_HELPERS, type EvalMode, type Scope } from "./expression";

export type DependsProperty = "depends_on" | "mandatory_depends_on" | "read_only_depends_on" | "collapsible_depends_on";
export const DEPENDS_PROPERTIES: DependsProperty[] = ["depends_on", "mandatory_depends_on", "read_only_depends_on", "collapsible_depends_on"];

export interface DependsIssue {
  doctype: string;
  fieldname: string;
  property: DependsProperty | "link_filters";
  expression: string;
  /** unsupported: outside the interpreter's subset (found at meta load); invalid: failed while evaluating. */
  kind: "unsupported" | "invalid";
  reason: string;
}

export type FnHandler = (doc: FrappeDoc, parent: FrappeDoc) => unknown;

export interface EvaluatorOptions {
  /** "interpreter" (default, D-23) or "function" (Desk's `new Function`, opt-in). */
  mode?: EvalMode;
  /** Extra names visible to expressions (e.g. a `frappe` object with `user.has_role`). Functions must be wrapped
   *  with `exprHelper` to be callable. */
  globals?: Scope;
  /** Handlers for `fn:<name>` dependencies. */
  fnHandlers?: Record<string, FnHandler>;
  /** `fn:` needs a form (layout.js:775); without one (`false`) it falls through to plain-fieldname truthiness of
   *  `doc["fn:…"]`. Default true. */
  hasForm?: boolean;
  onIssue?: (issue: DependsIssue) => void;
}

/** JavaScript truthiness, except that an array is truthy only when it has items (Desk's fieldname form). */
export const isTruthy = (v: unknown) => (Array.isArray(v) ? v.length > 0 : !!v);

export type DependsValue = string | boolean | ((doc: FrappeDoc, parent: FrappeDoc) => unknown) | undefined | null;

export interface EvalContext { doctype: string; fieldname: string; property: DependsProperty | "link_filters" }

/** Evaluate one dependency. Returns `undefined` for "no expression"; a reported failure evaluates to `false`. */
export function evaluateDepends(expr: DependsValue, doc: FrappeDoc, parent: FrappeDoc, opts: EvaluatorOptions = {}, ctx?: EvalContext): unknown {
  if (expr == null || expr === "") return undefined;
  if (typeof expr === "boolean") return expr;
  if (typeof expr === "function") return expr(doc, parent);
  const text = String(expr);
  const report = (kind: DependsIssue["kind"], reason: string) =>
    opts.onIssue?.({ doctype: ctx?.doctype ?? doc.doctype, fieldname: ctx?.fieldname ?? "", property: ctx?.property ?? "depends_on", expression: text, kind, reason });
  if (text.startsWith("eval:")) {
    const body = text.slice(5);
    const names = ["doc", "parent", ...Object.keys(DEFAULT_HELPERS), ...Object.keys(opts.globals ?? {})];
    const compiled = compileExpression(body, opts.mode, [...new Set(names)]);
    if (!compiled.ok) { report("unsupported", compiled.reason); return false; }
    try {
      return compiled.run({ ...DEFAULT_HELPERS, ...opts.globals, doc, parent });
    } catch (e) {
      report("invalid", e instanceof Error ? e.message : String(e));
      return false;
    }
  }
  if (text.startsWith("fn:") && opts.hasForm !== false) {
    const name = text.slice(3).trim();
    const h = opts.fnHandlers?.[name];
    if (!h) { report("unsupported", `no handler registered for "fn:${name}"`); return true; }
    try { return h(doc, parent); } catch (e) { report("invalid", e instanceof Error ? e.message : String(e)); return false; }
  }
  return doc[text];
}

/** Check every expression of a meta bundle up front (D-23: unsupported expressions reported when the meta loads). */
export function analyzeDependencies(bundle: Pick<MetaBundle, "meta" | "children">, opts: Pick<EvaluatorOptions, "mode" | "globals" | "fnHandlers"> = {}): DependsIssue[] {
  const issues: DependsIssue[] = [];
  const names = [...new Set(["doc", "parent", ...Object.keys(DEFAULT_HELPERS), ...Object.keys(opts.globals ?? {})])];
  const scan = (meta: DocTypeMeta) => {
    for (const df of meta.fields ?? []) {
      for (const property of DEPENDS_PROPERTIES) {
        const v = df[property];
        if (typeof v !== "string" || !v) continue;
        if (v.startsWith("eval:")) {
          const c = compileExpression(v.slice(5), opts.mode, names);
          if (!c.ok) issues.push({ doctype: meta.name, fieldname: df.fieldname, property, expression: v, kind: "unsupported", reason: c.reason });
        } else if (v.startsWith("fn:") && !opts.fnHandlers?.[v.slice(3).trim()]) {
          issues.push({ doctype: meta.name, fieldname: df.fieldname, property, expression: v, kind: "unsupported", reason: `no handler registered for "${v}"` });
        }
      }
    }
  };
  scan(bundle.meta);
  for (const child of Object.values(bundle.children ?? {})) scan(child);
  return issues;
}

/** The per-document copy of a DocField after overrides and dependencies (Desk's docfield copy). */
export type EffectiveField = FrappeDocField & { hidden_due_to_dependency?: boolean };

/** Per-field property overrides set by form scripts (`setDfProperty`, `toggleDisplay`, …). */
export type FieldOverrides = Record<string, Partial<FrappeDocField>>;

/**
 * Effective DocFields for one document (parent or child row): static df → overrides → dependency results.
 * Desk re-runs this after every change (`refresh_dependency`).
 */
export function resolveFields(fields: FrappeDocField[], doc: FrappeDoc, parent: FrappeDoc, opts: EvaluatorOptions = {}, overrides: FieldOverrides = {}): Map<string, EffectiveField> {
  const out = new Map<string, EffectiveField>();
  for (const base of fields) {
    const df: EffectiveField = { ...base, ...overrides[base.fieldname] };
    const ctx = (property: DependsProperty): EvalContext => ({ doctype: doc.doctype, fieldname: df.fieldname, property });
    if (df.depends_on) df.hidden_due_to_dependency = !isTruthy(evaluateDepends(df.depends_on as DependsValue, doc, parent, opts, ctx("depends_on")));
    if (df.mandatory_depends_on) df.reqd = isTruthy(evaluateDepends(df.mandatory_depends_on as DependsValue, doc, parent, opts, ctx("mandatory_depends_on"))) ? 1 : 0;
    if (df.read_only_depends_on) df.read_only = isTruthy(evaluateDepends(df.read_only_depends_on as DependsValue, doc, parent, opts, ctx("read_only_depends_on"))) ? 1 : 0;
    out.set(df.fieldname, df);
  }
  return out;
}

/**
 * Collapsed state of a collapsible section (layout.js `refresh_section_collapse`, section.js:146-155): only for
 * `collapsible` sections; collapsed by default; with `collapsible_depends_on`, collapsed = NOT truthy; forced open when
 * it contains a required field whose value is null / undefined (section.js:146-156). Returns null for a section that is not collapsible.
 */
export function sectionCollapsed(section: FrappeDocField, fieldsInside: EffectiveField[], doc: FrappeDoc, opts: EvaluatorOptions = {}): boolean | null {
  if (!section.collapsible) return null;
  // section.js:150 `doc[fieldname] == null`: only a value that was never set forces the section open — "" or [] do not
  // (P35; before 0.7 any empty value did)
  const missing = fieldsInside.some((f) => f.reqd && doc[f.fieldname] == null);
  if (missing) return false;
  if (section.collapsible_depends_on) {
    return !isTruthy(evaluateDepends(section.collapsible_depends_on as DependsValue, doc, doc, opts, { doctype: doc.doctype, fieldname: section.fieldname, property: "collapsible_depends_on" }));
  }
  return true;
}

/** `frappe.model.has_value` negated: null / undefined / blank string are empty; 0 is a value; tables need a row. */
export function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}
