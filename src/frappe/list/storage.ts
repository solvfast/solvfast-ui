/**
 * Server-backed storage for the generic ListView (its `storage` prop), over Desk's own DocTypes and methods:
 *  - saved filters  → `List Filter` rows (docs 13 §5.1): `frappe.client.get_list/insert/delete`;
 *  - per-user prefs → `user_settings` (docs 13 §1.8): read from `getdoctype`, written with
 *    `frappe.model.utils.user_settings.save(doctype, user_settings)`. Sort and filters use Desk's own keys
 *    (`List.sort_by`, `List.sort_order`, `List.filters`); the package's extras (columns, quick filters, group-by) live
 *    in `List.sf_ui` (UNVERIFIED: that Desk's deep merge keeps unknown keys — read from `user_settings.js:9-29`).
 * Both are adapters: the generic list never imports Frappe.
 */
import type { FrappeClient } from "../client";
import type { FilterQuery } from "../../list/model/filters";
import type { ListPrefs, ListPrefsStorage, SavedFilter, SavedFiltersStorage } from "../../list/model/storage";
import type { FrappeListMeta } from "../meta";
import { queryToTuples, tuplesToQuery } from "./tuples";

type MetaSource = FrappeListMeta | undefined | (() => FrappeListMeta | undefined);
const metaOf = (m: MetaSource) => (typeof m === "function" ? m() : m);

export interface FrappeSavedFiltersOptions {
  /** The session user (`for_user` of personal filters; they are listed together with the global ones, `for_user` empty). */
  user: string;
  meta: MetaSource;
  /** Desk offers "Is Global" to System Managers only; `save` stores a global filter when this is true. Default false. */
  global?: boolean;
}

/** `List Filter` rows as `SavedFiltersStorage`. `viewKey` is the DocType. */
export function createFrappeSavedFilters(client: FrappeClient, o: FrappeSavedFiltersOptions): SavedFiltersStorage {
  const list = async (doctype: string): Promise<SavedFilter[]> => {
    const rows = await client.getList<{ name: string; filter_name: string; for_user?: string; filters?: string }>("List Filter", {
      fields: ["name", "filter_name", "for_user", "filters"],
      filters: [["reference_doctype", "=", doctype]],
      or_filters: [["for_user", "=", o.user], ["for_user", "=", ""]],
      order_by: "filter_name asc", limit_page_length: 100,
    });
    const meta = metaOf(o.meta);
    return rows.map((r) => {
      let tuples: unknown = [];
      try { tuples = JSON.parse(r.filters || "[]"); } catch { /* unreadable → no conditions */ }
      const query: FilterQuery = meta ? tuplesToQuery(tuples, meta) : { conjunction: "and", conditions: [] };
      return { id: r.name, label: r.filter_name, query };
    });
  };
  return {
    list,
    async save(doctype, label, query) {
      const meta = metaOf(o.meta);
      if (!meta) throw new Error("The DocType's metadata is not loaded yet.");
      if ((await list(doctype)).some((f) => f.label === label)) throw new Error(`A filter named "${label}" already exists.`); // Desk rejects duplicates client-side
      const doc = { doctype: "List Filter", reference_doctype: doctype, filter_name: label, for_user: o.global ? "" : o.user, filters: JSON.stringify(queryToTuples(query, meta)) };
      await client.call("frappe.client.insert", { doc: JSON.stringify(doc) });
      return list(doctype);
    },
    async remove(doctype, id) {
      await client.call("frappe.client.delete", { doctype: "List Filter", name: id });
      return list(doctype);
    },
  };
}

export interface FrappeUserSettingsOptions {
  doctype: string;
  /** `user_settings` as `getdoctype` returned it (already parsed). */
  initial: Record<string, unknown> | undefined;
  meta: MetaSource;
  /** Write delay; the latest value wins. Default 500 ms (Desk writes on every render; this only batches). */
  delayMs?: number;
  onError?: (error: unknown) => void;
}

type ListSettings = { filters?: unknown; sort_by?: string; sort_order?: string; sf_ui?: { visible?: string[]; quick?: string[]; groupBy?: string; pageSize?: number } };

/** Per-user list preferences in `user_settings`. Loads synchronously from what `getdoctype` sent; saves are debounced. */
export function createFrappeUserSettings(client: FrappeClient, o: FrappeUserSettingsOptions): ListPrefsStorage & { persistQuery: true; flush: () => Promise<void> } {
  let settings: Record<string, unknown> = JSON.parse(JSON.stringify(o.initial ?? {}));
  let sent = JSON.stringify(settings);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = async () => {
    clearTimeout(timer); timer = undefined;
    const body = JSON.stringify(settings);
    if (body === sent) return; // Desk skips the call when nothing changed
    sent = body;
    try { await client.call("frappe.model.utils.user_settings.save", { doctype: o.doctype, user_settings: body }); } catch (e) { o.onError?.(e); }
  };
  return {
    persistQuery: true,
    flush,
    load() {
      const l = (settings.List ?? {}) as ListSettings;
      const meta = metaOf(o.meta);
      const prefs: ListPrefs = {};
      if (l.sort_by) prefs.sort = { key: l.sort_by, dir: l.sort_order === "asc" ? "asc" : "desc" };
      if (l.sf_ui?.visible) prefs.visible = l.sf_ui.visible;
      if (l.sf_ui?.quick) prefs.quick = l.sf_ui.quick;
      if (l.sf_ui?.groupBy) prefs.groupBy = l.sf_ui.groupBy;
      // Desk keeps no page length in user_settings (base_list.js:47 starts at 20 / 100 each time): the package's own key
      if (Number(l.sf_ui?.pageSize) > 0) prefs.pageSize = Number(l.sf_ui!.pageSize);
      if (Array.isArray(l.filters) && meta) prefs.query = tuplesToQuery(l.filters, meta);
      return prefs;
    },
    save(_viewKey, prefs) {
      const meta = metaOf(o.meta);
      const prev = (settings.List ?? {}) as ListSettings;
      const next: ListSettings = { ...prev, sf_ui: { visible: prefs.visible, quick: prefs.quick, groupBy: prefs.groupBy, ...(prefs.pageSize ? { pageSize: prefs.pageSize } : {}) } };
      if (prefs.sort?.key) { next.sort_by = prefs.sort.key; next.sort_order = prefs.sort.dir; }
      if (prefs.query && meta) { try { next.filters = queryToTuples(prefs.query, meta); } catch { /* an OR query is not storable: keep the last filters */ } }
      settings = { ...settings, last_view: "List", List: next };
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), o.delayMs ?? 500);
    },
  };
}
