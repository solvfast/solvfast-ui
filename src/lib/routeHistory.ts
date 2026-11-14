/**
 * createRouteHistory — a framework-free history of visited routes (Desk keeps one per tab, `frappe.route_history`,
 * router.js:11, 303-305) for a global search's "Recent" rows. No router dependency: the app calls `record(entry)` from
 * its own navigation and reads `list()` when it builds the rows. Core since 0.8.0-dev.9 (S-07); the Frappe entry keeps
 * its own Desk-route history (`recordDeskRoute` / `deskRouteHistory`).
 *
 * In memory by default (one tab). With `storage` (e.g. `sessionStorage` or `localStorage`) the entries are also written
 * under `key` as JSON and read back on creation — entries must then be JSON values. A storage that throws (private mode,
 * quota) is ignored: the history keeps working in memory.
 */

/** The subset of the Web Storage API the history uses. */
export interface RouteHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RouteHistoryOptions<T> {
  /** Entries kept (the oldest are dropped). Default 100 (Desk's in-tab history has no cap; 100 keeps storage small). */
  max?: number;
  /** Persist across reloads / tabs (e.g. `sessionStorage`). Default: memory only. */
  storage?: RouteHistoryStorage;
  /** The storage key. Default "sf-route-history". */
  key?: string;
  /** When given, recording an entry equal to an existing one moves it to the end instead of adding a second copy
   *  (Desk keeps duplicates — the default). */
  equals?: (a: T, b: T) => boolean;
}

export interface RouteHistory<T> {
  /** Add a visited entry (newest last). */
  record(entry: T): void;
  /** The entries, oldest first. A new array each call. */
  list(): T[];
  /** The newest `n` entries, newest first (default: all). */
  recent(n?: number): T[];
  /** Forget every entry (and the stored copy). */
  clear(): void;
}

export function createRouteHistory<T = string>(o: RouteHistoryOptions<T> = {}): RouteHistory<T> {
  const max = Math.max(1, Math.floor(o.max ?? 100));
  const key = o.key ?? "sf-route-history";
  let items: T[] = [];
  if (o.storage) {
    try {
      const raw = o.storage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) items = (parsed as T[]).slice(-max);
    } catch { items = []; }
  }
  const save = () => {
    if (!o.storage) return;
    try { o.storage.setItem(key, JSON.stringify(items)); } catch { /* storage unavailable: memory only */ }
  };
  return {
    record(entry) {
      if (o.equals) items = items.filter((x) => !o.equals!(x, entry));
      items.push(entry);
      if (items.length > max) items = items.slice(items.length - max);
      save();
    },
    list: () => [...items],
    recent: (n) => [...items].reverse().slice(0, n ?? items.length),
    clear() { items = []; save(); },
  };
}
