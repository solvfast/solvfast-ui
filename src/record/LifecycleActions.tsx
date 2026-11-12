import * as React from "react";
import { ChevronDown } from "lucide-react";
import { useLocale } from "../theme/ThemeProvider";
import { Button } from "../primitives/button";
import { ActionBar, type ActionBarLabels } from "./ActionBar";
import type { LifecycleActionItem } from "./types";

/**
 * LifecycleActions — a record page's Actions menu: the lifecycle transitions the user may run from the current state
 * (e.g. `lifecycleActions(def, current, roles)`), each item named by its action. Reference: the CRM record page's header
 * Actions menu — plain items (no colour), a transition runs as soon as it is chosen (unless the item asks to `confirm`),
 * "No actions from this status" when none, an item whose condition is unmet stays visible and disabled with its reason
 * after its label, and the whole menu is replaced by a disabled button with a tooltip while it is blocked (e.g.
 * "Save your changes first" while the page has unsaved changes).
 */
export interface LifecycleActionsItem extends Pick<LifecycleActionItem, "id" | "label" | "confirm"> {
  /** Shown but not available: the item is disabled and the reason follows its label ("Approve — reason"). */
  disabledReason?: string;
}

export interface LifecycleActionsProps {
  actions: LifecycleActionsItem[];
  onAction: (id: string) => void | Promise<unknown>;
  /** The whole menu is unavailable right now (e.g. unsaved changes): a disabled Actions button with this tooltip. */
  blockedReason?: string;
  /** The blocked button's leading icon (e.g. the app's actions glyph). */
  blockedIcon?: React.ComponentType<{ className?: string }>;
  /** A transition is running (the trigger shows "Working…"). */
  busy?: boolean;
  labels?: ActionBarLabels;
  className?: string;
}

export function LifecycleActions({ actions, onAction, blockedReason, blockedIcon: Icon, busy, labels, className }: LifecycleActionsProps) {
  const { t } = useLocale();
  if (blockedReason) {
    return (
      <Button size="sm" disabled title={blockedReason} className="h-8 gap-1.5">
        {Icon ? <Icon className="h-4 w-4" /> : null}{labels?.actions ?? t("recActions")}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </Button>
    );
  }
  const items: LifecycleActionItem[] = actions.map((a) => ({
    id: a.id, label: a.disabledReason ? `${a.label} — ${a.disabledReason}` : a.label, disabled: !!a.disabledReason, confirm: a.confirm,
  }));
  return (
    <ActionBar variant="menu" className={className} actions={items} busy={busy} labels={labels}
      onAction={(item) => { const a = actions.find((x) => x.id === item.id); if (a && !a.disabledReason) return onAction(a.id); }} />
  );
}
