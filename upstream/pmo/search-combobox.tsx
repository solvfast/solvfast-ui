import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface ComboOption {
  value: string;
  label: string;
  description?: string;
}

/**
 * Async searchable combobox (shadcn Command + Popover). Drives its option list from a `search` fn that is
 * debounced through React Query on the typed query — the built-in cmdk filter is disabled so server-side
 * results show as-is. Used for the GitHub repo + Slack channel pickers in Project Settings.
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
}: {
  value?: string;
  onSelect: (value: string) => void;
  search: (q: string) => Promise<ComboOption[]>;
  queryKey: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: [queryKey, q],
    queryFn: () => search(q),
    enabled: open,
  });

  const options = data ?? [];

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
          <CommandList>
            {!isFetching && <CommandEmpty>{emptyText}</CommandEmpty>}
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
