# SchedulingCalendar — several people's events on one grid, and a new meeting's time picked on it

A meeting form shows, under its Guests field, every selected guest's events on one shared grid; the user picks the
meeting's time on that grid. `SchedulingCalendar` is that panel. It is generic: it draws what it is given and reports
the slot the user picks. The parent owns the proposal, so the form's start / end fields and the grid stay in sync both
ways.

| Layer | What | Entry |
|---|---|---|
| Core (`src/calendar/`) | `SchedulingCalendar`; slot helpers `toLocalDate`, `slotFromDrag`, `moveSlot`, `resizeSlot`, `shiftSlot`, `slotOnDay` | `@solvfast/ui` |

**Status:** *Implemented* and *tested in jsdom* (`tests/scheduling-calendar.test.tsx`, 14 tests, en + ar). Not yet
checked in a real browser or on a touch device. Frappe-free: the app fetches the guests' events itself.

---

## 1. Use

```tsx
import { SchedulingCalendar, type ScheduleSlot } from "@solvfast/ui";

const [slot, setSlot] = React.useState<ScheduleSlot | null>(null);

<SchedulingCalendar
  guests={[{ key: "amal@x.com", label: "Amal", color: "#2563eb" }, { key: "badr@x.com", label: "Badr", color: "#16a34a" }]}
  events={[
    { id: "EV-1", guestKey: "amal@x.com", start: "2026-11-20 09:00:00", end: "2026-11-20 10:00:00", title: "Standup" },
    { id: "EV-2", guestKey: "badr@x.com", start: "2026-11-20 09:30:00", end: "2026-11-20 11:00:00" }, // no title → "Busy"
  ]}
  proposal={slot}
  onProposalChange={(s) => { setSlot(s); form.setValue("starts_on", s.start); form.setValue("ends_on", s.end); }}
/>
```

When the form's own date fields change, pass the new slot as `proposal`: if its day is not shown, the calendar shows it.

## 2. Props

```ts
interface ScheduleGuest { key: string; label: string; color: string }   // legend entry + the colour of its events
interface ScheduleEvent { id: string; guestKey: string; start: Date | string; end: Date | string; title?: string | null }
interface ScheduleSlot { start: Date; end: Date }
type ScheduleView = "day" | "week" | "month";
```

| Prop | Default | Meaning |
|---|---|---|
| `guests` | — | Legend entries, in order. An event whose `guestKey` is not listed is drawn in the muted colour. |
| `events` | — | Every guest's events. Strings are local time: `"2026-11-20 10:00:00"`, `"2026-11-20T10:00"`, `"2026-11-20"`; a string with `Z` or an offset is an instant. No `title` → the localized "Busy". An event without a valid end lasts 30 minutes. |
| `proposal` | — | The meeting being scheduled (or `null`). Drawn on top: primary colour, dashed outline (solid while dragged). |
| `onProposalChange(slot)` | — | The only way the calendar changes the proposal. |
| `view` / `defaultView` / `onViewChange` | `"week"` | Day, Week or Month. |
| `date` / `onDateChange` | the proposal's day, else today | The focused day (any day of the shown week / month). |
| `workingHours` | `{ start: 8, end: 18 }` | Whole hours; `end` exclusive. |
| `workingHoursOnly` / `defaultWorkingHoursOnly` / `onWorkingHoursOnlyChange` | `true` | On: only the working hours' rows. Off: the whole day, scrolled to the working hours' start. |
| `slotMinutes` | `30` | Snap for clicks, drags, moves, resizes and arrow keys. |
| `height` / `defaultHeight` / `onHeightChange` | `420` | The grid area's height in px (toolbar and legend excluded), kept within `minHeight`…`maxHeight`. Store it to remember the user's size. |
| `minHeight` / `maxHeight` | `260` / `900` | The resize handle's limits. |
| `weekStartsOn` | `0` (Sunday) | 0 = Sunday … 6 = Saturday. |
| `loading` | — | A thin bar over the grid and `aria-busy`; the grid stays usable. |
| `labels` | the theme's messages | Override any text: `today`, `previous`, `next`, `day`, `week`, `month`, `view`, `workingHoursOnly`, `busy`, `more` (`"+{n} more"`), `legend`, `proposal`, `proposalHint`, `resizeProposal`, `resizePanel`, `grid`. |
| `className` | — | On the outer element. |

## 3. Behaviour

- **Toolbar:** Today, previous / next (arrows mirror in RTL), the shown range (localized: `ar` uses Arabic month and
  day names with Latin digits), Day | Week | Month, and the "Working hours only" switch (Day and Week).
- **Day / Week:** a time grid, hours down the side and a column per day. Every guest's events are on the same grid in
  their guest's colour; overlapping events sit side by side; an event crossing midnight is drawn on each day it covers.
  A day header in Week view opens that day.
- **Picking a time** (all snap to `slotMinutes`; each calls `onProposalChange` once, on release):
  - click an empty slot (or an event) → that slot, lasting the current proposal's duration (30 minutes when none);
  - drag across slots → that range;
  - drag the proposal → moved, same duration (in Week view, onto another day too);
  - drag its bottom edge → new end, never shorter than one slot.
  - With "Working hours only" on, a move or an arrow key keeps the proposal within the shown hours.
- **Month:** each day lists its events as coloured chips (three, then "+N more"); the proposal's day is outlined.
  Clicking a day moves the proposal to it, keeping its times (09:00–09:30 when there is none), and opens Day view.
- **Legend** under the grid; a **drag handle** under it resizes the panel.

## 4. Keyboard, pointer, accessibility

- Toolbar controls are buttons, a radio group (Day / Week / Month) and a switch, all labelled.
- The proposal is focusable (`role="button"`, label "New meeting, 10:00 AM – 11:00 AM"): ↑ / ↓ move it one slot,
  Shift+↑ / ↓ change its end by one slot, ← / → move it a day (mirrored in RTL). Focus stays on it.
- The height handle is a `separator` with `aria-valuenow`: ↑ / ↓ by 20 px, Home / End to the minimum / maximum.
- Pointer events, so mouse, pen and touch work. On touch, a drag on the empty grid scrolls it (a tap proposes a slot);
  the proposal and the handles take the drag (`touch-action: none`).
- Colours: events tint their guest's colour over the card surface, so light and dark themes both work; text stays the
  theme's foreground.

## 5. Limits

- No all-day lane: an event given as a date only starts at 00:00 (send times, or an end on a later day, for whole days).
- A drag that creates or resizes stays in the day it started on; only a move changes day.
- A proposal set from outside that lies outside the working hours is not drawn while "Working hours only" is on (turn it
  off to see it).
- The proposal is drawn on its start day only (a meeting past midnight is cut at 24:00).
