/**
 * P36e submit — Frappe's docstatus rules as pure, Frappe-free functions (Core: no `src/frappe` import), for hosts that
 * keep their own records (e.g. a mock store) and must behave as Frappe's server does for a SUBMITTABLE DocType with a
 * Workflow. Every rule cites Frappe 15.110:
 *  - `check_docstatus_transition` (model/document.py:880-915): 0→0 save, 0→1 submit, 1→1 update after submit,
 *    1→2 cancel; 1→0 and 0→2 refused; a cancelled document can never be saved again.
 *  - `apply_workflow` (model/workflow.py:129-146): the next state's `doc_status` decides save / submit / update / cancel;
 *    anything else is "Illegal Document Status for {0}".
 *  - `Workflow.validate_docstatus` (workflow/doctype/workflow/workflow.py:84-109): no transition out of a docstatus-2
 *    state, never 1→0, never 0→2 (design time).
 *  - `_validate_mandatory` / `_get_missing_mandatory_fields` (model/document.py:946-968, base_document.py:738-784).
 *  - `_validate_update_after_submit` (model/base_document.py:1050-1085): only `allow_on_submit` fields change at 1.
 *  - delete: `check_permission_and_not_submitted` (model/delete_doc.py:240-262).
 *  - amend: `_set_amended_name` (model/naming.py:526-543), `amend_doc` (public/js/frappe/form/form.js:1011-1036).
 *  - indicator tooltip: `get_indicator_html` (public/js/frappe/list/list_view.js:1105-1119).
 * Messages are returned as `{ key, args }` of the package catalogue (`messages-ws/submit.ts`, en + ar from Frappe's
 * frappe/locale/ar.po) plus the English server text, so a host shows them in the UI language.
 */

/** `frappe.model.docstatus.DocStatus`: 0 Draft, 1 Submitted, 2 Cancelled. */
export type DocStatus = 0 | 1 | 2;
export const DOCSTATUS = { DRAFT: 0, SUBMITTED: 1, CANCELLED: 2 } as const;

/** A message of the package catalogue with its positional arguments ({0}, {1}, …) and Frappe's English text. */
export interface DocMessage {
  key: SubmitMessageKey;
  args: string[];
  /** The English text, as the Frappe server words it (arguments filled in). */
  text: string;
}

export type SubmitMessageKey =
  | "subCannotDraftToCancelled" | "subCannotSubmittedToDraft" | "subCannotEditCancelled" | "subIllegalDocStatus"
  | "subWfCancelledRow" | "subWfSubmittedToDraftRow" | "subWfCancelBeforeSubmitRow" | "subValueMissing"
  | "subNotAllowedAfterSubmit" | "subCannotDeleteSubmitted" | "subAlreadyAmended" | "subAmendNotCancelled"
  | "subNotValidWorkflowAction" | "subLinkExists";

/** Frappe's English wording of each key (the `en` catalogue repeats it). */
export const SUBMIT_MESSAGE_TEXT: Record<SubmitMessageKey, string> = {
  subCannotDraftToCancelled: "Cannot change docstatus from 0 (Draft) to 2 (Cancelled)",
  subCannotSubmittedToDraft: "Cannot change docstatus from 1 (Submitted) to 0 (Draft)",
  subCannotEditCancelled: "Cannot edit cancelled document",
  subIllegalDocStatus: "Illegal Document Status for {0}",
  subWfCancelledRow: "Cannot change state of Cancelled Document. Transition row {0}",
  subWfSubmittedToDraftRow: "Submitted Document cannot be converted back to draft. Transition row {0}",
  subWfCancelBeforeSubmitRow: "Cannot cancel before submitting. See Transition {0}",
  subValueMissing: "Error: Value missing for {0}: {1}",
  subNotAllowedAfterSubmit: "Not allowed to change {0} after submission from {1} to {2}",
  subCannotDeleteSubmitted: "{0} {1}: Submitted Record cannot be deleted. You must Cancel it first.",
  subAlreadyAmended: "This document is already amended, you cannot ammend it again",
  subAmendNotCancelled: "{0} cannot be amended because it is not cancelled. Please cancel the document before creating an amendment.",
  /** Frappe: "Not a valid Workflow Action" — the DS's terminology says Lifecycle (P36b). */
  subNotValidWorkflowAction: "Not a valid Lifecycle Action",
  subLinkExists: "Cannot delete or cancel because {0} {1} is linked with {2} {3}",
};

/** Fill `{0}`, `{1}`, … (Frappe's `str.format` / `__(text, [args])`). */
export function fillArgs(template: string, args: readonly string[]): string {
  return template.replace(/\{(\d+)\}/g, (m, i: string) => (args[Number(i)] !== undefined ? args[Number(i)] : m));
}

export function docMessage(key: SubmitMessageKey, ...args: Array<string | number>): DocMessage {
  const a = args.map(String);
  return { key, args: a, text: fillArgs(SUBMIT_MESSAGE_TEXT[key], a) };
}

/** A message in the UI language: `t(key)` (the package catalogue) with the arguments filled in. */
export function formatDocMessage(m: DocMessage, t?: (key: string) => string): string {
  const tpl = t ? t(m.key) : SUBMIT_MESSAGE_TEXT[m.key];
  return fillArgs(tpl && tpl !== m.key ? tpl : SUBMIT_MESSAGE_TEXT[m.key], m.args);
}

const asDocStatus = (v: unknown): DocStatus => (Number(v) === 1 ? 1 : Number(v) === 2 ? 2 : 0);
/** A stored docstatus (`0` / `"1"` / undefined …) as a DocStatus; anything unknown is a draft (`doc_status or 0`). */
export const toDocStatus = (v: unknown): DocStatus => asDocStatus(v);

/** What saving a document does when its docstatus moves `from` → `to` (document.py `_action`). */
export type DocstatusAction = "save" | "submit" | "update_after_submit" | "cancel";
export type DocstatusResult = { ok: true; action: DocstatusAction } | { ok: false; error: DocMessage };

/**
 * `check_docstatus_transition` (document.py:880-915): `from` = the stored docstatus, `to` = the docstatus being saved.
 * 0→0 save · 0→1 submit · 1→1 update_after_submit · 1→2 cancel · 0→2 / 1→0 refused · from 2 refused ("Cannot edit
 * cancelled document" — the cancelled branch at :913-914). A new document (`from` undefined) is a draft being inserted.
 */
export function docstatusTransition(from: DocStatus | undefined, to: DocStatus): DocstatusResult {
  const f = from ?? 0;
  if (f === 2) return { ok: false, error: docMessage("subCannotEditCancelled") };
  if (f === 0) {
    if (to === 0) return { ok: true, action: "save" };
    if (to === 1) return { ok: true, action: "submit" };
    return { ok: false, error: docMessage("subCannotDraftToCancelled") };
  }
  if (to === 1) return { ok: true, action: "update_after_submit" };
  if (to === 2) return { ok: true, action: "cancel" };
  return { ok: false, error: docMessage("subCannotSubmittedToDraft") };
}

/** What `apply_workflow` does for a transition into a state of docstatus `to` (workflow.py:129-146). */
export type WorkflowDocAction = "save" | "submit" | "update" | "cancel";
export type WorkflowDocResult = { ok: true; action: WorkflowDocAction } | { ok: false; error: DocMessage };

/**
 * `apply_workflow` (workflow.py:129-146): 0→0 `doc.save()` · 0→1 `doc.submit()` (mandatory fields checked) · 1→1
 * `doc.save()` (an update after submit: the state field is allow_on_submit, workflow.py:55-56) · 1→2 `doc.cancel()` ·
 * anything else → "Illegal Document Status for {next state}" (:145-146): 1→0, 0→2 and every move out of a cancelled doc.
 */
export function workflowDocAction(from: DocStatus, to: DocStatus, nextState: string): WorkflowDocResult {
  if (from === 0 && to === 0) return { ok: true, action: "save" };
  if (from === 0 && to === 1) return { ok: true, action: "submit" };
  if (from === 1 && to === 1) return { ok: true, action: "update" };
  if (from === 1 && to === 2) return { ok: true, action: "cancel" };
  return { ok: false, error: docMessage("subIllegalDocStatus", nextState) };
}

export interface WorkflowStateDoc { state: string; docStatus?: DocStatus | number | string | null }
export interface WorkflowTransitionDoc { state: string; nextState: string; /** 1-based row number (Desk's `t.idx`). */ idx?: number }

/**
 * `Workflow.validate_docstatus` (workflow.py:84-109), run when a Workflow is saved: for every transition row, refuse
 * leaving a docstatus-2 state, 1→0 and 0→2. Returns every violation (Frappe throws on the first); [] = valid.
 * An unknown state is reported by Frappe as "{0} not a valid State" (:90) — returned here as `unknownStates`.
 */
export function validateWorkflowDocstatus(states: readonly WorkflowStateDoc[], transitions: readonly WorkflowTransitionDoc[]): { errors: DocMessage[]; unknownStates: string[] } {
  const ds = new Map(states.map((s) => [s.state, asDocStatus(s.docStatus)]));
  const errors: DocMessage[] = [];
  const unknownStates: string[] = [];
  transitions.forEach((t, i) => {
    const idx = t.idx ?? i + 1;
    const from = ds.get(t.state), to = ds.get(t.nextState);
    if (from === undefined || to === undefined) { unknownStates.push(from === undefined ? t.state : t.nextState); return; }
    if (from === 2) errors.push(docMessage("subWfCancelledRow", idx));
    else if (from === 1 && to === 0) errors.push(docMessage("subWfSubmittedToDraftRow", idx));
    else if (from === 0 && to === 2) errors.push(docMessage("subWfCancelBeforeSubmitRow", idx));
  });
  return { errors, unknownStates };
}

/** The docstatus a Workflow state carries (`doc_status or 0`, workflow.py:129). */
export function stateDocStatus(states: readonly WorkflowStateDoc[], state: string): DocStatus {
  return asDocStatus(states.find((s) => s.state === state)?.docStatus);
}

/** A field as the docstatus rules need it (a subset of a DocField). */
export interface DocstatusField {
  fieldname: string;
  label?: string;
  reqd?: boolean | 0 | 1;
  allow_on_submit?: boolean | 0 | 1;
  read_only?: boolean | 0 | 1;
  /** Table / Table MultiSelect / Text Editor / HTML Code change how "empty" is judged (base_document.py:741-771). */
  fieldtype?: string;
  options?: string;
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "");
/** `has_content` + the `in (None, [])` test of `_get_missing_mandatory_fields` (base_document.py:760-777). */
export function hasMandatoryValue(f: Pick<DocstatusField, "fieldtype" | "options">, v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  const s = typeof v === "string" ? v : String(v);
  const text = stripHtml(s).trim() !== "";
  if (f.fieldtype === "Text Editor" || (f.fieldtype === "Code" && f.options === "HTML")) return text || s.includes("<img");
  return text;
}

/**
 * `_validate_mandatory` (document.py:946-968): the `reqd` fields without a value, each with Frappe's message
 * "Error: Value missing for {doctype}: {label}" (base_document.py:758) — what `submit()` and every `save()` raise as
 * MandatoryError. `doctype` is the name the message shows.
 */
export function missingMandatory(fields: readonly DocstatusField[], doc: Record<string, unknown>, doctype: string): { fieldnames: string[]; messages: DocMessage[] } {
  const miss = fields.filter((f) => f.reqd && !hasMandatoryValue(f, doc[f.fieldname]));
  return { fieldnames: miss.map((f) => f.fieldname), messages: miss.map((f) => docMessage("subValueMissing", doctype, f.label || f.fieldname)) };
}

/**
 * May this field be changed at this docstatus? Draft: yes; submitted: only `allow_on_submit` (base_document.py:1058);
 * cancelled: never ("Cannot edit cancelled document", document.py:913-914). Desk's Report view uses the same test for
 * in-place editing (report_view.js:758-770). Read-only fields are never user-editable.
 */
export function isEditableAtDocstatus(f: Pick<DocstatusField, "allow_on_submit" | "read_only">, docstatus: DocStatus): boolean {
  if (f.read_only) return false;
  if (docstatus === 2) return false;
  if (docstatus === 1) return !!f.allow_on_submit;
  return true;
}

/** Display text of a value in the update-after-submit message (Frappe bolds `db_value` / `self_value` as str()). */
const shown = (v: unknown): string => (v === null || v === undefined ? "None" : v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v));
const same = (a: unknown, b: unknown): boolean => {
  const norm = (v: unknown) => (v === undefined || v === "" ? null : v instanceof Date ? v.toISOString() : v);
  const x = norm(a), y = norm(b);
  return typeof x === "object" || typeof y === "object" ? JSON.stringify(x) === JSON.stringify(y) : x === y;
};

/**
 * `_validate_update_after_submit` (base_document.py:1050-1085) for a SUBMITTED document: every field that is not
 * `allow_on_submit` and whose value differs from the stored one → "Not allowed to change {label} after submission from
 * {old} to {new}" (title "Cannot Update After Submit"). Frappe throws on the first; all are returned. Fields absent from
 * `fields` are not checked (Frappe checks only DocFields: `df` must exist, :1058).
 */
export function updateAfterSubmitViolations(fields: readonly DocstatusField[], before: Record<string, unknown>, after: Record<string, unknown>): DocMessage[] {
  const out: DocMessage[] = [];
  for (const f of fields) {
    if (f.allow_on_submit) continue;
    const a = before[f.fieldname], b = after[f.fieldname];
    if (!(hasAnyValue(a) || hasAnyValue(b))) continue; // `(self.get(key) or db_value)` (:1058)
    if (!same(a, b)) out.push(docMessage("subNotAllowedAfterSubmit", f.label || f.fieldname, shown(a), shown(b)));
  }
  return out;
}
const hasAnyValue = (v: unknown) => !(v === null || v === undefined || v === "" || v === 0 || v === false || (Array.isArray(v) && v.length === 0));

/** Delete is refused for a SUBMITTED document of a submittable DocType (delete_doc.py:252-262); drafts and cancelled go. */
export function deleteRefusal(docstatus: DocStatus, o: { isSubmittable: boolean; doctype: string; name: string }): DocMessage | null {
  return o.isSubmittable && docstatus === 1 ? docMessage("subCannotDeleteSubmitted", o.doctype, o.name) : null;
}

/**
 * `check_if_doc_is_linked` (delete_doc.py:330-400, 432-445) for Delete: a document still linked from one that is NOT
 * cancelled (e.g. an amendment whose `amended_from` points at it) cannot be deleted — "Cannot delete or cancel because
 * {doctype} {name} is linked with {ref doctype} {ref name}" (LinkExistsError). `links` = the documents linking to it.
 */
export function linkedDeleteRefusal(o: { doctype: string; name: string }, links: ReadonlyArray<{ doctype: string; name: string; docstatus: DocStatus }>): DocMessage | null {
  const live = links.find((l) => l.docstatus !== 2);
  return live ? docMessage("subLinkExists", o.doctype, o.name, live.doctype, live.name) : null;
}

/**
 * The name of an amendment (`_set_amended_name`, naming.py:526-543, "Amend Counter" — the default amend naming): the
 * amended document's name + "-1"; when the amended document is itself an amendment (`amended_from` set), its last
 * "-n" is incremented instead (X-1 → X-2). Frappe's "Default Naming" rule (a fresh series name) is not modelled.
 */
export function amendedName(amendedFrom: string, sourceIsAmendment: boolean): string {
  if (!sourceIsAmendment) return `${amendedFrom}-1`;
  const parts = amendedFrom.split("-");
  const n = parseInt(parts[parts.length - 1] ?? "", 10);
  return `${parts.slice(0, -1).join("-")}-${(Number.isFinite(n) ? n : 0) + 1}`;
}

/**
 * Can this document be amended (Desk's Amend button, toolbar.js:607-608 + form.js:1011-1028)? Only a cancelled document,
 * only with the amend right, and only once (`is_document_amended`: "This document is already amended, you cannot ammend
 * it again" — Frappe's spelling).
 */
export function amendRefusal(docstatus: DocStatus, o: { alreadyAmended: boolean; name: string }): DocMessage | null {
  if (docstatus !== 2) return docMessage("subAmendNotCancelled", o.name);
  if (o.alreadyAmended) return docMessage("subAlreadyAmended");
  return null;
}

/** The three docstatus words Desk shows (indicator.js:72-95), as catalogue keys of the package's form messages. */
export const DOCSTATUS_LABEL_KEY: Record<DocStatus, "formDraft" | "formSubmitted" | "formCancelled"> = { 0: "formDraft", 1: "formSubmitted", 2: "formCancelled" };
/** Desk's indicator colour per docstatus for a submittable DocType WITHOUT a workflow (indicator.js:72-95). */
export const DOCSTATUS_TONE: Record<DocStatus, "danger" | "info"> = { 0: "danger", 1: "info", 2: "danger" };
/**
 * The tooltip of Desk's list indicator pill (`get_indicator_html`, list_view.js:1105-1119): with a workflow the pill
 * shows the workflow STATE, and its `title` tells the docstatus — "Document is in draft state" / "… has been submitted" /
 * "… has been cancelled". Catalogue keys.
 */
export const DOCSTATUS_DESCRIPTION_KEY: Record<DocStatus, "subDocDraft" | "subDocSubmitted" | "subDocCancelled"> = { 0: "subDocDraft", 1: "subDocSubmitted", 2: "subDocCancelled" };
