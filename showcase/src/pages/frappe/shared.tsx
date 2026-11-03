/**
 * Shared pieces of the "Frappe layer" sections: the status strip every section carries (SIMULATED, and where the
 * completion matrix says so, "read path verified against recorded real 15.110 responses"), the simulated-site hook, the
 * session provider and a scenario picker. Labels follow docs/release/COMPONENT-COMPLETION-MATRIX.md (the "Real Frappe"
 * column) — rows 15–19, 24–27 and 10 are verified on the read path; everything else is simulated only.
 */
import * as React from "react";
import { Badge, ToggleGroup, ToggleGroupItem, cn } from "@ui";
import { FrappeProvider } from "@ui/frappe";
import { createSimSite, type SimSite, type SimSiteOptions } from "../../../../playground/src/demo/sim-site";
import { l, useTr, type L } from "../../i18n";

/** The sessions the sections switch between (roles as Frappe lists them; "All" is held by every user). */
export interface DemoSession { user: string; fullName: string; roles: string[] | undefined }
export const SESSIONS: Record<"admin" | "sales" | "salesOnly" | "dataEntry" | "exporter" | "none" | "unknown", DemoSession> = {
  admin: { user: "Administrator", fullName: "Administrator", roles: ["System Manager", "All"] },
  sales: { user: "lina@example.com", fullName: "Lina Q", roles: ["Sales User", "All"] },
  /** Without "All" — on ToDo (whose rows are All + System Manager) this session holds no right at all. */
  salesOnly: { user: "lina@example.com", fullName: "Lina Q", roles: ["Sales User"] },
  dataEntry: { user: "omar@example.com", fullName: "Omar Q", roles: ["Data Entry", "All"] },
  exporter: { user: "khaled@example.com", fullName: "Khaled Q", roles: ["Exporter", "All"] },
  none: { user: "guest@example.com", fullName: "Guest", roles: [] },
  unknown: { user: "sara@example.com", fullName: "Sara Q", roles: undefined },
};
export type SessionKey = keyof typeof SESSIONS;

/** The matrix status words. */
export type MatrixStatus = "verified-read" | "simulated" | "partial" | "skeleton" | "missing" | "generic";

export const STATUS_LABEL: Record<MatrixStatus, L> = {
  "verified-read": l("Read path verified against recorded real 15.110 responses", "مسار القراءة مُتحقَّق منه مقابل استجابات فرابيه 15.110 حقيقية مسجّلة"),
  simulated: l("Simulated only", "محاكاة فقط"),
  partial: l("Partially implemented — simulated only", "منفَّذ جزئياً — محاكاة فقط"),
  skeleton: l("Skeleton — simulated only", "هيكل أولي — محاكاة فقط"),
  missing: l("Missing from the package", "غير موجود في الحزمة"),
  generic: l("Generic (Frappe-free) — implemented, unit-tested", "عام (بلا فرابيه) — منفَّذ ومُختبَر بوحدات"),
};
export const STATUS_VARIANT: Record<MatrixStatus, "success" | "warning" | "info" | "destructive" | "outline" | "brand"> = {
  "verified-read": "success", simulated: "warning", partial: "warning", skeleton: "info", missing: "destructive", generic: "brand",
};

export function MatrixBadge({ status }: { status: MatrixStatus }) {
  const tr = useTr();
  return <Badge variant={STATUS_VARIANT[status]}>{tr(STATUS_LABEL[status])}</Badge>;
}

/**
 * The strip at the top of every Frappe section: the simulation badge, the optional "verified read path" badge with the
 * matrix rows it rests on, and the per-component list so a reader sees which parts of the section are which.
 */
export function StatusStrip({ verified, parts, note }: {
  /** Matrix rows verified on the read path (e.g. "15–19"); omitted = nothing in this section is. */
  verified?: string;
  /** Per component: name → status. */
  parts?: [string, MatrixStatus][];
  note?: L;
}) {
  const tr = useTr();
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card/60 p-4 text-sm" role="note" aria-label={tr(l("Verification status", "حالة التحقّق"))}>
      <div className="flex flex-wrap gap-2">
        <Badge variant="warning">{tr(l("SIMULATED — in-browser Frappe simulator, demo data", "محاكاة — محاكي فرابيه داخل المتصفّح، بيانات تجريبية"))}</Badge>
        <Badge variant="outline">{tr(l("Simulated Frappe site — no network", "موقع فرابيه محاكى — دون شبكة"))}</Badge>
        {verified && (
          <Badge variant="success" title="tests/real/sada-real.test.tsx">
            {tr(l(`Read path verified against recorded real Frappe 15.110 responses (matrix rows ${verified}) — tests/real/sada-real.test.tsx`, `مسار القراءة مُتحقَّق منه مقابل استجابات فرابيه 15.110 حقيقية مسجّلة (صفوف المصفوفة ${verified}) — tests/real/sada-real.test.tsx`))}
          </Badge>
        )}
      </div>
      {parts && (
        <ul className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
          {parts.map(([name, status]) => (
            <li key={name} className="flex items-center gap-2">
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", status === "verified-read" ? "bg-success" : status === "missing" ? "bg-destructive" : status === "skeleton" ? "bg-info" : status === "generic" ? "bg-primary" : "bg-warning")} />
              <span className="font-mono text-[11px] text-foreground" dir="ltr">{name}</span>
              <span>— {tr(STATUS_LABEL[status])}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        {tr(note ?? l("Writes (save, submit, workflow, assign, comment, delete, saved filters) have never run against a real site; the simulator answers them in memory. The server is always the authority.", "عمليات الكتابة (الحفظ والاعتماد وسير العمل والإسناد والتعليق والحذف والتصفيات المحفوظة) لم تُشغَّل أبداً على موقع حقيقي؛ المحاكي يجيب عنها في الذاكرة. الخادم هو المرجع دائماً."))}
      </p>
    </div>
  );
}

/** A fresh simulated site, rebuilt when `deps` change (each scenario gets clean data and an empty query cache). */
export function useSimSite(opts: SimSiteOptions, deps: React.DependencyList): SimSite {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => createSimSite(opts), deps);
}

/** `FrappeProvider` over a simulated site with one of the demo sessions. */
export function SimProvider({ site, session = "admin", children }: { site: SimSite; session?: SessionKey; children: React.ReactNode }) {
  const s = SESSIONS[session];
  return (
    <FrappeProvider client={site.client} queryClient={site.qc} session={{ user: s.user, fullName: s.fullName, roles: s.roles }}>
      {children}
    </FrappeProvider>
  );
}

/** A single-choice picker (ToggleGroup) with a visible legend; keyboard operable, focus ring from the package. */
export function Picker<V extends string>({ legend, value, onChange, options, className }: {
  legend: L; value: V; onChange: (v: V) => void; options: { value: V; label: L }[]; className?: string;
}) {
  const tr = useTr();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs font-medium text-muted-foreground">{tr(legend)}</span>
      <ToggleGroup type="single" value={value} onValueChange={(v) => { if (v) onChange(v as V); }} aria-label={tr(legend)} className="flex-wrap justify-start">
        {options.map((o) => <ToggleGroupItem key={o.value} value={o.value} size="sm">{tr(o.label)}</ToggleGroupItem>)}
      </ToggleGroup>
    </div>
  );
}

/** A small live read-out (what a callback received, a request the package built, …). */
export function Readout({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <pre dir="ltr" className="overflow-x-auto rounded-xl border border-border bg-muted/40 p-3 text-start font-mono text-xs leading-relaxed text-foreground">
      {label && <span className="text-muted-foreground">{label} </span>}{children}
    </pre>
  );
}

/** A labelled demo-session badge for the current roles. */
export function SessionBadge({ session }: { session: SessionKey }) {
  const s = SESSIONS[session];
  return <Badge variant="info" dir="ltr">{s.user} · roles: {s.roles ? (s.roles.length ? s.roles.join(", ") : "(none)") : "(unknown)"}</Badge>;
}
