/** `frappe.get_indicator` (model/indicator.js:26), 15.110. `listview_settings.get_indicator` is Desk-only JS and is NOT reproduced (UNVERIFIED gap). */
import type { DocTypeMeta, FrappeDoc } from "../contract";
import type { Tone } from "../../record/types";
import { currentState, toneForStyle, type RecordWorkflow } from "./workflow";

export interface Indicator {
  /** Untranslated label, or the key of a built-in word (see `builtin`). */
  label: string;
  /** Set when `label` is one of the built-in words below and must go through the package catalogue. */
  builtin?: "notSaved" | "draft" | "cancelled" | "submitted" | "enabled" | "disabled";
  tone: Tone;
  /** The list filter Desk attaches (`field,=,value`). */
  filter?: string;
  source: "unsaved" | "workflow" | "draft" | "cancelled" | "meta.states" | "submitted" | "status" | "enabled" | "disabled";
}

const has = (words: string[], text: string) => words.some((w) => text.includes(w));
/** `frappe.utils.guess_colour`. */
export function guessTone(text: string): Tone {
  if (has(["Pending", "Review", "Medium", "Not Approved"], text)) return "warning";
  if (has(["Open", "Urgent", "High", "Failed", "Rejected", "Error"], text)) return "danger";
  if (has(["Closed", "Finished", "Converted", "Completed", "Complete", "Confirmed", "Approved", "Yes", "Active", "Available", "Paid", "Success"], text)) return "success";
  if (has(["Submitted"], text)) return "info";
  return "neutral";
}

const STATE_COLOR: Record<string, Tone> = {
  green: "success", red: "danger", orange: "warning", yellow: "warning", blue: "info", "light-blue": "info", cyan: "info", purple: "brand", pink: "brand",
  gray: "neutral", grey: "neutral", black: "neutral",
};

export interface IndicatorInput {
  doc: FrappeDoc;
  meta: Pick<DocTypeMeta, "is_submittable" | "fields"> & { states?: Array<{ title: string; color?: string }> };
  workflow?: RecordWorkflow | null;
  /** `show_workflow_state` argument of get_indicator. */
  showWorkflowState?: boolean;
}

export function indicatorFor({ doc, meta, workflow, showWorkflowState }: IndicatorInput): Indicator | null {
  if (doc.__unsaved) return { label: "Not Saved", builtin: "notSaved", tone: "warning", source: "unsaved" };
  const submittable = meta.is_submittable === 1;

  if (workflow) {
    const stateVal = doc[workflow.workflow_state_field];
    const avoid = workflow.states.some((s) => s.avoid_status_override && s.state === stateVal);
    const replaces = !workflow.override_status || showWorkflowState;
    if (replaces && !avoid && typeof stateVal === "string" && stateVal) {
      const st = workflow.states.find((s) => s.state === stateVal);
      return { label: stateVal, tone: toneForStyle(st?.style), filter: `${workflow.workflow_state_field},=,${stateVal}`, source: "workflow" };
    }
  }
  if (submittable && doc.docstatus === 0) return { label: "Draft", builtin: "draft", tone: "danger", filter: "docstatus,=,0", source: "draft" };
  if (submittable && doc.docstatus === 2) return { label: "Cancelled", builtin: "cancelled", tone: "danger", filter: "docstatus,=,2", source: "cancelled" };
  const status = typeof doc.status === "string" ? doc.status : undefined;
  const st = status ? meta.states?.find((s) => s.title === status) : undefined;
  if (status && st) return { label: status, tone: STATE_COLOR[(st.color ?? "").toLowerCase().replace(/\s+/g, "-")] ?? "neutral", filter: `status,=,${status}`, source: "meta.states" };
  if (submittable && doc.docstatus === 1) return { label: "Submitted", builtin: "submitted", tone: "info", filter: "docstatus,=,1", source: "submitted" };
  if (status) return { label: status, tone: guessTone(status), filter: `status,=,${status}`, source: "status" };
  const hasField = (f: string) => meta.fields.some((x) => x.fieldname === f);
  if (hasField("enabled")) return doc.enabled ? { label: "Enabled", builtin: "enabled", tone: "info", filter: "enabled,=,1", source: "enabled" } : { label: "Disabled", builtin: "disabled", tone: "neutral", filter: "enabled,=,0", source: "disabled" };
  if (hasField("disabled")) return doc.disabled ? { label: "Disabled", builtin: "disabled", tone: "neutral", filter: "disabled,=,1", source: "disabled" } : { label: "Enabled", builtin: "enabled", tone: "info", filter: "disabled,=,0", source: "enabled" };
  return null;
}
// `currentState` re-exported for callers that only import the indicator module.
export { currentState };
