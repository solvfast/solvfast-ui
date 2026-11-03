/**
 * FrappeFormView — a Desk form from a meta bundle and a document, without data fetching (FrappeForm connects it to
 * the foundation hooks). Behaviour from docs `11` (Frappe 15.110):
 *  - layout: tabs / sections / columns / collapsible (§2.1–2.3); empty sections and tabs hidden, the tab bar hidden when
 *    one tab is left; collapsible sections closed by default, `collapsible_depends_on`, forced open by a missing
 *    required field — evaluated at load and after save;
 *  - dependencies re-evaluated after every change (D-23 interpreter); unsupported expressions listed at load;
 *  - display status: the permissions' `displayStatus` (foundation ladder) + the fetch_from lock;
 *  - value pipeline through the docStore; Link validation writes fetch_from targets; dirty → "Not Saved";
 *  - Save / Submit / Update / Cancel / Amend by Desk's action matrix; Save: `validate` → `before_save` →
 *    check_mandatory (Missing Fields dialog, jumps to the first missing field's tab) → `onSave`; a clean Save shows
 *    "No changes in document" without a request; Submit asks "Permanently Submit {name}?" and runs `before_submit`
 *    first; Update skips `validate` / `before_save`; Cancel asks "Permanently Cancel {name}?" and runs
 *    `before_cancel`; double submits are ignored; after a save the server's document replaces the local one, then
 *    `after_save` → `refresh` (→ `on_submit`). Ctrl/⌘+S saves (or updates). Leaving the page while dirty asks first.
 *  - server errors: `FrappeErrorState` (the foundation's single rendering of FrappeError).
 *  - formEvents (D-24) instead of Desk Client Scripts.
 *  - header indicator: `resolveIndicator` (frappe.get_indicator precedence: Not Saved → workflow state with its style
 *    colour → Draft / Cancelled → meta.states → Submitted → status → enabled);
 *  - with a workflow: Cancel only when no transition leads to a cancelled state (`canCancelDocument`), unless given;
 *  - a 417 TimestampMismatchError keeps the user's edits on screen and offers Reload (Desk's refresh banner);
 *  - Cancel pre-flight (`getSubmittedLinkedDocs`): submitted linked documents are listed with "Cancel All"
 *    (`cancelAllLinkedDocs`, then the document is reloaded and cancelled); UNVERIFIED: Desk hides "Cancel All" when the
 *    user cannot cancel every linked document — here the server decides;
 *  - Amend: the app's `onAmend`, else a local copy (`amendDoc`: from_amend copy + `amended_from`), disabled when
 *    `alreadyAmended` (`is_document_amended`).
 * Not implemented here (reported): realtime "modified after you opened it", undo, connections. Workflow action buttons
 * come from A4's record layer (FrappeForm renders them; FrappeFormView takes `workflowActionsShown`).
 */
import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import { Badge } from "../../primitives/badge";
import { Button } from "../../primitives/button";
import { Tabs, TabsList, TabsTrigger } from "../../primitives/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../primitives/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../primitives/alert-dialog";
import { interpolate } from "../../fields/FieldShell";
import type { DocInfo, DocPermissions, FieldDisplayStatus, FrappeDoc, FrappeDocField, MetaBundle, PermType, ValidateLinkResult } from "../contract";
import { FrappeErrorState } from "../feedback/FrappeErrorState";
import { FrappeError } from "../client";
import { resolveIndicator } from "../services/indicator";
import { canCancelDocument, workflowFromMeta } from "../record/workflow";
import { amendDoc, canAmend } from "./model/copy";
import { createDocStore, type DocStore, type FieldChange } from "./model/docStore";
import { analyzeDependencies, resolveFields, sectionCollapsed, type DependsIssue, type EffectiveField, type FieldOverrides } from "./model/depends";
import { buildFetchMap, fetchUpdates, isReadOnlyByFetch, type FetchEntry } from "./model/fetch";
import { buildLayout, sectionFields, type LayoutSection, type LayoutTab } from "./model/layout";
import { checkMandatory, commaAnd, type MandatoryLine, type MandatoryResult } from "./model/mandatory";
import { formActions, type FormAction } from "./model/actions";
import { controlStatus, ladderStatus } from "./model/status";
import type { DefaultsContext } from "./model/defaults";
import { TABLE_TYPES } from "./model/fieldtypes";
import { runEvent, type FormController, type FormEventsConfig, type LinkQuery } from "./events";
import { useFormServices } from "./services";
import { FrappeField, type FrappeFieldProps } from "./FrappeField";
import type { TableController } from "./FrappeChildTable";

/** What the form needs from `usePermissions` (foundation). */
export interface FormPermissions {
  levels?: DocPermissions;
  can?(ptype: PermType, permlevel?: number): boolean;
  displayStatus?(df: FrappeDocField, doc: FrappeDoc, parent?: FrappeDoc, opts?: { gridCell?: boolean; onlyInput?: boolean }): FieldDisplayStatus;
  workflowReadOnly?: boolean;
  workflow?: unknown;
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
  onSaved?: (doc: FrappeDoc, action: SaveAction | "Cancel") => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Defaults for new child rows (session user, user defaults). */
  defaults?: DefaultsContext;
  saveDisabled?: boolean;
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
  /** Ask before leaving the page with unsaved changes (default true). */
  guardUnload?: boolean;
  /** The form's controller (`frm`) for code outside the events. */
  controllerRef?: React.MutableRefObject<FormController | null>;
  className?: string;
}

type Overrides = Record<string, FieldOverrides>;
const asList = (f: string | string[]) => (Array.isArray(f) ? f : [f]);

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
  const seenIssues = React.useRef(new Set<string>(initialIssues.map(issueKey)));
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const [saving, setSaving] = React.useState<FormAction | null>(null);
  const [error, setError] = React.useState<unknown>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [missing, setMissing] = React.useState<MandatoryResult | null>(null);
  const [confirm, setConfirm] = React.useState<"Submit" | "Cancel" | null>(null);
  const [linked, setLinked] = React.useState<LinkedDoc[] | null>(null);
  const [version, setVersion] = React.useState(0);
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

  // ---- an incoming document replaces the local copy (load / reload / external save) ----
  React.useEffect(() => {
    const cur = store.getDoc();
    if (docProp === cur) return;
    if (docProp.name !== cur.name || (docProp.modified !== cur.modified && !store.isDirty())) { store.replace(docProp); setVersion((v) => v + 1); }
  }, [docProp, store]);
  React.useEffect(() => { props.onDirtyChange?.(!!doc.__unsaved); }, [doc.__unsaved]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (props.guardUnload === false || !doc.__unsaved || typeof window === "undefined") return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [doc.__unsaved, props.guardUnload]);

  // ---- effective fields and statuses ----
  const childFields = React.useCallback((childDoctype: string) => bundle.children[childDoctype]?.fields ?? [], [bundle]);
  const eff = React.useMemo(() => resolveFields(meta.fields ?? [], doc, doc, evaluator, overrides[meta.name]), [meta, doc, evaluator, overrides]);
  const fieldsByName = React.useMemo(() => new Map((meta.fields ?? []).map((f) => [f.fieldname, f])), [meta]);
  const statusOf = React.useCallback((df: EffectiveField, row: FrappeDoc, parent?: FrappeDoc, gridCell = false): FieldDisplayStatus => {
    // ladder step 3 (hidden_due_to_dependency → None), applied here too: the foundation reads the flag with `cint`,
    // which turns Desk's boolean `true` into 0 (reported to A1)
    if (df.hidden_due_to_dependency) return "None";
    let st = permissions?.displayStatus
      ? permissions.displayStatus(df, row, parent, gridCell ? { gridCell: true } : undefined)
      : controlStatus(ladderStatus(df, parent && !row.docstatus ? { ...row, docstatus: parent.docstatus } : row, permissions?.levels, { workflowReadOnly: permissions?.workflowReadOnly }), df, row);
    if (st === "Write" && isReadOnlyByFetch(df, row)) st = "Read";
    return st;
  }, [permissions]);

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

  // ---- the frm controller (D-24) ----
  const frmRef = React.useRef<FormController | null>(null);
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
    };
    frmRef.current = frm;
  }
  React.useEffect(() => { if (props.controllerRef) props.controllerRef.current = frmRef.current; }, [props.controllerRef]);

  // field-change events (Desk: after the model is set; child rows with (frm, cdt, cdn))
  React.useEffect(() => store.onFieldChange((c: FieldChange) => {
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
      await trigger("refresh");
    })();
  }, [doc.name, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- layout, visibility, collapse ----
  const layout = React.useMemo(() => buildLayout(meta, { isNew: !!doc.__islocal }), [meta, doc.__islocal]);
  const fieldStatus = (df: FrappeDocField) => {
    const e = eff.get(df.fieldname) ?? df;
    if (df.fieldname === "__newname") return doc.__islocal ? "Write" : "None";
    return statusOf(e, doc);
  };
  const breakHidden = (df?: FrappeDocField) => !!df && (!!eff.get(df.fieldname)?.hidden || !!eff.get(df.fieldname)?.hidden_due_to_dependency);
  const sectionVisible = (sec: LayoutSection) => !breakHidden(sec.df) && sectionFields(sec).some((f) => fieldStatus(f) !== "None");
  const tabVisible = (tab: LayoutTab) => {
    if (breakHidden(tab.df)) return false;
    if (tab.df && permissions?.can && !permissions.can("read", Number(tab.df.permlevel) || 0)) return false;
    return tab.sections.some(sectionVisible);
  };
  const visibleTabs = layout.tabs.filter(tabVisible);
  const currentTab = visibleTabs.find((tb) => tb.key === activeTab) ?? visibleTabs[0];

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
      setCell: (rowName, fieldname, value) => store.setValue(fieldname, value, { parentfield: tf, name: rowName }),
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
  const can = (p: PermType) => (permissions?.can ? permissions.can(p, 0) : p === "submit" || p === "cancel" || p === "amend" ? !!meta.is_submittable : true);
  const actions = formActions({
    docstatus: (doc.docstatus ?? 0) as 0 | 1 | 2, isNew: !!doc.__islocal, dirty: !!doc.__unsaved, isSubmittable: !!meta.is_submittable,
    perms: { write: can("write"), create: can("create"), submit: can("submit"), cancel: can("cancel"), amend: can("amend") },
    hasWorkflow: !!(permissions?.workflow ?? recWorkflow),
    canCancelWithWorkflow: props.canCancelWithWorkflow ?? (recWorkflow ? canCancelDocument(recWorkflow) : undefined),
    saveDisabled: props.saveDisabled,
    workflowActionsShown: props.workflowActionsShown, alreadyAmended: props.alreadyAmended,
  });

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice((n) => (n === msg ? null : n)), 4000); };

  const save = async (action: SaveAction, confirmed = false): Promise<boolean> => {
    if (savingRef.current) return false;
    if (action === "Save" && !store.isDirty()) { flash(t("formNoChanges")); return false; }
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
      const current = store.getDoc();
      const check = checkMandatory(bundle, current, { ...evaluator, overrides, translate: (l) => s.translate(bundle, l) });
      if (!check.ok) {
        setMissing(check);
        if (check.first) scrollToField(check.first.parentfield ?? check.first.fieldname);
        return false;
      }
      const saved = await onSave(current, action);
      store.replace(saved);
      setVersion((v) => v + 1);
      flash(t(action === "Submit" ? "formSubmitted" : "formSaved"));
      await trigger("after_save");
      latestProps.current.onSaved?.(saved, action);
      if (action === "Submit") await trigger("on_submit");
      return true;
    } catch (e) {
      setError(e);
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
      if (r.count > 0 && r.docs.length) setLinked(r.docs); else setConfirm("Cancel");
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
    const copy = amendDoc(bundle, store.getDoc(), { user: p.defaults?.user });
    store.replace(copy);
    setVersion((v) => v + 1);
    p.onAmended?.(copy);
  };

  const runPrimary = (a: FormAction) => {
    if (a === "Save" || a === "Update" || a === "Submit") void save(a);
    else if (a === "Amend") amend();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      const d = store.getDoc();
      if ((d.docstatus ?? 0) === 0 && can("write")) void save("Save");
      else if (d.docstatus === 1 && d.__unsaved && can("submit")) void save("Update");
    }
  };

  // ---- rendering ----
  const titleField = meta.title_field ? doc[meta.title_field] : undefined;
  const docLabel = s.translate(bundle, meta.name);
  const title = props.title ?? (doc.__islocal ? interpolate(t("formNewDoc"), { doctype: docLabel }) : String(titleField || doc.name));
  const ind = resolveIndicator({
    doc, isSubmittable: !!meta.is_submittable, hasField: (f) => fieldsByName.has(f),
    states: meta.states as { title: string; color?: string }[] | undefined,
    workflow: recWorkflow ? {
      stateField: recWorkflow.workflow_state_field,
      styleOf: (st) => recWorkflow.states.find((x) => x.state === st)?.style,
      overrideStatus: !!recWorkflow.override_status,
      avoidStatusOverride: (st) => !!recWorkflow.states.find((x) => x.state === st)?.avoid_status_override,
    } : null,
  });
  const BUILTIN: Record<string, string> = { notSaved: t("formNotSaved"), draft: t("formDraft"), cancelled: t("formCancelled"), submitted: t("formSubmitted") };
  const TONE_VARIANT = { success: "success", warning: "warning", danger: "destructive", info: "info", brand: "brand", neutral: "outline" } as const;
  const indicator = ind ? { text: (ind.builtin && BUILTIN[ind.builtin]) || s.translate(bundle, ind.label), variant: TONE_VARIANT[ind.tone] } : null;
  const actionLabel = (a: FormAction) => t(a === "Save" ? "formSave" : a === "Submit" ? "formSubmit" : a === "Update" ? "formUpdate" : a === "Cancel" ? "formCancelDoc" : "formAmend");

  const renderField = (df: FrappeDocField) => {
    const e = df.fieldname === "__newname" ? df : eff.get(df.fieldname) ?? df;
    const st = fieldStatus(df);
    if (st === "None") return null;
    const isTable = TABLE_TYPES.has(df.fieldtype);
    return (
      <FrappeField
        key={df.fieldname}
        df={e}
        value={doc[df.fieldname]}
        onChange={(v) => store.setValue(df.fieldname, v)}
        doc={doc}
        bundle={bundle}
        status={st}
        table={isTable ? tableController(df) : undefined}
        {...linkProps(e, meta.name)}
      />
    );
  };

  const renderSection = (sec: LayoutSection) => {
    if (!sectionVisible(sec)) return null;
    const label = sec.df?.label ? s.translate(bundle, sec.df.label) : undefined;
    const collapsible = !!sec.df?.collapsible;
    const isCollapsed = collapsible && !!collapsed[sec.key];
    const regionId = `sf-sec-${sec.key}`;
    const body = (
      <div id={regionId} className="grid gap-x-6 gap-y-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, sec.columns.length)}, minmax(0, 1fr))` }}>
        {sec.columns.map((c) => <div key={c.key} className="min-w-0 space-y-4">{c.fields.map(renderField)}</div>)}
      </div>
    );
    return (
      <section key={sec.key} className="space-y-3" data-section={sec.key} aria-label={label}>
        {label && (collapsible ? (
          <button type="button" className="flex w-full items-center gap-2 text-start text-sm font-semibold" aria-expanded={!isCollapsed} aria-controls={regionId}
            onClick={() => setCollapsed((c) => ({ ...c, [sec.key]: !isCollapsed }))}>
            <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isCollapsed && (isRTL ? "rotate-90" : "-rotate-90"))} aria-hidden />
            {label}
          </button>
        ) : <h3 className="text-sm font-semibold">{label}</h3>)}
        {sec.df?.description && !isCollapsed && <p className="text-xs text-muted-foreground">{s.translate(bundle, String(sec.df.description))}</p>}
        {!isCollapsed && body}
      </section>
    );
  };

  const tabLabel = (tab: LayoutTab) => (tab.details || !tab.df ? t("formDetails") : s.translate(bundle, tab.df.label || tab.df.fieldname));
  const lineText = (l: MandatoryLine) => {
    switch (l.kind) {
      case "field": return interpolate(t("formFieldRequired"), { label: l.label });
      case "every": return interpolate(t("formRowsEvery"), { table: l.table, label: l.label });
      case "rows": return interpolate(t(l.single ? "formRowsOne" : "formRowsList"), { table: l.table, label: l.label, rows: commaAnd(l.ranges, t("formAnd")) });
      case "count": return interpolate(t("formRowsCount"), { table: l.table, label: l.label, n: l.count });
    }
  };

  return (
    <div className={cn("min-w-0 space-y-5", className)} onKeyDown={onKeyDown} data-doctype={meta.name}>
      {!props.hideToolbar && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">{title}</h2>
            {!doc.__islocal && !!titleField && titleField !== doc.name && meta.autoname !== "hash" && <p className="truncate text-xs text-muted-foreground">{doc.name}</p>}
          </div>
          {indicator && <Badge variant={indicator.variant}>{indicator.text}</Badge>}
          {notice && <span role="status" className="text-xs text-muted-foreground">{notice}</span>}
          {props.toolbarExtra}
          {actions.secondary && onCancelDoc && (
            <Button type="button" variant="outline" disabled={!!saving} loading={saving === "Cancel"} onClick={() => void startCancel()}>{actionLabel("Cancel")}</Button>
          )}
          {actions.primary && (
            <Button type="button" disabled={!!saving || actions.primaryDisabled || (actions.primary === "Amend" && !props.onAmend && !canAmend(meta))}
              title={actions.primaryDisabled ? t("formAlreadyAmended") : undefined} loading={saving === actions.primary}
              onClick={() => runPrimary(actions.primary!)}>
              {actionLabel(actions.primary)}
            </Button>
          )}
        </div>
      )}

      {error != null && (
        <FrappeErrorState error={error} compact
          onRetry={error instanceof FrappeError && error.kind === "timestamp" && props.onReload ? () => void reload() : undefined} />
      )}

      {issues.length > 0 && (
        <div role="note" className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground">
          <ul className="list-disc space-y-0.5 ps-4">
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

      {visibleTabs.length > 1 && (
        <Tabs value={currentTab?.key} onValueChange={(v) => setActiveTab(v)}>
          <TabsList className="max-w-full overflow-x-auto">
            {visibleTabs.map((tab) => <TabsTrigger key={tab.key} value={tab.key}>{tabLabel(tab)}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}
      {currentTab && <div className="space-y-8" role={visibleTabs.length > 1 ? "tabpanel" : undefined}>{currentTab.sections.map(renderSection)}</div>}

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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setLinked(null)}>{t("formDismiss")}</Button>
            {props.cancelAllLinkedDocs && <Button type="button" variant="destructive" onClick={() => void cancelAll(linked ?? [])}>{t("formCancelAll")}</Button>}
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
}
