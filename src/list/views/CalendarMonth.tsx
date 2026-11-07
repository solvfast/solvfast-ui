/**
 * CalendarMonth — a month grid of events (Desk's Calendar view, frappe/public/js/frappe/views/calendar/calendar.js,
 * month mode only). Presentational: the host passes the events of the shown month and reacts to `onMonthChange`
 * (fetch the visible range, `monthGrid(month).start … end`). Multi-day events appear on each day they cover. RTL: the
 * grid follows the page direction and the previous / next arrows swap, as the list pager does.
 */
import * as React from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../primitives/button";
import { Card } from "../../primitives/card";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import { addMonths, eventsOn, monthGrid, monthStart, parseDay, ymd, type CalendarEvent } from "./calendarModel";

export interface CalendarMonthProps {
  /** Any day of the month to show ("YYYY-MM-DD"). */
  month: string;
  onMonthChange: (month: string) => void;
  events: readonly CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  /** 0 = Sunday … 6 = Saturday. Default 1 (Monday). */
  weekStartsOn?: number;
  /** Events shown per day before "+n more". Default 3. */
  maxPerDay?: number;
  /** Today, for the highlight and the Today button (tests). Default: the clock. */
  today?: string;
  loading?: boolean;
  error?: React.ReactNode | boolean;
  onRetry?: () => void;
  /** Before the month title (e.g. a ViewSwitcher). */
  toolbarLeading?: React.ReactNode;
  className?: string;
}

export function CalendarMonth({ month, onMonthChange, events, onEventClick, weekStartsOn = 1, maxPerDay = 3, today: todayProp, loading, error, onRetry, toolbarLeading, className }: CalendarMonthProps) {
  const { t, language, direction } = useLocale();
  const locale = language === "ar" ? "ar-EG" : "en-GB";
  const today = todayProp ?? ymd(new Date());
  const current = monthStart(month);
  const { weeks } = React.useMemo(() => monthGrid(current, weekStartsOn), [current, weekStartsOn]);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const title = parseDay(current).toLocaleDateString(locale, { month: "long", year: "numeric" });
  const dayNames = weeks[0].map((d) => parseDay(d).toLocaleDateString(locale, { weekday: "short" }));
  const Prev = direction === "rtl" ? ChevronRight : ChevronLeft;
  const Next = direction === "rtl" ? ChevronLeft : ChevronRight;
  const inMonth = (d: string) => d.slice(0, 7) === current.slice(0, 7);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {toolbarLeading}
        <h2 className="text-base font-semibold" aria-live="polite" data-testid="sf-calendar-title">{title}</h2>
        <div className="ms-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => onMonthChange(monthStart(today))}>{t("calendarToday")}</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label={t("calendarPrev")} onClick={() => onMonthChange(addMonths(current, -1))}><Prev className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label={t("calendarNext")} onClick={() => onMonthChange(addMonths(current, 1))}><Next className="h-4 w-4" /></Button>
        </div>
      </div>
      {error ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center text-sm" role={typeof error === "boolean" ? "alert" : undefined}>
          {typeof error === "boolean" ? <><AlertTriangle className="h-5 w-5 text-destructive" /><span>{t("loadError")}</span></> : error}
          {onRetry && typeof error === "boolean" && <Button variant="outline" size="sm" onClick={onRetry}>{t("retry")}</Button>}
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[42rem] table-fixed border-collapse text-sm" role="grid" aria-label={t("calendarLabel").replace("{month}", title)} aria-busy={loading || undefined}>
            <thead>
              <tr>{dayNames.map((n, i) => <th key={i} scope="col" className="border-b border-border px-2 py-1.5 text-start text-xs font-medium text-muted-foreground">{n}</th>)}</tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week[0]}>
                  {week.map((day) => {
                    const list = eventsOn(events, day);
                    const open = expanded === day;
                    const shown = open ? list : list.slice(0, maxPerDay);
                    const label = parseDay(day).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
                    return (
                      <td key={day} data-day={day} aria-label={label} aria-current={day === today ? "date" : undefined}
                        className={cn("h-28 border border-border p-1 align-top", !inMonth(day) && "bg-muted/40 text-muted-foreground")}>
                        <div className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums", day === today && "bg-primary text-primary-foreground")} dir="ltr">
                          {parseDay(day).toLocaleDateString(locale, { day: "numeric" })}
                        </div>
                        <ul className="space-y-0.5">
                          {shown.map((e) => (
                            <li key={e.id}>
                              <button type="button" className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-start text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                title={e.title} onClick={() => onEventClick?.(e)} data-event-id={e.id}>
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" style={e.color ? { background: e.color } : undefined} aria-hidden="true" />
                                <span className="truncate">{e.title}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {list.length > shown.length && (
                          <button type="button" className="mt-0.5 px-1 text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setExpanded(day)}>
                            {t("calendarMore").replace("{n}", String(list.length - shown.length))}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
