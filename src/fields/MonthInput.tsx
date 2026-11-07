/**
 * MonthInput — month granularity (P35 G20): replaces `<input type="month">` with the field look of `DateField`.
 * Value "YYYY-MM" (the native month input's contract) or null. A popover shows a year (previous / next) and a 3 × 4 grid
 * of months; arrows move (Left / Right follow the reading direction, Up / Down by a row), PageUp / PageDown change the
 * year, Enter / Space pick, Escape closes. `min` / `max` ("YYYY-MM") disable the months outside.
 */
import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { FIELD_INVALID } from "./FieldShell";

export interface MonthInputProps {
  /** "YYYY-MM" or empty. */
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Earliest / latest selectable month, "YYYY-MM". */
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Show a clear (×) button when there is a value (default true). */
  clearable?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

const RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
/** "2026-03" → { y: 2026, m: 3 }; anything else → null. */
export function parseMonthValue(v?: string | null): { y: number; m: number } | null {
  const r = RE.exec((v ?? "").trim());
  return r ? { y: Number(r[1]), m: Number(r[2]) } : null;
}
export const toMonthValue = (y: number, m: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
const key = (y: number, m: number) => y * 12 + (m - 1);
const loc = (language: "en" | "ar") => (language === "ar" ? "ar-EG" : "en-US");
/** "March 2026" / "مارس ٢٠٢٦". */
export function formatMonthValue(v: string | null | undefined, language: "en" | "ar" = "en"): string {
  const p = parseMonthValue(v);
  if (!p) return "";
  return new Intl.DateTimeFormat(loc(language), { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(p.y, p.m - 1, 1));
}

export function MonthInput({
  value, onChange, min, max, placeholder, disabled, invalid, clearable = true, id, className, ...aria
}: MonthInputProps) {
  const { t, language, isRTL } = useLocale();
  const sel = parseMonthValue(value);
  const lo = parseMonthValue(min); const hi = parseMonthValue(max);
  const now = new Date();
  const [open, setOpen] = React.useState(false);
  const [year, setYear] = React.useState(sel?.y ?? now.getFullYear());
  const [focus, setFocus] = React.useState(sel?.m ?? now.getMonth() + 1);
  const grid = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    // start on the chosen month, else today; clamped into min / max so the grid always has a focusable month
    let k = sel ? key(sel.y, sel.m) : key(now.getFullYear(), now.getMonth() + 1);
    if (lo && k < key(lo.y, lo.m)) k = key(lo.y, lo.m);
    if (hi && k > key(hi.y, hi.m)) k = key(hi.y, hi.m);
    setYear(Math.floor(k / 12)); setFocus((k % 12) + 1);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (!open) return;
    const id_ = requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-month="${focus}"]`)?.focus());
    return () => cancelAnimationFrame(id_);
  }, [open, focus, year]);

  const blocked = (y: number, m: number) => (lo != null && key(y, m) < key(lo.y, lo.m)) || (hi != null && key(y, m) > key(hi.y, hi.m));
  const short = new Intl.DateTimeFormat(loc(language), { month: "short", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat(loc(language), { month: "long", year: "numeric", timeZone: "UTC" });
  const yearFmt = new Intl.NumberFormat(loc(language), { useGrouping: false });
  const shown = formatMonthValue(value, language);
  const pick = (m: number) => { if (blocked(year, m)) return; onChange(toMonthValue(year, m)); setOpen(false); };
  const move = (delta: number) => {
    let y = year; let m = focus + delta;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    setYear(y); setFocus(m);
  };
  const onGridKey = (e: React.KeyboardEvent) => {
    const fwd = isRTL ? -1 : 1;
    const map: Record<string, () => void> = {
      ArrowRight: () => move(fwd), ArrowLeft: () => move(-fwd), ArrowDown: () => move(3), ArrowUp: () => move(-3),
      PageDown: () => setYear((y) => y + 1), PageUp: () => setYear((y) => y - 1), Home: () => setFocus(1), End: () => setFocus(12),
    };
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <button
            type="button" id={id} disabled={disabled}
            aria-label={aria["aria-label"] ? (shown ? `${aria["aria-label"]}: ${shown}` : aria["aria-label"]) : undefined}
            aria-labelledby={aria["aria-labelledby"]} aria-describedby={aria["aria-describedby"]}
            aria-invalid={invalid || undefined} aria-haspopup="dialog" data-value={sel ? toMonthValue(sel.y, sel.m) : undefined}
            className={cn(
              "sf-field-fill flex h-9 w-full items-center justify-between gap-2 rounded-md px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              clearable && sel && !disabled && "pe-9", invalid && FIELD_INVALID,
            )}
          >
            <span className={shown ? "truncate text-foreground" : "text-muted-foreground"}>{shown || placeholder || t("corePickMonth")}</span>
            <CalendarDays className={cn("size-4 shrink-0", invalid ? "text-destructive" : "text-muted-foreground", clearable && sel && !disabled && "hidden")} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2" role="dialog" aria-label={t("corePickMonth")}>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setYear((y) => y - 1)} aria-label={t("corePrevYear")}
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </button>
            <span className="text-sm font-semibold" aria-live="polite" data-year="">{yearFmt.format(year)}</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} aria-label={t("coreNextYear")}
              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
            </button>
          </div>
          <div ref={grid} className="grid grid-cols-3 gap-1" onKeyDown={onGridKey}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const on = sel?.y === year && sel.m === m; const off = blocked(year, m);
              return (
                <button key={m} type="button" data-month={m} disabled={off} tabIndex={m === focus ? 0 : -1}
                  aria-pressed={on} aria-label={long.format(Date.UTC(year, m - 1, 1))}
                  onClick={() => pick(m)} onFocus={() => setFocus(m)}
                  className={cn("h-9 rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                    on ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                  {short.format(Date.UTC(year, m - 1, 1))}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      {clearable && sel && !disabled ? (
        <button type="button" onClick={() => onChange(null)} aria-label={t("formClear")} title={t("formClear")}
          className="absolute end-1 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
