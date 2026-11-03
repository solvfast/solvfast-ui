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

```tsx
<FrappeWorkflowActions
  doc={doc} user={session.user} roles={session.roles} variant="steps" translate={(s) => translateLabel(bundle, s)}
  currentMarker="Current status"
  actionLabels={{ actions: "Actions", none: "No actions from this status" }}
/>
<FrappeAssignTo doc={doc} user={session.user} single variant="list" heading="Assignee"
  labels={{ assignedTo: "Assignee", none: "No assignee", add: "Set assignee", confirm: "Assign" }} />
```

---

## 2. Generic components (`src/record/`)

### 2.1 Shared types (`src/record/types.ts`)

`Tone` = `neutral | success | warning | danger | info | brand`. `TimelineItem` = `{ id, kind, at (epoch ms), actor?, actorId?, summary?,
body?, bodyFormat?, changes?, canEdit?, canDelete?, href?, icon? }` with `kind` one of `comment, change, assignment, attachment, state,
created, modified, info, like, communication, custom`. `Assignee` = `{ id, name, image?, description? }`. `UserOption` =
`{ id, label, image?, description? }`. `MentionOption` = `{ id, label, isGroup? }`. `LifecycleStateItem` = `{ id, label, tone?, by?, at? }`.
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

### 2.4 `AssigneeGroup` and `AssignPicker`

`AssigneeGroup` props: `assignees`, `onAssign(users, details)`, `onRemove(assignee)`, `canRemove(assignee)` (default: nobody),
`variant` (`"avatars"` stacked, Desk-like, or `"list"` named rows), `maxVisible` (default 4, then `+n`), `loading`, `heading`, `labels`,
plus the picker props below. Without `onAssign` there is no add button. `onRemove` failures are shown inline.

`AssignPicker` props: `searchUsers(query) → UserOption[]`, `onAssign(users, { description?, date?, priority? })`, `exclude` (already
assigned: shown ticked and not selectable, because the server would report them as duplicates), `me` (enables "Assign to me"), `single`,
`withDetails` (comment, "Complete by" date and priority as in Desk's dialog), `trigger`, `disabled`, `disabledReason`, `labels`.
Search is debounced (250 ms) and keyboard driven (combobox/listbox, arrows + Enter). `labels`: `assignedTo, none, add, search, toMe,
confirm, description, due, priority, low, medium, high, remove ("Remove {0}"), noMatches, cancel`.

### 2.5 `LifecycleBar`, `ActionBar`, `StatusBadge`

`StatusBadge { label, tone, variant: "pill" | "dot", title }`: the label is always shown; colour is never the only carrier.

`LifecycleBar { states, current, currentLabel, actions, onAction, variant: "steps" | "compact", busy, actionsDisabled,
actionsDisabledReason, actionLabels, currentMarker, showCurrentEntry, now }`:

- `states` in lifecycle order; each may carry `by` and `at` (who moved the record into it, and when). The stepper marks past / current /
  future (`aria-current="step"`, `data-step`), and shows "actor · relative time" under **past** states (current too with `showCurrentEntry`),
  like the CRM's rail widget.
- If `current` is not among `states`, `currentLabel` is shown in the badge.
- `compact` shows only the badge and the actions.

`ActionBar { actions, onAction, variant: "menu" | "buttons", busy, disabled, disabledReason, labels }`: an action with `confirm` opens an
alert dialog first. `onAction` may return a promise; a rejection is shown under the bar (`role="alert"`) and the action can be retried.
`labels`: `actions, none, confirmTitle ("… {0} …"), confirmBody, confirm, cancel, working`.

```tsx
<LifecycleBar
  states={[{ id: "new", label: "New", by: "Ann", at: Date.now() - 3.6e6 }, { id: "won", label: "Won", tone: "success" }]}
  current="new" variant="steps"
  actions={[{ id: "win", label: "Mark won", confirm: "Close this deal as won?" }]}
  onAction={async (a) => api.apply(a.id)}
/>
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

`<FrappeWorkflowActions doc user roles? variant? translate? confirm? onApplied? fallback? docinfo? currentMarker? actionLabels? showCurrentEntry? className? />`

- Renders the current state (badge, tone from the Workflow State `style`) and the actions the user may apply now. `variant="steps"` adds the
  stepper with actor/time (see 3.6); `"compact"` (default) is badge + Actions.
- Nothing for a new document (`__islocal`); `fallback` for a DocType without a workflow; a skeleton while loading.
- **Unsaved edits** (`__unsaved`): transitions are not fetched and the actions are disabled with a reason, because `apply_workflow`
  reloads the document from the database and discards posted edits (Desk hides them). Save first.
- `confirm`: `true` or `(action) => boolean` asks before applying (Desk applies immediately).
- `onApplied(doc, action)` gets the document the server returned, after the cache was updated.
- A server refusal ("Not a valid Workflow Action", "Self approval is not allowed", a validation error) appears under the bar; retry is possible.

`useWorkflow({ doc, user, roles?, enabled? })` returns `{ workflow, isLoading, error, state, transitions, needsSave, readOnly, standardActions,
apply(action), applying }`. `useWorkflowDefinition(doctype, enabled?)` returns `{ workflow, isLoading, error }` from `getWorkflow` or, without it,
from `meta.__workflow_docs`.

Rules implemented (pure functions in `workflow.ts`, all exported):

| Function | Native source |
|---|---|
| `workflowFromMeta` | `__workflow_docs` → definition, merging each Workflow State's `style` / `icon` into the Workflow's state rows |
| `currentState`, `defaultState` | state field, else the first state whose `doc_status` equals the docstatus (`workflow.js get_state`) |
| `visibleTransitions` | server already filtered state, role and `condition` (`get_transitions`); Desk then keeps roles the user holds (when `roles` is given) and `hasApprovalAccess` |
| `hasApprovalAccess` | `user === "Administrator" || transition.allow_self_approval || user !== doc.owner` (repeated on the server) |
| `isReadOnlyState` | read-only when none of the user's roles equals the state's `allow_edit`; new docs never |
| `workflowLockedFields` | the state field and every `update_field` stay read-only |
| `canCancelDocument`, `standardActionsUnderWorkflow` | Submit is never offered; Save only when dirty; Cancel only if no transition leads to a docstatus-2 state; the primary/secondary buttons give way to the workflow actions |
| `toneForStyle`, `lifecycleStates`, `lifecycleActions` | mapping to `LifecycleBar` items |

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
- APIs: `frappe.desk.form.assign_to.add`, `.remove`; `get_docinfo`. **Not implemented:** `assign_to.close` (assignee completes), bulk assignment,
  User Group expansion, the "Assign to User Group" field.

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
- Expanding an entry lists **all** visible changed fields, which is a superset of Desk's 3-part summary.

**Field visibility (permlevel):** a changed field is skipped when it is hidden (unless `show_on_timeline`) or when its display status
for the user is `None` (`usePermissions().fieldStatus`, with the child DocType and the parent for table rows). This needs
`session.roles` on `FrappeProvider`; without roles rights are approximated. `canSeeField(fieldname, table?)` adds a filter.

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
| FrappeAssignTo | `assign_to.add/remove`, `get_docinfo`, `search_link` | read on the doc (server); write for the client's remove gate |
| FrappeTimeline | `get_docinfo`, `get_communications`, `add_comment`, `update_comment`, `client.delete`, `get_names_for_mentions` | read on the doc; Comment delete right; `track_changes` for versions |
| FrappeStatusIndicator | `getdoctype` | none beyond the doc |

### 3.6 `stateEntries` — actor and time per workflow state

`stateEntries({ doc, docinfo, stateField, states, translate? }) → Map<state, { by, at }>` feeds `LifecycleBar` (`variant="steps"` in
`FrappeWorkflowActions` calls it for you).

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
- **Assignment:** `single` is a UI choice, not a server rule; close, bulk and group assignment are missing (see 3.2).
- **Workflow:** `condition` is evaluated by the server only; the client cannot predict a hidden action. `update_field` values are set by the
  server on apply. Queued submissions (`queue_in_background`) return no document; A1's client flags this and the cache invalidates.
- **Stepper actor/time** relies on `workflow_logs` language handling noted in 3.6 (UNVERIFIED on a translated site).
- **Everything is simulated:** no component has run against a real Frappe site; rows marked UNVERIFIED in docs 11 §8 and 14 §A also apply here.
