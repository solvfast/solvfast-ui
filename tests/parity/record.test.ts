/**
 * Workflow helpers and timeline builder — docs/qa/parity-checklists.md W-02..W-05, H-01, H-02, H-05.
 * Native: model/workflow.js, form/workflow.js:86-141, model/workflow.py:39-221, toolbar.js:593,668-699,
 * footer/form_timeline.js:135-175,614-662, form_timeline/version_timeline_content_builder.js:3-367.
 * Implementation under test (A4): src/frappe/record/{workflow.ts,timeline.ts}.
 */
import { describe, expect, it } from "vitest";
import type { DocInfo, FrappeDoc, VersionInfo } from "../../src/frappe/contract";
import {
  canCancelDocument, hasApprovalAccess, isReadOnlyState, standardActionsUnderWorkflow, visibleTransitions, workflowFromMeta,
  workflowLockedFields, toneForStyle,
} from "../../src/frappe/record/workflow";
import { buildTimelineItems, commaAnd, formatTimelineValue, formatVersion, type TimelineContext } from "../../src/frappe/record/timeline";
import { defaultMessages } from "../../src/theme/messages";

// ---- the fixture workflow, as getdoctype ships it (`__workflow_docs`, desk/form/meta.py) -----------------------------
const wfMeta = {
  name: "SFUI Test Workflow",
  __workflow_docs: [
    {
      doctype: "Workflow", name: "SFUI Test Workflow Flow", document_type: "SFUI Test Workflow", workflow_state_field: "workflow_state", override_status: 0,
      states: [
        { state: "SFUI Draft", doc_status: "0", allow_edit: "SFUI Tester" },
        { state: "SFUI Pending", doc_status: "0", allow_edit: "SFUI Approver" },
        { state: "SFUI Approved", doc_status: "1", allow_edit: "SFUI Approver", update_field: "approval_notes", update_value: "approved" },
        { state: "SFUI Rejected", doc_status: "0", allow_edit: "SFUI Tester" },
      ],
      transitions: [
        { state: "SFUI Draft", action: "Request Approval", next_state: "SFUI Pending", allowed: "SFUI Tester", allow_self_approval: 1 },
        { state: "SFUI Pending", action: "Approve", next_state: "SFUI Approved", allowed: "SFUI Approver", allow_self_approval: 0, condition: "doc.amount < 1000" },
        { state: "SFUI Pending", action: "Reject", next_state: "SFUI Rejected", allowed: "SFUI Approver", allow_self_approval: 1 },
      ],
    },
    { doctype: "Workflow State", name: "SFUI Approved", style: "Success", icon: "ok-sign" },
    { doctype: "Workflow State", name: "SFUI Rejected", style: "Danger" },
  ],
};
const wf = workflowFromMeta(wfMeta)!;
const doc = (o: Record<string, unknown> = {}): FrappeDoc => ({ doctype: "SFUI Test Workflow", name: "W-1", docstatus: 0, owner: "sfui-tester@example.com", workflow_state: "SFUI Pending", ...o });

describe("workflowFromMeta (model/workflow.js:10-21)", () => {
  it("builds the definition and merges Workflow State styles", () => {
    expect(wf.workflow_state_field).toBe("workflow_state");
    expect(wf.states.find((s) => s.state === "SFUI Approved")?.style).toBe("Success");
    expect(wf.transitions).toHaveLength(3);
  });
  it("no __workflow_docs -> null", () => expect(workflowFromMeta({ name: "ToDo" })).toBeNull());
});

describe("W-02 self-approval (form/workflow.js:86-97; workflow.py:116,221)", () => {
  const t = (allow: 0 | 1) => ({ allow_self_approval: allow });
  it("the owner cannot use a transition without allow_self_approval", () => expect(hasApprovalAccess("sfui-tester@example.com", { owner: "sfui-tester@example.com" }, t(0))).toBe(false));
  it("another user can", () => expect(hasApprovalAccess("sfui-approver@example.com", { owner: "sfui-tester@example.com" }, t(0))).toBe(true));
  it("allow_self_approval lets the owner", () => expect(hasApprovalAccess("sfui-tester@example.com", { owner: "sfui-tester@example.com" }, t(1))).toBe(true));
  it("Administrator always can", () => expect(hasApprovalAccess("Administrator", { owner: "Administrator" }, t(0))).toBe(true));
  it("visibleTransitions keeps role-allowed transitions that pass approval access", () => {
    const ts = wf.transitions.filter((x) => x.state === "SFUI Pending");
    const asOwnerApprover = visibleTransitions(ts, { user: "sfui-approver@example.com", doc: doc({ owner: "sfui-approver@example.com" }), roles: ["SFUI Approver"] });
    expect(asOwnerApprover.map((x) => x.action)).toEqual(["Reject"]); // Approve has allow_self_approval 0
    const asOther = visibleTransitions(ts, { user: "sfui-approver@example.com", doc: doc(), roles: ["SFUI Approver"] });
    expect(asOther.map((x) => x.action)).toEqual(["Approve", "Reject"]);
    expect(visibleTransitions(ts, { user: "x@example.com", doc: doc(), roles: ["SFUI Reader"] })).toEqual([]);
  });
});

describe("M-07 workflow read-only (workflow.js:53)", () => {
  it("true when the user holds none of the state's allow_edit roles", () => expect(isReadOnlyState(wf, doc(), ["SFUI Tester"])).toBe(true));
  it("false when they do", () => expect(isReadOnlyState(wf, doc(), ["SFUI Approver"])).toBe(false));
  it("a new document is never read-only", () => expect(isReadOnlyState(wf, doc({ __islocal: 1 }), ["SFUI Reader"])).toBe(false));
  it("the state field and update_field stay locked (display-status rung 6)", () => expect(workflowLockedFields(wf)).toEqual(["workflow_state", "approval_notes"]));
});

describe("W-04 toolbar under a workflow (toolbar.js:593,668-699; workflow.py:154)", () => {
  it("no workflow: Submit and Cancel shown, Save always", () => expect(standardActionsUnderWorkflow(null, false)).toEqual({ showSubmit: true, saveOnlyWhenDirty: false, showCancel: true, hidePrimaryAndSecondary: false }));
  it("workflow: no Submit, Save only when dirty; actions replace the buttons when available", () => {
    expect(standardActionsUnderWorkflow(wf, true)).toEqual({ showSubmit: false, saveOnlyWhenDirty: true, showCancel: true, hidePrimaryAndSecondary: true });
    expect(standardActionsUnderWorkflow(wf, false).hidePrimaryAndSecondary).toBe(false);
  });
  it("can_cancel_document is false when a transition leads to a docstatus-2 state", () => {
    const cancelling = { ...wf, states: [...wf.states, { state: "SFUI Cancelled", doc_status: "2" }], transitions: [...wf.transitions, { state: "SFUI Approved", action: "Cancel", next_state: "SFUI Cancelled", allowed: "SFUI Approver" }] };
    expect(canCancelDocument(cancelling)).toBe(false);
    expect(canCancelDocument(wf)).toBe(true);
  });
});

describe("W-05 Workflow State style -> tone (indicator.js)", () => {
  it("maps styles", () => {
    expect(toneForStyle("Success")).toBe("success");
    expect(toneForStyle("Warning")).toBe("warning");
    expect(toneForStyle("Danger")).toBe("danger");
    expect(toneForStyle("Primary")).toBe("info");
    expect(toneForStyle(undefined)).toBe("neutral");
  });
});

// ---- timeline ----------------------------------------------------------------------------------------------------------

const labels: Record<string, string> = { title: "Title", status: "Status", priority: "Priority", qty: "Qty", items: "Items" };
const ctx = (over: Partial<TimelineContext> = {}): TimelineContext => ({
  user: "me@example.com", t: (k) => defaultMessages.en[k] as string,
  fieldLabel: (f, table) => (table ? (f === "qty" ? "Qty" : null) : labels[f] ?? null),
  ...over,
});
const version = (data: unknown): Pick<VersionInfo, "data" | "owner"> => ({ data: JSON.stringify(data), owner: "u@example.com" });

describe("H-02 version lines (version_timeline_content_builder.js:3-367)", () => {
  it("docstatus 1 -> 'submitted this document', 2 -> 'cancelled this document'", () => {
    expect(formatVersion(version({ changed: [["docstatus", 0, 1]] }), ctx(), "Ann")[0].summary).toBe("Ann submitted this document");
    expect(formatVersion(version({ changed: [["docstatus", 1, 2]] }), ctx(), "Ann")[0].summary).toBe("Ann cancelled this document");
  });
  it("a changed field line: '<label> from <old> to <new>', in one 'changed the value of' sentence", () => {
    const [l] = formatVersion(version({ changed: [["status", "Open", "Closed"]] }), ctx(), "Ann");
    expect(l.summary).toBe("Ann changed the value of Status from Open to Closed");
  });
  it("at most 3 parts are listed (builder.js:107)", () => {
    const [l] = formatVersion(version({ changed: [["title", "a", "b"], ["status", "c", "d"], ["priority", "e", "f"], ["qty", 1, 2]] }), ctx(), "Ann");
    expect(l.summary.match(/ from /g)).toHaveLength(3);
  });
  it("fields the user may not see are skipped (fieldLabel null)", () => {
    expect(formatVersion(version({ changed: [["secret", "a", "b"]] }), ctx(), "Ann")).toEqual([]);
  });
  it("values are stripped of HTML and truncated to 40 chars; empty shows \"\"", () => {
    expect(formatTimelineValue("<b>hi</b>")).toBe("hi");
    expect(formatTimelineValue("x".repeat(60))).toHaveLength(40);
    expect(formatTimelineValue("")).toBe('""');
  });
  it("row_changed shows the 1-based row (index + 1): 'in row #N'", () => {
    const [l] = formatVersion(version({ row_changed: [["items", 0, "r1", [["qty", 1, 2]]]] }), ctx(), "Ann");
    expect(l.summary).toContain("in row #1");
  });
  it("added rows are aggregated per table: 'added 2 rows to Items'", () => {
    const [l] = formatVersion(version({ added: [["items", { qty: 1 }], ["items", { qty: 2 }]] }), ctx(), "Ann");
    expect(l.summary).toBe("Ann added 2 rows to Items");
  });
  it("a comment in the version is the single line", () => expect(formatVersion(version({ comment: "imported" }), ctx(), "Ann")[0].summary).toBe("imported"));
  it("malformed data yields no lines instead of throwing", () => expect(formatVersion({ data: "{", owner: "u" }, ctx(), "Ann")).toEqual([]));
  it("comma_and: 'a, b and c' (utils.js:405-419)", () => {
    expect(commaAnd(["a"], "and")).toBe("a");
    expect(commaAnd(["a", "b"], "and")).toBe("a and b");
    expect(commaAnd(["a", "b", "c"], "and")).toBe("a, b and c");
  });
});

describe("H-01 timeline assembly (form_timeline.js:135-175)", () => {
  const d: FrappeDoc = { doctype: "ToDo", name: "t", owner: "me@example.com", creation: "2026-01-01 10:00:00", modified: "2026-01-02 10:00:00", modified_by: "u@example.com" };
  const info = (o: Partial<DocInfo>): DocInfo => ({
    attachments: [], communications: [], comments: [], versions: [], assignments: [], assignment_logs: [], shared: [], views: [], permissions: {}, user_info: {}, ...o,
  } as DocInfo);

  it("always has the created and last-edited lines", () => {
    const kinds = buildTimelineItems(d, info({}), ctx()).map((i) => i.kind);
    expect(kinds).toEqual(["created", "modified"]);
  });
  it("views appear only in 'all activity'; comments and communications always", () => {
    const di = info({ views: [{ name: "v1", owner: "u@example.com", creation: "2026-01-03 10:00:00" }], comments: [{ name: "c1", content: "hi", owner: "u@example.com", creation: "2026-01-03 11:00:00" }] });
    expect(buildTimelineItems(d, di, ctx({ activity: "all" })).some((i) => i.id === "view-v1")).toBe(true);
    const lean = buildTimelineItems(d, di, ctx({ activity: "communications" }));
    expect(lean.some((i) => i.id === "view-v1")).toBe(false);
    expect(lean.some((i) => i.id === "c1")).toBe(true);
  });
  it("share events are never shown (the share_logs key is never set by the server)", () => {
    const di = info({ shared: [{ user: "x" }], share_logs: [{ name: "s1", creation: "2026-01-03 10:00:00" }] } as Partial<DocInfo>);
    expect(buildTimelineItems(d, di, ctx()).some((i) => i.id.startsWith("share"))).toBe(false);
  });
  it("H-05 comment rights: edit = owner or Administrator; delete = (owner or System Manager) AND can delete Comment", () => {
    const di = info({ comments: [{ name: "c1", content: "x", owner: "me@example.com", creation: "2026-01-03 10:00:00" }, { name: "c2", content: "y", owner: "other@example.com", creation: "2026-01-03 11:00:00" }] });
    const by = (c: TimelineContext) => Object.fromEntries(buildTimelineItems(d, di, c).filter((i) => i.kind === "comment").map((i) => [i.id, [i.canEdit, i.canDelete]]));
    expect(by(ctx())).toEqual({ c1: [true, false], c2: [false, false] }); // owner without Comment delete right: no delete (comment.json)
    expect(by(ctx({ canDeleteComment: true }))).toEqual({ c1: [true, true], c2: [false, false] });
    expect(by(ctx({ canDeleteComment: true, isSystemManager: true }))).toEqual({ c1: [true, true], c2: [false, true] });
    expect(by(ctx({ user: "Administrator" })).c2[0]).toBe(true);
  });
});
