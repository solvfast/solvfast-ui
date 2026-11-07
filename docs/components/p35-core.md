# P35 core — generic capabilities from the CRM audit

The CRM audit (`docs/audit/p35/D-crm.md` (repository only) §3c) listed capabilities the CRM implements itself because the Design System lacked
them. This page documents the **Core** (Frappe-free, `@solvfast/ui`) versions added in P35. Everything is **additive and
optional**: without the new props the components render exactly as in 0.6.0. All new chrome strings are in
`src/theme/messages-ws/core.ts` (keys `core…`, English and Arabic) and can be overridden per key through
`<ThemeProvider messages>`.

Tests: `tests/core-p35.test.tsx` (names `CORE.<gap>`). Showcase: Components → *Field controls*, *File dropzone*,
*Multi-select & grouped search*; Data display → *Empty state & stat trend*; Patterns → *Record status, lifecycle & feed*,
*Editor inserts & stepper overflow*, *Like & assign dialog*.

| Gap | Component | New API |
|---|---|---|
| P34 follow-up (D-crm A18) | `AssigneeGroup` | `variant="list"` shows `Assignee.description` under the name |
| G17 | `StatusBadge`, `StatusDot` | `color?: string` (CSS colour or palette token); `STATUS_PALETTE`, `resolveStatusColor`, `statusColorStyles` |
| G7 | `LifecycleBar` | `LifecycleStateItem.step?: "past" \| "current" \| "future" \| "skipped" \| "failed"`; type `LifecycleStep` |
| G14 | `FileDropzone` (new) | click / keyboard / drag-drop, `accept`, `maxSize`, `maxFiles`, `multiple`, messages, list + remove; `fileMatchesAccept`, `validateFiles`, `formatFileSize` |
| G16 | `SearchCombobox` | `options`, `multiple`, `values`, `onValuesChange`, `variant="field"`, `disabled`, `invalid`; `search` / `onSelect` now optional |
| G13 | `Timeline` | renders `TimelineItem.icon`; `TimelineItem.tone`; `onItemSelect(item, event)`; `showActor` |
| G11 | `LinkInput` / `TagInput` (`Suggestion`) | `Suggestion.group`, `Suggestion.icon` |
| G23 | `IconStatCard` | `trend?: { value, direction } \| ReactNode` |
| N10 | `EmptyState` (new) | icon, title, description, action, `size`, `variant`, `headingLevel` |
| G15 | `RichTextEditor` | `ref` → `RichTextEditorHandle` (`insertText`, `insertHtml`, `getHtml`, `focus`); `toolbarEnd` |
| G20 | `MonthInput` (new) | `"YYYY-MM"` month field; `parseMonthValue`, `toMonthValue`, `formatMonthValue` |
| N8 | `Stepper` | `overflowCue`, `followCurrent` |

---

## AssigneeGroup — role / details line (P34 follow-up)

```tsx
<AssigneeGroup variant="list" assignees={[{ id: "rana", name: "Rana Haddad", description: "Account Executive" }]} searchUsers={search} />
```

Like Desk's sidebar assignment list, the list variant renders `description` (the owner's role, or a ToDo's date · priority ·
comment) as a second, muted line under the name (truncated; the full text stays in the row's `title`). A row without a
description is the 0.6.0 row. The `avatars` variant is unchanged.

## StatusBadge / StatusDot — configured colour (G17)

```tsx
<StatusBadge label="Negotiation" color="#f59e0b" />          // any CSS colour
<StatusBadge label="Qualified" color="violet" />              // a palette token (theme variable)
<StatusBadge label="Open" variant="dot" color="#0ea5e9" />    // dot only; the label keeps the foreground colour
<StatusDot label="Lost" color="#ef4444" />
```

- `color` overrides the tone's colour; `tone` still sets `data-tone` (and is the fallback when `color` is empty). The
  resolved colour is on `data-color`.
- Palette tokens (`STATUS_PALETTE`): `brand`/`primary`, `neutral`/`gray`, `success`/`green`, `warning`/`amber`, `info`,
  `danger`/`destructive`/`red`, `violet`/`purple`, `teal`, `sky`, `cyan`, `flame`, `orange`, `midnight`, `forest` — they map
  to the theme's HSL variables, so they follow light / dark. Any other string is used as a CSS colour.
- Contrast: the dot is the colour itself; the pill's fill is the colour at 15 %; the pill's **text** is
  `color-mix(in oklab, <colour> 55%, hsl(var(--foreground)))` — darker than the colour on light themes and lighter on dark
  ones, so a configured yellow or navy stays readable (not measured against WCAG for every colour). Pure CSS: it follows the
  nearest `.dark` scope, no build step, no theme lookup in JS.
- The label is always shown: colour is never the only carrier.
- **ListView status columns (P35 integration):** `ColumnDef.status = { color?(value, row), tone?(value, row), variant? }` makes
  the default cell a `StatusBadge` with the row's configured colour / tone (a custom `render` still wins; empty values keep "—").
  Without `status` the 0.6.0 Select badge is rendered. `DefaultCell` takes an optional `row` for it.

## LifecycleBar — per-step state (G7)

```tsx
<LifecycleBar current="lost" states={[
  { id: "new", label: "New", step: "past" },
  { id: "proposal", label: "Proposal", step: "past" },
  { id: "won", label: "Won", step: "skipped" },
  { id: "lost", label: "Lost", step: "failed", by: "Omar", at },
]} />
```

- A state's `step` overrides its position (before `current` = past, after = future). States without `step` keep the
  positional value, so callers can set only the exceptions.
- `skipped`: dashed circle with a dash, struck-through muted label, screen-reader suffix "Skipped" / "تم تخطّيها".
- `failed`: destructive circle with an X, destructive label, suffix "Failed" / "فشلت"; its `by` / `at` line shows like a past
  state's. When the failed state is the `current` one it also carries `aria-current="step"` and the current marker, and the
  badge uses the `danger` tone unless the state has its own `tone`.
- `data-step` on each `<li>` reports the resolved step.

## FileDropzone (G14)

```tsx
<FileDropzone multiple accept=".pdf,image/*" maxSize={2 * 1024 * 1024} maxFiles={3}
  value={files} onChange={setFiles} onFilesAdded={(added) => upload(added)} onReject={(r) => log(r)} />
```

| Prop | Type | Notes |
|---|---|---|
| `value` / `onChange` | `File[]` / `(files) => void` | Controlled list; omit `value` to let the zone keep its own. |
| `onFilesAdded` | `(files: File[]) => void` | Only the files accepted from one pick / drop — start the upload here. |
| `onReject` | `(r: FileRejection[]) => void` | `{ file, reason: "type" \| "size" \| "count", message }`. |
| `accept` | `string` | `<input accept>` syntax: extensions, MIME types, `type/*`. |
| `multiple` / `maxFiles` | `boolean` / `number` | Without `multiple` a new pick replaces the file; a multi-drop takes the first. |
| `maxSize` | `number` (bytes) | |
| `showList` / `preview` / `compact` | `boolean` | Hide the list (render your own with progress); image thumbnails (object URLs, revoked on unmount); one-line zone. |
| `labels` | `{ prompt, dropActive, remove, list }` | `remove` takes `{name}`. |
| `disabled` / `invalid` / `id` / `aria-*` | | No `name`: the files never travel with a native form post — hand them to your upload. |

Behaviour: the zone is a focusable `role="button"`; click, Enter or Space open the browser's file dialog; dragging over it
highlights it (`data-dragging`). The same file (name + size + lastModified) is never added twice. Refused files get one
message each in a `role="alert"` list under the zone (cleared by the next pick or a remove). The chosen files are a list
(name, size in the language's digits, thumbnail, remove button "Remove {name}"). **It never uploads.** Helpers:
`fileMatchesAccept(file, accept)`, `validateFiles(picked, current, rules)`, `formatFileSize(bytes, language)`.
For a Frappe Attach field keep `FrappeAttachField` (`@solvfast/ui/frappe`).

## SearchCombobox — static options, multiple, field look (G16)

```tsx
<SearchCombobox options={types} multiple values={v} onValuesChange={setV} variant="field"
  placeholder="Record types" searchPlaceholder="Filter…" emptyText="No match" />
<SearchCombobox options={types} value={one} onSelect={setOne} placeholder="…" searchPlaceholder="…" emptyText="…" />
```

- `options`: a fixed list, filtered client-side on label / description / value as you type; nothing loads. With `search`
  it is the 0.6.0 async combobox (debounce, stale responses dropped) and `options` is ignored.
- `multiple`: each pick toggles a value through `onValuesChange`; the list stays open; options carry `aria-checked` and the
  list `aria-multiselectable`. The trigger shows up to two labels, then "{n} selected" / "{n} محدّدة".
- With static options the single trigger shows the option's **label** (0.6.0 async mode still shows the raw value).
- `variant="field"`: the input look of the field controls (`sf-field-fill`, h-9). Also `disabled`, `invalid`,
  `className`, `aria-label`, `aria-labelledby`.
- Keyboard: cmdk's model — arrows move, Enter picks / toggles, Escape closes.

## Timeline — icons, tone, actor, select (G13)

```tsx
<Timeline items={[{ id, kind: "communication", at, actor: "Rana", summary: "sent the proposal", icon: <Mail />, tone: "info" }]}
  showActor onItemSelect={(item, e) => { e.preventDefault(); openActivity(item); }} />
```

- `TimelineItem.icon` (already in the type, never rendered before) replaces the per-kind icon; an `<svg>` child is sized to
  14 px. `TimelineItem.tone` tints the icon (default muted; comments primary).
- `onItemSelect`: non-comment summaries become `<button>`s (keyboard reachable); an entry with `href` stays a link and calls
  `onItemSelect` first (call `preventDefault()` to navigate yourself). Comments keep their edit / delete controls.
- With `onItemSelect`, a change entry's expand toggle is named "<summary> — show changes" so it differs from the select button.
- `showActor`: the actor's name (`<bdi>`, RTL-safe) before non-comment summaries — for summaries that do not already name
  the actor (Frappe's do).

## LinkInput / TagInput — suggestion groups and icons (G11)

`Suggestion` gains `group?: string` and `icon?: ReactNode`. Consecutive results with the same `group` are listed under one
heading inside a `role="group"` (labelled by the heading); results without a group are listed without one. **Order your
results by group.** The keyboard order stays flat (ArrowDown moves across groups). `icon` (an icon or avatar, ~16–20 px)
leads the option. Without either field the list is the 0.6.0 markup.

**TagInput after creating a tag (P35 integration, CRM M7):** Enter (or a trailing comma) that creates a tag from the typed text
now also closes the suggestion list — the "No results" list no longer stays open over what is below (e.g. a popover's Apply).

## IconStatCard — trend (G23)

```tsx
<IconStatCard label="Open deals" value={128} icon={Briefcase} trend={{ value: "+12%", direction: "up" }} />
<IconStatCard label="Contacts" value={1290} trend={<span>vs last week</span>} />
```

`{ value, direction }` renders StatCard's pill (green up / red down, dark-mode variants) beside the total with a
screen-reader "Up" / "Down" ("ارتفاع" / "انخفاض"); any other node renders as given. Without `trend` the card is unchanged.

## EmptyState (D-crm N10)

```tsx
<EmptyState icon={Users} title={{ en: "No contacts yet", ar: "لا جهات اتصال بعد" }} description="Add the first one."
  action={<Button size="sm">New contact</Button>} />
<EmptyState size="sm" icon={FileText} title="No attachments" />   // rail cards
```

`title` / `description`: a string, `{ en, ar }` or an element. `icon`: a lucide-style component, a node, or `null` (default
Inbox). `size`: `"md"` (panels, pages) or `"sm"` (rail cards, text-xs). `variant`: `"dashed"` (default box) or `"plain"`
(inside a card). `headingLevel` renders the title as `h2`–`h4`. `ListView` keeps its own empty rows.

## RichTextEditor — insert API and toolbar slot (G15)

```tsx
const ref = React.useRef<RichTextEditorHandle>(null);
<RichTextEditor ref={ref} value={html} onChange={setHtml}
  toolbarEnd={<Button size="xs" onMouseDown={(e) => e.preventDefault()} onClick={() => ref.current?.insertHtml(template)}>Template</Button>} />
```

`RichTextEditorHandle`: `insertText(text)`, `insertHtml(html)` (sanitized with the editor's allowlist), `getHtml()`,
`focus()`. Inserts go to the last caret inside the editor (kept when focus moves to a toolbar control), or at the end when
the editor never had one, then `onChange` fires with the sanitized HTML. `toolbarEnd` renders at the end of the toolbar
(`ms-auto`, RTL-aware). The component is now a `forwardRef`; its props are unchanged.

## MonthInput (G20)

```tsx
<MonthInput value={month} onChange={setMonth} min="2026-01" max="2027-12" />   // "YYYY-MM" | null
```

The field look of `DateField`; a popover with the year (previous / next) and a 3 × 4 month grid (`aria-pressed` on the
chosen month, full month name as each button's name). Keyboard: Left / Right ±1 month (mirrored in RTL), Up / Down ±3,
PageUp / PageDown ±1 year, Home / End, Enter / Space pick, Escape closes. `min` / `max` disable months outside; `clearable`
(default) shows ×. On open the roving focus starts on the chosen month (else today), clamped into `min` / `max`. Helpers: `parseMonthValue`, `toMonthValue`, `formatMonthValue(value, language)` ("March 2026" /
"مارس ٢٠٢٦").

## Stepper — overflow cue (D-crm N8)

```tsx
<Stepper ariaLabel="Proposal" steps={steps} onJump={setAt} overflowCue followCurrent />
```

`overflowCue`: when the strip scrolls sideways, each side with hidden steps gets a fade and a chevron that scrolls by a page
(mouse aid: `aria-hidden`, not focusable); the strip itself becomes focusable (`tabIndex=0`) so the keyboard can scroll it.
RTL-aware (negative `scrollLeft`). Put outer spacing on a parent (the cue overlays the strip's box). `followCurrent`
scrolls the strip — never the page — so the current step is centred whenever it changes.

---

## Not done here (see the workstream report)

- G17 for `ListView` status cells (`src/list/**`, another workstream) — they can pass `color` to `StatusBadge` once wired.
- `FileDropzone` per-file upload progress / error rows (hosts use `showList={false}` and render their own for now).
- `SearchCombobox` grouped static options; select-all / clear-all in multiple mode.
