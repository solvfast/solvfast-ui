/**
 * Shared autocomplete engine for LinkInput and TagInput (Frappe-free).
 *  - `useSuggestions`: debounced async search; a response that arrives after a newer request, or after the list was
 *    closed, is dropped (Desk ignores a response once the input lost focus, docs `12` §4.2 step 5).
 *  - `SuggestionList`: a listbox in a popover anchored to the input; focus stays in the input (combobox pattern:
 *    aria-activedescendant, ArrowUp/Down, Enter, Escape). Options keep the pointer from blurring the input.
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Popover, PopoverAnchor, PopoverContent } from "../primitives/popover";

export interface Suggestion {
  value: string;
  label?: string;
  description?: string;
}

/** An extra row under the results (e.g. "Create a new X"). */
export interface SuggestionAction {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onSelect: (typed: string) => void;
}

export type SearchFn = (text: string) => Promise<Suggestion[]>;

export function useSuggestions(search: SearchFn, debounceMs: number) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<Suggestion[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");
  const searchRef = React.useRef(search);
  searchRef.current = search;
  const reqId = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const run = React.useCallback((text: string) => {
    const id = ++reqId.current;
    setStatus("loading");
    let p: Promise<Suggestion[]>;
    try { p = Promise.resolve(searchRef.current(text)); } catch (e) { p = Promise.reject(e); }
    p.then(
      (r) => { if (reqId.current === id) { setOptions(Array.isArray(r) ? r : []); setStatus("idle"); } },
      () => { if (reqId.current === id) { setOptions([]); setStatus("error"); } },
    );
  }, []);
  /** Search for `text` after the debounce (or at once). Opens the list. */
  const query = React.useCallback((text: string, immediate = false) => {
    setOpen(true);
    clearTimer();
    if (immediate || debounceMs <= 0) run(text);
    else { setStatus("loading"); timer.current = setTimeout(() => { timer.current = null; run(text); }, debounceMs); }
  }, [debounceMs, run]);
  const close = React.useCallback(() => {
    clearTimer();
    reqId.current++;
    setOpen(false);
    setStatus("idle");
  }, []);
  React.useEffect(() => () => clearTimer(), []);
  return { open, options, status, query, close };
}

/** Desk merges results with the same value, joining their descriptions with ", " (link.js `merge_duplicates`). */
export function mergeDuplicates(items: Suggestion[]): Suggestion[] {
  const out: Suggestion[] = [];
  const byValue = new Map<string, Suggestion>();
  for (const it of items) {
    const prev = byValue.get(it.value);
    if (!prev) { const copy = { ...it }; byValue.set(it.value, copy); out.push(copy); continue; }
    if (it.description && it.description !== prev.description) prev.description = prev.description ? `${prev.description}, ${it.description}` : it.description;
  }
  return out;
}

interface SuggestionListProps {
  open: boolean;
  onDismiss: () => void;
  anchor: React.ReactNode;
  listId: string;
  options: Suggestion[];
  actions?: SuggestionAction[];
  active: number;
  setActive: (i: number) => void;
  status: "idle" | "loading" | "error";
  onPick: (s: Suggestion) => void;
  onAction: (a: SuggestionAction) => void;
  /** Shown for an option: label, then description when it differs from the value. */
  className?: string;
}

export function SuggestionList({ open, onDismiss, anchor, listId, options, actions = [], active, setActive, status, onPick, onAction, className }: SuggestionListProps) {
  const { t } = useLocale();
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const showEmpty = status === "idle" && options.length === 0;
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className={cn("w-full", className)}>{anchor}</div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] min-w-[14rem] max-w-[min(32rem,90vw)] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => { if (anchorRef.current?.contains(e.target as Node)) e.preventDefault(); }}
      >
        <div id={listId} role="listbox" className="max-h-72 overflow-y-auto" aria-busy={status === "loading" || undefined}>
          {status === "loading" && options.length === 0 && (
            <div role="status" className="px-3 py-2 text-sm text-muted-foreground">{t("formSearching")}</div>
          )}
          {status === "error" && <div role="status" className="px-3 py-2 text-sm text-destructive">{t("formSearchFailed")}</div>}
          {showEmpty && <div role="status" className="px-3 py-2 text-sm text-muted-foreground">{t("noResults")}</div>}
          {options.map((o, i) => (
            <div
              key={`o-${o.value}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={active === i}
              className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm", active === i && "bg-accent text-accent-foreground")}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(o)}
            >
              <div className="truncate font-medium">{o.label || o.value}</div>
              {o.description && o.description !== o.value && o.description !== o.label && (
                <div className="truncate text-xs text-muted-foreground">{o.description}</div>
              )}
            </div>
          ))}
          {actions.map((a, j) => {
            const i = options.length + j;
            return (
              <div
                key={`a-${a.key}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={active === i}
                className={cn("flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm text-primary", active === i && "bg-accent")}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => onAction(a)}
              >
                {a.icon}
                <span className="truncate">{a.label}</span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Arrow / Enter / Escape handling over options + actions. Returns true when the key was handled. */
export function handleListKey(
  e: React.KeyboardEvent,
  s: { open: boolean; count: number; active: number; setActive: (i: number) => void; onEnter: (i: number) => void; onOpen: () => void; onClose: () => void },
): boolean {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (!s.open) s.onOpen(); else s.setActive(s.count ? (s.active + 1) % s.count : -1);
    return true;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (s.open && s.count) s.setActive(s.active <= 0 ? s.count - 1 : s.active - 1);
    return true;
  }
  if (e.key === "Enter" && s.open && s.active >= 0 && s.active < s.count) {
    e.preventDefault();
    s.onEnter(s.active);
    return true;
  }
  if (e.key === "Escape" && s.open) {
    e.preventDefault();
    s.onClose();
    return true;
  }
  return false;
}
