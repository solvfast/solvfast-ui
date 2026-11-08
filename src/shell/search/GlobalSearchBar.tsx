/**
 * GlobalSearchBar — Desk's navbar "awesome bar" (frappe/public/js/frappe/ui/toolbar/awesome_bar.js, v15.110) as a Core
 * component for the header (P36b). Generic: rows come from a `GlobalSearchSource`; navigation is the app's `onSelect`.
 *
 * Reproduced: placeholder "Search or type a command (Ctrl + G)" / "⌘ + G" (navbar.html:29); Ctrl/⌘+G focuses it, except
 * while another input has focus (keyboard.js:198-206, 43-47); input handled after a 100 ms debounce, text trimmed and
 * inner spaces collapsed (AB:65-92); from 2 characters the source's rows + "Search for {text}" (index 100, ↵, AB:295-313;
 * not for "#…" text) sorted by `index` descending, at most 99 (Awesomplete `sort` / `maxItems`, AB:17-58); below 2
 * characters the source's recent rows (AB:82-87); focusing opens the list (AB:94-99); the first row is selected
 * (`autoFirst`); ↑/↓ move and wrap, Enter chooses (AWL:78-90); Esc closes and blurs (AB:139-143); choosing clears and
 * blurs the input (AB:131-136); Ctrl/⌘-click = a new tab (AB:118-123); "Search for …" opens the Global Search dialog
 * (AB:311 → `GlobalSearchDialog`).
 *
 * Mobile (< md): an icon button opening the dialog (whose idle state lists the recent rows). Desk keeps the 300 px bar in
 * its expanded navbar on phones (navbar.html:2); the package header has no room for it — a documented difference.
 */
import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import { Input } from "../../primitives/input";
import { Button } from "../../primitives/button";
import { Popover, PopoverAnchor, PopoverContent } from "../../primitives/popover";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { ItemDescription, Marked, isEditableTarget, isMac, wantsNewTab } from "./parts";
import type { GlobalSearchSource, SearchItem, SelectOptions } from "./types";

export interface GlobalSearchBarProps {
  source: GlobalSearchSource;
  /** A row (not "Search for …") was chosen. Navigate here (`href` / `data`). */
  onSelect: (item: SearchItem, opts: SelectOptions) => void;
  /** Default: "Search or type a command (Ctrl + G)" (⌘ + G on a Mac). */
  placeholder?: string;
  /** Default 100 (AB:91). */
  debounceMs?: number;
  /** Default 2 (`txt.length > 1`, AB:75). */
  minChars?: number;
  /** Default 99 (AB:18). */
  maxItems?: number;
  /** Ctrl/⌘+G focuses the bar. Default true. */
  shortcut?: boolean;
  /** Passed to the dialog. */
  dialogDebounceMs?: number;
  className?: string;
  /** Width class of the desktop input. Default "w-48 lg:w-64". */
  inputClassName?: string;
}

/** The id of the "Search for …" row. */
export const SEARCH_FOR_ID = "__search_for__";

const byIndexDesc = (a: SearchItem, b: SearchItem) => (b.index ?? 0) - (a.index ?? 0);

export function GlobalSearchBar({
  source, onSelect, placeholder, debounceMs = 100, minChars = 2, maxItems = 99, shortcut = true, dialogDebounceMs, className, inputClassName,
}: GlobalSearchBarProps) {
  const { t } = useLocale();
  const [value, setValue] = React.useState("");
  const [items, setItems] = React.useState<SearchItem[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const [dialog, setDialog] = React.useState<{ open: boolean; query: string }>({ open: false, query: "" });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = React.useRef(0);
  const focused = React.useRef(false);
  const listId = React.useId();
  const ph = placeholder ?? t("globalSearchPlaceholder").replace("{0}", isMac() ? "⌘ + G" : "Ctrl + G");

  const compute = React.useCallback(async (raw: string) => {
    const txt = raw.trim().replace(/\s\s+/g, " "); // AB:69
    const mine = ++seq.current;
    let rows: SearchItem[];
    setFailed(false);
    if (txt.length >= minChars) {
      const searchFor: SearchItem[] = source.search && txt.charAt(0) !== "#"
        ? [{ id: SEARCH_FOR_ID, label: t("globalSearchFor").replace("{0}", txt), labelMarks: [], index: 100, data: txt }]
        : [];
      const got = source.suggest(txt);
      if (got instanceof Promise) {
        setLoading(true);
        setOpen(focused.current);
        try { rows = await got; } catch (err) {
          if (mine !== seq.current) return;
          if (typeof console !== "undefined") console.error(err);
          setLoading(false); setFailed(true); setItems(searchFor); setCursor(0); setOpen(focused.current);
          return;
        }
        if (mine !== seq.current) return;
        setLoading(false);
      } else rows = got;
      rows = [...searchFor, ...rows].sort(byIndexDesc).slice(0, maxItems);
    } else {
      rows = (source.recent?.(txt) ?? []).slice(0, maxItems);
    }
    if (mine !== seq.current) return;
    setLoading(false);
    setItems(rows);
    setCursor(0); // autoFirst (AB:19)
    setOpen(focused.current && rows.length > 0); // Awesomplete closes on an empty list (AWL:303)
  }, [source, minChars, maxItems, t]);

  const schedule = (raw: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void compute(raw), debounceMs);
  };
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Ctrl/⌘+G (keyboard.js:198-206); not while an input has focus (keyboard.js:43-47).
  React.useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "g") return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      const el = inputRef.current;
      el?.focus();
      if (!el || document.activeElement !== el) setDialog({ open: true, query: "" }); // the bar is hidden (mobile)
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shortcut]);

  const finish = () => {
    // AB:131-136 — clear and blur.
    setValue("");
    setOpen(false);
    seq.current++;
    inputRef.current?.blur();
  };

  const choose = (item: SearchItem, opts: SelectOptions) => {
    if (item.id === SEARCH_FOR_ID) {
      const q = String(item.data ?? value.trim());
      finish();
      setDialog({ open: true, query: q });
      return;
    }
    finish();
    onSelect(item, opts);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); inputRef.current?.blur(); return; } // AB:139-143
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => (c < items.length - 1 ? c + 1 : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => (c > 0 ? c - 1 : items.length - 1)); }
    else if (e.key === "Enter" && items[cursor]) { e.preventDefault(); choose(items[cursor], { newTab: wantsNewTab(e) }); }
  };

  React.useEffect(() => {
    if (open) document.getElementById(`${listId}-opt-${cursor}`)?.scrollIntoView?.({ block: "nearest" });
  }, [cursor, open, listId]);

  return (
    <div className={cn("flex items-center", className)} data-testid="global-search-bar">
      <Popover open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="relative hidden md:block">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={open && items[cursor] ? `${listId}-opt-${cursor}` : undefined}
              aria-label={ph}
              placeholder={ph}
              value={value}
              autoComplete="off"
              onChange={(e) => { setValue(e.target.value); schedule(e.target.value); }}
              onFocus={() => { focused.current = true; if (!open) schedule(value); }}
              onBlur={() => { focused.current = false; setOpen(false); }}
              onKeyDown={onKeyDown}
              className={cn("h-8 ps-8 text-sm bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-ring", inputClassName ?? "w-48 lg:w-64")}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          className="w-[min(26rem,calc(100vw-2rem))] min-w-[250px] p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => { if (anchorRef.current?.contains(e.target as Node)) e.preventDefault(); }}
          // keep the input focused while the list is clicked (Awesomplete selects on mousedown)
          onMouseDown={(e) => e.preventDefault()}
        >
          <ul id={listId} role="listbox" aria-label={t("globalSearchResults")} className="max-h-[min(60vh,300px)] overflow-y-auto">
            {loading && <li className="px-2 py-2 text-sm text-muted-foreground" aria-live="polite">{t("globalSearchLoading")}</li>}
            {failed && <li className="px-2 py-2 text-sm text-destructive" role="alert">{t("globalSearchError")}</li>}
            {items.map((item, i) => {
              const selected = i === cursor;
              return (
                <li key={item.id} id={`${listId}-opt-${i}`} role="option" aria-selected={selected} onMouseEnter={() => setCursor(i)}>
                  <a
                    href={item.href ?? "#"}
                    tabIndex={-1}
                    onClick={(e) => { e.preventDefault(); choose(item, { newTab: wantsNewTab(e) }); }}
                    className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground", selected && "bg-accent text-accent-foreground")}
                  >
                    <span className="min-w-0 flex-1">
                      <Marked text={item.label} marks={item.labelMarks} className="block truncate" />
                      <ItemDescription item={item} />
                    </span>
                    {item.id === SEARCH_FOR_ID && <kbd className="rounded border bg-muted px-1.5 text-xs text-muted-foreground">↵</kbd>}
                  </a>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
      {source.search && <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="!rounded-lg text-muted-foreground hover:bg-muted md:hidden"
        aria-label={t("globalSearchOpen")}
        onClick={() => setDialog({ open: true, query: "" })}
        data-testid="global-search-mobile"
      >
        <Search className="h-4 w-4" />
      </Button>}
      {source.search && (
        <GlobalSearchDialog
          open={dialog.open}
          onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
          source={source}
          initialQuery={dialog.query}
          debounceMs={dialogDebounceMs}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
