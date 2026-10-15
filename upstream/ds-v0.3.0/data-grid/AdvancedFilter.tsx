import { Plus, X, Filter } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import {
  OPERATORS_BY_TYPE, OPERATOR_LABEL, VALUELESS_OPERATORS, newCondition,
  type FilterField, type FilterQuery, type Operator,
} from "@/lib/data-grid/filter-engine";
import { FilterValueInput } from "./FilterValueInput";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Frappe-CRM-style advanced filter: AND/OR over meta-driven conditions (field → operator → value). */
export function AdvancedFilter({
  fields,
  query,
  onChange,
  activeCount,
}: {
  fields: FilterField[];
  query: FilterQuery;
  onChange: (q: FilterQuery) => void;
  activeCount: number;
}) {
  const { t } = useApp();
  const byName = new Map(fields.map((f) => [f.name, f]));

  const setConj = (conjunction: "and" | "or") => onChange({ ...query, conjunction });
  const add = () => onChange({ ...query, conditions: [...query.conditions, newCondition(fields[0]?.name)] });
  const remove = (id: string) => onChange({ ...query, conditions: query.conditions.filter((c) => c.id !== id) });
  const patch = (id: string, p: Partial<{ field: string; operator: Operator; value: string }>) =>
    onChange({
      ...query,
      conditions: query.conditions.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...p };
        if (p.field) {
          const ftype = byName.get(p.field)?.type ?? "text";
          if (!OPERATORS_BY_TYPE[ftype].includes(next.operator)) next.operator = OPERATORS_BY_TYPE[ftype][0];
          next.value = "";
        }
        return next;
      }),
    });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="h-4 w-4" /> {t("filter")}
          {activeCount > 0 && <Badge variant="info" className="ms-0.5 h-5 px-1.5">{activeCount}</Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,34rem)] p-3" align="end">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">{t("filters")}</span>
          {query.conditions.length > 1 && (
            <Select value={query.conjunction} onValueChange={(v) => setConj(v as "and" | "or")}>
              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="and">{t("match_all")}</SelectItem>
                <SelectItem value="or">{t("match_any")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          {query.conditions.map((c) => {
            const field = byName.get(c.field);
            const ftype = field?.type ?? "text";
            const valueless = VALUELESS_OPERATORS.includes(c.operator);
            return (
              <div key={c.id} className="flex items-center gap-1.5">
                <Select value={c.field} onValueChange={(v) => patch(c.id, { field: v })}>
                  <SelectTrigger className="h-8 w-1/3"><SelectValue placeholder={t("field")} /></SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => <SelectItem key={f.name} value={f.name}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={c.operator} onValueChange={(v) => patch(c.id, { operator: v as Operator })}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATORS_BY_TYPE[ftype].map((op) => <SelectItem key={op} value={op}>{t(OPERATOR_LABEL[op])}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="min-w-0 flex-1">
                  {!valueless && field && (
                    <FilterValueInput field={field} operator={c.operator} value={c.value} onChange={(v) => patch(c.id, { value: v })} />
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => remove(c.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {query.conditions.length === 0 && <p className="py-2 text-center text-sm text-muted-foreground">{t("no_filters")}</p>}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1 text-info" onClick={add}>
            <Plus className="h-4 w-4" /> {t("add_filter")}
          </Button>
          {query.conditions.length > 0 && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange({ conjunction: "and", conditions: [] })}>
              {t("clear_all")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
