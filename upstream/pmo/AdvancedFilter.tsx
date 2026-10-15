import { useRef, useState } from "react";
import { Filter, Plus, X, Trash2, Bookmark, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FieldCombobox } from "@/components/filters/FieldCombobox";
import { LinkField } from "@/components/projects/LinkField";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  OPERATOR_LABEL,
  OPERATORS_BY_TYPE,
  VALUELESS_OPERATORS,
  activeConditionCount,
  type FilterCondition,
  type FilterField,
  type FilterQuery,
  type Operator,
} from "@/lib/filter-engine";
import { get_saved_filters, save_filter, delete_filter } from "@/services/saved_filters";

/**
 * CRM-style advanced filter builder shared by all list views. Build rows of
 * field → operator → value, combined with AND / OR, and save named filters per `viewKey` for reuse.
 */
export function AdvancedFilter({
  fields,
  query,
  onChange,
  viewKey,
}: {
  fields: FilterField[];
  query: FilterQuery;
  onChange: (q: FilterQuery) => void;
  viewKey: string;
}) {
  const { t } = useApp();
  const qc = useQueryClient();
  const idRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const count = activeConditionCount(query);

  const fieldOf = (name: string) => fields.find((f) => f.name === name);

  const savedQuery = useQuery({
    queryKey: ["saved_filters", viewKey],
    queryFn: () => get_saved_filters({ view: viewKey }),
  });

  const saveMutation = useMutation({
    mutationFn: () => save_filter({ view: viewKey, label: saveName.trim(), query }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved_filters", viewKey] });
      toast.success(t("filter_saved"));
      setSaveName("");
    },
    onError: () => toast.error(t("something_went_wrong")),
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => delete_filter({ name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved_filters", viewKey] }),
  });

  const addCondition = () => {
    // Fields are loaded dynamically from the doctype meta; ignore clicks until they arrive.
    const field = fields[0];
    if (!field) return;
    const cond: FilterCondition = {
      id: `c${idRef.current++}`,
      field: field.name,
      operator: (OPERATORS_BY_TYPE[field.type] ?? OPERATORS_BY_TYPE.text)[0],
      value: "",
    };
    onChange({ ...query, conditions: [...query.conditions, cond] });
  };

  const updateCondition = (id: string, patch: Partial<FilterCondition>) =>
    onChange({
      ...query,
      conditions: query.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });

  const removeCondition = (id: string) =>
    onChange({ ...query, conditions: query.conditions.filter((c) => c.id !== id) });

  const onFieldChange = (id: string, fieldName: string) => {
    const f = fieldOf(fieldName);
    const op = f ? (OPERATORS_BY_TYPE[f.type] ?? OPERATORS_BY_TYPE.text)[0] : "equals";
    updateCondition(id, { field: fieldName, operator: op, value: "" });
  };

  const onOperatorChange = (id: string, op: Operator) =>
    updateCondition(id, VALUELESS_OPERATORS.includes(op) ? { operator: op, value: "" } : { operator: op });

  const ValueInput = ({ cond }: { cond: FilterCondition }) => {
    if (VALUELESS_OPERATORS.includes(cond.operator)) return <div className="flex-1" />;
    const f = fieldOf(cond.field);
    const type = f?.type ?? "text";
    if (type === "select" && f?.options) {
      return (
        <Select value={cond.value} onValueChange={(v) => updateCondition(cond.id, { value: v })}>
          <SelectTrigger className="h-9 flex-1"><SelectValue placeholder={t("select_ellipsis")} /></SelectTrigger>
          <SelectContent>
            {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (type === "boolean") {
      return (
        <Select value={cond.value} onValueChange={(v) => updateCondition(cond.id, { value: v })}>
          <SelectTrigger className="h-9 flex-1"><SelectValue placeholder={t("select_ellipsis")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true">{t("yes")}</SelectItem>
            <SelectItem value="false">{t("no")}</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    if (type === "date") {
      return <DatePicker value={cond.value} onChange={(v) => updateCondition(cond.id, { value: v })} className="h-9 flex-1" />;
    }
    if (type === "link" && f?.link_doctype && cond.operator !== "in" && cond.operator !== "not_in") {
      return (
        <div className="flex-1">
          <LinkField
            doctype={f.link_doctype}
            value={cond.value}
            onSelect={(v) => updateCondition(cond.id, { value: v })}
            placeholder={t("select_ellipsis")}
          />
        </div>
      );
    }
    return (
      <Input
        type={type === "number" ? "number" : "text"}
        value={cond.value}
        onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
        placeholder={t("value")}
        className="h-9 flex-1"
      />
    );
  };

  const applySaved = (q: FilterQuery) => {
    // re-id conditions so local edits stay stable
    onChange({ conjunction: q.conjunction, conditions: q.conditions.map((c) => ({ ...c, id: `c${idRef.current++}` })) });
    setOpen(true);
  };

  const saved = savedQuery.data?.items ?? [];

  return (
    <div className="flex items-center gap-2">
      {saved.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Bookmark className="h-4 w-4" /> {t("saved_filters")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>{t("saved_filters")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {saved.map((sf) => (
              <DropdownMenuItem key={sf.name} onSelect={(e) => { e.preventDefault(); applySaved(sf.query); }} className="justify-between">
                <span className="truncate">{sf.label}</span>
                <button
                  type="button"
                  aria-label={t("delete")}
                  className="ms-2 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(sf.name); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-4 w-4" /> {t("filter")}
            {count > 0 && <Badge variant="secondary" className="ms-1 h-5 px-1.5">{count}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,34rem)] p-3">
          {query.conditions.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-muted-foreground">
              {fields.length === 0 ? t("loading") : t("no_filters_yet")}
            </p>
          ) : (
            <div className="space-y-2">
              {query.conditions.map((cond, i) => {
                const f = fieldOf(cond.field);
                const operators = OPERATORS_BY_TYPE[f?.type ?? "text"] ?? OPERATORS_BY_TYPE.text;
                return (
                  <div key={cond.id} className="flex items-center gap-2">
                    <div className="w-16 shrink-0 text-xs text-muted-foreground">
                      {i === 0 ? (
                        t("where")
                      ) : (
                        <Select value={query.conjunction} onValueChange={(v) => onChange({ ...query, conjunction: v as "and" | "or" })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="and">{t("conj_and")}</SelectItem>
                            <SelectItem value="or">{t("conj_or")}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <FieldCombobox
                      options={fields.map((fld) => ({ value: fld.name, label: fld.label }))}
                      value={cond.field}
                      onChange={(v) => onFieldChange(cond.id, v)}
                      className="w-32 shrink-0"
                    />
                    <Select value={cond.operator} onValueChange={(v) => onOperatorChange(cond.id, v as Operator)}>
                      <SelectTrigger className="h-9 w-28 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {operators.map((op) => <SelectItem key={op} value={op}>{t(OPERATOR_LABEL[op])}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <ValueInput cond={cond} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={t("remove")} onClick={() => removeCondition(cond.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={addCondition} disabled={fields.length === 0}>
              <Plus className="h-4 w-4" /> {t("add_filter")}
            </Button>
            {count > 0 && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => onChange({ conjunction: "and", conditions: [] })}>
                <X className="h-4 w-4" /> {t("clear_filters")}
              </Button>
            )}
          </div>

          {count > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex items-center gap-2">
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={t("filter_name")}
                  className="h-9"
                />
                <Button
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={!saveName.trim() || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  <Check className="h-4 w-4" /> {t("save")}
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
