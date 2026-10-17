/** Documentation building blocks, after the Design System site: a page header, sections marked by a primary bar,
 *  and examples that render the real components with an optional code view. */
import * as React from "react";
import { Code2 } from "lucide-react";
import { Button, cn } from "@ui";
import { useTr, type L } from "../i18n";

export function PageHeader({ group, title, description, children }: { group: L; title: L; description: L; children?: React.ReactNode }) {
  const tr = useTr();
  return (
    <header className="space-y-3 pb-2">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">{tr(group)}</p>
      <h1 className="font-brand text-4xl font-bold leading-tight text-foreground [text-wrap:balance]">{tr(title)}</h1>
      <p className="max-w-3xl text-base text-muted-foreground">{tr(description)}</p>
      {children}
    </header>
  );
}

export function Section({ id, title, description, children }: { id?: string; title: L; description?: L; children: React.ReactNode }) {
  const tr = useTr();
  return (
    <section id={id} className="space-y-5 scroll-mt-24">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <span className="h-6 w-1 rounded-full bg-primary" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{tr(title)}</h2>
        </div>
        {description && <p className="max-w-3xl text-sm text-muted-foreground">{tr(description)}</p>}
      </div>
      {children}
    </section>
  );
}

/** A live example. `code` is shown on demand (the snippet for this example, kept short). */
export function Example({ title, code, children, className, center = false }: {
  title?: L; code?: string; children: React.ReactNode; className?: string; center?: boolean;
}) {
  const tr = useTr();
  const [show, setShow] = React.useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-sm">
      {(title || code) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">{title ? tr(title) : ""}</span>
          {code && (
            <Button variant="ghost" size="xs" className="gap-1.5" aria-expanded={show} onClick={() => setShow((s) => !s)}>
              <Code2 className="h-3.5 w-3.5" /> {show ? tr({ en: "Hide code", ar: "إخفاء الشيفرة" }) : tr({ en: "Show code", ar: "عرض الشيفرة" })}
            </Button>
          )}
        </div>
      )}
      <div className={cn("p-6", center && "flex flex-wrap items-center justify-center gap-3", className)}>{children}</div>
      {code && show && (
        <pre dir="ltr" className="overflow-x-auto border-t border-border bg-muted/50 p-4 text-start font-mono text-xs leading-relaxed text-foreground"><code>{code.trim()}</code></pre>
      )}
    </div>
  );
}

/** Props worth knowing (not a full reference). */
export function Props({ rows }: { rows: [string, string, L][] }) {
  const tr = useTr();
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-start font-medium">{tr({ en: "Prop", ar: "الخاصية" })}</th>
            <th className="px-4 py-2 text-start font-medium">{tr({ en: "Type", ar: "النوع" })}</th>
            <th className="px-4 py-2 text-start font-medium">{tr({ en: "What it does", ar: "الوظيفة" })}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, type, what]) => (
            <tr key={name} className="border-t border-border align-top">
              <td className="px-4 py-2 font-mono text-xs text-foreground" dir="ltr">{name}</td>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground" dir="ltr">{type}</td>
              <td className="px-4 py-2 text-muted-foreground">{tr(what)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A labelled cell in an example grid. */
export function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">{label}</span>
      {children}
    </div>
  );
}
