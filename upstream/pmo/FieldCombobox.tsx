import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export interface FieldOption {
  value: string;
  label: string;
}

/** Searchable single-select over a static option list (type to find a field). Used by the filter builders. */
export function FieldCombobox({
  options,
  value,
  onChange,
  placeholder,
  className,
}: {
  options: FieldOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className={cn("h-9 justify-between font-normal", className)}>
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder ?? t("select_ellipsis")}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandInput placeholder={t("search_ellipsis")} className="h-9" />
          <CommandList>
            <CommandEmpty>{t("no_results")}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("me-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
