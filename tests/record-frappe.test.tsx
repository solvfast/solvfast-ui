/** Frappe record logic (src/frappe/record): workflow, indicator, version diff, docinfo → timeline. Recorded-shape fixtures; NOT verified against a real site. */
import { describe, expect, it } from "vitest";
import { defaultMessages } from "../src/theme/messages";
import {
  workflowFromMeta, visibleTransitions, isReadOnlyState, canCancelDocument, standardActionsUnderWorkflow, currentState, lifecycleStates, workflowLockedFields,
} from "../src/frappe/record/workflow";
import { indicatorFor, guessTone } from "../src/frappe/record/indicator";
import { buildTimelineItems, formatVersion, parseFrappeTime, formatTimelineValue, commaAnd, type TimelineContext } from "../src/frappe/record/timeline";
import type { DocInfo, FrappeDoc } from "../src/frappe/contract";

const en = defaultMessages.en;
const ar = defaultMessages.ar;
const wfDocs = [
  { doctype: "Workflow", name: "Deal Flow", document_type: "Deal", workflow_state_field: "workflow_state", override_status: 0,
    states: [
      { state: "Draft", doc_status: "0", allow_edit: "Sales User" },
      { state: "Approved", doc_status: "1", allow_edit: "Sales Manager", update_field: "phase", update_value: "Closed" },
      { state: "Rejected", doc_status: "2", allow_edit: "Sales Manager", avoid_status_override: 0 },
    ],
    transitions: [
      { state: "Draft", action: "Approve", next_state: "Approved", allowed: "Sales Manager", allow_self_approval: 0 },
      { state: "Draft", action: "Reject", next_state: "Rejected", allowed: "Sales Manager", allow_self_approval: 1 },
    ] },
  { doctype: "Workflow State", name: "Draft", style: "" }, { doctype: "Workflow State", name: "Approved", style: "Success" }, { doctype: "Workflow State", name: "Rejected", style: "Danger" },
];
const wf = workflowFromMeta({ name: "Deal", __workflow_docs: wfDocs })!;

describe("workflow", () => {
  it("builds the definition from __workflow_docs, merging Workflow State style", () => {
    expect(wf.workflow_state_field).toBe("workflow_state");
    expect(wf.states.map((s) => s.style)).toEqual([undefined, "Success", "Danger"]);
    expect(workflowFromMeta({ name: "X" })).toBeNull();
    expect(workflowLockedFields(wf)).toEqual(["workflow_state", "phase"]);
  });
  it("self-approval: owner cannot apply unless allowed; Administrator always can", () => {
    const doc: FrappeDoc = { doctype: "Deal", name: "D1", owner: "a@x", workflow_state: "Draft" };
    const ts = wf.transitions;
    expect(visibleTransitions(ts, { user: "a@x", doc }).map((t) => t.action)).toEqual(["Reject"]);
    expect(visibleTransitions(ts, { user: "b@x", doc }).map((t) => t.action)).toEqual(["Approve", "Reject"]);
    expect(visibleTransitions(ts, { user: "Administrator", doc: { ...doc, owner: "Administrator" } })).toHaveLength(2);
    expect(visibleTransitions(ts, { user: "b@x", doc, roles: ["Sales User"] })).toHaveLength(0);
  });
  it("read-only state follows allow_edit roles; new docs are never read-only", () => {
    const doc: FrappeDoc = { doctype: "Deal", name: "D1", workflow_state: "Draft", docstatus: 0 };
    expect(isReadOnlyState(wf, doc, ["Sales User"])).toBe(false);
    expect(isReadOnlyState(wf, doc, ["Sales Manager"])).toBe(true);
    expect(isReadOnlyState(wf, { ...doc, __islocal: 1 }, ["Sales Manager"])).toBe(false);
    expect(currentState(wf, { doctype: "Deal", name: "n", docstatus: 1 })).toBe("Approved");
  });
  it("Submit/Cancel replacement: cancel hidden when a transition leads to docstatus 2", () => {
    expect(canCancelDocument(wf)).toBe(false);
    expect(standardActionsUnderWorkflow(wf, true)).toEqual({ showSubmit: false, saveOnlyWhenDirty: true, showCancel: false, hidePrimaryAndSecondary: true });
    expect(standardActionsUnderWorkflow(null, false).showSubmit).toBe(true);
    expect(lifecycleStates(wf).map((s) => s.tone)).toEqual(["neutral", "success", "danger"]);
  });
});

describe("indicator precedence", () => {
  const meta = { is_submittable: 1 as const, fields: [{ fieldname: "status" }] };
  it("follows indicator.js order", () => {
    expect(indicatorFor({ doc: { doctype: "D", name: "1", __unsaved: 1 }, meta })?.builtin).toBe("notSaved");
    expect(indicatorFor({ doc: { doctype: "D", name: "1", workflow_state: "Approved" }, meta, workflow: wf })).toMatchObject({ label: "Approved", tone: "success", source: "workflow" });
    expect(indicatorFor({ doc: { doctype: "D", name: "1", workflow_state: "Approved", docstatus: 1 }, meta, workflow: { ...wf, override_status: 1 } })?.builtin).toBe("submitted");
    expect(indicatorFor({ doc: { doctype: "D", name: "1", docstatus: 0 }, meta })).toMatchObject({ builtin: "draft", tone: "danger" });
    expect(indicatorFor({ doc: { doctype: "D", name: "1", docstatus: 2 }, meta })?.builtin).toBe("cancelled");
    expect(indicatorFor({ doc: { doctype: "D", name: "1", docstatus: 1, status: "Paid" }, meta: { ...meta, states: [{ title: "Paid", color: "Green" }] } })).toMatchObject({ source: "meta.states", tone: "success" });
    const plain = { is_submittable: 0 as const, fields: [{ fieldname: "status" }] };
    expect(indicatorFor({ doc: { doctype: "D", name: "1", status: "Pending Review" }, meta: plain })?.tone).toBe("warning");
    expect(indicatorFor({ doc: { doctype: "D", name: "1" }, meta: { is_submittable: 0, fields: [{ fieldname: "disabled" }] } })?.builtin).toBe("enabled");
    expect(indicatorFor({ doc: { doctype: "D", name: "1" }, meta: plain })).toBeNull();
    expect(guessTone("Rejected")).toBe("danger");
  });
  it("avoid_status_override lets the document status through", () => {
    const w = { ...wf, states: wf.states.map((s) => (s.state === "Approved" ? { ...s, avoid_status_override: 1 as const } : s)) };
    expect(indicatorFor({ doc: { doctype: "D", name: "1", workflow_state: "Approved", docstatus: 1 }, meta: { is_submittable: 1, fields: [] }, workflow: w })?.builtin).toBe("submitted");
  });
});

const ctx = (over: Partial<TimelineContext> = {}): TimelineContext => ({
  user: "me@x", t: (k) => en[k] as string, isSystemManager: false, canDeleteComment: true,
  fieldLabel: (f) => ({ title: "Title", amount: "Amount", hidden_f: null, items: "Items", qty: "Qty" } as Record<string, string | null>)[f] ?? null, ...over,
});

describe("version diff (get_diff shape)", () => {
  const v = (data: unknown) => ({ owner: "bob@x", data: JSON.stringify(data) });
  it("caps the summary at 3 parts, truncates to 40 chars, skips fields the user cannot see", () => {
    const long = "x".repeat(60);
    const lines = formatVersion(v({ changed: [["title", "a", long], ["hidden_f", 1, 2], ["amount", "1", "2"], ["title", "c", "d"], ["amount", "e", "f"], ["name", "n", "m"]] }), ctx(), "Bob");
    expect(lines).toHaveLength(1);
    expect(lines[0].summary).toBe(`Bob changed the value of Title from a to ${"x".repeat(37)}..., Amount from 1 to 2, Title from c to d`);
    expect(lines[0].changes!.length).toBe(4);
  });
  it("docstatus 1 / 2 → submitted / cancelled lines", () => {
    expect(formatVersion(v({ changed: [["docstatus", 0, 1]] }), ctx(), "Bob")[0]).toMatchObject({ summary: "Bob submitted this document", kind: "state" });
    expect(formatVersion(v({ changed: [["docstatus", 1, 2]] }), ctx(), "Bob")[0].summary).toBe("Bob cancelled this document");
  });
  it("child rows: row_changed (1-based row), added and removed aggregated per table", () => {
    const lines = formatVersion(v({ row_changed: [["items", 1, "r2", [["qty", 1, 5]]]], added: [["items", { name: "a" }], ["items", { name: "b" }]], removed: [["items", { name: "c" }]] }), ctx(), "Bob");
    expect(lines[0].summary).toBe("Bob changed the values for Qty from 1 to 5 in row #2");
    expect(lines[0].changes).toEqual([{ label: "Qty", before: "1", after: "5", row: 1 }]);
    expect(lines[1].summary).toBe("Bob added 2 rows to Items");
    expect(lines[2].summary).toBe("Bob removed 1 row from Items");
  });
  it("tolerates bad JSON and empty values; comment shortcut", () => {
    expect(formatVersion({ owner: "b", data: "{" }, ctx(), "B")).toEqual([]);
    expect(formatTimelineValue("<b></b>")).toBe('""');
    expect(formatVersion(v({ comment: "Imported" }), ctx(), "B")[0].summary).toBe("Imported");
    expect(commaAnd(["a", "b", "c"], "and")).toBe("a, b and c");
  });
  it("Arabic catalogue has every key the formatter uses", () => {
    const lines = formatVersion(v({ changed: [["title", "a", "b"]] }), ctx({ t: (k) => ar[k] as string }), "بوب");
    expect(lines[0].summary).toBe("غيّر بوب قيمة Title من a إلى b");
  });
});

describe("docinfo → timeline items", () => {
  const doc: FrappeDoc = { doctype: "Deal", name: "D1", owner: "me@x", creation: "2026-11-01 10:00:00.123456", modified: "2026-11-02 10:00:00", modified_by: "bob@x" };
  const info = {
    attachments: [], communications: [{ name: "C1", subject: "Hi", sender: "z@x", communication_date: "2026-11-02 09:00:00" }], shared: [], views: [], assignments: [], permissions: {},
    comments: [{ name: "K1", content: "<p>yo</p>", owner: "me@x", creation: "2026-11-02 11:00:00" }, { name: "K2", content: "x", owner: "bob@x", creation: "2026-11-02 12:00:00" }],
    versions: [{ name: "V1", owner: "bob@x", creation: "2026-11-02 10:00:00", data: JSON.stringify({ changed: [["title", "a", "b"]] }) }],
    assignment_logs: [{ name: "A1", owner: "bob@x", creation: "2026-11-02 13:00:00", content: "<div>assigned to Ann</div>" }],
    attachment_logs: [{ name: "F1", owner: "me@x", creation: "2026-11-02 14:00:00", content: "a.pdf", comment_type: "Attachment" }],
    workflow_logs: [{ name: "W1", owner: "bob@x", creation: "2026-11-02 15:00:00", content: "changed workflow state" }],
    share_logs: [{ name: "S1", owner: "bob@x", creation: "2026-11-02 16:00:00", content: "shared" }],
    assignment_logs_unused: [], user_info: { "bob@x": { fullname: "Bob Ray" } },
  } as unknown as DocInfo;
  it("maps each docinfo key to a kind; ignores share_logs; names the current user You", () => {
    const items = buildTimelineItems(doc, info, ctx());
    const kinds = Object.fromEntries(items.map((i) => [i.id, i.kind]));
    expect(kinds).toMatchObject({ created: "created", modified: "modified", "communication-C1": "communication", K1: "comment", "version-V1-0": "change", "assignment-A1": "assignment", "attachment-F1": "attachment", "workflow-W1": "state" });
    expect(items.some((i) => i.id.includes("S1"))).toBe(false);
    expect(items.find((i) => i.id === "created")!.summary).toBe("You created this");
    expect(items.find((i) => i.id === "modified")!.summary).toBe("Bob Ray last edited this");
    expect(items.find((i) => i.id === "attachment-F1")!.summary).toBe("You attached a.pdf");
    expect(items.find((i) => i.id === "assignment-A1")!.summary).toBe("assigned to Ann");
  });
  it("comment rights: edit = owner or Administrator; delete = (owner or System Manager) AND can delete Comment", () => {
    const get = (c: Partial<TimelineContext>, user = "me@x") => Object.fromEntries(buildTimelineItems(doc, info, ctx({ user, ...c })).filter((i) => i.kind === "comment").map((i) => [i.id, [i.canEdit, i.canDelete]]));
    expect(get({})).toEqual({ K1: [true, true], K2: [false, false] });
    expect(get({ canDeleteComment: false })).toEqual({ K1: [true, false], K2: [false, false] });
    expect(get({ isSystemManager: true })).toEqual({ K1: [true, true], K2: [false, true] });
    expect(get({ isSystemManager: true }, "Administrator").K2).toEqual([true, true]);
  });
  it("communications-only mode keeps comments, communications and created/modified", () => {
    const ids = buildTimelineItems(doc, info, ctx({ activity: "communications" })).map((i) => i.id).sort();
    expect(ids).toEqual(["K1", "K2", "communication-C1", "created", "modified"]);
  });
  it("parses Frappe datetimes", () => {
    expect(parseFrappeTime("2026-11-01 10:00:00.123456")).toBe(new Date("2026-11-01T10:00:00.123").getTime());
    expect(parseFrappeTime(undefined)).toBe(0);
  });
});

import { stateEntries } from "../src/frappe/record/stateHistory";
describe("stateEntries (stepper actor and time)", () => {
  const doc: FrappeDoc = { doctype: "Deal", name: "D1", owner: "own@x", creation: "2026-11-01 10:00:00" };
  const base = { attachments: [], communications: [], comments: [], shared: [], views: [], assignments: [], permissions: {}, user_info: { "bob@x": { fullname: "Bob Ray" }, "own@x": { fullname: "Olive" } } };
  it("uses workflow_logs (latest per state) and falls back to versions of the state field; creation state goes to the owner", () => {
    const info = { ...base,
      workflow_logs: [{ owner: "bob@x", creation: "2026-11-02 10:00:00", content: "Pending" }, { owner: "bob@x", creation: "2026-11-03 10:00:00", content: "Pending" }],
      versions: [{ name: "V", owner: "own@x", creation: "2026-11-01 12:00:00", data: JSON.stringify({ changed: [["workflow_state", "Draft", "Review"]] }) }],
    } as unknown as DocInfo;
    const m = stateEntries({ doc, docinfo: info, stateField: "workflow_state", states: ["Draft", "Review", "Pending", "Done"] });
    expect(m.get("Pending")).toEqual({ by: "Bob Ray", at: parseFrappeTime("2026-11-03 10:00:00") });
    expect(m.get("Review")?.by).toBe("Olive");
    expect(m.get("Draft")).toEqual({ by: "Olive", at: parseFrappeTime("2026-11-01 10:00:00") });
    expect(m.has("Done")).toBe(false);
  });
  it("matches the server-translated log content", () => {
    const info = { ...base, workflow_logs: [{ owner: "bob@x", creation: "2026-11-02 10:00:00", content: "قيد المراجعة" }], versions: [] } as unknown as DocInfo;
    expect(stateEntries({ doc, docinfo: info, stateField: "f", states: ["Review"], translate: (s) => (s === "Review" ? "قيد المراجعة" : s) }).get("Review")?.by).toBe("Bob Ray");
  });
});

describe("R2-V8 bidi isolation of interpolated tokens in Arabic version lines", () => {
  const v = { owner: "bob@x", data: JSON.stringify({ changed: [["title", "Old value", "New value"]] }) };
  const arCtx = (isolate: boolean): TimelineContext => ({ ...ctx({ t: (k) => ar[k] as string }), isolate });
  it("wraps the actor, field label and values in first-strong isolates when isolate is set, and not otherwise", () => {
    const plain = formatVersion(v, arCtx(false), "Bob Ray")[0].summary;
    const iso = formatVersion(v, arCtx(true), "Bob Ray")[0].summary;
    expect(plain).not.toMatch(/[⁨⁩]/);
    expect(iso).toContain("⁨Bob Ray⁩");
    expect(iso).toContain("⁨Title⁩");
    expect(iso).toContain("⁨Old value⁩");
    expect(iso.replace(/[⁨⁩]/g, "")).toBe(plain);
  });
});

import { namesForIds, looksRaw } from "../src/frappe/record/timeline";
describe("assignment names and version value display", () => {
  it("replaces user ids in an assignment text with full names, leaving names and unknown ids alone", () => {
    const ui = { "Administrator": { fullname: "Admin User" }, "sara@rihlat.travel": { fullname: "Sara Nasr" } };
    expect(namesForIds("Administrator assigned sara@rihlat.travel: call", ui)).toBe("Admin User assigned Sara Nasr: call");
    expect(namesForIds("Sara Nasr removed their assignment.", ui)).toBe("Sara Nasr removed their assignment.");
    expect(namesForIds("x@y.com assigned z", ui)).toBe("x@y.com assigned z");
    expect(namesForIds("not-Administrator-ish", ui)).toBe("not-Administrator-ish");
  });
  it("looksRaw tells database values from server-formatted strings", () => {
    for (const v of [111000, "111000", "12.5", "2026-11-01", "2026-11-01 10:00:00.123456"]) expect(looksRaw(v), String(v)).toBe(true);
    for (const v of ["₹ 111,000.00", "111,000.00", "01-11-2026", "Open", ""]) expect(looksRaw(v), String(v)).toBe(false);
  });
  it("formats raw values through ctx.formatValue only; server-formatted ones stay as stored", () => {
    const c = ctx({ formatValue: (_f, v) => `<${String(v)}>` });
    const mk = (a: unknown, b: unknown) => ({ owner: "bob@x", data: JSON.stringify({ changed: [["amount", a, b]], row_changed: [["items", 0, "r1", [["qty", 1, 2]]]] }) });
    const lines = formatVersion(mk(111000, "₹ 222,000.00"), c, "Bob");
    expect(lines[0].summary).toContain("Amount from <111000> to ₹ 222,000.00");
    expect(lines[1].summary).toContain("Qty from <1> to <2> in row #1");
  });
});
