import * as React from "react";
import { Label } from "../../primitives/label";
import { Switch } from "../../primitives/switch";
import { useLocale } from "../../theme/ThemeProvider";
import { loc, type Localized } from "../../lib/localized";

export interface WizardToggleProps {
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** Reword the default label / hint (`tcWizard`, `tcWizardHint`). */
  labels?: Partial<Record<"tcWizard" | "tcWizardHint", Localized>>;
}

/** Wizard mode: a new record walks the form's steps in order. (Exported as `TypeWizardToggle` too.) */
export function WizardToggle({ checked, onCheckedChange, label, description, labels }: WizardToggleProps) {
  const { t, language } = useLocale();
  const id = React.useId();
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-2.5" data-fb-wizard-toggle="">
      <div>
        <Label htmlFor={id} className="text-xs">{label ?? (loc(labels?.tcWizard, language) || t("tcWizard"))}</Label>
        <p id={`${id}-desc`} className="text-[11px] text-muted-foreground">{description ?? (loc(labels?.tcWizardHint, language) || t("tcWizardHint"))}</p>
      </div>
      <Switch id={id} aria-describedby={`${id}-desc`} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
