# P36d — focus colour audit, CRM Lead Details (before → after)

**What was measured.** Playwright (`scratchpad/p36d/visual/qa/focus-audit.mjs`) focused every interactive control on
`/crm-app/leads/2`, using both keyboard focus (`kbd`, focus-visible) and click.
- Coverage: every tab, the Activities sub-tabs, the create forms, field edit mode and the rail pickers, in light and
  dark.
- Read: the computed `outline`, `box-shadow`, `border-color` and `background-color`.
- Data: local CRM builds (mock data), before = 0.7.0-dev.4, after = this branch.

**Source of the blue.** One source: the DS glass focus token `--c-focus: var(--c-sky)` (#25D0FE = rgb(37, 208, 254)).
It reaches controls as an `outline` through the package's glass CSS and the upstream glass engine the CRM imports.

**Fix.** In `styles/src/sf-fixes.css`, `.sf-theme { --c-focus: hsl(var(--ring)); }`:
- violet rgb(82, 33, 151) in light;
- flame rgb(254, 91, 42) in dark.

DateField, TimeField, DateTimeField, MonthInput and EditableTitle add `focus-visible:outline-none`, so they show one
ring. Focus stays visible everywhere.

## Totals

| Page | Before (blue focus stops) | After |
|---|---|---|
| Lead 2 | 223 of 490 | 0 |
| Deal 1 | 150 | 0 |
| Contact 1 | 134 | 0 |
| Organization 1 | 160 | 0 |
| Leads list | 81 | 0 |
| Deals list | 80 | 1 |

The one remaining stop on the Deals list is the "Chat with Senaiy" floating button. It is outside `.sf-theme` and
shared with Service Desk / Service Management, so it was left alone.

Integrator re-run on the dev.5 CRM build: 480 stops on Lead 2, 0 blue, 0 browser auto-outline.

## By control group (Lead 2)

| theme | control | mode | n | BEFORE outline | BEFORE ring | blue before | AFTER outline | AFTER ring | blue after |
|---|---|---|---|---|---|---|---|---|---|

| dark | DS Button (sf-button) | click | 23 | none | none | 0 | none | none | 0 |
| dark | DS Button (sf-button) | kbd | 70 | rgb(37, 208, 254) | rgb(254, 91, 42)4px | 70 | rgb(254, 91, 42) | rgb(254, 91, 42)4px | 0 |
| dark | DS field trigger button (sf-field-fill) | click | 6 | rgba(0, 0, 0, 0) | none | 0 | rgba(0, 0, 0, 0) | none | 0 |
| dark | DS field trigger button (sf-field-fill) | kbd | 10 | rgba(0, 0, 0, 0), rgb(37, 208, 254) | none, rgba(254, 91, 42, 0.6)2px | 3 | rgba(0, 0, 0, 0) | none, rgba(254, 91, 42, 0.6)2px | 0 |
| dark | Radix tab trigger | kbd | 2 | rgba(0, 0, 0, 0) | rgb(254, 91, 42)2px | 0 | rgba(0, 0, 0, 0) | rgb(254, 91, 42)2px | 0 |
| dark | div[role=button] row | kbd | 12 | rgba(0, 0, 0, 0) | rgb(254, 91, 42)2px | 0 | rgba(0, 0, 0, 0) | rgb(254, 91, 42)2px | 0 |
| dark | div[role=menu].z-50.max-h-[var(--radix-dropdown-menu-content-available-height)] | click | 13 | none | none | 0 | none | none | 0 |
| dark | plain <button> (dialog) | click | 2 | none | none | 0 | none | none | 0 |
| dark | plain <button> (main) | kbd | 29 | rgba(0, 0, 0, 0), rgb(37, 208, 254) | rgb(254, 91, 42)2px, none | 13 | rgba(0, 0, 0, 0), rgb(254, 91, 42) | rgb(254, 91, 42)2px, none | 0 |
| dark | plain <button> (other) | kbd | 1 | 3px solid rgb(255, 255, 255) | none | 0 | 3px solid rgb(255, 255, 255) | none | 0 |
| dark | plain <button> (rail) | kbd | 6 | rgb(37, 208, 254) | none | 6 | rgb(254, 91, 42) | none | 0 |
| dark | plain <button> (sidebar) | kbd | 15 | rgb(37, 208, 254) | none | 15 | rgb(254, 91, 42) | none | 0 |
| dark | popup item / listbox (popup) | click | 3 | rgb(37, 208, 254) | none | 3 | rgb(254, 91, 42) | none | 0 |
| dark | tab panel | kbd | 2 | rgba(0, 0, 0, 0) | rgb(254, 91, 42)4px | 0 | rgba(0, 0, 0, 0) | rgb(254, 91, 42)4px | 0 |
| dark | text input / textarea / combobox | click | 23 | rgba(0, 0, 0, 0) | rgb(254, 91, 42)1px, rgba(254, 91, 42, 0.6)2px | 0 | rgba(0, 0, 0, 0), rgb(254, 91, 42) | rgb(254, 91, 42)1px, rgba(254, 91, 42, 0.6)2px | 0 |
| dark | text input / textarea / combobox | kbd | 28 | rgba(0, 0, 0, 0), rgb(37, 208, 254) | rgb(254, 91, 42)1px, rgba(254, 91, 42, 0.6)2px | 1 | rgba(0, 0, 0, 0), rgb(254, 91, 42) | rgb(254, 91, 42)1px, rgba(254, 91, 42, 0.6)2px | 0 |
| light | DS Button (sf-button) | click | 22 | none | none | 0 | none | none | 0 |
| light | DS Button (sf-button) | kbd | 70 | rgb(37, 208, 254) | rgb(82, 33, 151)4px | 70 | rgb(82, 33, 151) | rgb(82, 33, 151)4px | 0 |
| light | DS field trigger button (sf-field-fill) | click | 6 | rgba(0, 0, 0, 0) | none | 0 | rgba(0, 0, 0, 0) | none | 0 |
| light | DS field trigger button (sf-field-fill) | kbd | 10 | rgba(0, 0, 0, 0), rgb(37, 208, 254) | none, rgba(82, 33, 151, 0.6)2px | 3 | rgba(0, 0, 0, 0) | none, rgba(82, 33, 151, 0.6)2px | 0 |
| light | Radix tab trigger | kbd | 2 | rgba(0, 0, 0, 0) | rgb(82, 33, 151)2px | 0 | rgba(0, 0, 0, 0) | rgb(82, 33, 151)2px | 0 |
| light | div[role=button] row | kbd | 12 | rgba(0, 0, 0, 0) | rgb(82, 33, 151)2px | 0 | rgba(0, 0, 0, 0) | rgb(82, 33, 151)2px | 0 |
| light | div[role=menu].z-50.max-h-[var(--radix-dropdown-menu-content-available-height)] | click | 13 | none | none | 0 | none | none | 0 |
| light | plain <button> (dialog) | click | 2 | none | none | 0 | none | none | 0 |
| light | plain <button> (main) | kbd | 29 | rgba(0, 0, 0, 0), rgb(37, 208, 254) | rgb(82, 33, 151)2px, none | 13 | rgba(0, 0, 0, 0), rgb(82, 33, 151) | rgb(82, 33, 151)2px, none | 0 |
| light | plain <button> (other) | kbd | 1 | rgb(28, 106, 133) | none | 1 | 3px solid rgb(21, 21, 30) | none | 0 |
| light | plain <button> (rail) | kbd | 6 | rgb(37, 208, 254) | none | 6 | rgb(82, 33, 151) | none | 0 |
| light | plain <button> (sidebar) | kbd | 15 | rgb(37, 208, 254) | none | 15 | rgb(82, 33, 151) | none | 0 |
| light | popup item / listbox (popup) | click | 3 | rgb(37, 208, 254) | none | 3 | rgb(82, 33, 151) | none | 0 |
| light | tab panel | kbd | 2 | rgba(0, 0, 0, 0) | rgb(82, 33, 151)4px | 0 | rgba(0, 0, 0, 0) | rgb(82, 33, 151)4px | 0 |
| light | text input / textarea / combobox | click | 24 | rgba(0, 0, 0, 0), rgb(82, 33, 151) | rgb(82, 33, 151)1px, rgba(82, 33, 151, 0.6)2px | 0 | rgba(0, 0, 0, 0), rgb(82, 33, 151) | rgb(82, 33, 151)1px, rgba(82, 33, 151, 0.6)2px | 0 |
| light | text input / textarea / combobox | kbd | 28 | rgba(0, 0, 0, 0), rgb(37, 208, 254) | rgb(82, 33, 151)1px, rgba(82, 33, 151, 0.6)2px | 1 | rgba(0, 0, 0, 0), rgb(82, 33, 151) | rgb(82, 33, 151)1px, rgba(82, 33, 151, 0.6)2px | 0 |

## Evidence files

All paths are absolute (scratchpad):
- Per-control table: `/tmp/claude-1000/-home-frappe-lovable-bench/dd04d141-f975-4eb5-beb5-0ff7b8dc907a/scratchpad/p36d/visual/focus-table.md`
- Other pages' tables: `/tmp/claude-1000/-home-frappe-lovable-bench/dd04d141-f975-4eb5-beb5-0ff7b8dc907a/scratchpad/p36d/visual/other/`
- Screenshots: `/tmp/claude-1000/-home-frappe-lovable-bench/dd04d141-f975-4eb5-beb5-0ff7b8dc907a/scratchpad/p36d/visual/shots-before/`
  and `.../shots-after/`, 24 each (en + ar × light + dark × 1440 + 390; About, Tasks, Tasks with Add open)
