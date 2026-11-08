/**
 * Shared autocomplete engine for LinkInput and TagInput (Frappe-free).
 *  - `useSuggestions`: debounced async search; a response that arrives after a newer request, or after the list was
 *    closed, is dropped (Desk ignores a response once the input lost focus, docs `12` §4.2 step 5).
 *  - `SuggestionList`: a listbox in a popover anchored to the input; focus stays in the input (combobox pattern:
 *    aria-activedescendant, ArrowUp/Down, Enter, Escape). Options keep the pointer from blurring the input.
 */
import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Popover, PopoverAnchor, PopoverContent } from "../primitives/popover";

export interface Suggestion {
  value: string;
  label?: string;
  description?: string;
  /** P35 (G11): a heading the option is listed under. Consecutive options with the same group share one heading
   *  (order the results by group); options without a group are listed without one. */
  group?: string;
  /** P35 (G11): a leading icon or avatar (~16–20 px). */
  icon?: React.ReactNode;
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

function optionText(o: Suggestion) {
  return (
    <>
      <div className="truncate font-medium">{o.label || o.value}</div>
      {o.description && o.description !== o.value && o.description !== o.label && (
        <div className="truncate text-xs text-muted-foreground">{o.description}</div>
      )}
    </>
  );
}

/** Consecutive options with the same `group` (P35 G11). */
function groupRuns(options: Suggestion[]): Array<{ group?: string; start: number; items: Suggestion[] }> {
  const runs: Array<{ group?: string; start: number; items: Suggestion[] }> = [];
  options.forEach((o, i) => {
    const last = runs[runs.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else runs.push({ group: o.group, start: i, items: [o] });
  });
  return runs;
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
  /** P36b: mark the option whose value is the field's current value (a check mark + `aria-selected="true"`). While it
   *  is set, `aria-selected` reports the current value (select pattern) and the highlighted row is announced through the
   *  input's `aria-activedescendant` only. `undefined` (the default) keeps today's rendering: no check, `aria-selected`
   *  on the highlighted row. `null` = indicator on, no option is the current value. */
  selectedValue?: string | null;
  /** P36b: text of the "no results" row (default: the `noResults` chrome string). */
  emptyText?: React.ReactNode;
  /** P36b: keep the highlighted row scrolled into view while the arrows move through a long list. */
  scrollActiveIntoView?: boolean;
  /** P36b: called when Escape dismisses the list. The popover's document-level Escape listener closes the list before
   *  the input's own keydown handler runs (in a browser), so an owner that must undo typing on Escape does it here. */
  onEscape?: () => void;
}

export function SuggestionList({
  open, onDismiss, anchor, listId, options, actions = [], active, setActive, status, onPick, onAction, className,
  selectedValue, emptyText, scrollActiveIntoView, onEscape,
}: SuggestionListProps) {
  const { t } = useLocale();
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const showEmpty = status === "idle" && options.length === 0;
  const indicator = selectedValue !== undefined;
  React.useEffect(() => {
    if (!scrollActiveIntoView || !open || active < 0) return;
    const el = typeof document !== "undefined" ? document.getElementById(`${listId}-${active}`) : null;
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [scrollActiveIntoView, open, active, listId]);
  const renderOption = (o: Suggestion, i: number) => {
    const current = indicator && selectedValue != null && o.value === selectedValue;
    if (!indicator) return (
      <div
        key={`o-${o.value}`}
        id={`${listId}-${i}`}
        role="option"
        aria-selected={active === i}
        className={cn("cursor-pointer rounded-md px-3 py-1.5 text-sm", o.icon != null && "flex items-center gap-2", active === i && "bg-accent text-accent-foreground")}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => setActive(i)}
        onClick={() => onPick(o)}
      >
        {o.icon != null ? <span aria-hidden className="inline-flex shrink-0 items-center justify-center" data-suggestion-icon="">{o.icon}</span> : null}
        {o.icon != null ? <div className="min-w-0 flex-1">{optionText(o)}</div> : optionText(o)}
      </div>
    );
    return (
      <div
        key={`o-${o.value}`}
        id={`${listId}-${i}`}
        role="option"
        aria-selected={current}
        data-active={active === i ? "" : undefined}
        data-current={current ? "" : undefined}
        className={cn("flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm", active === i && "bg-accent text-accent-foreground")}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={() => setActive(i)}
        onClick={() => onPick(o)}
      >
        <Check aria-hidden data-selected-indicator="" className={cn("size-4 shrink-0", current ? "opacity-100" : "opacity-0")} />
        {o.icon != null ? <span aria-hidden className="inline-flex shrink-0 items-center justify-center" data-suggestion-icon="">{o.icon}</span> : null}
        <div className="min-w-0 flex-1">{optionText(o)}</div>
      </div>
    );
  };
  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className={cn("w-full", className)}>{anchor}</div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] min-w-[14rem] max-w-[90vw] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={onEscape ? () => onEscape() : undefined}
        onInteractOutside={(e) => { if (anchorRef.current?.contains(e.target as Node)) e.preventDefault(); }}
      >
        <div id={listId} role="listbox" className="max-h-72 overflow-y-auto" aria-busy={status === "loading" || undefined}>
          {status === "loading" && options.length === 0 && (
            <div role="status" className="px-3 py-2 text-sm text-muted-foreground">{t("formSearching")}</div>
          )}
          {status === "error" && <div role="status" className="px-3 py-2 text-sm text-destructive">{t("formSearchFailed")}</div>}
          {showEmpty && <div role="status" className="px-3 py-2 text-sm text-muted-foreground">{emptyText ?? t("noResults")}</div>}
          {options.some((o) => o.group) ? groupRuns(options).map((run) => (
            run.group ? (
              <div key={`g-${run.start}`} role="group" aria-labelledby={`${listId}-g${run.start}`} data-suggestion-group="">
                <div id={`${listId}-g${run.start}`} role="presentation" className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{run.group}</div>
                {run.items.map((o, k) => renderOption(o, run.start + k))}
              </div>
            ) : run.items.map((o, k) => renderOption(o, run.start + k))
          )) : options.map((o, i) => renderOption(o, i))}
          {actions.map((a, j) => {
            const i = options.length + j;
            return (
              <div
                key={`a-${a.key}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={indicator ? false : active === i}
                data-active={indicator && active === i ? "" : undefined}
                className={cn("flex cursor-pointer items-center gap-2 rounded-md py-1.5 text-sm text-primary", indicator ? "px-2" : "px-3", active === i && "bg-accent")}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => onAction(a)}
              >
                {indicator && <span aria-hidden className="size-4 shrink-0" />}
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
