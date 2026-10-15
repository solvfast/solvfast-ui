/**
 * Persistence adapters. Default: localStorage, namespaced per list (`viewKey`) and optionally per user.
 * Sear's DataGrid kept columns + saved filters in `grid:cols:<doctype>` / `grid:saved:<doctype>`; PMO kept columns and
 * view prefs in localStorage and saved filters on the server (`PMO Saved Filter` DocType) — such a backend plugs in by
 * implementing `SavedFiltersStorage` (methods may return promises).
 */
import type { FilterQuery } from "./filters";
import type { SortState } from "./sort";

export interface ListPrefs { visible?: string[]; sort?: SortState; groupBy?: string; quick?: string[]; }
export interface ListPrefsStorage {
  load(viewKey: string): ListPrefs;
  save(viewKey: string, prefs: ListPrefs): void;
}
export interface SavedFilter { id: string; label: string; query: FilterQuery; }
type MaybePromise<T> = T | Promise<T>;
export interface SavedFiltersStorage {
  list(viewKey: string): MaybePromise<SavedFilter[]>;
  save(viewKey: string, label: string, query: FilterQuery): MaybePromise<SavedFilter[]>;
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
      save: (v, label, query) => {
        const next = [...read<SavedFilter[]>(k(v, "saved"), []).filter((f) => f.label !== label), { id: `f${Date.now()}`, label, query }];
        write(k(v, "saved"), next); return next;
      },
      remove: (v, id) => { const next = read<SavedFilter[]>(k(v, "saved"), []).filter((f) => f.id !== id); write(k(v, "saved"), next); return next; },
    },
  };
}
