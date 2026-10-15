import { CalendarIcon } from "lucide-react";
import { ar as arLocale, enGB } from "date-fns/locale";
import { useApp } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/projects-labels";

/** Parse a "YYYY-MM-DD" string into a local Date (no UTC shift). */
function parse(value?: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Serialize a Date back to "YYYY-MM-DD" using local parts. */
function serialize(date?: Date): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Calendar-popover date picker over a "YYYY-MM-DD" string value — a drop-in replacement for
 * `<Input type="date">`. Localized (ar/en) display, RTL-aware popover alignment, keyboard accessible.
 */
export function DatePicker({
  value,
  onChange,
  disabled,
  id,
  placeholder,
  className,
}: {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
}) {
  const { t, language } = useApp();
  const selected = parse(value);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-2 font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">
            {selected ? formatDate(value, language) : placeholder ?? t("select_ellipsis")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => onChange(serialize(d))}
          locale={language === "ar" ? arLocale : enGB}
          dir={language === "ar" ? "rtl" : "ltr"}
          captionLayout="dropdown"
          startMonth={new Date(2015, 0)}
          endMonth={new Date(2035, 11)}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
