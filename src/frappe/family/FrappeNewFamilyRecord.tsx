import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../primitives/button";
import { Label } from "../../primitives/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { Skeleton } from "../../primitives/skeleton";
import { Stepper } from "../../primitives/stepper";
import { useLocale } from "../../theme/ThemeProvider";
import { loc, type Localized } from "../../lib/localized";
import type { familyEn } from "../../theme/messages-ws/family";
import { cn } from "../../lib/cn";
import type { FrappeDoc, FrappeDocField } from "../contract";
import type { FormController } from "../form/events";
import { FrappeForm } from "../form/FrappeForm";
import { useFamilyTypes, type FamilyDescriptor, type FamilyType } from "./family";

export interface FrappeNewFamilyRecordLabels {
  type: Localized;
  chooseType: Localized;
  chooseTypeFirst: Localized;
  noTypes: Localized;
  switchWarn: Localized;
  switchConfirm: Localized;
  switchKeep: Localized;
  cancel: Localized;
  create: Localized;
  back: Localized;
  next: Localized;
  steps: Localized;
}

export interface FrappeNewFamilyRecordProps {
  family: FamilyDescriptor;
  /** The record was created in its type's DocType (Sayr writes the parent row). */
  onCreated: (doc: FrappeDoc, type: FamilyType) => void;
  /** Shows a Cancel button when given. */
  onCancel?: () => void;
  /** A type chosen up front (e.g. from a "Create ticket" button on a type). */
  defaultType?: string;
  /** The picker's icon for a type. Default: a dot in the type's colour. */
  renderTypeIcon?: (type: FamilyType) => React.ReactNode;
  /** Classes for the Create button (an app's brand colour). */
  createClassName?: string;
  labels?: Partial<FrappeNewFamilyRecordLabels>;
  className?: string;
}

// A type's own fields sit on a tab Sayr adds; a new record shows them in one list, so tab breaks are left out.
const flat = (df: FrappeDocField) => df.fieldtype !== "Tab Break";

function Dot({ color }: { color?: string }) {
  return <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-muted-foreground/40" style={color ? { background: color } : undefined} />;
}

/** A new record of a family: the type first, then that type's form. Changing the type after filling fields asks first. */
export function FrappeNewFamilyRecord({ family, onCreated, onCancel, defaultType, renderTypeIcon, createClassName, labels, className }: FrappeNewFamilyRecordProps) {
  const { t, language } = useLocale();
  const L = (key: keyof FrappeNewFamilyRecordLabels, fallback: keyof typeof familyEn) => loc(labels?.[key], language) || t(fallback);
  const types = useFamilyTypes(family);
  const [typeName, setTypeName] = React.useState(defaultType ?? "");
  const [pending, setPending] = React.useState<string | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [steps, setSteps] = React.useState<{ key: string; label: string }[]>([]);
  const [step, setStep] = React.useState(0);
  const form = React.useRef<FormController | null>(null);
  const type = types.data?.find((x) => x.name === typeName);
  // A wizard type walks its form's tabs as ordered steps; otherwise its fields are one list.
  const wizard = !!type?.wizard;
  // Until the form has reported its tabs the steps are unknown: Next waits rather than Create showing early.
  const last = !wizard || (steps.length > 0 && step >= steps.length - 1);
  const icon = (x: FamilyType) => (renderTypeIcon ? renderTypeIcon(x) : <Dot color={x.color} />);

  const commitType = (name: string) => {
    setTypeName(name);
    setPending(null);
    setDirty(false);
    setSteps([]);
    setStep(0);
  };
  const chooseType = (name: string) => {
    if (name === typeName) return;
    if (dirty) setPending(name);
    else commitType(name);
  };
  const create = async () => {
    if (!form.current) return;
    setSaving(true);
    try {
      await form.current.save("Save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-1.5">
        <Label htmlFor="sf-family-type" className="text-sm font-semibold">
          {L("type", "famType")} <span className="text-destructive">*</span>
        </Label>
        {types.isPending ? (
          <Skeleton className="h-10 rounded-md" />
        ) : (
          <Select value={typeName} onValueChange={chooseType}>
            <SelectTrigger id="sf-family-type" className="h-10">
              <SelectValue placeholder={L("chooseType", "famChooseType")}>
                {type && <span className="inline-flex items-center gap-2">{icon(type)}<span>{loc(type.label, language)}</span></span>}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(types.data ?? []).map((x) => (
                <SelectItem key={x.name} value={x.name}>
                  <span className="inline-flex items-center gap-2">{icon(x)}<span>{loc(x.label, language)}</span></span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {types.isError && <p className="text-sm text-destructive">{(types.error as Error).message}</p>}
        {types.data?.length === 0 && <p className="text-sm text-muted-foreground">{L("noTypes", "famNoTypes")}</p>}

        {pending && (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm text-amber-800 dark:text-amber-200">{L("switchWarn", "famSwitchWarn")}</p>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="h-7 border-amber-400 text-amber-800 dark:text-amber-200"
                  onClick={() => commitType(pending)}>
                  {L("switchConfirm", "famSwitchConfirm")}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setPending(null)}>
                  {L("switchKeep", "famSwitchKeep")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!type ? (
        <p className="text-sm text-muted-foreground">{L("chooseTypeFirst", "famChooseTypeFirst")}</p>
      ) : (
        <div className="space-y-6">
          {wizard && steps.length > 1 && (
            <Stepper
              ariaLabel={L("steps", "famSteps")}
              steps={steps.map((s, i) => ({ label: s.label, state: i < step ? "done" : i === step ? "current" : "upcoming", clickable: i < step }))}
              onJump={(i) => i < step && setStep(i)}
              followCurrent
            />
          )}
          <FrappeForm
            key={type.doctype}
            doctype={type.doctype}
            hideToolbar
            menu={false}
            connections={false}
            fieldFilter={wizard ? undefined : flat}
            hideTabBar={wizard}
            activeTab={wizard ? steps[step]?.key : undefined}
            onTabsChange={wizard ? setSteps : undefined}
            controllerRef={form}
            onDirtyChange={setDirty}
            onSaved={(doc) => onCreated(doc, type)}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-5 border-t border-border">
        {onCancel ? <Button variant="outline" onClick={onCancel}>{L("cancel", "famCancel")}</Button> : <span />}
        <div className="flex items-center gap-2">
          {wizard && step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>{L("back", "famBack")}</Button>}
          {last ? (
            <Button onClick={create} disabled={!type || saving} className={createClassName}>{L("create", "famCreate")}</Button>
          ) : (
            <Button onClick={() => setStep(step + 1)} disabled={steps.length === 0} className={createClassName}>{L("next", "famNext")}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
