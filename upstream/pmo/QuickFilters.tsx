import { useState } from "react";
import { SlidersHorizontal, Search } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { LinkField } from "@/components/projects/LinkField";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { FilterField, FilterQuery } from "@/lib/filter-engine";
import {
  QUICK_ANY,
  getQuickPrefs,
  setQuickPrefs,
  getQuickValue,
  setQuickValue,
} from "@/lib/quick-filters";

/**
 * Inline "quick filters" row — a compact, per-page-customizable subset of fields rendered as dropdowns /
 * inputs. Writes into the shared FilterQuery (so it stays in sync with the advanced builder). The gear
 * popover lets the user choose which fields appear here, persisted per `viewKey`.
 */
export function QuickFilters({
  fields,
  query,
  onChange,
  viewKey,
  defaultFields,
}: {
  fields: FilterField[];
  query: FilterQuery;
  onChange: (q: FilterQuery) => void;
  viewKey: string;
  defaultFields: string[];
}) {
  const { t } = useApp();
  const [chosen, setChosen] = useState<string[]>(() => getQuickPrefs(viewKey, defaultFields));
  const [search, setSearch] = useState("");

  const quickFields = fields.filter((f) => chosen.includes(f.name));
  const searchable = fields.filter((f) => f.label.toLowerCase().includes(search.trim().toLowerCase()));

  const toggleField = (name: string) => {
    const next = chosen.includes(name) ? chosen.filter((n) => n !== name) : [...chosen, name];
    setChosen(next);
    setQuickPrefs(viewKey, next);
  };

  const renderControl = (field: FilterField) => {
    const value = getQuickValue(query, field.name);
    const set = (v: string) => onChange(setQuickValue(query, field, v));

    if (field.type === "select" && field.options) {
      return (
        <Select value={value || QUICK_ANY} onValueChange={set}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={QUICK_ANY}>{t("any")}</SelectItem>
            {field.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (field.type === "boolean") {
      return (
        <Select value={value || QUICK_ANY} onValueChange={set}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={QUICK_ANY}>{t("any")}</SelectItem>
            <SelectItem value="true">{t("yes")}</SelectItem>
            <SelectItem value="false">{t("no")}</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    if (field.type === "date") {
      return <DatePicker value={value} onChange={set} placeholder={field.label} className="h-9 w-44" />;
    }
    if (field.type === "link" && field.link_doctype) {
      return (
        <div className="w-48">
          <LinkField
            doctype={field.link_doctype}
            value={value}
            onSelect={set}
            placeholder={field.label}
          />
        </div>
      );
    }
    return (
      <Input
        type={field.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => set(e.target.value)}
        placeholder={field.label}
        className="h-9 w-40"
      />
    );
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      {quickFields.map((field) => (
        <div key={field.name} className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">{field.label}</Label>
          {renderControl(field)}
        </div>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={t("customize_filters")} title={t("customize_filters")}>
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-60 p-2" onCloseAutoFocus={() => setSearch("")}>
          <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">{t("quick_filters")}</p>
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search_ellipsis")} className="h-8 ps-7 text-sm" />
          </div>
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {searchable.length === 0 ? (
              <p className="px-2 py-2 text-center text-xs text-muted-foreground">{t("no_results")}</p>
            ) : (
              searchable.map((f) => (
                <label key={f.name} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent">
                  <Checkbox checked={chosen.includes(f.name)} onCheckedChange={() => toggleField(f.name)} />
                  <span className="truncate">{f.label}</span>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
