/**
 * Sayr → the core lifecycle model (internal to `./sayr`, not exported from its index). Sayr's lifecycle as the record
 * page or the type preview receive it (`RecordPageData["lifecycle"]`, `TypePreviewData["lifecycle"]`) becomes a core
 * `LifecycleDefinition`, and with the record's history (the states it went through, who moved it there and when) the
 * `LifecycleGraph` that `LifecycleGraphView` draws. One model for every renderer.
 */
import { lifecycleGraph, type LifecycleDefinition, type LifecycleGraph } from "../record/lifecycle";
import type { LifecyclePhase } from "../record/LifecycleDiagram";
import type { LifecycleGraphData } from "./recordPage";

/** One state the record went through, oldest first (the lifecycle rail's path): its key and who moved it there, when. */
export interface LifecyclePathStep { id: string; meta?: string; metaTitle?: string }

/** What the adapter reads: the states and transitions of `RecordPageData["lifecycle"]` or `TypePreviewData["lifecycle"]`
 *  (an older Sayr sends no transitions; a type preview may send no states). */
export interface SayrLifecycleSource {
  states?: LifecycleGraphData["states"] | null;
  transitions?: LifecycleGraphData["transitions"] | null;
}

const PHASES: Record<string, LifecyclePhase> = { open: "open", on_hold: "on_hold", closed: "closed" };

/** Sayr's phase → the model's: open / on_hold / closed one to one (case and spaces ignored), anything else open. */
export function sayrPhase(phase: string | null | undefined): LifecyclePhase {
  return PHASES[(phase ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_")] ?? "open";
}

/** Sayr's lifecycle → a core `LifecycleDefinition`, labels in the current language (`arabic`: the Arabic name or
 *  action when Sayr has one, else the English). Transitions to or from a state Sayr did not send are kept (the renderers
 *  leave them out). A transition without a key gets `from-to`; a repeated key gets `#n` so every id is unique. */
export function sayrLifecycleDefinition(lc: SayrLifecycleSource, arabic: boolean): LifecycleDefinition {
  const seen = new Map<string, number>();
  const unique = (id: string) => {
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    return n ? `${id}#${n}` : id;
  };
  return {
    states: (lc.states ?? []).map((s) => ({ id: s.state_key, label: (arabic && s.name_ar) || s.name_en || s.state_key, phase: sayrPhase(s.phase) })),
    transitions: (lc.transitions ?? []).map((tr) => ({
      id: unique(tr.transition_key || `${tr.from_state}-${tr.to_state}`), from: tr.from_state, to: tr.to_state,
      label: (arabic && tr.action_ar) || tr.action_en || undefined,
    })),
  };
}

/** The diagram model of a Sayr lifecycle for one record: `status` is current, the states of `path` are done (each with
 *  its who · when as `meta` / `metaTitle`), a transition joining two consecutive states of `path` is taken. No path (a
 *  new record's preview, or no history yet): nothing done or taken — never a guessed path. */
export function sayrLifecycleGraph(lc: SayrLifecycleSource, opts: { arabic: boolean; status?: string | null; path?: readonly LifecyclePathStep[] }): LifecycleGraph {
  const path = opts.path ?? [];
  const graph = lifecycleGraph(sayrLifecycleDefinition(lc, opts.arabic), opts.status ?? undefined, path.map((p) => p.id));
  const steps = new Map(path.map((p) => [p.id, p] as const));
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      const step = steps.get(n.id);
      return step && (step.meta || step.metaTitle) ? { ...n, meta: step.meta, metaTitle: step.metaTitle } : n;
    }),
  };
}

// Development or production: library code reads `process.env.NODE_ENV`, written exactly so, for the host's bundler to
// replace (as React does) — not `import.meta.env.DEV`, which this package's own build would freeze. Without a bundler
// (no `process`), the read throws and counts as development. Tests run with "test".
declare const process: { env: { NODE_ENV?: string } };
const isProduction = () => { try { return process.env.NODE_ENV === "production"; } catch { return false; } };
const warned = new Set<string>();

/** The deprecated `lifecycleHref` prop (0.9.0) of SayrRecordPage / SayrNewRecordPage: warns once per component, in
 *  development only, that it goes away in 0.11.0. */
export function warnLifecycleHrefDeprecated(component: string): void {
  if (warned.has(component)) return;
  if (isProduction()) return;
  warned.add(component);
  console.warn(`[@solvfast/ui/sayr] ${component}: \`lifecycleHref\` is deprecated since 0.10.0 and will be removed in 0.11.0 — `
    + "without it, \"View full lifecycle\" opens the lifecycle diagram in place (LifecycleGraphDialog).");
}

/** 0.9.0's "View full lifecycle": the host's link in a new tab. */
export function openLifecycleHref(lifecycleHref: (lifecycle: string) => string, lifecycle: string): void {
  window.open(lifecycleHref(lifecycle), "_blank", "noopener");
}
