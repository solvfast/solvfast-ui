/**
 * @solvfast/ui/lifecycle-diagram — the full-lifecycle diagram RENDERER (Run 1 I1, owner decision E3 option B).
 *
 * Core ships the lifecycle contract (`lifecycleGraph`) and the diagram's look (`LifecycleDiagramDialog`,
 * `LifecycleStateCard`, `LifecycleEdgeLabel`, `LIFECYCLE_DIAGRAM_COLORS`) but no graph engine. This separate entry draws
 * a `LifecycleGraph` with React Flow 11 and dagre — both OPTIONAL peer dependencies, imported only here (never by Core;
 * scripts/check-boundaries.mjs enforces it). Port of the CRM's LifecycleDiagramPopup (the reference): dagre top-to-bottom
 * layout, orthogonal rounded edges that follow dagre's waypoints, the path taken highlighted, read-only canvas (pan /
 * zoom), fit to view, re-centred on the current state for large graphs. Its CRM types are replaced by the contract.
 *
 * Styles: import "reactflow/dist/style.css" (the engine's own) and "@solvfast/ui/lifecycle-diagram.css" (its zoom
 * controls on the theme tokens) next to the package stylesheets.
 */
import * as React from "react";
import dagre from "@dagrejs/dagre";
import ReactFlow, {
  Background, Controls, ReactFlowProvider, BaseEdge, EdgeLabelRenderer, Handle, Position, MarkerType,
  type Edge, type Node, type NodeProps, type EdgeProps, type ReactFlowInstance,
} from "reactflow";
import {
  LifecycleDiagramDialog, LifecycleEdgeLabel, LifecycleStateCard, LIFECYCLE_DIAGRAM_COLORS,
  type LifecycleDiagramDialogProps, type LifecycleNodeKind, type LifecyclePhase,
} from "../record/LifecycleDiagram";
import type { LifecycleGraph } from "../record/lifecycle";
import { useLocale } from "../theme/ThemeProvider";

const NODE_H = 58;
const PAD_LEAD = 12;
const ICON_W = 30;
const ICON_GAP = 10;
const PAD_TRAIL = 18;

interface StateNodeData { name: string; phase: LifecyclePhase; kind: LifecycleNodeKind; metaLine: string; width: number; tooltip?: string; currentLabel?: string }

const HANDLE = "!opacity-0 !pointer-events-none !w-1 !h-1 !min-w-0 !min-h-0 !border-0 !bg-transparent";
function StateNode({ data }: NodeProps<StateNodeData>) {
  return (
    <LifecycleStateCard label={data.name} meta={data.metaLine} kind={data.kind} phase={data.phase} currentLabel={data.currentLabel} title={data.tooltip}
      style={{ width: data.width, height: NODE_H }}>
      <Handle type="target" position={Position.Top} className={HANDLE} />
      <Handle type="source" position={Position.Bottom} className={HANDLE} />
    </LifecycleStateCard>
  );
}
const nodeTypes = { recordState: StateNode };

interface Pt { x: number; y: number }
interface EdgeData { points: Pt[]; taken: boolean; label?: string; labelPos?: Pt }

/** A polyline with rounded corners (radius r), as an SVG path. */
export function roundedPath(pts: Pt[], r = 9): string {
  if (pts.length < 2) return "";
  const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
  const unit = (from: Pt, to: Pt) => { const d = dist(from, to) || 1; return { x: (to.x - from.x) / d, y: (to.y - from.y) / d }; };
  let d = `M ${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1]!, p1 = pts[i]!, p2 = pts[i + 1]!;
    const d1 = Math.min(r, dist(p0, p1) / 2), d2 = Math.min(r, dist(p1, p2) / 2);
    const u1 = unit(p0, p1), u2 = unit(p1, p2);
    const a = { x: p1.x - u1.x * d1, y: p1.y - u1.y * d1 };
    const b = { x: p1.x + u2.x * d2, y: p1.y + u2.y * d2 };
    d += ` L ${a.x},${a.y} Q ${p1.x},${p1.y} ${b.x},${b.y}`;
  }
  const last = pts[pts.length - 1]!;
  return `${d} L ${last.x},${last.y}`;
}

function FlowEdge({ id, markerEnd, data }: EdgeProps<EdgeData>) {
  if (!data) return null;
  const stroke = data.taken ? LIFECYCLE_DIAGRAM_COLORS.taken : LIFECYCLE_DIAGRAM_COLORS.edge;
  return (
    <>
      <BaseEdge id={id} path={roundedPath(data.points)} markerEnd={markerEnd} style={{ stroke, strokeWidth: data.taken ? 2.2 : 1.5 }} />
      {data.label && data.labelPos && (
        <EdgeLabelRenderer>
          <div className="nodrag nopan" style={{ position: "absolute", transform: `translate(-50%,-50%) translate(${data.labelPos.x}px,${data.labelPos.y}px)`, pointerEvents: "none" }}>
            <LifecycleEdgeLabel label={data.label} taken={data.taken} />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
const edgeTypes = { flow: FlowEdge };

const textW = (s: string, px: number) => s.length * px * 0.58;

export interface LifecycleFlowOptions {
  /** stateId → an extra meta line part for done / current states (e.g. "Omar · Apr 12", as the rail shows it). */
  meta?: Record<string, string>;
  /** The phase words on each card's second line (default: the catalogue's Open / On hold / Closed). */
  phaseLabels?: Partial<Record<LifecyclePhase, string>>;
  /** The current card's badge (default: the catalogue's "Current"). */
  currentLabel?: string;
}

/** dagre layout → React Flow nodes and edges (exported for tests and custom canvases). */
export function lifecycleFlowLayout(graph: LifecycleGraph, opts: LifecycleFlowOptions & { phaseLabel: (p: LifecyclePhase) => string }) {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const edgesIn = graph.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const metaLineOf = (n: LifecycleGraph["nodes"][number]) => {
    const phase = opts.phaseLabel(n.phase);
    const extra = opts.meta?.[n.id];
    return n.kind !== "future" && extra ? `${phase} · ${extra}` : phase;
  };
  // width: the longer of the name and the meta line; a target with ≥ 2 incoming labels widens so its pills don't collide
  const incoming = new Map<string, string[]>();
  for (const e of edgesIn) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.label ?? ""]);
  const widthOf = (n: LifecycleGraph["nodes"][number]) => {
    let w = Math.max(200, PAD_LEAD + ICON_W + ICON_GAP + Math.max(textW(n.label, 13), textW(metaLineOf(n), 11)) + PAD_TRAIL);
    const ins = incoming.get(n.id) ?? [];
    if (ins.length >= 2) w = Math.max(w, ins.length * Math.max(...ins.map((l) => textW(l, 10) + 20)) + (ins.length + 1) * 16);
    return Math.ceil(w);
  };

  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 110, marginx: 48, marginy: 48, ranker: "network-simplex" });
  g.setDefaultEdgeLabel(() => ({}));
  const widths: Record<string, number> = {};
  for (const n of graph.nodes) { widths[n.id] = widthOf(n); g.setNode(n.id, { width: widths[n.id], height: NODE_H }); }
  for (const e of edgesIn) g.setEdge(e.from, e.to, {}, e.id);
  dagre.layout(g);

  const pos: Record<string, Pt> = {};
  const nodes: Node<StateNodeData>[] = graph.nodes.map((n) => {
    const l = g.node(n.id) as { x: number; y: number };
    const topLeft = { x: l.x - widths[n.id]! / 2, y: l.y - NODE_H / 2 };
    pos[n.id] = topLeft;
    return {
      id: n.id, type: "recordState", position: topLeft, draggable: false, connectable: false, selectable: false, focusable: false,
      data: { name: n.label, phase: n.phase, kind: n.kind, metaLine: metaLineOf(n), width: widths[n.id]!, tooltip: opts.meta?.[n.id] ? `${n.label} · ${opts.meta[n.id]}` : undefined, currentLabel: opts.currentLabel },
    };
  });
  const edges: Edge<EdgeData>[] = edgesIn.map((e) => {
    const ge = g.edge(e.from, e.to, e.id) as { points?: Pt[] } | undefined;
    const raw = (ge?.points ?? []).map((p) => ({ x: p.x, y: p.y }));
    const src = pos[e.from]!, tgt = pos[e.to]!;
    const pts: Pt[] = raw.length >= 2 ? raw : [{ x: src.x + widths[e.from]! / 2, y: src.y + NODE_H }, { x: tgt.x + widths[e.to]! / 2, y: tgt.y }];
    const entry = pts[pts.length - 1]!;
    const colour = e.taken ? LIFECYCLE_DIAGRAM_COLORS.taken : LIFECYCLE_DIAGRAM_COLORS.edge;
    return {
      id: e.id, source: e.from, target: e.to, type: "flow",
      data: { points: pts, taken: e.taken, label: e.label || undefined, labelPos: e.label ? { x: entry.x, y: entry.y - 26 } : undefined },
      markerEnd: { type: MarkerType.ArrowClosed, color: colour, width: 16, height: 16 },
    };
  });
  return { nodes, edges, pos, widths };
}

export interface LifecycleFlowProps extends LifecycleFlowOptions {
  /** The diagram model: `lifecycleGraph(definition, currentId, pathIds?, visitedIds?)` from `@solvfast/ui`. */
  graph: LifecycleGraph;
  /** Re-centre on the current state when the graph has more states than this (default 10, as the CRM). */
  focusCurrentAbove?: number;
  /** Where the zoom controls sit (default: bottom end — bottom-left in RTL). */
  dir?: "ltr" | "rtl";
  className?: string;
}

function Canvas({ graph, meta, phaseLabels, currentLabel, focusCurrentAbove = 10, dir }: LifecycleFlowProps) {
  const { t, direction } = useLocale();
  const phaseLabel = React.useCallback((p: LifecyclePhase) => phaseLabels?.[p] ?? t(p === "open" ? "lcPhaseOpen" : p === "on_hold" ? "lcPhaseOnHold" : "lcPhaseClosed"), [phaseLabels, t]);
  const { nodes, edges, pos, widths } = React.useMemo(
    () => lifecycleFlowLayout(graph, { meta, phaseLabels, currentLabel: currentLabel ?? t("lcCurrent"), phaseLabel }),
    [graph, meta, phaseLabels, currentLabel, phaseLabel, t],
  );
  const current = graph.nodes.find((n) => n.kind === "current")?.id;
  const onInit = (inst: ReactFlowInstance) => {
    window.requestAnimationFrame(() => {
      inst.fitView({ padding: 0.2, duration: 0 });
      const cur = current ? pos[current] : undefined;
      if (cur && graph.nodes.length > focusCurrentAbove) inst.setCenter(cur.x + widths[current!]! / 2, cur.y + NODE_H / 2, { zoom: 0.8, duration: 0 });
    });
  };
  const rtl = (dir ?? direction) === "rtl";
  return (
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onInit={onInit} minZoom={0.12} maxZoom={1.6}
      nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} nodesFocusable={false} edgesFocusable={false}
      panOnDrag zoomOnScroll proOptions={{ hideAttribution: true }}>
      <Background gap={18} size={1.5} color={LIFECYCLE_DIAGRAM_COLORS.grid} />
      <Controls showInteractive={false} position={rtl ? "bottom-left" : "bottom-right"} />
    </ReactFlow>
  );
}

/** The diagram canvas (fills its positioned parent). */
export function LifecycleFlow({ className, ...props }: LifecycleFlowProps) {
  return (
    <div className={["lifecycle-diagram-canvas absolute inset-0", className].filter(Boolean).join(" ")} data-lifecycle-flow="">
      <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>
    </div>
  );
}

export interface LifecycleFlowDialogProps extends LifecycleFlowProps, Omit<LifecycleDiagramDialogProps, "children" | "className"> {
  /** The dialog's classes (the canvas takes `className`). */
  dialogClassName?: string;
}

/** Core's LifecycleDiagramDialog with the React Flow canvas inside — the CRM's full-lifecycle popup, on the contract. */
export function LifecycleFlowDialog({ open, onOpenChange, title, subtitle, legendLabels, closeLabel, dir, dialogClassName, ...flow }: LifecycleFlowDialogProps) {
  return (
    <LifecycleDiagramDialog open={open} onOpenChange={onOpenChange} title={title} subtitle={subtitle} legendLabels={legendLabels} closeLabel={closeLabel} dir={dir} className={dialogClassName}>
      <LifecycleFlow dir={dir} {...flow} />
    </LifecycleDiagramDialog>
  );
}
