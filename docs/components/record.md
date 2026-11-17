# Record layer — timeline, comments, assignment, lifecycle, status

Two layers, as in `docs/CONTRACT-0.4.md` §1:

| Layer | Folder | Entry | Knows Frappe? |
|---|---|---|---|
| Generic pieces | `src/record/` | core `@solvfast/ui` | No. Props in, callbacks out; renders in any React app. |
| Frappe wrappers | `src/frappe/record/` | `@solvfast/ui/frappe` | Yes. Built on the foundation hooks (`useDocAction`, `useDocInfo`, `useMetaBundle`, `usePermissions`, `useFrappeApi`). |

**Status (CONTRACT §4):** everything here is *Implemented* and *Simulated & tested* (stub client, `createFixtureTransport`, recorded
payload shapes). Nothing has been *Verified against real Frappe*. Native behaviour was traced from Frappe 15.110 source
(`docs/frappe-components/11 §7–8`, `14 §A`); points that were not traced are marked **UNVERIFIED**.

All components follow the shared UI rules: `Skeleton` while loading, an inline `role="alert"` message on errors, an own empty
state, logical (RTL-safe) utilities, design-system tokens only (light and dark), keyboard operation, and strings only through the
`recXxx` keys of the `frappe:record` message block (English and Arabic).

---

## 1. Keeping your own vocabulary

Every visible string has a default in the message catalogue and can be replaced in two ways:

1. **Per component**, with the `labels` / `actionLabels` / `heading` props (shown in each section).
2. **Globally**, per key, through `<ThemeProvider messages={{ en: { recAssignedTo: "Assignee" }, ar: { recAssignedTo: "المسؤول" } }}>`.

The CRM uses (1): "Assignee", "Status", "Actions", never "State" or "Workflow". Server-sent labels (state names, action names, field
labels) are passed through the optional `translate` prop (`translateLabel(bundle, text)` in apps with a bundle).

**Terminology (0.7.0, P36b).** The design system's own chrome calls Frappe's Workflow feature **Lifecycle** (Arabic
**دورة الحياة**): e.g. the list's bulk menu `listBulkWorkflow` = "Lifecycle" and `listBulkWorkflowNone` = "No lifecycle action
applies to all the selected documents". Only the visible defaults changed: message keys, component / hook / type names
(`FrappeWorkflowActions`, `useWorkflow`, `workflow` props), `data-*` / test ids, the Frappe methods (`frappe.model.workflow.*`),
fields (`workflow_state`, `workflow_state_field`), the DocTypes ("Workflow", "Workflow State", "Workflow Action") and every
server-sent text (state and action names, "Workflow Status", "Not a valid Workflow Action") are unchanged. A guard test
(`P36B.lifecycle.1`) fails if an en / ar message value says Workflow again.

```tsx
<FrappeWorkflowActions
  doc={doc} user={session.user} roles={session.roles} variant="actions" translate={(s) => translateLabel(bundle, s)}
  actionLabels={{ actions: "Actions", none: "No actions from this status" }}
/>
<FrappeWorkflowActions doc={doc} user={session.user} roles={session.roles} variant="rail" translate={(s) => translateLabel(bundle, s)} />
<FrappeAssignTo doc={doc} user={session.user} single variant="list" heading="Assignee"
  labels={{ assignedTo: "Assignee", none: "No assignee", add: "Set assignee", confirm: "Assign" }} />
```

---

## 2. Generic components (`src/record/`)

### 2.1 Shared types (`src/record/types.ts`)

`Tone` = `neutral | success | warning | danger | info | brand`. `TimelineItem` = `{ id, kind, at (epoch ms), actor?, actorId?, summary?,
body?, bodyFormat?, changes?, canEdit?, canDelete?, href?, icon? }` with `kind` one of `comment, change, assignment, attachment, state,
created, modified, info, like, communication, custom`. `Assignee` = `{ id, name, image?, description? }`. `UserOption` =
`{ id, label, image?, description? }`. `MentionOption` = `{ id, label, isGroup? }`. `LifecycleStateItem` = `{ id, label, tone?, by?, at?, step? }`
(`lifecycleStates` returns it: label and tone feed `FrappeWorkflowActions`' state badge; `by` / `at` / `step` are data for a host's own
lifecycle UI — no package component renders them).
`LifecycleActionItem` = `{ id, label, tone?, confirm?, disabled? }` (`confirm`: `true` = default text, a string = the body text).

### 2.2 `Timeline`

The activity feed. It renders what it is given; it never decides what the user may do.

| Prop | Meaning |
|---|---|
| `items: TimelineItem[]` | Already resolved entries. Sorted by `at` (ties keep the given order). |
| `order` | `"newest-first"` (default) or `"oldest-first"`. |
| `loading`, `error` | Skeleton block; or any node shown instead of the list (e.g. an error state). |
| `showFilters` | All / Comments / Changes chips (`Changes` = everything except comments). |
| `hiddenKinds` | Kinds never shown (the CRM hides `"state"`). |
| `hasMore`, `loadingMore`, `onLoadMore` | "Load more" button; the component never knows what pages. |
| `onEditComment(item, html)`, `onDeleteComment(item)` | Called after the user confirms. A rejection is shown under the comment. Buttons appear only when the **item** has `canEdit` / `canDelete` **and** the callback is given. |
| `searchMentions`, `composerLabels` | Used by the inline edit box. |
| `labels` | `all, comments, changes, loadMore, loading, empty, edit, delete, deleteTitle, deleteBody, cancel, heading, save`. |
| `now` | Fixed clock for relative times (tests). |

Comment bodies are HTML and are sanitised on render with `sanitizeCommentHtml` (see 2.3). Entries with `changes` get an expand button
that lists every before→after line; child-table rows show `Label #row`. Exported helpers: `filterItems`, `sortItems`.

### 2.3 `CommentComposer` and the mention markup

| Prop | Meaning |
|---|---|
| `onSubmit(html, draft)` | Receives HTML and `{ text, mentions }`. A rejection keeps the text and shows the message. |
| `searchMentions(query)` | Called (300 ms debounce) with the text after `@`. Omit to disable mentions. Late answers of superseded queries are dropped. |
| `initialHtml`, `onCancel` | Edit mode (shows Cancel; the button label is `labels.submit`). |
| `disabled`, `disabledReason`, `rows`, `autoFocus`, `labels` | `labels`: `placeholder, submit, cancel, noMatches, label`. |

Keyboard: `Ctrl/Cmd+Enter` submits; `ArrowUp/Down` and `Enter`/`Tab` drive the mention list (`role="listbox"` with
`aria-activedescendant`); `Escape` closes the list, or cancels in edit mode. As in Desk the Comment button appears only once there is text.

Output HTML follows the server contract (docs 14 A11.2): `<span class="mention" data-id="user@x" [data-is-group="true"]>@Label</span>`;
text is escaped, newlines become `<br>`. `draftToHtml` / `htmlToDraft` convert both ways (edit mode keeps existing mentions).

`sanitizeCommentHtml` is **not** the primitives' `sanitizeHtml`: that one re-creates elements without attributes, which would remove the
mention attributes and images. This one keeps `span.mention[data-id][data-is-group]`, safe `href` / `img src` (http(s), mailto, relative,
`data:image`), and nothing else. It parses inertly (`DOMParser`). It is exported from `src/record` only, not from the core entry.

### 2.4 `AssigneeGroup`, `AssignPicker` and `AssignDialog`

`AssigneeGroup` props: `assignees`, `onAssign(users, details)`, `onRemove(assignee)`, `canRemove(assignee)` (default: nobody),
`variant` (`"avatars"` stacked, Desk-like, or `"list"` named rows), `maxVisible` (default 4, then `+n`), `loading`, `heading`, `labels`,
plus the picker props below. Without `onAssign` there is no add button. `onRemove` failures are shown inline.

`AssignPicker` props: `searchUsers(query) → UserOption[]`, `onAssign(users, { description?, date?, priority? })`, `exclude` (already
assigned: shown ticked and not selectable, because the server would report them as duplicates), `me` (enables "Assign to me"), `single`,
`withDetails` (comment, "Complete by" date and priority as in Desk's dialog — DS `Textarea`, `DateField` and `Select` with visible labels and
hints; left empty, nothing is sent and the server uses today and Medium, `assign_to.py:73-90`), `trigger`, `disabled`, `disabledReason`, `labels`.

`AssignDialog` (0.4.1) is Desk's Assign To dialog as a DS `Dialog` (`form/sidebar/assign_to.js:87-240`) for one or many records: `open` /
`onOpenChange`, `searchUsers`, `onAssign(users, details)` (a rejection keeps it open with the error), `me` ("Assign to me" — also with `single`,
where it picks the user as the one assignee), `single` (one user; a hint says it replaces the current assignee), `count` ("{n} records
selected"), `existing` (current assignees, read-only), `details` (`true` or `{ description, date, priority }` — show only what the host can
store), `note`, `labels`. `FrappeListView`'s header mode uses it with every detail (→ `assign_to.add_multiple`).
Search is debounced (250 ms) and keyboard driven (combobox/listbox, arrows + Enter). `labels`: `assignedTo, none, add, search, toMe,
confirm, description, due, priority, low, medium, high, remove ("Remove {0}"), noMatches, cancel, dueHint, priorityHint, priorityDefault, clearDate`.

**P36c — `AssignDialog` `groups` (Desk's "Assign To User Group", `assign_to.js:142-160, 191-197`).** Optional, Frappe-free:
`groups?: AssignGroupSource` = `{ search(text) → Suggestion[]; members(group) → UserOption[]; label?; placeholder?; debounceMs? }`.
A `LinkInput` after the users list (Desk's field order); hidden with `single`. Picking a group **replaces** the users to assign with
its members, as Desk's `set_value("assign_to", members)` does — the earlier choice (and "Assign to me", unless you are a member) is
dropped, not merged; a repeated member row is listed once (`uniqueMembers` — a DS choice: Desk's pills keep an inner repeat and the
server answers it with "Already in …"; the Table MultiSelect refuses repeats when a group is edited in Desk, table_multiselect.js:108-111); an empty group empties the list (Add stays disabled, a
note says so); re-picking the same group or clearing it changes nothing; a refused search or members read is shown under the field
(`role="alert"`) and the list is kept. Strings: `sbAssignGroup`, `sbAssignGroupSearch`, `sbAssignGroupEmpty`, `sbAssignGroupMembers`.

### 2.5 `ActionBar`, `StatusBadge`

`StatusBadge { label, tone, variant: "pill" | "dot", title }`: the label is always shown; colour is never the only carrier.

The record's lifecycle is shown by `LifecycleRail` (where it is, where it can go: §8–9.4) with the header's `LifecycleActions`
(§9.4), both built on these two.

`ActionBar { actions, onAction, variant: "menu" | "buttons", busy, disabled, disabledReason, labels }`: an action with `confirm` opens an
alert dialog first. `onAction` may return a promise; a rejection is shown under the bar (`role="alert"`) and the action can be retried.
`labels`: `actions, none, confirmTitle ("… {0} …"), confirmBody, confirm, cancel, working`.

```tsx
<div className="flex items-center justify-between gap-2">
  <StatusBadge label="New" tone="info" />
  <ActionBar actions={[{ id: "win", label: "Mark won", confirm: "Close this deal as won?" }]} onAction={async (a) => api.apply(a.id)} />
</div>
```

---

## 3. Frappe wrappers (`src/frappe/record/`)

All wrappers need `FrappeProvider` (client, optional `session={{ user, roles }}`). **All writes go through `useDocAction()`**, which owns
the cache rules of the contract (a workflow action sets the *bare* doc under `frappeKeys.doc` and invalidates docinfo, list, count; comment
and assignment writes invalidate docinfo and list). The wrappers never touch the query cache themselves. Reads use `useDocInfo`,
`useMetaBundle` and `useFrappeApi`. A page that already holds `docinfo` or the meta bundle can pass `docinfo` / `bundle` and nothing is fetched.

| Needs | Why |
|---|---|
| DocType **Workflow** (+ **Workflow State**) | definition delivered inside `getdoctype` (`__workflow_docs`, `desk/form/meta.py load_workflows`); there is no separate call in Desk |
| **ToDo** | assignments (`assign_to.add/remove`); open ToDos are `docinfo.assignments` |
| **Comment** | comments, and the log buckets (`assignment_logs`, `attachment_logs`, `info_logs`, `like_logs`, `workflow_logs`) |
| **Version** | field changes; only exist when the DocType has `track_changes` (newest 10) |
| **Communication** | emails / phone / meetings in the feed (paged) |
| **File** | `docinfo.attachments` and attachment logs |

### 3.1 `FrappeWorkflowActions`, `useWorkflow`, `useWorkflowDefinition`

`<FrappeWorkflowActions doc user roles? variant? translate? confirm? onApplied? fallback? docinfo? actionLabels? className? />`

- `"compact"` (default) renders the current state (`StatusBadge`, tone from the Workflow State `style`; a state the workflow does not list
  shows its translated name, neutral) and the actions the user may apply now (`ActionBar`) — Desk's form toolbar (`FrappeForm`).
  `"actions"` is the header Actions menu alone and `"rail"` the Lifecycle card (§9.5); `docinfo` feeds the rail's who · when (3.6).
- Nothing for a new document (`__islocal`); `fallback` for a DocType without a workflow; a skeleton while loading.
- **Unsaved edits** (`__unsaved`): transitions are not fetched and the actions are disabled with a reason, because `apply_workflow`
  reloads the document from the database and discards posted edits (Desk hides them). Save first.
- `confirm`: `true` or `(action) => boolean` asks before applying (Desk applies immediately).
- `onApplied(doc, action)` gets the document the server returned, after the cache was updated.
- A server refusal ("Not a valid Workflow Action", "Self approval is not allowed", a 403 `PermissionError`, a validation error) appears
  under the bar; retry is possible. Nothing is applied locally before the server answers (the cache changes only on success).
- **Where the actions come from (since 0.4.0-dev.31, P2-3):** always the server's `get_transitions` answer, which read-checks the document
  and filters by state, by the session user's roles (`frappe.get_roles()`) and by `condition` (model/workflow.py:52, :64-68). That answer is
  authoritative even without `roles` — it is the list Desk filters again with the same roles (form/workflow.js:103). When it cannot be
  had, the state stays visible and the reason is shown instead of an empty Actions slot: a failed call → `FrappeErrorState` (Retry for
  transient kinds); an unknown `user` (empty) → only `allow_self_approval` actions plus the "Read only" notice marked
  `data-permissions="unknown"` (self-approval cannot be checked without the user).
- **Administrator** (`user === "Administrator"`): every transition the server lists, with or without `roles` — its roles are every Role
  (permissions.py:506-507), so no client role filter is applied; self-approval never blocks it (model/workflow.py:222).

`useWorkflow({ doc, user, roles?, enabled? })` returns `{ workflow, isLoading, error, state, transitions, needsSave, readOnly, transitionsKnown,
refetchTransitions, standardActions, apply(action), applying }`. `readOnly` is `true` for a saved doc when `roles` are unknown (rule 9; before
dev.31 it was `false`), never for the Administrator; `transitionsKnown` is `false` when the answer failed or the user is unknown. `useWorkflowDefinition(doctype, enabled?)` returns `{ workflow, isLoading, error }` from `getWorkflow` or, without it,
from `meta.__workflow_docs`.

Rules implemented (pure functions in `workflow.ts`, all exported):

| Function | Native source |
|---|---|
| `workflowFromMeta` | `__workflow_docs` → definition, merging each Workflow State's `style` / `icon` into the Workflow's state rows |
| `currentState`, `defaultState` | state field, else the first state whose `doc_status` equals the docstatus (`workflow.js get_state`) |
| `visibleTransitions(ts, { user, doc, roles?, fromServer? })` | `fromServer: true` = `ts` is the `get_transitions` answer (state, role and `condition` filtered by the server); Desk then keeps roles the user holds (when `roles` is given; not for the Administrator) and `hasApprovalAccess`. **Without roles and without `fromServer` (e.g. the definition's transitions computed client-side) → `[]`** (rule 9, since dev.31); without `user` only `allow_self_approval` transitions |
| `transitionsKnown({ user, roles?, fromServer? })` | `false` when `visibleTransitions` withheld something for lack of information — show "permissions unknown", not "no actions" |
| `hasApprovalAccess` | `user === "Administrator" || transition.allow_self_approval || user !== doc.owner` (repeated on the server) |
| `isReadOnlyState(wf, doc, roles?, user?)` | read-only when none of the user's roles equals the state's `allow_edit`; new docs never; roles unknown → read-only (rule 9); the Administrator never (same rule as `isWorkflowReadOnly`) |
| `workflowLockedFields` | the state field and every `update_field` stay read-only |
| `canCancelDocument`, `standardActionsUnderWorkflow` | Submit is never offered; Save only when dirty; Cancel only if no transition leads to a docstatus-2 state; the primary/secondary buttons give way to the workflow actions |
| `toneForStyle`, `lifecycleStates`, `lifecycleActions` | mapping to the state badge / rail labels (`LifecycleStateItem`) and the Actions menu items (`LifecycleActionItem`) |

APIs: `getdoctype` (definition), `frappe.model.workflow.get_transitions`, `frappe.model.workflow.apply_workflow` (via `RecordApi`).
Permissions: the user needs read on the document for transitions; the role per transition (`allowed`) is enforced by the server.

```tsx
const w = useWorkflow({ doc, user: "ann@x", roles });
w.transitions.map((t) => t.action);       // ["Approve", "Reject"]
await w.apply("Approve");                 // doc cache now holds the new state
```

### 3.2 `FrappeAssignTo`

`<FrappeAssignTo doc user userFullName? docinfo? canAssign? canWrite? searchUsers? onChanged? variant? maxVisible? heading? labels? single? withDetails? className? />`

- List: `docinfo.assignments` (open ToDos, **uncapped**). `assign_to.add` returns at most 5 rows, so after add/remove the docinfo is
  **re-read**; the return value is never used as the list.
- Add: any user who can *read* the document may assign (server rule, `assign_to.py:67`); `canAssign={false}` hides the button.
  Duplicates (an open ToDo already exists) are excluded in the picker. New documents cannot be assigned (`recSaveBeforeAssign`).
- Remove: shown for the assignee themself or when `canWrite` (Desk, `assign_to.js:358`); the server is more permissive.
- Default user search: `search_link("User", txt, { filters: { user_type: "System User", enabled: 1 } })`; replace with `searchUsers`.
- Side effects of the server worth knowing: assignment may share the document read-only with the assignee, may notify, and an Assignment
  Rule can (re)assign after any save (docs 14 A2). The list refreshes on the next docinfo read.
- `single`: the picker allows one user (the CRM's single Assignee). The server does not enforce this; the UI does not remove the previous
  assignee for you.
- APIs: `frappe.desk.form.assign_to.add`, `.remove`; `get_docinfo`. (`assign_to.close` and the sidebar layout: P36b.)
- **P36c — "Assign To User Group"** (`userGroups?: boolean`, default on; shown in the sidebar layout's "Add to ToDo" dialog — the group
  layout's popover has none, Desk has no popover). The list's Actions → Assign To dialog has it too (`FrappeListView bulk={{ userGroups }}`,
  default on, as `bulk_operations.js:225-238` reuses Desk's AssignToDialog; the opt-in bar's popover has none). Frappe wiring
  (`src/frappe/record/userGroups.ts`): groups through `search_link("User Group", txt)`; members exactly as Desk reads them —
  `frappe.desk.reportview.get_list { doctype: "User Group Member", parent_doctype: "User Group", filters: {"parent": group},
  fields: ["user"], limit: 20 }` (`frappe.db.get_list`, `db.js:5-26`): **at most the first 20 members**, as in Desk. The server checks
  read on User Group (child table → parent, `permissions.py:763-845`; DocPerms System Manager + Desk User, so every System User reads
  groups) and answers 403 "No permission for User Group Member" otherwise. Members are not filtered: disabled users are assigned, and
  users already assigned are answered by the server's "Already in the following Users ToDo list" message. Exports: `userGroupSource`,
  `getUserGroupMembers`, `searchUserGroups`, `userGroupMembersArgs`, `USER_GROUP_*` constants.

### 3.3 `FrappeTimeline`

`<FrappeTimeline doc user docinfo? bundle? activity? canComment? isSystemManager? canDeleteComment? canSeeField? translate? searchMentions? error? order? showFilters? hiddenKinds? labels? composerLabels? className? />`

Renders the comment box (if `canComment`, default true) above a `Timeline`. Nothing for new documents (Desk hides the timeline too).

**docinfo buckets → items** (`buildTimelineItems`):

| docinfo key | kind | text |
|---|---|---|
| (document) | `created`, `modified` | "{owner} created this", "{modified_by} last edited this" (current user → "You") |
| `comments` | `comment` | HTML body with rights (below) |
| `communications`, `automated_messages` | `communication` | "sender · subject" |
| `versions` | `change` / `state` | see version rules |
| `assignment_logs` | `assignment` | the Comment's content as sent |
| `attachment_logs` | `attachment` | "{user} attached {file}" / "removed attachment {file}" |
| `info_logs`, `workflow_logs` | `info`, `state` | "{user} {content}" |
| `like_logs` | `like` | "{user} liked this" |
| `milestones`, `views` | `info` | "{user} changed {field} to {value}", "{user} viewed this" |

`activity="communications"` reproduces Desk's switch-off mode (only communications, comments, created/modified). `share_logs` is
deliberately not read: no server code sets it, so Desk never shows sharing events either. Comment types Created, Submitted, Cancelled,
Updated, Deleted, Bot, Relinked are not in docinfo at all.

**Comment rights** (decided here, from props): edit = owner or Administrator; delete = (owner or `isSystemManager`) **and**
`canDeleteComment` (`can_delete("Comment")`, which stock Frappe grants only to System Manager and Website Manager). Writes:
`add_comment`, `update_comment` (server: Administrator or owner), `frappe.client.delete`. Mentions use
`frappe.desk.search.get_names_for_mentions`; a mention notification is created by the server on insert, not on edit.

**Version diff rules** (`formatVersion`, from `version_timeline_content_builder.js`, data shape from `version.py get_diff`):

- `data.comment` is shown as the single line.
- `changed`: `docstatus` 1 / 2 give "submitted / cancelled this document" lines; other fields give "{label} from {old} to {new}" parts
  joined as "{user} changed the value of …", **at most 3 parts**. Values have HTML stripped and are cut to 40 characters (empty → `""`).
- `row_changed`: "{label} from {old} to {new} in row #{n}" (1-based) parts, max 3, as "changed the values for …".
- `added` / `removed`: aggregated per table label: "added 2 rows to Items", several tables joined with "and".
- In RTL languages every interpolated token (user, field label, values) is wrapped in Unicode first-strong isolates (`TimelineContext.isolate`, set by `FrappeTimeline` from `isRTL`), and `Timeline` renders actors and change lines in `<bdi>`, so English names inside an Arabic sentence keep the sentence's word order. `TimelineItem.summary` keeps the isolates as data; `Timeline` renders each isolated token as a `<bdi>` (no invisible characters in the DOM, copy and search stay clean) and uses `stripIsolates` for `aria-label`. Use `stripIsolates` (from `src/record/format`) for any other plain-text use of a summary.
- **The timeline renders the server's stored text, as Desk does.** `version.py get_diff` stores values already formatted by the server (`get_formatted`; Markdown/Text Editor/Code/HTML Editor are stored raw) and `format_content_for_timeline` only strips HTML, truncates to 40 characters and escapes: no client-side formatting. Assignment and workflow lines are the Comment content as sent (`todo.py` writes full names with `get_fullname`). The components therefore never reformat values or substitute user ids; a backend that stores raw values or ids shows them raw.
- Expanding an entry lists **all** visible changed fields, which is a superset of Desk's 3-part summary.

**Field visibility (permlevel):** a changed field is skipped when it is hidden (unless `show_on_timeline`) or when its display status
for the user is `None` (`usePermissions().fieldStatus`, with the child DocType and the parent for table rows). This needs
`session.roles` on `FrappeProvider`; without roles nothing is inferred (rule 9: permlevel > 0 changes are hidden). `canSeeField(fieldname, table?)` adds a filter.

**Paging — `useCommunications(doctype, name, docinfo?)`:** the server sends up to 21 communications in docinfo; 20 are shown, and when
there were 21 a "Load more" appears: `frappe.desk.form.load.get_communications { start: shown count, limit: 21 }`, 20 of the answer are
appended, more is available when it returned 21 again. Returns `{ communications, hasMore, loadMore, loadingMore, error, isLoading }`.
Only communications page; comments are all loaded, versions are capped at 10 by the server.

### 3.4 `FrappeStatusIndicator`

`<FrappeStatusIndicator doc bundle? workflow? translate? variant? className? />` — the status chip. It is `frappe.get_indicator` through
the package's single implementation, **`resolveIndicator`** (`src/frappe/services/indicator.ts`), shared with the list view and the form
header. Precedence (first match wins): `__unsaved` → Not Saved; workflow state (unless the Workflow has `override_status`, or the state has
`avoid_status_override`; colour from the Workflow State `style`, else gray); submittable Draft / Cancelled (red); `meta.states` row titled
like `status`; submittable Submitted (blue); `status` coloured by `guess_colour`; `enabled`; `disabled`. `indicatorFor` is the record-layer
adapter (returns tone, label, list filter, source); built-in words go through the catalogue (`recDraft`, …), server words through `translate`.

### 3.5 Server dependencies and permissions at a glance

| Wrapper | Frappe APIs | Permission/role |
|---|---|---|
| FrappeWorkflowActions | `getdoctype`, `get_transitions`, `apply_workflow` | read on the doc; role per transition; `submit`/`cancel` as the target docstatus requires |
| FrappeAssignTo | `assign_to.add/remove/close`, `get_docinfo`, `search_link`; P36c `search_link` User Group + `reportview.get_list` User Group Member | read on the doc (server); write for the client's remove gate; read on User Group for the group field |
| FrappeTimeline | `get_docinfo`, `get_communications`, `add_comment`, `update_comment`, `client.delete`, `get_names_for_mentions` | read on the doc; Comment delete right; `track_changes` for versions |
| FrappeStatusIndicator | `getdoctype` | none beyond the doc |

### 3.6 `stateEntries` — actor and time per workflow state

`stateEntries({ doc, docinfo, stateField, states, translate? }) → Map<state, { by, at }>` feeds the Lifecycle rail's path and its
who · when (`FrappeWorkflowActions variant="rail"` calls it for you).

1. `docinfo.workflow_logs`: `apply_workflow` adds a Comment of type Workflow whose content is the state entered; owner = actor,
   creation = time. The latest per state wins. The server translates the content (`_()`), so both the state and `translate(state)` are matched.
2. States without a log: Version rows whose `changed` contains the state field; the new value is the entry.
3. The state the document was created in has no log; it is attributed to the document owner at `creation` when it equals the oldest known
   previous value.

---

## 4. Known limitations and UNVERIFIED points

- **Not reproduced:** energy point logs; `additional_timeline_content` (hook items); reply / reply-all buttons and delivery-status colours on
  communications (they render as one summary line); the "New Email" / "New Event" buttons; document viewers and typers; the " · Impersonated by"
  and " · [Action taken by]" suffixes and `updater_reference` links on version lines; links from a version line to the Version form; `listview_settings.get_indicator`.
- **Realtime:** docinfo refresh on `docinfo_update` events is the foundation's job (`useRealtimeInvalidation`); these components just re-render.
- **Comments:** edit/delete are gated by props; mention markup and the sanitiser are tested in jsdom only. Comment publish/unpublish (portal visibility) is not implemented.
- **Assignment:** `single` is a UI choice, not a server rule. Close (P36b), bulk (0.4.1) and "Assign To User Group" (P36c) exist (see 3.2);
  the group expansion is checked on the in-package simulator only.
- **Workflow:** `condition` is evaluated by the server only; the client cannot predict a hidden action. `update_field` values are set by the
  server on apply. Queued submissions (`queue_in_background`) return no document; A1's client flags this and the cache invalidates.
- **Stepper actor/time** relies on `workflow_logs` language handling noted in 3.6 (UNVERIFIED on a translated site).
- **Everything is simulated:** no component has run against a real Frappe site; rows marked UNVERIFIED in docs 11 §8 and 14 §A also apply here.

---

## 5. P35 — form menu, print, connections, e-mail composer, reminders

**Status:** *Implemented* and *Simulated & tested* (Testing Library over the in-package simulator, `createFixtureTransport`; request
shapes asserted from `store.calls`). **Nothing here has run against a real Frappe site.** Desk behaviour was traced from Frappe 15.110
source (file:line in each module header). Strings: the `r35Xxx` keys of `src/theme/messages-ws/record.ts` (English and Arabic).
Showcase: `#frappe-record-actions` ("Record actions (P35)") — every backend operation there is labelled SIMULATED.

### 5.1 Generic pieces (`@solvfast/ui`, `src/record/`)

| Component | Purpose | Key props |
|---|---|---|
| `RecordMenu` | The "⋯" menu: groups separated, shortcut hints (display only unless `bindShortcuts`), `hidden` / `disabled` (+ `disabledReason`) items, `confirm` (AlertDialog; `{ title, body, confirmLabel }`), `destructive` styling. A promise from `onSelect` shows a spinner; a rejection is shown under the trigger (`role="alert"`) and passed to `onError`. Renders nothing without visible items. **0.8.0-dev.9 (M-07) `bindShortcuts`**: each item's `shortcut` ("Shift+D", "Ctrl+B", "Shift+Ctrl+D", "Shift+R", "Ctrl+Z"; "Ctrl" also matches ⌘; letters / digits also by physical key) runs the item through the same `confirm` as a click; exact modifiers; not while typing (input, textarea, select, contenteditable), not while a dialog or menu is open, not for `hidden` / `disabled` items or a `disabled` / busy menu; the last mounted bound menu answers; removed on unmount. Off by default. `parseShortcut` / `shortcutMatches` are exported. Do not turn it on where the host already binds the keys (`FrappeRecordMenu shortcuts`). | `items: RecordMenuItem[]`, `onSelect?`, `onError?`, `disabled?`, `busy?`, `align?`, `labels?`, `trigger?`, `bindShortcuts?` |
| `groupMenuItems(items)` | Pure: visible items grouped in order of first appearance. | — |
| `RenameDialog` | Desk's "Rename {name}" (model.js:733-779): required "New Name", "Merge with existing", "Unchanged" for the same name; a rejection stays in the dialog. | `open`, `onOpenChange`, `name`, `nameLabel?`, `allowMerge?`, `onRename({ newName, merge })` |
| `PrintPreviewFrame` | Server print HTML in an `<iframe sandbox="">` (no scripts, no same-origin, no forms); loading / "No Preview Available" / error + Retry. `printSrcDoc(html, style, dir)` builds the srcdoc and neutralises `</style`. | `html`, `style`, `loading`, `error`, `onRetry`, `title`, `dir`, `height` |
| `ConnectionsPanel` | Connections groups: count badge when > 0, "?" when the server could not count, open-count badge, "+" per item, link (`href`) or button (`onOpen`); loading, error + Retry, empty and `notice` states. | `groups: ConnectionGroup[]`, `loading`, `error`, `onRetry`, `onOpen`, `onNew`, `notice`, `emptyText` |
| `EmailComposer` | Desk's composer as a form: To / CC / BCC (`TagInput`, Desk's e-mail pattern — an invalid address is named and not added), Subject (required), Message (`RichTextEditor`), Email Template picker ("Add Template" prepends + sets the subject, "Clear & Add Template") or `templateSlot`, "Attach Document Print" + format, attachments checklist, "Send me a copy", "Send Read Receipt". No recipient / no subject → refused; busy while `onSend` runs; a rejection is shown and the draft kept. `isValidEmail(v)`. | `initial`, `attachments`, `templates` + `loadTemplate`, `templateSlot`, `printFormats`, `searchRecipients`, `onSend(draft)`, `onDiscard`, `disabledReason` |
| `ReminderDialog` | Desk's "Create a Reminder" (reminders.js): 30 minutes / 1 hour (default) / 4 hours / 1 Day / Custom, required Description, a past time refused. Browser local time (UNVERIFIED against a site whose time zone differs). `toFrappeDatetime`, `remindAtFor`. | `open`, `onOpenChange`, `onCreate({ remindAt, description })`, `onCreated`, `now` |

### 5.2 Frappe wiring (`@solvfast/ui/frappe`, `src/frappe/record/`)

**`formMenuItems(input): FormMenuEntry[]`** (formMenu.ts) — pure, Desk's `toolbar.js` `make_menu_items` (:340-530) /
`make_customize_buttons` (:532-579). Input: `{ meta, doc, can(ptype), dirty?, printSettings?, roles?, has?, undo?, exclude? }`.

| id | Rule | Package difference |
|---|---|---|
| `print` | not submittable / submitted / cancelled + `allow_print_for_cancelled` / draft + `allow_print_for_draft`; print right; not single | also hidden on a new doc |
| `email` (Ctrl+E) | email right, docstatus < 2, not new | — |
| `links` | not single | also not new; needs the host's `onShowConnections` |
| `duplicate` (Shift+D) | create right, not `allow_copy` ("Hide Copy") | needs `onDuplicate` |
| `copy` | always (`JSON.stringify(doc)`) | — |
| `rename` | write, `allow_rename`, not new | — |
| `reload` | always | not new; needs `onReload`; asks first when dirty (Desk does not) |
| `delete` (Shift+Ctrl+D) | docstatus ≠ 1, not new, not single, delete right; confirm "Permanently delete {title (name)}?" | — |
| `remind` (Shift+R) | not new | — |
| `undo` / `redo` (Ctrl+Z / Ctrl+Y) | always | only with the host's `undo` state; disabled per `canUndo` / `canRedo` |
| `customize` | create on Custom Field + Property Setter (System Manager / Administrator rows), not "DocType", not single; custom DocType → its DocType form | from `roles` (unknown roles → hidden) |
| `new` (Ctrl+B) | create, not single, not `in_create`, not new | needs `onNew` |

Not reproduced: Jump to field, Edit DocType, Repeat (Auto Repeat), the printer action icon, key bindings (shortcuts are hints).

**`<FrappeRecordMenu>`** — `formMenuItems` + `RecordMenu`, wired:

```tsx
<FrappeRecordMenu bundle={bundle} doc={doc} docinfo={docinfo} dirty={dirty}
  permissions={perms /* default usePermissions(bundle, doc, docinfo) */} printSettings={bootPrintSettings}
  onDuplicate={(copy) => …} onRenamed={(name) => …} onDeleted={() => …} onReload={() => refetch()} onNew={() => …}
  onShowConnections={() => setTab("connections")} undo={{ canUndo, canRedo, onUndo, onRedo }}
  onCustomize={(href) => …} exclude={["remind"]} extra={[{ id: "x", label: "My action", onSelect }]} />
```

Duplicate → `copyDoc(bundle, doc)` (local, nothing saved); Copy → `writeClipboard` (default `navigator.clipboard.writeText`);
Rename → `RenameDialog` → `useDocAction().rename` (`frappe.rename_doc`); Delete → `useDocAction().remove` (`frappe.client.delete`);
Print / Email / Remind Me → the built-in `FrappeFormPrint` / `FrappeEmailComposer` / `FrappeReminder` unless `onPrint` / `onEmail` /
`onRemind`; Customize → `onCustomize(customizeHref(meta))` (default `window.location.assign(deskUrl + href)`). Server refusals are shown
under the menu; successes as a short `role="status"` line ("Copied to clipboard", "Renamed to …", "Deleted …", "Reminder set at …").
Integration with `FrappeFormView`: pass it as the form's `menu` slot (being added by the form workstream) or today as `toolbarExtra`.

**`<FrappeFormPrint>`** (+ `<FrappePrintPreview>`, formPrint.ts) — Print Format (`printFormatOptions`), Letter Head
(`letterheadOptions`, default first), the preview (`frappe.www.printview.get_html_and_style` with the whole document as `doc`, like
Desk's print page — `print_format`, `no_letterhead`, `letterhead`, `settings`), Refresh, "Print" / "Full Page" (`printViewUrl`,
`/printview?…[&trigger_print=1]`), "PDF" (`downloadPdfUrl`, `/api/method/frappe.utils.print_format.download_pdf?…`; or
`pdf="download"` → `api.download` + `saveFile`). Refused before any request: a new document, Print Settings' draft / cancelled rule
(`printAllowedForStatus`), `canPrint === false`; a dirty form shows Desk's warning. Props: `doc`, `meta`, `open`, `onOpenChange`,
`settings?`, `dirty?`, `canPrint?`, `baseUrl?`, `pdf?`, `dir?`.

**Connections** (connections.ts, useOpenCounts.ts, FrappeConnections.tsx):
- `connectionsFromMeta(meta): DashboardData | null` — `meta.__dashboard` (desk/form/meta.py:257-258 → model/meta.py:652-720), normalised
  as Desk's `init_data`; null without transactions. Checked against the recorded real 15.110 User and Customer metas.
- `connectionFilters(data, doctype, name)` — Desk's `get_document_filter` (fieldname / non_standard_fieldnames + dynamic link field);
  `connectionTarget` adds internal links (`{ name: ["in", names] }`).
- `useOpenCounts(doctype, name, items, { enabled, method })` — `frappe.desk.notifications.get_open_count` (`items` as JSON); parsed by
  `parseOpenCount` (`external_links_found` / `internal_links_found`). Requested only with a `fieldname` and for a saved document.
- `<FrappeConnections meta doc canRead? canCreate? onOpenList? listHref? onNew? labelFor?>` — **permissions:** the server checks READ on
  this document but counts linked DocTypes with `frappe.get_all` (no permission filter); Desk hides unreadable DocTypes from boot
  `can_read`. Pass `canRead` to do the same; without it every DocType the dashboard lists is shown.
- Integration: `FrappeForm` adds it as its "Connections" tab by default (P35 integration — `connections={false}` / options,
  forms.md §2.4); with `FrappeFormView` alone, an entry in `extraTabs`, e.g.
  `{ key: "connections", label: t("r35Connections"), render: () => <FrappeConnections meta={bundle.meta} doc={doc} … /> }`.

**`<FrappeEmailComposer>`** (email.ts) — `EmailComposer` in a dialog. Defaults (form.js:1286-1295): subject "{DocType}: {name}",
To = `doc.email || doc.email_id || doc.contact_email`, Attach Document Print on. Attachments from docinfo (sent as File names).
Templates: the names from `frappe.client.get_list("Email Template")` (or `templates`), applied with
`frappe.email.doctype.email_template.email_template.get_email_template({ template_name, doc })`. Send → `emailMakeArgs` →
`frappe.core.doctype.communication.email.make` (recipients / cc / bcc comma-separated, `send_email: 1`, `attachments` JSON, …), then
`applyDocInfoChange` so the timeline re-reads; `emails_not_sent_to` is reported. `canEmail === false` → Desk's refusal message.

**`<FrappeReminder>`** — `ReminderDialog` over `frappe.automation.doctype.reminder.reminder.create_new_reminder` (reminder.py:58-74).

### 5.3 Simulated (src/frappe/testing/handlers/record.ts) vs needs a real site

| Method | Simulator | Needs a real site for |
|---|---|---|
| `frappe.desk.notifications.get_open_count` | counts stored rows by the dashboard's link field (+ dynamic link), capped at 100; `open_count` always 0; internal links from the doc | `override_doctype_dashboards`, notification-config open counts, statement timeouts ("?"), `timeline_data` |
| `frappe.www.printview.get_html_and_style` | read check, Print Settings draft / cancelled rule (a stored "Print Settings" single, else the transport's `printSettings` option); a labelled placeholder **without values** | real Jinja print formats, letterheads, `print_hide` rendering, styles |
| `frappe.utils.print_format.download_pdf` | **not simulated** (the file server refuses it; the showcase links do nothing) | the PDF itself |
| `frappe.core.doctype.communication.email.make` | email right, address validation, a Communication **recorded** — nothing queued or sent | Email Account, queueing / sending, `send_me_a_copy`, read receipts, attachments of the print |
| `…email_template.get_email_template` | `{{ field }}` / `{{ doc.field }}` substitution only | Jinja rendering |
| `…reminder.create_new_reminder` | past time refused, Reminder stored | scheduling (`send_reminders`), Notification Log |
| `frappe.rename_doc`, `frappe.client.delete` | (existing simulator handlers) | linked-document updates, merge semantics, delete checks of linked documents |

Simulator (P35 integration): these handlers use the transport's own permission engine when
`createFixtureTransport(…, { permissions })` is on (DocPerm × roles, if_owner, User Permissions, shares — through the handler context
`FixtureContext`, third handler argument), its `printSettings` option (a stored "Print Settings" single wins) and its clock; the
simulated `get_docinfo` / `get_communications` list stored Communications, so a sent e-mail appears in the simulated timeline.

## P36b social — Share, Like, Comments (form sidebar parts)

Three standalone parts the form sidebar renders, each `{ doctype, name, readOnly? }` (+ optional extras). They read the
document's docinfo through the package's shared docinfo query (`useRecordDocInfo` → `useDocInfo`, key
`frappeKeys.docinfo`) and the document through `useDoc` (`frappeKeys.doc`), the same keys `FrappeForm` seeds — nothing is
fetched twice and every part follows the others. Source of truth: Frappe 15.110 (file:line in the components' headers and
in `src/frappe/record/{share,like,comments}.ts`).

### Generic pieces (`@solvfast/ui`, `src/record/`)

- **`<ShareDialog>`** (`ShareDialog.tsx`) — Desk's share dialog (set_sharing.html): the **Everyone** row first, then one row
  per user, with exactly Desk's rights **Can Read / Can Write / Can Submit / Can Share**; an add row (user + the four boxes +
  Add). `entries: ShareEntry[]`, `canShare` (false → every box disabled, no add row, a hint), `canGrant: { write, submit }`
  (those columns are disabled without the right), `searchUsers`, `onAdd(user, rights)`, `onSetRight(entry, right, value)`.
  Not optimistic: a box is applied by the host's promise; the row is disabled meanwhile and a rejection keeps the box and
  shows the message.
- **`<SharedAvatars>`** — up to `max` (5) overlapping avatars + "+n", an "Everyone" pill; nothing when not shared.
- **`<LikedBy>`** (`LikedBy.tsx`) — the controlled `LikeToggle` + the count; the count opens the list of who liked
  (avatar + name). `liked`, `users`, `onToggle(next) => Promise`, `onError`, `disabled`.
- **`Timeline`** (additive): `onTogglePublish(item, publish)`, `canPublish(item)`, `isPublished(item)` — Desk's comment
  Publish / Unpublish with its confirmation and the "Published" marker. Without them nothing changes.

### Frappe wiring (`@solvfast/ui/frappe`, `src/frappe/record/`)

**`<FrappeSidebarShare doctype name readOnly? docinfo? sharingDisabled? searchUsers? maxAvatars? heading? labels?>`** — the
"Share" heading with "+", the avatars of `docinfo.shared`, the dialog:
- open → `frappe.share.get_users {doctype, name}` (share.py:125-152; `[]` without read);
- add → `frappe.share.add {doctype, name, user, read, write, submit, share, notify: 1}` (share.js:129-141); the server
  always adds read (share.py:44-45) and cascades share/write/submit ⇒ read, submit ⇒ write (docshare.py:40-44); the
  dialog shows the row the server answered;
- each box → `frappe.share.set_permission {doctype, name, user, permission_to, value, everyone}` (share.js:168-177; the
  Everyone row sends `user: ""`, `everyone: 1`); un-ticking **Can Read** removes the share (share.py:111-120; `share.remove`
  is not whitelisted); no answer = the row was deleted;
- after each change `applyDocInfoChange` (the sidebar avatars and the permissions follow).
- Who may change: `frm.perm[0].share` (usePermissions: roles, or a DocShare with share = 1) and not `sharingDisabled`
  unless Administrator (model.js:462-473); Write / Submit only with those rights (set_sharing.html). Without the right the
  dialog is read-only. The server decides (share.py:216-244: "No permission to share …", "You cannot share `write` …";
  docshare.py:63-69: submit on a non-submittable DocType); its message is shown in the dialog.
- User search: `search_link("User", { user_type: "System User", name: ["!=", me] })` (share.js:103-117).

**`<FrappeSidebarLikes doctype name readOnly? docinfo? onError?>`** — reads the **document's** `_liked_by`
(form_sidebar.js:242-250). Click → `frappe.desk.like.toggle_like {doctype, name, add: "Yes" | "No"}` (like.js:12-24); the heart
is disabled and unchanged until the server answered; then the cached document's `_liked_by` is rewritten in place
(`applyLikeToCaches`: `modified` untouched, like.py:55-58 / like.js:36-50; list rows too) and docinfo is invalidated
(`like_logs`). A failure changes nothing (Desk is quiet) and calls `onError`. Guest / `readOnly` → disabled.

**`<FrappeComments doctype name readOnly? docinfo? variant? onCountClick? order? searchMentions? canDeleteComment? isSystemManager?>`**
- `variant="list"` (default): the comment box (Ctrl/⌘+Enter, @mentions from `get_names_for_mentions`, stored as
  `<span class="mention" data-id …>`) and the document's comments (`docinfo.comments` — all of them; comments are not
  paged, load.py:156-160). Add → `frappe.desk.form.utils.add_comment {reference_doctype, reference_name, content,
  comment_email, comment_by}`; edit → `update_comment {name, content}`; delete → confirm, `frappe.client.delete {doctype:
  "Comment", name}`; publish → confirm, `update_comment_publicity {name, publish}`. Nothing changes before the server answered.
- Rights (comments.ts, form_timeline.js:607-663): Edit = author or Administrator; Delete = (author or System Manager) and
  delete on Comment (System Manager / Website Manager in comment.json — `canDeleteComment` overrides for a customised site);
  Publish = author or System Manager. `readOnly`: no box and no actions.
- `variant="count"`: `docinfo.comments.length`; a click calls `onCountClick`, else focuses the page's `[data-sf-comment-box]`
  (form_sidebar.js:51-55).
- `FrappeTimeline` gets `allowPublish` (default false) for the same Publish / Unpublish in the full timeline.

### Simulated (src/frappe/testing/handlers/social.ts) vs needs a real site

| Method | Simulator | Needs a real site for |
|---|---|---|
| `frappe.share.get_users` / `add` / `set_permission` | share right, granted rights, cascade, submittable check, row deleted when empty, "Shared" / "Unshared" comments, Share Notification Log **recorded** | e-mail / realtime notification, Document Follow (`follow_shared_documents`), `validate_share` controller hooks |
| `frappe.desk.like.toggle_like` | (transport built-in) `_liked_by`, Like comment, Guest refused | Document Follow (`follow_liked_documents`), realtime `docinfo_update` |
| `frappe.desk.form.utils.add_comment` | read check, Comment + `_comments`, Mention Notification Log **recorded** (overrides the built-in) | HTML sanitising, image extraction, `allowed_in_mentions`, Document Follow, realtime |
| `update_comment_publicity` | author or System Manager, `published` stored | website / portal visibility |

The simulator computes `docinfo.shared` only when the transport has `permissions` (fixtureTransport.ts docinfo): on a
permission-less transport the shared-with avatars stay empty even after a share (the dialog, which reads `get_users`, works).
The `add_comment` override keeps the parent's `_comments` entries truncated at 100 characters (comment.py:130-131), as Frappe does.
The simulator's `docinfo.comments` does not carry `published` yet (fixtureTransport.ts) — the "Published" marker shows on a
real site and once the simulator adds the field.

## 6. P36b — Form Sidebar

Desk's form sidebar (Frappe 15.110 `form/sidebar/form_sidebar.js`, `form/templates/form_sidebar.html`) for any DocType.
Backend operations are verified on the in-package **simulator only** (`createFixtureTransport` + `withSimulatedSidebar`,
`src/frappe/testing/handlers/sidebar.ts`) — never against a real site.

### 6.1 Native structure and order

| Desk (form_sidebar.html) | DS |
|---|---|
| user actions (`add_user_action`, :1) | `userActions` |
| image section (`image_field`) | not in the sidebar — `FrappeFormView` shows the header image |
| Assigned To (:43-56) | `FrappeAssignTo layout="sidebar"` |
| Attachments (:57-81) | `FrappeAttachments` |
| Reviews (energy points, :82-94) | not reproduced |
| Tags (:95-104; hidden for Single DocTypes) | `FrappeDocTags` |
| Share (:105-118) | `share` slot (social workstream: `FrappeSidebarShare`) |
| Followed by / Follow, auto-repeat (:119-138) | not reproduced |
| stats: likes · comment count, Follow (:139-162) | `likes` slot + the comment count (`docinfo.comments.length`) |
| page views, "… last edited this", "… created this" (:163-168) | `created` / `modified` (page views not reproduced) |
| — (Desk: the comment box is in the form **footer**, footer/footer.js:8-25) | `comments` slot, drawn last; the count scrolls to it |

The whole sidebar is hidden for an unsaved document (form_sidebar.js:71-74). `sections` (ids of `FORM_SIDEBAR_SECTIONS`)
hides or reorders sections; Desk's own rules (unsaved, Single) still apply.

### 6.2 Components

```ts
// Core (@solvfast/ui) — Frappe-free
<FormSidebar assign attachments tags share likes comments commentCount commentCountSlot onCommentsClick userActions created modified
  sections hidden loading error onRetry now />
<SidebarSection id label icon onLabelClick action={{ label, onClick, disabled? }} busy>{children}</SidebarSection>
<AttachmentList items={AttachmentItem[]} hasMore onShowAll onRemove canRemove fileRecordHref empty labels />
<AttachDialog open onOpenChange onUpload={(file, isPrivate) => Promise} defaultPrivate allowTogglePrivate maxFiles accept maxSize
  searchLibrary onAttachExisting onAttachLink note />
<TagList tags adding onAddingChange onAdd onRemove canRemove search sanitize empty />
// additive: TagInput `exclude`, `autoFocus`; AssigneeGroup `hideHeading`, `onComplete`, `canComplete`; AssignDialog `defaultDetails`

// Frappe (@solvfast/ui/frappe)
<FrappeFormSidebar doctype name doc? bundle? docinfo? readOnly? share? likes? comments? commentCount? sections? userActions? onCommentsClick?
  onOpenFileList? fileRecordHref? assignProps? />
<FrappeAttachments doctype name readOnly? doc? bundle? docinfo? onOpenFileList? fileRecordHref? library? webLink? />
<FrappeDocTags doctype name readOnly? doc? bundle? docinfo? />
<FrappeAssignTo layout="sidebar" doc user bundle? canAssign? canWrite? allowComplete? />   // layout default "group" (unchanged)
useFormSidebarActions() // upload, attachExisting, attachLink, removeAttachment, addTag, removeTag, closeAssignment
```

**One docinfo.** Every section reads `useRecordDocInfo` → `useDocInfo(doctype, name)` (`frappeKeys.docinfo`, seeded by getdoc through `useDoc`);
every write ends in `applyDocInfoChange` (docinfo + list invalidated). A slot that needs docinfo must use the same hook.

### 6.3 Server methods and rights

| Action | Request (as Desk sends it) | Offered when | Server rule |
|---|---|---|---|
| assign | `frappe.desk.form.assign_to.add` { doctype, name, assign_to: JSON list, description, date, priority } | saved doc, not `readOnly` | read (assign_to.py:67-68) |
| Done | `assign_to.close` { doctype, name, assign_to } | own assignment | assignee only (:196-199) |
| remove assignment | `assign_to.remove` { doctype, name, assign_to } | own, or `write` (assign_to.js:358) | read (:204-208) |
| upload | `upload_file` multipart: file, is_private, folder "Home/Attachments", doctype, docname | `write`, limit not reached | write on the doc (handler.py:220, 266-282); `max_attachments` (file.py:333-350) |
| Library | `upload_file` { library_file_name, folder, doctype, docname } (JSON body, app.py:302-314) | as upload | read on that File (handler.py:208-218) + write |
| Link | `upload_file` { file_url, is_private: 0, folder, doctype, docname } | as upload | write |
| remove file | `frappe.desk.form.utils.remove_attach` { fid, dt, dn } — every file with that name | `can_delete_attachment` (attachments.js:161-174) | File delete (file.py:872-910) + protected files (:515-540) |
| add / remove tag | `frappe.desk.doctype.tag.tag.add_tag` / `remove_tag` { tag, dt, dn } | `write` | write (update_tags, tag.py:147-152) |
| tag search | `get_tags` { doctype, txt (lower-cased) } | while typing | Tag list |

### 6.4 Differences from Desk (with the reason)

- Assigned To lists each assignee on its own row with Done / remove; Desk shows an avatar stack and manages it in a second
  "Assignments" dialog (assign_to.js:244-373). Same actions, one click less. No "Assign To User Group" field.
- Attach and tag editing are offered only with `write`; Desk always shows "+" and the tag box and lets the server refuse.
- A tag is drawn dimmed while its request runs and removed again if refused; Desk keeps the pill after a refusal.
- No upload percentage: the package's upload is a `fetch` without progress events; each file shows waiting / uploading /
  uploaded / failed. Camera (`CameraCapture`, with a graceful fallback), Crop (`ImageCropper`, JPEG / PNG) and Optimize
  are offered as in Desk's FileUploader (P36b Attach Image work); Google Drive is not.
- An empty section shows a quiet "No attachments" / "No tags" line; at the attachment limit a line says so (Desk hides "+").
- The `comments` slot sits in the sidebar (owner request); Desk's comment box is in the form footer.
- Not reproduced: Reviews / energy points, Follow / Followed by, auto-repeat, page views, the sidebar image.

## 7. P36d — Record Detail history (Desk timeline parity)

The CRM Lead / Deal / Contact / Organization History tab is this layer's `Timeline` (mock data) or `FrappeTimeline`
(Frappe data); no second timeline exists. P36d closed these gaps against Desk's form timeline
(`form_timeline.js`, `base_timeline.js`, `version_timeline_content_builder.js`, `desk/form/load.py` getdocinfo):

**`Timeline` (Core, additive):**
- `timeFormat: "compact" | "desk"`: `"desk"` is Frappe's `comment_when` wording ("3 days ago", "yesterday"), in en and
  ar. The default stays `"compact"`.
- `showAvatars`: author image or initials (`TimelineItem.actorImage`).
- `itemLink`: a Copy Link action.
- Card entries (`TimelineItemExtras`: `card`, `subject`, `status`, `attachments`), used for communications.
- The `<time>` title (absolute date) follows the app language.
- The edit box always says **Save** (`form_timeline.js:666`), whatever `composerLabels.submit` says.
- New exports: `deskRelativeTime`, `absoluteTime`, `TimelineEntry`, `TimelineItemExtras`, `TimelineTimeFormat`.

**`FrappeTimeline`:**
- Communications are cards: body, subject, a delivery-status pill (`deliveryStatusTone`) and attachments with a
  private-file lock. Automated messages read "Notification sent to …".
- Version lines get the `updater_reference` ("via …"), "created this document", "Impersonated by" and
  "[Action taken by]" text.
- `additional_timeline_content` entries that carry content are shown.
- Author avatars come from `user_info`.
- The "Published" marker shows whenever the server says a comment is published (not only with `allowPublish`).
- A failed load renders `FrappeErrorState`, with Retry for server or network errors and no Retry on a permission error.
- The document e-mail line ("Add to this activity by mailing to …").
- New props: `timeFormat`, `showAvatars`, `copyLinks`, `communicationHref`, `showDocumentEmail`. `FrappeComments` also
  takes `timeFormat` and `showAvatars`.

**Defaults changed to match Desk:**
- In `FrappeTimeline`: the Published marker, the e-mail cards and the error state.
- In `Timeline`: the edit-box button.

**Still not reproduced:**
- the "commented" verb;
- links to the user and Version forms;
- e-mail medium icons;
- Reply / Reply All;
- New Email / New Event;
- energy points;
- the "Show all activity" switch (the All / Comments / Changes chips replace it).

**Known gap:** `useCommunications` does not count automated messages when it computes the next "Load more" start, as
Desk does.

Tests: `tests/history-p36d.test.tsx` (P36D.history.1-15), against the SIMULATED transport. Real-site confirmation is
pending (see `docs/audit/p36/VALIDATION-MATRIX.md`).

## 8. P36e — Print, split into Core presentation and Frappe integration

**Core** (`@solvfast/ui`, no Frappe imports):
- `PrintView` / `PrintViewDialog`: Desk's print page. Print Format, Letter Head, (Language), preview and actions are
  props and callbacks; the host decides which options exist.
- `PrintDocumentsDialog`: Desk's list "Print Documents" (Letter Head, Print Format, Page Size + Custom mm, an optional
  Background Print). It validates a Custom size before `onPrint`.
- `composePrintDocument(docs, { pageSize, height, width, dir, lang })`: one HTML document, one record per page,
  `@page` in mm, and a Content-Security-Policy that blocks scripts.
- `printHtmlDocument(html)`: prints it through a hidden same-origin iframe.
- `PrintPreviewFrame srcDoc`: the preview is the exact string that prints.

**Frappe layer:**
- `FrappeFormPrint` (dialog, or `variant="page"` with `onBack`) and `FrappePrintDialog` render the Core components over
  the server: `get_html_and_style`, `download_pdf`, `download_multi_pdf(_async)`, Letter Head / Print Format reads.
- Behaviour is unchanged from 0.7.0-dev.5.

**Hosts without a server** (the CRM mock adapter is the reference):
- Supply Print Formats as a meta fragment, Letter Heads and a local renderer per format, then print through
  `composePrintDocument` + `printHtmlDocument`.
- Do not offer server-only actions: PDF download, Full Page, Background Print as a server job. The browser's "Save as
  PDF" covers PDF.

## 9. Lifecycle — the shared rail and diagram (CRM + Tickets)

One lifecycle look for every record page. The package owns the visuals; the consumer owns its lifecycle model (states,
transitions, roles, logs) and the graph engine for the diagram.

### 8.1 `LifecycleRail` (`src/record/LifecycleRail.tsx`)

| Prop | Type | Meaning |
|---|---|---|
| `path` | `LifecycleRailStep[]` (`{ id, label, meta?, metaTitle? }`) | States the record went through, oldest first; the **last** entry is the current state. Empty → renders nothing. |
| `next` | `LifecycleRailNext[]` (`{ id, label, back?, disabled?, disabledReason? }`) | Ways forward from the current state. 1 → a dashed row on the line; ≥ 2 → one box under the current row. `back` = a move to a state already on the path (undo icon + "back" tag). `disabled` = shown, not available (`aria-disabled`, reason as tooltip). |
| `ended` | `boolean` | No way forward: "End of lifecycle" (only when `next` is empty). |
| `onViewAll` | `() => void` | Shows "View full lifecycle". |
| `onSelectNext` | `(next: LifecycleRailNext) => void` | Makes each next option a button (e.g. run that transition). A `disabled` option stays text. (0.7.0-dev.13) |
| `labels` | `{ back?, end?, viewAll?, current?, next? }` | Chrome strings. Default: the ThemeProvider's language (`lc*` messages, en / ar). **Pass them when rendering outside a ThemeProvider.** |

### 8.2 Diagram pieces (`src/record/LifecycleDiagram.tsx`)

- `LifecycleDiagramDialog` — `open`, `onOpenChange`, `title`, `subtitle?`, `children` (the canvas), `legendLabels?`, `closeLabel?`,
  `dir?`. Solid themed surface (`bg-popover`), portalled into the ThemeProvider's element scope.
- `LifecycleStateCard` — `label`, `meta?`, `kind: "done" | "current" | "future"`, `phase?: "open" | "on_hold" | "closed"`,
  `currentLabel?`, `title?`, `style?`. A diagram node body (58 px high; the consumer sets the width).
- `LifecycleEdgeLabel` — `label`, `taken?`. `LifecycleDiagramLegend` — `labels?`.
- `LIFECYCLE_DIAGRAM_COLORS` — `{ taken, edge, grid }` as token-based CSS colours for SVG edges / markers / grid.
- **One model, two renderers (0.10.0).** The diagram's data is always the core model `LifecycleGraph`
  (`lifecycleGraph(def, current, pathIds?, visitedIds?)`, §9.4): nodes `{ id, label, phase, kind, meta?, metaTitle? }`
  (`meta` / `metaTitle`, optional since 0.10.0: who moved the record there and when — an adapter adds them, the
  function never does) and edges `{ id, from, to, label?, taken }`. Two renderers draw it:
  - `LifecycleGraphView` (core, `src/record/LifecycleGraphView.tsx`, dependency-free SVG) — below;
  - `LifecycleFlow` / `LifecycleFlowDialog` (the optional `@solvfast/ui/lifecycle-diagram` entry, React Flow + dagre as
    optional peers).
- `LifecycleGraphView` — props: `graph: LifecycleGraph`, `initial?` (the top row; default the first node),
  `currentLabel?`, `labels?: { zoomIn?, zoomOut?, fit?, transitions?, diagram? }`, `dir?: "ltr" | "rtl"` (default the
  ThemeProvider's), `className?`. A layered layout (`layoutLifecycle(graph, initial?, { rtl? })` →
  `{ placed: Map<id, node & { x, y, row }>, edges: { edge, kind, d, lx, ly }[], width, height }`, pure and
  deterministic): rows by breadth-first distance from `initial`, states no transition reaches in a last row. Arrows:
  down a row from bottom to top (several into one state spread along it); within a row straight, a pair of opposite
  arrows a little apart; up to an earlier row straight into the state when it is in another column, else round the
  side of the canvas; a transition from a state to itself is a small loop on the state's end side (`kind`: `down`,
  `row`, `up`, `side`, `loop`). Labels are kept off each other and off the states; `taken` arrows in the success
  colour; + / − / fit (fits on open). Each state's second line is its phase word (`lcPhase*`) and, when the node has
  one, its `meta`. In a right-to-left language the whole diagram is mirrored (no forced `dir="ltr"`).
  **Accessibility:** the drawing is `aria-hidden`; the canvas is a `group` named "Lifecycle diagram", every state card
  says "Reached" / "Not reached" (the current one shows "Current"), and a visually hidden list named "Transitions" reads
  every transition as a sentence — "From New to In Progress: Start Work" (Arabic «من … إلى …: …»), "(Path taken)" on
  the record's path (`lcDiagram`, `lcTransitions`, `lcTransitionItem`, `lcTransitionItemPlain`, `lcReached`). Arrow-head
  ids come from `React.useId`, so two graphs on one page never share them. It fills its parent (`absolute inset-0`):
  put it inside `LifecycleDiagramDialog`.
- `LifecycleGraphDialog` (`@solvfast/ui/sayr`) — `LifecycleDiagramDialog` + `LifecycleGraphView` on Sayr's data:
  `open`, `onOpenChange`, `title`, `subtitle?`, `lifecycle` (`states`, `initial_state`, `transitions` as `record_page` /
  `type_preview` return them), `status?` (the current state), `path?: LifecyclePathStep[]` (`{ id, meta?, metaTitle? }`,
  the rail's steps: done states with who · when, and the transitions between consecutive steps taken). An internal
  adapter turns Sayr's lifecycle into a `LifecycleDefinition` (labels in the current language, Sayr's phases open /
  on_hold / closed one to one, anything else open) and then the model. No `path`: nothing is marked done or taken. An
  older Sayr that sends no `transitions` still shows every state. `src/sayr` cannot use the React Flow renderer (the
  boundary rule keeps it off `./lifecycle-diagram`).

### 8.3 One colour mapping, both themes (semantic tokens only)

| Element | Token |
|---|---|
| Past / done dot, connector, card, "path taken" edge | `success` (card: `border-success/70` + `success/10` tint over `card`) |
| Current dot, row, card, "Current" badge, View-full link | `primary` (row / card: `primary/10` tint; halo `ring-primary/20`) |
| Future dot, dashed connectors | `muted-foreground/40` stroke on `background` (`/35` dashed) |
| Back tag, options box | `border`, `muted`, `muted-foreground` |
| Labels / meta | `foreground` / `muted-foreground` |
| Skipped / failed (`LifecycleStepDot step`) | dashed `muted-foreground/50` / `destructive` |
| Phase icon (diagram) | open `info`, on hold `warning`, closed `success` |

`LifecycleStepDot` (exported) is the rail's dot atom; it also draws `skipped` / `failed` for a host's own lifecycle UI.

### 9.4 The Lifecycle contract and the Actions menu (Core, 0.8.0-dev.5)

The reference is the CRM record page's Lifecycle (`docs/audit/p08/CRM-REFERENCE.md` §3). Core is framework-free
(`src/record/lifecycle.ts`, no renderer, no graph library):

| Export | What it gives |
|---|---|
| `LifecycleDefinition` | `{ states: { id, label, phase: "open" \| "on_hold" \| "closed", color? }[], transitions: { id, from, to, label?, trigger?, roles? }[] }` |
| `lifecycleTone(state)` | The status badge tone: open → info, on hold → warning; closed → by colour (red → danger, grey → neutral, else success) |
| `lifecyclePath(def, current)` | The rail's path: the **shortest** path from a root to the current state (not the record's history) |
| `lifecycleTransitionsFrom(def, current, roles?)` | The Actions menu: the transitions out of the current state, not automatic ones, role-restricted ones only for a holder |
| `lifecycleNext(def, current, pathIds)` | The rail's ways forward: every target out of the state (automatic and role-restricted included), `back` when on the path |
| `lifecycleGraph(def, current, pathIds?, visitedIds?)` | The diagram model: nodes done / current / future, edges `taken` — for any renderer (the CRM's is React Flow + dagre) |

`LifecycleActions` — {actions: {id, label, confirm?, disabledReason?}[], onAction(id), blockedReason?, blockedIcon?,
busy?, labels?}: the header Actions menu. Plain items (no colour); a transition runs as soon as it is chosen (unless the
item asks to `confirm`); "No actions from this status" when there is none; an item with a `disabledReason` stays visible,
disabled, its reason after its label; `blockedReason` (e.g. "Save your changes first" while the page is dirty) replaces
the menu by a disabled button with that tooltip (and `blockedIcon`).

The record page pattern: **transitions only from the header Actions menu; the rail is read-only** (path, where it can go
next, End of lifecycle, View full lifecycle). No failed / lost step kind: a closed state reads as any current state; its
badge tone comes from `lifecycleTone`.

### 9.5 Lifecycle on Frappe data — `FrappeWorkflowActions`

`FrappeWorkflowActions` (`@solvfast/ui/frappe`) gives the same pattern from a Frappe Workflow (0.8.0-dev.5):

- **`variant="actions"`** — the header Actions menu alone (`LifecycleActions`): the server's `get_transitions` answer for
  this user (authoritative; roles, self-approval and conditions are the server's). Blocked with `recSaveBeforeAction`
  while the document is unsaved, or with the host's `blockedReason` (e.g. the page has unsaved changes). `confirm`,
  `beforeApply` / `afterApply`, `onApplied` as in the other variants; a refusal is shown under the menu.
- **`variant="rail"`** — the Lifecycle card, **read-only by default**: path = the states the record entered, oldest first
  (docinfo `workflow_logs`, then Version rows; `stateEntries`), ending with the current state, meta `who · day`; next =
  every state the **workflow** leads to from here (`workflowLifecycle` + `lifecycleNext`: whoever may run it); End of
  lifecycle when no transition leaves the state. `onViewAll`, `railLabels` pass through.
  `applyFromRail` restores the 0.8.0-dev.1–dev.4 rail whose ways forward are buttons applying this user's transitions.
- `variant="compact"` (default; badge + menu; FrappeForm's toolbar) is unchanged.
- `workflowLifecycle(workflow, translate)` maps a Workflow to a `LifecycleDefinition` (`allowed` → `roles`). Phase from
  Frappe's data: a state with `doc_status` 1 / 2, or with no transition out to another state, is `"closed"` (a closed
  Danger state gets a red `color`, no style / Gray / Inverse a grey one, for `lifecycleTone`); every other state is
  `"open"`. A Frappe Workflow marks nothing as on hold, so `"on_hold"` is never given.

On Frappe data the path is the record's real history (it is known); on host data without a log, `lifecyclePath` (the
shortest path) is the reference's display. Workflow semantics (field names, states, transitions, `apply_workflow`,
permissions) are unchanged. Tests: `tests/frappe-lifecycle-rail.test.tsx` (stub client — request / response shapes,
**simulated**; validation on a real site is pending, P1), `tests/lifecycle-contract.test.tsx`.

### 9.6 The diagram renderer — `@solvfast/ui/lifecycle-diagram` (Run 1 I1)

A separate entry with two **optional peer dependencies**, `reactflow` (11, the CRM's version) and `@dagrejs/dagre`. Core
never imports it (boundary check). It draws Core's `lifecycleGraph` model with Core's look:

```tsx
import { LifecycleFlowDialog } from "@solvfast/ui/lifecycle-diagram";
import "reactflow/dist/style.css";
import "@solvfast/ui/lifecycle-diagram.css";
<LifecycleFlowDialog open={open} onOpenChange={setOpen} title="Deal lifecycle · New business"
  graph={lifecycleGraph(definition, currentId, pathIds)} meta={{ [stateId]: "Omar · Apr 12" }} />
```

- `LifecycleFlow` (the canvas; fills its positioned parent), `LifecycleFlowDialog` (Core `LifecycleDiagramDialog` + the
  canvas), `lifecycleFlowLayout` (dagre layout → nodes / edges), `roundedPath`.
- Port of the CRM's `LifecycleDiagramPopup`: dagre top-to-bottom, rounded orthogonal edges on dagre's waypoints, the path
  taken highlighted, read-only pan / zoom, fit to view, re-centred on the current state above 10 states.
- `phaseLabels` (default the catalogue's Open / On Hold / Closed), `currentLabel`, `dir`, `focusCurrentAbove`.

### 9.7 Editing a comment, form shortcuts, the title dialog (Run 1)

- **`CommentRichEditor`** (D-28): an HTML comment is edited in the rich editor ("desk" sanitizer profile + @mentions):
  formatting, links, images and mentions survive; Ctrl/⌘+Enter saves, Escape cancels. `Timeline` uses it for HTML
  comments; plain-text comments keep `CommentComposer`; writing a new comment is unchanged.
- **Form shortcuts** (C-81…C-84): `FrappeRecordMenu shortcuts` — Ctrl/⌘+P Print, Ctrl/⌘+E Email, Shift+D Duplicate,
  Shift+Ctrl/⌘+D Delete (asks first); `FrappeForm` turns them on (`hotkeys={false}` off). A host with its own menu (the
  CRM's `useRecordMenu`) does not render `FrappeRecordMenu`, so there is never a second handler.
- **Title dialog** (C-67): `FrappeFormView onRenameTitle` — the form title opens Desk's title / rename dialog
  (`update_document_title`); `FrappeForm onRenamed` gets a new name. `EditableTitle` saves asynchronously (pending,
  revert with the message); `PageHeader titleInShell` makes an editable title the page's one `<h1>`.

## 10. RecordRail — the CRM record page's right rail

The right rail of the CRM record pages (Deal, Lead, Contact, Organization; Tickets reuse the cards), as DS components.
It is a **port, not a redesign**: the DOM and class strings of the CRM's `SidebarCard`, `RailSection` (its DS-scope
branch), `RelatedRecordRow`, `SidebarCustomizer` (DS-scope branch), `RailFooter` and `ReferencesPanel`, with
`brand-violet` → `primary`. On the CRM Deal page the migrated rail is pixel-identical to the pre-migration capture
(12 theme × language × width combinations; see `docs/audit/p0/P0-CONSOLIDATION.md`).

**Two sidebar systems, both kept.** `RecordRail` is not the Desk form sidebar. `FormSidebar` / `FrappeFormSidebar` (§6:
Assigned To, Attachments, Tags, Share, stats, Created / Modified, in Desk's order and look) are unchanged and remain the
Frappe-native sidebar. The two can share data adapters (`FrappeAssignTo`, `FrappeAttachments`) but not their look.

### 10.1 The rail

`RecordRail` (renders an `aside`) — Customize sections, pinned sections, the visible sections in order, `footer`, then
`after` (outside Customize).

| Prop | Meaning |
|---|---|
| `sections` | `RecordRailSectionDef[]` = `{ id, label, render, pinned? }`, in order. `pinned` = always shown, first, not in Customize (the CRM's Lifecycle). `render` may return `null` when the section does not apply now (the CRM's Playbook). |
| `visible` / `onVisibleChange` | Controlled visible ids (non-pinned). |
| `defaultVisible` | Uncontrolled initial ids (default: all). |
| `storageKey` | **Opt-in** persistence of the hidden ids (`localStorage` `sf-record-rail:<key>`). The CRM does not persist (per page view). |
| `customize`, `customizeLabels`, `customizeIcon` | Show the button (default true); its strings; its glyph. |
| `footer`, `after` | E.g. `RecordRailFooter`; `RecordRailArticles` (the CRM shows Articles after the footer). |
| `className` | The aside's classes (the CRM: `lg:col-span-1 lg:sticky lg:top-4 lg:self-start space-y-4`). |

Reordering by drag is not implemented (the CRM has none: its `SortableSidebar` is not mounted); cards accept a
`dragHandle` (HTML attributes for the grip) for a host that adds one.

### 10.2 Building blocks

| Component | What it is |
|---|---|
| `RecordRailCard` | A card: hover grip, icon, uppercase title, end `action`, body. `accent` = border classes (default `border-primary/20 hover:border-primary/40`). `recordRailCardClass(accent, stacked)` is its surface for hosts that draw their own header (the CRM's Attachments card). |
| `RecordRailSection` | A card whose `spec.kind` decides the header controls: `process` (none), `single` (pencil Change, × Clear), `multi` (count in the title, + Link), `content` (optional + Add). `notice` renders above the body. |
| `RecordRailRow` | A linked record: tinted icon square, `#id`, name (Arabic with `nameAr` + `isAr`), subline, `chips`, a hover `action`. Clickable rows are `div[role=button]` (Enter / Space). |
| `RecordRailCustomize` | "Customize sections" + the "Visible sections" checklist. |
| `RecordRailFooter` | `lines: { label, who?, when?, whenTitle? }[]` and `seenBy: { label, people }`. Times are formatted by the host. |

### 10.3 Modules

| Module | Component | Host supplies |
|---|---|---|
| Assignment | `RecordRailAssignment` (inside a `single` section) | The assignee UI as children — `AssigneeGroup variant="list" withDetails` (mock / local data) or `FrappeAssignTo` (Frappe) — plus `team`, `autoAssign`, `footer` (e.g. open ToDo details). **0.8.0-dev.9 (AS-06)**: `team={{ label, value, options, onChange, changeLabel? }}` adds a focusable "Change team" button on the team row (a menu of `options`, the current one checked; `onChange(value)` — the host stores it and logs the history entry). Without `onChange` the row is the static one, unchanged. |
| Attachments | `FrappeAttachments` (`@solvfast/ui/frappe`) with `className={recordRailCardClass(accent, false)}` | A `FrappeProvider` (a real site, or a local mock client as the CRM does). The section keeps the Desk attachments header (sentence case), as the CRM shows it today. Upload / Library / Link / remove / limits are `FrappeAttachments`' (§6). |
| Organization (any single link) | `RecordRailLinkedRecord` | `record` (row props) or `emptyLabel`; `onChange` (toggle the host's picker), `onClear`; the `picker` element (e.g. a `LinkInput`-based record picker). |
| Tasks | `RecordRailTasks` | `tasks: { id, title, titleAr?, subline?, status?, onOpen? }[]` (count in the title, max 5 rows, state badge, "Open in …" link only where `onOpen` is given), `emptyLabel`, `openLabel`; optional `onAdd` (the CRM has none). |
| Articles | `RecordRailArticles` + `RecordRailArticleReader` | `articles: { id, title, meta? }[]`, `onOpen(id)`; the reader's `kicker`, `title`, body (the host renders / sanitises it), `link`. Renders nothing without articles. The reader's `side` is the logical Sheet side (default `right` = end edge). |

Domain logic stays in the app: which organization / tasks / articles belong to a record, stores, undo, history logging,
permissions and routing come in through props and callbacks.

### 10.4 Glyphs and the host's icon version

Every icon the package draws in the rail can be replaced (`gripIcon`, `icons`, `customizeIcon`, `openIcon`, …). The CRM
is on `lucide-react` 0.462, the package on 1.28; some shapes differ (measured: `BookOpen`, `Settings2`, `CheckSquare`),
so the CRM passes its own glyphs to keep its look exactly. Hosts on the package's version can omit them.

### 10.5 Strings

`rr*` messages (en / ar): Customize sections, Visible sections, Drag to reorder, Link, Add, Change, Clear, Articles.
Pass `labels` when rendering outside a ThemeProvider or when the host's language state is not the provider's.

### 10.6 FormView: `FrappeFormView aside`

`FrappeFormView` / `FrappeForm` take `aside` (a node, or a function of the live form context like `menu`): the form
takes 3 of 4 columns from `lg` up and the aside the 4th — the CRM record page's grid. Pass a `RecordRail` for the CRM
experience or a `FrappeFormSidebar` for Desk's. Without `aside` the form's DOM is unchanged.

## 11. RecordPage — a record's details page (0.8.0-dev.2; neutral names 0.8.0-dev.3)

A record's details page as DS components. **The reference is the CRM record page** (Deal first; the same parts on Lead,
Contact, Organization, Ticket): **ports, not a redesign**. Each reproduces the CRM's markup inside its @solvfast/ui scope, verified by
structural signatures (every element's position, size and computed styles) and screenshots against the live page, 15
states × 4 theme / language / width combinations (`docs/audit/p08/` record).

### 11.1 Layout and surfaces

- `RecordPage` — `back` ({label, onClick, icon}), `actions` (the toolbar's end: Save, Actions, ⋯), `header`, `children`
  (the tabs), `aside` (a `RecordRail`), `between` (dialogs, bridges). The page container, toolbar and 3 + 1 grid.
- **`surface`** (0.8.0-dev.4): `"glass"` (**default**) or `"plain"`.
  - `"glass"` (or no `surface`) sets **`sf-record-page`**, the record page's glass surfaces
    (`styles/src/sf-record-page.css`, shipped in glass.css: import glass.css to get them). The CRM's airy glass cards
    (`.bg-card` + `.rounded-*` → the glass pane, 20 px corners on the large ones), band strips and page roots — the
    reference look in any app. The package's own `Card` stays as it is (solid in light).
  - `"plain"` omits `sf-record-page`: no record page surface styling; each component keeps its own surface classes (e.g.
    a solid `bg-card`). Nothing else changes (same DOM, roles and focus order).
  - Type: `RecordPageSurface`.

### 11.2 Header and actions

- `RecordHeaderCard variant="page"` — `avatar` (e.g. `RecordHeaderIcon` {icon, color}: the brand halo tile; or a photo),
  `title` (e.g. `EditableTitle`), `name` (#id), `statusNode` (e.g. `StatusBadge` in the lifecycle tone), `titleExtra`
  (e.g. `RecordNotSavedPill`), `facts` ({icon, text, onClick?: a link}), `value` (left-to-right, tabular), `chips`, `actions`.
  The default variant is unchanged. **`variant="crm"`** (its 0.8.0-dev.2 name) is a **deprecated alias**
  of `"page"`: the same output, kept for existing code; prefer `"page"`. (The header's `data-record-header` attribute
  reads `"page"` for both.)
- `RecordQuickAction` (outline pill; `variant="primary"` = filled) and `RecordQuickActionMenu` (`variant="split"`: Meeting ▾;
  `"more"`: More ▾; `items` with icon, icon colour, onSelect).
- The toolbar's ⋯: `RecordMenu` with `contentClassName="w-60"`, `shortcutDir="inherit"`, `layout="inline"` and the host's
  trigger; Actions: `ActionBar variant="menu"`; Save: `RecordSaveButton`.
- `RecordTabs` — {value, onValueChange, tabs: {value, label, icon, hidden?}[], overflow?, ariaLabel?} + the `TabsContent`
  panels. `overflow="fill"` (default): equal tabs sharing the bar (the CRM's main record tabs). `overflow="scroll"`: each
  tab keeps its content width and the bar scrolls horizontally when they don't fit — the CRM's own scrollable tab bar
  (its Activities sub-tabs: `w-full overflow-x-auto` around a `min-w-max` list, no-wrap tabs); on a wide screen it still
  fills. `hidden` leaves a tab out (the CRM's feature-flagged tabs); `ariaLabel` names the list. Keyboard: arrow keys
  move between the shown tabs (reversed in RTL). Not added (no CRM evidence): per-tab disabled, count badges (a
  `label` is a node), render-on-demand content.

### 11.3 Editing — `RecordEditSession`

One session per page. **Page-level Save** (`pageSave` + `commit`): many cards edit at once; every change feeds one save —
`RecordNotSavedPill`, `RecordSaveButton` (toolbar), Ctrl/Cmd+S; `saveAll()` merges the dirty regions' patches (a region's
`getPatch` returning `false` refuses and is focused) and calls `commit` once. **Single card** (default): one card at a
time, its own Save. Leaving while dirty (`useRecordEditSession().guard(fn)`) asks: Save and leave · Discard · Keep editing.
Host hooks: `notify` (saved / error — e.g. a toast), `onDirtyChange` (e.g. a shell guard), `renderUnsavedDialog` (an app's
own popup), `labels` (`res*` messages, in `messages-ws/recordEditSession.ts`; the About cards' `rpg*` are in `recordAbout.ts`. Both
were one module, `recordPageCrm.ts`, until 0.8.0-dev.2 — keys and wording unchanged). `RecordEditableCard` — {cardId, label, renderEdit({markDirty}), getPatch, onSave,
onCancel, editableWhenClosed, readOnly, icon, headerExtra}: header (icon, title, Edit), body, Cancel (+ Save) while editing.

### 11.4 About cards

`RecordInfoTile` (labelled tile; `tone` = border + wash classes), `RecordInfoRow` (icon square + label + value; `tone`),
`RecordScoreRing` (0–100; ≤ 64 px = compact), `RecordFieldList` (label / value rows; `emptyLabel`), `RecordInsightCard`
(icon, title, subtitle; e.g. an AI summary whose text the app writes), `RecordClosedNotice`, `RecordInteractions`
(inbound / outbound columns of `RecordInteraction`, up to 4 each, a row opens to its body). Domain content (the summary's
text, health signals, which interactions are inbound) stays in the app.

`RecordSectionCard` (0.8.0-dev.5) — {label, icon, headerExtra, children, cardId, className, bodyClassName}: a read-only
card in the record page family, the shell of `RecordEditableCard` without editing (same DOM as a read-only editable card:
`section.rounded-xl.border.bg-card` › header with icon, `h3` title and `headerExtra` › `p-4` body). For an app's own
content in a tab. Use `RecordEditableCard` when the card edits.

### 11.5 Composing a record page (Core, Frappe adapters, app)

A record page is **composed by the app** from Core parts; nothing in Core knows the app's record type.

```tsx
<RecordEditSession pageSave commit={save}>                 {/* optional: one Save for the page */}
  <RecordPage
    surface="glass"                                        {/* default; "plain" opts out */}
    back={{ label: "Back to …", onClick }}                 {/* toolbar start */}
    actions={<><RecordSaveButton /><ActionBar variant="menu" … /><RecordMenu … /></>}   {/* toolbar end */}
    header={<RecordHeaderCard variant="page" avatar={<RecordHeaderIcon icon={…} />} title={…} facts={…}
              actions={<><RecordQuickAction … /><RecordQuickActionMenu … /></>} />}  {/* header + quick actions */}
    aside={<RecordRail sections={[{ id, label, render }, …]} footer={<RecordRailFooter … />} />}       {/* right rail */}
  >
    <RecordTabs value={tab} onValueChange={setTab} tabs={[…]} overflow="scroll">
      <TabsContent value="about">
        <RecordEditableCard … />                           {/* edits */}
        <RecordSectionCard label="…" icon={…}>{appContent}</RecordSectionCard>   {/* read-only, app content */}
      </TabsContent>
      <TabsContent value="history"><Timeline … /></TabsContent>
    </RecordTabs>
  </RecordPage>
</RecordEditSession>
```

| Slot | What goes there | Owner |
|---|---|---|
| `back`, `actions` | navigation, Save, the transitions menu, the ⋯ menu | Core components; the handlers are the app's |
| `header` | `RecordHeaderCard variant="page"` (title, status, facts, value, quick actions) | Core component; the values and actions are the app's |
| `children` | `RecordTabs` + panels: `RecordEditableCard`, `RecordSectionCard`, the About cards, any app component | Core components; the content (fields, wording, business rules) is the app's |
| `aside` | `RecordRail` with the app's sections (Lifecycle, Assignment, Linked records, Tasks, custom ones) | Core component; each section's `render` is the app's |
| data, permissions, stores, routing, history storage | — | the app (or a Frappe adapter: `@solvfast/ui/frappe`) |

The CRM record page is the reference composition (`showcase` › Record page (CRM)); the package keeps no CRM content.
`showcase` › **Record page (dental patient)** composes the same parts for a dental clinic (package components only): a patient
journey (`LifecycleActions` in the toolbar, a read-only `LifecycleRail` from `lifecyclePath` / `lifecycleNext`, the badge
from `lifecycleTone`), five tabs (`overflow="scroll"`), an edit session, an app card (`RecordSectionCard`), an app rail
section and an embedded `ListView`.

### 11.6 Not yet

- The Frappe adapter: `FrappeFormView` rendering this page (header from the doc, sections as `RecordEditableCard`s bound
  to the form controller's dirty / save). Today `FrappeFormView aside` (§10.6) hosts the rail beside Desk's form. Run 1
  I2: the boundary is proposed in `docs/specs/FRAPPE-RECORDPAGE-BOUNDARY.md` (a headless form controller + binding
  hooks, no page component) — **awaiting the owner's review; no hooks are implemented**.
- Lead, Contact, Organization, Ticket, Service Request, Order: their headers / toolbars / About cards are not on these
  components yet (their rail cards and the edit session are).
