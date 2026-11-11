/**
 * `useGroupByCounts` — the server-data boundary of `frappe.desk.listview.get_group_by_count`. A real Frappe site sends
 * Int and Check group values as JSON numbers (int / bigint column, no cast in listview.py:62-71; checked on a Frappe 15
 * site: `[{"count": 1110, "name": 0}, {"count": 5, "name": 1}, …]`). The hook hands them out as `GroupByCount.name:
 * string | null`, so numbers become decimal strings; strings, null and `count` pass through as sent.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createFrappeClient } from "../src/frappe/client";
import { sortGroupByCounts, useGroupByCounts } from "../src/frappe/list/FrappeGroupBySidebar";

/** A client whose get_group_by_count answers `message` (per field); records the calls. */
function stub(message: Record<string, unknown[]>) {
  const calls: Record<string, unknown>[] = [];
  const client = createFrappeClient({
    transport: async (method, args) => {
      if (method !== "frappe.desk.listview.get_group_by_count") throw new Error(`unexpected ${method}`);
      calls.push(args);
      return { message: message[String(args.field)] };
    },
  });
  return { client, calls };
}

function run(message: Record<string, unknown[]>, fields: string[], user?: string) {
  const { client, calls } = stub(message);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useGroupByCounts("Memo", fields, [], { client, user }), { wrapper });
  return { hook, calls, qc };
}

describe("useGroupByCounts: numeric server values", () => {
  it("an Int field's numbers (zero and positive) become decimal strings; counts and order are kept", async () => {
    const { hook, calls } = run({ priority: [{ name: 5, count: 2 }, { name: 0, count: 1 }, { name: 10, count: 1 }, { name: 1234567, count: 1 }] }, ["priority"]);
    await waitFor(() => expect(hook.result.current[0].loading).toBe(false));
    expect(hook.result.current[0].counts).toEqual([{ name: "5", count: 2 }, { name: "0", count: 1 }, { name: "10", count: 1 }, { name: "1234567", count: 1 }]);
    expect(hook.result.current[0].counts.every((c) => typeof c.name === "string")).toBe(true);
    expect(calls).toEqual([{ doctype: "Memo", current_filters: "[]", field: "priority" }]);
  });

  it("a Check field's 0 / 1 become \"0\" / \"1\"", async () => {
    const { hook } = run({ urgent: [{ name: 0, count: 3 }, { name: 1, count: 1 }] }, ["urgent"]);
    await waitFor(() => expect(hook.result.current[0].loading).toBe(false));
    expect(hook.result.current[0].counts).toEqual([{ name: "0", count: 3 }, { name: "1", count: 1 }]);
  });

  it("the cached query data is normalized too (what another reader of the same query gets)", async () => {
    const { hook, qc } = run({ priority: [{ name: 0, count: 1 }] }, ["priority"]);
    await waitFor(() => expect(hook.result.current[0].loading).toBe(false));
    const cached = qc.getQueriesData({ queryKey: ["sf-frappe", "group-by-count", "Memo", "priority"] }).map(([, d]) => d);
    expect(cached).toEqual([[{ name: "0", count: 1 }]]);
  });
});

describe("useGroupByCounts: everything else passes through unchanged", () => {
  it("strings (including \"0\") and null are kept as they are; count is not touched", async () => {
    const { hook } = run({ status: [{ name: "Open", count: 2 }, { name: "0", count: 1 }, { name: null, count: 4 }] }, ["status"], "u@x.com");
    await waitFor(() => expect(hook.result.current[0].loading).toBe(false));
    expect(hook.result.current[0].counts).toEqual([{ name: "Open", count: 2 }, { name: "0", count: 1 }, { name: null, count: 4 }]);
  });

  it("count is passed as sent (a string count stays a string; only names are normalized)", async () => {
    const { hook } = run({ priority: [{ name: 7, count: "3" }] }, ["priority"]);
    await waitFor(() => expect(hook.result.current[0].loading).toBe(false));
    expect(hook.result.current[0].counts).toEqual([{ name: "7", count: "3" }]);
  });

  it("non-numeric, non-string values (a boolean) are not converted", async () => {
    const { hook } = run({ urgent: [{ name: false, count: 2 }] }, ["urgent"]);
    await waitFor(() => expect(hook.result.current[0].loading).toBe(false));
    expect(hook.result.current[0].counts).toEqual([{ name: false, count: 2 }]);
  });

  it("Desk's post-processing still applies: zero counts dropped, Administrator / Guest dropped, the session user first", async () => {
    const { hook } = run({
      owner: [{ name: "ann@x.com", count: 3 }, { name: "Administrator", count: 2 }, { name: "u@x.com", count: 1 }, { name: "bob@x.com", count: 0 }],
      priority: [{ name: 0, count: 0 }, { name: 3, count: 2 }],
    }, ["owner", "priority"], "u@x.com");
    await waitFor(() => expect(hook.result.current.every((r) => !r.loading)).toBe(true));
    expect(hook.result.current[0].counts).toEqual([{ name: "u@x.com", count: 1 }, { name: "ann@x.com", count: 3 }]);
    expect(hook.result.current[1].counts).toEqual([{ name: "3", count: 2 }]);
  });

  it("a non-array message is no counts (as before)", async () => {
    const { hook } = run({ priority: undefined as never }, ["priority"]);
    await waitFor(() => expect(hook.result.current[0].loading).toBe(false));
    expect(hook.result.current[0].counts).toEqual([]);
  });
});

describe("sortGroupByCounts: null (\"Not Set\") entries (list_sidebar_group_by.js:177-188; Desk drops only Guest / Administrator / the session user)", () => {
  const counts = [{ name: "ann@x.com", count: 3 }, { name: null, count: 4 }, { name: "Guest", count: 1 }, { name: "Administrator", count: 2 }, { name: "u@x.com", count: 5 }];

  it("without a session user the null entry is kept; Guest / Administrator are still dropped, order is as sent", () => {
    expect(sortGroupByCounts(counts, undefined)).toEqual([{ name: "ann@x.com", count: 3 }, { name: null, count: 4 }, { name: "u@x.com", count: 5 }]);
  });

  it("with a session user the null entry is kept; the user comes first; Guest / Administrator are dropped", () => {
    expect(sortGroupByCounts(counts, "u@x.com")).toEqual([{ name: "u@x.com", count: 5 }, { name: "ann@x.com", count: 3 }, { name: null, count: 4 }]);
  });

  it("zero counts are dropped, null or not", () => {
    expect(sortGroupByCounts([{ name: null, count: 0 }, { name: "a", count: 1 }], undefined)).toEqual([{ name: "a", count: 1 }]);
  });

  it("a session user absent from the counts changes nothing", () => {
    expect(sortGroupByCounts([{ name: null, count: 2 }, { name: "a", count: 1 }], "u@x.com")).toEqual([{ name: null, count: 2 }, { name: "a", count: 1 }]);
  });
});
