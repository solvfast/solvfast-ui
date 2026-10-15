/** Client sort: Sear's type-aware comparator (sear_product hooks/useDataGrid.ts compareValues), with PMO's
 *  per-column `sortValue` override and natural string order — "Task 2" before "Task 10" (lib/list-view.ts).
 *  Fix: empty values stay last in both directions (Sear documented "nullish values sort last" but multiplied the whole
 *  comparison by the direction, so they came first when sorting descending); only real dates compare as dates (Sear
 *  used `Date.parse`, which reads "Task 10" as October 2001 and "Room 101" as the year 101). */
import { fieldOf, type ColumnDef } from "./columns";

export interface SortState { key: string | null; dir: "asc" | "desc"; }

/** Numbers numerically, dates chronologically, else natural locale string compare. Empty values sort last. */
// Date objects and ISO / Frappe date strings: `2026-10-15`, `2026-10-15 09:30[:00[.000]]`, `2026-10-15T09:30…`
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const asTime = (v: unknown) =>
  v instanceof Date ? v.getTime() : typeof v === "string" && ISO_DATE.test(v.trim()) ? Date.parse(v.trim().replace(" ", "T")) : NaN;

export function compareValues(a: unknown, b: unknown): number {
  const an = a === null || a === undefined || a === "";
  const bn = b === null || b === undefined || b === "";
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return (a ? 1 : 0) - (b ? 1 : 0);
  const na = typeof a === "number" ? a : Number(a);
  const nb = typeof b === "number" ? b : Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== "" && String(b).trim() !== "") return na - nb;
  const da = asTime(a), db = asTime(b);
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

const isEmpty = (v: unknown) => v === null || v === undefined || v === "";

export function sortRows<T>(rows: T[], sort: SortState, columns: ColumnDef<T>[]): T[] {
  if (!sort.key) return rows;
  const col = columns.find((c) => c.key === sort.key);
  if (!col || col.sortable === false) return rows;
  const dir = sort.dir === "asc" ? 1 : -1;
  const value = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[fieldOf(col)]);
  return [...rows].sort((a, b) => {
    const va = value(a), vb = value(b);
    if (isEmpty(va) || isEmpty(vb)) return compareValues(va, vb); // empties last, whatever the direction
    return compareValues(va, vb) * dir;
  });
}
