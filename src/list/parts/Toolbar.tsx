/**
 * Toolbar controls.
 * - SavedFilters, ColumnManager: Sear's DataGrid popovers (design_system components/data-grid, v0.3.0). ColumnManager
 *   adds PMO's drag-to-reorder, locked columns and a column search (solvfast_pmo ColumnCustomizer); the up/down buttons
 *   stay, so reordering also works from the keyboard (PMO's was drag-only).
 * - QuickFilters: PMO's (any field type, user-chosen fields, solvfast_pmo QuickFilters.tsx) drawn in Sear's inline style.
 * - SortMenu, GroupByMenu: PMO's SortControl (with "Clear sort") and GroupByControl.
 */
import * as React from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, Bookmark, Check, ChevronDown, ChevronUp, Columns3, Layers, Save, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "../../primitives/button";
import { Checkbox } from "../../primitives/checkbox";
import { DateField } from "../../primitives/date-time-field";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";
import { Input } from "../../primitives/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import { ScrollArea } from "../../primitives/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { cn } from "../../lib/cn";
import { loc } from "../../lib/localized";
import { useLocale } from "../../theme/ThemeProvider";
import type { ColumnDef } from "../model/columns";
import { getQuickValue, setQuickValue, type FilterField, type FilterQuery } from "../model/filters";
import type { GroupByOption } from "../model/group";
import type { SortState } from "../model/sort";
import type { SavedFilter } from "../model/storage";

export function SavedFilters({ saved, activeCount, onApply, onSave, onDelete }: {
  saved: SavedFilter[]; activeCount: number; onApply: (f: SavedFilter) => void; onSave: (label: string) => void; onDelete: (id: string) => void;
}) {
  const { t } = useLocale();
  const [label, setLabel] = React.useState("");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Bookmark className="h-4 w-4" /> {t("saved")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        {saved.length > 0 ? (
          <div className="mb-2 space-y-0.5">
            {saved.map((s) => (
              <div key={s.id} className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent">
                <button className="flex-1 truncate text-start text-sm" onClick={() => onApply(s)}>{s.label}</button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(s.id)} aria-label={t("remove")}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-2 px-2 py-1 text-xs text-muted-foreground">{t("noSavedFilters")}</p>
        )}
        <div className="flex items-center gap-1.5 border-t border-border pt-2">
          <Input className="h-8" placeholder={t("saveCurrentAs")} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button size="icon" className="h-8 w-8 shrink-0" disabled={!label.trim() || activeCount === 0} onClick={() => { onSave(label.trim()); setLabel(""); }} aria-label={t("saveCurrentAs")}>
            <Save className="h-4 w-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ColumnManager<T>({ columns, visibleKeys, onChange }: { columns: ColumnDef<T>[]; visibleKeys: string[]; onChange: (keys: string[]) => void }) {
  const { language, t } = useLocale();
  const [q, setQ] = React.useState("");
  const [drag, setDrag] = React.useState<string | null>(null);
  const manageable = columns.filter((c) => c.hideable !== false && !c.alwaysVisible);
  const locked = columns.filter((c) => c.alwaysVisible);
  const visibleSet = new Set(visibleKeys);
  const label = (c: ColumnDef<T>) => loc(c.label, language);
  const ordered = [
    ...visibleKeys.map((k) => manageable.find((c) => c.key === k)).filter(Boolean) as ColumnDef<T>[],
    ...manageable.filter((c) => !visibleSet.has(c.key)),
  ].filter((c) => !q.trim() || label(c).toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (key: string) => onChange(visibleSet.has(key) ? visibleKeys.filter((k) => k !== key) : [...visibleKeys, key]);
  const move = (key: string, dir: -1 | 1) => {
    const i = visibleKeys.indexOf(key), j = i + dir;
    if (i < 0 || j < 0 || j >= visibleKeys.length) return;
    const next = [...visibleKeys]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };
  const dropOn = (target: string) => {
    if (!drag || drag === target || !visibleSet.has(target)) return;
    const next = visibleKeys.filter((k) => k !== drag);
    next.splice(next.indexOf(target), 0, drag);
    onChange(next);
  };
  return (
    <Popover onOpenChange={(o) => { if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Columns3 className="h-4 w-4" /> {t("columns")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5" align="end">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t("toggleColumns")}</div>
        {manageable.length > 10 && (
          <div className="relative mb-1 px-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("listSearch")} className="h-8 ps-7 text-sm" />
          </div>
        )}
        <ScrollArea className="max-h-72">
          <div className="space-y-0.5">
            {locked.map((c) => (
              <div key={c.key} className="flex items-center gap-2 rounded-md px-2 py-1 opacity-70">
                <Checkbox checked disabled id={`col-${c.key}`} />
                <label htmlFor={`col-${c.key}`} className="flex-1 truncate text-sm">{label(c)}</label>
              </div>
            ))}
            {ordered.map((c) => {
              const on = visibleSet.has(c.key);
              const vi = visibleKeys.indexOf(c.key);
              return (
                <div
                  key={c.key}
                  draggable={on}
                  onDragStart={() => setDrag(c.key)}
                  onDragOver={(e) => { if (drag && on) e.preventDefault(); }}
                  onDrop={() => dropOn(c.key)}
                  onDragEnd={() => setDrag(null)}
                  className={cn("flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent", on && "cursor-grab active:cursor-grabbing", drag === c.key && "opacity-40")}
                >
                  <Checkbox checked={on} onCheckedChange={() => toggle(c.key)} id={`col-${c.key}`} />
                  <label htmlFor={`col-${c.key}`} className="flex-1 cursor-pointer truncate text-sm">{label(c)}</label>
                  {on && (
                    <div className="flex">
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={vi <= 0} onClick={() => move(c.key, -1)} aria-label={t("moveUp")}><ChevronUp className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" disabled={vi >= visibleKeys.length - 1} onClick={() => move(c.key, 1)} aria-label={t("moveDown")}><ChevronDown className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/** Inline quick filters. `customizable` adds PMO's picker for which fields appear. */
export function QuickFilters({ fields, shown, onShownChange, customizable, query, onChange }: {
  fields: FilterField[]; shown: string[]; onShownChange: (names: string[]) => void; customizable?: boolean; query: FilterQuery; onChange: (q: FilterQuery) => void;
}) {
  const { t } = useLocale();
  const [pickQ, setPickQ] = React.useState("");
  const quick = shown.map((n) => fields.find((f) => f.name === n)).filter(Boolean) as FilterField[];
  if (!quick.length && !customizable) return null;
  const set = (f: FilterField, v: string) => onChange(setQuickValue(query, f, v));
  const control = (f: FilterField) => {
    const v = getQuickValue(query, f.name);
    if (f.type === "select" || f.type === "boolean") {
      const options = f.type === "boolean" ? [{ value: "true", label: t("yes") }, { value: "false", label: t("no") }] : f.options ?? [];
      return (
        <Select key={f.name} value={v || "__all__"} onValueChange={(x) => set(f, x === "__all__" ? "" : x)}>
          <SelectTrigger className="h-8 w-auto min-w-[8rem] gap-1 text-xs" aria-label={f.label}><SelectValue placeholder={f.label} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("all")} · {f.label}</SelectItem>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }
    if (f.type === "date") return <DateField key={f.name} value={v} onChange={(x) => set(f, x)} placeholder={f.label} aria-label={f.label} className="w-40 [&>button]:h-8 [&>button]:text-xs" />;
    return <Input key={f.name} type={f.type === "number" ? "number" : "text"} value={v} onChange={(e) => set(f, e.target.value)} placeholder={f.label} aria-label={f.label} className="h-8 w-36 text-xs" />;
  };
  const matches = fields.filter((f) => f.label.toLowerCase().includes(pickQ.trim().toLowerCase()));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {quick.map(control)}
      {customizable && (
        <Popover onOpenChange={(o) => { if (!o) setPickQ(""); }}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="!rounded-lg text-muted-foreground hover:bg-muted" aria-label={t("customizeFilters")} title={t("customizeFilters")}>
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 p-2">
            <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">{t("quickFilters")}</p>
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={pickQ} onChange={(e) => setPickQ(e.target.value)} placeholder={t("listSearch")} className="h-8 ps-7 text-sm" />
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {matches.length === 0 ? <p className="px-2 py-2 text-center text-xs text-muted-foreground">{t("noResults")}</p> : matches.map((f) => (
                <label key={f.name} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-accent">
                  <Checkbox checked={shown.includes(f.name)} onCheckedChange={() => onShownChange(shown.includes(f.name) ? shown.filter((n) => n !== f.name) : [...shown, f.name])} />
                  <span className="truncate">{f.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function SortMenu<T>({ columns, sort, onChange }: { columns: ColumnDef<T>[]; sort: SortState; onChange: (s: SortState) => void }) {
  const { language, t } = useLocale();
  const sortable = columns.filter((c) => c.sortable !== false);
  const active = columns.find((c) => c.key === sort.key);
  const Dir = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowDownUp className="h-4 w-4" />
          {active ? <span className="max-w-[10rem] truncate">{loc(active.label, language)}</span> : t("sortBy")}
          {active && <Dir className="h-3.5 w-3.5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("sortBy")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sortable.map((c) => (
          <DropdownMenuItem key={c.key} className="justify-between" onSelect={(e) => { e.preventDefault(); onChange(sort.key === c.key ? { key: c.key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" }); }}>
            <span className="truncate">{loc(c.label, language)}</span>
            {sort.key === c.key && <Dir className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
        {sort.key && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onChange({ key: null, dir: "desc" }); }}>{t("clearSort")}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GroupByMenu<T>({ options, value, onChange }: { options: GroupByOption<T>[]; value: string; onChange: (key: string) => void }) {
  const { t } = useLocale();
  const active = options.find((o) => o.key === value);
  const all = [{ key: "none", label: t("groupNone") }, ...options];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Layers className="h-4 w-4" />
          {active ? <span className="max-w-[10rem] truncate">{active.label}</span> : t("groupBy")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("groupBy")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {all.map((o) => (
          <DropdownMenuItem key={o.key} className="justify-between" onSelect={(e) => { e.preventDefault(); onChange(o.key); }}>
            <span className="truncate">{o.label}</span>
            <Check className={cn("h-4 w-4", value === o.key ? "opacity-100" : "opacity-0")} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
