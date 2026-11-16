import * as React from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { LIFECYCLE_DIAGRAM_COLORS, LifecycleEdgeLabel, LifecycleStateCard, type LifecycleNodeKind, type LifecyclePhase } from "./LifecycleDiagram";

/**
 * LifecycleGraph — a lifecycle drawn as the full diagram: states in rows from the first one down (each a
 * `LifecycleStateCard`), every transition an arrow with its action (`LifecycleEdgeLabel`), the record's path in the
 * success colour, and zoom / fit buttons. Dependency-free: a layered layout (breadth-first from `initial`), states no
 * transition reaches go in a last row, and an arrow back up to an earlier row curves along the side.
 * Put it inside a `LifecycleDiagramDialog`.
 */

export interface LifecycleGraphState {
  key: string;
  label: string;
  /** Second line, e.g. "Open · Omar · Apr 13". */
  meta?: string;
  metaTitle?: string;
  kind: LifecycleNodeKind;
  phase?: LifecyclePhase;
}

export interface LifecycleGraphTransition {
  key: string;
  from: string;
  to: string;
  label: string;
  /** On the record's path. */
  taken?: boolean;
}

export interface LifecycleGraphProps {
  states: LifecycleGraphState[];
  transitions: LifecycleGraphTransition[];
  /** The first state (the top row). Default: the first of `states`. */
  initial?: string | null;
  currentLabel?: string;
  labels?: { zoomIn?: string; zoomOut?: string; fit?: string };
  className?: string;
}

const W = 230;
const H = 58;
const GAP_X = 70;
const GAP_Y = 130;
const PAD = 60;
const SIDE = 46;

type Placed = LifecycleGraphState & { x: number; y: number; row: number };

/** Rows by breadth-first distance from the first state; within a row, the order the states were reached in. */
export function layoutLifecycle(states: LifecycleGraphState[], transitions: LifecycleGraphTransition[], initial?: string | null) {
  const keys = new Set(states.map((s) => s.key));
  const start = initial && keys.has(initial) ? initial : states[0]?.key;
  const row = new Map<string, number>();
  if (start) {
    row.set(start, 0);
    const queue = [start];
    while (queue.length) {
      const at = queue.shift()!;
      for (const t of transitions) {
        if (t.from === at && keys.has(t.to) && !row.has(t.to)) {
          row.set(t.to, row.get(at)! + 1);
          queue.push(t.to);
        }
      }
    }
  }
  const last = Math.max(-1, ...row.values());
  for (const s of states) if (!row.has(s.key)) row.set(s.key, last + 1);
  const rows: LifecycleGraphState[][] = [];
  const order = [start, ...transitions.map((t) => t.to), ...states.map((s) => s.key)].filter((k, i, all) => k && all.indexOf(k) === i) as string[];
  const byKey = new Map(states.map((s) => [s.key, s]));
  for (const k of order) {
    const s = byKey.get(k);
    if (!s) continue;
    (rows[row.get(k)!] ??= []).push(s);
  }
  const widest = Math.max(1, ...rows.map((r) => r?.length ?? 0));
  const width = widest * W + (widest - 1) * GAP_X + PAD * 2 + SIDE * 2;
  const placed = new Map<string, Placed>();
  rows.forEach((r, i) => {
    if (!r) return;
    const span = r.length * W + (r.length - 1) * GAP_X;
    const left = (width - span) / 2;
    r.forEach((s, j) => placed.set(s.key, { ...s, row: i, x: left + j * (W + GAP_X), y: PAD + i * (H + GAP_Y) }));
  });
  const height = PAD * 2 + rows.length * H + Math.max(0, rows.length - 1) * GAP_Y;
  return { placed, width, height };
}

interface Edge { t: LifecycleGraphTransition; d: string; lx: number; ly: number }

/** Every arrow's path and label point. Down a row: from the bottom to the top (several into one state spread along
 *  its top). Within a row: straight, a pair of opposite arrows a little apart. Up to an earlier row: straight up into
 *  the bottom when the states are in different columns, else round the side of the canvas they are on. */
function edgesOf(placed: Map<string, Placed>, transitions: LifecycleGraphTransition[], width: number): Edge[] {
  const out: Edge[] = [];
  const ok = transitions.filter((t) => placed.has(t.from) && placed.has(t.to) && t.from !== t.to);
  const into = new Map<string, LifecycleGraphTransition[]>();
  const outOf = new Map<string, LifecycleGraphTransition[]>();
  for (const t of ok) {
    (into.get(t.to) ?? into.set(t.to, []).get(t.to)!).push(t);
    (outOf.get(t.from) ?? outOf.set(t.from, []).get(t.from)!).push(t);
  }
  const spread = (list: LifecycleGraphTransition[], t: LifecycleGraphTransition) =>
    (list.indexOf(t) - (list.length - 1) / 2) * Math.min(44, (W - 40) / Math.max(1, list.length));
  const centre = (s: Placed) => s.x + W / 2;
  const lanes = { left: 0, right: 0 };
  for (const t of ok) {
    const a = placed.get(t.from)!;
    const b = placed.get(t.to)!;
    if (b.row > a.row) {
      const downIn = (into.get(t.to) ?? []).filter((x) => placed.get(x.from)!.row < b.row).sort((p, q) => placed.get(p.from)!.x - placed.get(q.from)!.x);
      const downOut = (outOf.get(t.from) ?? []).filter((x) => placed.get(x.to)!.row > a.row).sort((p, q) => placed.get(p.to)!.x - placed.get(q.to)!.x);
      const x1 = centre(a) + spread(downOut, t);
      const x2 = centre(b) + spread(downIn, t);
      const y1 = a.y + H;
      const y2 = b.y - 4;
      const mid = (y1 + y2) / 2;
      out.push({ t, d: `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`, lx: x1 + (x2 - x1) * 0.6, ly: y1 + (y2 - y1) * 0.6 });
    } else if (b.row === a.row) {
      const rightward = b.x > a.x;
      const paired = ok.some((x) => x.from === t.to && x.to === t.from);
      const dy = paired ? (rightward ? -9 : 9) : 0;
      const x1 = rightward ? a.x + W : a.x;
      const x2 = rightward ? b.x - 4 : b.x + W + 4;
      const y = a.y + H / 2 + dy;
      out.push({ t, d: `M ${x1} ${y} L ${x2} ${y}`, lx: (x1 + x2) / 2, ly: y + (paired ? (rightward ? -12 : 12) : -12) });
    } else if (Math.abs(centre(a) - centre(b)) > W / 2) {
      const upOut = (outOf.get(t.from) ?? []).filter((x) => placed.get(x.to)!.row < a.row);
      const x1 = centre(a) + spread(upOut, t) + (centre(b) > centre(a) ? 30 : -30);
      const x2 = centre(b) + (centre(a) > centre(b) ? 40 : -40);
      const y1 = a.y;
      const y2 = b.y + H + 4;
      const mid = (y1 + y2) / 2;
      out.push({ t, d: `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`, lx: (x1 + x2) / 2, ly: mid });
    } else {
      const right = centre(a) >= width / 2;
      const lane = right ? Math.max(a.x, b.x) + W + SIDE + lanes.right++ * 16 : Math.min(a.x, b.x) - SIDE - lanes.left++ * 16;
      const x1 = right ? a.x + W : a.x;
      const x2 = right ? b.x + W + 4 : b.x - 4;
      const y1 = a.y + H / 2;
      const y2 = b.y + H / 2;
      out.push({ t, d: `M ${x1} ${y1} C ${lane} ${y1}, ${lane} ${y2}, ${x2} ${y2}`, lx: lane - (right ? 8 : -8), ly: (y1 + y2) / 2 });
    }
  }
  return spaceLabels(out, placed);
}

/** Labels moved down (then up) out of each other's way and off the states, by their rough size. */
function spaceLabels(edges: Edge[], placed: Map<string, Placed>): Edge[] {
  const size = (e: Edge) => ({ w: e.t.label.length * 6.2 + 20, h: 20 });
  const boxes: { x: number; y: number; w: number; h: number }[] = [...placed.values()].map((s) => ({ x: s.x + W / 2, y: s.y + H / 2, w: W + 8, h: H + 8 }));
  const hits = (x: number, y: number, w: number, h: number) =>
    boxes.some((b) => Math.abs(b.x - x) * 2 < b.w + w && Math.abs(b.y - y) * 2 < b.h + h);
  return edges.map((e) => {
    const { w, h } = size(e);
    let y = e.ly;
    for (let i = 1; i < 12 && hits(e.lx, y, w, h); i++) y = e.ly + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (h + 4);
    boxes.push({ x: e.lx, y, w, h });
    return { ...e, ly: y };
  });
}

export function LifecycleGraph({ states, transitions, initial, currentLabel, labels, className }: LifecycleGraphProps) {
  const { t } = useLocale();
  const { placed, width, height } = React.useMemo(() => layoutLifecycle(states, transitions, initial), [states, transitions, initial]);
  const edges = React.useMemo(() => edgesOf(placed, transitions, width), [placed, transitions, width]);
  const box = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
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

  return (
    <div ref={box} dir="ltr" data-lifecycle-graph className={cn("absolute inset-0 overflow-auto", className)}
      style={{ backgroundImage: `radial-gradient(${LIFECYCLE_DIAGRAM_COLORS.grid} 1px, transparent 1px)`, backgroundSize: "18px 18px" }}>
      <div className="relative mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div className="absolute start-0 top-0 origin-top-left" style={{ width, height, transform: `scale(${scale})` }}>
          <svg width={width} height={height} className="absolute inset-0" aria-hidden>
            <defs>
              {marker("lc-arrow", LIFECYCLE_DIAGRAM_COLORS.edge)}
              {marker("lc-arrow-taken", LIFECYCLE_DIAGRAM_COLORS.taken)}
            </defs>
            {edges.map(({ t: e, d }) => (
              <path key={e.key} d={d} fill="none" data-taken={e.taken ? "" : undefined}
                stroke={e.taken ? LIFECYCLE_DIAGRAM_COLORS.taken : LIFECYCLE_DIAGRAM_COLORS.edge} strokeWidth={e.taken ? 2.4 : 1.6}
                markerEnd={`url(#${e.taken ? "lc-arrow-taken" : "lc-arrow"})`} />
            ))}
          </svg>
          {edges.map(({ t: e, lx, ly }) => (
            <div key={`l-${e.key}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: lx, top: ly }}>
              <LifecycleEdgeLabel label={e.label} taken={e.taken} />
            </div>
          ))}
          {[...placed.values()].map((s) => (
            <div key={s.key} className="absolute" style={{ left: s.x, top: s.y, width: W }} data-state={s.key}>
              <LifecycleStateCard label={s.label} meta={s.meta} title={s.metaTitle} kind={s.kind} phase={s.phase} currentLabel={currentLabel} className="w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="sticky bottom-3 float-right me-3 flex w-fit flex-col gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-md">
        <button type="button" className={control} onClick={() => zoom(0.1)} aria-label={labels?.zoomIn ?? t("lcZoomIn")} title={labels?.zoomIn ?? t("lcZoomIn")}><Plus className="h-4 w-4" /></button>
        <button type="button" className={control} onClick={() => zoom(-0.1)} aria-label={labels?.zoomOut ?? t("lcZoomOut")} title={labels?.zoomOut ?? t("lcZoomOut")}><Minus className="h-4 w-4" /></button>
        <button type="button" className={control} onClick={fit} aria-label={labels?.fit ?? t("lcFit")} title={labels?.fit ?? t("lcFit")}><Maximize className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
