/**
 * LifecycleGraphView — core's dependency-free renderer of the lifecycle model (`lifecycleGraph()`): `layoutLifecycle`
 * (rows, back edges, self-loops, right-to-left mirroring, determinism) and the view (text alternative, unique arrow
 * heads per mounted graph, done / current / future states). jsdom: positions are the layout's numbers, not pixels.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { ThemeProvider, LifecycleGraphView, layoutLifecycle, lifecycleGraph, type LifecycleDefinition, type LifecycleGraph } from "../src";

afterEach(cleanup);

const DEF: LifecycleDefinition = {
  states: [
    { id: "new", label: "New", phase: "open" }, { id: "work", label: "In Progress", phase: "open" },
    { id: "hold", label: "On Hold", phase: "on_hold" }, { id: "done", label: "Resolved", phase: "closed" },
    { id: "orphan", label: "Archived", phase: "closed" },
  ],
  transitions: [
    { id: "t1", from: "new", to: "work", label: "Start" },
    { id: "t2", from: "work", to: "hold", label: "Pause" },
    { id: "t3", from: "hold", to: "work", label: "Resume" },
    { id: "t4", from: "work", to: "done", label: "Resolve" },
    { id: "t5", from: "done", to: "new", label: "Reopen" },
    { id: "t6", from: "work", to: "work", label: "Comment" },
  ],
};
const graph = lifecycleGraph(DEF, "work", ["new", "work"]);

describe("LG.layout — layoutLifecycle", () => {
  it("LG.layout.1 rows by breadth-first distance from the initial state; unreachable states in a last row", () => {
    const { placed } = layoutLifecycle(graph, "new");
    const row = (id: string) => placed.get(id)!.row;
    expect([row("new"), row("work"), row("hold"), row("done"), row("orphan")]).toEqual([0, 1, 2, 2, 3]);
    expect(placed.get("hold")!.y).toBe(placed.get("done")!.y);
    expect(placed.get("hold")!.x).toBeLessThan(placed.get("done")!.x);
    // `initial` defaults to the first node; an unknown one falls back to it too
    expect(layoutLifecycle(graph, "nope").placed.get("new")!.row).toBe(0);
    expect(layoutLifecycle(graph).placed.get("new")!.row).toBe(0);
  });

  it("LG.layout.2 every transition is routed: down, up (back edge) and a loop for a state to itself", () => {
    const { edges } = layoutLifecycle(graph, "new");
    const kind = Object.fromEntries(edges.map((e) => [e.edge.id, e.kind]));
    expect(kind).toEqual({ t1: "down", t2: "down", t3: "up", t4: "down", t5: expect.stringMatching(/^(up|side)$/), t6: "loop" });
    for (const e of edges) expect(e.d).toMatch(/^M [\d.-]+ [\d.-]+ (L|C) /);
  });

  it("LG.layout.3 a self-loop starts and ends on the state's end edge and bulges past it", () => {
    const { edges, placed } = layoutLifecycle(graph, "new");
    const loop = edges.find((e) => e.edge.id === "t6")!;
    const s = placed.get("work")!;
    const nums = loop.d.match(/-?[\d.]+/g)!.map(Number);
    const xs = nums.filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(s.x + 230);
    expect(Math.max(...xs)).toBeGreaterThan(s.x + 230 + 30);
  });

  it("LG.layout.3b a self-loop's label on the current (or a done) state keeps off the Current badge / done tick above the card's end corner, and stays by its loop", () => {
    // the label is placed just above the loop's top end corner; the badge sticks out of that corner (~13 px up, 6 px out)
    for (const kind of ["current", "done"] as const) {
      const g: LifecycleGraph = {
        nodes: [{ id: "a", label: "Draft", phase: "open", kind: "done" }, { id: "b", label: "Negotiation", phase: "on_hold", kind }],
        edges: [{ id: "go", from: "a", to: "b", label: "Go", taken: true }, { id: "loop", from: "b", to: "b", label: "Counter-offer", taken: false }],
      };
      for (const rtl of [false, true]) {
        const { placed, edges } = layoutLifecycle(g, "a", { rtl });
        const b = placed.get("b")!;
        const loop = edges.find((e) => e.edge.id === "loop")!;
        const lw = "Counter-offer".length * 6.2 + 20;
        const label = { l: loop.lx - lw / 2, r: loop.lx + lw / 2, t: loop.ly - 10, b: loop.ly + 10 };
        // the badge / tick: the card's top end corner (right in LTR, left in RTL), as LifecycleStateCard draws them
        const [inW, outW, up, down] = kind === "current" ? [55, 6, 11, 8] : [12, 10, 10, 14];
        const badge = rtl ? { l: b.x - outW, r: b.x + inW, t: b.y - up, b: b.y + down } : { l: b.x + 230 - inW, r: b.x + 230 + outW, t: b.y - up, b: b.y + down };
        const overlaps = label.l < badge.r && badge.l < label.r && label.t < badge.b && badge.t < label.b;
        expect(overlaps, `${kind} ${rtl ? "rtl" : "ltr"}: label ${JSON.stringify(label)} badge ${JSON.stringify(badge)}`).toBe(false);
        // …and it stays by its loop: just above the card's end corner, not pushed off elsewhere
        expect(loop.ly).toBe(b.y - 14);
        expect(rtl ? loop.lx + lw / 2 : loop.lx - lw / 2).toBeCloseTo(rtl ? b.x - 12 : b.x + 230 + 12, 0);
      }
    }
  });

  it("LG.layout.4 within a row, a pair of opposite arrows is drawn apart (straight lines)", () => {
    const g: LifecycleGraph = lifecycleGraph({
      states: [{ id: "a", label: "A", phase: "open" }, { id: "b", label: "B", phase: "open" }, { id: "c", label: "C", phase: "open" }],
      transitions: [{ id: "ab", from: "a", to: "b" }, { id: "ac", from: "a", to: "c" }, { id: "bc", from: "b", to: "c", label: "go" }, { id: "cb", from: "c", to: "b", label: "back" }],
    }, "a");
    const { edges } = layoutLifecycle(g, "a");
    const bc = edges.find((e) => e.edge.id === "bc")!;
    const cb = edges.find((e) => e.edge.id === "cb")!;
    expect([bc.kind, cb.kind]).toEqual(["row", "row"]);
    const y = (d: string) => Number(d.split(" ")[2]);
    expect(y(bc.d)).not.toBe(y(cb.d));
    expect(bc.ly).not.toBe(cb.ly);
  });

  it("LG.layout.5 right-to-left mirrors every x about the canvas' centre; y and rows stay", () => {
    const ltr = layoutLifecycle(graph, "new");
    const rtl = layoutLifecycle(graph, "new", { rtl: true });
    expect(rtl.width).toBe(ltr.width);
    for (const [id, s] of ltr.placed) {
      const m = rtl.placed.get(id)!;
      expect(m.x).toBeCloseTo(ltr.width - s.x - 230);
      expect([m.y, m.row]).toEqual([s.y, s.row]);
    }
    // the first state of a row is on the right
    expect(rtl.placed.get("hold")!.x).toBeGreaterThan(rtl.placed.get("done")!.x);
    const loop = (l: typeof ltr) => l.edges.find((e) => e.edge.id === "t6")!;
    expect(loop(rtl).lx).toBeCloseTo(ltr.width - loop(ltr).lx);
    expect(loop(rtl).ly).toBe(loop(ltr).ly);
  });

  it("LG.layout.6 deterministic: the same graph gives the same layout; transitions to unknown states are left out", () => {
    const a = layoutLifecycle(graph, "new");
    const b = layoutLifecycle(structuredClone(graph), "new");
    expect([...b.placed.entries()]).toEqual([...a.placed.entries()]);
    expect(b.edges).toEqual(a.edges);
    const withGhost = { ...graph, edges: [...graph.edges, { id: "g", from: "new", to: "ghost", taken: false }] };
    expect(layoutLifecycle(withGhost, "new").edges.map((e) => e.edge.id)).not.toContain("g");
    expect(layoutLifecycle({ nodes: [], edges: [] }).placed.size).toBe(0);
  });
});

describe("LG.view — LifecycleGraphView", () => {
  const mount = (ui: React.ReactNode, language: "en" | "ar" = "en") => render(<ThemeProvider defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>);

  it("LG.view.1 states done / current / future from the model; the phase word and the node's who · when on the card", () => {
    const g = { ...graph, nodes: graph.nodes.map((n) => (n.id === "new" ? { ...n, meta: "Omar · Apr 1", metaTitle: "Omar Ali · 1 Apr 2026" } : n)) };
    const { container } = mount(<LifecycleGraphView graph={g} initial="new" />);
    const kind = (id: string) => container.querySelector(`[data-state="${id}"] [data-kind]`)!.getAttribute("data-kind");
    expect([kind("new"), kind("work"), kind("hold"), kind("done")]).toEqual(["done", "current", "future", "future"]);
    const card = container.querySelector('[data-state="new"] [data-kind]')!;
    expect(card.textContent).toContain("Open · Omar · Apr 1");
    expect(card.getAttribute("title")).toBe("Omar Ali · 1 Apr 2026");
    expect(container.querySelector('[data-state="hold"]')!.textContent).toContain("On Hold");
    // the taken arrow (New → In Progress) in the path colour
    expect(container.querySelector('path[data-edge="t1"]')!.hasAttribute("data-taken")).toBe(true);
    expect(container.querySelector('path[data-edge="t2"]')!.hasAttribute("data-taken")).toBe(false);
  });

  it("LG.view.2 a text alternative: every transition (the self-loop too) as a sentence; states say whether they were reached", () => {
    const { container, getByRole } = mount(<LifecycleGraphView graph={graph} initial="new" />);
    const list = getByRole("list", { name: "Transitions" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "From New to In Progress: Start (Path taken)",
      "From In Progress to On Hold: Pause",
      "From On Hold to In Progress: Resume",
      "From In Progress to Resolved: Resolve",
      "From Resolved to New: Reopen",
      "From In Progress to In Progress: Comment",
    ]);
    expect(getByRole("group", { name: "Lifecycle diagram" })).toBeTruthy();
    expect(container.querySelector('[data-state="new"] .sr-only')!.textContent).toBe("Reached");
    expect(container.querySelector('[data-state="hold"] .sr-only')!.textContent).toBe("Not reached");
    // the drawing itself stays hidden from assistive technology
    expect(container.querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("path[marker-end]").length).toBe(6);
  });

  it("LG.view.3 Arabic: the list from the Arabic catalogue, the diagram right-to-left and mirrored", () => {
    const g = lifecycleGraph({ states: [{ id: "a", label: "جديد", phase: "open" }, { id: "b", label: "مغلق", phase: "closed" }], transitions: [{ id: "x", from: "a", to: "b" }] }, "a");
    const { container, getByRole } = mount(<LifecycleGraphView graph={g} />, "ar");
    const root = container.querySelector("[data-lifecycle-graph]")!;
    expect(root.getAttribute("dir")).toBe("rtl");
    expect(within(getByRole("list", { name: "الانتقالات" })).getByRole("listitem").textContent).toBe("من جديد إلى مغلق");
    // an explicit dir wins over the language
    cleanup();
    const ltr = mount(<LifecycleGraphView graph={g} dir="ltr" />, "ar");
    expect(ltr.container.querySelector("[data-lifecycle-graph]")!.getAttribute("dir")).toBe("ltr");
  });

  it("LG.view.4 two graphs on one page: arrow-head ids are unique and every arrow points at its own graph's marker", () => {
    const { container } = mount(<><LifecycleGraphView graph={graph} /><LifecycleGraphView graph={graph} /></>);
    const ids = [...container.querySelectorAll("marker")].map((m) => m.id);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
    for (const svg of container.querySelectorAll("svg")) {
      const own = new Set([...svg.querySelectorAll("marker")].map((m) => m.id));
      for (const p of svg.querySelectorAll("path[marker-end]")) expect(own.has(p.getAttribute("marker-end")!.slice(5, -1))).toBe(true);
    }
  });

  it("LG.view.5 no transitions (an older server): the states still show and there is no empty list", () => {
    const g = lifecycleGraph({ states: DEF.states, transitions: [] }, "work", []);
    const { container, queryByRole } = mount(<LifecycleGraphView graph={g} />);
    expect(container.querySelectorAll("[data-state]").length).toBe(5);
    expect(queryByRole("list")).toBeNull();
  });
});
