/**
 * Form behaviour engine (src/frappe/form/model) — pure TypeScript, run over the REAL 15.110 metadata fixtures
 * (tests/fixtures/real-15.110). Semantics pinned to docs `11` / `12`. Nothing here ran against a site: Simulated &
 * tested only.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { DocTypeMeta, FrappeDoc, MetaBundle } from "../src/frappe/contract";
import {
  analyzeDependencies, buildFetchMap, buildLayout, checkMandatory, compileExpression, controlStatus, createDocStore,
  evaluateDepends, exprHelper, fetchUpdates, formActions, isReadOnlyByFetch, ladderStatus, newDoc, resolveFields, rowRanges,
  sectionCollapsed, sectionFields, type DependsIssue,
} from "../src/frappe/form/model";

const FIX = path.join(__dirname, "fixtures/real-15.110");
export function loadBundle(file: string): MetaBundle {
  const docs = (JSON.parse(fs.readFileSync(path.join(FIX, file), "utf8")) as { docs: DocTypeMeta[] }).docs;
  return { doctype: docs[0].name, meta: docs[0], children: Object.fromEntries(docs.slice(1).map((d) => [d.name, d])) };
}
const ALL = fs.readdirSync(FIX).filter((f) => f.endsWith(".json")).map(loadBundle);
const todo = loadBundle("todo.en.json");
const contact = loadBundle("contact.en.json");
const event = loadBundle("event.en.json");
const user = loadBundle("user.en.json");
const customer = loadBundle("customer.en.json");
const fieldOf = (b: MetaBundle, name: string, doctype = b.doctype) => (doctype === b.doctype ? b.meta : b.children[doctype]).fields.find((f) => f.fieldname === name)!;
const doc = (b: MetaBundle, v: Record<string, unknown> = {}): FrappeDoc => ({ doctype: b.doctype, name: "D-1", docstatus: 0, ...v });

describe("expression interpreter (D-23)", () => {
  it("supports every dependency expression in the real 15.110 fixtures (en + ar)", () => {
    const issues = ALL.flatMap((b) => analyzeDependencies(b));
    expect(issues).toEqual([]);
    const count = ALL.flatMap((b) => [b.meta, ...Object.values(b.children)]).flatMap((m) => m.fields)
      .filter((f) => ["depends_on", "mandatory_depends_on", "read_only_depends_on", "collapsible_depends_on"].some((k) => typeof f[k] === "string" && (f[k] as string).startsWith("eval:"))).length;
    expect(count).toBeGreaterThan(30);
  });
  it("evaluates with JavaScript semantics: loose ==, &&/||, member access, in_list, cint", () => {
    const run = (e: string, d: Record<string, unknown>) => { const c = compileExpression(e); if (!c.ok) throw new Error(c.reason); return c.run({ ...d }); };
    const H = { in_list: exprHelper((l: unknown[], v: unknown) => l.includes(v)), cint: exprHelper((v: unknown) => parseInt(String(v), 10) || 0) };
    expect(run("doc.document_follow_notify== 1", { doc: { document_follow_notify: "1" } })).toBe(true);
    expect(run('doc.repeat_this_event && doc.repeat_on==="Weekly"', { doc: { repeat_this_event: 1, repeat_on: "Weekly" } })).toBe(true);
    expect(run("doc.restrict_ip && doc.restrict_ip.length", { doc: { restrict_ip: "" } })).toBe("");
    expect(run("in_list(['System User', 'Website User'], doc.user_type) && doc.enabled == 1", { ...H, doc: { user_type: "System User", enabled: 1 } })).toBe(true);
    expect(run("doc.enabled && (!doc.__islocal || !cint(doc.send_welcome_email))", { ...H, doc: { enabled: 1, __islocal: 1, send_welcome_email: "0" } })).toBe(true);
    expect(run("doc.a ? 'x' : 'y'", { doc: { a: 0 } })).toBe("y");
    expect(run("doc.items.length > 1 && parent.status !== 'Closed'", { doc: { items: [1, 2] }, parent: { status: "Open" } })).toBe(true);
    expect(run("['A','B'].includes(doc.s) && doc.s.toLowerCase() == 'a'", { doc: { s: "A" } })).toBe(true);
    expect(run("doc.x?.y ?? 'none'", { doc: {} })).toBe("none");
    expect(run("null == undefined && 0 == '' && '1' != 2", { doc: {} })).toBe(true);
  });
  it("reports what it cannot do instead of guessing (assignment, unknown globals, arbitrary calls)", () => {
    for (const e of ["doc.a = 1", "frappe.user.has_role('X')", "window.location", "doc.f()", "(function(){})()", "doc.a; doc.b", "`${doc.a}`", "new Date()", "doc.constructor"]) {
      const c = compileExpression(e);
      if (c.ok) expect(() => c.run({ doc: { f: () => 1 }, parent: {} })).toThrow(); else expect(c.reason).toBeTruthy();
    }
    expect(compileExpression("frappe.user.has_role('X')")).toMatchObject({ ok: false, reason: expect.stringMatching(/"frappe" is not available/) });
  });
  it("Desk's new Function evaluation is an explicit opt-in", () => {
    const c = compileExpression("doc.items.filter(r => r.qty > 1).length", "function");
    expect(c.ok && c.run({ doc: { items: [{ qty: 2 }, { qty: 1 }] }, parent: {} })).toBe(1);
    expect(compileExpression("doc.items.filter(r => r.qty > 1).length").ok).toBe(false);
  });
});

describe("depends_on / mandatory_depends_on / read_only_depends_on (docs 11 §2.4)", () => {
  it("fieldname truthiness, eval with doc/parent, arrays by length; fn: needs a handler", () => {
    const d = doc(event, { repeat_this_event: 1, repeat_on: "Weekly" });
    expect(evaluateDepends("repeat_this_event", d, d)).toBe(1);
    expect(evaluateDepends("eval:doc.repeat_this_event && doc.repeat_on===\"Weekly\"", d, d)).toBe(true);
    const issues: DependsIssue[] = [];
    expect(evaluateDepends("fn:check", d, d, { onIssue: (i) => issues.push(i) })).toBe(true);
    expect(issues[0]).toMatchObject({ kind: "unsupported" });
    expect(evaluateDepends("fn:check", d, d, { fnHandlers: { check: () => false } })).toBe(false);
    const eff = resolveFields(event.meta.fields, d, d);
    expect(eff.get("monday")!.hidden_due_to_dependency).toBe(false);
    const eff2 = resolveFields(event.meta.fields, { ...d, repeat_on: "Daily" }, d);
    expect(eff2.get("monday")!.hidden_due_to_dependency).toBe(true);
    expect(eff2.get("repeat_till")!.hidden_due_to_dependency).toBe(false);
    const issues2: DependsIssue[] = [];
    const eff3 = resolveFields([{ fieldname: "x", fieldtype: "Data", depends_on: "eval:doc.missing.length" }], d, d, { onIssue: (i) => issues2.push(i) });
    expect(eff3.get("x")!.hidden_due_to_dependency).toBe(true);
    expect(issues2[0]).toMatchObject({ kind: "invalid", fieldname: "x" });
  });
  it("a dependency-derived reqd REPLACES the static reqd; read_only_depends_on sets read_only", () => {
    const fields = [
      { fieldname: "a", fieldtype: "Data", reqd: 1 as const, mandatory_depends_on: "eval:doc.kind == 'X'" },
      { fieldname: "b", fieldtype: "Data", read_only_depends_on: "locked" },
    ];
    const off = resolveFields(fields, doc(todo, { kind: "Y", locked: 0 }), doc(todo));
    expect(off.get("a")!.reqd).toBe(0);
    expect(off.get("b")!.read_only).toBe(0);
    const on = resolveFields(fields, doc(todo, { kind: "X", locked: 1 }), doc(todo));
    expect(on.get("a")!.reqd).toBe(1);
    expect(on.get("b")!.read_only).toBe(1);
  });
  it("child rows evaluate with doc = row and parent = the form's document", () => {
    const parent = doc(todo, { status: "Closed" });
    const fields = [{ fieldname: "qty", fieldtype: "Int", depends_on: "eval:doc.item && parent.status != 'Closed'" }];
    expect(resolveFields(fields, { doctype: "Row", name: "r1", item: "X" }, parent).get("qty")!.hidden_due_to_dependency).toBe(true);
    expect(resolveFields(fields, { doctype: "Row", name: "r1", item: "X" }, { ...parent, status: "Open" }).get("qty")!.hidden_due_to_dependency).toBe(false);
  });
  it("collapsible sections: closed by default, collapsible_depends_on, forced open by a missing required field", () => {
    const sec = fieldOf(customer, "internal_customer_section");
    expect(sectionCollapsed(sec, [], doc(customer, { is_internal_customer: 0 }))).toBe(true);
    expect(sectionCollapsed(sec, [], doc(customer, { is_internal_customer: 1 }))).toBe(false);
    const plain = { fieldname: "s", fieldtype: "Section Break", collapsible: 1 as const };
    expect(sectionCollapsed(plain, [{ fieldname: "x", fieldtype: "Data" }], doc(todo))).toBe(true);
    expect(sectionCollapsed(plain, [{ fieldname: "x", fieldtype: "Data", reqd: 1 }], doc(todo))).toBe(false);
    expect(sectionCollapsed({ ...plain, collapsible: 0 }, [], doc(todo))).toBeNull();
  });
});

describe("docStore (docs 11 §1.4, §4.1; 12 §5.3)", () => {
  it("set_value: no-op on equal values, Link re-triggers, dirty flag, listeners in order", () => {
    const s = createDocStore(todo, doc(todo, { status: "Open", allocated_to: "a@x.com" }));
    const changes: string[] = [];
    s.onFieldChange((c) => changes.push(`${c.fieldname}${c.unchanged ? "=" : ":"}${String(c.value)}`));
    expect(s.setValue("status", "Open")).toBe(false);
    expect(s.isDirty()).toBe(false);
    s.setValue("allocated_to", "a@x.com");
    expect(changes).toEqual(["allocated_to=a@x.com"]);
    const before = s.getDoc();
    expect(s.setValue("status", "Closed")).toBe(true);
    expect(s.getDoc()).not.toBe(before);
    expect(s.getDoc()).toMatchObject({ status: "Closed", __unsaved: 1 });
    expect(changes.at(-1)).toBe("status:Closed");
  });
  it("new rows carry __islocal, a new-<slug>-<10> name, parent fields, defaults; idx stays contiguous", () => {
    const s = createDocStore(contact, doc(contact, { email_ids: [] }), { user: "u@x.com" });
    const r1 = s.addRow("email_ids", { values: { email_id: "a@x.com" } });
    const r2 = s.addRow("email_ids");
    const r0 = s.addRow("email_ids", { index: 0, unedited: true });
    expect(r1).toMatchObject({ doctype: "Contact Email", __islocal: 1, __unsaved: 1, parent: "D-1", parenttype: "Contact", parentfield: "email_ids", owner: "u@x.com", is_primary: 0 });
    expect(r1.name).toMatch(/^new-contact-email-[a-z0-9]{10}$/);
    expect(r0.__unedited).toBe(true);
    expect(s.getRows("email_ids").map((r) => [r.name, r.idx])).toEqual([[r0.name, 1], [r1.name, 2], [r2.name, 3]]);
    s.setValue("email_id", "b@x.com", { parentfield: "email_ids", name: r0.name });
    expect(s.getRows("email_ids")[0].__unedited).toBeUndefined();
    const dup = s.duplicateRow("email_ids", 1);
    expect(dup).toMatchObject({ email_id: "a@x.com", idx: 3, __islocal: 1 });
    expect(dup.name).not.toBe(r1.name);
    s.moveRow("email_ids", 3, 0);
    expect(s.getRows("email_ids").map((r) => r.idx)).toEqual([1, 2, 3, 4]);
    expect(s.getRows("email_ids")[0].name).toBe(r2.name);
    s.deleteRows("email_ids", [0, 2]);
    expect(s.getRows("email_ids").map((r) => [r.email_id ?? null, r.idx])).toEqual([["b@x.com", 1], ["a@x.com", 2]]);
    expect(s.isDirty()).toBe(true);
  });
  it("existing rows keep their server names; replace() drops __unsaved / __islocal like Desk's sync", () => {
    const s = createDocStore(contact, doc(contact, { email_ids: [{ doctype: "Contact Email", name: "abc123", idx: 1, email_id: "x@y.z" }] }));
    s.addRow("email_ids");
    expect(s.getRows("email_ids")[0]).toMatchObject({ name: "abc123", idx: 1 });
    expect(s.getRows("email_ids")[0].__islocal).toBeUndefined();
    s.replace({ doctype: "Contact", name: "C-1", modified: "2026-11-03 10:00:00", email_ids: [] });
    expect(s.isDirty()).toBe(false);
    expect(s.getDoc().name).toBe("C-1");
  });
  it("rejects a non-table field for row operations", () => {
    const s = createDocStore(contact, doc(contact));
    expect(() => s.addRow("first_name")).toThrow(/not a table field/);
  });
});

describe("defaults for new documents (docs 11 §4.4)", () => {
  it("applies df.default keywords, Select first option, casts, and route options", () => {
    const now = new Date(2026, 10, 3, 9, 5, 7);
    const d = newDoc(todo, { user: "u@x.com", now, routeOptions: { description: "Hi", nope: 1 } });
    expect(d).toMatchObject({ doctype: "ToDo", __islocal: 1, __unsaved: 1, docstatus: 0, owner: "u@x.com", status: "Open", priority: "Medium", date: "2026-11-03", description: "Hi" });
    expect(d.name).toMatch(/^new-todo-[a-z0-9]{10}$/);
    expect(d.nope).toBeUndefined();
    const c = newDoc(contact, { now });
    expect(c.status).toBe("Passive");
    expect(c.email_ids).toEqual([]);
    const ev = newDoc(event, { now });
    expect(ev.repeat_this_event).toBe(0);
    expect(newDoc(user, {}).enabled).toBe(1);
  });
  it("field default overrides a user default; user default by DocType for Links; keywords", () => {
    const b: MetaBundle = { doctype: "T", children: {}, meta: { name: "T", fields: [
      { fieldname: "company", fieldtype: "Link", options: "Company" },
      { fieldname: "owner_user", fieldtype: "Link", options: "User", default: "__user" },
      { fieldname: "who", fieldtype: "Data", default: "user_fullname" },
      { fieldname: "at", fieldtype: "Time", default: "Now" },
      { fieldname: "kind", fieldtype: "Select", options: "A\nB", default: "B" },
      { fieldname: "region", fieldtype: "Link", options: "Region", default: "EU" },
      { fieldname: "lst", fieldtype: "Select", options: "[Select]\nX" },
    ] } };
    const d = newDoc(b, { user: "u@x.com", userFullname: "U X", userDefaults: { Company: "ACME", Region: "US" }, now: new Date(2026, 0, 1, 8, 0, 0) });
    expect(d).toMatchObject({ company: "ACME", owner_user: "u@x.com", who: "U X", at: "08:00:00", kind: "B", region: "EU" });
    expect(d.lst).toBeUndefined();
  });
  it("mandatory Table fields get one empty row; name_field targets the title field", () => {
    const b: MetaBundle = { doctype: "P", meta: { name: "P", title_field: "title", fields: [{ fieldname: "title", fieldtype: "Data" }, { fieldname: "items", fieldtype: "Table", options: "P Item", reqd: 1 }] },
      children: { "P Item": { name: "P Item", istable: 1, fields: [{ fieldname: "qty", fieldtype: "Int", default: "1" }] } } };
    const d = newDoc(b, { nameField: "Typed" });
    expect(d.title).toBe("Typed");
    expect(d.items).toHaveLength(1);
    expect((d.items as FrappeDoc[])[0]).toMatchObject({ doctype: "P Item", idx: 1, qty: 1, __islocal: 1, parentfield: "items" });
  });
});

describe("check_mandatory (docs 11 §5.6)", () => {
  it("lists parent fields and groups child rows into ranges", () => {
    const rows = (n: number, missing: number[]) => Array.from({ length: n }, (_, i) => ({ doctype: "Contact Email", name: `r${i + 1}`, idx: i + 1, email_id: missing.includes(i + 1) ? "" : `${i}@x.com` }));
    const r = checkMandatory(contact, doc(contact, { email_ids: rows(6, [1, 2, 3, 5]) }));
    expect(r.ok).toBe(false);
    expect(r.lines).toEqual([{ kind: "rows", table: "Email IDs", label: "Email ID", parentfield: "email_ids", fieldname: "email_id", rows: "1-3, 5", single: false }]);
    expect(r.first).toMatchObject({ parentfield: "email_ids", idx: 1 });
    expect(checkMandatory(contact, doc(contact, { email_ids: rows(3, [1, 2, 3]) })).lines[0].kind).toBe("every");
    expect(checkMandatory(contact, doc(contact, { email_ids: rows(3, [2]) })).lines[0]).toMatchObject({ kind: "rows", rows: "2", single: true });
    const many = Array.from({ length: 30 }, (_, i) => i + 1).filter((i) => i % 2 === 1);
    expect(checkMandatory(contact, doc(contact, { email_ids: rows(30, many) })).lines[0]).toMatchObject({ kind: "count", count: 15 });
    const t = checkMandatory(todo, doc(todo, { description: "   " }));
    expect(t.lines).toEqual([{ kind: "field", label: "Description", fieldname: "description" }]);
    expect(checkMandatory(todo, doc(todo, { description: "x" })).ok).toBe(true);
  });
  it("0 is a value; cancelled documents are skipped; hidden fields are still checked", () => {
    const b: MetaBundle = { doctype: "T", children: {}, meta: { name: "T", fields: [{ fieldname: "n", fieldtype: "Int", reqd: 1, hidden: 1 }] } };
    expect(checkMandatory(b, { doctype: "T", name: "t", n: 0 }).ok).toBe(true);
    expect(checkMandatory(b, { doctype: "T", name: "t" }).ok).toBe(false);
    expect(checkMandatory(b, { doctype: "T", name: "t", docstatus: 2 }).ok).toBe(true);
  });
  it("evaluates mandatory_depends_on at save time (replacing static reqd); Prompt autoname needs a name", () => {
    const b: MetaBundle = { doctype: "T", children: {}, meta: { name: "T", autoname: "Prompt", fields: [{ fieldname: "a", fieldtype: "Data", reqd: 1, mandatory_depends_on: "eval:doc.k" }] } };
    expect(checkMandatory(b, { doctype: "T", name: "t", k: 0 }).ok).toBe(true);
    expect(checkMandatory(b, { doctype: "T", name: "t", k: 1 }).missing.map((m) => m.fieldname)).toEqual(["a"]);
    expect(checkMandatory(b, { doctype: "T", name: "new-t-1", __islocal: 1, k: 0 }).missing.map((m) => m.fieldname)).toEqual(["__newname"]);
  });
  it("rowRanges collapses consecutive numbers", () => {
    expect(rowRanges([5, 1, 2, 3, 7, 8])).toEqual(["1-3", "5", "7-8"]);
  });
});

describe("fetch_from (docs 11 §4.2)", () => {
  it("builds the fetch map from the real ToDo meta and writes targets unconditionally", () => {
    const map = buildFetchMap(todo.meta);
    expect(map.get("assigned_by")).toEqual([{ link: "assigned_by", source: "full_name", target: "assigned_by_full_name", fetchIfEmpty: false }]);
    const e = map.get("assigned_by")!;
    expect(fetchUpdates(e, "assigned_by", { name: "a@x.com", values: { full_name: "A X" } })).toEqual({ assigned_by_full_name: "A X" });
    expect(fetchUpdates(e, "assigned_by", { name: null, values: {} })).toEqual({ assigned_by: null });
    expect(fetchUpdates(e, "assigned_by", null)).toEqual({ assigned_by_full_name: "" });
    const df = fieldOf(todo, "assigned_by_full_name");
    expect(isReadOnlyByFetch(df, doc(todo, { assigned_by: "a@x.com" }))).toBe(true);
    expect(isReadOnlyByFetch({ ...df, fetch_if_empty: 1 }, doc(todo, { assigned_by: "a@x.com" }))).toBe(false);
    expect(isReadOnlyByFetch(df, doc(todo))).toBe(false);
    expect(buildFetchMap(customer.meta).get("customer_primary_contact")!.map((x) => x.target)).toEqual(expect.arrayContaining(["first_name", "email_id", "mobile_no"]));
  });
});

describe("layout (docs 11 §2.1)", () => {
  it("inserts a Details tab when the first field is not a Tab Break; anonymous sections; columns", () => {
    const ev = buildLayout(event.meta);
    expect(ev.hasTabs).toBe(true);
    expect(ev.tabs.map((t) => (t.details ? "Details" : t.df?.fieldname))).toEqual(["Details", "participants_tab", "links_tab", "notifications_tab"]);
    const u = buildLayout(user.meta);
    expect(u.tabs[0].df?.fieldname).toBe("user_details_tab");
    expect(u.tabs[0].sections[0].df).toBeUndefined(); // implicit section of the tab: `enabled` comes before any Section Break
    const note = buildLayout(loadBundle("note.en.json").meta);
    expect(note.hasTabs).toBe(false);
    expect(note.tabs).toHaveLength(1);
    expect(note.tabs[0].sections[0].df).toBeUndefined();
    const c = buildLayout(contact.meta);
    expect(c.tabs[0].sections[0].df?.fieldname).toBe("contact_section");
    expect(c.tabs[0].sections[0].columns).toHaveLength(2);
    expect(sectionFields(c.tabs[0].sections[0]).map((f) => f.fieldname)).toContain("status");
  });
  it("adds the __newname field for new documents with Prompt naming", () => {
    const l = buildLayout({ name: "X", autoname: "Prompt", fields: [{ fieldname: "a", fieldtype: "Data" }] }, { isNew: true });
    expect(sectionFields(l.tabs[0].sections[0]).map((f) => f.fieldname)).toEqual(["__newname", "a"]);
    expect(sectionFields(buildLayout({ name: "X", autoname: "Prompt", fields: [] }, { isNew: false }).tabs[0].sections[0] ?? { columns: [], key: "" })).toEqual([]);
  });
});

describe("primary action (docs 11 §7)", () => {
  const all = { write: true, create: true, submit: true, cancel: true, amend: true };
  it("follows Desk's first-match order", () => {
    expect(formActions({ docstatus: 0, isNew: true, dirty: true, isSubmittable: true, perms: all }).primary).toBe("Save");
    expect(formActions({ docstatus: 0, isNew: false, dirty: false, isSubmittable: true, perms: all }).primary).toBe("Submit");
    expect(formActions({ docstatus: 0, isNew: false, dirty: true, isSubmittable: true, perms: all }).primary).toBe("Save");
    expect(formActions({ docstatus: 0, isNew: false, dirty: false, isSubmittable: false, perms: all }).primary).toBe("Save");
    expect(formActions({ docstatus: 0, isNew: false, dirty: false, isSubmittable: true, perms: all, hasWorkflow: true }).primary).toBeNull();
    expect(formActions({ docstatus: 0, isNew: false, dirty: true, isSubmittable: true, perms: all, hasWorkflow: true }).primary).toBe("Save");
    expect(formActions({ docstatus: 1, isNew: false, dirty: true, isSubmittable: true, perms: all })).toEqual({ primary: "Update", secondary: "Cancel", primaryDisabled: false });
    expect(formActions({ docstatus: 1, isNew: false, dirty: false, isSubmittable: true, perms: all })).toMatchObject({ primary: null, secondary: "Cancel" });
    expect(formActions({ docstatus: 1, isNew: false, dirty: false, isSubmittable: true, perms: all, hasWorkflow: true, canCancelWithWorkflow: false }).secondary).toBeNull();
    expect(formActions({ docstatus: 2, isNew: false, dirty: false, isSubmittable: true, perms: all, alreadyAmended: true })).toMatchObject({ primary: "Amend", primaryDisabled: true });
  });
  it("re-checks the permission of the chosen action; disabled save; workflow buttons replace both", () => {
    expect(formActions({ docstatus: 0, isNew: false, dirty: true, isSubmittable: false, perms: { read: true } as never }).primary).toBeNull();
    expect(formActions({ docstatus: 0, isNew: true, dirty: true, isSubmittable: false, perms: { create: true } }).primary).toBe("Save");
    expect(formActions({ docstatus: 0, isNew: false, dirty: true, isSubmittable: false, perms: all, saveDisabled: true }).primary).toBeNull();
    expect(formActions({ docstatus: 1, isNew: false, dirty: false, isSubmittable: true, perms: all, workflowActionsShown: true })).toMatchObject({ primary: null, secondary: null });
  });
});

describe("display status (docs 11 §2.5, 12 §1.3)", () => {
  const perms = [{ read: true, write: true }, { read: true }];
  it("walks the ladder", () => {
    const d = doc(todo, { x: "v" });
    expect(ladderStatus({ fieldname: "x", fieldtype: "Data" }, d, perms)).toBe("Write");
    expect(ladderStatus({ fieldname: "x", fieldtype: "Data", permlevel: 1 }, d, perms)).toBe("Read");
    expect(ladderStatus({ fieldname: "x", fieldtype: "Data", permlevel: 2 }, d, perms)).toBe("None");
    expect(ladderStatus({ fieldname: "x", fieldtype: "Data", hidden_due_to_dependency: true }, d, perms)).toBe("None");
    expect(ladderStatus({ fieldname: "x", fieldtype: "Data" }, { ...d, docstatus: 1 }, perms)).toBe("Read");
    expect(ladderStatus({ fieldname: "x", fieldtype: "Data", allow_on_submit: 1 }, { ...d, docstatus: 1 }, perms)).toBe("Write");
    expect(ladderStatus({ fieldname: "x", fieldtype: "Data", allow_on_submit: 1 }, { ...d, docstatus: 2 }, perms)).toBe("Read");
    expect(ladderStatus({ fieldname: "x", fieldtype: "Read Only" }, d, perms)).toBe("Read");
    expect(ladderStatus({ fieldname: "x", fieldtype: "Data", set_only_once: 1 }, d, perms)).toBe("Read");
    expect(ladderStatus({ fieldname: "x", fieldtype: "Data", set_only_once: 1 }, { ...d, __islocal: 1 }, perms)).toBe("Write");
    expect(ladderStatus({ fieldname: "x", fieldtype: "Data", read_only: 1 }, d)).toBe("Read");
  });
  it("control rules: grid Read, fetch_from read-only, empty Read hidden (except HTML…)", () => {
    const df = fieldOf(todo, "assigned_by_full_name");
    expect(controlStatus("Write", { ...df, read_only: 0 }, doc(todo, { assigned_by: "a", assigned_by_full_name: "A" }))).toBe("Read");
    expect(controlStatus("Read", { fieldname: "x", fieldtype: "Data" }, doc(todo))).toBe("None");
    expect(controlStatus("Read", { fieldname: "x", fieldtype: "HTML" }, doc(todo))).toBe("Read");
    expect(controlStatus("Read", { fieldname: "n", fieldtype: "Int" }, doc(todo, { n: 0 }))).toBe("Read");
    expect(controlStatus("Write", { fieldname: "x", fieldtype: "Data" }, doc(todo, { x: "v" }), { gridStatus: "Read" })).toBe("Read");
  });
});
