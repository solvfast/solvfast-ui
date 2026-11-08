/**
 * The list's Actions (docs 13 §3) — the items of the header-mode Actions menu (`useFrappeBulkActions`, the default) or the
 * content of the opt-in bar (`FrappeBulkActions` in `renderBulkActions`) — in Desk's order
 * (`list_view.js:2088-2128`, workflow last `:163-168`): Edit, Export, Assign To, Clear Assignment, Apply Assignment Rule,
 * Add Tags, Print, Submit, Cancel, Delete, Workflow. Destructive ones confirm; the outcome is announced through
 * `onMessage`; the selection and the list then follow Desk per action (`selectionAfterBulk`). Gated by `bulkMenu` (permissions + workflow rules). `onBusy` lets the list pause
 * realtime refresh (Desk's `disable_list_update`).
 *
 * Outcome wording follows what the SERVER answers: a list of failed names (`submit_cancel_or_update_docs`) is shown as
 * is; a method that answers nothing per document (`silent`: delete, clear assignment, assignment rule, tags, workflow)
 * says "N requested — the server reports failures in its messages", never a success count; `queued` says so.
 */
import * as React from "react";
import { Ban, ChevronDown, Download, Pencil, Printer, Send, Shuffle, Tags, Trash2, UserMinus, UserPlus, Workflow } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../primitives/alert-dialog";
import { Button } from "../../primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../../primitives/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../primitives/dropdown-menu";
import { Input } from "../../primitives/input";
import { Textarea } from "../../primitives/textarea";
import { DateField, DateTimeField } from "../../primitives/date-time-field";
import { LinkInput } from "../../fields/LinkInput";
import { NumberInput, type NumberKind } from "../../fields/NumberInput";
import { TimeInput } from "../../fields/TimeInput";
import type { FrappeDocField } from "../contract";
import { AssignDialog, AssignPicker } from "../../record";
import type { UserOption } from "../../record/types";
import type { BulkAction } from "../../list/parts/ListFooter";
import { TagInput } from "../../fields/TagInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { useLocale } from "../../theme/ThemeProvider";
import { withFrappeApi, type FrappeClient } from "../client";
import type { DocTypeMeta } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import type { FrappeListMeta } from "../meta";
import { invalidateFrappeList } from "../useFrappeList";
import {
  bulkAddTags, bulkApplyAssignmentRule, bulkAssign, bulkClearAssignment, bulkDelete, bulkSubmitCancelOrUpdate, listActionsMenu, selectionAfterBulk,
  type BulkOutcome, type BulkPermissions, type ListActionKind,
} from "./bulk";
import { checkPrintable, MAX_PRINT_LIMIT, type PrintSettingsInput, type PrintTaskSubscriber } from "./print";
import { FrappePrintDialog } from "./FrappePrintDialog";
import { bulkWorkflowApproval, commonTransitionActions, workflowDocs } from "./workflowBulk";

export interface FrappeBulkOptions {
  /** The user's rights on the DocType (`usePermissions().levels[0]` or `can`). Without it no action is offered. */
  permissions?: BulkPermissions;
  /** The DocType has a Workflow (Desk hides Edit / Delete / Submit / Cancel then, and adds the workflow's actions).
   *  `FrappeListView` reads it from the DocType's `__workflow_docs`; this overrides. */
  hasWorkflow?: boolean;
  /** List View Settings `allow_edit`. */
  allowEdit?: boolean;
  /** Offer only these. */
  only?: ListActionKind[];
  /**
   * Bulk Print (`bulk_operations.js:7-167`). `settings`: the site's Print Settings (Desk has them in boot; most users
   * cannot read them — pass them from your boot payload; default: the DocType defaults, drafts allowed, cancelled not).
   * `subscribeTask`: wait for `task_complete:<task_id>` of a background print (the contract's RealtimePort has none).
   */
  print?: { settings?: PrintSettingsInput; subscribeTask?: PrintTaskSubscriber };
  /** After each action (also failures), e.g. for the app's own refresh or toast. `action` is the workflow action's name. */
  onDone?: (kind: ListActionKind, outcome: BulkOutcome, names: string[], action?: string) => void;
  onError?: (error: unknown, kind: ListActionKind) => void;
}

const ICON = { delete: Trash2, submit: Send, cancel: Ban, edit: Pencil, assign: UserPlus, export: Download, clear_assignment: UserMinus, assignment_rule: Shuffle, add_tags: Tags, print: Printer, workflow: Workflow } as const;
const LABEL = {
  delete: "listBulkDelete", submit: "listBulkSubmit", cancel: "listBulkCancel", edit: "listBulkEdit", assign: "listBulkAssign", export: "listBulkExport",
  clear_assignment: "listBulkClearAssignment", assignment_rule: "listBulkAssignmentRule", add_tags: "listBulkAddTags", print: "listBulkPrint", workflow: "listBulkWorkflow",
} as const;
type Confirmable = "delete" | "submit" | "cancel" | "clear_assignment";

export interface FrappeBulkActionsProps<T> {
  client: FrappeClient; meta: FrappeListMeta; doctype: string; keys: string[]; clear: () => void; options: FrappeBulkOptions; onBusy?: (busy: boolean) => void;
  /** The checked rows (`docstatus` for Print, the row objects for the workflow's common actions — Desk's `get_checked_items()`). */
  rows?: T[];
  /** The DocType's getdoctype meta: Print formats (`__print_formats`, `default_print_format`). */
  docMeta?: DocTypeMeta;
  /** Session roles (Print: Desk lets the Administrator role print drafts / cancelled). Default: the provider's session. */
  roles?: readonly string[];
  /** The outcome line; the host shows it (the bar disappears once the selection is cleared). */
  onMessage?: (message: string) => void;
  /** Offer Export in Desk's position (the host owns the dialog). Desk offers it to everyone (`list_view.js:2092`). */
  onExport?: () => void;
  exportLabel?: string;
}

/**
 * Desk's Actions for a selection as DATA: the typed `BulkAction`s (Desk's order and gates, `listActionsMenu`), the
 * workflow's items (asked from the server each time the menu opens: `onMenuOpenChange`), and the dialogs the actions open
 * (confirmations, Edit, Add Tags, Print, and — in the Actions menu — Desk's Assign To dialog). `ListView`'s default
 * `selectionMode="header"` renders `actions` in its Actions menu; `FrappeBulkActions` renders the same as bar buttons.
 * `keys` are Frappe DOCUMENT NAMES (sent to the server), not the list's UI row keys.
 */
export function useFrappeBulkActions<T = Record<string, unknown>>({ client, meta, doctype, keys, rows, docMeta, roles, clear, options, onBusy, onMessage, onExport, exportLabel }: FrappeBulkActionsProps<T>) {
  const { t } = useLocale();
  const qc = useQueryClient();
  const { session } = useFrappeSettings();
  const api = React.useMemo(() => withFrappeApi(client), [client]);
  const kinds = listActionsMenu({ permissions: options.permissions, isSubmittable: meta.isSubmittable, hasWorkflow: !!options.hasWorkflow, allowEdit: !!options.allowEdit, hasEditableFields: meta.editable.length > 0, exportable: !!onExport })
    .filter((k) => !options.only || options.only.includes(k));
  const [asking, setAsking] = React.useState<Confirmable | null>(null);
  const [form, setForm] = React.useState<"edit" | "add_tags" | null>(null);
  const [busy, setBusy] = React.useState<ListActionKind | null>(null);
  const [printing, setPrinting] = React.useState<string[] | null>(null);
  const [assigning, setAssigning] = React.useState(false);
  const setMessage = (m: string) => onMessage?.(m);
  const [field, setField] = React.useState(meta.editable[0]?.name ?? "");
  const [value, setValue] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [wf, setWf] = React.useState<{ loading: boolean; actions: string[] }>({ loading: false, actions: [] });
  const n = String(keys.length);

  const run = async (kind: ListActionKind, call: () => Promise<BulkOutcome>, action?: string) => {
    setBusy(kind); setMessage(""); onBusy?.(true);
    try {
      const out = await call();
      options.onDone?.(kind, out, keys, action);
      // the server's own list of failed names (`submit_cancel_or_update_docs` answers it; bulk_update.py) is shown as is —
      // never a plain success line when some failed
      const result = t("listBulkResult").replace("{ok}", String(keys.length - out.failed.length)).replace("{failed}", String(out.failed.length));
      // methods that answer nothing per document (delete_items: reportview.py:608-616; remove_multiple; bulk_apply;
      // add_tags; bulk_workflow_approval: workflow.py:309-328 sends the result by realtime): never claim "0 failed"
      const requested = t("listBulkRequested").replace("{action}", action ?? t(LABEL[kind])).replace("{n}", n);
      setMessage(out.queued ? t("listBulkQueued") : out.silent || kind === "delete" ? requested : out.failed.length ? `${result}: ${out.failed.join(", ")}` : result);
      // Desk's selection outcome per action (`selectionAfterBulk`): Edit / Workflow keep the selection; Submit / Cancel clear
      // it only when every document went through; the others clear once the server answered
      const after = selectionAfterBulk(kind, out, keys.length);
      if (after.clear) clear();
      if (after.refresh) await invalidateFrappeList(qc, doctype);
    } catch (e) {
      options.onError?.(e, kind);
      setMessage(e instanceof Error ? e.message : String(e));
    } finally { setBusy(null); onBusy?.(false); }
  };

  // Desk's Clear Assignment confirm has a reject action (list_view.js:1919-1921): No, Escape or closing the dialog clears the
  // selection and refreshes. `fulfilled` tells the confirm button's close from a dismissal (Desk's primary_action_fulfilled).
  const fulfilled = React.useRef(false);
  const dismissed = (kind: Confirmable | null) => {
    if (kind === "clear_assignment" && !fulfilled.current) { clear(); void invalidateFrappeList(qc, doctype); }
    fulfilled.current = false;
    setAsking(null);
  };
  const confirmed = (kind: Confirmable) => {
    fulfilled.current = true;
    setAsking(null);
    if (kind === "delete") void run(kind, () => bulkDelete(client, doctype, keys));
    else if (kind === "submit") void run(kind, () => bulkSubmitCancelOrUpdate(client, doctype, keys, "submit"));
    else if (kind === "cancel") void run(kind, () => bulkSubmitCancelOrUpdate(client, doctype, keys, "cancel"));
    else if (kind === "clear_assignment") void run(kind, () => bulkClearAssignment(client, doctype, keys));
  };
  const editField = meta.editable.find((f) => f.name === field);
  const submitForm = () => {
    const f = form; setForm(null);
    if (f === "edit" && editField) void run("edit", () => bulkSubmitCancelOrUpdate(client, doctype, keys, "update", { [field]: bulkEditValue(value, editField.fieldtype) }));
    if (f === "add_tags" && tags.length) { const chosen = tags; setTags([]); void run("add_tags", () => bulkAddTags(client, doctype, keys, chosen)); }
  };

  // Print: Desk's checks before the dialog (bulk_operations.js:16-45) — the server would silently leave such documents
  // out of the PDF (print_format.py:145-147), so a refused selection never reaches it
  const startPrint = () => {
    const check = checkPrintable(keys, (rows ?? []) as Array<{ name?: unknown; docstatus?: unknown }>, { isSubmittable: meta.isSubmittable, settings: options.print?.settings, roles: roles ?? session?.roles });
    if (!check.ok) {
      setMessage(check.reason === "draft_or_cancelled" ? t("listPrintDraftOrCancelled") : check.reason === "none" ? t("listPrintNone") : t("listPrintTooMany").replace("{n}", String(MAX_PRINT_LIMIT)));
      return;
    }
    setMessage("");
    setPrinting(check.names);
  };

  // Workflow: ask the server which actions apply to every checked document each time the menu opens (list_view.js:1426-1428, 1831-1853)
  const loadWorkflowActions = async () => {
    setWf({ loading: true, actions: [] });
    try {
      const actions = await commonTransitionActions(client, doctype, workflowDocs(keys, (rows ?? []) as unknown[], (r) => String((r as { name?: unknown }).name)));
      setWf({ loading: false, actions });
    } catch (e) {
      setWf({ loading: false, actions: [] });
      options.onError?.(e, "workflow");
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const searchUsers = async (q: string): Promise<UserOption[]> =>
    (await client.searchLink("User", q, { referenceDoctype: doctype })).map((u) => ({ id: u.value, label: u.label || u.value, description: u.description }));
  const assignTo = (users: UserOption[], d: Parameters<typeof bulkAssign>[4]) => run("assign", () => bulkAssign(client, doctype, keys, users.map((u) => u.id), d));
  // the same click for a bar button and a menu item (Assign To: the bar keeps its popover; the menu opens Desk's dialog)
  const trigger = (k: ListActionKind) => {
    if (k === "edit" || k === "add_tags") setForm(k);
    else if (k === "export") onExport?.();
    else if (k === "print") startPrint();
    // Apply Assignment Rule runs without a confirmation in Desk (list_view.js:1929-1942)
    else if (k === "assignment_rule") void run(k, () => bulkApplyAssignmentRule(client, doctype, keys));
    else if (k === "assign") setAssigning(true);
    else if (k !== "workflow") { fulfilled.current = false; setAsking(k); }
  };
  const labelOf = (k: ListActionKind) => (k === "export" && exportLabel ? exportLabel : t(LABEL[k]));
  const actions: BulkAction<T>[] = kinds.filter((k) => k !== "workflow").map((k) => ({
    key: k, label: labelOf(k), icon: ICON[k], tone: k === "delete" ? "destructive" : "default", group: k === "delete" ? "delete" : "main",
    disabled: () => !!busy, run: () => trigger(k),
  }));
  // Desk appends the workflow's actions to the menu (list_view.js:163-168) and asks the server for them on every opening
  const workflowMenu = kinds.includes("workflow") ? (
    <>
      <DropdownMenuSeparator />
      {wf.loading ? <DropdownMenuItem disabled>{t("loading")}</DropdownMenuItem>
        : wf.actions.length ? wf.actions.map((a) => (
          <DropdownMenuItem key={a} data-action={`workflow:${a}`} onSelect={() => runWorkflow(a)}>
            <Workflow className="me-2 h-4 w-4" aria-hidden />{a}
          </DropdownMenuItem>
        ))
        : <DropdownMenuItem disabled>{t("listBulkWorkflowNone")}</DropdownMenuItem>}
    </>
  ) : null;
  const onMenuOpenChange = (open: boolean) => { if (open && kinds.includes("workflow")) void loadWorkflowActions(); };
  const dialogs = (
    <>
        <AlertDialog open={!!asking} onOpenChange={(o) => { if (!o) dismissed(asking); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{asking ? t(LABEL[asking]) : ""}</AlertDialogTitle>
              <AlertDialogDescription>
                {asking === "delete" ? t("listBulkDeleteConfirm").replace("{n}", n) : asking === "submit" ? t("listBulkSubmitConfirm").replace("{n}", n)
                  : asking === "clear_assignment" ? t("listBulkClearAssignmentConfirm") : t("listBulkCancelConfirm").replace("{n}", n)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction asChild onClick={() => asking && confirmed(asking)}>
                <Button variant={asking === "delete" ? "destructive" : "default"}>{t("confirm")}</Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
  
        <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{form ? t(LABEL[form]) : ""}</DialogTitle></DialogHeader>
            {form === "edit" ? (
              <div className="space-y-3">
                <label className="block space-y-1 text-sm"><span>{t("listBulkField")}</span>
                  <Select value={field} onValueChange={(v) => { setField(v); setValue(""); }}>
                    <SelectTrigger aria-label={t("listBulkField")}><SelectValue /></SelectTrigger>
                    <SelectContent>{meta.editable.map((f) => <SelectItem key={f.name} value={f.name}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
                <BulkEditValue field={editField} value={value} onChange={setValue} client={client} doctype={doctype} fieldDef={meta.fieldDefs[field]} />
                {/* Desk's help text when the value is empty (bulk_operations.js:406-417) */}
                {editField && value === "" && <p className="text-xs text-muted-foreground" role="status">{t("listBulkEditEmpty")}</p>}
              </div>
            ) : form === "add_tags" ? (
              // Desk's MultiSelectPills over `frappe.db.get_link_options("Tag", txt)` (bulk_operations.js:429-437); a typed tag
              // that does not exist yet is accepted — the server creates the Tag (tag.py:92-93)
              <label className="block space-y-1 text-sm"><span>{t("listBulkTags")}</span>
                <TagInput aria-label={t("listBulkTags")} value={tags} onChange={setTags} allowCreate
                  search={async (q) => (await client.searchLink("Tag", q)).map((r) => ({ value: r.value, label: r.label || r.value, description: r.description }))} />
              </label>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setForm(null)}>{t("cancel")}</Button>
              {/* Tags are required (reqd: true, bulk_operations.js:433) */}
              <Button onClick={submitForm} disabled={form === "add_tags" && !tags.length}>{form === "add_tags" ? t("listBulkAdd") : t("listBulkApply")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  
        {printing && (
          <FrappePrintDialog api={api} doctype={doctype} names={printing} meta={docMeta} settings={options.print?.settings} subscribeTask={options.print?.subscribeTask}
            open onOpenChange={(o) => { if (!o) setPrinting(null); }}
            onDone={(r) => options.onDone?.("print", { failed: [], queued: !!r.taskId, silent: true }, printing)} />
        )}
  
      <AssignDialog open={assigning} onOpenChange={setAssigning} details count={keys.length} searchUsers={searchUsers}
        me={session?.user && session.user !== "Guest" ? { id: session.user, label: session.fullName || session.user } : undefined}
        onAssign={(users, d) => assignTo(users, d)} />
    </>
  );
  const runWorkflow = (a: string) => void run("workflow", () => bulkWorkflowApproval(client, doctype, keys, a), a);
  return { kinds, actions, workflowMenu, onMenuOpenChange, dialogs, busy, trigger, searchUsers, assignTo, labelOf, wf, loadWorkflowActions, runWorkflow };
}

/** Desk's Actions as buttons in the opt-in selection bar (`selectionMode="bar"`, not Desk's layout). Same actions, dialogs
 *  and selection outcomes as `useFrappeBulkActions`. */
export function FrappeBulkActions<T = Record<string, unknown>>(props: FrappeBulkActionsProps<T>) {
  const { t } = useLocale();
  const { kinds, dialogs, busy, trigger, searchUsers, assignTo, labelOf, wf, loadWorkflowActions, runWorkflow } = useFrappeBulkActions<T>(props);
  if (!kinds.length) return null;
  return (
    <>
      {kinds.map((k) => {
        const Icon = ICON[k];
        if (k === "assign") {
          // Desk's Assign To fields (comment / due date / priority) in the bar's popover; applies to every selected document
          return (
            <AssignPicker key={k} withDetails disabled={!!busy} searchUsers={searchUsers} onAssign={(users, d) => assignTo(users, d)}
              trigger={<Button size="sm" variant="outline" className="gap-1.5" loading={busy === k} disabled={!!busy}><Icon className="h-4 w-4" /> {t(LABEL[k])}</Button>} />
          );
        }
        if (k === "workflow") {
          return (
            <DropdownMenu key={k} onOpenChange={(o) => { if (o) void loadWorkflowActions(); }}>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1.5" loading={busy === k} disabled={!!busy} data-testid="sf-bulk-workflow"><Icon className="h-4 w-4" /> {t(LABEL[k])} <ChevronDown className="h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {wf.loading ? <DropdownMenuItem disabled>{t("loading")}</DropdownMenuItem>
                  : wf.actions.length ? wf.actions.map((a) => (
                    <DropdownMenuItem key={a} onSelect={() => runWorkflow(a)}>{a}</DropdownMenuItem>
                  ))
                  : <DropdownMenuItem disabled>{t("listBulkWorkflowNone")}</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        return (
          <Button key={k} size="sm" variant={k === "delete" ? "destructive" : "outline"} className="gap-1.5" loading={busy === k} disabled={!!busy} onClick={() => trigger(k)}>
            <Icon className="h-4 w-4" /> {labelOf(k)}
          </Button>
        );
      })}
      {dialogs}
    </>
  );
}

const NUMBER_KIND: Record<string, NumberKind> = { Int: "int", Float: "float", Currency: "currency", Percent: "percent" };

/** The value Desk's bulk Edit sends (bulk_operations.js:343-356, `value || null`): empty → null, Check / numbers typed. */
export function bulkEditValue(value: string, fieldtype: string): unknown {
  if (value === "") return null;
  if (fieldtype === "Check") return Number(value);
  if (NUMBER_KIND[fieldtype]) { const n = Number(value); return Number.isNaN(n) ? value : n; }
  return value;
}

/**
 * Bulk Edit's Value control: the chosen field's own control, as Desk swaps in the field's df (bulk_operations.js:381-404)
 * — Select options, Check Yes/No, Link search (`search_link` on the target DocType), Date / Datetime pickers, Time,
 * numbers, multi-line text; plain text otherwise. The value is kept as a string (`bulkEditValue` types it on send).
 */
export function BulkEditValue({ field, value, onChange, client, doctype, fieldDef }: {
  field: FrappeListMeta["editable"][number] | undefined; value: string; onChange: (v: string) => void; client: FrappeClient; doctype: string; fieldDef?: FrappeDocField;
}) {
  const { t } = useLocale();
  const label = t("listBulkValue");
  if (!field) return null;
  const ft = field.fieldtype;
  if (field.options?.length) return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="__none__">—</SelectItem>{field.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
  if (ft === "Check") return (
    <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
      <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="1">{t("yes")}</SelectItem><SelectItem value="0">{t("no")}</SelectItem></SelectContent>
    </Select>
  );
  if (ft === "Link" && fieldDef?.options) {
    const target = String(fieldDef.options);
    return <LinkInput aria-label={label} value={value || null} onChange={(v) => onChange(v ?? "")} clearable
      search={async (q) => (await client.searchLink(target, q, { referenceDoctype: doctype })).map((r) => ({ value: r.value, label: r.label || r.value, description: r.description }))} />;
  }
  if (ft === "Date") return <DateField aria-label={label} value={value} onChange={onChange} />;
  if (ft === "Datetime") return <DateTimeField aria-label={label} value={value} onChange={onChange} />;
  if (ft === "Time") return <TimeInput aria-label={label} value={value || null} onChange={(v) => onChange(v ?? "")} />;
  if (NUMBER_KIND[ft]) return <NumberInput aria-label={label} kind={NUMBER_KIND[ft]} value={value === "" ? null : Number(value)} onChange={(n) => onChange(n === null ? "" : String(n))} />;
  if (["Small Text", "Text", "Long Text", "Text Editor", "Code"].includes(ft)) return <Textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} rows={3} />;
  return <Input aria-label={label} placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} />;
}
