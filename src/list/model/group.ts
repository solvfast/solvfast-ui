/** Grouping (PMO components/lists/GroupedListTable.tsx + GroupByControl.tsx). */
export interface GroupBucket { key: string; label: string }
export interface GroupByOption<T> {
  key: string;
  label: string;
  /**
   * Bucket a row. Use key "__none__" for rows without a value — that group sorts last. A row may belong to SEVERAL
   * groups (an array: e.g. one per assignee or tag, as Desk's "Assigned To" / "Tags"); it is then listed in each of
   * them, and selection stays keyed by the row (selecting it in one group selects it everywhere). An empty array puts the
   * row in "__none__".
   */
  groupOf: (row: T) => GroupBucket | GroupBucket[];
}
export interface RowGroup<T> { key: string; label: string; rows: T[]; }

export function groupRows<T>(rows: T[], groupOf: GroupByOption<T>["groupOf"]): RowGroup<T>[] {
  const map = new Map<string, { label: string; rows: T[] }>();
  for (const row of rows) {
    const got = groupOf(row);
    const buckets = Array.isArray(got) ? (got.length ? got : [{ key: "__none__", label: "—" }]) : [got];
    const seen = new Set<string>();
    for (const { key, label } of buckets) {
      if (seen.has(key)) continue; // a row is listed once per group
      seen.add(key);
      const g = map.get(key) ?? { label, rows: [] };
      g.rows.push(row);
      map.set(key, g);
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === "__none__" ? 1 : b === "__none__" ? -1 : a.localeCompare(b)))
    .map(([key, v]) => ({ key, label: v.label, rows: v.rows }));
}
