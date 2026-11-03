/** `frappe.get_indicator` (model/indicator.js:26), 15.110. `listview_settings.get_indicator` is Desk-only JS and is NOT reproduced (UNVERIFIED gap). */
import type { DocTypeMeta, FrappeDoc } from "../contract";
import type { Tone } from "../../record/types";
import { guessTone as guessToneCore, resolveIndicator } from "../services/indicator";
import { currentState, type RecordWorkflow } from "./workflow";

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

/** `frappe.utils.guess_colour` as a tone — alias of the single implementation in `services/indicator.ts`. */
export const guessTone: (text: string) => Tone = guessToneCore;

export interface IndicatorInput {
  doc: FrappeDoc;
  meta: Pick<DocTypeMeta, "is_submittable"> & { fields: Array<{ fieldname: string }>; states?: Array<{ title: string; color?: string }> };
  workflow?: RecordWorkflow | null;
  /** `show_workflow_state` argument of get_indicator. */
  showWorkflowState?: boolean;
}

export function indicatorFor({ doc, meta, workflow, showWorkflowState }: IndicatorInput): Indicator | null {
  const r = resolveIndicator({
    doc, isSubmittable: meta.is_submittable === 1, hasField: (f) => meta.fields.some((x) => x.fieldname === f), states: meta.states, showWorkflowState,
    workflow: workflow ? {
      stateField: workflow.workflow_state_field, overrideStatus: !!workflow.override_status,
      styleOf: (v) => workflow.states.find((s) => s.state === v)?.style,
      avoidStatusOverride: (v) => workflow.states.some((s) => s.avoid_status_override && s.state === v),
    } : null,
  });
  if (!r) return null;
  return { label: r.label, builtin: r.builtin as Indicator["builtin"], tone: r.tone, filter: r.filter ? `${r.filter[0]},=,${r.filter[1]}` : undefined, source: r.source as Indicator["source"] };
}
// `currentState` re-exported for callers that only import the indicator module.
export { currentState };
