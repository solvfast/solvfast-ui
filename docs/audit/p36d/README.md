# P36d — CRM Lead Details audit + Frappe field parity (0.7.0-dev.5)

The owner used the CRM Lead Details page (`/crm-app/leads/<id>`) as the first reference page for a DS / Frappe parity
audit. Principle: native Frappe behaviour + Solvfast DS visual language.

Evidence is jsdom tests, the in-package SIMULATOR and Playwright runs on local CRM builds (mock data and
`VITE_CRM_ALLOW_SIMULATED` builds). **Nothing was validated on a real Frappe site.** The live CRM pins 0.6.0 and runs in
mock mode, so it sees none of this until the owner moves the pin and deploys.

## Branches

| Repository | Integration branch | Workstream branches (base) |
|---|---|---|
| package | `feat/0.7.x/p36d-int` | `p36d-visual`, `p36d-history`, `p36d-fields`, `p36d-fieldtypes`, `p36d-linkinput` (from `feat/0.7.x/p36-int` 0.7.0-dev.4) |
| CRM | `crm/p36d-int` | `crm/p36d-visual`, `crm/p36d-history`, `crm/p36d-fields`, `crm/p36d-attach` (from `crm/p36b-070`) |

## Records

| File | What |
|---|---|
| `LEAD-FIELDS.md` | Every Lead Details field in mock and simulated mode against the native control (file:line), fixes with their level, remaining gaps |
| `FIELD-TYPES.md` | The Frappe 15.110 field-type inventory (43 DocField types + Long Int + Page Break + 6 Data options), DS coverage, strategy and plan |
| `docs/components/frappe-field-types.md` | Consumer guide |
| `FRAPPEFIELD-TRACE.md` | P36e: source trace of FrappeField (locations, call chains, public API, no-server behaviour), 43-type re-grade, file map |
| `docs/components/record.md` §7 | Record Detail history (Timeline / FrappeTimeline) |
| `docs/components/forms.md` (LinkInput) | The new LinkInput defaults |

Workstream reports with full detail (scratchpad): `p36d/ws/{visual,history,fields,fieldtypes}.md`.

## Owner items → outcome

1. **Header glass**, 2. **Senaiy summary**, 3. **Lead Health / Recent Interactions** (CRM, DS scope only).
   - Brand wash, gradients, coloured borders and tinted fills removed. These cards now use the same glass card as the
     page's Lead Profile and rail cards.
   - Deal, Contact and Organization share the pattern and received the same change.
   - Legacy routes are unchanged.
4. **Blue / cyan focus**. Audit first: 223 of 490 focus stops on the Lead page were Sky cyan (#25D0FE).
   - Source: the DS glass focus token `--c-focus: var(--c-sky)`, reaching controls through the package glass CSS and the
     upstream glass engine.
   - Fix at the source: inside `.sf-theme`, `--c-focus` is the theme ring (violet in light, flame in dark), and five
     field triggers show one ring.
   - After: 0 of 480 on the Lead page, and 0 on the Deal, Contact, Organization and Leads pages. One remains on the
     Deals list: the "Chat with Senaiy" button, outside `.sf-theme` and shared with SD / SM, left alone.
   - Focus stays visible everywhere.
5. **History**: the tab already used the DS timeline in both modes (`Timeline` over the CRM history store in mock mode,
   `FrappeTimeline` over `get_docinfo` on Frappe data). The gaps against Desk were closed in the package (record.md §7).
   No new timeline.
6. **Add Task card**: the solid `bg-background` of the embedded New Task form was removed inside the DS scope. Task
   creation is unchanged.
7. **Attach**.
   - Frappe data: the package `FrappeAttachments` (docinfo list, `upload_file`, `remove_attach`, server limits and
     permissions). The simulated CRM transport is wrapped with `withSimulatedSidebar` so uploads are stored.
   - Mock mode: **no Add attachment** inside the DS scope (owner decision; nothing could persist). Legacy routes keep
     their form.
8. **Lead fields**: see LEAD-FIELDS.md.
   - Package: Data options as in Desk (text input, Desk patterns), Link maxlength and title, numeric select-on-focus.
   - CRM, DS scope: editors follow the DRAFT meta, i.e. Link inputs, a clearable Select, Data maxlength with the
     Email / Phone check, a Currency number input, a Small Text textarea, and save checks.
9. **Field Types section**: inventory, plan, consumer guide and a Showcase group of four pages.

Owner clarifications applied in the same batch:
- P36c item 6: Assign To User Group replaces the user list, as Desk does (`P36C.usergroup.1` asserts a prior
  non-member is dropped).
- P36c item 7: LinkInput defaults (scroll into view, IME guard, Escape restores).
- Attach hidden in mock mode.

## Integrator gates (0.7.0-dev.5)

**Package** (`feat/0.7.x/p36d-int`):

| Check | Result |
|---|---|
| typecheck | OK |
| vitest | 90 files, 1736 passed, 10 todo, 0 failed |
| build + pack | OK; 909 files; `styles/*` restored |
| boundaries | OK |
| check:package | OK |
| showcase:build | OK |
| showcase smoke | 85 sections × 4 combinations + browsing + interactions + phone: PASS |
| consumers a / b | tsc + build OK |
| exports vs 0.7.0-dev.4 | 0 removed; added: core `TimelineEntry`, `TimelineItemExtras`, `TimelineTimeFormat`, `absoluteTime`, `deskRelativeTime`; frappe `deliveryStatusTone`, `splitEmails` |
| validation matrix | current; 96 real-site tests prepared (+F-FIELD-1 data-option / non-negative refusals, +F-FIELD-2 get_link_title), none run |

**CRM** (`crm/p36d-int` against the local dev.5 pack; mock data / in-browser simulator):

| Check | Result |
|---|---|
| tsc / builds | tsc 30 errors (= baseline); mock build OK; simulated build OK |
| route sweep | 82 loads, 0 console errors (the 2 known proposal-wizard notes) |
| suites | mock flows 16/0; records-assign 111/0; 28 lists 112/112; legacy 56/0; p35 376/0; p36 336/0; p36-legacy 10/0 |
| interaction checks | LinkInput 1448/0; Global Search 188/0; lifecycle labels PASS; tags + assign en / ar 43/43; actions en / ar 22/22 |
| Attach (P36d) | mock 49/0 (no add, legacy form kept); simulated 56/0 (upload_file with doctype / docname, docinfo list, remove_attach) |
| History (P36d) | mock 8/8, simulated 8/8 (add with @mention, edit, publish in simulated mode, filter, delete; Desk times; RTL); 0 console errors |
| Lead field probe (P36d) | 16 combinations, 0 errors (interaction checks in en; ar = render / attribute checks) |
| Focus audit (P36d) | Lead page: 480 focus stops, 0 blue, 0 browser auto-outline |
| SD / SM outside shots vs v073f | 170 identical; 2 differ by 2–3 px (known noise) |

## Remaining gaps / owner decisions

- **Simulator save.** It has no `_validate_data_fields`, non-negative or length checks, so in simulated mode an
  invalid email or phone, or a negative revenue, still saves. The CRM mock store refuses them; a real server would too.
- **Header rename.** It splits on whitespace, so a one-word name leaves `last_name` empty. In simulated mode it writes
  the mock store while a Frappe document is shown.
- **Fields missing or mislabelled on the page.**
  - Priority (in the meta) is not on the page.
  - The "Phone" row's meta label is "Mobile".
  - Revenue shows 0 decimals; Desk shows 2.
  - In simulated mode, Lead Source shows raw keys and Lead Type shows `leadtype_2`: the simulator has no CRM Type data.
- **Mock editors.** Replacing every mock-mode editor with `FrappeField` when no Frappe document exists is an owner
  decision (not done).
- **Light-mode glass.** In light mode `sf-fixes.css` makes every `.sf-glass-pane` opaque white (also DS Card, StatCard,
  Navbar). Narrowing it is an owner decision.
- **Dark-mode visuals.** The "Outbound" lead-type chip has very low contrast (pre-existing), and the Activities date
  strip is a solid band.
- **History.**
  - Not reproduced: the "commented" verb, user / Version links, e-mail medium icons, Reply / Reply All, New Email /
    New Event, energy points.
  - `useCommunications` "Load more" does not count automated messages.
  - The simulated Lead history starts nearly empty: the fixture backend seeds no comments, versions or e-mails.
- **Field types.** 4 DocField types are missing (Signature, Barcode, Geolocation, Icon) and 17 are partial; see the
  FIELD-TYPES.md plan.
- **Real-site validation.** Still blocked: no isolated staging site, accounts or approval file.
