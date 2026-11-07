/**
 * depends_on / mandatory_depends_on / read_only_depends_on evaluation —
 * apps/frappe/frappe/public/js/frappe/form/layout.js:751-791 (`evaluate_depends_on_value`), :701-749
 * (dependency-derived `reqd` / `read_only`), cypress/integration/depends_on.js.
 *
 * Wired to A3's evaluator (`evaluateDependsOn`, `isFieldRequired` in ./seam.ts).
 *
 * Evidence from the REAL metadata fixtures: the expressions in use need the Desk page globals `in_list` and `cint`
 * (utils/number_format.js:276, utils/datatype.js:9) in addition to `doc` / `parent`. The two `real expressions` tests
 * at the bottom run NOW (no implementation needed) and pin that list.
 */
import { describe, expect, it } from "vitest";
import type { FrappeDoc } from "../../src/frappe/contract";
import { evaluateDependsOn, fieldOf, isFieldRequired, loadBundle } from "./seam";
import { resolveFields } from "../../src/frappe/form/model/depends";

const doc = (o: Record<string, unknown>): FrappeDoc => ({ doctype: "SFUI Test Parent", name: "P-1", ...o });
const ev = (expr: string | boolean | ((d: FrappeDoc) => unknown), d: FrappeDoc, extra: { parent?: FrappeDoc; hasForm?: boolean } = {}) =>
  evaluateDependsOn(expr, { doc: d, hasForm: true, ...extra });

describe("evaluateDependsOn (layout.js:751-791)", () => {
  describe("eval:", () => {
    // depends_on.js: display_dependant_field depends_on "eval:doc.test_field=='Value'"
    it("true", () => expect(ev("eval:doc.test_field=='Value'", doc({ test_field: "Value" }))).toBe(true));
    it("false", () => expect(ev("eval:doc.test_field=='Value'", doc({ test_field: "x" }))).toBe(false));
    it("missing key is undefined, not an error", () => expect(ev("eval:doc.test_field=='Value'", doc({}))).toBe(false));
    it("result is coerced to boolean-ish truthiness", () => expect(ev("eval:doc.qty", doc({ qty: 3 }))).toBe(true));
    it("0 and '' are falsy", () => {
      expect(ev("eval:doc.qty", doc({ qty: 0 }))).toBe(false);
      expect(ev("eval:doc.qty", doc({ qty: "" }))).toBe(false);
    });
    it("a space after 'eval:' is accepted (Customer address_html: 'eval: !doc.__islocal')", () => {
      expect(ev("eval: !doc.__islocal", doc({}))).toBe(true);
      expect(ev("eval: !doc.__islocal", doc({ __islocal: 1 }))).toBe(false);
    });
    it("Event.monday: eval:doc.repeat_this_event && doc.repeat_on===\"Weekly\"", () => {
      const e = "eval:doc.repeat_this_event && doc.repeat_on===\"Weekly\"";
      expect(ev(e, doc({ repeat_this_event: 1, repeat_on: "Weekly" }))).toBe(true);
      expect(ev(e, doc({ repeat_this_event: 1, repeat_on: "Daily" }))).toBe(false);
      expect(ev(e, doc({ repeat_this_event: 0, repeat_on: "Weekly" }))).toBe(false);
    });
    it("User.sb1 uses the global in_list(): eval:in_list(['System User','Website User'], doc.user_type) && doc.enabled == 1", () => {
      const e = "eval:in_list(['System User', 'Website User'], doc.user_type) && doc.enabled == 1";
      expect(ev(e, doc({ user_type: "System User", enabled: 1 }))).toBe(true);
      expect(ev(e, doc({ user_type: "Website User", enabled: 0 }))).toBe(false);
      expect(ev(e, doc({ user_type: "Other", enabled: 1 }))).toBe(false);
    });
    it("User.change_password uses the global cint(): eval:doc.enabled && (!doc.__islocal || !cint(doc.send_welcome_email))", () => {
      const e = "eval:doc.enabled && (!doc.__islocal || !cint(doc.send_welcome_email))";
      expect(ev(e, doc({ enabled: 1, __islocal: 1, send_welcome_email: 1 }))).toBe(false);
      expect(ev(e, doc({ enabled: 1, __islocal: 1, send_welcome_email: 0 }))).toBe(true);
      expect(ev(e, doc({ enabled: 1 }))).toBe(true);
    });
    it("a throwing expression raises 'Invalid depends_on expression' (frappe.throw in Desk)", () => {
      expect(() => ev("eval:doc.(", doc({}))).toThrow(/Invalid .*depends_on.* expression/i);
    });
    it("only `doc` and `parent` are in scope: window/document/fetch are not reachable", () => {
      expect(() => ev("eval:window.location.href", doc({}))).toThrow();
      expect(() => ev("eval:fetch('/api/method/ping')", doc({}))).toThrow();
    });
  });

  describe("plain fieldname", () => {
    it("truthy value", () => expect(ev("is_internal_customer", doc({ is_internal_customer: 1 }))).toBe(true));
    it("falsy value", () => expect(ev("is_internal_customer", doc({ is_internal_customer: 0 }))).toBe(false));
    it("array counts by length (Customer.companies depends_on represents_company; tables are arrays)", () => {
      expect(ev("items", doc({ items: [{}] }))).toBe(true);
      expect(ev("items", doc({ items: [] }))).toBe(false);
    });
    it("'!field' is NOT supported syntax: it reads doc['!field'] -> false", () => {
      expect(ev("!enabled", doc({ enabled: 0 }))).toBe(false);
    });
  });

  describe("fn:", () => {
    it("without a form it falls through to doc['fn:…'] truthiness -> false", () =>
      expect(ev("fn:is_ready", doc({}), { hasForm: false })).toBe(false));
    it.todo("with a form it triggers the registered handler (always-truthy promise in Desk, UNVERIFIED in practice) — decide whether to support");
  });

  describe("boolean and function (programmatic dfs)", () => {
    it("boolean passes through", () => {
      expect(ev(true, doc({}))).toBe(true);
      expect(ev(false, doc({}))).toBe(false);
    });
    it("function is called with the doc", () => expect(ev((d) => d.qty === 2, doc({ qty: 2 }))).toBe(true));
  });

  describe("child-row context: doc = the row, parent = the form doc (layout.js:763)", () => {
    const parent = doc({ test_field: "Some Other Value" });
    const row: FrappeDoc = { doctype: "Child Test Depends On", name: "r1", parent: "P-1", parentfield: "rows", idx: 1, child_test_field: "x" };
    it("reads the parent", () => expect(ev("eval:parent.test_field=='Some Other Value'", row, { parent })).toBe(true));
    it("reads the row", () => expect(ev("eval:doc.child_test_field=='x'", row, { parent })).toBe(true));
    it("for a top-level form parent === doc", () => expect(ev("eval:parent.test_field==doc.test_field", parent)).toBe(true));
  });
});

describe("dependency-derived reqd (layout.js:701-711; save.js:271-296)", () => {
  const field = (extra: Record<string, unknown>) => ({ fieldname: "dependant_field", fieldtype: "Data", ...extra });
  const dep = "eval:doc.test_field=='Some Value'"; // cypress depends_on.js

  it("mandatory_depends_on true -> required", () =>
    expect(isFieldRequired(field({ mandatory_depends_on: dep }), { doc: doc({ test_field: "Some Value" }) })).toBe(true));
  it("mandatory_depends_on false -> not required", () =>
    expect(isFieldRequired(field({ mandatory_depends_on: dep }), { doc: doc({ test_field: "Random value" }) })).toBe(false));
  it("the dependency result REPLACES static reqd: reqd=1 + condition false -> not required", () =>
    expect(isFieldRequired(field({ reqd: 1, mandatory_depends_on: dep }), { doc: doc({ test_field: "Random value" }) })).toBe(false));
  it("static reqd without a dependency", () => expect(isFieldRequired(field({ reqd: 1 }), { doc: doc({}) })).toBe(true));
  it("neither -> not required", () => expect(isFieldRequired(field({}), { doc: doc({}) })).toBe(false));
  it("mandatory_depends_on with a bad expression throws 'Invalid \"mandatory_depends_on\" expression' (save.js:281-283)", () =>
    expect(() => isFieldRequired(field({ mandatory_depends_on: "eval:doc.(" }), { doc: doc({}) })).toThrow(/mandatory_depends_on/));
  // C4 (P35): was an it.todo; implemented in form/model/depends.ts resolveFields (read_only_depends_on REPLACES read_only)
  it("FV.C4 read_only_depends_on writes df.read_only = 1/0, so a static read_only=1 field becomes writable when the condition is false (layout.js:721-749)", () => {
    const df = field({ read_only: 1, read_only_depends_on: dep });
    const ro = (d: FrappeDoc) => resolveFields([df as never], d, d).get("dependant_field")!.read_only;
    expect(ro(doc({ test_field: "Some Value" }))).toBe(1);
    expect(ro(doc({ test_field: "Random value" }))).toBe(0);
    // without the dependency the static flag stays
    expect(resolveFields([field({ read_only: 1 }) as never], doc({}), doc({})).get("dependant_field")!.read_only).toBe(1);
  });
});

describe("real expressions in tests/fixtures/real-15.110 (runs now)", () => {
  const files = ["contact", "customer", "event", "file", "note", "todo", "user"];
  const expressions: string[] = [];
  for (const f of files) {
    const b = loadBundle(`${f}.en.json`);
    for (const meta of [b.meta, ...Object.values(b.children)]) {
      for (const df of meta.fields) {
        for (const k of ["depends_on", "mandatory_depends_on", "read_only_depends_on", "collapsible_depends_on"] as const) {
          const v = df[k];
          if (typeof v === "string" && v.startsWith("eval:")) expressions.push(v.slice(5));
        }
      }
    }
  }

  it("collects the eval: expressions of the seven real DocTypes", () => {
    expect(expressions.length).toBeGreaterThan(20);
  });

  it("every one compiles exactly as Desk compiles it (`let out = <code>; return out` in new Function(doc, parent))", () => {
    for (const code of expressions) {
      expect(() => new Function("doc", "parent", `let out = ${code}; return out`), code).not.toThrow();
    }
  });

  it("the only free functions they call are in_list and cint (the globals the evaluator must provide)", () => {
    const called = new Set<string>();
    for (const code of expressions) {
      for (const m of code.matchAll(/(?<![\w.$])([A-Za-z_]\w*)\s*\(/g)) called.add(m[1]);
    }
    expect([...called].sort()).toEqual(["cint", "in_list"]);
  });

  it("static facts the tests above rely on", () => {
    const user = loadBundle("user.en.json");
    expect(fieldOf(user, "sb1").depends_on).toBe("eval:in_list(['System User', 'Website User'], doc.user_type) && doc.enabled == 1");
    const customer = loadBundle("customer.en.json");
    expect(fieldOf(customer, "address_html").depends_on).toBe("eval: !doc.__islocal");
    expect(fieldOf(customer, "companies").depends_on).toBe("represents_company");
  });
});
