/**
 * FrappeFormView — a Desk form from a meta bundle and a document, without data fetching (FrappeForm connects it to
 * the foundation hooks). Behaviour from docs `11` (Frappe 15.110):
 *  - layout: tabs / sections / columns / collapsible (§2.1–2.3); empty sections and tabs hidden, the tab bar hidden when
 *    one tab is left; collapsible sections closed by default, `collapsible_depends_on`, forced open by a missing
 *    required field — evaluated at load and after save;
 *  - dependencies re-evaluated after every change (D-23 interpreter); unsupported expressions listed at load;
 *  - display status: the permissions' `displayStatus` (foundation ladder) + the fetch_from lock;
 *  - permissions: without a `permissions` prop the view knows nothing about the user's rights and DENIES (Phase 26
 *    rule 9, P2-1): read-only fields, no Save / Submit / Update / Cancel / Amend, no Ctrl+S, and the "Read only"
 *    notice (`data-permissions="unknown"`). `FrappeForm` passes `usePermissions`; a standalone view must pass it too;
 *  - value pipeline through the docStore; Link validation writes fetch_from targets; dirty → "Not Saved";
 *  - Save / Submit / Update / Cancel / Amend by Desk's action matrix; Save: `validate` → `before_save` →
 *    check_mandatory (Missing Fields dialog, jumps to the first missing field's tab) → `onSave`; a clean Save shows
 *    "No changes in document" without a request; Submit asks "Permanently Submit {name}?" and runs `before_submit`
 *    first; Update skips `validate` / `before_save`; Cancel asks "Permanently Cancel {name}?" and runs
 *    `before_cancel`; double submits are ignored; after a save the server's document replaces the local one, then
 *    `after_save` → `refresh` (→ `on_submit`). Ctrl/⌘+S = Desk's `trigger_primary_action` (desk.js:389-403): the active
 *    input is blurred, then the VISIBLE primary action runs (Save / Submit → confirm / Update / Amend; nothing when
 *    `saveDisabled`, without the right, or while workflow actions replace the buttons) — document-level while this is
 *    the topmost mounted form (`hotkeys={false}` opts out). Ctrl/⌘+Z / Ctrl/⌘+Shift+Z / Ctrl/⌘+Y undo / redo the user's
 *    field changes outside text inputs. Leaving the page while dirty asks first (`beforeunload`); in-app navigation is
 *    the host router's — `onDirtyChange` / `useUnsavedChangesBlocker`.
 *  - server errors: `FrappeErrorState` (the foundation's single rendering of FrappeError).
 *  - formEvents (D-24) instead of Desk Client Scripts.
 *  - header indicator: `resolveIndicator` (frappe.get_indicator precedence: Not Saved → workflow state with its style
 *    colour → Draft / Cancelled → meta.states → Submitted → status → enabled);
 *  - with a workflow: Cancel only when no transition leads to a cancelled state (`canCancelDocument`), unless given;
 *  - a 417 TimestampMismatchError keeps the user's edits on screen and offers Reload (Desk's refresh banner);
 *  - Cancel pre-flight (`getSubmittedLinkedDocs`): submitted linked documents are listed with "Cancel All"
 *    (`cancelAllLinkedDocs`, then the document is reloaded and cancelled) — offered only when `canCancelAllLinked`
 *    answers true (form.js:925-931: Desk always knows `frappe.model.can_cancel`); false → Desk's explanation; no
 *    answer (unknown) → the same explanation marked `data-permissions="unknown"` and no button (rule 9, P3-1);
 *  - Amend: the app's `onAmend`, else a local copy (`amendDoc`: from_amend copy + `amended_from`), disabled when
 *    `alreadyAmended` (`is_document_amended`).
 * Run 1 C-79: a newer server copy while the form is dirty shows "modified after you opened it" with Reload (FrappeForm's
 * `realtime` port delivers it; without one it comes with the next read). Connections: an `extraTabs` slot hosts them. Workflow action buttons
 * come from A4's record layer (FrappeForm renders them; FrappeFormView takes `workflowActionsShown`).
 */
import * as React from "react";
import { ChevronDown, ExternalLink, LayoutList, Pencil } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../primitives/dropdown-menu";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import { Badge } from "../../primitives/badge";
import { DESK_INDICATOR_COLOURS, statusColorStyles } from "../../primitives/status-dot";
import { Button } from "../../primitives/button";
import { Tabs, TabsList, TabsTrigger } from "../../primitives/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../primitives/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../primitives/alert-dialog";
import { interpolate } from "../../fields/FieldShell";
import type { DocInfo, DocPermissions, FieldDisplayStatus, FrappeDoc, FrappeDocField, MetaBundle, PermType, ValidateLinkResult } from "../contract";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { htmlToText } from "../feedback/ServerHtml";
import { FrappeError } from "../client";
import { resolveIndicator } from "../services/indicator";
import { canCancelDocument, workflowFromMeta } from "../record/workflow";
import { amendDoc, canAmend } from "./model/copy";
import { createDocStore, type DocStore, type FieldChange } from "./model/docStore";
import { analyzeDependencies, isEmptyValue, resolveFields, sectionCollapsed, type DependsIssue, type EffectiveField, type FieldOverrides } from "./model/depends";
import { buildFetchMap, fetchUpdates, isReadOnlyByFetch, type FetchEntry } from "./model/fetch";
import { buildLayout, sectionFields, type LayoutSection, type LayoutTab } from "./model/layout";
import { checkMandatory, type MandatoryLine, type MandatoryResult } from "./model/mandatory";
import { formActions, type FormAction } from "./model/actions";
import { fieldErrorsFromFrappeError } from "./model/errors";
import { controlStatus, ladderStatus } from "./model/status";
import type { DefaultsContext } from "./model/defaults";
import { TABLE_TYPES, analyzeFieldtypes } from "./model/fieldtypes";
import { runEvent, type CustomButton, type FormController, type FormEventsConfig, type LinkQuery } from "./events";
import { useFormServices } from "./services";
import { ReadRow } from "./ReadRow";
import { useLinkTitles } from "./linkTitles";
import { FrappeField, type FrappeFieldProps } from "./FrappeField";
import type { TableController } from "./FrappeChildTable";
import { FrappeFormImage } from "./FrappeFormImage";
import { FrappeAttachHost, type FrappeAttachHostValue } from "./attachHost";
import { missingLineText } from "./missingLines";
import { RenameDialog } from "../../record/RenameDialog";

/** What the form needs from `usePermissions` (foundation). */
export interface FormPermissions {
  levels?: DocPermissions;
  can?(ptype: PermType, permlevel?: number): boolean;
  displayStatus?(df: FrappeDocField, doc: FrappeDoc, parent?: FrappeDoc, opts?: { gridCell?: boolean; onlyInput?: boolean }): FieldDisplayStatus;
  workflowReadOnly?: boolean;
  workflow?: unknown;
  /** `usePermissions().known`: false = the rights are the rule-9 denial for missing information (no `session.roles`);
   *  the toolbar then says read-only instead of silently offering nothing. Omitted = known (the app supplied rights). */
  known?: boolean;
}

export type SaveAction = "Save" | "Submit" | "Update";
/** A submitted document linked to the one being cancelled (get_submitted_linked_docs). */
export interface LinkedDoc { doctype: string; name: string; docstatus?: number; [key: string]: unknown }

export interface FrappeFormViewProps extends FormEventsConfig {
  bundle: MetaBundle;
  /** The loaded document or a new one (`newDoc`). A different name, or a newer `modified` while clean, replaces the
   *  local copy. */
  doc: FrappeDoc;
  docinfo?: DocInfo;
  /** The user's rights (`usePermissions`). Omitted → nothing is known → the form is read-only with the "Read only"
   *  notice (rule 9: missing information denies — before 0.4.0-dev.31 every right was assumed). */
  permissions?: FormPermissions;
  /** savedocs: resolve with the document the server sent back (or reject with a FrappeError). */
  onSave: (doc: FrappeDoc, action: SaveAction) => Promise<FrappeDoc>;
  /** desk.form.save.cancel. */
  onCancelDoc?: (doc: FrappeDoc) => Promise<FrappeDoc>;
  /** Amend a cancelled document. Default: a local copy (`amendDoc`) replaces the form's document — then `onAmended`. */
  onAmend?: (doc: FrappeDoc) => void;
  /** The local amendment was created (route to it if the app routes by name). */
  onAmended?: (doc: FrappeDoc) => void;
  /** Re-read the document from the server (Reload after a timestamp conflict, after "Cancel All"). */
  onReload?: () => Promise<FrappeDoc | undefined>;
  /** Cancel pre-flight: `frappe.desk.form.linked_with.get_submitted_linked_docs` → `{ docs, count }`. */
  getSubmittedLinkedDocs?: (doc: FrappeDoc) => Promise<{ docs: LinkedDoc[]; count: number }>;
  /** `frappe.desk.form.linked_with.cancel_all_linked_docs`. */
  cancelAllLinkedDocs?: (docs: LinkedDoc[]) => Promise<void>;
  /** Whether the user may cancel every linked DocType (Desk `frappe.model.can_cancel`, form.js:925-931). "Cancel All"
   *  is offered only for `true`; false → Desk's explanation; undefined / omitted (unknown) → no button and the
   *  explanation marked `data-permissions="unknown"` (rule 9; before 0.4.0-dev.31 unknown offered it). */
  canCancelAllLinked?: (docs: LinkedDoc[]) => Promise<boolean | undefined> | boolean | undefined;
  onSaved?: (doc: FrappeDoc, action: SaveAction | "Cancel") => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Changes the host keeps outside this document that the form's Save also saves (e.g. a type's Form section): while
   *  `dirty` the form counts as not saved, and Save runs `save()` after the document's own save — alone when only they
   *  changed. A failed `save()` shows its error like a failed save. */
  alsoSave?: { dirty: boolean; save: () => Promise<void> };
  /** Defaults for new child rows (session user, user defaults). */
  defaults?: DefaultsContext;
  saveDisabled?: boolean;
  /** Every field shown read-only and no Save / Update (nor Ctrl+S): a record page's view before Edit. Workflow actions,
   *  Submit / Cancel and the menu stay. */
  viewOnly?: boolean;
  /** A saved record reads until it is opened for editing (see `editScope`). Opening does not make the form "not saved":
   *  only a changed value does (the Not saved tag, Save, `onDirtyChange`, the leave guard). Save saves every open
   *  section and closes them. A new record is edited whole. */
  sectionEdit?: boolean;
  /** With `sectionEdit`: what an Edit opens.
   *  - `"section"` (default): each section has its own Edit and Cancel (putting back what is saved there).
   *  - `"record"`: one Edit (`data-record-edit`, in the `header` context's `editAction`, else in the toolbar) opens every
   *    editable section at once; the toolbar has Save and one Cancel (`data-record-cancel-edit`) that closes them all
   *    and puts back the saved copy; no per-section buttons. */
  editScope?: "section" | "record";
  /** The host shows the record's state (e.g. a record page's header): no state indicator in the toolbar. The Not saved,
   *  Draft, Submitted and Cancelled tags stay. */
  stateInHeader?: boolean;
  /** Workflow action buttons are shown by the app (they replace Save / Submit / Cancel while clean). */
  workflowActionsShown?: boolean;
  /** `can_cancel_document` for a workflow DocType. */
  canCancelWithWorkflow?: boolean;
  alreadyAmended?: boolean;
  /** Rendered next to the primary action (e.g. workflow actions, a menu). */
  toolbarExtra?: React.ReactNode;
  hideToolbar?: boolean;
  /** Title override (default: "New {DocType}" / title field / name). */
  title?: React.ReactNode;
  /** A record header shown under the toolbar instead of the toolbar's title block (image, title, name, web link). A
   *  function receives `FrappeFormHeaderContext` (e.g. `editAction`, the record's Edit with `editScope="record"`, to
   *  place by the record's name). */
  header?: React.ReactNode | ((ctx: FrappeFormHeaderContext) => React.ReactNode);
  /** With `header`: what the toolbar shows where the title was (e.g. a Back button). */
  toolbarStart?: React.ReactNode;
  /** A record page's own tab bar (SayrRecordPage's About | History | …), under `header` and above the form's tab bar. */
  pageTabBar?: React.ReactNode;
  /** While set, shown instead of the form's tab bar and fields (another page tab is open); the form keeps its state. */
  pageTabPanel?: React.ReactNode;
  /** "record": the tab bar spans the width, each tab an equal share (record pages). Default "default". */
  tabBar?: "default" | "record";
  /** Ask before leaving the page with unsaved changes (default true). */
  guardUnload?: boolean;
  /** The form's controller (`frm`) for code outside the events. */
  controllerRef?: React.MutableRefObject<FormController | null>;
  className?: string;
  // ---- P35 slots (fixed contract: other workstreams build on them) ----
  /** Rendered in the header action area, after the primary action (e.g. a "⋯" menu). A function is called on every
   *  render with the form's live state (`FrappeFormMenuContext`: the controller, the document as edited, reload, tab
   *  switching) — `FrappeForm` renders its default `FrappeRecordMenu` this way (P35 integration). */
  menu?: React.ReactNode | ((ctx: FrappeFormMenuContext) => React.ReactNode);
  /** Extra tabs appended after the form's own tabs (Connections, Activity …). A form without Tab Breaks then shows its
   *  fields under a "Details" tab. `render` runs only while the tab is active. */
  extraTabs?: Array<{ key: string; label: string; render: () => React.ReactNode }>;
  /** Only the meta fields (breaks included) it accepts take part in the layout (Quick Entry uses it). Hidden / permission
   *  statuses still apply; the mandatory check still covers every required field — keep required fields in. */
  fieldFilter?: (df: FrappeDocField) => boolean;
  /** The tab shown, by its key (`onTabsChange` lists them): the host drives the tabs (a wizard's steps). Absent, the
   *  form keeps its own. */
  activeTab?: string;
  /** No tab bar: the host shows the tabs its own way (a stepper) through `activeTab`. */
  hideTabBar?: boolean;
  /** The form's visible tabs in order (key + label), whenever they change. */
  onTabsChange?: (tabs: { key: string; label: string }[]) => void;
  /** Draw a field the host's way (e.g. an icon and its colour as one picker): return a node, or `undefined` for the
   *  form's own control. `setValue` writes any field of the document, as the form's controls do. */
  renderField?: (df: FrappeDocField, context: { value: unknown; doc: FrappeDoc; setValue: (fieldname: string, value: unknown) => void; status: FieldDisplayStatus }) => React.ReactNode | undefined;
  /** Desk's keyboard shortcuts while this form is the topmost one mounted: Ctrl/⌘+S runs the visible primary action
   *  (desk.js `trigger_primary_action`), Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z or Ctrl/⌘+Y redo (outside text inputs).
   *  Default true; false registers nothing. */
  hotkeys?: boolean;
  /** Run 1 (C-67, Desk toolbar.js:116-288): the title opens a dialog to change the title field and / or rename the
   *  document (`frappe.model.rename_doc.update_document_title`). Offered with the write right on a saved document whose
   *  title field is an editable Data field, or a DocType that allows renaming. `FrappeForm` wires it. */
  onRenameTitle?: (args: { docname: string; name: string; title?: string; merge: boolean }) => Promise<unknown>;
  /** P36b attachimage: be the Attach / Attach Image controls' form (Desk's `frm`, attach.js:36-46, 137-144) — after an
   *  upload or a Clear the form saves (`Update` on a submitted document). Default true; false (Quick Entry: Desk's
   *  dialog controls have no `frm`) makes them only set their value. */
  attachHost?: boolean;
  /** A record rail next to the form — e.g. @solvfast/ui's `RecordRail` (the CRM record page's right rail) or the Desk
   *  `FrappeFormSidebar`. From `lg` up the form takes 3 of 4 columns and the rail the 4th (the CRM record page's grid);
   *  below `lg` the rail follows the form. A function receives the same live context as `menu`. Absent → the form's
   *  layout is unchanged. */
  aside?: React.ReactNode | ((ctx: FrappeFormMenuContext) => React.ReactNode);
}

/** What a `header` render function receives. */
export interface FrappeFormHeaderContext {
  /** `editScope="record"` while the record reads and may be edited: its Edit button (`data-record-edit`). The header
   *  that places it replaces the toolbar's. */
  editAction?: React.ReactNode;
  /** `editScope="record"`: the record is open for editing. */
  editing: boolean;
}

/** What a `menu` render function receives (P35 integration). */
export interface FrappeFormMenuContext {
  /** The form's controller (`frm`): `undo()` / `redo()` / `canUndo` / `canRedo`, `save()`, … */
  frm: FormController;
  /** The document as the form holds it now (unsaved edits included). */
  doc: FrappeDoc;
  dirty: boolean;
  /** Re-read the document (`onReload`); undefined when the form has no `onReload` (a new document). */
  reload?: () => Promise<void>;
  /** Activate a tab: a Tab Break's key, or `extra:<key>` for an `extraTabs` entry. */
  showTab: (key: string) => void;
  /** The keys of the tabs currently shown (own tabs, then `extra:<key>`). */
  tabs: string[];
}

type Overrides = Record<string, FieldOverrides>;
/** Mounted forms with hotkeys, in mount order: only the last (topmost — e.g. a Quick Entry dialog over a form) answers. */
const hotkeyStack: object[] = [];
const initials = (text: string) => text.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const asList = (f: string | string[]) => (Array.isArray(f) ? f : [f]);
/** The document's own values (no `__` bookkeeping keys), blank as blank: what "nothing changed" compares. */
const plainValue = (v: unknown): unknown => {
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v)) return v.map(plainValue);
  if (typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !k.startsWith("__")).map(([k, x]) => [k, plainValue(x)]).filter(([, x]) => x !== null).sort(([a], [b]) => String(a).localeCompare(String(b))));
  return v;
};
const sameAsSaved = (a: FrappeDoc, b: FrappeDoc) => JSON.stringify(plainValue(a)) === JSON.stringify(plainValue(b));

export function FrappeFormView(props: FrappeFormViewProps) {
  const { bundle, doc: docProp, permissions, onSave, onCancelDoc, className } = props;
  const { t, isRTL } = useLocale();
  const s = useFormServices();
  const meta = bundle.meta;
  const [store] = React.useState<DocStore>(() => createDocStore(bundle, docProp, props.defaults));
  const doc = React.useSyncExternalStore(store.subscribe, store.getDoc, store.getDoc);
  const [overrides, setOverrides] = React.useState<Overrides>({});
  const queries = React.useRef<Record<string, LinkQuery>>({});
  const issueKey = (i: DependsIssue) => `${i.doctype}.${i.fieldname}.${i.property}.${i.kind}`;
  const [initialIssues] = React.useState<DependsIssue[]>(() => analyzeDependencies(bundle, s.evaluator));
  const [issues, setIssues] = React.useState<DependsIssue[]>(initialIssues);
  // fieldtypes without a control (shown read-only by FrappeField) are listed with the expression issues (P35)
  const fieldtypeIssues = React.useMemo(() => analyzeFieldtypes(bundle), [bundle]);
  const seenIssues = React.useRef(new Set<string>(initialIssues.map(issueKey)));
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [saving, setSaving] = React.useState<FormAction | null>(null);
  const [error, setError] = React.useState<unknown>(null);
  // P35 (A43): a MandatoryError / LinkValidationError from the server is also shown on the fields it names
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [notice, setNotice] = React.useState<string | null>(null);
  const [missing, setMissing] = React.useState<MandatoryResult | null>(null);
  const [confirm, setConfirm] = React.useState<"Submit" | "Cancel" | null>(null);
  const [linked, setLinked] = React.useState<LinkedDoc[] | null>(null);
  const [linkedCancellable, setLinkedCancellable] = React.useState<boolean | undefined>(undefined);
  const [version, setVersion] = React.useState(0);
  const [openSections, setOpenSections] = React.useState<ReadonlySet<string>>(() => new Set());
  const savingRef = React.useRef(false);
  const latestProps = React.useRef(props);
  latestProps.current = props;

  // ---- evaluator with issue collection ----
  const onIssue = React.useCallback((i: DependsIssue) => {
    const key = issueKey(i);
    if (seenIssues.current.has(key)) return;
    seenIssues.current.add(key);
    queueMicrotask(() => setIssues((list) => [...list, i]));
  }, []);
  const evaluator = React.useMemo(() => ({ ...s.evaluator, onIssue: (i: DependsIssue) => { s.evaluator.onIssue?.(i); onIssue(i); } }), [s.evaluator, onIssue]);

  // ---- getdoc's `_link_titles` (kept on the docinfo by the client, P35 F3) seed the link-title cache before the Link
  //      fields render (Desk merges them into frappe._link_titles, request.js:295) ----
  const titleCache = useLinkTitles();
  const serverTitles = props.docinfo?._link_titles;
  React.useMemo(() => {
    if (!serverTitles || typeof serverTitles !== "object") return;
    for (const [k, v] of Object.entries(serverTitles as Record<string, unknown>)) {
      const at = k.indexOf("::");
      if (at > 0 && typeof v === "string") titleCache.remember(k.slice(0, at), k.slice(at + 2), v);
    }
  }, [serverTitles, titleCache]);

  // ---- an incoming document replaces the local copy (load / reload / external save) ----
  // Run 1 C-79 (Desk form.js:527-537, 1990-2064): a NEWER server copy while the form has unsaved edits is not applied
  // silently — the form says so and offers Reload (which discards the edits); a clean form takes it at once (above)
  const [newerOnServer, setNewerOnServer] = React.useState<FrappeDoc | null>(null);
  const [titleDialog, setTitleDialog] = React.useState(false);
  React.useEffect(() => {
    const cur = store.getDoc();
    if (docProp === cur) return;
    // Another record closes what was open; a newer copy of this one while nothing was changed just refreshes the values
    // (an open but untouched section stays open).
    if (docProp.name !== cur.name) { store.replace(docProp); setVersion((v) => v + 1); setNewerOnServer(null); setOpenSections(new Set()); return; }
    if (docProp.modified !== cur.modified && !store.isDirty()) { store.replace(docProp); setVersion((v) => v + 1); setNewerOnServer(null); return; }
    if (store.isDirty() && docProp.modified && cur.modified && String(docProp.modified) > String(cur.modified)) setNewerOnServer(docProp);
  }, [docProp, store]);
  const takeNewer = () => { if (!newerOnServer) return; savedRef.current = newerOnServer; store.replace(newerOnServer); setVersion((v) => v + 1); setNewerOnServer(null); setError(null); setOpenSections(new Set()); };
  // What a section's Cancel puts back: the record as last loaded or saved.
  const savedRef = React.useRef(docProp);
  React.useEffect(() => { if (!store.isDirty()) savedRef.current = docProp; }, [docProp, store]);
  const unsaved = !!doc.__unsaved || !!props.alsoSave?.dirty;
  React.useEffect(() => { props.onDirtyChange?.(unsaved); }, [unsaved]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (props.guardUnload === false || !unsaved || typeof window === "undefined") return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [unsaved, props.guardUnload]);

  // ---- effective fields and statuses ----
  const viewOnly = !!props.viewOnly;
  const childFields = React.useCallback((childDoctype: string) => bundle.children[childDoctype]?.fields ?? [], [bundle]);
  const eff = React.useMemo(() => resolveFields(meta.fields ?? [], doc, doc, evaluator, overrides[meta.name]), [meta, doc, evaluator, overrides]);
  const fieldsByName = React.useMemo(() => new Map((meta.fields ?? []).map((f) => [f.fieldname, f])), [meta]);
  const statusOf = React.useCallback((df: EffectiveField, row: FrappeDoc, parent?: FrappeDoc, gridCell = false): FieldDisplayStatus => {
    // ladder step 3 (hidden_due_to_dependency → None); the foundation applies it too (its boolean handling was fixed in
    // e266cfe) — kept so a field hidden by a dependency never shows whatever status function is supplied
    if (df.hidden_due_to_dependency) return "None";
    let st: FieldDisplayStatus;
    if (permissions?.displayStatus) st = permissions.displayStatus(df, row, parent, gridCell ? { gridCell: true } : undefined);
    else {
      const ladder = ladderStatus(df, parent && !row.docstatus ? { ...row, docstatus: parent.docstatus } : row, permissions?.levels, { workflowReadOnly: permissions?.workflowReadOnly });
      // no permission information at all (P2-1): show what the app handed over, edit nothing — demoted BEFORE the control
      // rules so a blank read-only field is hidden as Desk hides it (base_control.js get_status)
      st = controlStatus(!permissions && ladder === "Write" ? "Read" : ladder, df, row);
    }
    // A record's view reads every field it could edit, a blank one too (its label stays, so a section keeps its layout).
    if (st === "Write" && viewOnly) st = "Read";
    if (st === "Write" && isReadOnlyByFetch(df, row)) st = "Read";
    return st;
  }, [permissions, viewOnly]);

  // ---- fetch maps ----
  const fetchMaps = React.useMemo(() => {
    const m = new Map<string, Map<string, FetchEntry[]>>();
    m.set(meta.name, buildFetchMap(meta));
    for (const c of Object.values(bundle.children)) m.set(c.name, buildFetchMap(c));
    return m;
  }, [bundle, meta]);

  // ---- default Link values of a new document run validate_link + fetch once (form.js:569 -> trigger_link_fields, :1103-1112) ----
  const linkTriggersDone = React.useRef<string | null>(null);
  React.useEffect(() => {
    const cur = store.getDoc();
    if (!cur.__islocal || !cur.__run_link_triggers || linkTriggersDone.current === cur.name) return;
    linkTriggersDone.current = cur.name;
    const docName = cur.name;
    for (const df of meta.fields ?? []) {
      const v = cur[df.fieldname];
      if (df.fieldtype !== "Link" || typeof v !== "string" || !v || !df.options || df.ignore_link_validation) continue;
      const entries = fetchMaps.get(meta.name)?.get(df.fieldname) ?? [];
      void s.validateLink(df.options, v, entries.map((e) => e.source)).then((r) => {
        if (store.getDoc().name !== docName) return;
        const updates = fetchUpdates(entries, df.fieldname, r);
        if (r.name == null) updates[df.fieldname] = null;
        else if (r.name !== v) updates[df.fieldname] = r.name;
        else delete updates[df.fieldname];
        if (Object.keys(updates).length) store.setValues(updates);
      }, () => { /* the error reaches the user through the server-message host; the default value stays */ });
    }
  }, [store, meta, fetchMaps, s, doc.name]);

  // ---- a new document of a workflow DocType starts in the workflow's default state (form/workflow.js:143-151,
  //      model/workflow.js:28-38: the first state whose doc_status is the document's docstatus) ----
  const wfDefaults = React.useMemo(() => workflowFromMeta(meta as never), [meta]);
  React.useEffect(() => {
    const cur = store.getDoc();
    if (!cur.__islocal || !wfDefaults) return;
    const field = wfDefaults.workflow_state_field;
    if (!field || cur[field]) return;
    const st = wfDefaults.states.find((x) => Number(x.doc_status) === Number(cur.docstatus ?? 0))?.state;
    if (st) store.setValue(field, st);
  }, [store, wfDefaults, doc.name]);

  // ---- the frm controller (D-24) ----
  const frmRef = React.useRef<FormController | null>(null);
  const [customButtons, setCustomButtons] = React.useState<CustomButton[]>([]);
  // functions defined further down (they close over the render's state); the controller calls the latest ones
  const fns = React.useRef({
    save: async (_a?: SaveAction): Promise<boolean> => false,
    checkMandatory: (): boolean => true,
    flash: (_key: "formNothingToUndo" | "formNothingToRedo"): void => {},
  });
  /** Desk `frm.trigger`: handlers of the form's DocType; with a child DocType, its child handlers when it has any. */
  const trigger = React.useCallback(async (event: string, cdt?: string, cdn?: string, childOnly = false): Promise<boolean> => {
    const p = latestProps.current;
    const child = cdt && cdt !== meta.name ? p.childEvents?.[cdt]?.[event] : undefined;
    const handlers = childOnly ? child : child ?? p.events?.[event];
    return runEvent(handlers, frmRef.current!, event, cdt, cdn);
  }, [meta.name]);
  const setDf = React.useCallback((doctype: string, fields: string[], patch: Partial<FrappeDocField>) => {
    setOverrides((o) => {
      const cur = { ...(o[doctype] ?? {}) };
      for (const f of fields) cur[f] = { ...cur[f], ...patch };
      return { ...o, [doctype]: cur };
    });
  }, []);
  const tableChild = React.useCallback((table: string) => String(fieldsByName.get(table)?.options ?? ""), [fieldsByName]);
  if (!frmRef.current) {
    const frm: FormController = {
      get doctype() { return meta.name; },
      get docname() { return store.getDoc().name; },
      get doc() { return store.getDoc(); },
      get isNew() { return store.isNew(); },
      get isDirty() { return store.isDirty(); },
      validated: true,
      setValue(field, value) { if (typeof field === "string") store.setValue(field, value); else store.setValues(field); },
      setRowValue(table, rowName, field, value) { const t0 = { parentfield: table, name: rowName }; if (typeof field === "string") store.setValue(field, value, t0); else store.setValues(field, t0); },
      setDfProperty(field, property, value, table) { setDf(table ? tableChild(table) : meta.name, [field], { [property]: value } as Partial<FrappeDocField>); },
      toggleDisplay(fields, show) { setDf(meta.name, asList(fields), { hidden: show ? 0 : 1 }); },
      toggleReqd(fields, reqd) { setDf(meta.name, asList(fields), { reqd: reqd ? 1 : 0 }); },
      toggleEnable(fields, enable) { setDf(meta.name, asList(fields), { read_only: enable ? 0 : 1 }); },
      setQuery(field, query, table) { queries.current[`${table ?? ""}.${field}`] = query; },
      addChild(table, values) { return store.addRow(table, { values }); },
      clearTable(table) { store.clearTable(table); },
      trigger: (event, cdt, cdn) => trigger(event, cdt, cdn),
      save: (action) => fns.current.save(action),
      checkMandatory: () => fns.current.checkMandatory(),
      selectedWorkflowAction: null,
      undo() { if (!store.undo()) fns.current.flash("formNothingToUndo"); },
      redo() { if (!store.redo()) fns.current.flash("formNothingToRedo"); },
      get canUndo() { return store.canUndo(); },
      get canRedo() { return store.canRedo(); },
      addCustomButton(label, handler, group) {
        setCustomButtons((list) => [...list.filter((b) => !(b.label === label && b.group === group)), { label, handler, group }]);
      },
      removeCustomButton(label, group) { setCustomButtons((list) => list.filter((b) => !(b.label === label && b.group === group))); },
      clearCustomButtons() { setCustomButtons((list) => (list.length ? [] : list)); },
    };
    frmRef.current = frm;
  }
  React.useEffect(() => { if (props.controllerRef) props.controllerRef.current = frmRef.current; }, [props.controllerRef]);
  // P36b attachimage: the form the Attach controls save (frm.save — the same checks as the toolbar's Save / Update)
  const attachHost = React.useMemo<FrappeAttachHostValue>(() => ({
    save: (a) => fns.current.save(a),
    getDoc: () => store.getDoc(),
    getDocInfo: () => latestProps.current.docinfo,
  }), [store]);

  // field-change events (Desk: after the model is set; child rows with (frm, cdt, cdn))
  React.useEffect(() => store.onFieldChange((c: FieldChange) => {
    const key = c.parentfield ?? c.fieldname;
    setFieldErrors((fe) => { if (!(key in fe)) return fe; const next = { ...fe }; delete next[key]; return next; });
    if (c.parentfield) void trigger(c.fieldname, c.doctype, c.name, true);
    else void trigger(c.fieldname);
  }), [store, trigger]);

  // lifecycle: setup once; onload on the first open of a name; refresh on every load
  const setupDone = React.useRef(false);
  const loadedName = React.useRef<string | null>(null);
  React.useEffect(() => {
    void (async () => {
      if (!setupDone.current) { setupDone.current = true; await trigger("setup"); }
      if (loadedName.current !== doc.name) { loadedName.current = doc.name; await trigger("onload"); }
      frmRef.current!.clearCustomButtons(); // form.js:724, before the scripts' refresh adds them again
      await trigger("refresh");
    })();
  }, [doc.name, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- layout, visibility, collapse ----
  const fieldFilterRef = React.useRef(props.fieldFilter);
  fieldFilterRef.current = props.fieldFilter;
  const hasFieldFilter = !!props.fieldFilter;
  const layout = React.useMemo(
    () => buildLayout(meta, { isNew: !!doc.__islocal, fieldFilter: hasFieldFilter ? (df) => fieldFilterRef.current?.(df) ?? true : undefined }),
    [meta, doc.__islocal, hasFieldFilter],
  );
  const sectionEdit = !!props.sectionEdit && !doc.__islocal;
  // editScope "record": the same open sections, opened and closed all at once (one Edit, one Cancel).
  const recordScope = sectionEdit && props.editScope === "record";
  const sectionOf = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const tab of layout.tabs) for (const sec of tab.sections) for (const f of sectionFields(sec)) m.set(f.fieldname, sec.key);
    return m;
  }, [layout]);
  const ownStatus = (df: FrappeDocField) => {
    const e = eff.get(df.fieldname) ?? df;
    if (df.fieldname === "__newname") return doc.__islocal && permissions ? "Write" : "None"; // no permissions: nothing to name (P2-1)
    return statusOf(e, doc);
  };
  const fieldStatus = (df: FrappeDocField): FieldDisplayStatus => {
    const st = ownStatus(df);
    return st === "Write" && sectionEdit && !isSectionOpen(sectionOf.get(df.fieldname) ?? "") ? "Read" : st;
  };
  const sectionEditable = (sec: LayoutSection) => sectionEdit && sectionFields(sec).some((f) => ownStatus(f) === "Write");
  // Opening a section (or the whole record) does not count as a change: the form is "not saved" only once a value
  // changes (no Not saved tag, onDirtyChange or leave guard before that).
  const openSection = (key: string) => {
    setOpenSections((o) => new Set(o).add(key));
    setCollapsed((c) => ({ ...c, [key]: false }));
  };
  const putBackSaved = () => { store.replace(savedRef.current); setVersion((v) => v + 1); };
  const cancelSection = (sec: LayoutSection) => {
    const rest = new Set(openSections);
    rest.delete(sec.key);
    setOpenSections(rest);
    const saved = savedRef.current;
    if (!rest.size) { putBackSaved(); return; }
    store.setValues(Object.fromEntries(sectionFields(sec).map((f) => [f.fieldname, saved[f.fieldname]])));
    // Nothing left that differs from the saved copy (the other open sections untouched): the form is clean again.
    if (store.isDirty() && sameAsSaved(store.getDoc(), saved)) putBackSaved();
  };
  const editableSections = () => layout.tabs.flatMap((tab) => tab.sections).filter(sectionEditable);
  // A section counts as open only while it can still be edited (a workflow step or a refresh may take the right away);
  // the record is being edited while any of its sections is.
  const openKeys: ReadonlySet<string> = sectionEdit && openSections.size
    ? new Set(editableSections().filter((sec) => openSections.has(sec.key)).map((sec) => sec.key)) : new Set();
  const recordEditing = recordScope && openKeys.size > 0;
  function isSectionOpen(key: string) { return recordEditing || openKeys.has(key); }
  const openRecord = () => setOpenSections(new Set(editableSections().map((sec) => sec.key)));
  // The record's one Cancel: every section closes and the saved copy comes back.
  const cancelRecord = () => {
    setOpenSections(new Set());
    putBackSaved();
    setError(null);
    setFieldErrors({});
  };
  const breakHidden = (df?: FrappeDocField) => !!df && (!!eff.get(df.fieldname)?.hidden || !!eff.get(df.fieldname)?.hidden_due_to_dependency);
  const sectionVisible = (sec: LayoutSection) => !breakHidden(sec.df) && sectionFields(sec).some((f) => fieldStatus(f) !== "None");
  const tabVisible = (tab: LayoutTab) => {
    if (breakHidden(tab.df)) return false;
    if (tab.df && permissions?.can && !permissions.can("read", Number(tab.df.permlevel) || 0)) return false;
    return tab.sections.some(sectionVisible);
  };
  const visibleTabs = layout.tabs.filter(tabVisible);
  const extraTabs = (props.extraTabs ?? []).map((x) => ({ ...x, tabKey: `extra:${x.key}` }));
  const shownTab = props.activeTab ?? activeTab;
  const activeExtra = extraTabs.find((x) => x.tabKey === shownTab);
  const currentTab = activeExtra ? undefined : visibleTabs.find((tb) => tb.key === shownTab) ?? visibleTabs[0];
  const tabCount = visibleTabs.length + extraTabs.length;

  React.useEffect(() => {
    const next: Record<string, boolean> = {};
    const d = store.getDoc();
    const effNow = resolveFields(meta.fields ?? [], d, d, evaluator, overrides[meta.name]);
    for (const tab of layout.tabs) for (const sec of tab.sections) {
      if (!sec.df) continue;
      const c = sectionCollapsed(sec.df, sectionFields(sec).map((f) => effNow.get(f.fieldname) ?? f), d, evaluator);
      if (c != null) next[sec.key] = c;
    }
    setCollapsed(next);
  }, [layout, version, doc.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const locate = (fieldname: string) => {
    for (const tab of layout.tabs) for (const sec of tab.sections) if (sectionFields(sec).some((f) => f.fieldname === fieldname)) return { tab: tab.key, section: sec.key };
    return null;
  };
  const scrollToField = (fieldname: string) => {
    const at = locate(fieldname);
    if (!at) return;
    setActiveTab(at.tab);
    setCollapsed((c) => ({ ...c, [at.section]: false }));
    // A field to fix in a section that reads opens it.
    if (latestProps.current.sectionEdit) setOpenSections((o) => (o.has(at.section) ? o : new Set(o).add(at.section)));
  };

  // ---- table controllers ----
  const tableController = (table: FrappeDocField): TableController => {
    const child = String(table.options ?? "");
    const tf = table.fieldname;
    return {
      rows: (Array.isArray(doc[tf]) ? doc[tf] : []) as FrappeDoc[],
      add: (index, values) => {
        const row = store.addRow(tf, { index, values, unedited: true });
        void trigger(`${tf}_add`, child, row.name);
        return row;
      },
      duplicate: (index) => { const row = store.duplicateRow(tf, index); void trigger(`${tf}_add`, child, row.name); return row; },
      remove: async (indexes) => {
        const rows = store.getRows(tf);
        const ok: number[] = [];
        for (const i of indexes) { const r = rows[i]; if (r && (await trigger(`before_${tf}_remove`, child, r.name))) ok.push(i); }
        const removed = store.deleteRows(tf, ok);
        for (const r of removed) await trigger(`${tf}_remove`, child, r.name);
        if (indexes.length > 1) await trigger(`${tf}_delete`, child);
      },
      move: (from, to) => { store.moveRow(tf, from, to); const r = store.getRows(tf)[to]; void trigger(`${tf}_move`, child, r?.name); },
      setCell: (rowName, fieldname, value) => store.setValue(fieldname, value, { parentfield: tf, name: rowName }, { record: true }),
      fieldsFor: (row) => resolveFields(childFields(child), row, doc, evaluator, overrides[child]),
      statusFor: (df, row) => statusOf(df, row, doc, true),
      cellProps: (df, row) => linkProps(df, child, { parentfield: tf, name: row.name }, tf),
      onRowFormOpen: (row) => { void trigger("form_render", child, row.name); void trigger(`${tf}_on_form_rendered`, child, row.name); },
    };
  };

  function linkProps(df: EffectiveField, doctype: string, target?: { parentfield: string; name: string }, table?: string): Partial<FrappeFieldProps> {
    if (df.fieldtype === "Button") return { onButtonClick: (f) => void trigger(f, target ? doctype : undefined, target?.name) };
    if (df.fieldtype !== "Link" && df.fieldtype !== "Dynamic Link" && df.fieldtype !== "Table MultiSelect") return {};
    const entries = fetchMaps.get(doctype)?.get(df.fieldname) ?? [];
    return {
      query: queries.current[`${table ?? ""}.${df.fieldname}`],
      fetchFields: entries.map((e) => e.source),
      formFields: fieldsByName,
      onLinkValidated: entries.length
        ? (result: ValidateLinkResult | null) => {
          const updates = fetchUpdates(entries, df.fieldname, result);
          delete updates[df.fieldname];
          if (Object.keys(updates).length) store.setValues(updates, target);
        }
        : undefined,
    };
  }

  // ---- actions ----
  const recWorkflow = React.useMemo(() => workflowFromMeta(meta as never), [meta]);
  // P2-1 (rule 9): no `permissions` → no right. Before dev.31 this assumed every right (submit / cancel / amend when
  // submittable). Rights given as `levels` without `can()` are read from level 0.
  const can = (p: PermType) => (permissions?.can ? permissions.can(p, 0) : !!permissions?.levels?.[0]?.[p]);
  const permissionsUnknown = !permissions || permissions.known === false;
  const actionsFor = (d: FrappeDoc) => formActions({
    docstatus: (d.docstatus ?? 0) as 0 | 1 | 2, isNew: !!d.__islocal, dirty: !!d.__unsaved || !!props.alsoSave?.dirty, isSubmittable: !!meta.is_submittable,
    perms: { write: can("write"), create: can("create"), submit: can("submit"), cancel: can("cancel"), amend: can("amend") },
    hasWorkflow: !!(permissions?.workflow ?? recWorkflow),
    canCancelWithWorkflow: props.canCancelWithWorkflow ?? (recWorkflow ? canCancelDocument(recWorkflow) : undefined),
    saveDisabled: props.saveDisabled,
    workflowActionsShown: props.workflowActionsShown, alreadyAmended: props.alreadyAmended,
  });
  const actions = actionsFor(doc);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice((n) => (n === msg ? null : n)), 4000); };

  /** `frappe.ui.form.check_mandatory`: false → the Missing Fields dialog, and the first missing field's tab opens. */
  const mandatoryOk = (): boolean => {
    const check = checkMandatory(bundle, store.getDoc(), { ...evaluator, overrides, translate: (l) => s.translate(bundle, l) });
    if (check.ok) return true;
    setMissing(check);
    if (check.first) scrollToField(check.first.parentfield ?? check.first.fieldname);
    return false;
  };

  const save = async (action: SaveAction, confirmed = false): Promise<boolean> => {
    if (savingRef.current) return false;
    const also = latestProps.current.alsoSave;
    if (action === "Save" && !store.isDirty() && !also?.dirty) { flash(t("formNoChanges")); return false; }
    if (action === "Submit" && !confirmed) { setConfirm("Submit"); return false; }
    savingRef.current = true;
    setSaving(action);
    setError(null);
    try {
      if (action === "Submit" && !(await trigger("before_submit"))) return false;
      if (action !== "Update") {
        if (!(await trigger("validate"))) return false;
        if (!(await trigger("before_save"))) return false;
      }
      if (!mandatoryOk()) return false;
      const current = store.getDoc();
      setFieldErrors({});
      // Run 1 C-71: Desk freezes the page while saving (save.js:4-111). The fields are inert while `saving`; a value
      // still written during the request (a late Link fetch, a host's setValue) is re-applied on top of the server's
      // document instead of being silently replaced by it.
      const late = new Map<string, unknown>();
      const stopLate = store.onFieldChange((c) => { if (!c.parentfield && !c.unchanged) late.set(c.fieldname, c.value); });
      let saved: FrappeDoc;
      try {
        saved = action === "Save" && !store.isDirty() ? current : await onSave(current, action);
      } finally { stopLate(); }
      store.replace(saved);
      for (const [f, v] of late) store.setValue(f, v);
      savedRef.current = saved;
      setVersion((v) => v + 1);
      setOpenSections(new Set());
      if (also?.dirty) await also.save();
      flash(t(action === "Submit" ? "formSubmitted" : "formSaved"));
      await trigger("after_save");
      latestProps.current.onSaved?.(saved, action);
      if (action === "Submit") await trigger("on_submit");
      return true;
    } catch (e) {
      setError(e);
      const fe = fieldErrorsFromFrappeError(e, bundle, (l) => s.translate(bundle, l));
      setFieldErrors(fe);
      const first = Object.keys(fe)[0];
      if (first) scrollToField(first);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  };

  const cancelDoc = async () => {
    if (savingRef.current || !onCancelDoc) return;
    savingRef.current = true;
    setSaving("Cancel");
    setError(null);
    try {
      if (!(await trigger("before_cancel"))) return;
      const saved = await onCancelDoc(store.getDoc());
      store.replace(saved);
      setVersion((v) => v + 1);
      latestProps.current.onSaved?.(saved, "Cancel");
      await trigger("after_cancel");
    } catch (e) {
      setError(e);
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  };

  const reload = async () => {
    const fresh = await latestProps.current.onReload?.();
    if (!fresh) return;
    store.replace(fresh);
    setVersion((v) => v + 1);
    setError(null);
  };
  const startCancel = async () => {
    const pre = latestProps.current.getSubmittedLinkedDocs;
    if (!pre) { setConfirm("Cancel"); return; }
    setSaving("Cancel");
    setError(null);
    try {
      const r = await pre(store.getDoc());
      if (r.count > 0 && r.docs.length) {
        let ok: boolean | undefined;
        try { ok = await latestProps.current.canCancelAllLinked?.(r.docs); } catch { ok = undefined; }
        setLinkedCancellable(ok);
        setLinked(r.docs);
      } else setConfirm("Cancel");
    } catch (e) {
      setError(e);
    } finally {
      setSaving(null);
    }
  };
  const cancelAll = async (docs: LinkedDoc[]) => {
    setLinked(null);
    setSaving("Cancel");
    try {
      await latestProps.current.cancelAllLinkedDocs?.(docs);
      await reload();
    } catch (e) {
      setError(e);
      setSaving(null);
      return;
    }
    setSaving(null);
    await cancelDoc();
  };
  const amend = () => {
    const p = latestProps.current;
    if (p.onAmend) { p.onAmend(store.getDoc()); return; }
    const copy = amendDoc(bundle, store.getDoc(), { user: p.defaults?.user, defaults: p.defaults });
    store.replace(copy);
    setVersion((v) => v + 1);
    p.onAmended?.(copy);
  };

  const runPrimary = (a: FormAction) => {
    if (a === "Save" || a === "Update" || a === "Submit") void save(a);
    else if (a === "Amend") amend();
  };
  fns.current = {
    // frm.save checks the right first (form.js validate_form_action): Save → write (create for a new doc), Submit / Update
    // → submit; nothing without permissions or with saveDisabled
    save: async (a) => {
      const d = store.getDoc();
      const action: SaveAction = a ?? ((d.docstatus ?? 0) === 1 ? "Update" : "Save");
      const allowed = action === "Save" ? !props.saveDisabled && (d.__islocal ? can("create") || can("write") : can("write")) : can("submit");
      // Submit asks first, as Desk's frm.save("Submit") → savesubmit → frappe.confirm (resolves false; Yes submits)
      return allowed ? save(action, action !== "Submit") : false;
    },
    checkMandatory: mandatoryOk,
    flash: (key) => flash(t(key)),
  };

  // ---- keyboard (desk.js trigger_primary_action; undo_manager shortcuts), document-level while topmost ----
  const keyHandler = React.useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "s" && !e.shiftKey) {
      e.preventDefault();
      if (missing || confirm || linked || savingRef.current) return; // a dialog of this form is open / already working
      // blur first: a pending text edit is written (and may turn Submit into Save) before the action is chosen
      const active = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
      if (active && active !== document.body) active.blur?.();
      const a = actionsFor(store.getDoc());
      if (!a.primary || a.primaryDisabled || a.primary === "Cancel" || (viewOnly && (a.primary === "Save" || a.primary === "Update"))) return;
      if (sectionEdit && a.primary === "Save" && !store.isDirty()) return;
      // Open for editing, nothing changed: the shown Save is disabled — no Submit behind it either.
      if (sectionEdit && openKeys.size > 0 && !store.isDirty() && !latestProps.current.alsoSave?.dirty) return;
      if (a.primary === "Amend" && !props.onAmend && !canAmend(meta)) return;
      runPrimary(a.primary);
      return;
    }
    if (key === "z" || key === "y") {
      // ignore_inputs is false for these (keyboard.js:47): the browser's own text undo runs inside an input
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName))) return;
      e.preventDefault();
      if (key === "y" || e.shiftKey) frmRef.current!.redo(); else frmRef.current!.undo();
    }
  };
  React.useEffect(() => {
    if (props.hotkeys === false || typeof document === "undefined") return;
    const token = {};
    hotkeyStack.push(token);
    const onKey = (e: KeyboardEvent) => { if (hotkeyStack[hotkeyStack.length - 1] === token) keyHandler.current(e); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = hotkeyStack.indexOf(token);
      if (i >= 0) hotkeyStack.splice(i, 1);
    };
  }, [props.hotkeys]);

  // ---- rendering ----
  const titleField = meta.title_field ? doc[meta.title_field] : undefined;
  // Run 1 C-67: Desk's is_title_editable / can_rename (toolbar.js:82-104)
  const titleDf = meta.title_field ? fieldsByName.get(meta.title_field) : undefined;
  const writeRight = !permissionsUnknown && can("write") && !doc.__islocal && !!props.onRenameTitle;
  const nameRenamable = writeRight && !!meta.allow_rename;
  const titleEditable = writeRight && !!titleDf && titleDf.fieldtype === "Data" && !titleDf.read_only && !titleDf.set_only_once
    && !(String(meta.autoname ?? "") === `field:${meta.title_field}` && !meta.allow_rename);
  const docLabel = s.translate(bundle, meta.name);
  // toolbar.js:44-67: the title field's HTML is stripped (a Text Editor title shows as text)
  const title = props.title ?? (doc.__islocal ? interpolate(t("formNewDoc"), { doctype: docLabel }) : htmlToText(String(titleField || "")) || doc.name);
  const ind = resolveIndicator({
    doc: unsaved && !doc.__unsaved ? { ...doc, __unsaved: 1 } : doc, isSubmittable: !!meta.is_submittable, hasField: (f) => fieldsByName.has(f),
    states: meta.states as { title: string; color?: string }[] | undefined,
    workflow: recWorkflow ? {
      stateField: recWorkflow.workflow_state_field,
      styleOf: (st) => recWorkflow.states.find((x) => x.state === st)?.style,
      overrideStatus: !!recWorkflow.override_status,
      avoidStatusOverride: (st) => !!recWorkflow.states.find((x) => x.state === st)?.avoid_status_override,
    } : null,
  });
  // header image (Desk: the sidebar image from meta.image_field, form_sidebar.js) — none without image_field; P36b
  // attachimage: Desk's "Change" → Upload / Remove (user_image.js) through FrappeFormImage
  const imageField = meta.image_field ? String(meta.image_field) : undefined;
  // "See on Website" (form.js:1149-1158): a saved website generator whose server `__onload` says it is published. Without
  // `__onload` (a doc not read through getdoc): `has_web_view` + the DocType's `is_published_field` + a route.
  const onload = (doc.__onload ?? {}) as { is_website_generator?: unknown; published?: unknown };
  const route = typeof doc.route === "string" ? doc.route.replace(/^\/+/, "") : "";
  const published = onload.is_website_generator
    ? !!onload.published
    : !!meta.has_web_view && !!meta.is_published_field && !!Number(doc[String(meta.is_published_field)] ?? 0);
  const webRoute = !doc.__islocal && route && published ? `/${route}` : null;
  const BUILTIN: Record<string, string> = { notSaved: t("formNotSaved"), draft: t("formDraft"), cancelled: t("formCancelled"), submitted: t("formSubmitted") };
  const TONE_VARIANT = { success: "success", warning: "warning", danger: "destructive", info: "info", brand: "brand", neutral: "outline" } as const;
  // Run 1 D-64: Desk's colour name paints the header pill with the themed palette (distinct light-blue / blue / cyan …)
  const indColour = ind?.colour && DESK_INDICATOR_COLOURS.includes(ind.colour.toLowerCase()) ? ind.colour.toLowerCase() : undefined;
  const indicator = ind ? { text: (ind.builtin && BUILTIN[ind.builtin]) || s.translate(bundle, ind.label), variant: TONE_VARIANT[ind.tone], style: indColour ? statusColorStyles(indColour)?.pill : undefined, colour: indColour } : null;
  const actionLabel = (a: FormAction) => t(a === "Save" ? "formSave" : a === "Submit" ? "formSubmit" : a === "Update" ? "formUpdate" : a === "Cancel" ? "formCancelDoc" : "formAmend");

  const renderField = (df: FrappeDocField) => {
    const e = df.fieldname === "__newname" ? df : eff.get(df.fieldname) ?? df;
    const st = fieldStatus(df);
    if (st === "None") return null;
    const custom = props.renderField?.(e, { value: doc[df.fieldname], doc, setValue: (f, v) => store.setValue(f, v, undefined, { record: true }), status: st });
    if (custom !== undefined) return <React.Fragment key={df.fieldname}>{custom}</React.Fragment>;
    const isTable = TABLE_TYPES.has(df.fieldtype);
    if (sectionEdit && st === "Read" && !isTable) {
      return (
        <ReadRow key={df.fieldname} df={e} label={s.translate(bundle, e.label || e.fieldname)} notProvided={t("formNotProvided")}
          empty={e.fieldtype !== "Check" && isEmptyValue(doc[df.fieldname])}>
          <FrappeField df={e} value={doc[df.fieldname]} onChange={() => undefined} doc={doc} bundle={bundle} status="Read" onlyInput {...linkProps(e, meta.name)} />
        </ReadRow>
      );
    }
    return (
      <FrappeField
        key={df.fieldname}
        df={e}
        value={doc[df.fieldname]}
        onChange={(v) => store.setValue(df.fieldname, v, undefined, { record: true })}
        doc={doc}
        bundle={bundle}
        status={st}
        error={fieldErrors[df.fieldname]}
        table={isTable ? tableController(df) : undefined}
        {...linkProps(e, meta.name)}
      />
    );
  };

  /** A read section's fields: consecutive ReadRows form one `<dl>` (two to a line with `pair`); a table or a host's own
   *  field stays outside it. */
  const readList = (fields: FrappeDocField[], pair: boolean) => {
    const out: React.ReactNode[] = [];
    let run: React.ReactElement[] = [];
    const flush = () => {
      if (!run.length) return;
      out.push(
        <dl key={`dl:${run[0]!.key}`} className={cn("[&>[data-read-row]:last-child]:border-b-0", pair && "grid grid-cols-1 gap-x-6 sm:grid-cols-2")} data-read-list>{run}</dl>,
      );
      run = [];
    };
    for (const f of fields) {
      const node = renderField(f);
      if (node == null) continue;
      if (React.isValidElement(node) && node.type === ReadRow) run.push(node);
      else { flush(); out.push(node); }
    }
    flush();
    return out;
  };

  // A section card needs a title. A labelled section uses its label; the FIRST unlabelled one in the tab is "Details" (the
  // form's top); any LATER unlabelled one is named after its own visible fields (up to two, "A · B …"), so two cards never
  // both read "Details" (e.g. a family's own block after the form's first section). Nothing is hidden or renamed in meta.
  const untitledSectionTitle = (sec: LayoutSection) => {
    const untitled = (currentTab?.sections ?? []).filter((x) => sectionVisible(x) && !x.df?.label);
    if (untitled[0]?.key === sec.key) return t("formDetails");
    const names = sectionFields(sec).filter((f) => fieldStatus(f) !== "None").map((f) => s.translate(bundle, f.label || f.fieldname));
    if (!names.length) return t("formDetails");
    return names.slice(0, 2).join(" · ") + (names.length > 2 ? " …" : "");
  };
  const renderSection = (sec: LayoutSection) => {
    if (!sectionVisible(sec)) return null;
    const label = sec.df?.label ? s.translate(bundle, sec.df.label) : undefined;
    const collapsible = !!sec.df?.collapsible;
    const isCollapsed = collapsible && !!collapsed[sec.key];
    const regionId = `sf-sec-${sec.key}`;
    const isOpen = isSectionOpen(sec.key);
    const tools = !recordScope && sectionEditable(sec) ? (isOpen ? (
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => cancelSection(sec)} data-section-cancel={sec.key}>
        {t("formSectionCancel")}
      </Button>
    ) : (
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => openSection(sec.key)} data-section-edit={sec.key}
        aria-label={`${t("formSectionEdit")} · ${label ?? untitledSectionTitle(sec)}`}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />{t("formSectionEdit")}
      </Button>
    )) : null;
    const body = sectionEdit && !isOpen ? (
      // Read: the fields as rows (a description list). Desk's columns stay columns, side by side from `sm` up, each read
      // top to bottom; a one-column section lays its rows two to a line, in order.
      sec.columns.length > 1 ? (
        <div id={regionId} className="grid grid-cols-1 gap-x-6 sm:grid-cols-[repeat(var(--sf-cols),minmax(0,1fr))]" style={{ "--sf-cols": sec.columns.length } as React.CSSProperties} data-read-grid>
          {sec.columns.map((c) => <div key={c.key} className="min-w-0" data-read-column={c.key}>{readList(c.fields, false)}</div>)}
        </div>
      ) : (
        <div id={regionId} data-read-grid>{readList(sec.columns[0]?.fields ?? [], true)}</div>
      )
    ) : (
      // columns side by side from `sm` up, stacked on a phone (Desk's `.form-column.col-sm-*`)
      <div id={regionId} className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-[repeat(var(--sf-cols),minmax(0,1fr))]" style={{ "--sf-cols": Math.max(1, sec.columns.length) } as React.CSSProperties}>
        {sec.columns.map((c) => <div key={c.key} className="min-w-0 space-y-4">{sectionEdit ? readList(c.fields, false) : c.fields.map(renderField)}</div>)}
      </div>
    );
    if (sectionEdit) {
      // A record page's section: a card with its title and Edit / Cancel (the CRM reference's editable card).
      const title = label ?? untitledSectionTitle(sec);
      return (
        <section key={sec.key} className="overflow-hidden rounded-xl border border-border bg-card/60" data-section={sec.key} data-section-open={isOpen ? 1 : undefined} aria-label={title}>
          <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            {collapsible ? (
              <button type="button" className="group flex min-w-0 flex-1 items-center gap-2 rounded-md text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={!isCollapsed} aria-controls={regionId}
                onClick={() => setCollapsed((c) => ({ ...c, [sec.key]: !isCollapsed }))}>
                <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground", isCollapsed && (isRTL ? "rotate-90" : "-rotate-90"))} aria-hidden />
                <h3 className="truncate text-sm font-semibold">{title}</h3>
              </button>
            ) : (
              <>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden><LayoutList className="h-4 w-4" /></span>
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h3>
              </>
            )}
            {tools && <span className="shrink-0">{tools}</span>}
          </header>
          {!isCollapsed && (
            <div className="space-y-3 p-4">
              {isOpen && sec.df?.description && <p className="text-xs text-muted-foreground">{s.translate(bundle, String(sec.df.description))}</p>}
              {body}
            </div>
          )}
        </section>
      );
    }
    return (
      <section key={sec.key} className="space-y-3" data-section={sec.key} data-section-open={isOpen ? 1 : undefined} aria-label={label}>
        {(label || tools) && <div className="flex min-h-7 items-center justify-between gap-2">{label && (collapsible ? (
          <button type="button" className="group flex w-full items-center gap-2 rounded-md text-start text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={!isCollapsed} aria-controls={regionId}
            onClick={() => setCollapsed((c) => ({ ...c, [sec.key]: !isCollapsed }))}>
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground", isCollapsed && (isRTL ? "rotate-90" : "-rotate-90"))} aria-hidden />
            {label}
          </button>
        ) : <h3 className="text-sm font-semibold">{label}</h3>)}{tools && <span className="ms-auto shrink-0">{tools}</span>}</div>}
        {sec.df?.description && !isCollapsed && <p className="text-xs text-muted-foreground">{s.translate(bundle, String(sec.df.description))}</p>}
        {!isCollapsed && body}
      </section>
    );
  };

  const tabLabel = (tab: LayoutTab) => (tab.details || !tab.df ? t("formDetails") : s.translate(bundle, tab.df.label || tab.df.fieldname));
  const tabsSignature = visibleTabs.map((tab) => `${tab.key}\u0001${tabLabel(tab)}`).join("\u0002");
  React.useEffect(() => {
    props.onTabsChange?.(visibleTabs.map((tab) => ({ key: tab.key, label: tabLabel(tab) })));
  }, [tabsSignature]); // eslint-disable-line react-hooks/exhaustive-deps
  const lineText = (l: MandatoryLine) => missingLineText(l, t as (key: string) => string);

  // Open for editing but nothing changed yet: Save (or Update) shows, disabled until a value changes — also where a
  // clean form would show no Save (a workflow's actions) or Submit.
  const heldPrimary = sectionEdit && openKeys.size > 0 && !unsaved ? actionsFor({ ...doc, __unsaved: 1 }).primary : null;
  const held = heldPrimary === "Save" || heldPrimary === "Update" ? heldPrimary : null;
  const primary = held ?? actions.primary;
  // A held Save stays clickable (not disabled): pressing it blurs the field being typed in, which commits its value, so by
  // the click a change is in the store — then it saves (a disabled button would swallow that first click). With nothing
  // changed, Save just closes the open sections (no request). "Not saved" still shows only after a real change.
  const runHeld = (a: FormAction) => {
    if (store.isDirty()) { runPrimary(a); return; }
    setOpenSections(new Set());
    setError(null);
    setFieldErrors({});
  };
  // editScope "record": the record's Edit (in the host's header when it places it, else in the toolbar) and its Cancel.
  const editAction = recordScope && !recordEditing && editableSections().length > 0 ? (
    <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={openRecord} data-record-edit>
      <Pencil className="h-3.5 w-3.5" aria-hidden />{t("rpEdit")}
    </Button>
  ) : undefined;
  const headerPlacesEdit = typeof props.header === "function";
  const header = typeof props.header === "function" ? props.header({ editAction, editing: recordEditing }) : props.header;

  const liveCtx = (): FrappeFormMenuContext => ({
    frm: frmRef.current!, doc, dirty: unsaved, reload: props.onReload ? () => reload() : undefined, showTab: (key) => setActiveTab(key),
    tabs: [...visibleTabs.map((tb) => tb.key), ...extraTabs.map((x) => x.tabKey)],
  });
  const form = (
    <div className={cn("min-w-0 space-y-5", props.aside ? "lg:col-span-3" : className)} data-doctype={meta.name}>
      {!props.hideToolbar && (
        <div className="flex flex-wrap items-center gap-3">
          {props.header !== undefined ? <div className="min-w-0 flex-1">{props.toolbarStart}</div> : <>
          {imageField !== undefined && (
            <FrappeFormImage bundle={bundle} doc={doc} df={eff.get(imageField) ?? fieldsByName.get(imageField)} canWrite={!permissionsUnknown && can("write")}
              initials={initials(htmlToText(String(titleField || "")) || doc.name)} getDocInfo={() => latestProps.current.docinfo}
              setValue={(v) => store.setValue(imageField, v, undefined, { record: true })} save={() => fns.current.save()} />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{titleEditable || nameRenamable ? (
              // Run 1 C-67 (Desk toolbar.js:82-110): the title opens the title / rename dialog
              <button type="button" onClick={() => setTitleDialog(true)} title={t("titleEditHint")} data-title-edit=""
                className="max-w-full truncate rounded-sm text-start hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{title}</button>
            ) : title}</h2>
            {!doc.__islocal && !!titleField && titleField !== doc.name && meta.autoname !== "hash" && <p className="truncate text-xs text-muted-foreground">{doc.name}</p>}
            {webRoute && (
              <a href={webRoute} target="_blank" rel="noopener noreferrer" data-web-link className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                {t("formSeeOnWebsite")}<ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </div>
          </>}
          {indicator && !(props.stateInHeader && !ind?.builtin) && <Badge variant={indicator.variant} style={indicator.style} data-color={indicator.colour} data-form-indicator>{indicator.text}</Badge>}
          {notice && <span role="status" className="text-xs text-muted-foreground">{notice}</span>}
          {!notice && permissionsUnknown && <span role="status" data-permissions="unknown" className="text-xs text-muted-foreground">{t("formReadOnly")}</span>}
          {props.toolbarExtra}
          {!headerPlacesEdit && editAction}
          {recordEditing && (
            <Button type="button" variant="outline" disabled={!!saving} onClick={cancelRecord} data-record-cancel-edit>{t("rpCancelEdit")}</Button>
          )}
          {customButtons.filter((b) => !b.group).map((b) => (
            <Button key={`btn:${b.label}`} type="button" variant="outline" size="sm" data-custom-button={b.label} onClick={() => void b.handler()}>{s.translate(bundle, b.label)}</Button>
          ))}
          {[...new Set(customButtons.filter((b) => b.group).map((b) => b.group!))].map((g) => (
            <DropdownMenu key={`grp:${g}`}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" data-custom-group={g}>{s.translate(bundle, g)}<ChevronDown className="size-4" aria-hidden /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {customButtons.filter((b) => b.group === g).map((b) => (
                  <DropdownMenuItem key={b.label} onSelect={() => void b.handler()}>{s.translate(bundle, b.label)}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
          {actions.secondary && onCancelDoc && (
            <Button type="button" variant="outline" disabled={!!saving} loading={saving === "Cancel"} onClick={() => void startCancel()}>{actionLabel("Cancel")}</Button>
          )}
          {primary && !(viewOnly && (primary === "Save" || primary === "Update")) && !(sectionEdit && primary === "Save" && !unsaved && !held) && (
            <Button type="button" disabled={!!saving || (!held && actions.primaryDisabled) || (primary === "Amend" && !props.onAmend && !canAmend(meta))}
              title={!held && actions.primaryDisabled ? t("formAlreadyAmended") : undefined} loading={saving === primary}
              data-primary-held={held ? "" : undefined} onClick={() => (held ? runHeld(held) : runPrimary(primary))}>
              {actionLabel(primary)}
            </Button>
          )}
          {typeof props.menu === "function" ? props.menu(liveCtx()) : props.menu}
        </div>
      )}

      {newerOnServer && newerOnServer.name === doc.name && (
        <div role="alert" data-newer-on-server="" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
          <span>{t("feHintTimestamp")}</span>
          <Button type="button" size="sm" variant="outline" onClick={takeNewer}>{t("feReload")}</Button>
        </div>
      )}
      {error != null && (
        <FrappeErrorState error={error} compact
          onRetry={error instanceof FrappeError && error.kind === "timestamp" && props.onReload ? () => void reload() : undefined} />
      )}

      {issues.length + fieldtypeIssues.length > 0 && (
        <div role="note" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          <ul className="list-disc space-y-0.5 ps-4">
            {fieldtypeIssues.map((i) => (
              <li key={`ft.${i.doctype}.${i.fieldname}`} data-fieldtype-issue={i.fieldtype}>
                {interpolate(t("formUnsupportedFieldtype"), { field: `${i.doctype}.${i.fieldname}`, type: i.fieldtype })}
              </li>
            ))}
            {issues.map((i) => (
              <li key={`${i.doctype}.${i.fieldname}.${i.property}.${i.kind}`}>
                {i.kind === "unsupported"
                  ? interpolate(t("formUnsupportedExpression"), { field: `${i.doctype}.${i.fieldname}`, property: i.property, expr: i.expression })
                  : interpolate(t("formInvalidExpression"), { property: i.property, field: `${i.doctype}.${i.fieldname}` })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {header}
      {props.pageTabBar}
      {props.pageTabPanel != null ? <div role="tabpanel" data-page-tab-panel>{props.pageTabPanel}</div> : <>

      {tabCount > 1 && !props.hideTabBar && (
        <Tabs value={activeExtra?.tabKey ?? currentTab?.key} onValueChange={(v) => setActiveTab(v)}>
          <TabsList className={props.tabBar === "record" ? "flex w-full max-w-full overflow-x-auto" : "max-w-full overflow-x-auto"} data-tab-bar={props.tabBar ?? "default"}>
            {visibleTabs.map((tab) => <TabsTrigger key={tab.key} value={tab.key} className={props.tabBar === "record" ? "min-w-0 flex-1" : undefined}>{tabLabel(tab)}</TabsTrigger>)}
            {extraTabs.map((x) => <TabsTrigger key={x.tabKey} value={x.tabKey} data-extra-tab={x.key} className={props.tabBar === "record" ? "min-w-0 flex-1" : undefined}>{x.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}
      {activeExtra && <div className="space-y-8" role="tabpanel" data-extra-tab-panel={activeExtra.key}>{activeExtra.render()}</div>}
      {currentTab && <div className={sectionEdit ? "space-y-5" : "space-y-8"} role={tabCount > 1 ? "tabpanel" : undefined} data-form-fields="" aria-busy={saving ? true : undefined}
        data-saving={saving ? "" : undefined} {...({ inert: saving ? "" : undefined } as Record<string, unknown>)}>{currentTab.sections.map(renderSection)}</div>}
      </>}

      {(titleEditable || nameRenamable) && props.onRenameTitle && (
        <RenameDialog open={titleDialog} onOpenChange={setTitleDialog} name={doc.name} allowNameChange={nameRenamable}
          title={titleEditable ? { value: String(doc[meta.title_field!] ?? ""), label: s.translate(bundle, fieldsByName.get(meta.title_field!)?.label || meta.title_field!) } : undefined}
          onRename={async ({ newName, merge, title: nextTitle }) => {
            await props.onRenameTitle!({ docname: doc.name, name: nameRenamable ? newName : doc.name, title: nextTitle, merge });
          }} />
      )}
      <Dialog open={!!missing} onOpenChange={(o) => { if (!o) setMissing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("formMissingFields")}</DialogTitle>
            <DialogDescription>{t("formMissingIntro")}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 ps-5 text-sm">{missing?.lines.map((l, i) => <li key={i}>{lineText(l)}</li>)}</ul>
        </DialogContent>
      </Dialog>

      <Dialog open={!!linked} onOpenChange={(o) => { if (!o) setLinked(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("formLinkedTitle")}</DialogTitle>
            <DialogDescription>{interpolate(t("formLinkedIntro"), { name: doc.name })}</DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 list-disc space-y-1 overflow-y-auto ps-5 text-sm">
            {linked?.map((l) => <li key={`${l.doctype}:${l.name}`}>{s.translate(bundle, l.doctype)}: {l.name}</li>)}
          </ul>
          {(linkedCancellable === false || (linkedCancellable === undefined && !!props.cancelAllLinkedDocs)) && (
            <p role="status" data-permissions={linkedCancellable === false ? "denied" : "unknown"} className="text-sm text-muted-foreground">{t("formNoCancelAllPermission")}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setLinked(null)}>{t("formDismiss")}</Button>
            {props.cancelAllLinkedDocs && linkedCancellable === true && <Button type="button" variant="destructive" onClick={() => void cancelAll(linked ?? [])}>{t("formCancelAll")}</Button>}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "Submit" ? interpolate(t("formConfirmSubmit"), { name: doc.name }) : interpolate(t("formConfirmCancel"), { name: doc.name })}</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">{docLabel}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("no")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const c = confirm; setConfirm(null); if (c === "Submit") void save("Submit", true); else void cancelDoc(); }}>{t("yes")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
  return (
    <FrappeAttachHost value={props.attachHost === false ? null : attachHost}>
      {props.aside ? (
        <div className={cn("grid grid-cols-1 items-start gap-5 lg:grid-cols-4", className)} data-form-layout="aside">
          {form}
          {typeof props.aside === "function" ? props.aside(liveCtx()) : props.aside}
        </div>
      ) : form}
    </FrappeAttachHost>
  );
}
