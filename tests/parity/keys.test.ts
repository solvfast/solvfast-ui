/**
 * React Query keys — the one part of the contract that exists as RUNTIME code today (src/frappe/contract.ts).
 * Invalidation rules are described in the contract comment above `frappeKeys`; they are implemented once in
 * src/frappe/services/cache.ts (called by the hooks' onSuccess handlers) and the list's quiet period in
 * src/frappe/list/realtime.ts; both are tested below (Phase 26 E: the five former `it.todo`).
 */
import * as React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { frappeKeys, type DocInfo, type FrappeDoc, type RealtimeEvent, type RealtimePort } from "../../src/frappe/contract";
import { applyDeletedDoc, applyDocInfoChange, applyRealtimeEvent, applyRenamedDoc, applySavedDoc } from "../../src/frappe/services/cache";
import { REALTIME_DEBOUNCE_LARGE_MS, REALTIME_DEBOUNCE_MS, useListRealtime } from "../../src/frappe/list/realtime";

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

/**
 * Invalidation rules (contract.ts comment above `frappeKeys`), implemented in src/frappe/services/cache.ts and called by
 * the hooks (useDocMutations.ts onSuccess handlers, useRealtime.ts) — tested here directly on a QueryClient. Every key
 * is seeded first: an invalidation of an unknown key leaves nothing to assert on. "Note" is a second doctype that must
 * never be touched by a ToDo rule. The list_update debounce lives in src/frappe/list/realtime.ts (`useListRealtime`).
 */
describe("invalidation rules (contract.ts comment) — services/cache.ts + list/realtime.ts", () => {
  const todo = (name: string, modified = "2026-11-03 10:00:00.000000"): FrappeDoc => ({ doctype: "ToDo", name, modified, description: "x" });
  const docinfo = { attachments: [], comments: [], versions: [], assignments: [], communications: [], shared: [], permissions: { read: 1 } } as unknown as DocInfo;
  const K = {
    doc: (n: string) => frappeKeys.doc("ToDo", n), docinfo: (n: string) => frappeKeys.docinfo("ToDo", n),
    list: [...frappeKeys.list("ToDo"), { page: 1 }] as const, count: [...frappeKeys.count("ToDo"), { filters: [] }] as const,
    noteList: [...frappeKeys.list("Note"), { page: 1 }] as const, noteCount: frappeKeys.count("Note"), noteDoc: frappeKeys.doc("Note", "a"),
  };
  function seeded() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    qc.setQueryData(K.doc("TD-1"), todo("TD-1"));
    qc.setQueryData(K.docinfo("TD-1"), docinfo);
    qc.setQueryData(K.list, [{ name: "TD-1" }]);
    qc.setQueryData(K.count, 1);
    qc.setQueryData(K.noteList, [{ name: "a" }]);
    qc.setQueryData(K.noteCount, 1);
    qc.setQueryData(K.noteDoc, { doctype: "Note", name: "a" });
    return qc;
  }
  const invalidated = (qc: QueryClient, key: readonly unknown[]) => qc.getQueryState(key as unknown[])?.isInvalidated;
  const untouched = (qc: QueryClient) => {
    expect(invalidated(qc, K.noteList)).toBe(false);
    expect(invalidated(qc, K.noteCount)).toBe(false);
    expect(invalidated(qc, K.noteDoc)).toBe(false);
    expect(qc.getQueryData(K.noteDoc)).toBeDefined();
  };

  it("save/submit/update/cancel/amend/workflow action: set doc, invalidate docinfo, list and count of that doctype; a rename also removes the old doc key", async () => {
    const qc = seeded();
    const saved = todo("TD-1", "2026-11-03 11:00:00.000000");
    await applySavedDoc(qc, saved);
    expect(qc.getQueryData(K.doc("TD-1"))).toStrictEqual(saved); // set (structurally shared), not invalidated: the server's document is the truth
    expect(invalidated(qc, K.doc("TD-1"))).toBe(false);
    expect(invalidated(qc, K.docinfo("TD-1"))).toBe(true);
    expect(invalidated(qc, K.list)).toBe(true);
    expect(invalidated(qc, K.count)).toBe(true);
    untouched(qc);

    // a new document: the `new-…` name's keys are removed once the server has named it
    const qc2 = seeded();
    qc2.setQueryData(K.doc("new-todo-1"), todo("new-todo-1"));
    qc2.setQueryData(K.docinfo("new-todo-1"), docinfo);
    await applySavedDoc(qc2, todo("TD-2"), { previousName: "new-todo-1" });
    expect(qc2.getQueryData(K.doc("new-todo-1"))).toBeUndefined();
    expect(qc2.getQueryData(K.docinfo("new-todo-1"))).toBeUndefined();
    expect(qc2.getQueryData(K.doc("TD-2"))).toMatchObject({ name: "TD-2" });

    // a queued submission is not a server document: `doc` is invalidated instead of set (contract: queued 20–500 docs)
    const qc3 = seeded();
    await applySavedDoc(qc3, { ...todo("TD-1"), __queued: true } as FrappeDoc);
    expect(qc3.getQueryData<FrappeDoc>(K.doc("TD-1"))?.__queued).toBeUndefined();
    expect(invalidated(qc3, K.doc("TD-1"))).toBe(true);

    // rename (frappe.rename_doc): old keys removed, the cached doc moves to the new name and is re-read
    const qc4 = seeded();
    await applyRenamedDoc(qc4, "ToDo", "TD-1", "TD-9");
    expect(qc4.getQueryData(K.doc("TD-1"))).toBeUndefined();
    expect(qc4.getQueryData(K.docinfo("TD-1"))).toBeUndefined();
    expect(qc4.getQueryData(K.doc("TD-9"))).toMatchObject({ name: "TD-9", description: "x" });
    expect(invalidated(qc4, K.doc("TD-9"))).toBe(true);
    expect(invalidated(qc4, K.docinfo("TD-9"))).not.toBe(false); // never cached under the new name: absent (undefined), or invalidated
    expect(invalidated(qc4, K.list)).toBe(true);
    expect(invalidated(qc4, K.count)).toBe(true);
    untouched(qc4);
  });

  it("delete: remove doc + docinfo, invalidate list and count", async () => {
    const qc = seeded();
    await applyDeletedDoc(qc, "ToDo", "TD-1");
    expect(qc.getQueryData(K.doc("TD-1"))).toBeUndefined();
    expect(qc.getQueryData(K.docinfo("TD-1"))).toBeUndefined();
    expect(invalidated(qc, K.list)).toBe(true);
    expect(invalidated(qc, K.count)).toBe(true);
    untouched(qc);
  });

  it("comment/assignment/attachment/share/follow: invalidate docinfo and list (not the doc, not the count)", async () => {
    const qc = seeded();
    await applyDocInfoChange(qc, "ToDo", "TD-1");
    expect(invalidated(qc, K.docinfo("TD-1"))).toBe(true);
    expect(invalidated(qc, K.list)).toBe(true);
    expect(invalidated(qc, K.doc("TD-1"))).toBe(false);
    expect(qc.getQueryData(K.doc("TD-1"))).toBeDefined();
    expect(invalidated(qc, K.count)).toBe(false);
    untouched(qc);
  });

  it("realtime doc_update newer than cached modified: invalidate doc + docinfo; older or equal: no-op", async () => {
    const older = seeded();
    await applyRealtimeEvent(older, { event: "doc_update", doctype: "ToDo", name: "TD-1", data: { modified: "2026-11-03 09:00:00.000000" } });
    expect(invalidated(older, K.doc("TD-1"))).toBe(false);
    expect(invalidated(older, K.docinfo("TD-1"))).toBe(false);

    const equal = seeded();
    await applyRealtimeEvent(equal, { event: "doc_update", doctype: "ToDo", name: "TD-1", data: { modified: "2026-11-03 10:00:00.000000" } });
    expect(invalidated(equal, K.doc("TD-1"))).toBe(false);
    expect(invalidated(equal, K.docinfo("TD-1"))).toBe(false);

    const newer = seeded();
    await applyRealtimeEvent(newer, { event: "doc_update", doctype: "ToDo", name: "TD-1", data: { modified: "2026-11-03 10:00:01.000000" } });
    expect(invalidated(newer, K.doc("TD-1"))).toBe(true);
    expect(invalidated(newer, K.docinfo("TD-1"))).toBe(true);
    expect(invalidated(newer, K.list)).toBe(false); // a doc_update is not a list_update
    untouched(newer);

    // docinfo_update (comments, assignments, attachments …) touches only docinfo
    const info = seeded();
    await applyRealtimeEvent(info, { event: "docinfo_update", doctype: "ToDo", name: "TD-1" });
    expect(invalidated(info, K.docinfo("TD-1"))).toBe(true);
    expect(invalidated(info, K.doc("TD-1"))).toBe(false);
  });

  it("realtime list_update: invalidate list + count, debounced 2 s (15 s large tables), never while rows are selected", async () => {
    // the cache rule itself (services/cache.ts): list + count of that doctype, immediately
    const qc = seeded();
    await applyRealtimeEvent(qc, { event: "list_update", doctype: "ToDo", name: "TD-7" });
    expect(invalidated(qc, K.list)).toBe(true);
    expect(invalidated(qc, K.count)).toBe(true);
    expect(invalidated(qc, K.doc("TD-1"))).toBe(false);
    untouched(qc);

    // the list's quiet period and selection guard (list/realtime.ts `useListRealtime`, FrappeListView.tsx:61)
    expect(REALTIME_DEBOUNCE_MS).toBe(2000);
    expect(REALTIME_DEBOUNCE_LARGE_MS).toBe(15000);
    vi.useFakeTimers();
    try {
      const run = (o: { isLargeTable?: boolean; suppressed: boolean }) => {
        const qcl = seeded();
        let listener: ((e: RealtimeEvent) => void) | undefined;
        const port: RealtimePort = { subscribeDoc: () => () => {}, subscribeDoctype: (_dt, on) => { listener = on; return () => { listener = undefined; }; } };
        const wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(QueryClientProvider, { client: qcl }, children);
        const h = renderHook(() => useListRealtime({ port, doctype: "ToDo", suppressed: o.suppressed, isLargeTable: o.isLargeTable }), { wrapper });
        expect(listener).toBeDefined();
        return { qcl, fire: () => act(() => { listener!({ event: "list_update", doctype: "ToDo", name: "TD-7" }); }), unmount: h.unmount };
      };
      const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
      // 2 s quiet period: two events 1 s apart reload once, 2 s after the LAST one
      const a = run({ suppressed: false });
      a.fire();
      await tick(1000);
      expect(invalidated(a.qcl, K.list)).toBe(false);
      a.fire();
      await tick(1500);
      expect(invalidated(a.qcl, K.list)).toBe(false); // 2.5 s after the first event, only 1.5 s after the second
      await tick(600);
      expect(invalidated(a.qcl, K.list)).toBe(true);
      expect(invalidated(a.qcl, K.count)).toBe(true);
      untouched(a.qcl);
      a.unmount();
      // large table: 15 s
      const b = run({ suppressed: false, isLargeTable: true });
      b.fire();
      await tick(14_000);
      expect(invalidated(b.qcl, K.list)).toBe(false);
      await tick(1_100);
      expect(invalidated(b.qcl, K.list)).toBe(true);
      b.unmount();
      // rows selected (or a bulk operation running): the event is dropped, no reload later either
      const c = run({ suppressed: true });
      c.fire();
      await tick(20_000);
      expect(invalidated(c.qcl, K.list)).toBe(false);
      expect(invalidated(c.qcl, K.count)).toBe(false);
      c.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
