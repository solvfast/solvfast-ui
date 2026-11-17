/**
 * SchedulingCalendar — several people's events on one shared grid (Day / Week time grid, or Month), and the time of a
 * new meeting picked on it. The parent owns the proposal: every change goes through `onProposalChange`.
 * docs/components/scheduling-calendar.md
 */
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../primitives/button";
import { Label } from "../primitives/label";
import { Switch } from "../primitives/switch";
import { ToggleGroup, ToggleGroupItem } from "../primitives/toggle-group";
import { cn } from "../lib/cn";
import { formatTime } from "../lib/datetime";
import { useLocale } from "../theme/ThemeProvider";
import { addDays, addMonths, monthGrid, parseDay, ymd } from "../list/views/calendarModel";
import {
  DAY_MINUTES, durationMinutes, layoutDay, minutesOfDay, moveSlot, resizeSlot, shiftSlot, slotFromDrag, slotOnDay, visibleDays,
  type PlacedEvent, type ScheduleEvent, type ScheduleGuest, type ScheduleSlot, type ScheduleView,
} from "./schedulingModel";

export interface SchedulingCalendarLabels {
  today: string; previous: string; next: string; day: string; week: string; month: string; view: string;
  workingHoursOnly: string; busy: string;
  /** "+{n} more" — `{n}` is replaced. */
  more: string;
  legend: string; proposal: string; proposalHint: string; resizeProposal: string; resizePanel: string; grid: string;
}

export interface SchedulingCalendarProps {
  /** Legend entries; an event takes the colour of its guest. */
  guests: ScheduleGuest[];
  /** Every guest's events. Dates or strings, read as local time ("2026-11-20 10:00:00", ISO). No title → "Busy". */
  events: ScheduleEvent[];
  /** The meeting being scheduled, drawn on top in the primary colour. */
  proposal: ScheduleSlot | null;
  /** A click, a drag across slots, a move or a resize of the proposal (pointer or keyboard) gives a new slot. */
  onProposalChange: (slot: ScheduleSlot) => void;
  view?: ScheduleView;
  /** Default "week". */
  defaultView?: ScheduleView;
  onViewChange?: (view: ScheduleView) => void;
  /** The focused day. Uncontrolled default: the proposal's day, else today. A proposal set outside the shown range brings its day into view. */
  date?: Date;
  onDateChange?: (date: Date) => void;
  /** Whole hours, end exclusive. Default 8..18. */
  workingHours?: { start: number; end: number };
  workingHoursOnly?: boolean;
  /** Default true. */
  defaultWorkingHoursOnly?: boolean;
  onWorkingHoursOnlyChange?: (value: boolean) => void;
  /** Snap, in minutes. Default 30. */
  slotMinutes?: number;
  /** The grid area's height in px (toolbar and legend excluded), kept within minHeight…maxHeight. */
  height?: number;
  /** Default 420. */
  defaultHeight?: number;
  onHeightChange?: (height: number) => void;
  /** Default 260. */
  minHeight?: number;
  /** Default 900. */
  maxHeight?: number;
  /** 0 = Sunday … 6 = Saturday. Default 0. */
  weekStartsOn?: number;
  loading?: boolean;
  labels?: Partial<SchedulingCalendarLabels>;
  className?: string;
}

const HOUR_PX = 48;
const PX_PER_MIN = HOUR_PX / 60;
const HEIGHT_STEP = 20;
const MONTH_CHIPS = 3;
const DEFAULT_WORKING_HOURS = { start: 8, end: 18 };

function useControllable<T>(value: T | undefined, initial: T | (() => T), onChange?: (v: T) => void): [T, (v: T) => void] {
  const [own, setOwn] = React.useState(initial);
  const current = value !== undefined ? value : own;
  const set = React.useCallback((v: T) => { if (value === undefined) setOwn(v); onChange?.(v); }, [value, onChange]);
  return [current, set];
}

type Drag =
  | { kind: "create"; pointerId: number; day: string; fromMin: number }
  | { kind: "move"; pointerId: number; offset: number; base: ScheduleSlot }
  | { kind: "resize"; pointerId: number; base: ScheduleSlot };

export function SchedulingCalendar({
  guests, events, proposal, onProposalChange, view: viewProp, defaultView = "week", onViewChange, date: dateProp, onDateChange,
  workingHours = DEFAULT_WORKING_HOURS, workingHoursOnly: whoProp, defaultWorkingHoursOnly = true, onWorkingHoursOnlyChange,
  slotMinutes = 30, height: heightProp, defaultHeight = 420, onHeightChange, minHeight = 260, maxHeight = 900, weekStartsOn = 0, loading, labels, className,
}: SchedulingCalendarProps) {
  const { t, language, isRTL } = useLocale();
  const L: SchedulingCalendarLabels = {
    today: t("schedToday"), previous: t("schedPrev"), next: t("schedNext"), day: t("schedDay"), week: t("schedWeek"), month: t("schedMonth"),
    view: t("schedView"), workingHoursOnly: t("schedWorkingHoursOnly"), busy: t("schedBusy"), more: t("schedMore"), legend: t("schedLegend"),
    proposal: t("schedProposal"), proposalHint: t("schedProposalHint"), resizeProposal: t("schedResizeProposal"), resizePanel: t("schedResizePanel"),
    grid: t("schedGrid"), ...labels,
  };
  const isAr = language === "ar";
  const locale = isAr ? "ar-u-nu-latn" : "en-GB";
  const ids = React.useId();

  const [view, setView] = useControllable<ScheduleView>(viewProp, defaultView, onViewChange);
  const onDateDay = React.useCallback((d: string) => onDateChange?.(parseDay(d)), [onDateChange]);
  const [day, setDay] = useControllable<string>(dateProp ? ymd(dateProp) : undefined, () => ymd(proposal?.start ?? new Date()), onDateDay);
  const [whOnly, setWhOnly] = useControllable<boolean>(whoProp, defaultWorkingHoursOnly, onWorkingHoursOnlyChange);
  const clampHeight = (h: number) => Math.min(maxHeight, Math.max(minHeight, Math.round(h)));
  const [height, setHeight] = useControllable<number>(heightProp === undefined ? undefined : clampHeight(heightProp), clampHeight(defaultHeight), onHeightChange);

  const days = React.useMemo(() => visibleDays(view, day, weekStartsOn), [view, day, weekStartsOn]);
  const daysRef = React.useRef(days);
  daysRef.current = days;
  const proposalTime = proposal ? proposal.start.getTime() : null;
  React.useEffect(() => {
    if (proposalTime === null) return;
    const d = ymd(new Date(proposalTime));
    if (!daysRef.current.includes(d)) setDay(d);
    // keyed on the start time, not the object: a parent rebuilding the Date each render must not undo Prev / Next
  }, [proposalTime]);

  const colorOf = React.useMemo(() => new Map(guests.map((g) => [g.key, g.color])), [guests]);
  const guestOf = React.useMemo(() => new Map(guests.map((g) => [g.key, g.label])), [guests]);

  const startHour = whOnly ? workingHours.start : 0;
  const endHour = whOnly ? workingHours.end : 24;
  const firstMin = startHour * 60;
  const lastMin = endHour * 60;
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    if (view === "month" || !scrollRef.current) return;
    scrollRef.current.scrollTop = whOnly ? 0 : workingHours.start * HOUR_PX;
  }, [whOnly, view, workingHours.start]);

  const [draft, setDraft] = React.useState<ScheduleSlot | null>(null);
  const drag = React.useRef<Drag | null>(null);
  const shown = draft ?? proposal;
  const refocus = React.useRef(false);
  const proposalEl = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (refocus.current && proposalEl.current) { refocus.current = false; proposalEl.current.focus(); }
  });

  const fmtDate = (d: string, o: Intl.DateTimeFormatOptions) => parseDay(d).toLocaleDateString(locale, o);
  const timeRange = (s: ScheduleSlot) => `${formatTime(s.start, isAr)} – ${formatTime(s.end, isAr)}`;
  const rangeLabel = view === "day"
    ? fmtDate(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : view === "week"
      ? `${fmtDate(days[0], { day: "numeric", month: "short" })} – ${fmtDate(days[6], { day: "numeric", month: "short", year: "numeric" })}`
      : fmtDate(day, { month: "long", year: "numeric" });
  const step = (dir: 1 | -1) => setDay(view === "day" ? addDays(day, dir) : view === "week" ? addDays(day, 7 * dir) : addMonths(day, dir));
  const Prev = isRTL ? ChevronRight : ChevronLeft;
  const Next = isRTL ? ChevronLeft : ChevronRight;
  const today = ymd(new Date());

  const minuteAt = (e: React.PointerEvent, column: HTMLElement) =>
    Math.min(lastMin - 1, Math.max(firstMin, (e.clientY - column.getBoundingClientRect().top) / PX_PER_MIN + firstMin));
  const dayUnder = (e: React.PointerEvent, fallback: string) => {
    const hit = typeof document.elementFromPoint === "function" ? document.elementFromPoint(e.clientX, e.clientY) : null;
    return hit?.closest<HTMLElement>("[data-sched-day]")?.dataset.schedDay ?? fallback;
  };
  const capture = (el: Element, pointerId: number) => { try { el.setPointerCapture?.(pointerId); } catch { /* not capturable */ } };

  const onColumnDown = (e: React.PointerEvent<HTMLDivElement>, d: string) => {
    if (e.button !== 0 || drag.current) return;
    capture(e.currentTarget, e.pointerId);
    drag.current = { kind: "create", pointerId: e.pointerId, day: d, fromMin: minuteAt(e, e.currentTarget) };
  };
  const onProposalDown = (e: React.PointerEvent<HTMLDivElement>, kind: "move" | "resize") => {
    if (e.button !== 0 || !proposal) return;
    e.stopPropagation();
    const column = e.currentTarget.closest<HTMLElement>("[data-sched-day]");
    if (!column) return;
    // the column, not the block: a move onto another day remounts the block there, which would drop its capture
    capture(column, e.pointerId);
    drag.current = kind === "move"
      ? { kind, pointerId: e.pointerId, offset: minuteAt(e, column) - minutesOfDay(proposal.start), base: proposal }
      : { kind, pointerId: e.pointerId, base: proposal };
  };
  const withinHours = (slot: ScheduleSlot | null): ScheduleSlot | null => {
    if (!slot || !whOnly) return slot;
    const s = minutesOfDay(slot.start);
    const e = ymd(slot.end) === ymd(slot.start) ? minutesOfDay(slot.end) : DAY_MINUTES;
    if (s >= firstMin && e <= lastMin) return slot;
    if (e - s > lastMin - firstMin) return slot;
    return moveSlot(slot, ymd(slot.start), Math.min(Math.max(s, firstMin), lastMin - (e - s)), slotMinutes);
  };
  const slotFor = (e: React.PointerEvent<HTMLDivElement>, column: HTMLElement): ScheduleSlot | null => {
    const g = drag.current;
    if (!g || g.pointerId !== e.pointerId) return null;
    const min = minuteAt(e, column);
    if (g.kind === "create") return slotFromDrag(g.day, g.fromMin, min, slotMinutes, proposal ? durationMinutes(proposal) : 30);
    if (g.kind === "move") return withinHours(moveSlot(g.base, dayUnder(e, column.dataset.schedDay ?? ymd(g.base.start)), min - g.offset, slotMinutes));
    return resizeSlot(g.base, min, slotMinutes);
  };
  const onColumnMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (g.kind === "create" && Math.floor(minuteAt(e, e.currentTarget) / slotMinutes) === Math.floor(g.fromMin / slotMinutes) && !draft) return;
    setDraft(slotFor(e, e.currentTarget));
  };
  const onColumnUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const slot = slotFor(e, e.currentTarget);
    if (!slot) return;
    drag.current = null;
    setDraft(null);
    if (!proposal || slot.start.getTime() !== proposal.start.getTime() || slot.end.getTime() !== proposal.end.getTime()) onProposalChange(slot);
  };
  const onColumnCancel = () => { drag.current = null; setDraft(null); };

  const onProposalKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!proposal) return;
    let next: ScheduleSlot | null = null;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const delta = e.key === "ArrowUp" ? -slotMinutes : slotMinutes;
      const end = minutesOfDay(proposal.start) + durationMinutes(proposal) + delta;
      next = e.shiftKey ? (whOnly && end > lastMin ? null : resizeSlot(proposal, end, slotMinutes)) : shiftSlot(proposal, delta);
      if (next && !e.shiftKey && whOnly && (minutesOfDay(next.start) < firstMin || minutesOfDay(next.start) + durationMinutes(next) > lastMin)) next = null;
    } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.shiftKey) {
      const forward = (e.key === "ArrowRight") !== isRTL;
      next = slotOnDay(proposal, addDays(ymd(proposal.start), forward ? 1 : -1));
      if (!daysRef.current.includes(ymd(next.start))) setDay(ymd(next.start));
    } else return;
    e.preventDefault();
    if (next && (next.start.getTime() !== proposal.start.getTime() || next.end.getTime() !== proposal.end.getTime())) {
      refocus.current = true;
      onProposalChange(next);
    }
  };

  const resizeStart = React.useRef<{ y: number; h: number; pointerId: number } | null>(null);
  const onHandleKey = (e: React.KeyboardEvent) => {
    const next = e.key === "ArrowUp" ? height - HEIGHT_STEP : e.key === "ArrowDown" ? height + HEIGHT_STEP : e.key === "Home" ? minHeight : e.key === "End" ? maxHeight : null;
    if (next === null) return;
    e.preventDefault();
    setHeight(clampHeight(next));
  };

  const columns = view === "month" ? [] : days;
  const placedByDay = React.useMemo(() => new Map(days.map((d) => [d, layoutDay(events, d)])), [events, days]);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const gridHeight = (endHour - startHour) * HOUR_PX;

  const proposalBlock = (d: string) => {
    if (!shown || ymd(shown.start) !== d) return null;
    const s = Math.max(minutesOfDay(shown.start), firstMin);
    const endOfDay = ymd(shown.end) === d ? minutesOfDay(shown.end) : DAY_MINUTES;
    const e = Math.min(endOfDay, lastMin);
    if (e <= s) return null;
    const text = timeRange(shown);
    return (
      <div ref={proposalEl} role="button" tabIndex={0} data-sched-proposal="" aria-label={`${L.proposal}, ${text}`} aria-describedby={`${ids}-hint`}
        className={cn("absolute inset-x-0.5 z-20 cursor-grab touch-none select-none overflow-hidden rounded-md border-2 bg-primary/15 px-1.5 py-0.5 text-xs font-medium text-primary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          draft ? "cursor-grabbing border-solid border-primary" : "border-dashed border-primary")}
        style={{ top: (s - firstMin) * PX_PER_MIN, height: Math.max((e - s) * PX_PER_MIN, 12) }}
        onPointerDown={(ev) => onProposalDown(ev, "move")} onKeyDown={onProposalKey}>
        <div className="truncate">{L.proposal}</div>
        <div className="truncate font-normal tabular-nums">{text}</div>
        <div aria-label={L.resizeProposal} title={L.resizeProposal} data-sched-resize=""
          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none" onPointerDown={(ev) => onProposalDown(ev, "resize")} />
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col gap-2 text-sm", className)} data-sched-view={view}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setDay(today)}>{L.today}</Button>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label={L.previous} onClick={() => step(-1)}><Prev className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" aria-label={L.next} onClick={() => step(1)}><Next className="h-4 w-4" /></Button>
        </div>
        <h3 className="text-sm font-semibold" aria-live="polite" data-testid="sf-sched-range">{rangeLabel}</h3>
        <div className="ms-auto flex flex-wrap items-center gap-3">
          {view !== "month" && (
            <div className="flex items-center gap-2">
              <Switch id={`${ids}-wh`} checked={whOnly} onCheckedChange={setWhOnly} />
              <Label htmlFor={`${ids}-wh`} className="text-xs font-normal">{L.workingHoursOnly}</Label>
            </div>
          )}
          <ToggleGroup type="single" variant="outline" size="sm" value={view} aria-label={L.view}
            onValueChange={(v) => { if (v) setView(v as ScheduleView); }}>
            <ToggleGroupItem value="day" className="h-8 px-2.5 text-xs">{L.day}</ToggleGroupItem>
            <ToggleGroupItem value="week" className="h-8 px-2.5 text-xs">{L.week}</ToggleGroupItem>
            <ToggleGroupItem value="month" className="h-8 px-2.5 text-xs">{L.month}</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-md border border-border bg-card">
        {loading && <div className="absolute inset-x-0 top-0 z-30 h-0.5 animate-pulse bg-primary" aria-hidden="true" />}
        <div ref={scrollRef} className="overflow-auto" style={{ height }} role="group" aria-label={`${L.grid}, ${rangeLabel}`} aria-busy={loading || undefined}>
          {view === "month" ? (
            <MonthGrid day={day} weekStartsOn={weekStartsOn} placed={placedByDay} colorOf={colorOf} busy={L.busy} more={L.more} locale={locale}
              today={today} proposalDay={proposal ? ymd(proposal.start) : null}
              onPick={(d) => { onProposalChange(slotOnDay(proposal, d)); setDay(d); setView("day"); }} />
          ) : (
            <div className={cn("min-w-full", view === "week" && "min-w-[36rem]")}>
              <div className="sticky top-0 z-30 flex border-b border-border bg-card">
                <div className="w-14 shrink-0" />
                {columns.map((d) => (
                  <button key={d} type="button" className={cn("min-w-0 flex-1 border-s border-border px-1 py-1.5 text-center text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    d === today ? "font-semibold text-primary" : "text-muted-foreground")}
                    aria-current={d === today ? "date" : undefined} disabled={view === "day"}
                    onClick={() => { setDay(d); setView("day"); }}>
                    {fmtDate(d, { weekday: "short", day: "numeric" })}
                  </button>
                ))}
              </div>
              <div className="flex">
                <div className="relative w-14 shrink-0" style={{ height: gridHeight }} aria-hidden="true">
                  {hours.map((h) => (
                    <div key={h} className="absolute inset-x-0 -translate-y-1/2 px-1 text-end text-[10px] tabular-nums text-muted-foreground first:translate-y-0"
                      style={{ top: (h - startHour) * HOUR_PX }} data-sched-hour={h}>
                      {formatTime(new Date(2000, 0, 1, h), isAr)}
                    </div>
                  ))}
                </div>
                {columns.map((d) => (
                  <div key={d} data-sched-day={d} className="relative min-w-0 flex-1 border-s border-border" style={{ height: gridHeight }}
                    onPointerDown={(e) => onColumnDown(e, d)} onPointerMove={onColumnMove} onPointerUp={onColumnUp} onPointerCancel={onColumnCancel}>
                    {hours.map((h) => (
                      <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-border" style={{ top: (h - startHour) * HOUR_PX, height: HOUR_PX }}>
                        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/60" />
                      </div>
                    ))}
                    {(placedByDay.get(d) ?? []).filter((p) => p.endMin > firstMin && p.startMin < lastMin).map((p) => {
                      const s = Math.max(p.startMin, firstMin);
                      const en = Math.min(p.endMin, lastMin);
                      const color = colorOf.get(p.event.guestKey) ?? "hsl(var(--muted-foreground))";
                      const text = p.event.title || L.busy;
                      const who = guestOf.get(p.event.guestKey);
                      return (
                        <div key={p.event.id} data-event-id={p.event.id} data-guest={p.event.guestKey}
                          title={`${who ? `${who}: ` : ""}${text} (${timeRange(p)})`}
                          className="absolute z-10 overflow-hidden rounded-sm border-s-[3px] px-1 py-0.5 text-[11px] leading-tight text-foreground"
                          style={{
                            top: (s - firstMin) * PX_PER_MIN, height: Math.max((en - s) * PX_PER_MIN - 1, 10),
                            insetInlineStart: `${(p.col / p.cols) * 100}%`, width: `calc(${100 / p.cols}% - 2px)`,
                            borderInlineStartColor: color, backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
                          }}>
                          <span className="block truncate" dir="auto">{text}</span>
                        </div>
                      );
                    })}
                    {proposalBlock(d)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <span id={`${ids}-hint`} className="sr-only">{L.proposalHint}</span>
      </div>

      <div role="separator" aria-orientation="horizontal" aria-label={L.resizePanel} aria-valuenow={height} aria-valuemin={minHeight} aria-valuemax={maxHeight}
        tabIndex={0} data-sched-height-handle=""
        className="-mt-1 flex h-3 cursor-row-resize touch-none items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={onHandleKey}
        onPointerDown={(e) => { if (e.button !== 0) return; capture(e.currentTarget, e.pointerId); resizeStart.current = { y: e.clientY, h: height, pointerId: e.pointerId }; }}
        onPointerMove={(e) => { const r = resizeStart.current; if (r && r.pointerId === e.pointerId) setHeight(clampHeight(r.h + e.clientY - r.y)); }}
        onPointerUp={() => { resizeStart.current = null; }} onPointerCancel={() => { resizeStart.current = null; }}>
        <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
      </div>

      {guests.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label={L.legend}>
          {guests.map((g) => (
            <li key={g.key} className="flex items-center gap-1.5" data-guest={g.key}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
              <span>{g.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface MonthGridProps {
  day: string; weekStartsOn: number; placed: Map<string, PlacedEvent[]>; colorOf: Map<string, string>; busy: string; more: string; locale: string;
  today: string; proposalDay: string | null; onPick: (day: string) => void;
}

function MonthGrid({ day, weekStartsOn, placed, colorOf, busy, more, locale, today, proposalDay, onPick }: MonthGridProps) {
  const { weeks } = React.useMemo(() => monthGrid(day, weekStartsOn), [day, weekStartsOn]);
  const month = day.slice(0, 7);
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => parseDay(d).toLocaleDateString(locale, o);
  return (
    <table className="w-full min-w-[36rem] table-fixed border-collapse text-xs">
      <thead className="sticky top-0 z-10 bg-card">
        <tr>{weeks[0].map((d) => <th key={d} scope="col" className="border-b border-border px-1 py-1.5 text-center font-medium text-muted-foreground">{fmt(d, { weekday: "short" })}</th>)}</tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((d) => {
              const list = placed.get(d) ?? [];
              const extra = list.length - MONTH_CHIPS;
              return (
                <td key={d} className={cn("h-20 border border-border p-0 align-top", d.slice(0, 7) !== month && "bg-muted/40 text-muted-foreground")}>
                  <button type="button" data-sched-month-day={d} aria-current={d === today ? "date" : undefined}
                    aria-label={fmt(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    className={cn("flex h-full min-h-20 w-full flex-col gap-0.5 p-1 text-start hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      d === proposalDay && "ring-2 ring-inset ring-primary")}
                    onClick={() => onPick(d)}>
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-full tabular-nums", d === today && "bg-primary text-primary-foreground")}>
                      {parseDay(d).getDate()}
                    </span>
                    {list.slice(0, MONTH_CHIPS).map((p) => (
                      <span key={p.event.id} data-event-id={p.event.id} className="flex w-full min-w-0 items-center gap-1 rounded px-0.5">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf.get(p.event.guestKey) ?? "hsl(var(--muted-foreground))" }} aria-hidden="true" />
                        <span className="truncate" dir="auto">{p.event.title || busy}</span>
                      </span>
                    ))}
                    {extra > 0 && <span className="px-0.5 text-muted-foreground">{more.replace("{n}", String(extra))}</span>}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
