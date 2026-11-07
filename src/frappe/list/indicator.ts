/**
 * The List View's status indicator — `frappe.get_indicator` (docs 13 §2.2; `JS/model/indicator.js:26-123`), pure TS.
 * Precedence: workflow state → Draft → Cancelled → `meta.states` entry for `status` → app hook → Submitted → `status`
 * value (`guess_colour`) → `enabled` → `disabled`. Returns the label, Frappe's colour name, a DS tone, and the filter
 * clicking the pill applies. UNVERIFIED: how a host loads the Workflow (Desk reads `frappe.boot`); pass it as `workflow`.
 */
import { colourTone, guessColour as guessColourCore, resolveIndicator, toListTone } from "../services/indicator";
import { workflowFromMeta } from "../client";
import type { DocTypeMeta } from "../contract";

export type IndicatorTone = "success" | "warning" | "destructive" | "info" | "brand" | "muted";
export interface Indicator { label: string; color: string; tone: IndicatorTone; filter?: [field: string, value: string | number] }

export interface IndicatorWorkflow {
  /** `workflow_state_field` (usually `workflow_state`). */
  stateField: string;
  /** Workflow State name → style ("Success" | "Warning" | "Danger" | "Primary" | "Inverse" | "Info"). */
  styles?: Record<string, string | undefined>;
  /** Workflow `override_status`: the status/docstatus indicator wins over the workflow state. */
  overrideStatus?: boolean;
  /** States for which the workflow state is not shown (`avoid_status_override`). */
  avoidStatusOverride?: string[];
}

export interface IndicatorConfig {
  isSubmittable: boolean;
  workflow?: IndicatorWorkflow;
  /** `meta.states` (DocType State rows). */
  states?: { title: string; color?: string }[];
  hasField: (fieldname: string) => boolean;
  /** `listview_settings.get_indicator` equivalent. */
  getIndicator?: (row: Record<string, unknown>) => Pick<Indicator, "label" | "color" | "filter"> | null | undefined;
  hasIndicatorForDraft?: boolean;
  hasIndicatorForCancelled?: boolean;
  /** Translate the DocType's own words (statuses, states). Default: identity. */
  translate?: (text: string) => string;
  /** Draft / Cancelled / Submitted / Enabled / Disabled in the UI language. */
  words: { draft: string; cancelled: string; submitted: string; enabled: string; disabled: string };
}

/** `frappe.utils.guess_colour` — alias of the single implementation in `services/indicator.ts`. */
export const guessColour: (text: string) => string = guessColourCore;
export const toneOf = (colour: string): IndicatorTone => toListTone(colourTone(colour));

export function getIndicator(row: Record<string, unknown>, c: IndicatorConfig): Indicator | null {
  const tr = c.translate ?? ((x: string) => x);
  const w = c.workflow;
  const r = resolveIndicator({
    doc: row, isSubmittable: c.isSubmittable, hasField: c.hasField, states: c.states,
    hasIndicatorForDraft: c.hasIndicatorForDraft, hasIndicatorForCancelled: c.hasIndicatorForCancelled,
    workflow: w ? { stateField: w.stateField, overrideStatus: w.overrideStatus, styleOf: (v) => w.styles?.[v], avoidStatusOverride: (v) => (w.avoidStatusOverride ?? []).includes(v) } : null,
    hook: c.getIndicator ? (d) => { const h = c.getIndicator!(d); return h ? { label: h.label, colour: h.color, filter: h.filter } : null; } : undefined,
  });
  if (!r) return null;
  const label = r.builtin ? c.words[r.builtin as keyof IndicatorConfig["words"]] : r.source === "hook" ? r.label : tr(r.label);
  return { label, color: r.colour, tone: toListTone(r.tone), filter: r.filter };
}

/** Desk shows the Status column when the DocType has an indicator at all (`frappe.has_indicator`, indicator.js:3-24). */
export function hasIndicator(c: Pick<IndicatorConfig, "isSubmittable" | "workflow" | "states" | "hasField" | "getIndicator">): boolean {
  return c.isSubmittable || !!c.workflow || !!c.getIndicator || c.hasField("enabled") || c.hasField("disabled") || (c.hasField("status") && !!c.states?.length);
}

/** Row fields the indicator reads. */
export function indicatorFields(c: Pick<IndicatorConfig, "workflow" | "hasField">): string[] {
  return ["docstatus", ...["status", "enabled", "disabled"].filter(c.hasField), ...(c.workflow ? [c.workflow.stateField] : [])];
}

/**
 * The indicator's workflow, derived from the DocType as Desk does: `frappe.workflow.setup` (model/workflow.js:10-21) reads
 * the active Workflow (getdoctype's `__workflow_docs`) — `workflow_state_field`, `override_status`, and the states with
 * `avoid_status_override`; the colour comes from the Workflow State's `style` (indicator.js:44-60). `undefined` when the
 * DocType has no active workflow.
 */
export function indicatorWorkflowFromMeta(meta: DocTypeMeta | undefined): IndicatorWorkflow | undefined {
  const wf = workflowFromMeta(meta) as (ReturnType<typeof workflowFromMeta> & { override_status?: unknown }) | null;
  if (!wf || !wf.workflow_state_field) return undefined;
  const states = wf.states as (typeof wf.states[number] & { avoid_status_override?: unknown })[];
  return {
    stateField: wf.workflow_state_field,
    styles: Object.fromEntries(states.map((s) => [s.state, s.style || undefined])),
    overrideStatus: !!Number(wf.override_status ?? 0),
    avoidStatusOverride: states.filter((s) => !!Number(s.avoid_status_override ?? 0)).map((s) => s.state),
  };
}
