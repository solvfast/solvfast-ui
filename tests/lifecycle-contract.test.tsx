/** The Lifecycle contract (record/lifecycle.ts) and LifecycleActions — 0.8.0-dev.5, P0 T7. Reference: the CRM record
 *  page's Lifecycle (docs/audit/p08/CRM-REFERENCE.md §3: L1–L13, B1–B3, R1–R5, D1–D3). The fixture is the shape of the
 *  CRM's default Deal lifecycle (states, phases, colours, transitions) — test data, not shipped. */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Zap } from "lucide-react";
import {
  ActionBar, LifecycleActions, ThemeProvider, lifecycleGraph, lifecycleNext, lifecyclePath, lifecycleRoots, lifecycleTone, lifecycleTransitionsFrom,
  type LifecycleDefinition,
} from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const deal: LifecycleDefinition = {
  states: [
    { id: "q", label: "Qualification", phase: "open", color: "#25d0fe" }, { id: "p", label: "Proposal", phase: "open", color: "#512195" },
    { id: "n", label: "Negotiation", phase: "open", color: "#fe4e18" }, { id: "a", label: "Awaiting Client", phase: "on_hold", color: "#eab308" },
    { id: "w", label: "Won", phase: "closed", color: "#22c55e" }, { id: "l", label: "Lost", phase: "closed", color: "#ef4444" },
  ],
  transitions: [
    { id: "t1", from: "q", to: "p", label: "Send Proposal" }, { id: "t2", from: "p", to: "n", label: "Negotiate" },
    { id: "t3", from: "n", to: "a", label: "Await Client" }, { id: "t4", from: "a", to: "w", label: "Mark Won" }, { id: "t5", from: "a", to: "l", label: "Mark Lost" },
  ],
};

describe("lifecycleTone — the badge tone (B1)", () => {
  it("open → info, on hold → warning; closed by colour: red → danger, green → success, grey → neutral; none → neutral", () => {
    const tone = (id: string) => lifecycleTone(deal.states.find((s) => s.id === id));
    expect([tone("q"), tone("n"), tone("a"), tone("w"), tone("l")]).toEqual(["info", "info", "warning", "success", "danger"]);
    expect(lifecycleTone({ phase: "closed", color: "#9ca3af" })).toBe("neutral");
    expect(lifecycleTone({ phase: "closed" })).toBe("success");
    expect(lifecycleTone(undefined)).toBe("neutral");
  });
});

describe("lifecyclePath — the shortest path from a root (R2, E4)", () => {
  it("root → current, inclusive; a closed state too", () => {
    expect(lifecyclePath(deal, "n").map((s) => s.label)).toEqual(["Qualification", "Proposal", "Negotiation"]);
    expect(lifecyclePath(deal, "l").map((s) => s.id)).toEqual(["q", "p", "n", "a", "l"]);
    expect(lifecycleRoots(deal).map((s) => s.id)).toEqual(["q"]);
  });
  it("the SHORTEST path, not the history: a shortcut edge wins", () => {
    const d = { ...deal, transitions: [...deal.transitions, { id: "x", from: "q", to: "a", label: "Fast track" }] };
    expect(lifecyclePath(d, "w").map((s) => s.id)).toEqual(["q", "a", "w"]);
  });
  it("unreachable → the state alone; unknown → []; no root (a cycle) → the first state is the start", () => {
    const d = { ...deal, states: [...deal.states, { id: "z", label: "Orphan", phase: "open" as const }] };
    expect(lifecyclePath(d, "z").map((s) => s.id)).toEqual(["z"]);
    expect(lifecyclePath(deal, "nope")).toEqual([]);
    const cyc: LifecycleDefinition = { states: [{ id: "a", label: "A", phase: "open" }, { id: "b", label: "B", phase: "open" }], transitions: [{ id: "1", from: "a", to: "b" }, { id: "2", from: "b", to: "a" }] };
    expect(lifecyclePath(cyc, "b").map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("lifecycleTransitionsFrom — the Actions menu (L2, L3)", () => {
  const d: LifecycleDefinition = { ...deal, transitions: [...deal.transitions,
    { id: "auto", from: "n", to: "l", label: "Expire", trigger: "automatic" }, { id: "mgr", from: "n", to: "w", label: "Close Won", roles: ["Manager"] }] };
  it("the manual transitions out of the current state; automatic ones are not actions", () => {
    expect(lifecycleTransitionsFrom(d, "n", ["Manager"]).map((t) => t.label)).toEqual(["Await Client", "Close Won"]);
  });
  it("a role-restricted transition only for a holder; unknown roles → not offered (the CRM passes none)", () => {
    expect(lifecycleTransitionsFrom(d, "n").map((t) => t.label)).toEqual(["Await Client"]);
    expect(lifecycleTransitionsFrom(d, "n", ["Sales"]).map((t) => t.label)).toEqual(["Await Client"]);
  });
  it("a closed state has none (the menu says No actions from this status, L6)", () => {
    expect(lifecycleTransitionsFrom(deal, "w")).toEqual([]);
    expect(lifecycleTransitionsFrom(deal, undefined)).toEqual([]);
  });
});

describe("lifecycleNext — the rail's ways forward (R1, R3)", () => {
  it("every target out of the state, once each, automatic and role-restricted included", () => {
    const d: LifecycleDefinition = { ...deal, transitions: [...deal.transitions,
      { id: "auto", from: "a", to: "l", label: "Expire", trigger: "automatic" }, { id: "mgr", from: "a", to: "n", label: "Reopen", roles: ["Manager"] }] };
    expect(lifecycleNext(d, "a", ["q", "p", "n", "a"])).toEqual([
      { id: "w", label: "Won", back: false }, { id: "l", label: "Lost", back: false }, { id: "n", label: "Negotiation", back: true },
    ]);
  });
  it("none → [] (End of lifecycle)", () => { expect(lifecycleNext(deal, "l", ["q", "p", "n", "a", "l"])).toEqual([]); });
});

describe("lifecycleGraph — the diagram model (D1, D2; E3 option A: no renderer in Core)", () => {
  it("nodes done / current / future; the path's edges taken", () => {
    const g = lifecycleGraph(deal, "l");
    expect(g.nodes.map((n) => `${n.id}:${n.kind}:${n.phase}`)).toEqual(["q:done:open", "p:done:open", "n:done:open", "a:done:on_hold", "w:future:closed", "l:current:closed"]);
    expect(g.edges.filter((e) => e.taken).map((e) => e.id)).toEqual(["t1", "t2", "t3", "t5"]);
    expect(g.edges.find((e) => e.id === "t4")).toEqual({ id: "t4", from: "a", to: "w", label: "Mark Won", taken: false });
  });
  it("visited states (e.g. from a transition log) are done too", () => {
    expect(lifecycleGraph(deal, "n", undefined, ["w"]).nodes.find((n) => n.id === "w")!.kind).toBe("done");
  });
});

describe("LifecycleActions — the Actions menu (L1, L4–L7, L9)", () => {
  const wrap = (ui: React.ReactElement) => render(<ThemeProvider language="en" storageKeys={null}>{ui}</ThemeProvider>);
  const labels = { actions: "Actions", none: "No actions from this status", working: "Working…", confirm: "Confirm", cancel: "Cancel" };
  it("renders exactly the ActionBar menu a host builds today (plain items, no tone)", () => {
    const a = wrap(<LifecycleActions labels={labels} onAction={() => {}} actions={[{ id: "t3", label: "Await Client" }, { id: "x", label: "Approve", disabledReason: "Attach the PO" }]} />).container.innerHTML;
    cleanup();
    const b = wrap(<ActionBar variant="menu" labels={labels} onAction={() => {}}
      actions={[{ id: "t3", label: "Await Client", disabled: false }, { id: "x", label: "Approve — Attach the PO", disabled: true }]} />).container.innerHTML;
    const ids = (h: string) => h.replace(/radix-:r[0-9a-z]+:/g, "radix-id");
    expect(ids(a)).toBe(ids(b));
  });
  it("choosing an item runs it at once; a disabled one does not run", async () => {
    const run = vi.fn();
    wrap(<LifecycleActions labels={labels} onAction={run} actions={[{ id: "t3", label: "Await Client" }, { id: "x", label: "Approve", disabledReason: "Attach the PO" }]} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions" }), { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Await Client", "Approve — Attach the PO"]);
    expect(items[1].getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(items[0]);
    expect(run).toHaveBeenCalledWith("t3");
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("no actions → No actions from this status", async () => {
    wrap(<LifecycleActions labels={labels} onAction={() => {}} actions={[]} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Actions" }), { key: "Enter" });
    expect((await screen.findByText("No actions from this status")).className).toBe("px-2 py-2 text-xs text-muted-foreground");
  });
  it("blocked (e.g. unsaved changes): a disabled button with the reason as its tooltip, the icon, the label and a chevron", () => {
    const { container } = wrap(<LifecycleActions labels={labels} onAction={() => {}} actions={[{ id: "t3", label: "Await Client" }]} blockedReason="Save your changes first" blockedIcon={Zap} />);
    const b = screen.getByRole("button", { name: /Actions/ }) as HTMLButtonElement;
    expect(b.disabled).toBe(true); expect(b.title).toBe("Save your changes first");
    expect(b.className).toContain("h-8 gap-1.5");
    const svgs = b.querySelectorAll("svg");
    expect(svgs[0].getAttribute("class")).toContain("lucide-zap h-4 w-4");
    expect(svgs[1].getAttribute("class")).toContain("h-3.5 w-3.5 opacity-70");
    fireEvent.keyDown(b, { key: "Enter" });
    expect(container.ownerDocument.querySelector("[role=menu]")).toBeNull();
  });
});
