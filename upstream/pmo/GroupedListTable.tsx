import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ListTable } from "@/components/lists/ListTable";
import type { ColumnDef, SortState } from "@/lib/list-view";

interface GroupedListTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  sort: SortState;
  onSortToggle: (key: string) => void;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Bucket a row into { key, label }. When omitted, renders a single flat ListTable. */
  groupOf?: (row: T) => { key: string; label: string };
}

/**
 * Grouped list table (G6): buckets rows via `groupOf` and renders a collapsible ListTable per group with a
 * header + count. When `groupOf` is undefined it degrades to a single flat ListTable (identical output).
 */
export function GroupedListTable<T>(props: GroupedListTableProps<T>) {
  const { groupOf, rows, ...tableProps } = props;

  const groups = useMemo(() => {
    if (!groupOf) return null;
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
  }, [groupOf, rows]);

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) =>
    setCollapsed((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  if (!groups) {
    return <ListTable rows={rows} {...tableProps} />;
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const isOpen = !collapsed.has(g.key);
        return (
          <div key={g.key} className="space-y-2">
            <button
              type="button"
              onClick={() => toggle(g.key)}
              className="flex w-full items-center gap-2 text-sm font-semibold text-foreground"
              aria-expanded={isOpen}
            >
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
              <span>{g.label}</span>
              <span className="rounded-full bg-muted px-2 text-xs font-normal text-muted-foreground">{g.rows.length}</span>
            </button>
            {isOpen && <ListTable rows={g.rows} {...tableProps} />}
          </div>
        );
      })}
    </div>
  );
}
