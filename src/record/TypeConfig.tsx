import * as React from "react";
import { AlertTriangle, ExternalLink, Layers, Library, Search, X } from "lucide-react";
import { Badge } from "../primitives/badge";
import { Button } from "../primitives/button";
import { Checkbox } from "../primitives/checkbox";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { PageHeader } from "../primitives/page-header";
import { Switch } from "../primitives/switch";
import { ToggleGroup, ToggleGroupItem } from "../primitives/toggle-group";
import { IconColorPicker, type IconColorPickerProps } from "../fields/IconColorPicker";
import { useLocale } from "../theme/ThemeProvider";
import type { typeConfigEn } from "../theme/messages-ws/typeConfig";
import { loc, type Localized } from "../lib/localized";
import { cn } from "../lib/cn";
import type { FieldImportMode, FieldImportPlan, FieldImportStatus, TypeFieldConflict } from "./typeConfig";

type Key = keyof typeof typeConfigEn;
export type TypeConfigLabels = Partial<Record<Key, Localized>>;

function useL(labels?: TypeConfigLabels) {
  const { t, language } = useLocale();
  return React.useCallback((key: Key) => loc(labels?.[key], language) || t(key), [labels, language, t]);
}
const fill = (text: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), text);

// ── page ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TypeConfigPageProps {
  /** The page title, e.g. "Create Lead Type" / "Edit Lead Type". The app words it. */
  title: React.ReactNode;
  /** A line under the title — only when the app's design has one (there is no default). */
  subtitle?: React.ReactNode;
  /** Shows the back button (navigate in it; guard unsaved changes there). */
  onBack?: () => void;
  backLabel?: string;
  /** Shown above the header (e.g. an app's notice). */
  notice?: React.ReactNode;
  /** The sections, in order (`TypeConfigSection`, `TypeAppearanceSection`, `TypeFormSection`, the app's own). */
  children: React.ReactNode;
  /** The action row at the end: `TypeConfigFooter`, or the app's own. */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * A type's configuration page (Lead Type, Deal Type, Task Type, Asset Type…): header, ordered sections, action row. It
 * holds no data: the app passes the values, the controls and the save rules (see `typeSaveBlock`).
 */
export function TypeConfigPage({ title, subtitle, onBack, backLabel, notice, children, footer, className }: TypeConfigPageProps) {
  return (
    <div className={cn("sf-type-config", className)} data-sf-type-config="">
      {notice}
      <PageHeader
        className="mb-8 border-0 bg-transparent px-0 py-0 md:px-0"
        onBack={onBack}
        backLabel={backLabel}
        title={<span className="text-2xl">{title}</span>}
        subtitle={subtitle}
      />
      <div className="space-y-8">
        {children}
        {footer}
      </div>
    </div>
  );
}

export interface TypeConfigSectionProps {
  title: React.ReactNode;
  /** A line under the heading — only when the app's design has one (there is no default). */
  description?: React.ReactNode;
  /** End-aligned controls beside the heading (e.g. an Add button). */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

/** One titled section of a type page. */
export function TypeConfigSection({ title, description, actions, children, className }: TypeConfigSectionProps) {
  const withActions = actions !== undefined;
  const heading = (
    <div className={withActions ? "min-w-0" : undefined}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
  return (
    <section className={cn("space-y-4", className)}>
      {withActions ? <div className="flex items-start justify-between gap-3">{heading}{actions ? <div className="flex-shrink-0">{actions}</div> : null}</div> : heading}
      {children}
    </section>
  );
}

interface TypeAppearanceBase {
  title?: React.ReactNode;
  description?: React.ReactNode;
  labels?: TypeConfigLabels;
}
/** The package `IconColorPicker` (its props), or the app's own picker as `children`. */
export type TypeAppearanceSectionProps = TypeAppearanceBase & (
  | (Omit<IconColorPickerProps, "className"> & { children?: undefined })
  | (Partial<Omit<IconColorPickerProps, "className">> & { children: React.ReactNode })
);

/** The type's icon and colour (the package `IconColorPicker`, or the app's picker as `children`). */
export function TypeAppearanceSection(props: TypeAppearanceSectionProps) {
  const { title, description, labels, children, ...picker } = props;
  const L = useL(labels);
  return (
    <TypeConfigSection title={title ?? L("tcAppearance")} description={description}>
      {children ?? <IconColorPicker {...(picker as IconColorPickerProps)} />}
    </TypeConfigSection>
  );
}

/** Two columns from `md` up, one below: the grid the Configuration settings sit in. */
export function TypeSettingsGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>{children}</div>;
}

export interface TypeSettingFieldProps {
  label: React.ReactNode;
  /** The control's id (the label points at it). */
  htmlFor?: string;
  /** Adds " *" to the label. */
  required?: boolean;
  /** A link beside the label to where the setting's options are managed (opens in a new tab). */
  manageLink?: { href: string; label: React.ReactNode };
  /** The control (the app's: its select, link input, text input…). */
  children: React.ReactNode;
  /** Lines under the control (what the current value means, the app default…). Falsy entries are skipped. */
  hints?: React.ReactNode[];
  className?: string;
}

/** One setting of a type: label (with an optional manage link), the app's control, hint lines. */
export function TypeSettingField({ label, htmlFor, required, manageLink, children, hints, className }: TypeSettingFieldProps) {
  const text = <Label htmlFor={htmlFor} className="text-xs">{label}{required ? " *" : null}</Label>;
  return (
    <div className={cn("space-y-2", className)}>
      {manageLink ? (
        <div className="flex items-center justify-between gap-2 h-5">
          {text}
          <a href={manageLink.href} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
            {manageLink.label}<ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      ) : text}
      {children}
      {hints?.filter(Boolean).map((h, i) => (
        typeof h === "string" ? <p key={i} className="text-[11px] text-muted-foreground">{h}</p> : <React.Fragment key={i}>{h}</React.Fragment>
      ))}
    </div>
  );
}

export interface TypeConfigFooterProps {
  onCancel?: () => void;
  onSave: () => void;
  /** "create" words Save as Create. Default "edit". */
  mode?: "create" | "edit";
  saveLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  /** Use `typeSaveBlock(...) !== null`. */
  saveDisabled?: boolean;
  saveClassName?: string;
  labels?: TypeConfigLabels;
}

/** The action row: Cancel and Save (Create for a new type). */
export function TypeConfigFooter({ onCancel, onSave, mode = "edit", saveLabel, cancelLabel, saveDisabled, saveClassName, labels }: TypeConfigFooterProps) {
  const L = useL(labels);
  return (
    <div className="flex justify-end gap-2 pt-6 border-t border-border">
      {onCancel ? <Button type="button" variant="outline" size="sm" onClick={onCancel}>{cancelLabel ?? L("tcCancel")}</Button> : null}
      <Button type="button" size="sm" onClick={onSave} disabled={saveDisabled} className={saveClassName}>
        {saveLabel ?? (mode === "create" ? L("tcCreate") : L("tcSave"))}
      </Button>
    </div>
  );
}

// ── form section ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TypeWizardToggleProps {
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  labels?: TypeConfigLabels;
}

/** Wizard mode: a new record walks the form's steps in order. */
export function TypeWizardToggle({ checked, onCheckedChange, label, description, labels }: TypeWizardToggleProps) {
  const L = useL(labels);
  const id = React.useId();
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
      <div>
        <Label htmlFor={id} className="text-xs">{label ?? L("tcWizard")}</Label>
        <p id={`${id}-desc`} className="text-[11px] text-muted-foreground">{description ?? L("tcWizardHint")}</p>
      </div>
      <Switch id={id} aria-describedby={`${id}-desc`} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export interface TypeFormIssuesProps {
  /** Blocking label conflicts (`typeFormConflicts`). */
  conflicts?: readonly TypeFieldConflict[];
  /** Non-blocking warnings: labels of fields that duplicate a standard field (`typeFormReservedWarnings`). */
  warnings?: readonly { key: string; title: string; titleAr?: string }[];
  /** Word a conflict for the app (e.g. name the record type). Default: the package's text. */
  renderConflict?: (conflict: TypeFieldConflict, label: string) => React.ReactNode;
  renderWarning?: (label: string) => React.ReactNode;
  labels?: TypeConfigLabels;
}

/** The form's label problems: conflicts (saving is blocked) and warnings. Nothing when there are none. */
export function TypeFormIssues({ conflicts = [], warnings = [], renderConflict, renderWarning, labels }: TypeFormIssuesProps) {
  const L = useL(labels);
  const { language } = useLocale();
  const labelOf = (f: { title: string; titleAr?: string }) => (language === "ar" ? f.titleAr || f.title : f.title);
  return (
    <>
      {conflicts.length > 0 && (
        <div role="alert" className="space-y-1.5 rounded-lg border border-destructive/50 bg-destructive/5 p-3" data-sf-type-conflicts="">
          {conflicts.map((c) => (
            <p key={c.key} className="inline-flex items-start gap-1.5 text-[11px] font-medium text-destructive">
              <X className="h-3.5 w-3.5 mt-px shrink-0" aria-hidden />
              {renderConflict?.(c, labelOf(c)) ?? fill(L(c.reason === "reserved" ? "tcConflictReserved" : "tcConflictDuplicate"), { label: labelOf(c) })}
            </p>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="space-y-1.5 rounded-lg border border-warning/40 bg-warning/10 p-3" data-sf-type-warnings="">
          {warnings.map((w) => (
            <p key={w.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {renderWarning?.(labelOf(w)) ?? fill(L("tcWarnReserved"), { label: labelOf(w) })}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

// ── field picker ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TypeFieldOption {
  id: string;
  label: Localized;
  /** The field's type, shown beside it. */
  type?: React.ReactNode;
  /** Default "available". Anything else is shown and cannot be picked (`fieldImportStatus`). */
  status?: FieldImportStatus;
}
export interface TypeFieldGroup {
  id: string;
  label: Localized;
  description?: Localized;
  /** Shown as the group's field count (default: `fields.length`). */
  fieldCount?: number;
  fields: TypeFieldOption[];
}
/** What was picked: a whole group (every field it has), or fields picked one by one (across groups). */
export type TypeFieldImport =
  | { mode: "all"; groupId: string }
  | { mode: "selected"; picks: { groupId: string; fieldIds: string[] }[] };

export interface TypeFieldPickerProps {
  groups: readonly TypeFieldGroup[];
  onImport: (choice: TypeFieldImport) => void;
  onClose?: () => void;
  /** The ways offered. Default both; one entry hides the switch. */
  modes?: readonly FieldImportMode[];
  /** Default: the first of `modes`. */
  defaultMode?: FieldImportMode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  labels?: TypeConfigLabels;
  className?: string;
}

/**
 * Pick fields from a field library: a whole group at once ("All fields") or fields one by one ("Selected fields").
 * Fields that cannot be added are shown with the reason and cannot be picked. Copying them is the app's
 * (`planFieldImport`).
 */
export function TypeFieldPicker({ groups, onImport, onClose, modes = ["all", "selected"], defaultMode, title, description, labels, className }: TypeFieldPickerProps) {
  const L = useL(labels);
  const { language } = useLocale();
  const offered = modes.length ? modes : (["all"] as const);
  const [chosen, setMode] = React.useState<FieldImportMode>(defaultMode && offered.includes(defaultMode) ? defaultMode : offered[0]);
  const mode: FieldImportMode = offered.includes(chosen) ? chosen : offered[0];
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set());
  const key = (g: string, f: string) => `${g}\u0001${f}`;
  const q = query.trim().toLowerCase();
  const text = (l: Localized | undefined) => (l == null ? "" : typeof l === "string" ? l : `${l.en} ${l.ar}`).toLowerCase();

  const shown = React.useMemo(() => {
    if (mode === "all" || !q) return groups.map((g) => ({ group: g, fields: g.fields }));
    return groups
      .map((g) => ({ group: g, fields: text(g.label).includes(q) ? g.fields : g.fields.filter((f) => text(f.label).includes(q)) }))
      .filter((x) => x.fields.length > 0);
  }, [groups, mode, q]);

  const available = (f: TypeFieldOption) => (f.status ?? "available") === "available";
  const toggle = (g: string, f: string) => setPicked((prev) => {
    const next = new Set(prev); const k = key(g, f);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  const toggleGroup = (g: TypeFieldGroup, fields: TypeFieldOption[], on: boolean) => setPicked((prev) => {
    const next = new Set(prev);
    for (const f of fields) if (available(f)) { if (on) next.add(key(g.id, f.id)); else next.delete(key(g.id, f.id)); }
    return next;
  });
  const confirm = () => {
    const picks = groups
      .map((g) => ({ groupId: g.id, fieldIds: g.fields.filter((f) => available(f) && picked.has(key(g.id, f.id))).map((f) => f.id) }))
      .filter((p) => p.fieldIds.length > 0);
    if (picks.length) onImport({ mode: "selected", picks });
  };
  const count = groups.reduce((n, g) => n + g.fields.filter((f) => available(f) && picked.has(key(g.id, f.id))).length, 0);
  const statusText = (s: FieldImportStatus) => (s === "present" ? L("tcPresent") : s === "reserved" ? L("tcReserved") : L("tcCore"));

  return (
    <div className={cn("rounded-xl border border-border bg-card/50 overflow-hidden", className)} data-sf-type-field-picker="">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/60 bg-muted/40">
        <div className="flex items-center gap-2 min-w-0">
          <Library className="h-4 w-4 text-primary flex-shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{title ?? L("tcPickerTitle")}</p>
            <p className="text-[11px] text-muted-foreground truncate">{description ?? L("tcPickerHint")}</p>
          </div>
        </div>
        {onClose ? (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onClose} aria-label={L("tcClose")}>
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {offered.length > 1 || mode === "selected" ? (
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border/40">
          {offered.length > 1 ? (
            <ToggleGroup type="single" size="sm" variant="outline" value={mode} aria-label={L("tcModeLabel")}
              onValueChange={(v) => { if (v === "all" || v === "selected") setMode(v); }}>
              {offered.includes("all") ? <ToggleGroupItem value="all">{L("tcModeAll")}</ToggleGroupItem> : null}
              {offered.includes("selected") ? <ToggleGroupItem value="selected">{L("tcModeSelected")}</ToggleGroupItem> : null}
            </ToggleGroup>
          ) : null}
          {mode === "selected" ? (
            <div className="relative min-w-[12rem] flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L("tcSearchFields")} aria-label={L("tcSearchFields")} className="ps-9 h-9" />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="max-h-[320px] overflow-auto p-3 space-y-1.5">
        {groups.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">{L("tcNoGroups")}</div>
        ) : mode === "all" ? (
          groups.map((g) => (
            <button key={g.id} type="button" onClick={() => onImport({ mode: "all", groupId: g.id })}
              className="w-full text-start rounded-lg border border-border/60 bg-card p-3 flex items-center gap-3 transition-all hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Layers className="h-4 w-4" aria-hidden />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{loc(g.label, language)}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 h-4 flex-shrink-0">{g.fieldCount ?? g.fields.length} {L("tcFieldsCount")}</Badge>
                </span>
                {g.description ? <span className="block text-[11px] text-muted-foreground truncate">{loc(g.description, language)}</span> : null}
              </span>
            </button>
          ))
        ) : shown.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">{L("tcNoResults")}</div>
        ) : (
          shown.map(({ group: g, fields }) => {
            const open = fields.filter(available);
            const on = open.filter((f) => picked.has(key(g.id, f.id))).length;
            const groupState: boolean | "indeterminate" = on === 0 ? false : on === open.length ? true : "indeterminate";
            const gid = `sf-tfp-g-${g.id}`;
            return (
              <div key={g.id} role="group" aria-labelledby={`${gid}-l`} className="rounded-lg border border-border/60 bg-card">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
                  <Checkbox id={gid} checked={groupState} disabled={open.length === 0}
                    aria-label={fill(L("tcSelectGroup"), { group: loc(g.label, language) })}
                    onCheckedChange={(v) => toggleGroup(g, fields, v === true)} />
                  <span id={`${gid}-l`} className="text-sm font-medium flex-1 truncate">{loc(g.label, language)}</span>
                  <span className="text-[11px] text-muted-foreground">{g.fieldCount ?? g.fields.length} {L("tcFieldsCount")}</span>
                </div>
                <ul className="p-2 space-y-1">
                  {fields.map((f) => {
                    const fid = `sf-tfp-f-${g.id}-${f.id}`;
                    const s = f.status ?? "available";
                    return (
                      <li key={f.id} className="flex items-center gap-2 px-1">
                        <Checkbox id={fid} checked={s === "available" && picked.has(key(g.id, f.id))} disabled={s !== "available"}
                          onCheckedChange={() => toggle(g.id, f.id)} />
                        <Label htmlFor={fid} className={cn("font-normal flex-1 truncate", s !== "available" && "text-muted-foreground")}>{loc(f.label, language)}</Label>
                        {f.type ? <span className="text-xs text-muted-foreground">{f.type}</span> : null}
                        {s !== "available" ? <Badge variant="outline" className="text-[10px] px-1.5 h-4">{statusText(s)}</Badge> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </div>

      {mode === "selected" && groups.length > 0 ? (
        <div className="flex justify-end p-3 border-t border-border/40">
          <Button type="button" size="sm" disabled={count === 0} onClick={confirm}>{fill(L("tcAddSelected"), { n: count })}</Button>
        </div>
      ) : null}
    </div>
  );
}

/** The feedback line for an import (the app shows it, e.g. as a toast): tone `success` when fields were added. */
export function useFieldImportSummary(labels?: TypeConfigLabels) {
  const L = useL(labels);
  return React.useCallback((plan: Pick<FieldImportPlan<unknown>, "added" | "skippedReserved" | "skippedExisting">) => {
    const skips: string[] = [];
    if (plan.skippedReserved) skips.push(fill(L("tcSkippedReserved"), { n: plan.skippedReserved }));
    if (plan.skippedExisting) skips.push(fill(L("tcSkippedExisting"), { n: plan.skippedExisting }));
    const tail = skips.length ? ` — ${fill(L("tcSkipped"), { list: skips.join(" · ") })}` : "";
    if (plan.added === 0) return { tone: "info" as const, text: `${L("tcNothingAdded")}${tail}` };
    return { tone: "success" as const, text: `${plan.added === 1 ? L("tcAddedOne") : fill(L("tcAdded"), { n: plan.added })}${tail}` };
  }, [L]);
}

export interface TypeFormSectionProps {
  title?: React.ReactNode;
  /** A line under the heading — only when the app's design has one (there is no default). */
  description?: React.ReactNode;
  /** The wizard switch. Absent: no switch. */
  wizard?: Omit<TypeWizardToggleProps, "labels">;
  /** Blocking conflicts and warnings (`TypeFormIssues`). */
  issues?: Omit<TypeFormIssuesProps, "labels">;
  /** The field library. Absent: no Add button. */
  library?: Omit<TypeFieldPickerProps, "onClose" | "labels"> & {
    /** The button that opens the picker. */
    triggerLabel?: React.ReactNode;
    triggerClassName?: string;
    /** Close the picker after an import (default true). */
    closeOnImport?: boolean;
  };
  /** The form designer: the app's, or the package `FieldDesigner` for a Frappe app. */
  children: React.ReactNode;
  labels?: TypeConfigLabels;
}

/** The type's Form section: heading, library button + picker, wizard switch, label problems, then the app's designer. */
export function TypeFormSection({ title, description, wizard, issues, library, children, labels }: TypeFormSectionProps) {
  const L = useL(labels);
  const [picking, setPicking] = React.useState(false);
  const trigger = library && !picking ? (
    <Button type="button" size="sm" onClick={() => setPicking(true)} className={library.triggerClassName}>
      <Library className="h-4 w-4 me-1" aria-hidden />
      {library.triggerLabel ?? L("tcAddFields")}
    </Button>
  ) : null;
  return (
    <TypeConfigSection title={title ?? L("tcForm")} description={description} actions={library ? trigger : undefined}>
      {wizard ? <TypeWizardToggle {...wizard} labels={labels} /> : null}
      {issues ? <TypeFormIssues {...issues} labels={labels} /> : null}
      {library && picking ? (
        <TypeFieldPicker {...library} labels={labels} onClose={() => setPicking(false)}
          onImport={(choice) => { if (library.closeOnImport !== false) setPicking(false); library.onImport(choice); }} />
      ) : null}
      {children}
    </TypeConfigSection>
  );
}
