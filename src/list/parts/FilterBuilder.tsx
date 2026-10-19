/**
 * Advanced filter — Sear's DataGrid AdvancedFilter + FilterValueInput (design_system components/data-grid, v0.3.0)
 * with PMO's improvements (solvfast_pmo components/filters/AdvancedFilter.tsx, FieldCombobox.tsx, LinkField.tsx):
 * a searchable field picker (styled like Sear's select trigger), a real date picker for date values (Sear's glass
 * DateField instead of the native `type=date`), and link autocomplete through the app's `loadOptions` (debounced).
 * Fixes: value inputs are proper components (PMO declared them inside render, so they remounted on every keystroke);
 * the "Add filter" action uses the theme primary directly (Sear recoloured `button.text-info` globally to get this);
 * every control in a condition row has an accessible name (field, condition, value — comboboxes don't take their
 * name from their text, so Sear's and PMO's were announced unnamed).
 */
import * as React from "react";
import { Check, ChevronDown, ChevronsUpDown, Filter, Plus, X } from "lucide-react";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../primitives/command";
import { DateField } from "../../primitives/date-time-field";
import { Input } from "../../primitives/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import {
  TIMESPANS, TIMESPAN_LABEL, VALUELESS_OPERATORS, defaultOperator, joinRange, newCondition, operatorLabelKey, operatorsFor,
  splitRange, type FilterField, type FilterQuery, type FiscalYear, type Operator,
} from "../model/filters";

/** Async options for link fields: `(field, text) => [{ value, label }]`. */
export type LoadOptions = (field: FilterField, text: string) => Promise<{ value: string; label: string }[]>;

export interface FilterBuilderProps {
  fields: FilterField[];
  query: FilterQuery;
  onChange: (q: FilterQuery) => void;
  activeCount: number;
  loadOptions?: LoadOptions;
  /** Offers "Fiscal Year" on date fields (Frappe/ERPNext fiscal years). */
  fiscalYears?: FiscalYear[];
  /** Or load them when the filter first opens (the Frappe entry does this). */
  loadFiscalYears?: () => Promise<FiscalYear[]>;
}

/** What kind of value an operator takes; switching kinds clears the value (a date can't become a timespan). */
const valueKind = (op: Operator) =>
  VALUELESS_OPERATORS.includes(op) ? "none" : op === "between" || op === "timespan" || op === "fiscal_year" ? op : op === "in" || op === "not_in" ? "list" : "one";

export function FilterBuilder({ fields, query, onChange, activeCount, loadOptions, fiscalYears: given, loadFiscalYears }: FilterBuilderProps) {
  const { t } = useLocale();
  const [loaded, setLoaded] = React.useState<FiscalYear[]>();
  const fiscalYears = given ?? loaded;
  const onOpenChange = (open: boolean) => {
    if (open && !given && !loaded && loadFiscalYears) loadFiscalYears().then(setLoaded, () => setLoaded([]));
  };
  const byName = new Map(fields.map((f) => [f.name, f]));
  const opsFor = (f?: FilterField) => operatorsFor(f, { fiscalYears: !!fiscalYears?.length });
  const setConj = (conjunction: "and" | "or") => onChange({ ...query, conjunction });
  const add = () => {
    const f = fields[0];
    onChange({ ...query, conditions: [...query.conditions, newCondition(f?.name, defaultOperator(f))] });
  };
  const remove = (id: string) => onChange({ ...query, conditions: query.conditions.filter((c) => c.id !== id) });
  const patch = (id: string, p: Partial<{ field: string; operator: Operator; value: string }>) =>
    onChange({
      ...query,
      conditions: query.conditions.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...p };
        if (p.field) {
          const f = byName.get(p.field);
          const shown = next.operator === "is_not_set" ? "is_set" : next.operator;
          if (!opsFor(f).includes(shown) || f?.type !== byName.get(c.field)?.type) next.operator = defaultOperator(f);
          next.value = "";
        }
        if (p.operator && valueKind(p.operator) !== valueKind(c.operator)) next.value = "";
        return next;
      }),
    });

  return (
    <Popover onOpenChange={onOpenChange}>
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
              <SelectTrigger className="h-7 w-24 text-xs" aria-label={t("conjunction")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="and">{t("matchAll")}</SelectItem>
                <SelectItem value="or">{t("matchAny")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          {query.conditions.map((c) => {
            const field = byName.get(c.field);
            const isOp = c.operator === "is_set" || c.operator === "is_not_set";
            const ops = opsFor(field);
            // A saved condition whose operator this field no longer offers (e.g. Equals on a Datetime) still shows.
            const shownOp = isOp ? "is_set" : c.operator;
            const listed = ops.includes(shownOp) ? ops : [...ops, shownOp];
            return (
              <div key={c.id} className="flex items-center gap-1.5">
                <FieldPicker fields={fields} value={c.field} onChange={(v) => patch(c.id, { field: v })} />
                <Select value={shownOp} onValueChange={(v) => patch(c.id, { operator: v as Operator })}>
                  <SelectTrigger className="h-8 w-28" aria-label={t("operator")}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {listed.map((op) => <SelectItem key={op} value={op}>{t(operatorLabelKey(op, field))}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="min-w-0 flex-1">
                  {isOp ? (
                    // Frappe's "Is": Set / Not Set
                    <Select value={c.operator} onValueChange={(v) => patch(c.id, { operator: v as Operator })}>
                      <SelectTrigger className="h-8 w-full" aria-label={t("value")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="is_set">{t("valueSet")}</SelectItem>
                        <SelectItem value="is_not_set">{t("valueNotSet")}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : field && (
                    <FilterValueInput field={field} operator={c.operator} value={c.value} onChange={(v) => patch(c.id, { value: v })} loadOptions={loadOptions} fiscalYears={fiscalYears} />
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => remove(c.id)} aria-label={t("remove")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          {query.conditions.length === 0 && <p className="py-2 text-center text-sm text-muted-foreground">{t("noFilters")}</p>}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="gap-1 text-primary" onClick={add} disabled={fields.length === 0}>
            <Plus className="h-4 w-4" /> {t("addFilter")}
          </Button>
          {query.conditions.length > 0 && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onChange({ conjunction: "and", conditions: [] })}>
              {t("clearAll")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Searchable field picker (PMO FieldCombobox) whose closed state matches Sear's field <Select> exactly. */
function FieldPicker({ fields, value, onChange }: { fields: FilterField[]; value: string; onChange: (v: string) => void }) {
  const { t } = useLocale();
  const [open, setOpen] = React.useState(false);
  const label = fields.find((f) => f.name === value)?.label;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={t("field")}
          className="sf-field-fill flex h-8 w-1/3 items-center justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm outline-none focus:outline-none [&>span]:line-clamp-1"
        >
          <span className={cn(!label && "text-muted-foreground")}>{label ?? t("field")}</span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={t("listSearch")} />
          <CommandList>
            <CommandEmpty>{t("noResults")}</CommandEmpty>
            <CommandGroup>
              {fields.map((f) => (
                <CommandItem key={f.name} value={`${f.label} ${f.name}`} onSelect={() => { onChange(f.name); setOpen(false); }}>
                  <Check className={cn("me-2 h-4 w-4", value === f.name ? "opacity-100" : "opacity-0")} />
                  {f.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** The value input for a condition, by field type and operator (Sear FilterValueInput + PMO DatePicker / LinkField). */
export function FilterValueInput({ field, operator, value, onChange, loadOptions, fiscalYears }: {
  field: FilterField; operator: Operator; value: string; onChange: (v: string) => void; loadOptions?: LoadOptions; fiscalYears?: FiscalYear[];
}) {
  const { t } = useLocale();
  const multi = operator === "in" || operator === "not_in";
  if (operator === "between") {
    const [from, to] = splitRange(value);
    return (
      <div className="flex min-w-0 gap-1">
        <DateField value={from} onChange={(v) => onChange(joinRange(v, to))} placeholder={t("rangeFrom")} aria-label={t("rangeFrom")} className="min-w-0 flex-1 [&>button]:h-8" />
        <DateField value={to} onChange={(v) => onChange(joinRange(from, v))} placeholder={t("rangeTo")} aria-label={t("rangeTo")} className="min-w-0 flex-1 [&>button]:h-8" />
      </div>
    );
  }
  if (operator === "timespan") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-full" aria-label={t("value")}><SelectValue placeholder={t("selectValue")} /></SelectTrigger>
        <SelectContent>
          {TIMESPANS.map((ts) => <SelectItem key={ts} value={ts}>{t(TIMESPAN_LABEL[ts])}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (operator === "fiscal_year") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-full" aria-label={t("value")}><SelectValue placeholder={t("selectValue")} /></SelectTrigger>
        <SelectContent>
          {(fiscalYears ?? []).map((fy) => <SelectItem key={fy.name} value={fy.name}>{fy.name}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "boolean") {
    return (
      <Select value={value || "true"} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-full" aria-label={t("value")}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{t("yes")}</SelectItem>
          <SelectItem value="false">{t("no")}</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "select" && !multi) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-full" aria-label={t("value")}><SelectValue placeholder={t("selectValue")} /></SelectTrigger>
        <SelectContent>
          {(field.options || []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "link" && !multi && loadOptions) return <LinkValue field={field} value={value} onChange={onChange} loadOptions={loadOptions} />;
  if (field.type === "date") return <DateField value={value} onChange={onChange} className="[&>button]:h-8" aria-label={t("value")} />;
  if (field.type === "number") return <Input type="number" dir="ltr" className="h-8" aria-label={t("value")} value={value} onChange={(e) => onChange(e.target.value)} />;
  return <Input className="h-8" aria-label={t("value")} placeholder={multi ? t("commaSeparated") : t("value")} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/** Link autocomplete (Sear LinkValue); options come from the app, requests debounced 300 ms (neither source had one). */
function LinkValue({ field, value, onChange, loadOptions }: { field: FilterField; value: string; onChange: (v: string) => void; loadOptions: LoadOptions }) {
  const { t } = useLocale();
  const [open, setOpen] = React.useState(false);
  const [txt, setTxt] = React.useState("");
  const [opts, setOpts] = React.useState<{ value: string; label: string }[]>([]);
  React.useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setTimeout(() => { loadOptions(field, txt).then((r) => live && setOpts(r)).catch(() => {}); }, txt ? 300 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [open, txt, field, loadOptions]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-label={t("value")} className="h-8 w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{opts.find((o) => o.value === value)?.label ?? (value || t("selectValue"))}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t("listSearch")} value={txt} onValueChange={setTxt} />
          <CommandList>
            <CommandEmpty>{t("noResults")}</CommandEmpty>
            <CommandGroup>
              {opts.map((o) => (
                <CommandItem key={o.value} value={o.value} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("me-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
