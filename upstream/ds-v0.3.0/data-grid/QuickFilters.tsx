import { useApp } from "@/contexts/AppContext";
import {
  newCondition, type FilterField, type FilterQuery,
} from "@/lib/data-grid/filter-engine";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Inline quick filters — one control per field Frappe marks `in_standard_filter`. Editing a quick filter
 * upserts a matching condition in the shared FilterQuery (so it stays in sync with the advanced filter).
 */
export function QuickFilters({
  fields,
  query,
  onChange,
}: {
  fields: FilterField[];
  query: FilterQuery;
  onChange: (q: FilterQuery) => void;
}) {
  const { t } = useApp();
  if (!fields.length) return null;

  const valueOf = (name: string) => query.conditions.find((c) => c.field === name)?.value ?? "";
  const set = (field: FilterField, value: string) => {
    const others = query.conditions.filter((c) => c.field !== field.name);
    if (!value) return onChange({ ...query, conditions: others });
    const op = field.type === "select" || field.type === "link" || field.type === "boolean" ? "equals" : "like";
    onChange({ ...query, conditions: [...others, { ...newCondition(field.name, op), value }] });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {fields.map((f) =>
        f.type === "select" ? (
          <Select key={f.name} value={valueOf(f.name) || "__all__"} onValueChange={(v) => set(f, v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 w-auto min-w-[8rem] gap-1 text-xs"><SelectValue placeholder={f.label} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("all")} · {f.label}</SelectItem>
              {(f.options || []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : null,
      )}
    </div>
  );
}
