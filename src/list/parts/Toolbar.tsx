/**
 * Toolbar controls.
 * - SavedFilters, ColumnManager: Sear's DataGrid popovers (design_system components/data-grid, v0.3.0). ColumnManager
 *   adds PMO's drag-to-reorder, locked columns and a column search (solvfast_pmo ColumnCustomizer); the up/down buttons
 *   stay, so reordering also works from the keyboard (PMO's was drag-only).
 * - QuickFilters: PMO's (any field type, user-chosen fields, solvfast_pmo QuickFilters.tsx) drawn in Sear's inline style.
 * - SortMenu, GroupByMenu: PMO's SortControl (with "Clear sort") and GroupByControl.
 */
import * as React from "react";
import { ArrowDown, ArrowDownUp, ArrowUp, Bookmark, Check, Columns3, GripVertical, Layers, Lock, Plus, Save, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
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

/**
 * Column manager — PMO's (Frappe CRM's): the shown columns in their order — drag a row by its grip to move it (mouse,
 * touch or pen; or focus the grip and press ↑ / ↓), × removes it — and "Add column", a searchable list of every other
 * field. Locked columns (`alwaysVisible`) stay at the top and can't be moved or removed; `hideable: false` columns are
 * not offered. Positions of keys this menu doesn't manage (locked, or not loaded yet) are kept as they are.
 */
export function ColumnManager<T>({ columns, visibleKeys, onChange }: { columns: ColumnDef<T>[]; visibleKeys: string[]; onChange: (keys: string[]) => void }) {
  const { language, t } = useLocale();
  const [adding, setAdding] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [drag, setDrag] = React.useState<{ key: string; insert: number } | null>(null);
  const [announce, setAnnounce] = React.useState("");
  const focusAfter = React.useRef<string | null>(null);
  const grips = React.useRef(new Map<string, HTMLButtonElement>());
  const listRef = React.useRef<HTMLDivElement>(null);

  const label = (c: ColumnDef<T>) => loc(c.label, language);
  const byKey = new Map(columns.map((c) => [c.key, c]));
  const manageable = (c: ColumnDef<T> | undefined): c is ColumnDef<T> => !!c && c.hideable !== false && !c.alwaysVisible;
  const locked = columns.filter((c) => c.alwaysVisible);
  const shown = visibleKeys.map((k) => byKey.get(k)).filter(manageable);
  const hidden = columns.filter((c) => manageable(c) && !visibleKeys.includes(c.key));
  const matches = hidden.filter((c) => label(c).toLowerCase().includes(q.trim().toLowerCase()));

  React.useEffect(() => {
    if (focusAfter.current) { grips.current.get(focusAfter.current)?.focus(); focusAfter.current = null; }
  });

  /** Move a shown column to index `to` among the shown columns. */
  const moveTo = (key: string, to: number) => {
    const order = shown.map((c) => c.key);
    const from = order.indexOf(key);
    const target = Math.max(0, Math.min(order.length - 1, to));
    if (from < 0 || from === target) return;
    order.splice(from, 1);
    order.splice(target, 0, key);
    let i = 0;
    onChange(visibleKeys.map((k) => (manageable(byKey.get(k)) ? order[i++] : k)));
    setAnnounce(t("columnMoved").replace("{column}", label(byKey.get(key)!)).replace("{n}", String(target + 1)).replace("{total}", String(order.length)));
  };
  const remove = (key: string) => onChange(visibleKeys.filter((k) => k !== key));
  const add = (key: string) => { onChange([...visibleKeys, key]); setQ(""); setAdding(false); };

  // Pointer drag (mouse, touch, pen): the insertion point is the gap nearest the pointer.
  const insertAt = (clientY: number) => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-column-row]") ?? [])];
    const i = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return clientY < b.top + b.height / 2; });
    return i < 0 ? rows.length : i;
  };
  const onGripDown = (e: React.PointerEvent<HTMLButtonElement>, key: string) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({ key, insert: insertAt(e.clientY) });
  };
  const onGripMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const insert = insertAt(e.clientY);
    if (insert !== drag.insert) setDrag({ ...drag, insert });
  };
  const onGripUp = () => {
    if (!drag) return;
    const from = shown.findIndex((c) => c.key === drag.key);
    moveTo(drag.key, drag.insert > from ? drag.insert - 1 : drag.insert);
    setDrag(null);
  };
  const onGripKey = (e: React.KeyboardEvent<HTMLButtonElement>, key: string, index: number) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    focusAfter.current = key;
    moveTo(key, index + (e.key === "ArrowUp" ? -1 : 1));
  };

  const dropLine = <div aria-hidden className="mx-1 h-0.5 rounded-full bg-primary" />;

  return (
    <Popover onOpenChange={(o) => { if (!o) { setAdding(false); setQ(""); setDrag(null); } }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Columns3 className="h-4 w-4" /> {t("columns")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5" align="end">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t("editColumns")}</div>
        <span className="sr-only" aria-live="polite">{announce}</span>
        <ScrollArea className="max-h-72">
          <div className="space-y-0.5">
            {locked.map((c) => (
              <div key={c.key} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm opacity-70" aria-label={t("lockedColumn").replace("{column}", label(c))}>
                <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1 truncate">{label(c)}</span>
              </div>
            ))}
            <div ref={listRef} className="space-y-0.5" role="list" aria-label={t("editColumns")}>
              {shown.map((c, i) => (
                <React.Fragment key={c.key}>
                  {drag?.insert === i && drag.key !== c.key && shown[i - 1]?.key !== drag.key && dropLine}
                  <div
                    role="listitem"
                    data-column-row=""
                    className={cn("group flex items-center gap-1.5 rounded-md px-1 py-1 text-sm hover:bg-accent", drag?.key === c.key && "opacity-40")}
                  >
                    <button
                      type="button"
                      ref={(el) => { if (el) grips.current.set(c.key, el); else grips.current.delete(c.key); }}
                      aria-label={t("moveColumn").replace("{column}", label(c))}
                      title={t("moveColumnHint")}
                      onPointerDown={(e) => onGripDown(e, c.key)}
                      onPointerMove={onGripMove}
                      onPointerUp={onGripUp}
                      onPointerCancel={() => setDrag(null)}
                      onKeyDown={(e) => onGripKey(e, c.key, i)}
                      className="flex h-6 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <span className="flex-1 truncate">{label(c)}</span>
                    <button
                      type="button"
                      aria-label={t("removeColumn").replace("{column}", label(c))}
                      onClick={() => remove(c.key)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </React.Fragment>
              ))}
              {drag?.insert === shown.length && shown[shown.length - 1]?.key !== drag.key && dropLine}
            </div>
          </div>
        </ScrollArea>
        <div className="mt-1 border-t border-border pt-1">
          {!adding ? (
            <Button variant="ghost" size="sm" className="w-full justify-start gap-1.5 text-muted-foreground" disabled={hidden.length === 0} onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> {t("addColumn")}
            </Button>
          ) : (
            <div className="space-y-1">
              <div className="relative px-1 pt-1">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 mt-0.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("listSearch")} aria-label={t("addColumn")} className="h-8 ps-7 text-sm" />
              </div>
              <ScrollArea className="max-h-48">
                {matches.length === 0 ? (
                  <p className="px-2 py-2 text-center text-xs text-muted-foreground">{t("noResults")}</p>
                ) : (
                  <div className="space-y-0.5">
                    {matches.map((c) => (
                      <button key={c.key} type="button" onClick={() => add(c.key)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm outline-none hover:bg-accent focus-visible:bg-accent">
                        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{label(c)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
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
