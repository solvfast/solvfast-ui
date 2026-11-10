import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, Circle, Pause, X } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale, usePortalContainer } from "../theme/ThemeProvider";

/**
 * Lifecycle diagram pieces. The package owns the look (dialog, state cards, edge labels, legend, edge colours); the
 * consumer owns the graph engine and layout (e.g. React Flow + dagre), which stays out of the package's dependencies.
 * Mapping (both themes, semantic tokens): done → success, current → primary, not reached → card + border.
 */

/** How a state relates to the record shown in the diagram. */
export type LifecycleNodeKind = "done" | "current" | "future";
/** The state's phase (what it does to the record's clock): open, on hold, or closed. */
export type LifecyclePhase = "open" | "on_hold" | "closed";

/** Edge / marker / canvas colours as CSS colour strings (theme-aware through the tokens) for SVG renderers. */
export const LIFECYCLE_DIAGRAM_COLORS = {
  /** An edge on the path the record took. */
  taken: "hsl(var(--success))",
  /** Every other edge. */
  edge: "hsl(var(--muted-foreground) / 0.45)",
  /** Canvas grid dots. */
  grid: "hsl(var(--border))",
} as const;

const PHASE: Record<LifecyclePhase, { box: string; Icon: typeof Circle; fill?: boolean }> = {
  open: { box: "bg-info/15 text-info", Icon: Circle, fill: true },
  on_hold: { box: "bg-warning/15 text-warning", Icon: Pause },
  closed: { box: "bg-success/15 text-success", Icon: Check },
};

export interface LifecycleStateCardProps {
  label: string;
  /** Second line, e.g. "Open · Omar · Apr 12". */
  meta?: string;
  kind: LifecycleNodeKind;
  phase?: LifecyclePhase;
  /** The "Current" badge text (default from the ThemeProvider's language). */
  currentLabel?: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** One state of the lifecycle diagram (a React Flow node body, or any absolutely-placed box). */
export function LifecycleStateCard({ label, meta, kind, phase = "open", currentLabel, title, className, style, children }: LifecycleStateCardProps) {
  const { t } = useLocale();
  const P = PHASE[phase] ?? PHASE.open;
  return (
    <div data-kind={kind} title={title} style={style}
      className={cn("relative flex h-[58px] items-center rounded-xl pe-[18px] ps-3 text-start text-card-foreground",
        kind === "current" && "border-2 border-primary bg-card shadow-lg shadow-primary/20 ring-4 ring-primary/15",
        kind === "done" && "border-[1.5px] border-success/70 bg-card shadow-sm",
        kind === "future" && "border border-border bg-card shadow-sm",
        className)}>
      {/* tint layer: keeps the card opaque over the canvas while tinting it in both themes */}
      {kind !== "future" ? <span aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", kind === "current" ? "bg-primary/10" : "bg-success/10")} /> : null}
      {children}
      <span aria-hidden className={cn("relative me-2.5 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg", P.box)}>
        <P.Icon className="h-4 w-4" strokeWidth={2.4} fill={P.fill ? "currentColor" : "none"} />
      </span>
      <div className="relative min-w-0 flex-1">
        <div className="whitespace-nowrap text-[13px] font-semibold leading-tight text-foreground">{label}</div>
        {meta ? <div className="whitespace-nowrap text-[11px] leading-tight text-muted-foreground">{meta}</div> : null}
      </div>
      {kind === "done" ? (
        <span aria-hidden className="absolute -end-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-card">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
      {kind === "current" ? (
        <span className="absolute -end-1.5 -top-[11px] rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          {currentLabel ?? t("lcCurrent")}
        </span>
      ) : null}
    </div>
  );
}

/** A transition's name on its edge. `taken` = the edge is on the record's path. */
export function LifecycleEdgeLabel({ label, taken, className }: { label: string; taken?: boolean; className?: string }) {
  return (
    <span data-taken={taken ? "" : undefined}
      className={cn("whitespace-nowrap rounded-full border bg-popover px-2 py-0.5 text-[10px] font-semibold",
        taken ? "border-success/60 text-success" : "border-border text-primary", className)}>
      {label}
    </span>
  );
}

export interface LifecycleDiagramLegendLabels { done?: string; current?: string; notReached?: string; pathTaken?: string }

/** The diagram key: each swatch copies its card / edge style. */
export function LifecycleDiagramLegend({ labels, className }: { labels?: LifecycleDiagramLegendLabels; className?: string }) {
  const { t } = useLocale();
  const Box = ({ cls, label }: { cls: string; label: string }) => (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className={cn("inline-block h-4 w-6 rounded-[5px]", cls)} />{label}
    </span>
  );
  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      <Box cls="border-[1.5px] border-success/70 bg-success/10" label={labels?.done ?? t("lcDone")} />
      <Box cls="border-2 border-primary bg-primary/10" label={labels?.current ?? t("lcCurrent")} />
      <Box cls="border border-border bg-card" label={labels?.notReached ?? t("lcNotReached")} />
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden className="inline-block h-0.5 w-6 rounded-full bg-success" />{labels?.pathTaken ?? t("lcPathTaken")}
      </span>
    </div>
  );
}

export interface LifecycleDiagramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  /** Second header line, e.g. "TKT-1041 · currently Assigned". */
  subtitle?: React.ReactNode;
  /** The canvas (the consumer's graph renderer). */
  children: React.ReactNode;
  legendLabels?: LifecycleDiagramLegendLabels;
  closeLabel?: string;
  /** Text direction of the dialog (portalled content does not inherit `dir` from the page). */
  dir?: "ltr" | "rtl";
  className?: string;
}

/** The full-lifecycle dialog: header, canvas area (the consumer's renderer), legend footer. Solid themed surface. */
export function LifecycleDiagramDialog({ open, onOpenChange, title, subtitle, children, legendLabels, closeLabel, dir, className }: LifecycleDiagramDialogProps) {
  const { t, direction } = useLocale();
  const container = usePortalContainer();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content dir={dir ?? direction} aria-describedby={undefined} data-lifecycle-diagram
          className={cn("fixed start-1/2 top-1/2 z-50 flex h-[85vh] w-[92vw] max-w-[900px] -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className)}>
          <div className="flex items-start gap-2 border-b border-border px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-[15px] font-semibold text-foreground">{title}</DialogPrimitive.Title>
              {subtitle ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div> : null}
            </div>
            <DialogPrimitive.Close aria-label={closeLabel ?? t("lcClose")}
              className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X aria-hidden className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="relative flex-1 bg-background">{children}</div>
          <LifecycleDiagramLegend labels={legendLabels} className="border-t border-border px-5 py-2.5" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
