// From Solvfast PMO frontend/src/components/ui/search-combobox.tsx (pristine copy + sha256 in upstream/pmo/) — see VENDORED.md.
// Same props and markup (package Button, Popover and Command). React Query is gone (the core never imports @tanstack):
// results load into local state — at once when the popover opens, then 200 ms after the typing stops — and a response
// that arrives after a newer request was made is dropped. "Empty" shows only when a search has finished with nothing.
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
  /** The selected option's value (shown on the trigger). */
  value?: string;
  onSelect: (value: string) => void;
  /** Loads the options for the typed text (server-side search; the list shows them as returned, unfiltered). */
  search: (q: string) => Promise<ComboOption[]>;
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
    const delay = wasOpen.current ? DEBOUNCE_MS : 0; // load at once on open; debounce typing
    wasOpen.current = true;
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(() => {
      let pending: Promise<ComboOption[]>;
      try { pending = Promise.resolve(searchRef.current(q)); } catch (e) { pending = Promise.reject(e); }
      pending.then(
        (result) => { if (requestId.current === id) { setOptions(Array.isArray(result) ? result : []); setLoading(false); } },
        () => { if (requestId.current === id) { setOptions([]); setLoading(false); } },
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [open, q, queryKey]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={q} onValueChange={setQ} />
          <CommandList aria-busy={loading || undefined}>
            {!loading && <CommandEmpty>{emptyText}</CommandEmpty>}
            {loading && options.length === 0 && (
              <div role="status" className="py-6 text-center text-sm text-muted-foreground">{t("loading")}</div>
            )}
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => {
                    onSelect(opt.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("me-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <div className="truncate">{opt.label}</div>
                    {opt.description && (
                      <div className="truncate text-xs text-muted-foreground">{opt.description}</div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
