/**
 * workflowLifecycle / workflowStatePhase (C5): a Frappe Workflow state's phase comes from Frappe's own data —
 * doc_status 1 / 2 or no way out → closed; otherwise open; never on_hold (nothing in a Workflow marks it).
 */
import { describe, expect, it } from "vitest";
import { workflowLifecycle, workflowStatePhase, type RecordWorkflow } from "../src/frappe/record/workflow";
import { lifecycleNext, lifecycleTone } from "../src/record/lifecycle";

const wf = (states: [string, string, string?][], transitions: [string, string, string][]): RecordWorkflow => ({
  name: "WF", document_type: "Leave Application", workflow_state_field: "workflow_state",
  states: states.map(([state, doc_status, style]) => ({ state, doc_status, style })),
  transitions: transitions.map(([state, action, next_state]) => ({ state, action, next_state, allowed: "Employee" })),
});
const phases = (w: RecordWorkflow) => Object.fromEntries(workflowLifecycle(w).states.map((s) => [s.id, s.phase]));

describe("WF.phase — Frappe Workflow states get a phase from Frappe's data", () => {
  it("WF.phase.1 draft → submitted → cancelled: the draft is open, submitted (1) and cancelled (2) are closed", () => {
    const w = wf([["Draft", "0"], ["Approved", "1", "Success"], ["Cancelled", "2", "Danger"]],
      [["Draft", "Approve", "Approved"], ["Approved", "Cancel", "Cancelled"]]);
    expect(phases(w)).toEqual({ Draft: "open", Approved: "closed", Cancelled: "closed" });
    const def = workflowLifecycle(w);
    // A submitted state still has its way forward on the rail: the phase changes nothing there.
    expect(lifecycleNext(def, "Approved").map((n) => n.id)).toEqual(["Cancelled"]);
    // Tones follow the Workflow State style for closed states: Danger → danger, Success → success.
    expect(def.states.map((s) => lifecycleTone(s))).toEqual(["info", "success", "danger"]);
  });

  it("WF.phase.2 a doc_status-0 state with no transition out (or only to itself) is terminal: closed", () => {
    const w = wf([["Open", "0"], ["Review", "0", "Warning"], ["Rejected", "0", "Danger"], ["Parked", "0"]],
      [["Open", "Send", "Review"], ["Review", "Reject", "Rejected"], ["Review", "Park", "Parked"], ["Parked", "Touch", "Parked"]]);
    expect(phases(w)).toEqual({ Open: "open", Review: "open", Rejected: "closed", Parked: "closed" });
    const parked = workflowLifecycle(w).states.find((s) => s.id === "Parked")!;
    expect(lifecycleTone(parked)).toBe("neutral"); // no style → gray → neutral, as the indicator
  });

  it("WF.phase.3 a workflow of doc_status 0 only, every state with a way out: all open, none on hold", () => {
    const w = wf([["New", "0"], ["On Hold", "0", "Warning"], ["Working", "0"]],
      [["New", "Start", "Working"], ["Working", "Hold", "On Hold"], ["On Hold", "Resume", "Working"], ["Working", "Restart", "New"]]);
    expect(phases(w)).toEqual({ New: "open", "On Hold": "open", Working: "open" });
    expect(workflowLifecycle(w).states.every((s) => s.color === undefined)).toBe(true);
  });

  it("WF.phase.4 doc_status may arrive as a number-like string or be absent; duplicates keep the first row", () => {
    const w = wf([["A", "0"], ["B", "1"], ["A", "2"]], [["A", "Go", "B"]]);
    expect(workflowLifecycle(w).states.map((s) => [s.id, s.phase])).toEqual([["A", "open"], ["B", "closed"]]);
    expect(workflowStatePhase({ transitions: [] }, { state: "X", doc_status: undefined as unknown as string })).toBe("closed");
    expect(workflowStatePhase({ transitions: [{ state: "X", action: "a", next_state: "Y", allowed: "R" }] }, { state: "X", doc_status: "0" })).toBe("open");
  });
});
