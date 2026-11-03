/**
 * One implementation of `frappe.get_indicator` (JS/model/indicator.js:26-123, 15.110; docs 11 §7, 13 §2.2) and of
 * Desk's indicator colours, for a LIST ROW and a FORM DOC alike. Pure TS. Everything else (list column, form status
 * badge, msgprint dots, Workflow State styles) maps through `colourTone` — there is no second colour table.
 *
 * Precedence (first match wins):
 *  1. `__unsaved` → "Not Saved", orange                                  (form only; rows are never unsaved)
 *  2. workflow state, when the DocType has a workflow that does not `override_status` (or `showWorkflowState`) and the
 *     state is not in `avoid_status_override`; colour from the Workflow State `style`, else gray
 *  3. submittable + docstatus 0 → Draft (red)   4. submittable + docstatus 2 → Cancelled (red)
 *  5. `meta.states` row titled like `status` (its colour)                  6. the app's `get_indicator` hook
 *  7. submittable + docstatus 1 → Submitted (blue)
 *  8. `status` value, coloured by `guess_colour`                          9. `enabled` field  10. `disabled` field
 * UNVERIFIED: the listview hook (`listview_settings.get_indicator`) is Desk-only JS; hosts pass an equivalent callback.
 */

/** The package's one tone vocabulary for indicators. Consumers rename at their edge (see `toListTone`, `toFeedbackTone`). */
export type IndicatorToneName = "success" | "warning" | "danger" | "info" | "brand" | "neutral";

/** Frappe colour name → tone. Unknown / gray / black → neutral. */
export function colourTone(colour: string | undefined): IndicatorToneName {
  switch ((colour ?? "").toLowerCase().replace(/[_\s]+/g, "-")) {
    case "green": case "light-green": case "success": return "success";
    case "orange": case "yellow": case "warning": return "warning";
    case "red": case "danger": return "danger";
    case "blue": case "light-blue": case "cyan": case "info": return "info";
    case "purple": case "violet": case "pink": case "primary": return "brand";
    default: return "neutral";
  }
}

/** Workflow State `style` → Frappe colour (indicator.js:50-58). No / unknown style → gray. */
export const STYLE_COLOUR: Record<string, string> = { Success: "green", Warning: "orange", Danger: "red", Primary: "blue", Inverse: "black", Info: "light-blue" };
export const styleColour = (style: string | undefined): string => (style && STYLE_COLOUR[style]) || "gray";
export const styleTone = (style: string | undefined): IndicatorToneName => colourTone(styleColour(style));

const hasWords = (list: string[], text: string) => list.some((w) => text.indexOf(w) !== -1);
/** `frappe.utils.guess_colour` (utils.js:489-533): substring match, case-sensitive. */
export function guessColour(text: string | undefined): string {
  if (!text) return "gray";
  if (hasWords(["Pending", "Review", "Medium", "Not Approved"], text)) return "orange";
  if (hasWords(["Open", "Urgent", "High", "Failed", "Rejected", "Error"], text)) return "red";
  if (hasWords(["Closed", "Finished", "Converted", "Completed", "Complete", "Confirmed", "Approved", "Yes", "Active", "Available", "Paid", "Success"], text)) return "green";
  if (hasWords(["Submitted"], text)) return "blue";
  return "gray";
}
export const guessTone = (text: string | undefined): IndicatorToneName => colourTone(guessColour(text));

/** msgprint `indicator` (docs 14 §B3): green / orange·yellow / red / gray·grey·darkgrey / anything else → info (default blue). */
export function feedbackTone(indicator?: string): "info" | "success" | "warning" | "destructive" | "default" {
  const c = (indicator || "blue").toLowerCase();
  if (c === "darkgrey") return "default";
  const t = colourTone(c);
  return t === "success" ? "success" : t === "warning" ? "warning" : t === "danger" ? "destructive" : c === "gray" || c === "grey" ? "default" : "info";
}
/** The list's Badge variants. */
export const toListTone = (t: IndicatorToneName): "success" | "warning" | "destructive" | "info" | "brand" | "muted" => (t === "danger" ? "destructive" : t === "neutral" ? "muted" : t);

export type IndicatorSource = "unsaved" | "workflow" | "draft" | "cancelled" | "meta.states" | "hook" | "submitted" | "status" | "enabled" | "disabled";
export type IndicatorWord = "notSaved" | "draft" | "cancelled" | "submitted" | "enabled" | "disabled";

export interface IndicatorResult {
  source: IndicatorSource;
  /** Untranslated text: the state / status value, or the English word when `builtin` is set. */
  label: string;
  /** Set when `label` is one of Desk's own words, which the caller translates through the package catalogue. */
  builtin?: IndicatorWord;
  /** Frappe colour name (gray, red, orange, green, blue, light-blue, black …). */
  colour: string;
  tone: IndicatorToneName;
  /** What clicking the pill filters by (`field,=,value`). */
  filter?: [field: string, value: string | number];
}

export interface IndicatorInput {
  /** The row or document. */
  doc: Record<string, unknown>;
  isSubmittable: boolean;
  hasField: (fieldname: string) => boolean;
  /** `meta.states` (DocType State rows). */
  states?: { title: string; color?: string }[];
  workflow?: {
    stateField: string;
    /** Workflow State name → `style`. */
    styleOf?: (state: string) => string | undefined;
    overrideStatus?: boolean;
    /** States whose indicator is the status one, not the workflow state. */
    avoidStatusOverride?: (state: string) => boolean;
  } | null;
  /** `show_workflow_state` argument of get_indicator. */
  showWorkflowState?: boolean;
  hasIndicatorForDraft?: boolean;
  hasIndicatorForCancelled?: boolean;
  hook?: (doc: Record<string, unknown>) => { label: string; colour: string; filter?: IndicatorResult["filter"] } | null | undefined;
}

const res = (source: IndicatorSource, label: string, colour: string, filter?: IndicatorResult["filter"], builtin?: IndicatorWord): IndicatorResult =>
  ({ source, label, colour, tone: colourTone(colour), ...(filter ? { filter } : {}), ...(builtin ? { builtin } : {}) });

export function resolveIndicator(i: IndicatorInput): IndicatorResult | null {
  const { doc } = i;
  if (doc.__unsaved) return res("unsaved", "Not Saved", "orange", undefined, "notSaved");
  const ds = doc.docstatus === undefined || doc.docstatus === null ? undefined : Number(doc.docstatus);

  const w = i.workflow;
  if (w) {
    const v = doc[w.stateField];
    const replaces = !w.overrideStatus || !!i.showWorkflowState;
    if (replaces && typeof v === "string" && v && !w.avoidStatusOverride?.(v)) return res("workflow", v, styleColour(w.styleOf?.(v)), [w.stateField, v]);
  }
  if (i.isSubmittable && ds === 0 && !i.hasIndicatorForDraft) return res("draft", "Draft", "red", ["docstatus", 0], "draft");
  if (i.isSubmittable && ds === 2 && !i.hasIndicatorForCancelled) return res("cancelled", "Cancelled", "red", ["docstatus", 2], "cancelled");
  const status = typeof doc.status === "string" && doc.status ? doc.status : "";
  const state = status ? i.states?.find((s) => s.title === status) : undefined;
  if (state) return res("meta.states", status, (state.color ?? "gray").toLowerCase().replace(/\s+/g, "-"), ["status", status]);
  const hooked = i.hook?.(doc);
  if (hooked) return res("hook", hooked.label, hooked.colour, hooked.filter);
  if (i.isSubmittable && ds === 1) return res("submitted", "Submitted", "blue", ["docstatus", 1], "submitted");
  if (status) return res("status", status, guessColour(status), ["status", status]);
  if (i.hasField("enabled")) return doc.enabled ? res("enabled", "Enabled", "blue", ["enabled", 1], "enabled") : res("disabled", "Disabled", "gray", ["enabled", 0], "disabled");
  if (i.hasField("disabled")) return doc.disabled ? res("disabled", "Disabled", "gray", ["disabled", 1], "disabled") : res("enabled", "Enabled", "blue", ["disabled", 0], "enabled");
  return null;
}
