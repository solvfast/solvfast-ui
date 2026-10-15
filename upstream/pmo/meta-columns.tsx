/**
 * Metadata-driven column merging. Each list view keeps its curated columns (with their rich renderers) and
 * augments them with EVERY other real doctype field from `get_filter_fields` that no curated column already
 * represents. Meta-only columns render with a generic, type-aware cell and are fetched on demand via the
 * list service's `extra_fields` arg. The curated column always wins when both cover the same fieldname.
 */
import { useMemo } from "react";
import { useApp } from "@/contexts/AppContext";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/projects-labels";
import type { ColumnDef } from "@/lib/list-view";
import type { FilterField } from "@/lib/filter-engine";

/** Generic, type-aware cell for a metadata-driven column. Empty values render as an em-dash. */
function MetaCell({ field, value }: { field: FilterField; value: unknown }) {
  const { language, t } = useApp();
  const isBlank = value === undefined || value === null || value === "";
  if (isBlank) return <span className="text-muted-foreground">—</span>;

  if (field.type === "date") {
    return <span className="text-muted-foreground">{formatDate(String(value), language)}</span>;
  }
  if (field.type === "number") {
    const n = Number(value);
    if (Number.isNaN(n)) return <span className="text-muted-foreground">—</span>;
    const isCurrency = (field.fieldtype ?? "").toLowerCase() === "currency";
    return (
      <span className="tabular-nums text-muted-foreground">
        {isCurrency ? formatCurrency(n, language) : n.toLocaleString(language === "ar" ? "ar" : "en")}
      </span>
    );
  }
  if (field.type === "boolean") {
    const yes = value === true || value === 1 || value === "1" || value === "true";
    return <span className="text-muted-foreground">{yes ? t("yes") : t("no")}</span>;
  }
  if (field.type === "select") {
    return <Badge variant="outline">{String(value)}</Badge>;
  }
  // link / text → raw value (the link's name).
  return <span className="text-muted-foreground">{String(value)}</span>;
}

/**
 * Merge a list view's curated columns with metadata-driven ones.
 * - Returns the unified `columns` (curated first, then meta-only — deduped by underlying fieldname).
 * - `metaOnlyKeys`: the fieldnames that exist only as meta columns (their data isn't on the base row and
 *   must be requested via `extra_fields` when made visible).
 */
export function useMetaColumns<T>(
  curated: ColumnDef<T>[],
  metaFields: FilterField[],
): { columns: ColumnDef<T>[]; metaOnlyKeys: string[] } {
  const { language } = useApp();
  return useMemo(() => {
    // Fieldnames already represented by a curated column (via metaFields or a matching key).
    const covered = new Set<string>();
    for (const c of curated) {
      covered.add(c.key);
      for (const f of c.metaFields ?? []) covered.add(f);
    }

    const metaOnly = metaFields.filter((f) => !covered.has(f.name));
    const metaColumns: ColumnDef<T>[] = metaOnly.map((f) => ({
      key: f.name,
      label: f.label,
      metaField: f.name,
      sortValue: (row) => {
        const v = (row as Record<string, unknown>)[f.name];
        if (v === undefined || v === null) return "";
        return f.type === "number" || f.type === "date"
          ? (f.type === "date" ? new Date(String(v)).getTime() || 0 : Number(v) || 0)
          : String(v);
      },
      render: (row) => <MetaCell field={f} value={(row as Record<string, unknown>)[f.name]} />,
    }));

    return { columns: [...curated, ...metaColumns], metaOnlyKeys: metaOnly.map((f) => f.name) };
    // language is a dep so meta cells re-render in the active language; curated already depends on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curated, metaFields, language]);
}

/**
 * Raw doctype fieldnames to request via `extra_fields` for the currently visible columns. Includes:
 *  - meta-only columns (their key IS the raw fieldname), and
 *  - the `metaFields` of any visible CURATED column whose value the list endpoint doesn't return on the
 *    base row (e.g. Tasks `sprint_points` → `custom_sprint_points`).
 * The backend's `safe_extra_fields` skips invalid/base-row fields, so passing a superset is safe.
 */
export function visibleExtraFields<T>(
  visibleColumns: ColumnDef<T>[],
  metaOnlyKeys: string[],
): string[] {
  const metaOnly = new Set(metaOnlyKeys);
  const out = new Set<string>();
  for (const col of visibleColumns) {
    if (metaOnly.has(col.key)) out.add(col.key);
    for (const f of col.metaFields ?? []) out.add(f);
  }
  return [...out];
}
