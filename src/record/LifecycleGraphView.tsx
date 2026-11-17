import * as React from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { fmt } from "./format";
import { LIFECYCLE_DIAGRAM_COLORS, LifecycleEdgeLabel, LifecycleStateCard, type LifecyclePhase } from "./LifecycleDiagram";
import type { LifecycleGraph } from "./lifecycle";

/**
 * LifecycleGraphView — the dependency-free renderer of the lifecycle model (`LifecycleGraph`, from `lifecycleGraph()`):
 * states in rows from the first one down (each a `LifecycleStateCard`), every transition an arrow with its action
 * (`LifecycleEdgeLabel`), the record's path in the success colour, and zoom / fit buttons. A layered layout
 * (breadth-first from `initial`); states no transition reaches go in a last row; an arrow back up to an earlier row goes
 * straight into the state when it is in another column, else round the side of the canvas; a transition from a state to
 * itself is a small loop on the state's end side. In a right-to-left language the whole diagram is mirrored.
 * Screen readers get the transitions as a list of sentences ("From New to In Progress: Start Work").
 * Put it inside a `LifecycleDiagramDialog`. The optional `./lifecycle-diagram` entry draws the same model with React Flow.
 */

type GraphNode = LifecycleGraph["nodes"][number];
type GraphEdge = LifecycleGraph["edges"][number];

export interface LifecycleGraphViewProps {
  /** The model: `lifecycleGraph(definition, currentId, pathIds?, visitedIds?)`; a node's optional `meta` / `metaTitle`
   *  (who · when) is shown after its phase word. */
  graph: LifecycleGraph;
  /** The first state (the top row). Default: the first node. */
  initial?: string | null;
  /** The "Current" badge text. Default from the ThemeProvider's language. */
  currentLabel?: string;
  /** Text overrides (default: the message catalogue). `transitions` names the screen-reader list of transitions,
   *  `diagram` the diagram itself. */
  labels?: { zoomIn?: string; zoomOut?: string; fit?: string; transitions?: string; diagram?: string };
  /** Text direction. Default: the ThemeProvider's (`rtl` mirrors the layout). */
  dir?: "ltr" | "rtl";
  className?: string;
}

const W = 230;
const H = 58;
const GAP_X = 70;
const GAP_Y = 130;
const PAD = 60;
const SIDE = 46;
const LOOP = 44;

/** A placed state: the node with its top-left corner and its row. */
export type LifecycleLayoutNode = GraphNode & { x: number; y: number; row: number };

/** A routed transition. `kind`: down a row or more, within a row, up into another column, up round the side of the
 *  canvas, or a loop (from a state to itself). `d` is the SVG path; (`lx`, `ly`) the centre of its label. */
export interface LifecycleLayoutEdge {
  edge: GraphEdge;
  kind: "down" | "row" | "up" | "side" | "loop";
  d: string;
  lx: number;
  ly: number;
}

export interface LifecycleLayout {
  placed: Map<string, LifecycleLayoutNode>;
  edges: LifecycleLayoutEdge[];
  width: number;
  height: number;
}

/** Points of a straight line (2) or a cubic curve (4). */
interface Route { edge: GraphEdge; kind: LifecycleLayoutEdge["kind"]; pts: [number, number][]; lx: number; ly: number }

/** Rows by breadth-first distance from the first state; within a row, the order the states were reached in. Then every
 *  transition's route and label point. Pure and deterministic: the same graph gives the same layout. `rtl` mirrors
 *  every x (the first state of a row on the right, side lanes and loops on the other side). Transitions to or from an
 *  unknown state are left out. */
export function layoutLifecycle(graph: LifecycleGraph, initial?: string | null, opts: { rtl?: boolean } = {}): LifecycleLayout {
  const { nodes, edges: all } = graph;
  const keys = new Set(nodes.map((s) => s.id));
  const start = initial && keys.has(initial) ? initial : nodes[0]?.id;
  const row = new Map<string, number>();
  if (start) {
    row.set(start, 0);
    const queue = [start];
    while (queue.length) {
      const at = queue.shift()!;
      for (const t of all) {
        if (t.from === at && keys.has(t.to) && !row.has(t.to)) {
          row.set(t.to, row.get(at)! + 1);
          queue.push(t.to);
        }
      }
    }
  }
  const last = Math.max(-1, ...row.values());
  for (const s of nodes) if (!row.has(s.id)) row.set(s.id, last + 1);
  const rows: GraphNode[][] = [];
  const order = [start, ...all.map((t) => t.to), ...nodes.map((s) => s.id)].filter((k, i, list) => k && list.indexOf(k) === i) as string[];
  const byKey = new Map(nodes.map((s) => [s.id, s]));
  for (const k of order) {
    const s = byKey.get(k);
    if (!s) continue;
    (rows[row.get(k)!] ??= []).push(s);
  }
  const widest = Math.max(1, ...rows.map((r) => r?.length ?? 0));
  const width = widest * W + (widest - 1) * GAP_X + PAD * 2 + SIDE * 2;
  const placed = new Map<string, LifecycleLayoutNode>();
  rows.forEach((r, i) => {
    if (!r) return;
    const span = r.length * W + (r.length - 1) * GAP_X;
    const left = (width - span) / 2;
    r.forEach((s, j) => placed.set(s.id, { ...s, row: i, x: left + j * (W + GAP_X), y: PAD + i * (H + GAP_Y) }));
  });
  const height = PAD * 2 + rows.length * H + Math.max(0, rows.length - 1) * GAP_Y;
  const routes = spaceLabels(routesOf(placed, all, width), placed);
  // Right-to-left: mirror every x about the canvas' centre line (a state's left edge becomes width − x − W).
  const mx = (x: number) => (opts.rtl ? width - x : x);
  if (opts.rtl) for (const [k, s] of placed) placed.set(k, { ...s, x: width - s.x - W });
  const edges = routes.map((r): LifecycleLayoutEdge => {
    const p = r.pts.map(([x, y]) => `${round(mx(x))} ${round(y)}`);
    const d = p.length === 2 ? `M ${p[0]} L ${p[1]}` : `M ${p[0]} C ${p[1]}, ${p[2]}, ${p[3]}`;
    return { edge: r.edge, kind: r.kind, d, lx: round(mx(r.lx)), ly: round(r.ly) };
  });
  return { placed, edges, width, height };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Every arrow's route and label point (left-to-right coordinates). Down a row: from the bottom to the top (several into
 *  one state spread along its top). Within a row: straight, a pair of opposite arrows a little apart. Up to an earlier
 *  row: straight up into the bottom when the states are in different columns, else round the side of the canvas they
 *  are on. From a state to itself: a loop on its right side (several loops nest). */
function routesOf(placed: Map<string, LifecycleLayoutNode>, transitions: GraphEdge[], width: number): Route[] {
  const out: Route[] = [];
  const known = transitions.filter((t) => placed.has(t.from) && placed.has(t.to));
  const ok = known.filter((t) => t.from !== t.to);
  const into = new Map<string, GraphEdge[]>();
  const outOf = new Map<string, GraphEdge[]>();
  for (const t of ok) {
    (into.get(t.to) ?? into.set(t.to, []).get(t.to)!).push(t);
    (outOf.get(t.from) ?? outOf.set(t.from, []).get(t.from)!).push(t);
  }
  const spread = (list: GraphEdge[], t: GraphEdge) =>
    (list.indexOf(t) - (list.length - 1) / 2) * Math.min(44, (W - 40) / Math.max(1, list.length));
  const centre = (s: LifecycleLayoutNode) => s.x + W / 2;
  const lanes = { left: 0, right: 0 };
  const loops = new Map<string, number>();
  for (const t of known) {
    const a = placed.get(t.from)!;
    const b = placed.get(t.to)!;
    if (t.from === t.to) {
      const n = loops.get(t.from) ?? 0;
      loops.set(t.from, n + 1);
      const reach = LOOP + n * 14;
      const x = a.x + W;
      out.push({ edge: t, kind: "loop", pts: [[x, a.y + 14], [x + reach, a.y - 4], [x + reach, a.y + H + 4], [x + 4, a.y + H - 14]], lx: x + reach * 0.75, ly: a.y - 14 - n * 22 });
    } else if (b.row > a.row) {
      const downIn = (into.get(t.to) ?? []).filter((x) => placed.get(x.from)!.row < b.row).sort((p, q) => placed.get(p.from)!.x - placed.get(q.from)!.x);
      const downOut = (outOf.get(t.from) ?? []).filter((x) => placed.get(x.to)!.row > a.row).sort((p, q) => placed.get(p.to)!.x - placed.get(q.to)!.x);
      const x1 = centre(a) + spread(downOut, t);
      const x2 = centre(b) + spread(downIn, t);
      const y1 = a.y + H;
      const y2 = b.y - 4;
      const mid = (y1 + y2) / 2;
      out.push({ edge: t, kind: "down", pts: [[x1, y1], [x1, mid], [x2, mid], [x2, y2]], lx: x1 + (x2 - x1) * 0.6, ly: y1 + (y2 - y1) * 0.6 });
    } else if (b.row === a.row) {
      const rightward = b.x > a.x;
      const paired = ok.some((x) => x.from === t.to && x.to === t.from);
      const dy = paired ? (rightward ? -9 : 9) : 0;
      const x1 = rightward ? a.x + W : a.x;
      const x2 = rightward ? b.x - 4 : b.x + W + 4;
      const y = a.y + H / 2 + dy;
      out.push({ edge: t, kind: "row", pts: [[x1, y], [x2, y]], lx: (x1 + x2) / 2, ly: y + (paired ? (rightward ? -12 : 12) : -12) });
    } else if (Math.abs(centre(a) - centre(b)) > W / 2) {
      const upOut = (outOf.get(t.from) ?? []).filter((x) => placed.get(x.to)!.row < a.row);
      const x1 = centre(a) + spread(upOut, t) + (centre(b) > centre(a) ? 30 : -30);
      const x2 = centre(b) + (centre(a) > centre(b) ? 40 : -40);
      const y1 = a.y;
      const y2 = b.y + H + 4;
      const mid = (y1 + y2) / 2;
      out.push({ edge: t, kind: "up", pts: [[x1, y1], [x1, mid], [x2, mid], [x2, y2]], lx: (x1 + x2) / 2, ly: mid });
    } else {
      const right = centre(a) >= width / 2;
      const lane = right ? Math.max(a.x, b.x) + W + SIDE + lanes.right++ * 16 : Math.min(a.x, b.x) - SIDE - lanes.left++ * 16;
      const x1 = right ? a.x + W : a.x;
      const x2 = right ? b.x + W + 4 : b.x - 4;
      const y1 = a.y + H / 2;
      const y2 = b.y + H / 2;
      out.push({ edge: t, kind: "side", pts: [[x1, y1], [lane, y1], [lane, y2], [x2, y2]], lx: lane - (right ? 8 : -8), ly: (y1 + y2) / 2 });
    }
  }
  return out;
}

/** Labels moved down (then up) out of each other's way and off the states, by their rough size. An unlabelled arrow
 *  has no label to place. */
function spaceLabels(routes: Route[], placed: Map<string, LifecycleLayoutNode>): Route[] {
  const boxes: { x: number; y: number; w: number; h: number }[] = [...placed.values()].map((s) => ({ x: s.x + W / 2, y: s.y + H / 2, w: W + 8, h: H + 8 }));
  const hits = (x: number, y: number, w: number, h: number) =>
    boxes.some((b) => Math.abs(b.x - x) * 2 < b.w + w && Math.abs(b.y - y) * 2 < b.h + h);
  return routes.map((r) => {
    if (!r.edge.label) return r;
    const w = r.edge.label.length * 6.2 + 20;
    const h = 20;
    let y = r.ly;
    for (let i = 1; i < 12 && hits(r.lx, y, w, h); i++) y = r.ly + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (h + 4);
    boxes.push({ x: r.lx, y, w, h });
    return { ...r, ly: y };
  });
}

const PHASE_KEY: Record<LifecyclePhase, "lcPhaseOpen" | "lcPhaseOnHold" | "lcPhaseClosed"> = {
  open: "lcPhaseOpen", on_hold: "lcPhaseOnHold", closed: "lcPhaseClosed",
};

export function LifecycleGraphView({ graph, initial, currentLabel, labels, dir, className }: LifecycleGraphViewProps) {
  const { t, isRTL } = useLocale();
  const direction = dir ?? (isRTL ? "rtl" : "ltr");
  const rtl = direction === "rtl";
  const { placed, edges, width, height } = React.useMemo(() => layoutLifecycle(graph, initial, { rtl }), [graph, initial, rtl]);
  const box = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  // One id per mounted graph: two graphs on a page must not share (and steal) each other's arrow heads.
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const arrowId = `lc-arrow-${uid}`;
  const takenId = `lc-arrow-taken-${uid}`;
  const fit = React.useCallback(() => {
    const el = box.current;
    if (!el) return;
    setScale(Math.min(1, Math.max(0.3, Math.min((el.clientWidth - 24) / width, (el.clientHeight - 24) / height))));
  }, [width, height]);
  React.useLayoutEffect(() => { fit(); }, [fit]);
  const zoom = (by: number) => setScale((s) => Math.min(2, Math.max(0.3, Math.round((s + by) * 10) / 10)));
  const marker = (id: string, color: string) => (
    <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
    </marker>
  );
  const control = "flex h-8 w-8 items-center justify-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const nameOf = (id: string) => placed.get(id)?.label ?? id;
  const sentence = (e: GraphEdge) => {
    const s = e.label ? fmt(t("lcTransitionItem"), nameOf(e.from), nameOf(e.to), e.label) : fmt(t("lcTransitionItemPlain"), nameOf(e.from), nameOf(e.to));
    return e.taken ? `${s} (${t("lcPathTaken")})` : s;
  };

  return (
    <div ref={box} dir={direction} role="group" aria-label={labels?.diagram ?? t("lcDiagram")} data-lifecycle-graph data-dir={direction}
      className={cn("absolute inset-0 overflow-auto", className)}
      style={{ backgroundImage: `radial-gradient(${LIFECYCLE_DIAGRAM_COLORS.grid} 1px, transparent 1px)`, backgroundSize: "18px 18px" }}>
      <div className="relative mx-auto" style={{ width: width * scale, height: height * scale }}>
        {/* The canvas is physical (left / top in px, already mirrored for right-to-left), so it is anchored left. */}
        <div className="absolute left-0 top-0 origin-top-left" style={{ width, height, transform: `scale(${scale})` }}>
          <svg width={width} height={height} className="absolute inset-0" aria-hidden focusable="false">
            <defs>
              {marker(arrowId, LIFECYCLE_DIAGRAM_COLORS.edge)}
              {marker(takenId, LIFECYCLE_DIAGRAM_COLORS.taken)}
            </defs>
            {edges.map(({ edge: e, d, kind }) => (
              <path key={e.id} d={d} fill="none" data-taken={e.taken ? "" : undefined} data-edge={e.id} data-edge-kind={kind}
                stroke={e.taken ? LIFECYCLE_DIAGRAM_COLORS.taken : LIFECYCLE_DIAGRAM_COLORS.edge} strokeWidth={e.taken ? 2.4 : 1.6}
                markerEnd={`url(#${e.taken ? takenId : arrowId})`} />
            ))}
          </svg>
          {edges.map(({ edge: e, lx, ly }) => e.label ? (
            <div key={`l-${e.id}`} aria-hidden className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: lx, top: ly }}>
              <LifecycleEdgeLabel label={e.label} taken={e.taken} />
            </div>
          ) : null)}
          {[...placed.values()].map((s) => (
            <div key={s.id} className="absolute" style={{ left: s.x, top: s.y, width: W }} data-state={s.id}>
              <LifecycleStateCard label={s.label} meta={[t(PHASE_KEY[s.phase] ?? "lcPhaseOpen"), s.meta].filter(Boolean).join(" · ")}
                title={s.metaTitle} kind={s.kind} phase={s.phase} currentLabel={currentLabel} className="w-full" />
              {s.kind !== "current" ? <span className="sr-only">{s.kind === "done" ? t("lcReached") : t("lcNotReached")}</span> : null}
            </div>
          ))}
        </div>
      </div>
      {edges.length ? (
        <ul className="sr-only" aria-label={labels?.transitions ?? t("lcTransitions")} data-lifecycle-transitions>
          {edges.map(({ edge: e }) => <li key={`a-${e.id}`}>{sentence(e)}</li>)}
        </ul>
      ) : null}
      <div className="sticky bottom-3 float-end me-3 flex w-fit flex-col gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-md">
        <button type="button" className={control} onClick={() => zoom(0.1)} aria-label={labels?.zoomIn ?? t("lcZoomIn")} title={labels?.zoomIn ?? t("lcZoomIn")}><Plus className="h-4 w-4" /></button>
        <button type="button" className={control} onClick={() => zoom(-0.1)} aria-label={labels?.zoomOut ?? t("lcZoomOut")} title={labels?.zoomOut ?? t("lcZoomOut")}><Minus className="h-4 w-4" /></button>
        <button type="button" className={control} onClick={fit} aria-label={labels?.fit ?? t("lcFit")} title={labels?.fit ?? t("lcFit")}><Maximize className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
