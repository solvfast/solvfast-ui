/**
 * React Query keys — the one part of the contract that exists as RUNTIME code today (src/frappe/contract.ts).
 * Invalidation rules are described in the contract comment above `frappeKeys`; they are implemented by A1's hooks and
 * checked in ./invalidation.test.ts (pending).
 */
import { describe, expect, it } from "vitest";
import { frappeKeys } from "../../src/frappe/contract";

describe("frappeKeys", () => {
  it("every key starts with the 'sf-frappe' prefix 0.3.x already uses (invalidateFrappeList)", () => {
    const keys = [
      frappeKeys.all,
      frappeKeys.meta("ToDo"),
      frappeKeys.metaBundle("ToDo"),
      frappeKeys.doc("ToDo", "a"),
      frappeKeys.docinfo("ToDo", "a"),
      frappeKeys.list("ToDo"),
      frappeKeys.count("ToDo"),
      frappeKeys.search("ToDo", "x"),
      frappeKeys.workflow("ToDo"),
    ];
    for (const k of keys) expect(k[0]).toBe("sf-frappe");
  });

  it("doc and docinfo keys are distinct and carry doctype + name", () => {
    expect(frappeKeys.doc("ToDo", "a")).toEqual(["sf-frappe", "doc", "ToDo", "a"]);
    expect(frappeKeys.docinfo("ToDo", "a")).toEqual(["sf-frappe", "docinfo", "ToDo", "a"]);
  });

  it("list and count of one doctype share a doctype segment but not a kind, so one can be invalidated alone", () => {
    expect(frappeKeys.list("ToDo")).toEqual(["sf-frappe", "list", "ToDo"]);
    expect(frappeKeys.count("ToDo")).toEqual(["sf-frappe", "count", "ToDo"]);
  });

  it("two documents of different doctypes never collide (a name can repeat across doctypes)", () => {
    expect(frappeKeys.doc("ToDo", "1")).not.toEqual(frappeKeys.doc("Note", "1"));
  });

  it("search keys include options (user permissions / filters change the result) and are stable for undefined", () => {
    expect(frappeKeys.search("User", "a")).toEqual(["sf-frappe", "search", "User", "a", null]);
    expect(frappeKeys.search("User", "a", { pageLength: 5 })).not.toEqual(frappeKeys.search("User", "a"));
  });

  it("prefix matching works for the documented invalidations: ['sf-frappe','list',dt] matches only that doctype's lists", () => {
    const prefix = frappeKeys.list("ToDo");
    const matches = (k: readonly unknown[]) => prefix.every((p, i) => k[i] === p);
    expect(matches(frappeKeys.list("ToDo"))).toBe(true);
    expect(matches(frappeKeys.list("Note"))).toBe(false);
    expect(matches(frappeKeys.count("ToDo"))).toBe(false);
  });
});

describe.skip("invalidation rules (contract.ts comment) — PENDING A1 hooks", () => {
  it.todo("save/submit/update/cancel/amend/rename/workflow action: set doc, invalidate docinfo, list and count of that doctype; rename also removes the old doc key");
  it.todo("delete: remove doc + docinfo, invalidate list and count");
  it.todo("comment/assignment/attachment/share/follow: invalidate docinfo and list");
  it.todo("realtime doc_update newer than cached modified: invalidate doc + docinfo; older or equal: no-op");
  it.todo("realtime list_update: invalidate list + count, debounced 2 s (15 s large tables), never while rows are selected");
});
