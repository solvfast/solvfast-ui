/**
 * Shared list-view model: column definitions, sort state, a generic comparator, and per-view persistence
 * of which columns show + their order (localStorage). Powers the customizable, sortable ListTable used by
 * every list view (projects, tasks, bugs, …) — same idea as Frappe CRM's column picker + sort.
 */
import { mockStore } from "@/lib/api";

export interface ColumnDef<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  /** Returns a sortable primitive; omit to make the column non-sortable. */
  sortValue?: (row: T) => string | number;
  align?: "start" | "end";
  className?: string;
  /** Always shown + cannot be hidden (e.g. the primary name column). */
  alwaysVisible?: boolean;
  /**
   * Underlying doctype fieldname(s) this curated column already represents. Used to dedupe against
   * metadata-driven columns so the same field isn't offered twice (e.g. curated "Task" covers `subject`).
   */
  metaFields?: string[];
  /**
   * For metadata-driven columns built from `get_filter_fields`: the raw fieldname whose value must be
   * fetched via the list service's `extra_fields` arg. Curated columns leave this unset.
   */
  metaField?: string;
}

export interface SortState {
  key: string | null;
  dir: "asc" | "desc";
}

/** Group-by field key for a list view ("none" = flat). */
export type GroupByKey = string;

const COLS_KEY = "pmo_column_prefs";
type ColPrefs = Record<string, string[]>; // viewKey -> ordered visible column keys

const readColPrefs = (): ColPrefs => mockStore.read<ColPrefs>(COLS_KEY, {});

/**
 * Visible columns (ordered) for a view. Returns the stored ordered keys AS-IS when present (so saved
 * meta/non-default columns survive — `visibleColumns` filters unknown keys at render, and
 * `visibleExtraFields` intersects with known keys, so retaining extras is safe even while meta columns
 * load async). Falls back to `defaultKeys` only when nothing is stored.
 */
export function getColumnPrefs(view: string, defaultKeys: string[]): string[] {
  const stored = readColPrefs()[view];
  if (!stored) return defaultKeys;
  return stored;
}

export function setColumnPrefs(view: string, keys: string[]): void {
  const prefs = readColPrefs();
  prefs[view] = keys;
  mockStore.write(COLS_KEY, prefs);
}

// ---- full saved-view prefs (group_by + sort) — persisted per view (FR-VIEW / G6) --------------

/** The extra per-view preferences beyond column visibility (which lives in COLS_KEY, above). */
export interface ViewPrefs {
  group_by: GroupByKey;
  sort: SortState;
}

const VIEW_KEY = "pmo_view_prefs";
type AllViewPrefs = Record<string, ViewPrefs>;

const DEFAULT_VIEW_PREFS: ViewPrefs = { group_by: "none", sort: { key: null, dir: "asc" } };

const readViewPrefs = (): AllViewPrefs => mockStore.read<AllViewPrefs>(VIEW_KEY, {});

export function getViewPrefs(view: string): ViewPrefs {
  const stored = readViewPrefs()[view];
  return stored ? { ...DEFAULT_VIEW_PREFS, ...stored } : { ...DEFAULT_VIEW_PREFS };
}

export function setViewPrefs(view: string, prefs: Partial<ViewPrefs>): void {
  const all = readViewPrefs();
  all[view] = { ...(all[view] ?? DEFAULT_VIEW_PREFS), ...prefs };
  mockStore.write(VIEW_KEY, all);
}

/** Sort a list by a column's sortValue. Strings compared with locale; numbers numerically. Stable-ish. */
export function sortRows<T>(rows: T[], sort: SortState, columns: ColumnDef<T>[]): T[] {
  if (!sort.key) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col?.sortValue) return rows;
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = col.sortValue!(a);
    const bv = col.sortValue!(b);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * factor;
  });
}
