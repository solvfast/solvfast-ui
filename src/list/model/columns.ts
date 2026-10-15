/** Column model: PMO's `ColumnDef` (renderer per column, lib/list-view.ts) + Sear's type-driven defaults. */
import type { ReactNode } from "react";
import type { FieldType, FilterField } from "./filters";
import type { Localized } from "../../lib/localized";

export interface ColumnDef<T> {
  key: string;
  label: Localized;
  /** Row value lives at `row[field ?? key]`. */
  field?: string;
  /** Drives the default cell, the filter input and the sort. */
  type?: FieldType;
  /** Raw backend type, e.g. "Currency" (default cell formatting). */
  fieldtype?: string;
  /** Custom cell. Default: a type-aware cell. */
  render?: (row: T) => ReactNode;
  /** Sortable primitive (overrides the type-aware comparison). */
  sortValue?: (row: T) => string | number;
  align?: "start" | "end";
  className?: string;
  /** Start hidden (the user can show it from the column manager). */
  hidden?: boolean;
  /** Always shown; cannot be hidden or moved by the user. */
  alwaysVisible?: boolean;
  /** Default true. `false` = not offered in the column manager. */
  hideable?: boolean;
  /** Default true. */
  sortable?: boolean;
  /** Default true when `type` is set. */
  filterable?: boolean;
  /** Select options (filters and quick filters). */
  options?: { value: string; label: string }[];
  /** Field names this column already represents (dedupes generated columns — PMO `metaFields`). */
  metaFields?: string[];
}

export const fieldOf = <T,>(c: ColumnDef<T>) => c.field ?? c.key;

/** Curated columns first, then generated ones whose field no curated column covers (PMO useMetaColumns). */
export function mergeColumns<T>(curated: ColumnDef<T>[], generated: ColumnDef<T>[]): ColumnDef<T>[] {
  const covered = new Set<string>();
  for (const c of curated) { covered.add(c.key); covered.add(fieldOf(c)); for (const f of c.metaFields ?? []) covered.add(f); }
  return [...curated, ...generated.filter((g) => !covered.has(fieldOf(g)))];
}

/** Filter fields derived from columns (those with a type, unless `filterable: false`). */
export function filterFieldsFromColumns<T>(columns: ColumnDef<T>[], label: (l: Localized) => string): FilterField[] {
  return columns
    .filter((c) => c.type && c.filterable !== false)
    .map((c) => ({ name: fieldOf(c), label: label(c.label), type: c.type!, fieldtype: c.fieldtype, options: c.options }));
}
