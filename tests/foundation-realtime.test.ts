/** Foundation — RealtimePort skeleton over a FAKE socket (no Socket.IO, no site): room protocol and cache rules only. */
import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createSocketRealtime, applyRealtimeEvent } from "../src/frappe/services";
import { frappeKeys } from "../src/frappe/contract";

function fakeSocket() {
  const handlers = new Map<string, Set<(...a: unknown[]) => void>>();
  const emitted: unknown[][] = [];
  return {
    emitted,
    emit: (event: string, ...args: unknown[]) => { emitted.push([event, ...args]); },
    on: (event: string, l: (...a: unknown[]) => void) => { (handlers.get(event) ?? handlers.set(event, new Set()).get(event)!).add(l); },
    off: (event: string, l: (...a: unknown[]) => void) => { handlers.get(event)?.delete(l); },
    fire: (event: string, data: unknown) => { for (const l of handlers.get(event) ?? []) l(data); },
  };
}

describe("createSocketRealtime (skeleton)", () => {
  it("reference-counted rooms, filtered events, resubscribe on connect", () => {
    const s = fakeSocket();
    const port = createSocketRealtime(s);
    const a = vi.fn(), b = vi.fn(), l = vi.fn();
    const offA = port.subscribeDoc("ToDo", "TD-1", a);
    const offB = port.subscribeDoc("ToDo", "TD-1", b);
    const offL = port.subscribeDoctype("ToDo", l);
    expect(s.emitted).toEqual([["doc_subscribe", "ToDo", "TD-1"], ["doctype_subscribe", "ToDo"]]);
    s.fire("doc_update", { doctype: "ToDo", name: "TD-1", modified: "m2" });
    s.fire("doc_update", { doctype: "ToDo", name: "TD-2", modified: "m2" });
    s.fire("docinfo_update", { doc: { doctype: "Comment", reference_doctype: "ToDo", reference_name: "TD-1" }, key: "comments", action: "add" });
    s.fire("list_update", { doctype: "ToDo", name: "TD-9", user: "u" });
    expect(a).toHaveBeenCalledTimes(2);
    expect(a.mock.calls[1][0]).toMatchObject({ event: "docinfo_update", doctype: "ToDo", name: "TD-1" });
    expect(l).toHaveBeenCalledWith(expect.objectContaining({ event: "list_update", name: "TD-9" }));
    s.fire("connect", undefined);
    expect(s.emitted.slice(2)).toEqual([["doc_subscribe", "ToDo", "TD-1"], ["doctype_subscribe", "ToDo"]]);
    offA(); offB(); offL();
    expect(s.emitted.slice(4)).toEqual([["doc_unsubscribe", "ToDo", "TD-1"], ["doctype_unsubscribe", "ToDo"]]);
  });

  it("applyRealtimeEvent: doc_update only when newer than the cached modified", async () => {
    const qc = new QueryClient();
    qc.setQueryData(frappeKeys.doc("ToDo", "TD-1"), { doctype: "ToDo", name: "TD-1", modified: "2026-11-03 10:00:00.000000" });
    const inv = vi.spyOn(qc, "invalidateQueries");
    await applyRealtimeEvent(qc, { event: "doc_update", doctype: "ToDo", name: "TD-1", data: { modified: "2026-11-03 10:00:00.000000" } });
    expect(inv).not.toHaveBeenCalled();
    await applyRealtimeEvent(qc, { event: "doc_update", doctype: "ToDo", name: "TD-1", data: { modified: "2026-11-03 11:00:00.000000" } });
    expect(inv.mock.calls.map((c) => c[0]?.queryKey)).toEqual([frappeKeys.doc("ToDo", "TD-1"), frappeKeys.docinfo("ToDo", "TD-1")]);
    inv.mockClear();
    await applyRealtimeEvent(qc, { event: "list_update", doctype: "ToDo" });
    expect(inv.mock.calls.map((c) => c[0]?.queryKey)).toEqual([frappeKeys.list("ToDo"), frappeKeys.count("ToDo")]);
  });
});
