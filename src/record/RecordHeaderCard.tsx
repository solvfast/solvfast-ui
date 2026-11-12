/**
 * RecordHeaderCard — the card at the top of a record page: an icon or initials, the title, the record's name, a status
 * badge, a row of facts (who, when) and chips; `children` go under them (e.g. a new record's type picker).
 * Frappe-free: the host passes what to show.
 *
 * Two looks, one structure (the title row and the facts row are the same markup):
 *  - `variant="default"` — the Sayr record page's header (gradient surface, 56 px avatar). Unchanged.
 *  - `variant="crm"` (0.8.0-dev.2) — the CRM record page's header, ported 1:1 from serve_fast's Deal / Lead / Contact /
 *    Organization / Ticket pages (their @solvfast/ui-scope markup): a plain card, the host's avatar (e.g.
 *    `RecordHeaderIcon`, a photo), a larger title that takes an editable title, `titleExtra` after the status (e.g. a
 *    "Not saved" pill), facts that can be links (`onClick`), a `value` line, `chips` as given, and `actions` (the quick
 *    action pills) at the end of the card.
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { Badge, type BadgeProps } from "../primitives/badge";

export interface RecordHeaderFact {
  icon?: React.ComponentType<{ className?: string }>;
  text: React.ReactNode;
  /** Tooltip (e.g. the exact date). */
  title?: string;
  /** `crm` variant: the fact is a link (e.g. the record's organization). */
  onClick?: () => void;
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
  /** `default` = the Sayr header (unchanged); `crm` = the CRM record page header. */
  variant?: "default" | "crm";
  /** `crm`: the status as a node (e.g. a `StatusBadge` in the lifecycle tone); wins over `status`. */
  statusNode?: React.ReactNode;
  /** `crm`: after the status in the title row (e.g. the "Not saved" pill). */
  titleExtra?: React.ReactNode;
  /** `crm`: the value line under the facts (e.g. "12,500,000 USD"; shown left-to-right, tabular digits). */
  value?: React.ReactNode;
  /** `crm`: the quick actions at the end of the card (`RecordQuickAction`, `RecordQuickActionMenu`). */
  actions?: React.ReactNode;
}

export function RecordHeaderCard(props: RecordHeaderCardProps) {
  return props.variant === "crm" ? <CrmRecordHeader {...props} /> : <DefaultRecordHeader {...props} />;
}

function DefaultRecordHeader({ title, name, avatar, status, facts, chips, children, className }: RecordHeaderCardProps) {
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

/** The CRM header's avatar: the record type's icon on a card tile with the brand halo (violet → flame → violet). */
export function RecordHeaderIcon({ icon: Icon, color, className }: {
  icon: React.ComponentType<{ className?: string }>;
  /** The icon's colour (e.g. the record type's colour); default: inherited. */
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)} data-record-header-icon>
      <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-brand-violet via-brand-flame to-brand-violet opacity-60 blur-[2px]" />
      <div className="relative h-[68px] w-[68px] rounded-xl flex items-center justify-center bg-card ring-2 ring-card" style={color ? { color } : undefined}>
        <Icon className="h-8 w-8" />
      </div>
    </div>
  );
}

function CrmRecordHeader({ title, name, avatar, status, statusNode, titleExtra, facts, value, chips, actions, children, className }: RecordHeaderCardProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-card", className)} data-record-header="crm">
      <div className="relative p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {avatar}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="min-w-0 max-w-full truncate text-xl md:text-2xl font-semibold text-foreground">{title}</h1>
                {name ? <span className="font-mono text-xs text-muted-foreground">#{name}</span> : null}
                {statusNode ?? (status ? <Badge variant={status.variant ?? "outline"} data-status={status.key}>{status.label}</Badge> : null)}
                {titleExtra}
              </div>
              {facts?.length ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  {facts.map((f, i) => (
                    <React.Fragment key={i}>
                      {i > 0 ? <span className="opacity-40">•</span> : null}
                      {f.onClick ? (
                        <button type="button" className="inline-flex items-center gap-1 hover:text-brand-violet font-medium transition-colors" title={f.title} onClick={f.onClick}>
                          {f.icon ? <f.icon className="h-3.5 w-3.5" /> : null}{f.text}
                        </button>
                      ) : (
                        <span className={cn("inline-flex items-center gap-1", i === 0 && "font-medium")} title={f.title}>
                          {f.icon ? <f.icon className="h-3.5 w-3.5" /> : null}{f.text}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : null}
              {value != null ? (
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-lg font-semibold tabular-nums" dir="ltr">{value}</span>
                </div>
              ) : null}
              {chips}
              {children}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-1.5 md:self-start md:ms-auto md:pt-1 shrink-0">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
