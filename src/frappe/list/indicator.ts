/**
 * The List View's status indicator — `frappe.get_indicator` (docs 13 §2.2; `JS/model/indicator.js:26-123`), pure TS.
 * Precedence: workflow state → Draft → Cancelled → `meta.states` entry for `status` → app hook → Submitted → `status`
 * value (`guess_colour`) → `enabled` → `disabled`. Returns the label, Frappe's colour name, a DS tone, and the filter
 * clicking the pill applies. UNVERIFIED: how a host loads the Workflow (Desk reads `frappe.boot`); pass it as `workflow`.
 */
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

const STYLE_COLOUR: Record<string, string> = { Success: "green", Warning: "orange", Danger: "red", Primary: "blue", Inverse: "black", Info: "light-blue" };
const hasWords = (list: string[], text: string) => list.some((w) => text.indexOf(w) !== -1);

/** `frappe.utils.guess_colour` (utils.js:489-533; substring match, case-sensitive). */
export function guessColour(text: string): string {
  if (!text) return "gray";
  if (hasWords(["Pending", "Review", "Medium", "Not Approved"], text)) return "orange";
  if (hasWords(["Open", "Urgent", "High", "Failed", "Rejected", "Error"], text)) return "red";
  if (hasWords(["Closed", "Finished", "Converted", "Completed", "Complete", "Confirmed", "Approved", "Yes", "Active", "Available", "Paid", "Success"], text)) return "green";
  if (hasWords(["Submitted"], text)) return "blue";
  return "gray";
}

export function toneOf(colour: string): IndicatorTone {
  switch (colour.toLowerCase().replace(/_/g, "-")) {
    case "green": case "light-green": case "success": return "success";
    case "red": case "pink": case "danger": return "destructive";
    case "orange": case "yellow": case "warning": return "warning";
    case "blue": case "light-blue": case "cyan": case "info": return "info";
    case "purple": case "violet": case "primary": return "brand";
    default: return "muted";
  }
}

const mk = (label: string, color: string, filter?: Indicator["filter"]): Indicator => ({ label, color, tone: toneOf(color), filter });

export function getIndicator(row: Record<string, unknown>, c: IndicatorConfig): Indicator | null {
  const tr = c.translate ?? ((x: string) => x);
  const ds = row.docstatus === undefined || row.docstatus === null ? undefined : Number(row.docstatus);
  const w = c.workflow;
  if (w && !w.overrideStatus && !(w.avoidStatusOverride ?? []).includes(String(row[w.stateField] ?? ""))) {
    const v = row[w.stateField];
    if (v) return mk(tr(String(v)), STYLE_COLOUR[w.styles?.[String(v)] ?? ""] ?? "gray", [w.stateField, String(v)]);
  }
  if (c.isSubmittable && ds === 0 && !c.hasIndicatorForDraft) return mk(c.words.draft, "red", ["docstatus", 0]);
  if (c.isSubmittable && ds === 2 && !c.hasIndicatorForCancelled) return mk(c.words.cancelled, "red", ["docstatus", 2]);
  const status = row.status ? String(row.status) : "";
  const state = status ? c.states?.find((s) => s.title === status) : undefined;
  if (state) return mk(tr(status), (state.color ?? "gray").toLowerCase().replace(/\s+/g, "-"), ["status", status]);
  const hook = c.getIndicator?.(row);
  if (hook) return mk(hook.label, hook.color, hook.filter);
  if (c.isSubmittable && ds === 1) return mk(c.words.submitted, "blue", ["docstatus", 1]);
  if (status) return mk(tr(status), guessColour(status), ["status", status]);
  if (c.hasField("enabled")) return row.enabled ? mk(c.words.enabled, "blue", ["enabled", 1]) : mk(c.words.disabled, "gray", ["enabled", 0]);
  if (c.hasField("disabled")) return row.disabled ? mk(c.words.disabled, "gray", ["disabled", 1]) : mk(c.words.enabled, "blue", ["disabled", 0]);
  return null;
}

/** Desk shows the Status column when the DocType has an indicator at all (`frappe.has_indicator`, indicator.js:3-24). */
export function hasIndicator(c: Pick<IndicatorConfig, "isSubmittable" | "workflow" | "states" | "hasField" | "getIndicator">): boolean {
  return c.isSubmittable || !!c.workflow || !!c.getIndicator || c.hasField("enabled") || c.hasField("disabled") || (c.hasField("status") && !!c.states?.length);
}

/** Row fields the indicator reads. */
export function indicatorFields(c: Pick<IndicatorConfig, "workflow" | "hasField">): string[] {
  return ["docstatus", ...["status", "enabled", "disabled"].filter(c.hasField), ...(c.workflow ? [c.workflow.stateField] : [])];
}
