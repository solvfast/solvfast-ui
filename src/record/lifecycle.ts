/**
 * The Lifecycle contract (framework-free: no React, no renderer). A lifecycle is a graph of states (each with a phase)
 * and transitions; the helpers derive what a record page shows from it. Reference: the CRM record page's Lifecycle
 * (its Actions menu, its Lifecycle rail card, its badge tone and its full-lifecycle diagram).
 *
 *  - lifecycleTone(state)          — the status badge tone of a state (open → info, on hold → warning, closed → by colour)
 *  - lifecyclePath(def, current)   — the path the rail shows: the SHORTEST path from a root to the current state
 *  - lifecycleTransitionsFrom(def, current, roles?) — the Actions menu: the manual transitions out of the current state
 *  - lifecycleNext(def, current, path)      — the rail's "next": every target out of the current state
 *  - lifecycleGraph(def, current, path)     — the diagram model (nodes done / current / future, taken edges) for any
 *                                             renderer; Core ships no graph renderer.
 */
import type { Tone } from "./types";
import type { LifecycleNodeKind, LifecyclePhase } from "./LifecycleDiagram";

export interface LifecycleStateDef {
  id: string;
  label: string;
  /** open · on hold · closed (drives the tone and the diagram's phase icon). */
  phase: LifecyclePhase;
  /** The state's colour (hex). Only a closed state's tone reads it. */
  color?: string;
}

export interface LifecycleTransitionDef {
  id: string;
  from: string;
  to: string;
  /** The action's name (the Actions menu item, the diagram's edge label). */
  label?: string;
  /** "automatic" transitions are not user actions (they still show as a way forward on the rail). Default "manual". */
  trigger?: "manual" | "automatic" | "conditional";
  /** Only these roles may perform it (absent = everyone). */
  roles?: string[];
}

export interface LifecycleDefinition {
  states: LifecycleStateDef[];
  transitions: LifecycleTransitionDef[];
}

/** A way forward on the rail: the target state, and whether it is a move back to a state already on the path. */
export interface LifecycleNextItem { id: string; label: string; back: boolean }

/** The diagram model: what a renderer (any graph library) draws. */
export interface LifecycleGraph {
  nodes: {
    id: string; label: string; phase: LifecyclePhase; kind: LifecycleNodeKind;
    /** Optional (0.10.0): who moved the record there and when, e.g. "Omar · Apr 13" — `LifecycleGraphView` shows it
     *  after the phase word. `lifecycleGraph()` never sets it; an adapter adds it from the record's history. */
    meta?: string;
    /** Optional (0.10.0): the long form of `meta` (the state card's tooltip). */
    metaTitle?: string;
  }[];
  edges: { id: string; from: string; to: string; label?: string; taken: boolean }[];
}

const hexHueSat = (hex?: string): { h: number; s: number } | undefined => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return undefined;
  const v = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s };
};

/** The badge tone of a state: open → info, on hold → warning; closed → neutral for a grey colour (saturation < 0.15),
 *  danger for a red one (saturation ≥ 0.5, hue ≤ 20° or ≥ 340°), success otherwise. No state → neutral. */
export function lifecycleTone(state?: Pick<LifecycleStateDef, "phase" | "color">): Tone {
  if (!state) return "neutral";
  if (state.phase === "open") return "info";
  if (state.phase === "on_hold") return "warning";
  const c = hexHueSat(state.color);
  if (c && c.s < 0.15) return "neutral";
  if (c && c.s >= 0.5 && (c.h <= 20 || c.h >= 340)) return "danger";
  return "success";
}

/** The roots: states no transition enters (else the first state). */
export function lifecycleRoots(def: LifecycleDefinition): LifecycleStateDef[] {
  const entered = new Set(def.transitions.map((t) => t.to));
  const roots = def.states.filter((s) => !entered.has(s.id));
  return roots.length ? roots : def.states.slice(0, 1);
}

/** The path the rail shows: the shortest path (breadth-first over the transitions) from a root to `currentId`, inclusive.
 *  A state no root reaches is shown alone; an unknown id gives []. It is the graph's shortest path, not the record's
 *  history (a record that took a longer way still shows the shortest one). */
export function lifecyclePath(def: LifecycleDefinition, currentId: string | undefined): LifecycleStateDef[] {
  const byId = new Map(def.states.map((s) => [s.id, s] as const));
  const target = currentId ? byId.get(currentId) : undefined;
  if (!target || !currentId) return [];
  const parent = new Map<string, string | null>();
  const queue: string[] = [];
  for (const s of lifecycleRoots(def)) { parent.set(s.id, null); queue.push(s.id); }
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === currentId) break;
    for (const t of def.transitions) if (t.from === cur && !parent.has(t.to)) { parent.set(t.to, cur); queue.push(t.to); }
  }
  if (!parent.has(currentId)) return [target];
  const path: LifecycleStateDef[] = [];
  let node: string | null | undefined = currentId;
  while (node != null) { const s = byId.get(node); if (s) path.unshift(s); node = parent.get(node) ?? null; }
  return path;
}

/** The Actions menu: the transitions out of `currentId` a user may perform — not "automatic" ones; a transition with
 *  `roles` only for a user holding one of them (unknown roles = not offered). */
export function lifecycleTransitionsFrom(def: LifecycleDefinition, currentId: string | undefined, roles?: string[]): LifecycleTransitionDef[] {
  if (!currentId) return [];
  return def.transitions.filter((t) => {
    if (t.from !== currentId || t.trigger === "automatic") return false;
    if (t.roles?.length) return !!roles && t.roles.some((r) => roles.includes(r));
    return true;
  });
}

/** The rail's "next": every state a transition out of `currentId` leads to (automatic ones included, roles ignored —
 *  where the lifecycle goes, not what this user may do), once each; `back` when it is already on `pathIds`. */
export function lifecycleNext(def: LifecycleDefinition, currentId: string | undefined, pathIds: string[] = []): LifecycleNextItem[] {
  if (!currentId) return [];
  const byId = new Map(def.states.map((s) => [s.id, s] as const));
  const seen = new Set<string>(); const out: LifecycleNextItem[] = [];
  for (const t of def.transitions) {
    if (t.from !== currentId || seen.has(t.to)) continue;
    const to = byId.get(t.to); if (!to) continue;
    seen.add(t.to); out.push({ id: to.id, label: to.label, back: pathIds.includes(to.id) });
  }
  return out;
}

/** The diagram model: every state (current; done = on the path or in `visitedIds`; future) and every transition (taken =
 *  it joins two consecutive states of the path). */
export function lifecycleGraph(def: LifecycleDefinition, currentId: string | undefined, pathIds?: string[], visitedIds: string[] = []): LifecycleGraph {
  const seq = pathIds ?? lifecyclePath(def, currentId).map((s) => s.id);
  const visited = new Set([...seq, ...visitedIds]);
  const taken = new Set<string>();
  for (let i = 0; i < seq.length - 1; i++) {
    const e = def.transitions.find((t) => t.from === seq[i] && t.to === seq[i + 1]);
    if (e) taken.add(e.id);
  }
  return {
    nodes: def.states.map((s) => ({ id: s.id, label: s.label, phase: s.phase, kind: s.id === currentId ? "current" : visited.has(s.id) ? "done" : "future" })),
    edges: def.transitions.map((t) => ({ id: t.id, from: t.from, to: t.to, label: t.label, taken: taken.has(t.id) })),
  };
}
