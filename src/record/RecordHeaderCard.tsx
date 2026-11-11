/**
 * RecordHeaderCard — the card at the top of a record page: an icon or initials, the title, the record's name, a status
 * badge, a row of facts (who, when) and chips; `children` go under them (e.g. a new record's type picker).
 * Frappe-free: the host passes what to show.
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { Badge, type BadgeProps } from "../primitives/badge";

export interface RecordHeaderFact {
  icon?: React.ComponentType<{ className?: string }>;
  text: React.ReactNode;
  /** Tooltip (e.g. the exact date). */
  title?: string;
}

export interface RecordHeaderCardProps {
  title: React.ReactNode;
  /** The record's name, shown as `#name`. */
  name?: string;
  /** The square at the start: an icon, or initials. */
  avatar?: React.ReactNode;
  status?: { label: React.ReactNode; variant?: BadgeProps["variant"]; key?: string };
  facts?: RecordHeaderFact[];
  chips?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function RecordHeaderCard({ title, name, avatar, status, facts, chips, children, className }: RecordHeaderCardProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-primary/10 via-card to-accent/10 p-5 shadow-sm", className)} data-record-header>
      <div className="flex items-start gap-4">
        {avatar !== undefined ? (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-card text-lg font-semibold text-primary ring-2 ring-primary/20" aria-hidden>
            {avatar}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate text-xl font-semibold">{title}</h1>
            {name ? <span className="font-mono text-xs text-muted-foreground">#{name}</span> : null}
            {status ? <Badge variant={status.variant ?? "outline"} data-status={status.key}>{status.label}</Badge> : null}
          </div>
          {facts?.length ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {facts.map((f, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <span className="opacity-40" aria-hidden>•</span> : null}
                  <span className={cn("inline-flex items-center gap-1", i === 0 && "font-medium")} title={f.title}>
                    {f.icon ? <f.icon className="h-3.5 w-3.5" aria-hidden /> : null}{f.text}
                  </span>
                </React.Fragment>
              ))}
            </div>
          ) : null}
          {chips ? <div className="flex flex-wrap items-center gap-2">{chips}</div> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
