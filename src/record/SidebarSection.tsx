/**
 * SidebarSection — one block of a form sidebar, as Desk draws them (Frappe 15.110 `form/templates/form_sidebar.html:43-118`,
 * `.form-sidebar-items`): an icon and a label on one row, an optional "+" icon button at the row's end, the section's
 * content under it. The label can be a button (Desk's "Attachments" label opens the File list, attachments.js:18-25).
 * Frappe-free: the host decides what the action does and whether it is offered.
 */
import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "../lib/cn";

export interface SidebarSectionAction {
  /** Accessible name and tooltip of the icon button. */
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Icon (default: Plus). */
  icon?: React.ComponentType<{ className?: string }>;
}

export interface SidebarSectionProps {
  /** Stable id (data attribute + heading id prefix). */
  id: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Makes the label a button (e.g. "open the list of these files"). */
  onLabelClick?: () => void;
  /** The row's "+" button (omit to show none). */
  action?: SidebarSectionAction;
  /** The section is waiting for the server (aria-busy). */
  busy?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function SidebarSection({ id, label, icon: Icon, onLabelClick, action, busy, children, className }: SidebarSectionProps) {
  const headingId = `${React.useId()}-${id}`;
  const ActionIcon = action?.icon ?? Plus;
  const text = <span className="truncate">{label}</span>;
  return (
    <section aria-labelledby={headingId} aria-busy={busy || undefined} data-sidebar-section={id} className={cn("space-y-1.5", className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 id={headingId} className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
          {onLabelClick ? (
            <button type="button" onClick={onLabelClick} className="min-w-0 truncate rounded-sm text-start hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {label}
            </button>
          ) : text}
        </h3>
        {action ? (
          <button
            type="button" onClick={action.onClick} disabled={action.disabled} aria-label={action.label} title={action.label}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <ActionIcon className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}
