// Vendored from Sear (apps/sear_product, baseline 7abc895-dirty) frontend/src/sear_studio/components/DateTimeField.tsx — see VENDORED.md.
/**
 * Date / Time / DateTime fields — Sear's port of the Design System pattern.
 *
 * The DS defines ONE canonical date & time field (design_system
 * `pages/style-guide/StyleGuide.tsx` → `DateTimeInput`, and the date-picker pattern in the
 * extended-fields section): an input-family trigger with a trailing Lucide icon that opens a
 * coordinated Popover — react-day-picker calendar (keyboard + RTL) then a 12-hour time
 * selector — with temp state that only commits on Apply; Cancel / Escape / click-outside
 * discard.
 *
 * This file COMPOSES that pattern from DS primitives (Popover, Calendar, Select, Label,
 * Button) inside Sear. Nothing is added to the Design System, and no new visual language is
 * introduced — every class string here is the DS's.
 *
 * It replaces native <input type="date|time|datetime-local">, which rendered the browser's own
 * picker and icon, forced LTR, and showed English AM/PM under Arabic — violating the DS
 * Don't-list for this field: "split it into two unrelated fields, commit on click-outside,
 * hardcode one global date format, or use an emoji instead of the icon."
 *
 * Value contract is unchanged from the native inputs it replaces, so business logic is
 * untouched: "YYYY-MM-DD" (date), "HH:mm" (time), "YYYY-MM-DDTHH:mm" (datetime).
 */
import * as React from "react";
import { Calendar as CalendarIcon, Clock, CircleAlert } from "lucide-react";
import { arSA } from "date-fns/locale";

import { Calendar as CalendarUI } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Label } from "./label";
import { Button } from "./button";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import {
  formatDate, formatTime, formatDateTime,
  parseDateValue, toDateValue,
  parseTimeValue, toTimeValue,
  parseDateTimeValue, toDateTimeValue,
} from "../lib/datetime";

/** The DS trigger treatment — input-family styling + trailing icon (StyleGuide `DateTimeInput`). */
const TRIGGER =
  "sf-field-fill flex h-9 w-full items-center justify-between gap-2 rounded-md px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

type BaseProps = {
  disabled?: boolean;
  error?: string;
  className?: string;
  "aria-label"?: string;
  id?: string;
};

/** The trigger's name. Without an `aria-label`, a field with an `id` is named by its `<label htmlFor={id}>` (an
 *  aria-label would override it), and the selected value is its description (the visible value span); without either,
 *  the field names itself ("Date" / "Date: 12 Oct 2026", as before). */
function triggerA11y(id: string | undefined, ariaLabel: string | undefined, fallback: string, value: string | null) {
  if (id && ariaLabel === undefined) return { "aria-describedby": value ? `${id}-value` : undefined };
  const name = ariaLabel ?? fallback;
  return { "aria-label": value ? `${name}: ${value}` : name };
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-destructive">
      <CircleAlert className="size-3.5" aria-hidden />
      {error}
    </p>
  );
}

/** Hour / minute / meridiem row — the DS time selector (three `h-8 w-16` Selects). */
function TimeSelects({
  h, m, pm, interval, onH, onM, onPM, isAr,
}: {
  h: number; m: number; pm: boolean; interval: number;
  onH: (v: number) => void; onM: (v: number) => void; onPM: (v: boolean) => void; isAr: boolean;
}) {
  const mins: number[] = [];
  for (let i = 0; i < 60; i += interval) mins.push(i);
  return (
    <div className="flex items-center gap-1.5">
      <Select value={String(h)} onValueChange={(v) => onH(Number(v))}>
        <SelectTrigger className=" w-16"><SelectValue /></SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((x) => (
            <SelectItem key={x} value={String(x)}>{x}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={String(m)} onValueChange={(v) => onM(Number(v))}>
        <SelectTrigger className=" w-16"><SelectValue /></SelectTrigger>
        <SelectContent>
          {mins.map((x) => (
            <SelectItem key={x} value={String(x)}>{String(x).padStart(2, "0")}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={pm ? "pm" : "am"} onValueChange={(v) => onPM(v === "pm")}>
        <SelectTrigger className=" w-16"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="am">{isAr ? "ص" : "AM"}</SelectItem>
          <SelectItem value="pm">{isAr ? "م" : "PM"}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/* ---- DateField — replaces <input type="date"> ------------------------------------------- */

/** Calendar options carried over from PMO's DatePicker (solvfast_pmo components/ui/date-picker.tsx). */
type CalendarOptions = {
  /** "dropdown" adds month/year selects to the caption (PMO). Default: Sear's plain caption. */
  captionLayout?: "label" | "dropdown" | "dropdown-months" | "dropdown-years";
  startMonth?: Date;
  endMonth?: Date;
};

export function DateField({
  value, onChange, placeholder, disabled, error, className, id, captionLayout, startMonth, endMonth, ...rest
}: BaseProps & CalendarOptions & { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { isRTL } = useLocale();
  const [open, setOpen] = React.useState(false);
  const selected = parseDateValue(value);
  const label = selected ? formatDate(selected, isRTL) : (placeholder ?? (isRTL ? "اختر تاريخًا" : "Pick a date"));
  const a11y = triggerA11y(id, rest["aria-label"], isRTL ? "التاريخ" : "Date", selected ? formatDate(selected, isRTL) : null);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button" id={id} disabled={disabled}
            {...a11y}
            aria-invalid={!!error || undefined}
            className={cn(TRIGGER, error && "!border-destructive/60")}
          >
            <span id={id ? `${id}-value` : undefined} className={selected ? "truncate text-foreground" : "text-muted-foreground"}>{label}</span>
            <CalendarIcon className={cn("size-4 shrink-0", error ? "text-destructive" : "text-muted-foreground")} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <CalendarUI
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => { if (d) { onChange(toDateValue(d)); setOpen(false); } }}
            locale={isRTL ? arSA : undefined}
            dir={isRTL ? "rtl" : "ltr"}
            captionLayout={captionLayout}
            startMonth={startMonth}
            endMonth={endMonth}
          />
        </PopoverContent>
      </Popover>
      <FieldError error={error} />
    </div>
  );
}

/* ---- TimeField — replaces <input type="time"> ------------------------------------------- */

export function TimeField({
  value, onChange, interval = 5, disabled, error, className, id, ...rest
}: BaseProps & { value: string; onChange: (v: string) => void; interval?: number }) {
  const { isRTL } = useLocale();
  const [open, setOpen] = React.useState(false);
  const parsed = parseTimeValue(value);

  const [h, setH] = React.useState(parsed ? (parsed.h % 12) || 12 : 9);
  const [m, setM] = React.useState(parsed ? parsed.m - (parsed.m % interval) : 0);
  const [pm, setPM] = React.useState(parsed ? parsed.h >= 12 : false);

  // Re-seed the draft from the committed value each time the popover opens.
  const seed = () => {
    const p = parseTimeValue(value);
    if (p) { setH((p.h % 12) || 12); setM(p.m - (p.m % interval)); setPM(p.h >= 12); }
  };

  const preview = new Date(2000, 0, 1, pm ? (h % 12) + 12 : h % 12, m);
  const label = parsed
    ? formatTime(new Date(2000, 0, 1, parsed.h, parsed.m), isRTL)
    : (isRTL ? "اختر الوقت" : "Pick a time");
  const a11y = triggerA11y(id, rest["aria-label"], isRTL ? "الوقت" : "Time", parsed ? label : null);

  const apply = () => {
    onChange(toTimeValue(pm ? (h % 12) + 12 : h % 12, m));
    setOpen(false);
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={(o) => { if (o) seed(); setOpen(o); }}>
        <PopoverTrigger asChild>
          <button
            type="button" id={id} disabled={disabled}
            {...a11y}
            aria-invalid={!!error || undefined}
            className={cn(TRIGGER, error && "!border-destructive/60")}
          >
            <span id={id ? `${id}-value` : undefined} className={parsed ? "truncate text-foreground" : "text-muted-foreground"}>{label}</span>
            <Clock className={cn("size-4 shrink-0", error ? "text-destructive" : "text-muted-foreground")} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">{isRTL ? "اختر الوقت" : "Select time"}</div>
          <div className="space-y-2 p-3">
            <Label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {isRTL ? "الوقت" : "Time"}
            </Label>
            <TimeSelects h={h} m={m} pm={pm} interval={interval} onH={setH} onM={setM} onPM={setPM} isAr={isRTL} />
            <p className="text-xs text-muted-foreground" aria-live="polite">{formatTime(preview, isRTL)}</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
              <Button size="sm" onClick={apply}>{isRTL ? "تطبيق" : "Apply"}</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <FieldError error={error} />
    </div>
  );
}

/* ---- Uncontrolled variants --------------------------------------------------------------
 * For read-only previews (e.g. the Field Library's "how this field will look" pane) that used
 * `defaultValue` with no onChange. They hold their own state so the preview stays interactive.
 */

export function DateFieldPreview({ defaultValue = "", ...rest }: { defaultValue?: string } & Omit<BaseProps, "error">) {
  const [v, setV] = React.useState(defaultValue);
  return <DateField value={v} onChange={setV} {...rest} />;
}

export function TimeFieldPreview({ defaultValue = "", ...rest }: { defaultValue?: string } & Omit<BaseProps, "error">) {
  const [v, setV] = React.useState(defaultValue);
  return <TimeField value={v} onChange={setV} {...rest} />;
}

export function DateTimeFieldPreview({ defaultValue = "", ...rest }: { defaultValue?: string } & Omit<BaseProps, "error">) {
  const [v, setV] = React.useState(defaultValue);
  return <DateTimeField value={v} onChange={setV} {...rest} />;
}

/* ---- DateTimeField — replaces <input type="datetime-local"> ------------------------------ */

export function DateTimeField({
  value, onChange, interval = 15, disabled, error, className, id, ...rest
}: BaseProps & { value: string; onChange: (v: string) => void; interval?: number }) {
  const { isRTL } = useLocale();
  const [open, setOpen] = React.useState(false);
  const committed = parseDateTimeValue(value);

  const [tDate, setTDate] = React.useState<Date | undefined>(committed);
  const [h, setH] = React.useState(committed ? (committed.getHours() % 12) || 12 : 10);
  const [m, setM] = React.useState(committed ? committed.getMinutes() - (committed.getMinutes() % interval) : 30);
  const [pm, setPM] = React.useState(committed ? committed.getHours() >= 12 : false);

  const seed = () => {
    const c = parseDateTimeValue(value);
    setTDate(c);
    if (c) { setH((c.getHours() % 12) || 12); setM(c.getMinutes() - (c.getMinutes() % interval)); setPM(c.getHours() >= 12); }
  };

  const preview = tDate
    ? new Date(tDate.getFullYear(), tDate.getMonth(), tDate.getDate(), pm ? (h % 12) + 12 : h % 12, m)
    : null;
  const label = committed ? formatDateTime(committed, isRTL) : (isRTL ? "اختر التاريخ والوقت" : "Select date and time");
  const a11y = triggerA11y(id, rest["aria-label"], isRTL ? "التاريخ والوقت" : "Date and time", committed ? label : null);

  const apply = () => { if (preview) { onChange(toDateTimeValue(preview)); setOpen(false); } };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={(o) => { if (o) seed(); setOpen(o); }}>
        <PopoverTrigger asChild>
          <button
            type="button" id={id} disabled={disabled}
            {...a11y}
            aria-invalid={!!error || undefined}
            className={cn(TRIGGER, error && "!border-destructive/60")}
          >
            <span id={id ? `${id}-value` : undefined} className={committed ? "truncate text-foreground" : "text-muted-foreground"}>{label}</span>
            <CalendarIcon className={cn("size-4 shrink-0", error ? "text-destructive" : "text-muted-foreground")} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <div className="border-b border-border px-3 py-2 text-sm font-medium">
            {isRTL ? "اختر التاريخ والوقت" : "Select date & time"}
          </div>
          <CalendarUI
            mode="single" selected={tDate} onSelect={setTDate}
            locale={isRTL ? arSA : undefined} dir={isRTL ? "rtl" : "ltr"}
          />
          <div className="space-y-2 border-t border-border p-3">
            <Label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {isRTL ? "الوقت" : "Time"}
            </Label>
            <TimeSelects h={h} m={m} pm={pm} interval={interval} onH={setH} onM={setM} onPM={setPM} isAr={isRTL} />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {preview ? formatDateTime(preview, isRTL) : (isRTL ? "لم يُحدَّد تاريخ" : "No date selected")}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{isRTL ? "إلغاء" : "Cancel"}</Button>
              <Button size="sm" onClick={apply} disabled={!preview}>{isRTL ? "تطبيق" : "Apply"}</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <FieldError error={error} />
    </div>
  );
}
