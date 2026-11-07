/**
 * Persistence adapters. Default: localStorage, namespaced per list (`viewKey`) and optionally per user.
 * Sear's DataGrid kept columns + saved filters in `grid:cols:<doctype>` / `grid:saved:<doctype>`; PMO kept columns and
 * view prefs in localStorage and saved filters on the server (`PMO Saved Filter` DocType) — such a backend plugs in by
 * implementing `SavedFiltersStorage` (methods may return promises).
 */
import type { FilterQuery } from "./filters";
import type { SortState } from "./sort";

export interface ListPrefs { visible?: string[]; sort?: SortState; groupBy?: string; quick?: string[]; /** Only stored by adapters that set `persistQuery`. */ query?: FilterQuery; /** Rows per page the user chose (`pageSizes`). */ pageSize?: number; }
export interface ListPrefsStorage {
  /** Also restore and save the filter query (Desk keeps the current filters in the user's settings). Default: no. */
  persistQuery?: boolean;
  load(viewKey: string): ListPrefs;
  save(viewKey: string, prefs: ListPrefs): void;
}
export interface SavedFilter { id: string; label: string; query: FilterQuery; /** Shared with every user (Desk's "Is Global": `List Filter.for_user` empty). */ global?: boolean; }
type MaybePromise<T> = T | Promise<T>;
/** Options of one save: `global` = for every user (Desk's "Is Global", offered to System Managers, list_filter.js:6, 40-46). */
export interface SaveFilterOptions { global?: boolean }
export interface SavedFiltersStorage {
  list(viewKey: string): MaybePromise<SavedFilter[]>;
  /** Rejects (throws) a label that already exists, as Desk does (list_filter.js:127, 135-137). */
  save(viewKey: string, label: string, query: FilterQuery, opts?: SaveFilterOptions): MaybePromise<SavedFilter[]>;
  remove(viewKey: string, id: string): MaybePromise<SavedFilter[]>;
}

export function createLocalStorageAdapter(opts: { prefix?: string; userKey?: string } = {}): { prefs: ListPrefsStorage; saved: SavedFiltersStorage } {
  const prefix = opts.prefix ?? "sf:list:";
  const k = (viewKey: string, what: string) => `${prefix}${opts.userKey ? `${opts.userKey}:` : ""}${viewKey}:${what}`;
  const read = <T,>(key: string, fallback: T): T => { try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; } };
  const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };
  return {
    prefs: { load: (v) => read<ListPrefs>(k(v, "prefs"), {}), save: (v, p) => write(k(v, "prefs"), p) },
    saved: {
      list: (v) => read<SavedFilter[]>(k(v, "saved"), []),
      // P35: a duplicate name is rejected (it used to replace the old filter silently), as the Frappe adapter and Desk do
      save: (v, label, query, o) => {
        const prev = read<SavedFilter[]>(k(v, "saved"), []);
        if (prev.some((f) => f.label === label)) throw new Error(`A filter named "${label}" already exists.`);
        const next = [...prev, { id: `f${Date.now()}`, label, query, ...(o?.global ? { global: true } : {}) }];
        write(k(v, "saved"), next); return next;
      },
      remove: (v, id) => { const next = read<SavedFilter[]>(k(v, "saved"), []).filter((f) => f.id !== id); write(k(v, "saved"), next); return next; },
    },
  };
}
