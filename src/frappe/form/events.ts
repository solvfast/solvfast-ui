/**
 * formEvents — the package's replacement for Desk Client Scripts (decision D-24, recommended; awaiting the owner's
 * approval). Desk runs `__js` / `__custom_js` with `new Function` against jQuery, `cur_frm` and `frappe.*` globals; the
 * package does NOT evaluate them (docs `11` §3). Apps register typed handlers instead, with Desk's event names and
 * order, and get an `frm`-like controller.
 *
 * Events (docs `11` §1.2, §3, §5): `setup` (once), `onload` (first load), `refresh` (every load and after every save),
 * `validate` → `before_save` (Save / Submit; not Update), `after_save`, `before_submit`, `on_submit`, `before_cancel`,
 * `after_cancel`; a parent field's name (after it changes); `<table>_add`, `before_<table>_remove`,
 * `<table>_remove`, `<table>_move`, `form_render` + `<table>_on_form_rendered` (row form opened); a Button field's name
 * (click). Child-row field changes go to `childEvents[<child DocType>][<fieldname>]` with `(frm, cdt, cdn)`.
 * Handlers run serially (promises awaited). `validate`, `before_save`, `before_submit`, `before_cancel` and
 * `before_<table>_remove` abort when a handler returns `false`, throws, or sets `frm.validated = false`.
 */
import type { FrappeDoc, FrappeDocField, SearchLinkOptions } from "../contract";

/** `frm.set_query` — what a Link search sends (docs `12` §4.4): an object (`{ filters }`, `{ query }` or a bare
 *  filters dict), a custom query method path, or a function of (doc, cdt, cdn) returning either. */
export type LinkQuery =
  | string
  | Record<string, unknown>
  | ((doc: FrappeDoc, cdt: string, cdn: string) => string | Record<string, unknown> | undefined);

export interface FormController {
  readonly doctype: string;
  readonly docname: string;
  /** The latest document (read-only snapshot; change it with setValue). */
  readonly doc: FrappeDoc;
  readonly isNew: boolean;
  readonly isDirty: boolean;
  /** Set to false inside validate / before_* to abort (Desk `frappe.validated = false`). */
  validated: boolean;
  setValue(field: string | Record<string, unknown>, value?: unknown): void;
  setRowValue(table: string, rowName: string, field: string | Record<string, unknown>, value?: unknown): void;
  /** `set_df_property`; with `table`, the property applies to the child DocType's column. */
  setDfProperty(field: string, property: keyof FrappeDocField | string, value: unknown, table?: string): void;
  toggleDisplay(fields: string | string[], show: boolean): void;
  toggleReqd(fields: string | string[], reqd: boolean): void;
  toggleEnable(fields: string | string[], enable: boolean): void;
  setQuery(field: string, query: LinkQuery, table?: string): void;
  addChild(table: string, values?: Record<string, unknown>): FrappeDoc;
  clearTable(table: string): void;
  /** Trigger a registered event by name (Desk `frm.trigger`). */
  trigger(event: string, cdt?: string, cdn?: string): Promise<boolean>;
}

export type FormEventHandler = (frm: FormController, cdt?: string, cdn?: string) => unknown;
export type FormEvents = Record<string, FormEventHandler | FormEventHandler[] | undefined>;

export interface FormEventsConfig {
  /** Events of the form's DocType (lifecycle, parent field changes, table events, button clicks). */
  events?: FormEvents;
  /** Field-change events of child rows, by child DocType. */
  childEvents?: Record<string, FormEvents>;
}

/** Events whose handlers can stop the action. */
export const ABORTABLE = (event: string) => ["validate", "before_save", "before_submit", "before_cancel"].includes(event) || /^before_.+_remove$/.test(event);

/** Run the handlers of one event serially. Resolves false when an abortable event was stopped. */
export async function runEvent(handlers: FormEventHandler | FormEventHandler[] | undefined, frm: FormController, event: string, cdt?: string, cdn?: string): Promise<boolean> {
  const list = handlers == null ? [] : Array.isArray(handlers) ? handlers : [handlers];
  const abortable = ABORTABLE(event);
  if (abortable) frm.validated = true;
  for (const h of list) {
    try {
      const r = await h(frm, cdt, cdn);
      if (abortable && (r === false || frm.validated === false)) return false;
    } catch (e) {
      if (abortable) return false;
      // eslint-disable-next-line no-console
      console.error(`[@solvfast/ui/frappe] form event "${event}" failed`, e);
    }
  }
  return true;
}

/** Normalise a set_query value into search options (docs `12` §4.4 step 2). Returns extra args too. */
export function resolveLinkQuery(q: LinkQuery | undefined, doc: FrappeDoc, cdt: string, cdn: string): { filters?: Record<string, unknown> | unknown[]; query?: string } {
  if (q == null) return {};
  const v = typeof q === "function" ? q(doc, cdt, cdn) : q;
  if (v == null) return {};
  if (typeof v === "string") return { query: v };
  const o = v as Record<string, unknown>;
  if ("filters" in o || "query" in o) {
    return { ...(o.filters != null ? { filters: o.filters as Record<string, unknown> } : {}), ...(typeof o.query === "string" ? { query: o.query } : {}) };
  }
  return { filters: o };
}

export type { SearchLinkOptions };
