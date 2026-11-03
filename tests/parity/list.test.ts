/**
 * List request shapes and rules — docs/qa/parity-checklists.md L-01..L-06, L-11.
 * Native: public/js/frappe/list/base_list.js:460-478, list_view.js:34,375-486,658-684,1001-1032,1105-1121,
 * ui/sort_selector.js:198-208, ui/filters/filter_utils.js:459-504; desk/reportview.py:25-72; model/db_query.py:767-989.
 * Implementation under test (A2): src/frappe/{query.ts,list/reportview.ts,list/indicator.ts,list/tuples.ts}.
 */
import { describe, expect, it } from "vitest";
import { createFrappeClient } from "../../src/frappe/client";
import type { FrappeResponse } from "../../src/frappe/client";
import { conditionToFrappe, orderByWithTieBreak } from "../../src/frappe/query";
import { COUNT_UPPER_BOUND, decodeReportview, reportviewCount, reportviewGet } from "../../src/frappe/list/reportview";
import { getIndicator, guessColour, hasIndicator, toneOf } from "../../src/frappe/list/indicator";
import type { IndicatorConfig } from "../../src/frappe/list/indicator";

const recorder = (answer: (m: string) => FrappeResponse = () => ({ message: [] })) => {
  const calls: { method: string; args: Record<string, unknown> }[] = [];
  const client = createFrappeClient({ transport: async (method, args) => { calls.push({ method, args }); return answer(method); } });
  return { calls, client };
};
const cond = (field: string, operator: Parameters<typeof conditionToFrappe>[0]["operator"], value = "") => ({ id: "c", field, operator, value });

describe("L-03 sort and tie-break (sort_selector.js:198-208)", () => {
  it("name, creation, modified get no secondary sort", () => {
    for (const f of ["name", "creation", "modified"]) expect(orderByWithTieBreak(f, "desc")).toBe(`${f} desc`);
  });
  it("any other field is tie-broken by name in the same direction", () => {
    expect(orderByWithTieBreak("status", "asc")).toBe("status asc, name asc");
    expect(orderByWithTieBreak("status", "desc")).toBe("status desc, name desc");
  });
});

describe("L-02 count upper bound", () => {
  it("is 1001 like list_view.js:34", () => expect(COUNT_UPPER_BOUND).toBe(1001));
  it("reportview.get_count sends fields [], the limit, and distinct only when asked", async () => {
    const { calls, client } = recorder(() => ({ message: 1001 }));
    const r = await reportviewCount(client, "ToDo", { filters: [["status", "=", "Open"]], limit: COUNT_UPPER_BOUND });
    expect(calls[0].method).toBe("frappe.desk.reportview.get_count");
    expect(calls[0].args).toMatchObject({ doctype: "ToDo", filters: JSON.stringify([["status", "=", "Open"]]), fields: "[]", limit: 1001 });
    expect("distinct" in calls[0].args).toBe(false);
    expect(r).toEqual({ count: 1001, capped: true });
  });
  it("a count below the bound is exact", async () => {
    const { client } = recorder(() => ({ message: 7 }));
    expect(await reportviewCount(client, "ToDo", { limit: COUNT_UPPER_BOUND })).toEqual({ count: 7, capped: false });
  });
  it("distinct is sent for child-table filters (db.js:97-116)", async () => {
    const { calls, client } = recorder(() => ({ message: 3 }));
    await reportviewCount(client, "Contact", { distinct: true, limit: COUNT_UPPER_BOUND });
    expect(calls[0].args.distinct).toBe(true);
  });
});

describe("L-01 reportview.get request and response", () => {
  it("sends Desk's args: JSON-stringified fields/filters, view List, start/page_length, with_comment_count 1", async () => {
    const { calls, client } = recorder();
    await reportviewGet(client, "ToDo", { fields: ["name", "status"], filters: [["status", "=", "Open"]], order_by: "modified desc", limit_start: 40, limit_page_length: 20 });
    expect(calls[0].method).toBe("frappe.desk.reportview.get");
    expect(calls[0].args).toMatchObject({ doctype: "ToDo", fields: '["name","status"]', filters: '[["status","=","Open"]]', order_by: "modified desc", start: 40, page_length: 20, view: "List", with_comment_count: 1 });
  });
  it("disable_comment_count -> with_comment_count 0", async () => {
    const { calls, client } = recorder();
    await reportviewGet(client, "ToDo", { fields: ["name"], withCommentCount: false });
    expect(calls[0].args.with_comment_count).toBe(0);
  });
  it("decodes the compressed {keys, values, user_info} envelope (reportview.py:266-290)", () => {
    const r = decodeReportview({ message: { keys: ["name", "status"], values: [["a", "Open"], ["b", null]], user_info: { u: { fullname: "U" } } } });
    expect(r.rows).toEqual([{ name: "a", status: "Open" }, { name: "b", status: null }]);
    expect(r.userInfo.u.fullname).toBe("U");
  });
  it("no rows: the server returns an empty LIST (reportview.py:272-273), not an envelope", () => {
    expect(decodeReportview({ message: [] })).toEqual({ rows: [], userInfo: {} });
    expect(decodeReportview({})).toEqual({ rows: [], userInfo: {} });
  });
});

describe("L-04 filter serialization (filter_utils.js:459-504; data.py:1888-1975)", () => {
  it("equals/not equals/comparisons map to 3-tuples", () => {
    expect(conditionToFrappe(cond("status", "equals", "Open"))).toEqual(["status", "=", "Open"]);
    expect(conditionToFrappe(cond("qty", "gte", "5"), "Int")).toEqual(["qty", ">=", 5]);
  });
  it("like and not like are wrapped in % like the Desk filter", () => {
    expect(conditionToFrappe(cond("title", "like", "ab"))).toEqual(["title", "like", "%ab%"]);
    expect(conditionToFrappe(cond("title", "not_like", "ab"))).toEqual(["title", "not like", "%ab%"]);
  });
  it("in / not in send a list; numeric lists are coerced", () => {
    expect(conditionToFrappe(cond("status", "in", "Open, Closed"))).toEqual(["status", "in", ["Open", "Closed"]]);
    expect(conditionToFrappe(cond("qty", "not_in", "1,2"), "Int")).toEqual(["qty", "not in", [1, 2]]);
  });
  it("Check values are 1/0", () => {
    expect(conditionToFrappe(cond("enabled", "equals", "yes"), "Check")).toEqual(["enabled", "=", 1]);
    expect(conditionToFrappe(cond("enabled", "equals", "no"), "Check")).toEqual(["enabled", "=", 0]);
  });
  it("is set / is not set -> 'is', 'set' | 'not set'", () => {
    expect(conditionToFrappe(cond("email", "is_set"))).toEqual(["email", "is", "set"]);
    expect(conditionToFrappe(cond("email", "is_not_set"))).toEqual(["email", "is", "not set"]);
  });
  it("timespan is sent as-is and resolved by the server (data.py:734-820)", () => {
    expect(conditionToFrappe(cond("creation", "timespan", "last 7 days"))).toEqual(["creation", "timespan", "last 7 days"]);
  });
  it("Between on dates is a 2-element list; a half-built range degrades to >= / <=", () => {
    expect(conditionToFrappe(cond("date", "between", "2026-01-01,2026-01-31"), "Date")).toEqual(["date", "between", ["2026-01-01", "2026-01-31"]]);
  });
  it("Datetime equals on a date -> a between over that whole day; > starts after 23:59:59.999999 (db_query.py between bounds)", () => {
    expect(conditionToFrappe(cond("creation", "equals", "2026-01-02"), "Datetime")).toEqual(["creation", "between", ["2026-01-02", "2026-01-02"]]);
    expect(conditionToFrappe(cond("creation", "gt", "2026-01-02"), "Datetime")).toEqual(["creation", ">", "2026-01-02 23:59:59.999999"]);
  });
  it("half-built conditions are dropped", () => expect(conditionToFrappe(cond("title", "like", ""))).toBeNull());
});

describe("L-06 indicator precedence (indicator.js:26-122; list_view.js:1105-1121)", () => {
  const base: IndicatorConfig = {
    isSubmittable: true, hasField: () => false,
    words: { draft: "Draft", cancelled: "Cancelled", submitted: "Submitted", enabled: "Enabled", disabled: "Disabled" },
  };
  it("workflow state first, coloured by the Workflow State style", () => {
    const i = getIndicator({ docstatus: 0, workflow_state: "Approved" }, { ...base, workflow: { stateField: "workflow_state", styles: { Approved: "Success" } } });
    expect(i).toMatchObject({ label: "Approved", color: "green", tone: "success", filter: ["workflow_state", "Approved"] });
  });
  it("override_status makes the docstatus win over the workflow state", () => {
    const i = getIndicator({ docstatus: 0, workflow_state: "Approved" }, { ...base, workflow: { stateField: "workflow_state", overrideStatus: true } });
    expect(i?.label).toBe("Draft");
  });
  it("avoid_status_override hides the workflow state for that state", () => {
    const i = getIndicator({ docstatus: 0, workflow_state: "Draft" }, { ...base, workflow: { stateField: "workflow_state", avoidStatusOverride: ["Draft"] } });
    expect(i?.label).toBe("Draft");
  });
  it("submittable: draft red, cancelled red, submitted blue", () => {
    expect(getIndicator({ docstatus: 0 }, base)).toMatchObject({ label: "Draft", color: "red" });
    expect(getIndicator({ docstatus: 2 }, base)).toMatchObject({ label: "Cancelled", color: "red" });
    expect(getIndicator({ docstatus: 1 }, base)).toMatchObject({ label: "Submitted", color: "blue" });
  });
  it("meta.states beats the status guess; status is guessed otherwise", () => {
    const c = { ...base, isSubmittable: false, states: [{ title: "Open", color: "Blue" }] };
    expect(getIndicator({ status: "Open" }, c)?.color).toBe("blue");
    expect(getIndicator({ status: "Closed" }, { ...base, isSubmittable: false })?.color).toBe("green");
  });
  it("enabled / disabled fallbacks", () => {
    expect(getIndicator({ enabled: 0 }, { ...base, isSubmittable: false, hasField: (f) => f === "enabled" })?.label).toBe("Disabled");
    expect(getIndicator({ disabled: 1 }, { ...base, isSubmittable: false, hasField: (f) => f === "disabled" })?.label).toBe("Disabled");
  });
  it("guess_colour substring rules", () => {
    expect(guessColour("Pending")).toBe("orange");
    expect(guessColour("Open")).toBe("red");
    expect(guessColour("Completed")).toBe("green");
    expect(guessColour("Submitted")).toBe("blue");
    expect(guessColour("whatever")).toBe("gray");
  });
  it("Status column only exists when the DocType has an indicator (indicator.js:3-24)", () => {
    expect(hasIndicator({ isSubmittable: false, hasField: () => false })).toBe(false);
    expect(hasIndicator({ isSubmittable: true, hasField: () => false })).toBe(true);
    expect(hasIndicator({ isSubmittable: false, hasField: (f) => f === "status" })).toBe(false); // status alone needs meta.states
    expect(hasIndicator({ isSubmittable: false, hasField: (f) => f === "status", states: [{ title: "Open" }] })).toBe(true);
  });
  it("tones", () => {
    expect(toneOf("green")).toBe("success");
    expect(toneOf("red")).toBe("destructive");
    expect(toneOf("orange")).toBe("warning");
    expect(toneOf("gray")).toBe("muted");
  });
});
