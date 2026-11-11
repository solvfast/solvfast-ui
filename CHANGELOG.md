# Changelog — @solvfast/ui

Versioning: SemVer 0.x — patch = no API or visual change; minor = additive or intentional visual change;
breaking changes bump the minor while in 0.x and are labelled **BREAKING**. Tags are created only on a clean tree,
with the owner's approval. Releases are published by the owner (GitHub Packages, `@solvfast` org).

## [Unreleased]

## 0.7.0-dev.14 — SayrNewRecordPage: a new record laid out like the record page

Additive. jsdom tests only; the record page (dev.13) was checked on a real site.

- `@solvfast/ui/sayr`: `SayrNewRecordPage` — Back and Create on top, a header card (title, Not Saved, who and today)
  holding the type picker, the type's tabs as a full-width bar, and a rail that previews the chosen type through Sayr's
  `sear_product.apis.tickets.tickets.type_preview`: the lifecycle and its first status, the SLA policy with its targets
  per priority, the assignment profiles; Playbook, Tasks, Pinned Notes and Attachments say they come after the record is
  created. "Customize sections" as on the record page (same storage key). Exports `TYPE_PREVIEW_METHOD`, `TypePreviewData`.
- `FrappeNewFamilyRecord`: `layout: "record"`, `aside(type)`, `backLabel`, label `title` (default "New record").
- Core `RecordHeaderCard` (+ `RecordHeaderCardProps`, `RecordHeaderFact`): the record page's header card; SayrRecordPage
  now uses it.
- SayrRecordPage: Pinned Notes says "No notes yet" when empty; the next actions follow the server's list (no write gate);
  the header and cards are read again when the record's `modified` changes (a save or a toolbar workflow action).
- Messages: `rpNoNotes`, `rpChooseTypePreview`, `rpAfterCreate`, `rpStartsIn`, `rpStatusesCount`,
  `rpNoAssignmentProfile`, `rpPr…`; `famNewRecord`.

## 0.7.0-dev.13 — SayrRecordPage: a record opened as a page

Additive. jsdom tests only; checked on a real site (servefast-dev) before vendoring.

- `@solvfast/ui/sayr`: `SayrRecordPage` — header card (title, name, status, creator's name, created on, type chip),
  the record's own tabs as a full-width bar, and a rail: Lifecycle (current status, next actions that run
  `execute_transition`, "View full lifecycle" to the builder), Assignment, SLA (read only), Playbook, Tasks (scroll past
  five), Pinned Notes (comments), Attachments, Created by / Last edited by; "Customize sections" per DocType
  (localStorage). Reads `sear_product.apis.tickets.tickets.record_page` (needs Sayr with that endpoint). Also exports
  `RECORD_RAIL_CARDS`, `RECORD_PAGE_METHOD`, `TRANSITION_METHOD`, `defaultLifecycleHref`.
- `@solvfast/ui/frappe`: `useRefreshDoc()` — read a document and its docinfo again after an outside change.
- `FrappeFormView` / `FrappeForm`: `header` (shown under the toolbar instead of its title block), `toolbarStart`, and
  `tabBar: "record"` (full-width tabs).
- `LifecycleRail`: `onSelectNext` makes the next options buttons.
- `AssignDialog`: `threePriorities` (Low / Medium / High only, Medium preselected). `FrappeAssignTo`: `comment` (the
  dialog's Comment instead of the title field) and `threePriorities`.
- Messages: the `rp…` block.

## 0.7.0-dev.12 — Families: the field set picker is a searchable link field

jsdom tests only. Deploy a field set: the published sets are a `SearchCombobox` (description and field count under
each) instead of a list of cards. `INSPECTED_PROPERTIES` no longer lists `collapsible` (a Section Break's, not a field's).
Messages `fdChooseSetShort`, `fdSearchSets`, `fdNoMatchingSets`, `fdFieldsCount`; `fdOtherSet` removed.

## 0.7.0-dev.11 — Families: fields added on a type's form, one Save

jsdom tests only; no real-site run. **BREAKING** for `FieldDesigner` hosts: fields are removed from the properties
panel (no Remove button on the cards), the Add fields dialog is now the "Deploy a field set" panel, and
`context.wizard.onChange` no longer saves on its own.

**The Form section** — docs/components/family.md §7, §8, §11
- `FieldDesigner`: a canvas with a properties panel beside it. Add field (per column) from the adapter's field types,
  edited in the new `FieldInspector` with every property a field set's field has; Add section / Add tab (Add step);
  Deploy a field set in the panel. `onPendingChange` hands its changes to a host's Save (no Save form button then).
- New adapter methods (optional): `makeSection`, `fieldTypes`, `linkTargets`, `linkTargetFields`. `DesignerItem`
  gains `own` and `definition`. New core exports: `FieldInspector`, `INSPECTED_PROPERTIES`, `designerKeys`,
  `FieldDefinition`, `FieldTypeRegistry` (+ related types); `src/record` adds `keyFromLabel`, `deriveKey`, `ownKeys`,
  `retype`, `definitionProblem`.
- `@solvfast/ui/sayr`: the form's own fields live in the deployment's `own_fields` (needs Sayr with that table);
  rows are anchored by tokens (`@own::<key>`, `@section::<label>` added); `definitionOfRow` / `rowOfDefinition`.
- `FrappeTypeForm`: `context.onPendingChange`; Wizard mode is set on the type and saved with it.
- `FrappeFormView` / `FrappeForm`: `alsoSave: { dirty, save }` — outside changes that count as unsaved and are
  saved after the document (alone when only they changed).
- Messages: the `fd…` block rewritten; new `fi…` block (the inspector).

## 0.7.0-dev.10 — Families: the Appearance section

Additive. jsdom tests only; no real-site run.

- Core `IconColorPicker` (+ `APPEARANCE_ICONS`, `APPEARANCE_ICON_NAMES`, `APPEARANCE_COLORS`): Sayr Studio's icon +
  colour picker with a preview; icons imported by name. Messages `icIcon`, `icColor`, `icNoIcon`, `icNoIconSelected`,
  `icPreview`.
- `FrappeTypeForm` draws the icon field with it (`appearancePicker`, default on); the colour field and
  `appearance_column` leave the form.
- `FrappeFormView` / `FrappeForm` `renderField(df, {value, doc, setValue})`.

## 0.7.0-dev.9 — Families: Wizard mode and a new type's defaults

Additive. jsdom tests only; no real-site run.

**Wizard mode** — docs/components/family.md §9
- `FamilyType.wizard` (registry `wizardField`, default `wizard_mode`); `FrappeNewFamilyRecord` walks a wizard type's tabs
  as steps (`Stepper`, Back / Next, Create on the last step).
- `FrappeTypeForm` `designer(typeDoctype, context)`: `context.wizard = { on, onChange }`, saved with
  `frappe.client.set_value`; the field is kept off the type's form. `FieldDesigner` `wizard` prop: the switch, and tabs
  labelled "Step N · …". Messages `famBack`, `famNext`, `famSteps`, `fdWizard`, `fdWizardHint`, `fdStep`.
- `FrappeFormView` / `FrappeForm`: `activeTab`, `hideTabBar`, `onTabsChange`.

**A new type's defaults**
- `FrappeTypeForm` `defaults`: values a new type starts with (through `newDocDefaults.routeOptions`).

## 0.7.0-dev.8 — Families: the family screens, a type's Form section and @solvfast/ui/sayr

Additive: nothing changes for a consumer that does not use the new components. jsdom tests only; no real-site run.

**Families** (Sayr's inheritance: a parent, a type registry, one DocType per type) — docs/components/family.md
- Core `FamilyTabs`: the Records | Types tabs above a family's pages; `records={false}` shows Types alone.
- Frappe `FrappeNewFamilyRecord`: the type first (enabled types with a DocType, both names), then that type's form in one
  list (Tab Breaks left out), Cancel / Create; changing the type after filling fields asks first.
- Frappe `FrappeFamilyRecord`: a record opened from its parent row, in its type's DocType.
- Frappe `FrappeTypeForm`: the registry's form, Configuration (Linked Lifecycle, SLA Policy, Assignment Profile) shown
  by default or hidden with `configuration={false}`; a `designer` slot under a saved type.
- `FamilyDescriptor` (field names per family, Sayr's by default), `useFamilyTypes`, `useFamilyRecord`,
  `fetchFamilyTypes`, `fetchFamilyRecord`, `SAYR_CONFIGURATION_FIELDS`. Stock methods only (`getdoctype`, `get_list`).
- Messages `famRecords` … `famNotFound` (en + ar).

**A type's Form section** (placement only) — docs/components/family.md §7–8
- Core `FieldDesigner` over a `FieldDesignerAdapter`: tabs → sections → columns; standard fields locked, shared ones
  movable, a field set's fields movable and removable; Add fields (from a published set, as a new section or into one),
  Add tab, remove an added section or tab; moves by drag or by the up / down buttons (keyboard); Save form asks before
  removing fields that hold values and before withdrawing every added field. Layout model ported from Sayr's Field Library
  canvas (`toLayout`, `fromLayout`, `moveItem`, `stepItem`, `insertSectionAfter`, `appendTab`, `removeSection`,
  `removeTab`, `previousId`, `kindOfFieldtype`). Messages `fdTitle` … `fdRecords` (en + ar).
- **New entry `@solvfast/ui/sayr`** — the only one that calls Sayr's own methods: `SayrFieldDesigner`,
  `createSayrFieldDesignerAdapter` (Sayr's `doctype_deployment`, `Sear Field Deployment` save, `save_field_order`,
  `withdraw_deployment`, `deployment_removal_impact`), `sayrToken`. `check-boundaries` keeps core, `./frappe` and the
  other entries from reaching it.

## 0.7.0-dev.7 — Sayr's Appearance and First Day of the Week

Additive: nothing changes for a consumer that does not pass the new props. Ported from Sayr (sear_product), where these
pieces lived in the app; Sayr and ServeFast now take them from the package. jsdom tests only; no real-site run.

**Brand colours** (Sayr: System Settings › Appearance)
- New `applyBrandTheme(brand, isDark, defaults?)`, `brandTokens`, `hexToHsl`, `DEFAULT_BRAND_COLORS` and the
  `<BrandTheme brand />` component. The primary sets `--primary`, `--ring`, `--brand-violet`, `--primary-foreground`,
  `--btn-primary-bg` / `-fg`; the secondary `--brand-sky`, `--brand-cyan`, inline on `<html>`. At the default colours
  nothing is set. In dark mode a dark primary is lifted to 60% lightness with dark text on it. Needs the
  ThemeProvider's default `scope="document"`.

**Workspace background**
- New `WorkspaceBackground` type, `colorBackground`, `imageLayerStyle`, `imageOverlayStyle`, `isImageBackground`,
  `BACKGROUND_PRESETS`, `presetBackground`, `DEFAULT_WORKSPACE_BACKGROUND`, `BACKGROUND_INTENSITY_CAP` (35),
  `BACKGROUND_MAX_COLORS` (6) and `<WorkspaceBackdrop bg isDark? base? />`. A photo's URL is quoted, so file names with
  spaces or brackets (Frappe's `logo (3).png`) work.
- `AppShell` `background`: the backdrop behind the sidebar and pages, in the shell's own stacking context (`relative
  isolate`, backdrop `-z-10`): over the shell's background and the dark aurora, under everything else.

**Header**
- New `UserMenu` (`ShellUser`: `name`, `fullName`, `image?`, `onProfile`, `onLogout`) and `userInitials`: the photo or
  Frappe's initials; the menu shows the name and email, My Profile and Log out (en/ar strings `account`, `myProfile`,
  `logOut`).
- New `CompanyLogo` (`src`, `darkSrc?`, `alt?`).
- `Navbar` / `AppShell` `companyLogo` (before the title, desktop only; optional `onClick`) and `user` (last in the bar).

**First Day of the Week**
- `FormatContext.firstDayOfWeek` (0 Sunday … 6 Saturday), read by `formatContextFromBoot` from
  `sysdefaults.first_day_of_the_week`.
- `DateField` / `DateTimeField` `weekStartsOn`; `FrappeField` Date and Datetime pass the FormatContext's. Unset: the
  calendar locale's (Saturday in Arabic, Sunday in English), as before.

## 0.7.0-dev.6 — P36e FrappeField trace, field types, FrappeField without a server, Frappe-like print, docstatus, Lifecycle rail

P36e follows up on the P36d Lead Details audit. Evidence comes from jsdom tests, the in-package SIMULATOR and Playwright
runs on local CRM builds (mock data and simulated builds). **Nothing was validated on a real Frappe site**: the 96
prepared real-site tests are still Pending.

**FrappeField without a Frappe server**
- New `FrappeLocalForm`, `createLocalFormServices`, `localSearchLink` / `localValidateLink` / `localLinkTitle`,
  `createNoServerClient` / `noServerClient`, `localModeError` and `useFormCapabilities` (`SERVER_CAPABILITIES` /
  `LOCAL_CAPABILITIES`).
- `FrappeField` / `FrappeLinkField` / Dynamic Link run with no server. Link search, validate_link and get_link_title run
  locally over rows the host supplies (desk/search.py, client.py semantics).
- The client refuses every server call with a non-retried `LocalModeError`. Nothing reaches the network; tests assert
  it.
- `useFormCapabilities()` reports what local mode cannot do: permissions, custom queries, Create New, uploads and
  server save validation.

**Field types** (`docs/audit/p36d/FIELD-TYPES.md`: 43 DocField types now **16 Complete · 27 Partial · 0 Missing**)
- Source trace and re-grade (`docs/audit/p36d/FRAPPEFIELD-TRACE.md`): locations, call chains, public API and FrappeField
  without a provider. The 43 types were re-graded against `controls/*.js`, from 22 / 17 / 4 to 15 / 24 / 4 before the
  new controls. The showcase data now matches the table, with a drift-guard test.
- New Core `SignatureInput`: canvas → PNG data URL, as jSignature stores it. FrappeField Signature fields use it.
  **Complete.**
- New Core `IconInput` and Frappe `FrappeIconField`: a picker over Desk's icon names, with glyphs where the page carries
  Desk's sprite. **Partial.**
- New Core `BarcodeInput` with `sanitizeSvg`: shows a stored JsBarcode SVG (sanitised) and clears it. Generating a
  barcode needs `jsbarcode` (not included; owner decision). **Partial.**
- New Core `GeolocationInput` with `parseGeolocation`: a read-only list of GeoJSON features. Drawing needs Leaflet +
  Leaflet.draw (not included; owner decision). **Partial.**
- Signature, Icon, Barcode and Geolocation are no longer reported as unsupported. New `PARTIAL_FIELDTYPES`.

**Print**
- New Frappe-free Core components:
  - `PrintView` / `PrintViewDialog`: Desk's print page;
  - `PrintDocumentsDialog`: Desk's list "Print Documents";
  - `composePrintDocument` + `printHtmlDocument`: one HTML document, one record per page, `@page` size in mm for every
    Desk size and Custom, dir / lang, a no-script CSP, printed through a hidden iframe.
- `PrintPreviewFrame` gains `srcDoc`.
- `FrappeFormPrint` and `FrappePrintDialog` render the Core components, with unchanged behaviour. `FrappeFormPrint` gains
  `variant="page"` with `onBack`.
- `PRINT_PAGE_SIZES`, `NO_LETTERHEAD` and `MAX_PRINT_LIMIT` now live in Core and are still exported from
  `@solvfast/ui/frappe`.

**Docstatus (submittable DocTypes, lifecycle-driven)**
- New Core module `src/record/docstatus.ts`: Frappe's docstatus rules as pure functions. Messages are in
  `messages-ws/submit.ts` (en / ar).
  - Rules covered: check_docstatus_transition, the apply_workflow docstatus step, validate_docstatus, mandatory checks,
    update after submit, delete and linked-delete, amend names.
  - For hosts without a server (the CRM's submittable Proposals).
- Changed: the `FrappeListView` indicator pill takes Desk's docstatus description as its title on submittable DocTypes.
  Visible wherever the package is updated.
- Fixed: `FrappeForm` Amend under a workflow starts in the docstatus-0 default state, as Desk's `set_default_state` does.
  This affects every workflow DocType's Amend.
- New SIMULATED `withSubmitRules(transport)`:
  - update after submit is enforced on savedocs, save, set_value and bulk update;
  - a new document gets the first workflow state on save;
  - `delete_items` deletes item by item.

**Simulator** (SIMULATED)
- The fixture transport's save runs Frappe's `_validate_data_fields` (Data options Email / Name / Phone / URL / IBAN),
  `_validate_non_negative` and `_validate_length`, in document.py:624-646 order.
- Messages and exception types are verbatim.
- Not reproduced: the Phone fieldtype's `phonenumbers` check.

**Tests:** `trace-p36e` (P36E.trace.*), `ftypes-p36e` (P36E.ftypes.1-19), `mock-p36e` (P36E.mock.1-10),
`print-p36e` (P36E.print.1-11), `sim-validate-p36e` (P36E.sim.1-9), `submit-p36e` (P36E.submit.1-17).

**Lifecycle — one shared rail + diagram look for CRM and Tickets** (another session's `feat/0.7.x/lifecycle-ds`, 954b084; first
shipped to the CRM inside the vendored `0.7.0-dev.5-954b084` tarball, published here)

**Added (core entry, Frappe-free)**
- `LifecycleRail` — the record lifecycle card: past states, the current state, what can happen next (one dashed row, or a
  box of options with back-moves tagged; optional `disabled` options), End of lifecycle, View full lifecycle. View model
  props only (`path`, `next`, `ended`, `onViewAll`, `labels`).
- `LifecycleDiagramDialog`, `LifecycleStateCard`, `LifecycleEdgeLabel`, `LifecycleDiagramLegend`, `LIFECYCLE_DIAGRAM_COLORS`
  — the full-lifecycle diagram look; the consumer keeps its graph engine (React Flow + dagre in the CRM) and layout.
- `LifecycleStepDot` — the shared dot atom. `lc*` chrome strings (en / ar).

**Changed (intentional visual change)**
- `LifecycleBar`: past steps and their connectors are `success` (were `primary`); the current label is `primary`;
  connectors to unreached steps are dashed. API and `data-step` markup unchanged.

Tests: `tests/lifecycle.test.tsx`. Docs: `docs/components/record.md` §9. Showcase: Record status, lifecycle & feed.

## 0.7.0-dev.5 (unreleased) — P36d CRM Lead Details audit + Frappe field parity

P36d: the CRM Lead Details page was audited as the first reference page for DS / Frappe parity. Evidence is jsdom tests,
the in-package SIMULATOR and Playwright runs on local mock-data CRM builds. Nothing was validated on a real Frappe site.

**Changed defaults (owner decisions)**
- **LinkInput** (owner decision, P36c item 7). Three behaviours are now the default in every mode; before, they were
  picker mode only:
  - the highlighted row is scrolled into view;
  - keys pressed during an IME composition (`isComposing` / keyCode 229) belong to the IME;
  - Escape restores the previously shown value.

  Two consequences:
  - `SuggestionList` (used by LinkInput and TagInput) ignores the Escape that ends an IME composition.
  - This differs from Desk, whose Link only closes the list on Escape. Typing, the arrows, Enter, the blur commit and
    picker mode are unchanged.

  Tests: `tests/linkinput-p36d.test.tsx` (P36D.linkinput.1-9).
- **Focus colour**:
  - Inside `.sf-theme`, the glass focus token `--c-focus` is the theme ring (violet in light, flame in dark). It used to
    be Sky cyan (#25D0FE).
  - DateField, TimeField, DateTimeField, MonthInput and EditableTitle show one focus ring instead of a ring stacked on a
    browser outline.
  - CRM Lead page audit: 223 of 490 focus stops were cyan before, 0 after.
  - Tests: `tests/visual-p36d.test.tsx` (P36D.visual.1-7).

**Frappe field parity (`FrappeField` / `FrappeLinkField`)**
- Data fields with options Email / Phone / Name / URL:
  - validate with Frappe's own patterns (`utils.js` validate_type), using `split_emails` for e-mail addresses;
  - the input is always `type="text" autocomplete="off"`, as in Desk (`data.js`);
  - new `splitEmails` export.
- Desk's maxlength (`df.length || 140`) applies to Link and Dynamic Link, with the "Data Clipped" paste message.
  Numeric inputs select their text on focus. Placeholders are translated and reach Link and Text inputs.
- Link titles of `show_title_field_in_link` targets are fetched with `frappe.desk.search.get_link_title` (new optional
  `FormServices.getLinkTitle`), with a SIMULATED handler.
- `LinkInput` has typed `maxLength` and `onPaste` props.
- Tests: `tests/fields-p36d.test.tsx` (P36D.fields.1-11).

**Record Detail history (`Timeline` / `FrappeTimeline`)**
- Timeline wording, avatars and links:
  - Desk relative times (`timeFormat: "desk"`) and author avatars (`showAvatars`);
  - Copy Link;
  - the absolute date follows the app language.
- Communications as cards, with delivery status and attachments. Automated messages read "Notification sent to …".
- Version lines: "via …", "Impersonated by" and "[Action taken by]". `additional_timeline_content` entries that carry
  content are shown.
- Error, Published and edit-box behaviour:
  - a failed load shows `FrappeErrorState` with Retry;
  - the Published marker always shows;
  - the edit box always says Save.
- See `docs/components/record.md` §7. Tests: `tests/history-p36d.test.tsx` (P36D.history.1-15).

**Frappe Field Types foundation**
- `docs/audit/p36d/FIELD-TYPES.md`: the Frappe 15.110 inventory.
  - Scope: 43 DocField types, Long Int, Page Break and the 6 Data options.
  - For each: the native control, formatter and server validation with file:line, and DS coverage (22 complete,
    17 partial, 4 missing: Signature, Barcode, Geolocation, Icon).
  - The Core / Frappe / CRM strategy and a phased plan.
- `docs/components/frappe-field-types.md`: the consumer guide.
- Showcase: a new **Frappe Field Types** group with four pages: Inventory, Inspect a field type, Links & files
  (SIMULATED), and Layout & display types.
- Tests: `tests/fieldtypes-p36d.test.tsx` (P36D.fieldtypes.1-16).

**Audit records:** `docs/audit/p36d/` (README, LEAD-FIELDS, FIELD-TYPES).

## 0.7.0-dev.4 (unreleased) — P36 owner decisions

P36c — the owner's final decisions on the batch-2 open items: LinkInput picker keyboard reviewed against Desk, a small
phone-header title gain, the Report view's de-duplication kept and pinned by tests, Commission & Referral not migrated,
**Image view Actions** and **Assign To User Group** implemented. `package.json` `version` is `0.7.0-dev.4` (not tagged, not
published). Coverage of the fixed P35 list is unchanged (**258 / 301**; `docs/audit/p35/COVERAGE.md` §11). **No real-site
validation:** evidence is jsdom unit tests and the in-package simulator. Index: `docs/audit/p36c/README.md` (repository
only).

Owner decisions (final): (1) LinkInput picker: review every difference against Desk, keep native keyboard behaviour,
document the intentional differences; (2) the 390 px header is acceptable, take a small title-space gain without a
redesign; (3) the Report view keeps its per-document de-duplication (intended deviation) with regression tests for every
name-taking action; (4) CRM Commission & Referral is **not** migrated (every-row editing, no card layout, horizontal
scroll kept); (5) the Image view gets Desk's Actions; (6) Assign To User Group is added. Item 7 of the owner's message was
cut off: the LinkInput **default-mode** candidates are unchanged, pending the owner.

### Added
- **Image view Actions (`@solvfast/ui/frappe`)** — `FrappeImageView` `bulk?: FrappeBulkOptions` gives the checked cards
  Desk's Actions menu, as Desk's Image view inherits it from the List view (image_view.js:6, :17-21, :113): Edit, Export,
  Assign To, Clear Assignment, Apply Assignment Rule, Add Tags, Print, Submit, Cancel, Delete and the workflow's actions,
  with the List view's permission gates and selection outcomes through the shared `useFrappeSelectionActions`. "Add
  {DocType}" (the host's `primaryAction`) gives way to Actions while cards are checked. `FrappeViews` `bulk` now reaches
  the Image view too (`image.bulk` overrides). Opt-in, as in the List / Report views.
- **Core `ImageView`** (additive) gains the List view's selection props — `primaryAction`, `bulkActions`,
  `renderBulkActions`, `selectionMode`, `renderActionsMenu`, `onActionsOpenChange`, `actionsLabel` — and, with any of them,
  the Add ↔ Actions swap and a selection strip (select-all on the page, "{n} items selected", Clear). A plain `selectable`
  `ImageView` is unchanged.
- **Assign To User Group** — Core `AssignDialog` `groups?: AssignGroupSource` (`search`, `members`, `label`, `placeholder`,
  `debounceMs`; hidden with `single`) and `uniqueMembers`; Frappe `FrappeAssignTo layout="sidebar"` `userGroups` (Add to
  ToDo) and `FrappeBulkOptions.userGroups` (the list / report Actions → Assign To dialog), both **default on**, and the
  helpers `userGroupSource`, `getUserGroupMembers`, `searchUserGroups`, `userGroupMembersArgs`, `USER_GROUP_DOCTYPE`,
  `USER_GROUP_MEMBER_DOCTYPE`, `USER_GROUP_MEMBERS_FIELD`, `USER_GROUP_MEMBERS_METHOD`, `USER_GROUP_MEMBERS_LIMIT`. As
  Desk (assign_to.js:142-160): picking a group **replaces** the users to assign with its members and unticks Assign to me;
  the members are read with `frappe.desk.reportview.get_list` on User Group Member (`parent_doctype: "User Group"`,
  `limit: 20` — Desk's `frappe.db.get_list` default, so a group expands to its first 20 members). Empty group → list
  emptied, Add disabled; a refused read shows the server message under the field. The `assign_to.add` / `add_multiple`
  payloads are unchanged (only the `assign_to` list changes). The opt-in bar's `AssignPicker` popover has no group field.
- **Messages** (en + ar): `sbAssignGroup`, `sbAssignGroupSearch`, `sbAssignGroupEmpty`, `sbAssignGroupMembers`.
- **Simulator (SIMULATED)** — `withSimulatedSidebar` answers `frappe.desk.reportview.get_list` on a child DocType with
  `parent_doctype` (Frappe's has_child_permission: a valid parent with a table of the child, then read on the parent;
  `limit` / `start` / `fields`), recorded in `store.calls`.

### Changed (behaviour visible to 0.7.0-dev.3 consumers)
1. **`Navbar` on phones — a default change for every `Navbar` / `AppShell` consumer.** Below `md` the header uses 12 px
   inline padding (was 16 px) and 2 px between its icon buttons (was 4 px). The page title gets 18 px more at every phone
   width (CRM: 106 → 124 px at 390 px, 76 → 94 px at 360 px; truncated CRM titles 68 → 48 per theme over 27 routes × en /
   ar × 390 / 360). Buttons stay 32 × 32 (`icon-sm`), the search trigger keeps its accessible name and Ctrl/⌘+G; desktop
   (≥ `md`) is unchanged. No opt-out prop.
2. **LinkInput picker mode keyboard** (`openOnClickWhenFilled`, opt-in): a plain **Space** on a filled, closed box with
   nothing typed opens the full list instead of appending a space (Desk's Select is a native `<select>`); Space still
   types once the list is open, while typing, on an empty box, with a modifier or during IME composition, and never in the
   default mode. **Every keyboard open (Enter / ArrowDown / Space) selects the shown text**, as a click does (see Fixed).
   No prop or API change; the default mode (`FrappeLinkField`) is unchanged.
3. **Assign To dialogs show a group field by default:** `FrappeAssignTo layout="sidebar"` (`userGroups={false}` opts out)
   and the Actions → Assign To dialog of `FrappeListView` / `FrappeReportView` (`bulk={{ userGroups: false }}` opts out).
4. **Simulator ships Frappe's User Group and User Group Member metas by default** (`createFixtureTransport`,
   `BUILTIN_FIXTURE_META`; integrator `44bff60`), so the group field works on every simulated site. A consumer test that
   counted the built-in metas, or expected "DocType User Group not found", sees them.
5. `useFrappeBulkActions` follows the DocType meta once it loads: bulk **Edit** opens on the first editable field (see
   Fixed).

### Fixed
- **Bulk Edit in the Report and Image views opened an empty field picker** (integrator `44bff60`): `useFrappeBulkActions`
  chose its field while the view's DocType meta was still the empty placeholder. It now follows the meta once it arrives.
  Regression test `P36C.views.32` (fails without the fix).
- **LinkInput picker mode, keyboard reopen:** after a keyboard pick the caret sat after the label, so Enter / ArrowDown
  reopened with the text unselected and typing appended to it ("Enterprise dealsSMB", 0 rows). Every keyboard open now
  selects the shown text (`P36C.linkinput.9`; default mode unchanged, `.10`).

### Deviations from Desk (each deliberate; details in `docs/audit/p36c/README.md` §3)
- **LinkInput picker mode** (opt-in; supersedes the 0.7.0-dev.3 LinkInput entry): opens the full list on a filled box (click / tap / Enter / ArrowDown / Space; Desk's
  Link never does, link.js:35-41), selects the shown text, marks the current value (`aria-selected`), Escape restores the
  shown value, Home / End move in the open list, `keepValueWhenEmptied`. **Reviewed and no longer differences:** arrows
  wrap (= Awesomplete), no Ctrl+N / Ctrl+P (cmdk's `vimBindings`; not Desk keys), height = the DS field height, 36 px (the
  4 px came from the old CRM picker, a 40 px `Button`).
- **Image view Actions:** a selection strip (select-all on the page, count, Clear) that Desk's Image view lacks (its header
  is commented out, image_view.js:161-177); the card checkbox stays on phones (Desk `hidden-xs`); the rows request
  `docstatus`, so **Print works** on submittable DocTypes (Desk's image rows carry none and its Print check refuses every
  card for non-Administrators); no shift-click range select; `bulk` is opt-in.
- **Report view** keeps sending a document shown on several rows **once** (owner decision 3), now pinned for every
  name-taking action: Submit, Cancel, Delete, Edit, Assign To, Clear Assignment, Apply Assignment Rule, Add Tags, Print,
  Export, Workflow (`P36C.views.20–31`).
- **Assign To User Group:** a repeated member row is listed and sent once (Desk sends it twice and the server answers
  "Already in … ToDo list"); a status / "has no members" line under the field; a refusal is shown under the field and keeps
  the list (Desk: modal msgprint); a known full name replaces the user id in the pill; a refused members read keeps the
  list (Desk unticks Assign to me first, which empties the list when it was ticked). The owner's brief said "merge"; Desk **replaces**, and
  the package follows Desk.
- **Phone header:** DS chrome with no Desk equivalent (Desk keeps its 300 px search bar on phones).

### Validation status
- **No real-site validation.** No Frappe site was contacted, seeded, read or written. Evidence: `tests/views-p36c.test.tsx`
  (27), `tests/usergroup-p36c.test.tsx` (14), `tests/linkinput-p36c.test.tsx` (10), `tests/header-p36c.test.tsx` (3) — jsdom
  + the simulator. LinkInput and the header were also measured in Chromium on local static builds (showcase; CRM in mock
  mode) — not a Frappe site.
- Coverage of the fixed list is unchanged (**258 / 301**); 8 rows gained evidence (LV.F1, LV.F3, LV.F8, LV.F9, LV.F12,
  LV.F14, LV.H1, LV.H5) — `docs/audit/p35/COVERAGE.md` §11.
- Real-site validation stays **prepared, not run**: the catalogue gained 3 P36c tests (now **94**: 80 API, 7 browser,
  7 manual) — V-IMAGE-2, F-SB-ASSIGN-2 (needs the `sysmgr` account), V-REPORT-3 (`docs/audit/p36/VALIDATION-MATRIX.md` §5).
  LinkInput and the Navbar are client-only. Every real-site result is BLOCKED.
- Integration gates at this docs commit: `npx vitest run` — 85 files, 1678 passed, 10 todo, 0 failed (0.7.0-dev.3: 81 files, 1624); `node e2e/frappe-site/matrix/render.mjs --check` current;
  `tests/frappe-site-guards.test.ts` 23 passed. Integrator gates (typecheck, boundaries, build, CRM regression):
  `docs/audit/p36c/README.md` "Integrator gate results".

## 0.7.0-dev.3 (unreleased) — P36 batch 2

P36 batch 2 (P36b) — owner-requested features: LinkInput picker mode, Submit / Cancel in the Report view, Frappe Global
Search, the Form Sidebar (Assign, Attach, Tags) and its Share / Like / Comments parts; mid-batch, Desk's **Attach / Attach
Image** control and the **Workflow → Lifecycle** label in the design system's chrome. `package.json` `version` is
`0.7.0-dev.3` (not tagged, not published). Coverage of the fixed P35 list is unchanged (**258 / 301**); the batch-2 features
without a requirement row are recorded outside the denominator (`docs/audit/p35/COVERAGE.md` §9–§10). **No real-site
validation:** every new server path is simulator-only. Index: `docs/audit/p36b/README.md` (repository only).

### Added
- **LinkInput picker mode (Core, opt-in)** — for Link pickers over a known list: `openOnClickWhenFilled` (click / tap /
  Enter / ArrowDown opens the FULL list on a filled box, the shown text selected; Escape closes and restores the shown
  value; Home / End move in the open list; decorative chevron), `selectedIndicator` + `selectedValue` (check mark and
  `aria-selected` on the current value, the highlight via `aria-activedescendant`; `selectedValue` marks a "None" row),
  `keepValueWhenEmptied`, `emptyText`, `searchPlaceholder`. Defaults unchanged, so `FrappeLinkField` is unchanged.
- **Report view Submit / Cancel (`@solvfast/ui/frappe`)** — `FrappeReportView` `bulk?: FrappeBulkOptions` gives the
  checked rows Desk's whole Actions menu, as the Report view inherits it from the List view (report_view.js:9, 360,
  371-374): Edit, Export, Assign, Tags, Print, **Submit** (submittable + submit right + no active Workflow), **Cancel**
  (cancel right + no active Workflow), Delete, workflow actions. `FrappeViews` `bulk` forwards it to the List and Report
  views (`list.bulk` / `report.bulk` override per view). New `useFrappeSelectionActions` (the selection → Actions wiring
  shared by `FrappeListView` and `FrappeReportView`) and `uniqueNames`.
- **Global Search** — Core `GlobalSearchBar` / `GlobalSearchDialog` (Desk's awesome bar and Global Search dialog:
  Ctrl/⌘+G, 100 ms / 300 ms debounce, index-ranked rows, "Search for …", grouped results with All Results (4 + More) and
  per-group paging (20 + More), loading / empty / error + Retry, keyboard, RTL; phones get an icon + full-screen dialog),
  types `GlobalSearchSource`, `SearchItem`, `SearchResultGroup`; `Navbar` `search={{ slot }}` (`NavbarSearchSlot`, rendered
  at every width). Frappe adapter `useFrappeGlobalSearch` / `createFrappeSearchSource` over
  `frappe.utils.global_search.search` (`{text, start, limit, doctype}`) and Desk's boot lists (`DeskSearchBoot`,
  `deskSearchBootFrom`, Desk's fuzzy ranking `fuzzySearch`), routing through `onNavigate(url, info)`.
- **Form Sidebar** — Core `FormSidebar`, `SidebarSection`, `AttachmentList`, `AttachDialog`, `TagList`
  (`FORM_SIDEBAR_SECTIONS`); Frappe `FrappeFormSidebar` (Desk's order: Assigned To, Attachments, Tags, Share,
  likes · comments, last edited / created; Share / Likes / comment count / Comments render by default, a host node or
  `null` replaces each), `FrappeAttachments` (upload, Library, Link, remove, `max_attachments`, `protect_attached_files`),
  `FrappeDocTags`, `FrappeAssignTo layout="sidebar"` (+ `allowComplete`, `bundle`), `useFormSidebarActions`, and the
  `attachments.ts` / `tags.ts` helpers. All sections read the one shared docinfo query (`useRecordDocInfo`).
- **Share / Likes / Comments** — Core `ShareDialog`, `SharedAvatars`, `LikedBy` (`SHARE_RIGHTS`); Frappe
  `FrappeSidebarShare` (`frappe.share.get_users / add / set_permission`), `FrappeSidebarLikes`
  (`frappe.desk.like.toggle_like`, reads `doc._liked_by`), `FrappeComments` (`variant="list" | "count"`; add, edit, delete,
  publish, @mentions; `focusCommentBox`) and the `share.ts` / `like.ts` / `comments.ts` helpers; Core `Timeline`
  `onTogglePublish` / `canPublish` / `isPublished` (+ labels); `FrappeTimeline` `allowPublish` (default off). Never
  optimistic: the UI changes only after the server answered.
- **Attach / Attach Image (mid-batch, `@solvfast/ui/frappe`)** — `FrappeAttachField` reproduces Desk's control
  (attach.js, attach_image.js, FileUploader.vue): "Attach" opens the uploader dialog (My Device / Library / Link / Camera;
  per file a thumbnail, Private + Desk's public-file warning, Optimize, Crop), `image/*` for Attach Image (drop too), the
  site's `max_file_size` read on every opening (a file of that size or more is skipped); uploads carry `fieldname` and
  `folder` "Home"; "Clear" asks, then (in a form) removes the File with `remove_attach` and saves; "Reload File"; the image
  preview is Desk's 150 px popover (hover and focus). New: `FrappeAttachHost` / `useAttachHost` / `attachSaveAction`
  (the form an Attach control saves — `FrappeFormView` provides it), `useFrappeAttach`, `attachUploadOptions`,
  `fileIdForUrl`, `MAX_FILE_SIZE_METHOD`, `ATTACH_FIELD_FOLDER`; `FrappeFormImage` (the form header image's Change →
  Upload / Remove menu for users who can write, on saved documents, unless the image field is read-only);
  `FrappeFormView` `attachHost?: boolean` (default true).
- **Core (mid-batch)** — `AttachInput` + `parseAttachValue` (Desk's Attach button / attached-file row); `ImageCropper`
  (`initialCropBox`, `clampCropBox`, `CropBox`; dependency-free, ratios 1:1 / 4:3 / 16:9 / Free, keyboard); `CameraCapture`
  (`cameraSupported`, `captureFileName`, `dataUrlToFile`). `AttachDialog` (additive): `onUpload(file, isPrivate,
  { optimize })`, `allowOptimize` (default false; per image on above 200 KB, never SVG), `allowCrop`, `cropAspectRatio`,
  `allowCamera`, thumbnails, the public-file warning, the drop zone hides once `maxFiles` files are listed.
- `createFrappeClient().uploadFile`: `UploadFileOptions.optimize` / `maxWidth` / `maxHeight` → multipart `optimize`,
  `max_width`, `max_height` (handler.py:229-235). `UploadAttachmentVars.optimize` (`useFormSidebarActions`).
- Additive props: `TagInput` `exclude`, `autoFocus`; `AssigneeGroup` `hideHeading`, `onComplete`, `canComplete`;
  `AssignDialog` `defaultDetails`.
- **Messages** (en + ar): `listBulkCannotSubmit` "Cannot submit {names}.", `listBulkCannotCancel` "Cannot cancel {names}.",
  the search / sidebar / social chrome strings (`src/theme/messages-ws/{search,sidebar,social}.ts`), and the Attach strings
  `formAttachReload`, `formAttachErrors`, `formAttachPreview`, `formImageChange` / `formImageUpload` / `formImageRemove` and
  the uploader's `formUp*` keys (`messages-ws/form.ts`).
- **Simulator (`@solvfast/ui/frappe/testing`, SIMULATED)** — built-in handlers for `frappe.utils.global_search.search`
  (DocType-level read filter, Global Search Settings order), `upload_file` (JSON `library_file_name` / `file_url`),
  `frappe.desk.form.utils.remove_attach`, `tag.add_tag` / `remove_tag` / `get_tags`,
  `frappe.core.api.file.get_files_by_search_text`, `frappe.share.get_users` / `add` / `set_permission`,
  `update_comment_publicity`, and an `add_comment` that records Mention notifications. New exports: `withSimulatedSidebar`
  (docinfo attachments / tags + attachment uploads), `bulkUpdateHandler` (opt-in: the form path + submitted back links),
  `bulkDemoBackend`. Mid-batch: `frappe.core.api.file.get_max_file_size` (System Settings → conf → 25 MiB, core/api/file.py:86-91)
  and a `savedocs` that relinks Files uploaded against a `new-…` name (relink_mismatched_files, file/utils.py:377-419).

### Changed (behaviour visible to 0.7.0-dev.2 consumers)
1. **Bulk Submit / Cancel failure wording** (`FrappeBulkActions`, List and Report views): the outcome line now adds Desk's
   sentence "Cannot submit {names}." / "Cannot cancel {names}." (bulk_operations.js:286-298). Desk shows it in an error
   dialog and does not refresh; the package keeps its status line, keeps the selection and reloads (P36 rule).
2. **Report view de-duplicates names (documented deviation from Desk).** With `bulk`, a document shown on several Report
   rows (one per child-table row) is sent once and counted once in the confirmation. Desk sends one name per checked row
   (report_view.js:1339-1352) and the server then reports the second copy as failed.
3. `FrappeListView` builds its selection actions through `useFrappeSelectionActions` (extracted unchanged; no behaviour
   change).
4. `FrappeTimeline` wraps its comment composer in `<div data-sf-comment-box>` (the sidebar comment counter focuses it) —
   a DOM change only.
5. **Simulator fidelity changes that can affect consumers' own tests** (`createFixtureTransport`):
   - `submit_cancel_or_update_docs` follows bulk_update.py:51-114: Submit takes drafts only (submitting an already
     submitted document is now reported as **failed**, before it "succeeded" as an update), Cancel takes submitted
     documents only, Update skips cancelled ones; an **unknown name fails the whole request** (404; documents before it
     stay changed); 20–500 names answer with no `message` and the alert "Bulk operation is enqueued in background." (the
     job runs at once in the simulator); more than 500 → 417 "Too Many Documents".
   - `tag.add_tags` checks **write** on each document when the transport has permissions (tag.py:147-152 `update_tags`);
     the P27 test that read "no permission check" was corrected.
   - `get_docinfo` / getdoc docinfo `comments` carry `published` (load.py:158).
   - `add_comment` (social handler) truncates the parent's `_comments` entries at 100 characters (comment.py:130-131) and
     writes Mention Notification Log rows.
   - Mid-batch: `savedocs` re-attaches `new-…` Files of Attach / Attach Image fields to the inserted name (created in the
     last 60 minutes, same `file_url` and field); the upload stub records `optimize`.
6. **`FrappeFormView` saves after an Attach upload or Clear (mid-batch attachimage).** It now provides `FrappeAttachHost`,
   so an Attach / Attach Image field inside it saves the form after an upload or a Clear, as Desk's `frm.save()`
   (attach.js:45, 141) — "Update" on a submitted document (an `allow_on_submit` field). Pass `attachHost={false}` for the
   old value-only behaviour; `FrappeQuickEntry` passes it (Desk's quick-entry controls have no `frm`). A bare `FrappeField`
   outside a host still only sets / clears the value.
7. **Attach / Attach Image field behaviour** (`FrappeAttachField`, mid-batch): "Attach" opens the uploader dialog instead of
   the OS file picker; an unsaved document's upload is attached to its `new-…` name (was unattached; Frappe relinks it on
   insert); "Clear" asks for confirmation and, in a form, deletes the File via `remove_attach` (the File was kept); the link
   text is the stored URL (was the file name); the Attach Image thumbnail is now a hover / focus preview; the uploader
   rejects non-images for Attach Image and files ≥ the site's `max_file_size`.
8. **Form Sidebar uploader offers Optimize** (integrator `2dd3c6e`): Desk's sidebar keeps FileUploader's
   `allow_toggle_optimize` default (FileUploader.vue:305-307; attachments.js:249-258), so `FrappeAttachments` passes
   `allowOptimize` and forwards `optimize` to `upload_file` (on by default for images above 200 KB). Thumbnails, the
   public-file warning, Crop and Camera come with the shared `AttachDialog`.
9. **Design-system label Workflow → Lifecycle (mid-batch lifecycle).** `listBulkWorkflow` "Workflow" → **"Lifecycle"**
   (ar "سير العمل" → **"دورة الحياة"**; the opt-in `selectionMode="bar"` menu button) and `listBulkWorkflowNone` → "No
   lifecycle action applies to all the selected documents" (ar "لا يوجد إجراء في دورة الحياة ينطبق على كل المستندات
   المحددة"; the disabled item in the Actions menu). Consumers that do not override these keys see the new text; apps that
   override them (the CRM does, `CrmAppLayout.tsx:173-176`) see no change. Message keys, component / hook / prop names,
   test ids (`sf-bulk-workflow`), Frappe methods, fields, DocTypes and server-sent text are unchanged; Showcase and docs
   follow. Guard test `P36B.lifecycle.1` (no en / ar message value says Workflow).

### Fixed
- Simulator: bulk Submit of a submitted document succeeded; bulk calls had no 20 / 500 thresholds and an unknown name was
  reported as a per-document failure instead of failing the request (Changed 5).
- Simulator: `tag.add_tags` accepted a user without write.
- Simulator: docinfo comments lacked `published`, so the "Published" marker never showed.
- Attach / Attach Image (mid-batch; Desk mismatches of the previous control): an upload on an unsaved document went out unattached (no
  doctype / docname / fieldname, so Frappe could not relink it on insert); Clear left the File on the server and did not
  save; the site's `max_file_size` and Attach Image's `image/*` restriction were not enforced before the request (only the
  OS picker's `accept`).

### Deviations from Desk (each deliberate; details in `docs/audit/p36b/README.md` §4)
- **LinkInput picker mode** opens on click / Enter on a filled box (Desk's Link never does, link.js:35-41) and marks the
  current value (Awesomplete marks the highlight) — owner requirement (select parity); opt-in. Space types instead of
  opening, arrows wrap, no Ctrl+N/P bindings.
- **Report view** sends each document once (Changed 2).
- **Bulk outcome** is a status line + reload, not Desk's error dialog without refresh (Changed 1); no `task_id` progress bar.
- **Global Search:** no calculator (Desk `eval`s), random password, `#tag` search, Help table, executables or Marketplace
  rows; phones get an icon + full-screen dialog (Desk keeps a 300 px bar); the dialog adds an error state with Retry and
  ↑/↓/Enter navigation; "New X" goes to `/app/<slug>/new` (Desk may open Quick Entry); result links are the canonical
  `/app/<slug>/<name>`.
- **Form Sidebar:** assignees listed one per row with Done / × (Desk: avatar stack + "Assignments" dialog); no "Assign To
  User Group"; no upload percentage or Google Drive (Camera, Crop and Optimize arrived mid-batch); Library is a text
  search (no folder tree);
  empty-section texts; a refused tag pill is removed with the server message (Desk keeps it); not hidden on phones (Desk
  `hidden-xs hidden-sm`); not reproduced: sidebar image (the image menu is in the form header), Follow, Reviews,
  auto-repeat, page views; the comment list is in
  the sidebar slot (Desk: form footer). Attach "+" and Tags add / remove are offered to every reader as in Desk (the
  server refuses: handler.py:220-221, tag.py:152); removing an attachment still needs write (attachments.js:161).
- **Share / Like / Comments:** full name + id in share rows; an "Everyone" pill; a read-only hint naming the reason;
  `disable_document_sharing` is a prop (`sharingDisabled`); a saving share row is disabled until the answer; the liked-by
  list opens from the count button (Desk: hover only); comment edit is not optimistic (Desk shows the new text first);
  Delete / Publish are icon buttons with Desk's confirmations; the count focuses the comment box.
- **Attach / Attach Image:** no Google Drive / app upload handlers, no upload percentage (`fetch`); the cropper is
  dependency-free (no cropperjs; no rotate / zoom — Desk disables zoom too); Camera uses `getUserMedia` first on every
  device (Desk: the `capture` input on phones; the package falls back to it) and ignores
  `force_web_capture_mode_for_uploads`; the preview also opens on focus; Reload File re-sends this session's last local
  file; the image menu is in the form header and its Remove saves with the form's default action ("Update" when
  submitted; Desk: "Save"); `df.options` is not merged into the uploader options; the Clear lookup also uses Files this
  control uploaded (Desk pushes the new File into docinfo). The simulator does not run `optimize_image`.
- **Lifecycle:** Desk says "Workflow"; the design system says "Lifecycle" (owner wording) in its own chrome only — Desk
  shows no group label for workflow items in the Actions menu, so the label appears only in the opt-in bar button and the
  "none applies" item.

### Validation status
- **No real-site validation.** No Frappe site was contacted, seeded, read or written in batch 2. Evidence is jsdom + the
  in-package simulator: `tests/bulk-p36b.test.tsx` (21), `tests/form-sidebar-p36b.test.tsx` (23, incl. `.23` Optimize),
  `tests/social-p36b.test.tsx` (22), `tests/global-search-p36b.test.tsx` (15), `tests/linkinput-p36b.test.tsx` (13),
  `tests/attach-image-p36b.test.tsx` (37), `tests/attach.test.tsx` (6, adapted), `tests/lifecycle-p36b.test.ts` (1).
- Coverage of the fixed list is unchanged (**258 / 301**): FV.A20 / FV.A21 stay COMPLETE with new evidence; FV.G10 stays
  PARTIAL (the row test mounts `FrappeField` with `parent`, not `FrappeChildTable`) — `docs/audit/p35/COVERAGE.md` §9.
- Real-site validation stays **prepared, not run**: the catalogue gained 16 batch-2 tests (now **91**: 77 API, 7 browser,
  7 manual) — `docs/audit/p36/VALIDATION-MATRIX.md` §5 (L-BULK-5, V-REPORT-2, F-SB-ASSIGN-1, F-SB-ATTACH-1, F-SB-ATTACH-2,
  F-SB-TAGS-1, S-SHARE-1, F-SB-LIKE-1, F-SB-COMMENT-1, S-GSEARCH-1, S-GSEARCH-2; mid-batch F-ATTIMG-1 Optimize (manual),
  F-ATTIMG-2 Clear, F-ATTIMG-3 new-document relink, F-ATTIMG-4 `max_file_size`, F-ATTIMG-5 private default). Every
  real-site result is BLOCKED.
- Integration gates at this docs commit: `npx vitest run` — 81 files, 1624 passed, 10 todo, 0 failed (first batch-2 docs
  commit: 79 files, 1585; 0.7.0-dev.2 batch 2 before the merges: 74 files, 1492); `node e2e/frappe-site/matrix/render.mjs
  --check` current; `tests/frappe-site-guards.test.ts` 23 passed. Integrator gates (typecheck, boundaries, build, CRM
  regression): `docs/audit/p36b/README.md` "Integrator gate results".

## 0.7.0-dev.2 (unreleased) — P36

P36 — owner decisions on the P35 open items, and real-site validation **prepared, not run**. `package.json` `version` is
`0.7.0-dev.2` (not tagged, not published). Coverage of the fixed P35 list is unchanged (**258 / 301**,
`docs/audit/p35/COVERAGE.md` §8 lists the rows whose evidence changed). **No real-site validation has been done;** every
write path is still simulator-only. Index: `docs/audit/p36/README.md` (repository only).

Owner decisions (final): (1) Desk's header-actions selection is the List View standard; (2) CRM pickers migrate per usage,
by semantics only; (3) CRM confirmations use `AlertDialog`; (4) no CRM Commission `DataGrid` migration until its responsive
behaviour is verified; (5) Report view editing matches Frappe 15.110 by default, with an explicit opt-in. (2)–(4) are CRM
work; the package delivers (1) and (5). `DataGrid` is unchanged from 0.7.0-dev.1 (see Reverted).

### Added
- **List (Core)** — Ctrl/⌘-click on a row toggles its selection instead of opening it (Desk `list_view.js:1296-1306`; not
  on links).
- **Report view (`@solvfast/ui/frappe`)** — `FrappeReportView` `editable`: `"desk"` (default) | `"strict"` (adds the
  field-permlevel write, `write`-not-`create`, `submit` on submitted documents, `read_only_depends_on` always evaluated) |
  `(df, row, info) => boolean` (`info.desk` = Desk's verdict). Child-table cells are editable as in Desk and save through
  `frappe.client.set_value` on the child row.
- **Exports from `@solvfast/ui/frappe`** — `deskCanWrite`, `evaluateReportReadOnlyDependsOn`, `isNonStdField`,
  `rowFromSavedDoc`, `updateCachedRows`; types `ReportEditable`, `ReportEditInfo`, `ReportEditMode`, `ReportEditOptions`;
  `selectionAfterBulk(kind, outcome, count)` (Desk's selection outcome per bulk action, `src/frappe/list/bulk.ts`).
- **Messages** — `listNoActions` ("No actions available for the selection"), en + ar.
- **Simulator (not public)** — `reportSetValueHandler` in `src/frappe/testing/handlers/views.ts`: SIMULATED
  `frappe.client.set_value` with the child-table branch, the submit right and update-after-submit validation. It is **not**
  exported from `@solvfast/ui/frappe/testing` (the showcase imports it directly) and not part of the builtin handlers.
- **Real-site validation infrastructure (repository only, NOT RUN)** — `docs/audit/p36/VALIDATION-MATRIX.md` (every COVERAGE
  row classified, 75-test catalogue), `e2e/frappe-site/run-matrix.mjs` (matrix runner: `--dry-run`, `--write`,
  `--browser`), `staging-seed.py` / `staging-teardown.py` with `fixtures/staging/*.json`, `guards.mjs` /
  `staging_guards.py` / `production-denylist.json` (refuse production names, loopback, a missing owner approval or a
  private directory inside a repository), a FrappeForm / FrappeListView / FrappeViews harness, `tests/frappe-site-guards.test.ts`
  (23 tests).

### Changed (behaviour visible to 0.7.0-dev.1 consumers)
1. **List selection follows Frappe Desk's header actions by default** (owner decision 1). `ListView` and `FrappeListView`
   now default to `selectionMode="header"`: no bulk bar; with ≥ 1 row selected the header shows "{n} items selected" +
   Clear, and the primary action ("Add {DocType}" / `primaryAction`) is replaced in place by the Actions menu; clearing
   the selection restores it. `selectionMode="bar"` remains as an explicit opt-in (not Desk's layout).
   **What apps must do:**
   - Any `ListView` / `FrappeListView` with `selectable` (or `bulk`) and no `selectionMode` now renders the header mode:
     `bulkActions` are Actions-menu items, and the column titles are replaced by the count while rows are selected (header
     sorting is unavailable during a selection — offer `controls.sortMenu`). To keep the bar, pass `selectionMode="bar"`.
   - Put the "New" button in `primaryAction`, not `toolbarActions`: only `primaryAction` gives way to the Actions menu
     (Desk's swap); `toolbarActions` content is never hidden.
   - `renderBulkActions` content renders in the toolbar next to the Actions menu (header) instead of inside the bar.
   - In header mode the selected rows are resolved across pages (`rowByKey`), so Print's draft / cancelled check and the
     workflow `get_common_transition_actions` see every selected row; opting back into `"bar"` keeps the current-page-only
     `ctx.rows`.
2. Header mode swaps the primary action on the selection alone (Desk `list_view.js:1634`): when no action applies, the
   Actions menu shows a disabled "No actions available for the selection" item instead of bringing the primary action back.
3. `FrappeListView` / `useFrappeBulkActions` / `FrappeBulkActions`: **the selection after an action follows Desk's
   callbacks** (`selectionAfterBulk`). Edit and workflow actions keep the selection (the list reloads); Submit / Cancel
   clear it only when every document went through (a partial failure keeps it and reloads; a queued job keeps it, no
   reload); dismissing Clear Assignment's confirmation clears the selection and reloads (Desk's `reject_action`). Assign
   To / Apply Assignment Rule / Add Tags / Delete (clear on success) and Export / Print (keep) are unchanged.
4. **`FrappeReportView` / `isCellEditable` (LV.H1): inline editing follows Frappe 15.110's report view by default**
   (owner decision 5), verified from report_view.js `is_editable` + `build_row` and frappe-datatable's `=== false` check.
   On a DocType without a Table field, plain fields are editable and a field with `read_only_depends_on` is editable when
   it evaluates false on the loaded row (true → read-only); with a Table field `read_only_depends_on` is not evaluated; the
   write right is Desk's `can_write` (level-0 write or create) and the field's permlevel is not checked (the server
   silently resets such a change). Before (0.7.0-dev.1): `read_only_depends_on` fields were never editable, a permlevel
   without write locked the cell, and child cells were read-only. `editable="strict"` restores the per-permlevel check.
5. `FrappeReportView` refreshes the edited row (every loaded row of that document) from the returned document, sends
   nothing for an unchanged value, and treats a response without `message` as a failure — the editor stays open (Desk).
6. Repository only: `e2e/frappe-site/seed-crm-site.py` and `teardown-crm-site.py` now refuse to run (they targeted a
   production site); the legacy `seed.py` / `validate.mjs` and the harness proxy refuse anything but an approved staging site.

Unchanged: `DataGrid` (byte-identical to 0.7.0-dev.1: the `32rem` minimum and horizontal scrolling on phones), so
`FrappeChildTable` and other existing grids are unaffected. `package.json` `exports` unchanged.

### Reverted (owner decision, P36 batch 2)
- **DataGrid mobile card layout** — implemented in the 0.7.0-dev.2 work (W3, merge `7bd1595`: `DataGrid layout="table" |
  "cards" | "auto"`, `cardsBelow`, `minTableWidth`, `DataGridColumn.mobile`, the `coreGridEditRow` message, the showcase
  page, `e2e/datagrid-mobile.mjs`, `tests/datagrid-p36.test.tsx`) and reverted before release (`ccb232d`). Owner: no
  card-based mobile layout, no change to the table's responsive behaviour; horizontal scrolling on phones is acceptable
  for now; Frappe Table fields are not migrated to cards. `DataGrid` is unchanged from 0.7.0-dev.1. (`ListView`'s phone
  cards, `layout="cards" | "auto"` + `ColumnDef.mobile` from 0.7.0-dev.1, are a different feature and stay.)

### BREAKING (vs 0.7.0-dev.1)
- `isCellEditable(df, row, levels)` → `isCellEditable(df, row, { fields, levels, issingle?, child?: { name }, mode?: "desk" |
  "strict", onIssue? })`. Migrate: pass the DocType's `fields` and the user's `levels` in the options object; pass
  `mode: "strict"` for the 0.7.0-dev.1 permlevel check. (0.7.0-dev.1 was never released; 0.6.0 has no `isCellEditable`.)

### Fixed
- Header selection mode: the primary action no longer stays visible while rows are selected and no action applies.
- `FrappeReportView`: a response without `message` was treated as a successful save; an unchanged value sent a
  `set_value` request.
- The Report view editability deviation recorded in P35 (`views.md` §3, "deliberately not :772-777") rested on a misread of
  Desk; the rule now matches 15.110 (Changed 4).

### Docs
- `docs/LIMITATIONS.md`, `docs/FRAPPE.md`, `docs/CONSUMING.md`, `docs/release/LISTVIEW-FRAPPE-PARITY.md`: header selection is
  the default; Report view editability; real-site status "prepared, not run"; Frappe 15.110 server
  rules the validation run must confirm (read from source, not yet observed on a site).
- `docs/components/list.md` (selection default, "The selection after an action"), `views.md` §3 (truth table, save path,
  opt-in), `docs/FEATURES.md` (F20, F21, C3, C4) — updated by the workstreams.
- `docs/audit/p35/COVERAGE.md` (§8 P36 changes; no status change), `docs/audit/p35/CRM-MIGRATION.md` (§5 decisions),
  new `docs/audit/p36/README.md` and `VALIDATION-MATRIX.md` (repository only).

### Validation status
- **No real-site validation.** No Frappe site was contacted, seeded, read or written in P36; every real-site result in
  `VALIDATION-MATRIX.md` is BLOCKED (not run). Running it needs an owner-approved, isolated staging site
  (`docs/audit/p36/README.md` §"What the owner must provide").
- Evidence for the P36 changes is jsdom / simulator only (`tests/list-selection-desk.test.tsx`,
  `tests/list-selection-header.test.tsx`, `tests/frappe-views-report.test.tsx` 26 `LV.H1`, `tests/frappe-site-guards.test.ts`
  23).
- Integration gates (batch 2, after the DataGrid revert): `npx vitest run` — 74 files, 1492 passed, 10 todo, 0 failed
  (batch 1 before the revert: 75 files, 1505; 0.7.0-dev.1: 72 files, 1415 passed); `npm run typecheck` exit 0; `check-boundaries` source rules OK. Not run at integration: `npm run build` (so `dist/styles/full.css` for consumers without Tailwind has not been rebuilt), `check:package`, `showcase:build`, `e2e/showcase-smoke.mjs` (its list checks were rewritten for the header
  default by W1 and have not run), `e2e/consumers/run.sh`.

## 0.7.0-dev.1 (unreleased)

P35 — Form View / List View coverage. Coverage of the fixed P35 requirement list (`docs/audit/p35/COVERAGE.md`, repository
only): **148 / 301 = 49.2 % at 0.6.0 → 258 / 301 = 85.7 %** (Form 155 / 181, List 103 / 120). **No authenticated real-site
validation has been done; every write path is simulator-only** (`docs/LIMITATIONS.md`). `package.json` `version` is
`0.7.0-dev.1` (not tagged); `files` now also ships `docs/components/views.md` and `docs/components/p35-core.md`.

Exports: **0 removed** against 0.6.0 (snapshot of the built `dist/*.d.ts`, TypeScript checker: `.` 466 → 553, `./frappe`
494 → 620, `./frappe/testing` 25 → 29, `toast` / `chart` / `form` unchanged); `package.json` `exports` unchanged (13
entries). 66 exports changed signature, all widening; the ones a consumer could notice are listed under "Export
signatures" below.

Gates (integration, at `826013d`; `410169d` changes only `e2e/consumers/run.sh`, whose gate was re-run): typecheck exit 0;
`npm test` 72 files, 1415 passed, 10 todo, 0 failed; `npm run build` exit 0 (775 files, 888.7 kB packed; extracted styles
regenerated identical); `check:boundaries` OK (source + dist rules); `check:package` OK (13 exports, 507 built files);
`showcase:build` OK; `e2e/showcase-smoke.mjs` PASS (73 sections × light / dark × en / ar, 0 page / console errors);
`e2e/consumers/run.sh` both clean consumers (Tailwind 3 + preset; no Tailwind) tsc + build OK, one React copy. None of these
is a real-site check.

### Added
- **Form (`@solvfast/ui/frappe`)**
  - `FrappeQuickEntry` (Desk's Quick Entry dialog over `FrappeFormView`, "Edit Full Form" hand-over), `useQuickEntryHost`,
    `quickEntryFields` / `quickEntryFilter` (port of quick_entry.js:59-110); `FrappeForm` opens it from a Link's
    "Create a new X" when the target is quick-entry eligible; `FrappeFormProps.onOpenFullForm`.
  - `FrappeFormView` slots and options: `menu`, `extraTabs`, `fieldFilter`, `hotkeys`; header image from `meta.image_field`;
    "See on Website" (`__onload.is_website_generator` + `published` + `route`, fallback `has_web_view`).
  - Undo / Redo: `DocStore.undo/redo/canUndo/canRedo/eraseHistory`, `HistoryEntry`; Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl/⌘+Y.
  - `FormController`: `addCustomButton` / `removeCustomButton` / `clearCustomButtons` (grouped buttons form a dropdown),
    `save(action?)`, `checkMandatory()`, `selectedWorkflowAction`, `undo()` / `redo()` / `canUndo` / `canRedo`;
    `before_workflow_action` is abortable; `FrappeWorkflowActionsProps.beforeApply` / `afterApply`.
  - Server save errors on fields: `fieldErrorsFromFrappeError` (MandatoryError, LinkValidationError).
  - Fieldtypes: Autocomplete control (`df.options`); `SUPPORTED_FIELDTYPES`, `analyzeFieldtypes`, `FieldtypeIssue`.
  - `useUnsavedChangesBlocker` (router-agnostic in-app navigation guard); `defaultLinkHref`; `FormServices.builtin`,
    `FormServices.quickEntry`.
  - Client / boot: `getDoc` keeps getdoc's `_link_titles` (`linkTitlesOf`, `LoadedDocWithTitles`); `userDefaultsFromBoot`,
    `FrappeBootPayload.defaults` / `user_permissions`, `FrappeBoot.userDefaults`.
- **Record (Core `@solvfast/ui` + `@solvfast/ui/frappe`)**
  - Core: `RecordMenu`, `groupMenuItems`, `RenameDialog`, `PrintPreviewFrame`, `printSrcDoc`, `ConnectionsPanel`,
    `EmailComposer`, `isValidEmail`, `ReminderDialog` (+ `toFrappeDatetime`, `remindAtFor`, `reminderSetText`).
  - Frappe: the form ⋯ menu `FrappeRecordMenu` + `formMenuItems` / `FORM_MENU_ORDER` / `printAllowedForStatus` /
    `customizeHref` (Print, Email, Links, Duplicate, Copy to Clipboard, Rename, Reload, Delete, Remind Me, Undo / Redo,
    Customize, New — Desk's order and rules); `FrappeFormPrint`, `FrappePrintPreview` (+ `downloadPdfUrl`, `printViewUrl`,
    …); `FrappeConnections`, `connectionsFromMeta`, `useOpenCounts`; `FrappeEmailComposer`, `emailMakeArgs`;
    `FrappeReminder`.
- **List**
  - Core: `GroupBySidebar` and `ListView` `aside` / `asideOpen`; multi-bucket grouping (`GroupBucket`); page-size picker
    (`ListPagination pageSize/pageSizes/onPageSize`, `useListState().setPageSize`, `ListViewProps.pageSizes`); "Select all
    {n} matching" (`ListViewProps.selectAllMatching`, `BulkAction.allMatching`, `SelectionMatching`); phone cards
    (`ListViewProps.layout: "table" | "cards" | "auto"`, `ColumnDef.mobile`); `SavedFilter.global`, `SaveFilterOptions`,
    `SavedFilters canSaveGlobal`, `ListViewProps.savedFiltersGlobal`; `FilterField.operators`; `ListActions.removeCondition`.
  - Frappe: workflow state in the row indicator from the DocType (`indicatorWorkflowFromMeta`); Assigned To / Tags filter
    fields, per-user / per-tag grouping, `TagsCell`; group-by sidebar with server counts and tag stats (`sidebar`,
    `FrappeGroupBySidebar`, `useGroupByCounts`, `useTagStats`) + "Toggle Sidebar"; "Add {DocType}" (`create`,
    `FrappeListCreate`); menu entries User Permissions / Role Permissions Manager / Customize / List Settings
    (`FrappeListSettingsDialog`, `save_listview_settings`), `onNavigate`, `userPermissionsUrl`, `rolePermissionsUrl`,
    `customizeUrl`; typed Bulk Edit value (`BulkEditValue`); `DESK_PAGE_SIZES`; `actsAsSystemManagerFor`.
- **Views** — Core: `ViewSwitcher`, `ViewToolbar`, `ImageGrid`, `ImageView`, `KanbanBoard`, `CalendarMonth` and helpers;
  Frappe: `FrappeViews`, `availableViews`, `FrappeReportView` (column picker incl. child fields, permission-aware inline
  edit, totals), `FrappeImageView`, `FrappeKanbanView` (Kanban Board or Select-field mode), `FrappeCalendarView`,
  `useFrappeViewList`. Gantt, Dashboard, Map, Tree and Inbox are not implemented (`docs/components/views.md` §7).
- **Core capabilities for the CRM** — `StatusBadge` / `StatusDot` `color` (+ `STATUS_PALETTE`, `resolveStatusColor`,
  `statusColorStyles`); `LifecycleStateItem.step` (`past` / `current` / `future` / `skipped` / `failed`); `FileDropzone`;
  `SearchCombobox` static `options`, `multiple`, `values`, `variant`; `TimelineItem.icon` rendered + `tone`,
  `Timeline onItemSelect` / `showActor`; `Suggestion.group` / `icon` (LinkInput, TagInput); `IconStatCard trend`;
  `EmptyState`; `RichTextEditorHandle` (`insertText`, `insertHtml`, `focus`, `getHtml`) + `toolbarEnd`; `MonthInput`;
  `Stepper overflowCue` / `followCurrent`; `AssigneeGroup` list variant shows `description` under the name.
- **Integration (defaults and wiring)** — `FrappeForm` `menu?: boolean | FrappeFormMenuOptions | ReactNode | ((ctx) => ReactNode)`
  and `connections?: boolean | FrappeFormConnectionsOptions` (types exported; `FrappeFormMenuOptions.onOpened(doc, "duplicate"
  | "new")`); `FrappeFormView` `menu` also takes a function of `FrappeFormMenuContext` (`frm`, live `doc`, `dirty`, `reload`,
  `showTab`, `tabs`); `FrappeListCreate.onOpenFullForm` / `defaults`; `FrappeListViewProps.onQueryStateChange` (FrappeViews
  uses it to carry the List view's filters and sort); `FrappeProviderProps.userDefaults` / `FrappeSettings.userDefaults`;
  Core `ColumnDef.status` (`color` / `tone` / `variant` → the default cell renders a `StatusBadge`).
- **Simulator (`@solvfast/ui/frappe/testing`)** — handlers receive a `FixtureContext` (exported type: permission engine,
  `assertDoc` / `assertDoctype`, the transport's row filter `rows`, `printSettings()`, clock, user, options); two-argument
  handlers still work. The entry re-exports `KANBAN_BOARD_FIXTURE_META`, `VIEWS_DEMO_META`, `viewsDemoBackend`.
  SIMULATED handlers for `get_group_by_count`, `get_sidebar_stats`,
  `save_listview_settings`, `get_open_count`, `get_html_and_style`, `communication.email.make`, `get_email_template`,
  `create_new_reminder`, `get_kanban_boards`, `update_order_for_single_card`, `calendar.get_events`.
- **Showcase** — SIMULATED pages `#frappe-form-p35`, `#frappe-record-actions`, `#p35-list`, `#frappe-views`; Core pages
  `core-fields`, `file-dropzone`, `combobox-p35`, `empty-trend`, `record-p35`, `editor-stepper-p35`, `record-extras`.

### Changed (behaviour visible to 0.6.0 consumers)
The 32 behaviour changes reported by the integration (`ws/integration.md` §2), in its order, then the export signatures.

**Integration**
1. `FrappeForm` renders Desk's ⋯ menu (`FrappeRecordMenu`) by default; `menu={false}` opts out, a node replaces it.
2. `FrappeForm` adds a "Connections" tab by default when the DocType has a dashboard (`meta.__dashboard` with
   transactions); a form without Tab Breaks therefore gets a "Details" + "Connections" tab bar. `connections={false}` opts out.
3. Duplicate / New from that menu open the unsaved document in the same form; saving it inserts a new document. The form's
   `name` prop is unchanged — route with `menu.onOpened`.
4. `FrappeForm` no longer passes the loaded docinfo, or offers Reload, when the shown document is not the loaded name
   (local copy, new document, saved amendment). Before, a saved amendment and the cancelled original shared docinfo.
5. `FrappeProvider` forwards `boot.userDefaults` to new documents (FrappeForm, Quick Entry, list create);
   `userDefaults={false}` opts out; the app's own `newDocDefaults.userDefaults` wins.
6. `FrappeListView create={{ … }}` with neither `render` nor `onCreate`: before, no Add button; now Add opens
   `FrappeQuickEntry` (eligible DocType), or calls `create.onOpenFullForm`, or shows the Quick Entry dialog with the whole form.
7. `FrappeViews` carries the List view's filters and sort into the other views.
8. `TagInput` closes its suggestion list after Enter / comma creates a tag.
9. Simulator (`@solvfast/ui/frappe/testing`, SIMULATED): record / list / views handlers refuse through the permission
   engine (if_owner, User Permissions, shares) with Frappe's messages instead of a role-only check; `get_group_by_count` /
   `get_sidebar_stats` apply child-table filters and row permissions, equal counts ordered by value; `get_events` supports
   every simulated operator and needs read, `update_order_for_single_card` needs write; `get_docinfo` lists stored
   Communications and `get_communications` returns them (was `[]`); a stored "Print Settings" single also governs the
   builtin multi-PDF print check.

**Form**
10. **Ctrl/⌘+S runs the visible primary action** (Save / Submit → confirm / Update / Amend; Desk's
    `trigger_primary_action`), at document level, only the topmost form; it blurs the focused input first and does nothing
    with `saveDisabled`, without rights or while workflow actions replace the buttons; `hotkeys={false}` opts out. Before:
    save / update, only with focus inside the form.
11. A dirty submitted document shows **Update and no Cancel** (toolbar.js:668-689).
12. **Amend needs the amend and the create right.**
13. Duplicate / Amend copies start from the new-document defaults, with `__run_link_triggers` and `modified_by` reset
    (`no_copy` fields get their default; child rows keep `_amended_from`).
14. **Link "Create a new X" needs the target's create right by default** (was: whenever `onCreateNew` was given).
15. **The open-record link is hidden without read on the target**, and for a session without roles. App overrides
    (`canCreate`, `linkHref`) still decide alone.
16. **Unsupported fieldtypes** (Signature, Geolocation, Barcode, Icon, …) **are read-only** and listed in the form's
    banner (were editable text boxes).
17. `""` in a required field no longer forces a collapsible section open (only `null`, section.js:150).
18. A new document of a workflow DocType gets the workflow's default state.
19. The form header shows the `image_field` avatar and "See on Website".
20. `frm.save("Submit")` asks for confirmation first (Desk `savesubmit`).

**List**
21. **`FrappeListView` shows the page-size picker by default** (20 / 100 / 500 / 2500, stored in `user_settings`
    `List.sf_ui.pageSize`); `pageSizes={[]}` hides it.
22. **System Managers see four more ⋯ entries:** User Permissions, Role Permissions Manager, Customize, List Settings
    (`menu={{ … : false }}` per entry). Import also navigates through `onNavigate` when given.
23. **The empty-state "Create your first …" needs the create right** (was ungated).
24. **The localStorage saved-filter adapter rejects duplicate names** (it replaced them).
25. **Workflow DocTypes get the workflow indicator by default** (`workflow={false}` opts out); with the width cap it takes
    Desk's Status slot.
26. The Frappe group-by "no value" bucket is labelled **"Not Set" / "No Tags"** (was "—"); Assigned To / Tags rows go into
    one group per user / tag, user groups labelled with full names.
27. Saved filters ask for confirmation before removal (System Managers also get an "Is Global" checkbox in FrappeListView).
28. Group-row React keys are prefixed by the group.

**Core**
29. `AssigneeGroup variant="list"` renders `Assignee.description` as a second line (rows without one are unchanged).
30. `RichTextEditor` is a `forwardRef` component: JSX use is unchanged; calling it as a plain function no longer type-checks.
31. `SearchComboboxProps.search` / `onSelect` are optional.
32. `TimelineItem.icon` is rendered (it was ignored).

Also from WS1 (not in the integration list): workflow transitions run Desk's pre-steps — mandatory check (incl.
`mandatory_depends_on`) → `before_workflow_action` → `apply_workflow` → `after_workflow_action`; `frm.save()` checks the
right first.

**Export signatures** (no export removed; every change widens, but these can be noticed):
- `RichTextEditor`: function component → `ForwardRefExoticComponent<RichTextEditorProps & RefAttributes<RichTextEditorHandle>>`.
- `GroupByOption.groupOf` may return `GroupBucket | GroupBucket[]`: code that *calls* it must handle an array; code that
  implements it is unaffected.
- `SearchComboboxProps.search` / `onSelect` are optional — a narrowing only for code that reads the props.
- `Messages` gained required keys and the message-key union grew: a full hand-typed `Messages` object, or a `t` typed
  against 0.6.0's keys passed to `operatorLabel` / `TimelineContext.t` / `buildFrappeListMeta` / `columnsFromMeta` /
  `filterFieldsFromMeta`, no longer type-checks. `useLocale().t` and `Partial` messages are unaffected.
- `FormController`, `DocStore` and `FormServices` gained required members (undo / redo / canUndo / canRedo, custom buttons,
  `save`, `checkMandatory`, `selectedWorkflowAction`, `eraseHistory`, `builtin`): only hand-written mocks need them.
- Widened (optional props / params, new union members): e.g. `ListViewProps`, `ColumnDef` (`mobile`, `status`),
  `FrappeListViewProps`, `FrappeFormProps` / `FrappeFormViewProps` (`menu` also a function), `FrappeProviderProps`
  (`userDefaults`), `FixtureHandler` (optional `ctx`), `BulkAction.run` / `resolveBulkActions` / `SavedFiltersStorage.save`
  (optional extra parameter), `copyDoc` / `amendDoc` / `buildLayout` (optional option), `FrappeListOptions.workflow`
  (accepts `false`). `FormSkeleton` moved to its own module and is still exported from `@solvfast/ui/frappe`.

### Fixed (native Frappe 15.110 mismatches, `docs/audit/p35/C-native.md`)
- F1 Ctrl+S (above). F2 workflow pre / post steps (above). F3 getdoc `_link_titles` are kept and seed the link-title cache,
  so saved forms show Link titles without a search. F4 Link create / open permission defaults (above). F5 Update without
  Cancel (above; `tests/parity/review-r1.test.ts` updated to the native expectation). F6 in-app navigation:
  `onDirtyChange` + `useUnsavedChangesBlocker`. F8 Amend right and copy defaults (above). F7 stale `docs/FRAPPE.md` /
  `docs/LIMITATIONS.md` (Docs below). **F9 not fixed:** no source boundary rule yet forbids `src/frappe/**` from importing
  `./testing` (the dist rule exists).

### Docs
- `docs/FRAPPE.md` rewritten: the entry's contents, every whitelisted method called (rows via `reportview.get`;
  `get_list` for lookups only), writes, `user_settings`, realtime, validation status.
- `docs/LIMITATIONS.md` rewritten for 0.7.0-dev.1: no authenticated real-site validation, simulator-only areas, views not
  implemented and why, known bugs; stale "Not supported: child tables, realtime, per-user list settings" removed.
- `docs/components/forms.md` (P35 APIs, behaviour changes, regenerated fieldtype table — Attach uploads), `record.md` §5,
  `list.md` (stale "selection-bar buttons only", "sidebar not reproduced", "List Settings read only" removed),
  `views.md` (new), `p35-core.md` (new) — both now shipped (`package.json` `files`); integration added forms.md §2.3 / §2.4
  (provider defaults, menu / connections / `FrappeFormMenuContext`), list.md `create` defaults and `onQueryStateChange`,
  record.md / views.md simulator notes, p35-core.md status columns and TagInput.
- `docs/audit/p35/COVERAGE.md`, `docs/audit/p35/CRM-MIGRATION.md` (new); `docs/release/COMPONENT-COMPLETION-MATRIX.md` and
  `LISTVIEW-FRAPPE-PARITY.md` marked superseded where stale.

## [0.6.0] — 2026-11-06

Version decision: **0.6.0** (minor), not 0.5.1. Reason, checked on the public surface `v0.5.0..HEAD`: `src/index.ts` gains
new exports (ExportDialog, DataImportDialog, the import model / views / labels, buildCsv / parseCsv / saveBlob …);
`src/frappe/index.ts` and `package.json` `exports` are unchanged; nothing is removed or renamed (`GroupedImportWarnings` /
`ImportFieldOption` are now aliases of identical Core types; `ExportDialogLabels` gains optional keys). Behaviour visible to
existing consumers changes on purpose: `FrappeExportDialog` labels follow the language (Arabic under `ar`), an empty
selection shows a hint, the File Type resets to CSV on each opening, and both import / export dialogs keep wide content
inside at phone widths. New public API + intentional visual change = minor under the policy above. Dev builds were numbered
0.5.1-dev.1 … dev.5 before this check; they continue as 0.6.0-dev.N. No release commit or tag.

### Added (additive; dev builds 0.6.0-dev.N — not released)
- **Core `ExportDialog`** (core entry): the Design System's Export Data dialog without a backend — File Type, Export Type
  (All / Filtered or Selected (n) / 5 Records / Blank Template, optional counts), field groups with label, key and
  "(Mandatory)", Select All / Select Mandatory / Unselect All, `lockMandatory`, `defaultSelection`, validation (nothing
  selected), loading, error (`renderError`) and success (closes) states; en / ar labels from the message catalogue
  (`export*` keys). `onExport({ fileType, records, fields })` — the host writes the file. Utilities: `buildCsv`,
  `parseCsv`, `saveBlob`, `mandatorySelection`, `orderedSelection`.
- `ExportDialog`: `filtered` (default Export Type = Selected (n) with a selection, else Filtered Records when the list is
  filtered, else All Records; never Blank Template unless `defaultRecords` asks), `ExportField.note` (e.g. a conditional or
  update-only requirement shown after the key).
- Import requirements: `ImportField.requiredOn` (create-only / update-only mandatory), `ImportField.requiredWhen`
  (conditional: `{ test, label, on }`), `validateImport(…, importType)` and `isMandatoryFor`; Update Existing Records checks
  that each row matches an existing record (no duplicate flags then).
- **Core `DataImportDialog`** (core entry): the Data Import tool's steps (Upload → Preview → Import → Result) behind a
  `DataImportAdapter` (`parse`, `fields` with mandatory / per-value checks / aliases, `duplicates`, `run` or
  `runUnavailable: reason`, `template` → the Core ExportDialog). Client-side auto-mapping, per-row validation, duplicate
  detection (existing records and within the file), column mapper, duplicate handling, progress and the run's result —
  never a success the run did not report. Model: `autoMapColumns`, `validateImport`, `importableRows`,
  `importPreviewColumns`. Views: `ImportPreviewTable`, `ImportWarningsPanel`, `ColumnMappingForm`. Labels:
  `DATA_IMPORT_LABELS_EN/AR` (moved to Core, still exported from `/frappe`), `IMPORT_DIALOG_LABELS_EN/AR`.

### Changed (no API change)
- `FrappeExportDialog` renders the Core `ExportDialog` (same props, same `download_template` request); its labels now
  default to the catalogue (Arabic under `language: "ar"`), and an empty selection shows "Select at least one field".
- A host re-render with new-but-equal `groups` / adapter no longer resets the user's picks in `ExportDialog` or the
  unsaved column mapping in `DataImportDialog` (reset only on open or a structural change).
- Phone widths: the Export / Data Import dialogs (Core and `FrappeDataImport`) keep their content inside the dialog
  (`grid-cols-[minmax(0,1fr)]`): a wide preview grid scrolls horizontally instead of widening the dialog past the screen.
- `FrappeImportPreview`, `FrappeImportWarnings`, `FrappeColumnMapping` render the Core views; `FrappeDataImport` keeps its
  server orchestration (every step a server request) on those views.

## [0.5.0] — 2026-11-06

### Added (additive API and an opt-in visual mode = minor per the policy above; tested as dev builds 0.4.1-dev.1 … dev.2)
- **Desk's selection layout for the List View** (Frappe 15.110 `list_view.js:590-598, 1613-1634, 1855-2127`): `ListView` /
  `FrappeListView` `selectionMode="header"` — no bar row; the header shows "{n} items selected" + Clear; the toolbar's new
  `primaryAction` gives way to an **Actions** menu (`ListActionsMenu`) while rows are selected. Default `"bar"`: no change for
  existing consumers. Shift-click range selection (`:1400-1421`).
- **Typed bulk actions**: `BulkAction` gains `tone`, `hidden(ctx)`, `disabled(ctx)` (with a reason), `confirm`, `group`;
  `resolveBulkActions`, `useBulkActionRunner`, `BulkActionContext`, `BulkActionConfirm`.
- **`AssignDialog`** (Core): Desk's Assign To dialog — users, Assign to me (also for single-assignee hosts), current assignees,
  optional Complete By / Priority / Comment.
- **`useFrappeBulkActions`** (`/frappe`): Desk's Actions (order, gates, workflow items asked on every opening, dialogs) as data;
  `FrappeBulkActions` renders the same as bar buttons. `FrappeListView` `selectionMode="header"` uses it (Assign To → `AssignDialog`).

### Fixed
- `ListView.onSelectionChange` fired only when the NUMBER of selected rows changed: unchecking A and checking B in one update
  left a host that mirrors the selection with A — and its bulk action on the wrong record. It now fires on
  every change of the selected set.

## [0.4.0] — 2026-11-04

Frappe-integrated components: the `@solvfast/ui/frappe` entry (client, provider, hooks, `FrappeListView`, `FrappeForm`,
workflow, assignment, timeline, Import / Export, permissions) and the simulator `@solvfast/ui/frappe/testing`; the CRM
handoff is `docs/release/CRM-HANDOFF.md`. **Known limitation:** the Frappe layer is verified against recorded 15.110
responses and the simulator only; no authenticated real-site session or write has been verified yet (docs/LIMITATIONS.md).

### Added
- **Desk Like (the list's favorite heart).** Core `LikeToggle` (a `<button aria-pressed>`, not optimistic, pending /
  error states) and `ListTable` / `ListView` `like`; `FrappeListView` shows it by default for a logged-in user
  (`like={false}` to opt out, `onLikeError`), toggles through `frappe.desk.like.toggle_like`, updates the cached rows
  without a reload, and offers Desk's "Liked by me" filter (`_liked_by like %user%`). Simulator support.
- **Attach / Attach Image upload** in `FrappeField` / `FrappeForm` (`FrappeAttachField`): file picker → `upload_file`,
  attached to the saved document, private unless the field / DocType makes attachments public, `file_url` stored,
  pending and error states, image preview, Clear.


Work towards 0.4.0 (Frappe-integrated components) on branch `feat/0.4.0-frappe`; see docs/CONTRACT-0.4.md.

### Already in the published 0.3.0 tarball but missing from this changelog (published content ≠ tag `v0.3.0`)
- Column manager: PMO's design (`66af191`).
- Date filters like Frappe's — timespans, `between` on dates (`63bbd1b`).

### Added (in progress)
- `@solvfast/ui/frappe`: the 0.4.0 integration contract (`contract.ts`): metadata bundles, documents and docinfo,
  permissions, structured errors, client surface (documents, workflow, assignment, comments), query keys and
  invalidation rules, realtime port, simulated-backend input.
- Real Frappe 15.110 metadata fixtures (`tests/fixtures/real-15.110/`) and the read-only capture script.

## [0.3.0] — 2026-10-19

Additive: every component in PMO's `components/ui` is now in the package, in the package's look, so PMO and new
BildFast projects can import them from `@solvfast/ui`. Two new entries with optional peer dependencies:
**`@solvfast/ui/chart` needs `recharts` 2**, **`@solvfast/ui/form` needs `react-hook-form` 7** (docs/CONSUMING.md §7).
Apps that don't use the new parts see no change: the existing parity suites were rerun (docs/VALIDATION.md).

### Added — Design System v0.3.0 primitives (as in PMO)
- `Alert` (`AlertTitle`, `AlertDescription`), `Progress`, `Toggle` (+ `toggleVariants`), `ToggleGroup` / `ToggleGroupItem`,
  `StatusDot`, `Pill`, `Accordion` (`AccordionItem`, `AccordionTrigger`, `AccordionContent`), `Collapsible`
  (`CollapsibleTrigger`, `CollapsibleContent`), `Breadcrumb` (`BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`,
  `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis`), `Pagination` (`PaginationContent`, `PaginationItem`,
  `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`), `Slider`, `AspectRatio`, `HoverCard`
  (`HoverCardTrigger`, `HoverCardContent`), `ContextMenu` (+ 14 parts), `Menubar` (+ 15 parts), `NavigationMenu`
  (+ 7 parts and `navigationMenuTriggerStyle`).
- Their popups render inside the theme scope and carry the package's popper glass, as the dropdown menu does (hover
  card, context menu, menubar; also the navigation menu's panel, which Radix keeps inline).
- Arabic: pagination and breadcrumb strings come from the package messages; their chevrons, and the context-menu and
  menubar sub-menu chevrons, point the reading way; `Progress` fills from the right.

### Added — from PMO
- `SearchCombobox` (+ `ComboOption`, `SearchComboboxProps`): PMO's async combobox (Link fields, repo pickers) without
  React Query. It loads when opened and 200 ms after typing stops, ignores late answers to older searches, and shows
  "Loading…" instead of "empty" while a search runs. Same props; `queryKey` is optional (a reset key).
- `RichText`, `RichTextEditor`, `sanitizeHtml`, `htmlIsEmpty`: PMO's rich-text editor and viewer, with the package's
  field look and toolbar labels in Arabic and English. The rich-text styles ship in theme.css / full.css (`.sf-rich-text`).
- `PageHeader` (back button, title, subtitle, details row, actions; router-free: `onBack`) and `EditableTitle`.
- New message keys: `back`, `loading`, `pagination`, `previous`, `next`, `morePages`, `breadcrumb`, `editTitle`,
  `textFormatting`, `bold`, `italic`, `underline`, `strikethrough`, `bulletedList`, `numberedList`.

### Added — new entries (optional peer dependencies; the core never imports them)
- **`@solvfast/ui/chart`**: `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`,
  `ChartStyle`, `ChartConfig` — the Design System's chart helpers. **New optional peer dependency `recharts`
  `^2.15.0`.**
- **`@solvfast/ui/form`**: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`,
  `FormMessage`, `useFormField` — the Design System's react-hook-form bindings. **New optional peer dependency
  `react-hook-form` `^7.50.0`.**

### Added — shell
- `PageHeader` inside `AppShell`: a text title becomes the top bar's title (the page's one `<h1>`, as on Sear's pages)
  while the header is mounted. The header then shows only its back button, subtitle, details and actions. AppShell's
  `title` prop still wins; outside a shell the header has its own `<h1>`.
- `MobileNav` `primary` (also `AppShell` `mobile.primary`): the app picks the mobile bar's items, and "More" lists the
  whole navigation tree. Without it nothing changes (an app whose navigation is all groups got only "Home" and "More").

### Changed
- **`ColumnManager` is PMO's column picker (Frappe CRM's), at the owner's request.** It replaces Sear's checkbox list
  with up/down buttons, so `ListView` and `FrappeListView` get it too:
  - the shown columns are rows you drag by their grip (mouse, touch or pen), or move with ↑ / ↓ on the focused grip;
    the new position is announced;
  - × removes a column;
  - **Add column** opens a searchable list of every other field.
  - Locked columns stay listed at the top. Keys the menu doesn't manage (locked, or not loaded yet) keep their place.
  - New messages: `editColumns`, `addColumn`, `moveColumn`, `moveColumnHint`, `removeColumn`, `columnMoved`,
    `lockedColumn`.
- **Date filters work like Frappe's, at the owner's request** (frappe/public/js/frappe/ui/filters/filter.js):
  - Datetime fields (e.g. Created On) offer Is, After, Before, On or After, On or Before, Between, Timespan and Fiscal
    Year. Date fields also offer Equals / Not equals.
  - "Is" takes Set / Not Set. Between takes From / To (either may be empty). Timespan offers Frappe's 24 periods.
    Fiscal Year offers the site's fiscal years.
  - New operators `between`, `timespan` and `fiscal_year`, with values `"YYYY-MM-DD,YYYY-MM-DD"`, a TIMESPANS key and a
    FiscalYear name.
  - New helpers `operatorsFor`, `defaultOperator`, `operatorLabelKey`, `timespanRange`, `splitRange` / `joinRange`.
  - New props `fiscalYears` / `loadFiscalYears` on `ListView` and `FilterBuilder`. A new date condition starts on
    Between.
  - Client-side date filtering compares calendar days, as the Frappe layer already did: After 15 Oct excludes all of
    15 Oct. Timespans match Frappe's server dates, tested against Frappe 15.110's own output for 7 dates × 24 periods.
  - The Frappe entry sends `between`, Frappe's native `timespan`, and Fiscal Year as a `between` over the year. It reads
    the site's Fiscal Year records (ERPNext) only when the filter opens or a query needs them, once per session; none
    means the option isn't offered. `fiscalYears={false}` turns it off.

### Dependencies
- New: `@radix-ui/react-accordion` 1.2.20, `-aspect-ratio` 1.1.15, `-collapsible` 1.1.20, `-context-menu` 2.3.7,
  `-hover-card` 1.1.23, `-menubar` 1.1.24, `-navigation-menu` 1.2.22, `-progress` 1.1.16, `-slider` 1.4.7, `-toggle`
  1.1.18, `-toggle-group` 1.1.19. They are from the same Radix release as the existing pins, so they reuse the installed
  Radix internals (one copy each; no new internal packages).

### Fixed
- `DateField`, `TimeField`, `DateTimeField`: with an `id` and no `aria-label`, the field is named by its
  `<label htmlFor>`. Before, the name was always "Date" / "Time" / "Date and time", which overrode the label. The
  selected value is now the field's description. Without an `id`, nothing changes.
- Relative to PMO, `sanitizeHtml`: content inside any non-allowed element (`<font>`, `<section>`, a custom tag…) was
  not sanitized, so `<img onerror>`, `javascript:` links and `on*` / `style` attributes got through; `htmlIsEmpty`
  parsed the raw value into a live element (an `<img onerror>` would run); the editor wrote the raw value into the
  page. The package rebuilds the HTML from an allowlist, parses inertly, and only writes and emits sanitized HTML.
- Relative to the Design System: `Progress` passes `value` to Radix (it had no `aria-valuenow`); the display names of
  `MenubarShortcut` and `BreadcrumbEllipsis`.

### Not added (docs/LIMITATIONS.md)
- drawer (vaul), carousel (embla), input-otp, resizable (react-resizable-panels): apps keep their own shadcn copies,
  themed by the package tokens under `.sf-theme`.

## [0.2.0] — 2026-10-18

Additive: four components and a new entry. **Apps that import `@solvfast/ui/toast` need `sonner`** (1.7 or 2) —
docs/CONSUMING.md §5.

### Added
- `Table` (`TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) and
  `RadioGroup` / `RadioGroupItem`: the Design System's primitives, as Sear renders them.
- `Stepper` (`StepperStep`, `StepState`): the Design System's stepper pattern, identical to Sear's. Labels and notes
  take a string or `{ en, ar }`.
- New entry **`@solvfast/ui/toast`**: `Toaster` (the Design System's sonner host — theme- and direction-aware) and
  `toast`.
- New dependency `@radix-ui/react-radio-group` 1.4.7, the version Sear runs. It reuses the Radix internals already
  installed.
- **New optional peer dependency `sonner` (`^1.7.0 || ^2.0.0`).** It is needed only for `@solvfast/ui/toast`. The
  app's own sonner is shared, so `toast()` from "sonner" reaches the package's `Toaster`.

## [0.1.0] — 2026-10-18

The first release, for GitHub Packages (`@solvfast` organisation, private; install with a token — docs/CONSUMING.md).
It is 0.1.0-rc.1 plus the changes below. Frappe layer: simulated-request tests passed; real-site validation is
deferred until the first real-project integration (not done).

### Changed
- **Licence: proprietary.** LICENSE: Copyright (c) 2026 Solvfast, all rights reserved; only Solvfast and those it
  authorises may use, copy or modify the package. `package.json` `license` is `UNLICENSED` (0.1.0-rc.1, never
  published, said `MIT`). README and docs say the same.
- `THIRD-PARTY-NOTICES.md`: the MIT notice of shadcn/ui, from which the primitives derive (via the Design System).
  It ships in the tarball.
- `THIRD-PARTY-NOTICES.md`: also the MIT notice of tailwindcss-animate, whose generated keyframes are in
  `dist/styles/full.css`.
- Docs: CONSUMING — integrating into an existing app (a host that already uses `tailwindcss-animate`, or `@tailwind`
  directives; an app that already owns theme and language), from the Sear integration rehearsal.

### Added
- `StatCard`: the Design System's stat card (liquid glass, label, large value, optional up/down trend pill).
- `IconStatCard`: Sear Studio's overview card (pane, tinted icon square, name, total).
- Both are static by default; `href` makes a link and `onClick` a button. Numbers are formatted for the language.
  Pixel parity with the sources is recorded in docs/VALIDATION.md.

### Changed — Sear's look for tabs, dialogs and the calendar
- **Tabs** look like Sear's `SegmentedTabs` (used across Sear, e.g. the Working Hours form): a liquid-glass pill rail
  with pill tabs, the active one in the primary colour. Was the DS underline strip. Same Radix API and keyboard
  behaviour; full-width and compact are classes (see the showcase).
- **Dialog and AlertDialog** are glassy: Sear's `.sear-glass-dialog` treatment (the poppers' liquid glass) instead of
  the DS aurora gradient, with fallbacks for reduced transparency and browsers without backdrop-filter.
- **Calendar** on its own has the date pickers' glass and rounded corners instead of the DS's opaque, square
  gradient panel. Date pickers are unchanged.

### Added (repository only, not in the package)
- `showcase/`: a browsable component site with live examples of the package's real components, in light/dark and
  Arabic/English (`npm run showcase`, `showcase:build`, `showcase:preview`; `e2e/showcase-smoke.mjs`). See
  showcase/README.md.

## [0.1.0-rc.1] — 2026-10-17 — release candidate (not published)

The first release candidate: theme and primitives (5.1), app shell (5.2), List View (5.3) and the optional Frappe
layer (5.4), with the changes from their reviews. Not published; the owner publishes (docs/RELEASING.md).

**Validation status:** core verified (unit tests, pixel parity with Sear's real components, clean installs for both CSS
paths). Frappe layer: simulated-request tests **passed**; **real-site validation deferred** until the package is
integrated into a real project — not done (docs/LIMITATIONS.md).

### Release preparation (5.5)
- `package.json`: version `0.1.0-rc.1`; `repository` (`solvfast/solvfast-ui`); the tarball also carries CHANGELOG,
  VENDORED and the user docs; scripts `check:package` and `prepublishOnly` (refuses to publish without a clean tree, a
  `v<version>` tag on HEAD and a named copyright holder).
- Package audit in the build (`scripts/check-package.mjs`): exports exist and have types, every import in `dist/` is a
  declared dependency, no unused dependency, no absolute local path in the tarball.
- Docs: `docs/LIMITATIONS.md` (one list of what is not done, not verified or intentionally different),
  `docs/RELEASING.md` (checklist), README rewritten, install-from-GitHub-Packages section in CONSUMING.
- `e2e/frappe-site/`: a prepared real-site validation procedure — **never run**.

### Fixed (5.5)
- Frappe types: `useFrappeMeta`'s `refetch` no longer exposes `@tanstack/query-core` types in the published
  declarations (that package isn't a dependency; strict installers couldn't resolve it). It is now
  `() => Promise<void>`.

### Added — increment 5.4 (Frappe layer, `@solvfast/ui/frappe`)
- `FrappeListView` (ListView over a DocType), `useFrappeList`, `useFrappeMeta`, `FrappeProvider`, `createFrappeClient`
  (same-origin session cookie + CSRF; replaceable transport), `FrappeError`, `frappeRetry`, `invalidateFrappeList`,
  and the pure helpers `buildFrappeListMeta`, `columnsFromMeta`, `filterFieldsFromMeta`, `queryToFrappe`,
  `conditionToFrappe`, `buildListRequest`, `frappeLinkSearch`. Stock methods only: `getdoctype`, `client.get_list`,
  `reportview.get_count`, `search.search_link`. Docs: docs/FRAPPE.md.
- Core additions used by it (usable on their own): `ListView` `searchHint`; `useListState` `selectionScope`; rich-text
  cells (Frappe Text Editor HTML) shown as plain text; messages `fieldId`, `fieldCreated`, `fieldModified`,
  `searchTitleOnly`.
- Rule C2 (Frappe's single `or_filters` list): search uses it across the search fields with "Match all" filters, and
  narrows to the title field with a visible note with "Match any" filters.

### Fixed — Frappe (relative to Sear's never-run Frappe path; docs/FEATURES.md)
- Totals honour "Match any" filters (`reportview.get_count`; Sear sent `or_filters` to `frappe.client.get_count`,
  which drops them).
- Requests never name fields the DocType doesn't have (an old saved filter or a render-only column made Frappe
  reject the whole request).
- A date on a Datetime field matches the whole day; Dynamic Link fields filter as text; ID / Created On / Last Updated
  are localized; link filter values use Frappe's link search.

### Changed — after the 5.3 review
- List View: every filter-row control has an accessible name (Field / Condition / Value / Match); they were unnamed
  comboboxes, as in Sear and PMO.
- List View: no pager or total while the list shows an error.
- List View on phones: the toolbar's buttons wrap instead of widening the page (Sear's list page was 506 px wide at
  390 px, with its page action cut off). Desktop unchanged.
- List View, grouped: all groups are sections of one table (a header row per group with collapse, count and the
  group's select-all), so they share the header's column order and widths; the table scrolls horizontally inside its
  card when narrow. The header's select-all covers the rows on screen (expanded groups). Was one table per group (PMO),
  whose columns didn't line up. New message key `selectGroup`.
- Buttons: the glass variants (default, secondary, outline, ghost, destructive) now use the DS Button's documented
  motion — 180 ms hover, 120 ms press (design_system `button.tsx`, v0.3.0) — instead of the glass engine's 0.4 s /
  0.16 s, which they had in Sear. Nothing else changes: an audit of every element's transition on the primitives,
  shell and list pages differs only on buttons; no motion under `prefers-reduced-motion`; the list pager keeps
  Sear's 150 ms.

### Added — increment 5.3 (List View)
- `ListView` — Sear's data grid (toolbar, glass table, pill pager) with PMO's list features as props: selection and
  bulk actions, group-by, sort menu, quick filters of any type with a field picker, row actions with confirm,
  conditional row styles, keyboard rows, loading / empty / error states. Client and server data modes.
- `useListState` (headless) and the parts: `ListTable`, `GroupedListTable`, `DefaultCell`, `FilterBuilder`,
  `FilterValueInput`, `SavedFilters`, `ColumnManager`, `QuickFilters`, `SortMenu`, `GroupByMenu`, `ListPagination`,
  `BulkActionBar`; the filter model (`applyFilterQuery`, 12 operators), `compareValues` / `sortRows`, `groupRows`,
  `mergeColumns`, storage adapters (`createLocalStorageAdapter`, `ListPrefsStorage`, `SavedFiltersStorage`).
- List strings in Arabic and English. Coverage per feature: docs/FEATURES.md.

### Fixed — list (relative to Sear and PMO; details in docs/FEATURES.md)
- Row actions are a fixed last column — no longer offered in the column manager, the filter fields or sorting.
- Non-sortable columns have no sort button; sorted headers carry `aria-sort`; rows open with Enter.
- Load errors are shown with Retry (Sear's grid showed nothing).
- Sorting: empty values last in both directions; text such as "Room 101" no longer sorts as a date; natural order.
- Server mode: search and text filters wait for a typing pause (one request, not one per keystroke).
- Selection is pruned when search or filters change; a group's select-all reflects that group.
- Filter value inputs keep focus while typing; filter condition ids never collide.
- Saved-filter storage failures reach the app (`onSavedFiltersError`) instead of being swallowed.

### Added — increment 5.2 (app shell)
- `AppShell`, `Sidebar`, `Navbar`, `MobileNav`, `AppSwitcher`, `NotificationPanel` — Sear's StudioShell with its
  navigation, routing, switcher sections, notifications, help and search supplied by the app; `NavItem` model with
  any nesting depth; `relativeTime` / `timeGroup`; shell strings in Arabic and English.

### Fixed — shell (relative to Sear)
- Notification panel is glass in dark mode too (Sear's dark override made it opaque).
- Mobile "More" sheet opens on the start edge in Arabic (Sear: the left edge).
- The app switcher highlights the current app (Sear's name comparison never matched).
- The top bar renders without a provider; app-switcher and shell labels are localized (Sear's were English-only).

### Added — increment 5.1 (foundation)
- Core entry `@solvfast/ui`: `ThemeProvider` (`useTheme`, `useLocale`, `usePortalContainer`), `cn`, and 23 primitives
  vendored from the DS v0.3.0 with Sear's effective look (VENDORED.md), plus `DateField` / `TimeField` / `DateTimeField`.
- Styles: `theme.css` + `glass.css` (+ opt-in `base.css`) for Tailwind 3 apps with the `tailwind-preset`;
  `full.css` (+ opt-in `full-base.css`) precompiled for apps without Tailwind.
- `LICENSE`: full MIT terms; the copyright holder is pending the owner's confirmation.
- Tooling: pinned `upstream/` sources, CSS extraction, boundary check, Sear parity harness (`tools/parity`),
  clean-consumer test (`e2e/consumers`).

### Fixed (relative to Sear / the DS)
- Popovers, selects and menus fall back to a solid surface under `prefers-reduced-transparency` and without
  `backdrop-filter` (Sear's popper glass out-ranked the DS fallbacks).
- Button motion durations 180/120 ms now emit CSS (DS D5) — effective on `ai-outline` and Calendar day buttons; glass
  buttons keep the glass engine's timings, as in Sear. No motion under `prefers-reduced-motion` (verified).
- Path B: Tailwind's preflight is also applied to the scope element's own `::before`/`::after`.
- Hooks never throw outside `ThemeProvider` (Sear's Navbar crashed without its provider).

## 0.4.0-dev.26 (2026-11-03, Phase 26 Lead pre-work)
- `canImport(meta, roles, level0)`, `canExport(roles, level0)`, `readableFields(fields, levels)` in `@solvfast/ui/frappe`
  (Desk `model.js:434-450`, server `permissions.py:600-615`): missing roles / meta / rights deny.
- `DocTypeMeta.allow_import`.
- Client file primitives: `api.download(method, args)` (a whitelisted method that streams a file; JSON refusals become
  `FrappeError`) and `api.uploadFile(file, filename, opts)` (`upload_file`, Desk's multipart fields). Stubbable through
  `createFrappeClient({ files })`; a client with a custom JSON `transport` and no `files` refuses file calls.
- `docs/release/COMPONENT-COMPLETION-MATRIX.md`.

## 0.4.0-dev.27 (2026-11-03, Phase 26 D — permissions)
- **Behaviour change (rule 9):** without `session.roles` nothing is granted beyond the server's `docinfo.permissions` of a
  saved doc; a NEW doc is denied (no fields, no Save) and `usePermissions().known` is false (FrappeForm shows "Read only").
  Pass `session.roles` to `FrappeProvider`. The Administrator USER keeps everything; the "Administrator" ROLE on another user
  is just its DocPerm rows.
- `bulkMenu`: Assign To gated on `read` (server: `assign_to.py:67-68`), was `write`.
- `permissionsKnown`, `isAdministrator` exported. `tests/parity/permissions-matrix.test.tsx` (31 tests, SIMULATED).
- `docs/release/PERMISSION-AUDIT.md`.

## 0.4.0-dev.28 (2026-11-03, Phase 26 C — list Import/Export)
- `FrappeListView`: list menu with **Import** (only when `canImport`; `onImport` or navigation to Data Import) and
  **Export** (only when `canExport`) → `FrappeExportDialog` → server `download_template` (Desk's Data Exporter request;
  the file comes from the server, never from client data). Props `onImport`, `menu`, `ioLabels`. Row checkboxes stay
  opt-in (`selectable` / `bulk`), unchanged from dev.27.
- `startDataImport` and friends reproduce Desk's Data Import call sequence (`savedocs` → `upload_file` → `savedocs` →
  `get_preview_from_template` → `form_start_import`), `useImportStatus` polls `get_import_status`. No preview grid / column
  mapper yet (owner decision). **All verified against stubs only; nothing has run on a site.**
- Columns of permlevel fields the user cannot read are dropped (`restrictMetaToReadable`) when the roles are known.
- Bulk Delete outcome wording: "N requested — the server reports failures in its messages" (`delete_items` answers nothing).
- `docs/release/LISTVIEW-FRAPPE-PARITY.md`: verdict **not Frappe-compatible yet** (missing list in §5).

## 0.4.0-dev.29 (2026-11-03, Phase 26 B — showcase; light-mode popups)
- Light mode: popovers, menus, select lists, command palette, hover cards, dialogs and sheets are solid white
  (`--popover`), no backdrop blur. Dark mode unchanged.
- Showcase (repository only, not in the tarball): "Frappe layer" group with 10 sections on an in-browser simulated
  site, every section labelled SIMULATED; smoke test extended (61 sections × light/dark × en/ar, 38 interactive checks).

## 0.4.0-dev.30 (2026-11-03, Phase 27 E — source maps)
- Source maps no longer embed the TypeScript source (`sourcemapExcludeSources`); they keep line mappings and relative
  `src/` paths. `scripts/check-package.mjs` fails the build when a shipped map carries `sourcesContent` or an absolute
  source path. Packed size 846 kB → 524 kB.

## 0.4.0-dev.31 (2026-11-03, Phase 27 B — list query)
- Nested-set filter operators (Desk's labels: Descendants Of / inclusive / Not Descendants Of / Ancestors Of / Not Ancestors Of), offered
  only for Link fields to tree DocTypes, sent to the server unchanged; en/ar labels.
- Width-based column limit (Desk `list_view.js:375-457`), URL filters (read and write-back), report-view export
  (`export_query` through `api.download`; on a real site it writes an Access Log row) — functions and `useFrappeList`
  options; `FrappeListView` wiring follows in the actions merge.
- Generic `useListState`: `initialQuery`; visible columns follow changes in the columns' default visibility until the user
  picks columns (List View Settings arriving after the first render now apply).

## 0.4.0-dev.32 (2026-11-03, Phase 27 A + B + C merged)
- **Permissions (A):** `FrappeFormView` without a `permissions` prop grants nothing (read-only, "Read only" notice);
  Cancel All only when the cancel rights are known to be true; workflow transitions come from the server's
  `get_transitions` (client-side filtering without roles offers none); the Administrator user without a role list behaves
  as Frappe 15.110 (every role: `permissions.py:506-507`); `canImport` / `canExport` accept the session.
- **List actions (B):** Desk's full Actions menu in the selection bar — Print (`download_multi_pdf`, background above 25),
  Clear Assignment, Apply Assignment Rule, Add Tags, workflow bulk approval — plus **Export offered to everyone as Desk
  does** (the server refuses; the dialog shows it) and **Import navigating to the Data Import list**.
- **List query (B):** `FrappeListView` now **caps generated columns by window width by default**, as Desk
  (`list_view.js:432-444`; app-curated `columns` are never capped; `columnLimit={false}` opts out); `urlFilters`,
  `treeDoctypes`, `hideNameColumn` forwarded; "Export as report" (`export_query`) in the list menu when `canExport`.
- **Import (C):** `FrappeDataImport` — upload, the server's preview and warnings, column mapping (`template_options`),
  Start / Retry, server-confirmed result, import log, errored rows.
- All of the above is tested against stubs / the simulator only; nothing has run on a site.

## 0.4.0-dev.33 (2026-11-03, Phase 27 D — simulator permissions)
- `@solvfast/ui/frappe/testing` only: `createFixtureTransport(backend, { permissions })` evaluates permissions server-side
  (roles as `get_roles`, DocPerm rows, `if_owner`, User Permissions, sharing, permlevel stripping and reset, 403s on
  writes, workflow roles, assignment, `download_template` / `export_query` with `can_export`); seven `simScenario.*`
  builders (Administrator, full access, read-only, restricted DocType, restricted fields, User Permissions, unknown roles).
  Without the option the simulator behaves as before. Handlers for the dev.32 methods (Print, tags, assignment, workflow
  bulk, report export, Data Import). Files it returns are labelled SIMULATED and carry labels and the request only — no
  document values, no counts. The production `./frappe` entry never imports it (`check:boundaries`).

## 0.4.0-dev.34 (2026-11-03, Phase 27.5 — handoff fixes and polish)
- **Fix — custom `rowKey`:** bulk actions, the selection-bar Export and the workflow menu sent the list's UI row keys as
  Frappe document names. `FrappeListView` now resolves the selection through a key → `name` map of every row it has
  shown (selection across pages included) — `documentNamesForKeys`; an unresolvable key withholds the actions.
- **Date display:** an editable Frappe Date field shows the site's `date_format`, like its read-only display
  (`DateField` gained an optional display-only `formatDisplay`; the value stays `YYYY-MM-DD`).
- **Assign To dialog:** DS `DateField` ("Complete by", with its purpose), DS `Select` (Priority; "Default (Medium)" sends
  nothing, as before), DS `Checkbox` / `Input` / `Textarea`, visible labels and hints; payload unchanged.
- **Dark mode:** Saved Filters, Columns and the filter builder's popovers use the DS glass (they were near-black);
  light mode unchanged.
- **"Export as report"** is opt-in (`menu={{ reportExport: true }}`): Desk's List View has no such entry.
- **Polish:** CommentComposer uses the DS Textarea and a DS Popover for @mentions; focus rings and `type="button"` on
  plain buttons (sort headers, group toggles, total, indicator pills, section headers, alert dismiss); translated DS
  file picker in `FrappeDataImport`; checkbox labels dim with their checkbox; form section columns stack on phones.
