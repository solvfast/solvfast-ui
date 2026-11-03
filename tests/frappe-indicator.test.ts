/**
 * The single `frappe.get_indicator` + colour table (src/frappe/services/indicator.ts). Pins the precedence of docs 11 §7
 * and 13 §2.2 for rows and docs, and proves the three former copies (list, record, feedback) now agree.
 */
import { describe, expect, it } from "vitest";
import { colourTone, feedbackTone, guessColour, resolveIndicator, styleColour, styleTone, toListTone, type IndicatorInput } from "../src/frappe/services/indicator";
import { getIndicator } from "../src/frappe/list/indicator";
import { guessTone, indicatorFor } from "../src/frappe/record/indicator";
import { toneForStyle } from "../src/frappe/record/workflow";
import { indicatorTone } from "../src/frappe/feedback/tone";

const base = (o: Partial<IndicatorInput> & { doc?: Record<string, unknown> } = {}): IndicatorInput => ({ doc: {}, isSubmittable: false, hasField: () => false, ...o });
const wf = { stateField: "workflow_state", styleOf: (s: string) => ({ Approved: "Success", Rejected: "Danger", Review: "Warning", Draft: "Primary", Closed: "Inverse", Note: "Info" } as Record<string, string>)[s] };
const r = (o: Partial<IndicatorInput> & { doc?: Record<string, unknown> }) => resolveIndicator(base(o));

describe("precedence (docs 11 §7, 13 §2.2)", () => {
  it("1. unsaved beats everything: Not Saved, orange", () => {
    expect(r({ doc: { __unsaved: 1, workflow_state: "Approved", docstatus: 1 }, isSubmittable: true, workflow: wf })).toMatchObject({ source: "unsaved", builtin: "notSaved", colour: "orange", tone: "warning" });
  });
  it("2. workflow state beats docstatus and status; coloured by Workflow State style, gray without one", () => {
    const doc = { workflow_state: "Approved", docstatus: 0, status: "Open" };
    expect(r({ doc, isSubmittable: true, workflow: wf })).toMatchObject({ source: "workflow", label: "Approved", colour: "green", filter: ["workflow_state", "Approved"] });
    expect(r({ doc: { workflow_state: "Whatever" }, workflow: wf })).toMatchObject({ colour: "gray", tone: "neutral" });
    expect(["Approved", "Rejected", "Review", "Draft", "Closed", "Note"].map((s) => r({ doc: { workflow_state: s }, workflow: wf })!.colour)).toEqual(["green", "red", "orange", "blue", "black", "light-blue"]);
  });
  it("2b. override_status hands over unless show_workflow_state; avoid_status_override hands over per state; blank state falls through", () => {
    const doc = { workflow_state: "Approved", docstatus: 1 };
    expect(r({ doc, isSubmittable: true, workflow: { ...wf, overrideStatus: true } })?.source).toBe("submitted");
    expect(r({ doc, isSubmittable: true, workflow: { ...wf, overrideStatus: true }, showWorkflowState: true })?.source).toBe("workflow");
    expect(r({ doc, isSubmittable: true, workflow: { ...wf, avoidStatusOverride: (s) => s === "Approved" } })?.source).toBe("submitted");
    expect(r({ doc: { workflow_state: "", docstatus: 0 }, isSubmittable: true, workflow: wf })?.source).toBe("draft");
  });
  it("3-4. submittable: Draft and Cancelled are red with a docstatus filter; the has_indicator_for_* hooks switch them off", () => {
    expect(r({ doc: { docstatus: 0 }, isSubmittable: true })).toMatchObject({ source: "draft", builtin: "draft", colour: "red", filter: ["docstatus", 0] });
    expect(r({ doc: { docstatus: 2 }, isSubmittable: true })).toMatchObject({ source: "cancelled", colour: "red", filter: ["docstatus", 2] });
    expect(r({ doc: { docstatus: 0 }, isSubmittable: true, hasIndicatorForDraft: true })).toBeNull();
    expect(r({ doc: { docstatus: 2 }, isSubmittable: true, hasIndicatorForCancelled: true })).toBeNull();
    expect(r({ doc: { docstatus: 0 } })).toBeNull(); // not submittable: docstatus means nothing
  });
  it("5. meta.states wins over the app hook, Submitted and guess_colour; its colour is used as written", () => {
    const states = [{ title: "Blocked", color: "Light Blue" }];
    expect(r({ doc: { status: "Blocked", docstatus: 1 }, isSubmittable: true, states, hook: () => ({ label: "H", colour: "red" }) })).toMatchObject({ source: "meta.states", colour: "light-blue", tone: "info", filter: ["status", "Blocked"] });
  });
  it("6. the app hook beats Submitted and status", () => {
    expect(r({ doc: { docstatus: 1, status: "Open" }, isSubmittable: true, hook: () => ({ label: "Hook", colour: "purple", filter: ["x", 1] }) })).toMatchObject({ source: "hook", label: "Hook", tone: "brand" });
    expect(r({ doc: { docstatus: 1 }, isSubmittable: true, hook: () => null })?.source).toBe("submitted");
  });
  it("7. Submitted is blue", () => {
    expect(r({ doc: { docstatus: 1, status: "Open" }, isSubmittable: true })).toMatchObject({ source: "submitted", colour: "blue", tone: "info", filter: ["docstatus", 1] });
  });
  it("8. status value coloured by guess_colour (substring, case-sensitive, first group wins)", () => {
    expect(["Pending Review", "Not Approved", "Open", "Failed", "Completed", "Active", "Submitted", "open", "Other"].map(guessColour)).toEqual(["orange", "orange", "red", "red", "green", "green", "blue", "gray", "gray"]);
    expect(r({ doc: { status: "Open Pending" } })?.colour).toBe("orange"); // the Pending group is tested first
    expect(r({ doc: { status: "Paid" } })).toMatchObject({ source: "status", colour: "green", filter: ["status", "Paid"] });
  });
  it("9-10. enabled, then disabled; nothing else → null", () => {
    const has = (f: string) => f === "enabled";
    expect(r({ doc: { enabled: 1 }, hasField: has })).toMatchObject({ builtin: "enabled", colour: "blue", filter: ["enabled", 1] });
    expect(r({ doc: { enabled: 0 }, hasField: has })).toMatchObject({ builtin: "disabled", colour: "gray", filter: ["enabled", 0] });
    const d = (f: string) => f === "disabled";
    expect(r({ doc: { disabled: 1 }, hasField: d })).toMatchObject({ builtin: "disabled", filter: ["disabled", 1] });
    expect(r({ doc: {}, hasField: d })).toMatchObject({ builtin: "enabled", filter: ["disabled", 0] });
    expect(r({ doc: { title: "x" } })).toBeNull();
  });
});

describe("one colour table", () => {
  it("colour → tone, and the consumers' vocabularies derive from it", () => {
    const rows: [string, string, string, string][] = [ // colour, core tone, list tone, feedback tone
      ["green", "success", "success", "success"], ["red", "danger", "destructive", "destructive"], ["orange", "warning", "warning", "warning"],
      ["yellow", "warning", "warning", "warning"], ["blue", "info", "info", "info"], ["light-blue", "info", "info", "info"],
      ["purple", "brand", "brand", "info"], ["gray", "neutral", "muted", "default"], ["grey", "neutral", "muted", "default"], ["black", "neutral", "muted", "info"],
    ];
    for (const [colour, core, list, feedback] of rows) {
      expect(colourTone(colour)).toBe(core);
      expect(toListTone(colourTone(colour))).toBe(list);
      expect(feedbackTone(colour)).toBe(feedback);
    }
    expect(feedbackTone(undefined)).toBe("info");
    expect(feedbackTone("darkgrey")).toBe("default");
  });
  it("Workflow State styles", () => {
    expect(["Success", "Warning", "Danger", "Primary", "Inverse", "Info", undefined, "Bogus"].map(styleColour)).toEqual(["green", "orange", "red", "blue", "black", "light-blue", "gray", "gray"]);
    expect(["Success", "Danger", "Inverse", undefined].map(styleTone)).toEqual(["success", "danger", "neutral", "neutral"]);
  });
  it("the old entry points are thin aliases and agree with the core", () => {
    for (const s of ["Success", "Warning", "Danger", "Primary", "Inverse", "Info", undefined]) expect(toneForStyle(s)).toBe(styleTone(s));
    for (const t of ["Pending", "Open", "Paid", "Submitted", "x"]) expect(guessTone(t)).toBe(colourTone(guessColour(t)));
    for (const c of ["green", "red", "orange", "blue", "gray", undefined]) expect(indicatorTone(c)).toBe(feedbackTone(c));
  });
  it("a list row and a form doc get the same answer", () => {
    const cases = [
      { doc: { docstatus: 0 }, sub: true }, { doc: { docstatus: 1 }, sub: true }, { doc: { docstatus: 2 }, sub: true },
      { doc: { status: "Pending" }, sub: false }, { doc: { status: "Closed", docstatus: 1 }, sub: true }, { doc: {}, sub: false },
    ];
    for (const c of cases) {
      const form = indicatorFor({ doc: { doctype: "D", name: "1", ...c.doc } as never, meta: { is_submittable: c.sub ? 1 : 0, fields: [] } });
      const list = getIndicator(c.doc, { isSubmittable: c.sub, hasField: () => false, words: { draft: "Draft", cancelled: "Cancelled", submitted: "Submitted", enabled: "Enabled", disabled: "Disabled" } });
      expect(list === null).toBe(form === null);
      if (list && form) { expect(list.label).toBe(form.label); expect(toListTone(form.tone)).toBe(list.tone); }
    }
  });
});
