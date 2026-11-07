// From Solvfast PMO frontend/src/components/ui/search-combobox.tsx (pristine copy + sha256 in upstream/pmo/) — see VENDORED.md.
// Same props and markup (package Button, Popover and Command). React Query is gone (the core never imports @tanstack):
// results load into local state — at once when the popover opens, then 200 ms after the typing stops — and a response
// that arrives after a newer request was made is dropped. "Empty" shows only when a search has finished with nothing.
// P35 (G16), additive: a static `options` list (filtered as you type), `multiple` selection (`values` /
// `onValuesChange`, the list stays open), and a `variant="field"` trigger with the field look. Without them the
// component is the 0.6.0 one.
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./command";

export interface ComboOption {
  value: string;
  label: string;
  description?: string;
}

export interface SearchComboboxProps {
  /** The selected option's value (shown on the trigger; with static `options`, its label). */
  value?: string;
  /** Single mode: the picked value (the popover closes). Required unless `multiple`. */
  onSelect?: (value: string) => void;
  /** Loads the options for the typed text (server-side search; the list shows them as returned, unfiltered).
   *  Give this or `options`. */
  search?: (q: string) => Promise<ComboOption[]>;
  /** P35 (G16): a fixed option list, filtered client-side on label / description / value as you type (no loading). */
  options?: ComboOption[];
  /** P35 (G16): pick several; the list stays open and each pick toggles. Use `values` / `onValuesChange`. */
  multiple?: boolean;
  /** Multiple mode: the selected values. */
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  /** P35: "button" (default, the outline button) or "field" (the input look of the field controls, h-9). */
  variant?: "button" | "field";
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Optional reset key (it was PMO's React Query key): when it changes, the loaded options are dropped and loaded
   *  again. There is no cache shared between comboboxes. */
  queryKey?: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  id?: string;
}

const DEBOUNCE_MS = 200;

/**
 * Async searchable combobox (Command + Popover). Drives its option list from a `search` function on the typed text;
 * the built-in cmdk filter is disabled so server-side results show as-is. In PMO: the GitHub repo, Slack channel and
 * Frappe Link-field pickers.
 */
export function SearchCombobox({
  value,
  onSelect,
  search,
  queryKey,
  placeholder,
  searchPlaceholder,
  emptyText,
  id,
  options: staticOptions,
  multiple,
  values,
  onValuesChange,
  variant = "button",
  disabled,
  invalid,
  className,
  ...aria
}: SearchComboboxProps) {
  const { t } = useLocale();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [options, setOptions] = React.useState<ComboOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  // `search` is usually an inline function (a new identity every render): read the latest one through a ref, so a
  // re-render never triggers a request on its own.
  const searchRef = React.useRef(search);
  searchRef.current = search;
  const requestId = React.useRef(0);
  const wasOpen = React.useRef(false);

  // A new reset key: what was loaded belongs to the old one.
  const lastKey = React.useRef(queryKey);
  if (lastKey.current !== queryKey) {
    lastKey.current = queryKey;
    if (options.length) setOptions([]);
  }

  React.useEffect(() => {
    if (!open) {
      requestId.current++; // anything still in flight is stale now
      wasOpen.current = false;
      setLoading(false);
      return;
    }
    if (!searchRef.current) { wasOpen.current = true; return; } // static options: nothing to load
    const delay = wasOpen.current ? DEBOUNCE_MS : 0; // load at once on open; debounce typing
    wasOpen.current = true;
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(() => {
      let pending: Promise<ComboOption[]>;
      try { pending = Promise.resolve(searchRef.current!(q)); } catch (e) { pending = Promise.reject(e); }
      pending.then(
        (result) => { if (requestId.current === id) { setOptions(Array.isArray(result) ? result : []); setLoading(false); } },
        () => { if (requestId.current === id) { setOptions([]); setLoading(false); } },
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [open, q, queryKey]);

  const isStatic = !search && !!staticOptions;
  const shown = React.useMemo(() => {
    if (!isStatic) return options;
    const needle = q.trim().toLowerCase();
    if (!needle) return staticOptions!;
    return staticOptions!.filter((o) => [o.label, o.description, o.value].some((x) => x?.toLowerCase().includes(needle)));
  }, [isStatic, options, staticOptions, q]);
  const busy = isStatic ? false : loading;
  const selected = multiple ? values ?? [] : value ? [value] : [];
  const labelOf = (v: string) => (staticOptions ?? []).find((o) => o.value === v)?.label ?? options.find((o) => o.value === v)?.label ?? v;
  // 0.6.0 showed the raw value on the trigger; keep that for the async single mode, show labels in the new modes
  const triggerText = multiple
    ? (selected.length === 0 ? "" : selected.length <= 2 ? selected.map(labelOf).join(", ") : t("coreComboSelected").replace("{n}", String(selected.length)))
    : isStatic && value ? labelOf(value) : value;
  const pick = (v: string) => {
    if (multiple) {
      onValuesChange?.(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
      return;
    }
    onSelect?.(v);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant={variant === "field" ? "ghost" : "outline"}
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-label={aria["aria-label"]}
          aria-labelledby={aria["aria-labelledby"]}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            variant === "field" && "sf-field-fill h-9 rounded-md px-3 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring/60",
            invalid && "ring-1 ring-destructive",
            className,
          )}
        >
          <span className={cn("truncate", !triggerText && "text-muted-foreground")}>{triggerText || placeholder}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={q} onValueChange={setQ} />
          <CommandList aria-busy={busy || undefined} aria-multiselectable={multiple || undefined}>
            {!busy && <CommandEmpty>{emptyText}</CommandEmpty>}
            {busy && shown.length === 0 && (
              <div role="status" className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</div>
            )}
            <CommandGroup>
              {shown.map((opt) => {
                const on = selected.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    aria-checked={multiple ? on : undefined}
                    data-checked={on || undefined}
                    onSelect={() => pick(opt.value)}
                  >
                    <Check className={cn("me-2 h-4 w-4", on ? "opacity-100" : "opacity-0")} />
                    <div className="min-w-0">
                      <div className="truncate">{opt.label}</div>
                      {opt.description && (
                        <div className="truncate text-xs text-muted-foreground">{opt.description}</div>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
