/**
 * 0.8.0-dev.10 — the legacy lifecycle component is gone, the retained lifecycle API is not.
 * (a) `LifecycleBar` / `LifecycleBarProps` are exported neither from `.` nor from `./frappe` (source entries always; the
 *     built entries and their declarations when dist/ is fresh).
 * (b) the retained lifecycle API — the one the CRM imports — is exported: LifecycleRail, LifecycleActions,
 *     lifecycleGraph / lifecycleNext / lifecyclePath / lifecycleTone, the docstatus helpers, FrappeWorkflowActions and the
 *     workflow helpers, and `./lifecycle-diagram` LifecycleFlowDialog.
 * (d) no file under dist/ contains "LifecycleBar".
 * The dist checks run only when dist/ is newer than every file in src/ (i.e. after `npm run build`); otherwise they are
 * skipped and say so — a stale dist/ from an earlier version proves nothing either way.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as core from "../src";
import * as frappe from "../src/frappe";
import * as diagram from "../src/lifecycle-diagram";
// @ts-expect-error — LifecycleBarProps is no longer exported from the core entry
import type { LifecycleBarProps as _CoreProps } from "../src";
// @ts-expect-error — nor from ./frappe
import type { LifecycleBarProps as _FrappeProps } from "../src/frappe";
// the retained types the CRM imports still resolve
import type { DocStatus, DocstatusField, LifecycleDefinition, LifecycleRailNext, LifecycleRailStep, LifecycleStateItem, LifecycleStep } from "../src";
import type { FrappeWorkflowActionsProps, WorkflowInfo, WorkflowState, WorkflowTransition } from "../src/frappe";

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const newest = (d: string) => Math.max(...walk(d).map((f) => fs.statSync(f).mtimeMs));
const distFresh = fs.existsSync(path.join(dist, "index.js")) && fs.statSync(path.join(dist, "index.js")).mtimeMs >= newest(path.join(root, "src"));

const RETAINED_CORE = [
  "LifecycleRail", "LifecycleActions", "lifecycleGraph", "lifecycleNext", "lifecyclePath", "lifecycleTone", "lifecycleRoots", "lifecycleTransitionsFrom",
  "LifecycleDiagramDialog", "LifecycleDiagramLegend", "LifecycleStateCard", "LifecycleEdgeLabel", "LifecycleStepDot", "LIFECYCLE_DIAGRAM_COLORS",
  "ActionBar", "StatusBadge", "toDocStatus", "workflowDocAction", "isEditableAtDocstatus", "DOCSTATUS_LABEL_KEY", "DOCSTATUS_DESCRIPTION_KEY",
];
const RETAINED_FRAPPE = ["FrappeWorkflowActions", "useWorkflow", "lifecycleStates", "lifecycleActions", "workflowLifecycle", "stateEntries"];

describe("(a) LifecycleBar is not exported (0.8.0-dev.10)", () => {
  it("source entries: neither `.` nor `./frappe` has LifecycleBar", () => {
    expect("LifecycleBar" in core).toBe(false);
    expect("LifecycleBar" in frappe).toBe(false);
    expect(Object.keys(core).filter((k) => /LifecycleBar/.test(k))).toEqual([]);
    expect(Object.keys(frappe).filter((k) => /LifecycleBar/.test(k))).toEqual([]);
  });
  it("the source file is gone", () => {
    expect(fs.existsSync(path.join(root, "src/record/LifecycleBar.tsx"))).toBe(false);
  });
  it.skipIf(!distFresh)("built entries: dist/index.js and dist/frappe/index.js have no LifecycleBar; their .d.ts name neither LifecycleBar nor LifecycleBarProps", async () => {
    const builtCore = await import(/* @vite-ignore */ path.join(dist, "index.js"));
    const builtFrappe = await import(/* @vite-ignore */ path.join(dist, "frappe/index.js"));
    expect("LifecycleBar" in builtCore).toBe(false);
    expect("LifecycleBar" in builtFrappe).toBe(false);
    for (const n of RETAINED_CORE) expect(builtCore[n], `dist core export ${n}`).toBeDefined();
    for (const n of RETAINED_FRAPPE) expect(builtFrappe[n], `dist frappe export ${n}`).toBeDefined();
    for (const f of ["index.d.ts", "frappe/index.d.ts", "record/index.d.ts"]) {
      expect(fs.readFileSync(path.join(dist, f), "utf8")).not.toMatch(/LifecycleBar/);
    }
  });
});

describe("(b) the retained lifecycle API is exported", () => {
  it("core: the rail, the actions menu, the graph helpers, the diagram parts, the docstatus helpers", () => {
    for (const n of RETAINED_CORE) expect((core as Record<string, unknown>)[n], `core export ${n}`).toBeDefined();
  });
  it("./frappe: FrappeWorkflowActions and the workflow helpers", () => {
    for (const n of RETAINED_FRAPPE) expect((frappe as Record<string, unknown>)[n], `frappe export ${n}`).toBeDefined();
  });
  it("./lifecycle-diagram: LifecycleFlowDialog", () => {
    expect(diagram.LifecycleFlowDialog).toBeTypeOf("function");
    expect(diagram.LifecycleFlow).toBeTypeOf("function");
  });
  it("the retained types still type-check (compile-time: npm run typecheck)", () => {
    const def: LifecycleDefinition = { states: [{ id: "a", label: "A", phase: "open" }], transitions: [] };
    const step: LifecycleRailStep = { id: "a", label: "A" };
    const next: LifecycleRailNext = { id: "b", label: "B" };
    const item: LifecycleStateItem = { id: "a", label: "A", tone: "neutral" };
    const s: LifecycleStep = "current";
    const ds: DocStatus | DocstatusField | undefined = undefined;
    const wfState: WorkflowState | undefined = undefined; const wfTr: WorkflowTransition | undefined = undefined; const wf: WorkflowInfo | undefined = undefined;
    const variants: NonNullable<FrappeWorkflowActionsProps["variant"]>[] = ["compact", "actions", "rail"];
    expect([def, step, next, item, s, ds, wfState, wfTr, wf, variants.length]).toHaveLength(10);
  });
});

describe("(d) dist scan", () => {
  it.skipIf(!distFresh)("no file under dist/ contains \"LifecycleBar\" (nor the removed stepper props)", () => {
    const files = walk(dist);
    expect(files.length).toBeGreaterThan(100);
    const hits = files.filter((f) => /LifecycleBar|currentMarker|showCurrentEntry/.test(fs.readFileSync(f, "latin1"))).map((f) => path.relative(root, f));
    expect(hits).toEqual([]);
  });
  it("reports whether the dist checks ran", () => {
    if (!distFresh) console.info("[lifecycle-legacy-removed] dist/ is missing or older than src/: the dist checks were skipped — run `npm run build` first");
    expect(true).toBe(true);
  });
});
