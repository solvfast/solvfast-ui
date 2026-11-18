/**
 * Run 1 · I1 — @solvfast/ui/lifecycle-diagram: the React Flow 11 + dagre renderer of Core's lifecycle contract (the
 * CRM's LifecycleDiagramPopup ported onto `lifecycleGraph`). Layout and model in jsdom (dagre runs headless); the
 * canvas renders its state cards. Browser layout / pixels: the CRM diagram parity capture (run1 evidence).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, lifecycleGraph, type LifecycleDefinition } from "../src";
import { LifecycleFlowDialog, lifecycleFlowLayout, roundedPath } from "../src/lifecycle-diagram";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  (globalThis as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly ??= class { m22 = 1; constructor() {} };
});
afterEach(cleanup);

const DEF: LifecycleDefinition = {
  states: [
    { id: "new", label: "New", phase: "open" }, { id: "qual", label: "Qualified", phase: "open" },
    { id: "hold", label: "On hold", phase: "on_hold" }, { id: "won", label: "Won", phase: "closed", color: "#22c55e" }, { id: "lost", label: "Lost", phase: "closed" },
  ],
  transitions: [
    { id: "t1", from: "new", to: "qual", label: "Qualify" }, { id: "t2", from: "qual", to: "won", label: "Win" },
    { id: "t3", from: "qual", to: "lost", label: "Lose" }, { id: "t4", from: "qual", to: "hold", label: "Pause" }, { id: "t5", from: "hold", to: "qual", label: "Resume" },
  ],
};
const phaseLabel = (p: string) => ({ open: "Open", on_hold: "On Hold", closed: "Closed" } as Record<string, string>)[p]!;

describe("I1 lifecycleFlowLayout (dagre)", () => {
  const graph = lifecycleGraph(DEF, "won");
  const flow = lifecycleFlowLayout(graph, { phaseLabel, meta: { new: "Omar · Apr 1", won: "Sara · Apr 9", lost: "never" } });
  it("every state is a node and every transition an edge; done / current / future and the taken path come from the contract", () => {
    expect(flow.nodes.map((n) => [n.id, n.data.kind])).toEqual([["new", "done"], ["qual", "done"], ["hold", "future"], ["won", "current"], ["lost", "future"]]);
    expect(flow.edges.filter((e) => e.data!.taken).map((e) => e.id)).toEqual(["t1", "t2"]);
    expect(flow.edges.map((e) => e.data!.label)).toEqual(["Qualify", "Win", "Lose", "Pause", "Resume"]);
  });
  it("top-to-bottom layout: each transition's target sits below its source (except the loop back); edges follow dagre's waypoints", () => {
    const y = (id: string) => flow.pos[id]!.y;
    expect(y("qual")).toBeGreaterThan(y("new"));
    expect(y("won")).toBeGreaterThan(y("qual"));
    expect(flow.edges.every((e) => e.data!.points.length >= 2)).toBe(true);
  });
  it("the meta line: phase · meta for done / current states, the phase alone for a future one", () => {
    const meta = Object.fromEntries(flow.nodes.map((n) => [n.id, n.data.metaLine]));
    expect(meta).toMatchObject({ new: "Open · Omar · Apr 1", won: "Closed · Sara · Apr 9", lost: "Closed", hold: "On Hold" });
    expect(flow.widths.qual).toBeGreaterThanOrEqual(200);
  });
  it("roundedPath: a polyline with rounded corners", () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 50, y: 50 }])).toMatch(/^M 0,0 L 0,41 Q 0,50 9,50 L 50,50$/);
    expect(roundedPath([{ x: 0, y: 0 }])).toBe("");
  });
});

describe("I1 LifecycleFlowDialog", () => {
  it("Core's dialog (title, legend) with a state card per state; Arabic chrome and phase words from the catalogue", async () => {
    render(<ThemeProvider defaultLanguage="ar" storageKeys={null}>
      <div style={{ width: 800, height: 600 }}>
        <LifecycleFlowDialog open onOpenChange={() => {}} title="دورة حياة الصفقة" graph={lifecycleGraph(DEF, "qual")} dir="rtl" />
      </div>
    </ThemeProvider>);
    const dlg = await screen.findByRole("dialog");
    expect(dlg.textContent).toContain("دورة حياة الصفقة");
    await waitFor(() => expect(dlg.querySelectorAll("[data-kind]").length).toBe(5));
    expect(dlg.querySelector('[data-kind="current"]')!.textContent).toContain("Qualified");
    expect(dlg.textContent).toContain("مفتوح"); // the phase word (catalogue)
    expect(dlg.querySelector("[data-lifecycle-flow]")).not.toBeNull();
  });
});

describe("I1 boundaries: Core never imports the graph engine", () => {
  it("no file outside src/lifecycle-diagram imports reactflow / @dagrejs / the entry; the core index does not export it", () => {
    const root = path.resolve(__dirname, "../src");
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
    const offenders = walk(root).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${path.sep}lifecycle-diagram${path.sep}`))
      .filter((f) => /from\s+["'](reactflow|@reactflow\/|@dagrejs\/|[./]+\/?lifecycle-diagram)/.test(fs.readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));
    expect(pkg.exports["./lifecycle-diagram"]).toBeTruthy();
    expect(pkg.peerDependenciesMeta.reactflow.optional).toBe(true);
    expect(pkg.peerDependenciesMeta["@dagrejs/dagre"].optional).toBe(true);
    expect(pkg.dependencies?.reactflow).toBeUndefined();
  });
});
