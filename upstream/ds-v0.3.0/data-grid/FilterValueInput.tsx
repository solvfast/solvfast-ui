import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { searchLink } from "@/services/frappe-data";
import type { FilterField, Operator } from "@/lib/data-grid/filter-engine";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Renders the right value input for a filter condition based on the field's type + operator. */
export function FilterValueInput({
  field,
  operator,
  value,
  onChange,
}: {
  field: FilterField;
  operator: Operator;
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useApp();
  const multi = operator === "in" || operator === "not_in";

  if (field.type === "boolean") {
    return (
      <Select value={value || "true"} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="true">{t("yes")}</SelectItem>
          <SelectItem value="false">{t("no")}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "select" && !multi) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-full"><SelectValue placeholder={t("select_value")} /></SelectTrigger>
        <SelectContent>
          {(field.options || []).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "link" && !multi && field.link_doctype) {
    return <LinkValue doctype={field.link_doctype} value={value} onChange={onChange} />;
  }

  if (field.type === "date") {
    return <Input type="date" dir="ltr" className="h-8" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "number") {
    return <Input type="number" dir="ltr" className="h-8" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  // text / multi-value / link-multi → free text (comma-separated for `in`)
  return (
    <Input
      className="h-8"
      placeholder={multi ? t("comma_separated") : t("value")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Link autocomplete bound to the target doctype (built-in search). */
function LinkValue({ doctype, value, onChange }: { doctype: string; value: string; onChange: (v: string) => void }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const [opts, setOpts] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    searchLink(doctype, txt).then((r) => live && setOpts(r)).catch(() => {});
    return () => { live = false; };
  }, [open, txt, doctype]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-8 w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || t("select_value")}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t("search")} value={txt} onValueChange={setTxt} />
          <CommandList>
            <CommandEmpty>{t("no_results")}</CommandEmpty>
            <CommandGroup>
              {opts.map((o) => (
                <CommandItem key={o.value} value={o.value} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("me-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
