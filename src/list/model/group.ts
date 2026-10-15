/** Grouping (PMO components/lists/GroupedListTable.tsx + GroupByControl.tsx). */
export interface GroupByOption<T> {
  key: string;
  label: string;
  /** Bucket a row. Use key "__none__" for rows without a value — that group sorts last. */
  groupOf: (row: T) => { key: string; label: string };
}
export interface RowGroup<T> { key: string; label: string; rows: T[]; }

export function groupRows<T>(rows: T[], groupOf: GroupByOption<T>["groupOf"]): RowGroup<T>[] {
  const map = new Map<string, { label: string; rows: T[] }>();
  for (const row of rows) {
    const { key, label } = groupOf(row);
    const g = map.get(key) ?? { label, rows: [] };
    g.rows.push(row);
    map.set(key, g);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === "__none__" ? 1 : b === "__none__" ? -1 : a.localeCompare(b)))
    .map(([key, v]) => ({ key, label: v.label, rows: v.rows }));
}
