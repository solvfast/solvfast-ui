import * as React from "react";
import {
  Ban, ChevronDown, ChevronRight, Columns2, Columns3, Columns4, GripVertical, Lock, Plus, Search, Square, Trash2, X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { Switch } from "../../primitives/switch";
import { Textarea } from "../../primitives/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { APPEARANCE_ICONS } from "../../fields/IconColorPicker";
import { useLocale } from "../../theme/ThemeProvider";
import { loc, type Localized } from "../../lib/localized";
import { cn } from "../../lib/cn";
import {
  addField, addSection, addStep, allSections, deleteSection, findField, findSection, maxFieldCols, moveField, moveSection,
  newFormField, nudgeField, nudgeSection, placeAside, removeField, removeStep, reorderStep, rowCountOf, sectionOfField,
  setSectionColumns, setWizard, updateField, updateSection, updateStep,
  type FieldCol, type FormBuilderSection, type FormBuilderStep, type FormBuilderValue, type FormFieldTypeKey,
} from "./model";
import { FORM_FIELD_TYPES, fieldTypeInfo, type FormFieldTypeInfo } from "./fieldTypes";
import { FieldTypePicker, FormFieldPreview } from "./FieldTypePicker";
import {
  FormFieldInspector, useFbL, type FormBuilderConditionProps, type FormBuilderExtensions, type FormBuilderLabels,
} from "./FormFieldInspector";
import { WizardToggle } from "./WizardToggle";

// Literal class maps (Tailwind keeps them): 1–3 field columns; the 4-column case collapses 4 → 2 → 1.
const gridCols = (c: number) => (c === 4 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : c === 3 ? "grid-cols-3" : c === 2 ? "grid-cols-2" : "");
const colStart = (c: number) => (c === 3 ? "col-start-3" : c === 2 ? "col-start-2" : "col-start-1");
const colSpanAll = (c: number) => (c === 4 ? "col-span-full" : c === 3 ? "col-span-3" : "col-span-2");
const rowSpan = (count: number) => (count >= 3 ? "md:col-span-2" : count === 2 ? "md:col-span-3" : "md:col-span-6");
const COLS: FieldCol[] = [1, 2, 3, 4];
const COL_ICON = { 1: Square, 2: Columns2, 3: Columns3, 4: Columns4 } as const;

type Sel = { kind: "none" } | { kind: "field"; id: string } | { kind: "section"; id: string } | { kind: "step"; id: string };
type Drag = { kind: "field"; id: string } | { kind: "section"; id: string } | { kind: "step"; id: string } | null;

export interface FormBuilderProps<S extends FormBuilderSection = FormBuilderSection> extends FormBuilderExtensions {
  value: FormBuilderValue<S>;
  onChange: (next: FormBuilderValue<S>) => void;
  /** The field-type registry (default: the SOLV FAST Field Library's types). */
  fieldTypes?: readonly FormFieldTypeInfo[];
  /** Structured authoring: Table and Display Value types, 4 field columns, option Arabic labels, live option sources. */
  advancedFieldTypes?: boolean;
  /** The most field columns a section may have (default 3; 4 with `advancedFieldTypes`). */
  maxColumns?: FieldCol;
  /** Standard (`core`) fields are fully locked: never removed, re-typed, retitled or made optional (they still move). */
  lockCore?: boolean;
  /** The record word in the locked-field notes ("every Lead"). */
  entityLabel?: Localized;
  /** Show the wizard switch above the canvas (default true; `TypeFormSection` shows its own). */
  wizardToggle?: boolean;
  /** Icons a step may take (Lucide components by name; default: the package's appearance icons). */
  stepIcons?: Readonly<Record<string, LucideIcon>>;
  /** More controls in a section's panel (e.g. an app's renderer hint). */
  renderSectionProperties?: (section: S, update: (patch: Partial<S>) => void) => React.ReactNode;
  labels?: FormBuilderLabels;
  className?: string;
}

/**
 * The form builder: a canvas of steps (wizard mode) → sections (side by side in rows, 1–4 field columns) → fields, and
 * a properties panel (Add a field, a field's properties, a section's, a step's). Fields, sections and steps are dragged
 * into place (and moved with the keyboard: Arrow up / down on a field or section handle, Alt + Arrow on a step).
 * Controlled: every change comes back through `onChange` as a new value. Glass surfaces (`sf-form-builder`).
 */
export function FormBuilder<S extends FormBuilderSection = FormBuilderSection>(props: FormBuilderProps<S>) {
  const {
    value, onChange, fieldTypes = FORM_FIELD_TYPES, advancedFieldTypes = false, maxColumns, lockCore = false, entityLabel,
    wizardToggle = true, stepIcons = APPEARANCE_ICONS, renderSectionProperties, labels, className, ...ext
  } = props;
  const L = useFbL(labels);
  const { language, isRTL } = useLocale();
  const ar = language === "ar";
  const steps = value.steps;
  const wizard = value.wizard;
  const entity = entityLabel ? loc(entityLabel, language) : L("fbRecord");
  const cap: FieldCol = maxColumns ?? (advancedFieldTypes ? 4 : 3);

  const [sel, setSel] = React.useState<Sel>({ kind: "none" });
  const [adding, setAdding] = React.useState<{ sectionId: string; column: FieldCol } | null>(null);
  const [deleting, setDeleting] = React.useState<{ sectionId: string; target: string } | null>(null);
  const [deletingStep, setDeletingStep] = React.useState<{ stepId: string; target: string } | null>(null);
  const [stepIdx, setStepIdx] = React.useState(0);
  const [dragKind, setDragKind] = React.useState<null | "field" | "section" | "step">(null);
  const drag = React.useRef<Drag>(null);
  const startDrag = (d: Drag) => { drag.current = d; setDragKind(d?.kind ?? null); };
  const endDrag = () => { drag.current = null; setDragKind(null); };

  const commit = (next: FormBuilderStep<S>[]) => onChange({ ...value, steps: next });
  const curStep = steps[Math.min(stepIdx, steps.length - 1)] ?? steps[0];
  const sectionTitle = (s: S) => (ar ? s.titleAr : s.title) || L("fbUntitledSection");
  const stepTitle = (s: FormBuilderStep<S>, i: number) => (ar ? s.titleAr : s.title) || L("fbStepN", { n: i + 1 });
  const otherSectionId = (id: string) => allSections(steps).find((s) => s.id !== id && !s.system)?.id ?? "";
  const otherStepId = (id: string) => steps.find((s) => s.id !== id)?.id ?? "";
  const update = (sid: string, patch: Partial<S>) => commit(updateSection(steps, sid, patch));

  const pickType = (type: FormFieldTypeKey) => {
    if (!adding) return;
    const field = newFormField(type) as S["fields"][number];
    commit(addField(steps, adding.sectionId, adding.column, field));
    setAdding(null);
    setSel({ kind: "field", id: field.id });
  };
  const newSectionIn = (stepId: string, afterId?: string) => {
    const r = addSection(steps, stepId, afterId);
    commit(r.steps);
    setSel({ kind: "section", id: r.section.id });
  };

  // ── canvas ──
  const renderField = (f: S["fields"][number], section: S) => {
    const selected = sel.kind === "field" && sel.id === f.id;
    const span = section.columns > 1 ? (f.fullWidth ? colSpanAll(section.columns) : section.columns === 4 ? "" : colStart(f.column ?? 1)) : "";
    const typeName = loc(fieldTypeInfo(f.type, fieldTypes)?.label, language);
    return (
      <div key={f.id} data-fb-field={f.id}
        className={cn("group/field relative min-w-0 rounded-lg border bg-card p-3 transition-colors cursor-pointer", span,
          selected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/40")}
        onClick={(e) => { e.stopPropagation(); setAdding(null); setSel({ kind: "field", id: f.id }); }}
        onDragOver={(e) => { if (drag.current?.kind === "field") { e.preventDefault(); e.stopPropagation(); } }}
        onDrop={(e) => {
          if (drag.current?.kind !== "field") return;
          e.preventDefault(); e.stopPropagation();
          commit(moveField(steps, drag.current.id, section.id, (f.column ?? 1) as FieldCol, f.id)); endDrag();
        }}>
        <div className="flex items-start gap-2">
          <button type="button" draggable aria-label={`${L("fbReorderField")}: ${(ar ? f.titleAr || f.title : f.title) || typeName}`}
            aria-pressed={selected}
            className="mt-1 cursor-grab text-muted-foreground/60 hover:text-foreground focus-visible:outline-none focus-visible:text-primary"
            onDragEnd={endDrag}
            onDragStart={(e) => { startDrag({ kind: "field", id: f.id }); e.dataTransfer?.setData?.("text/plain", f.id); e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); setAdding(null); setSel({ kind: "field", id: f.id }); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") { e.preventDefault(); commit(nudgeField(steps, f.id, -1)); }
              if (e.key === "ArrowDown") { e.preventDefault(); commit(nudgeField(steps, f.id, 1)); }
            }}>
            <GripVertical className="h-4 w-4" aria-hidden />
          </button>
          <div className="min-w-0 flex-1"><FormFieldPreview field={f} fieldTypes={fieldTypes} sources={ext.sources} labels={labels} /></div>
          {f.core ? (
            <span className="inline-flex" role="img" aria-label={L("fbStandardField")} title={L("fbStandardFieldTip", { entity })}>
              <Lock className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const columnDrop = (section: S, column: FieldCol) => (
    <div key={`drop-${column}`} data-fb-column-drop={column}
      className={cn("rounded-lg border border-dashed border-border/60 py-2 text-center text-[11px] text-muted-foreground/70", section.columns > 1 && section.columns !== 4 ? colStart(column) : "")}
      onDragOver={(e) => { if (drag.current?.kind === "field") e.preventDefault(); }}
      onDrop={(e) => { if (drag.current?.kind !== "field") return; e.preventDefault(); commit(moveField(steps, drag.current.id, section.id, column)); endDrag(); }}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-primary" aria-label={section.columns > 1 ? `${L("fbAddField")} (${column})` : L("fbAddField")}
        onClick={(e) => { e.stopPropagation(); setSel({ kind: "none" }); setAdding({ sectionId: section.id, column }); }}>
        <Plus className="h-3 w-3" aria-hidden />{L("fbAddField")}
      </button>
    </div>
  );

  const renderSection = (section: S, step: FormBuilderStep<S>) => {
    const selected = sel.kind === "section" && sel.id === section.id;
    const collapsed = section.startCollapsed && section.collapsible;
    const allowed = COLS.filter((c) => c <= maxFieldCols(rowCountOf(step.sections, section.id)) && c <= cap);
    return (
      <div key={section.id} className="space-y-2" data-fb-section={section.id}>
        <div className="group/add h-2 -my-1 flex items-center justify-center">
          <button type="button" className="opacity-0 group-hover/add:opacity-100 focus-visible:opacity-100 transition-opacity text-[11px] text-primary inline-flex items-center gap-1"
            onClick={() => newSectionIn(step.id, section.id)}>
            <Plus className="h-3 w-3" aria-hidden />{L("fbAddSectionHere")}
          </button>
        </div>
        <div className={cn("relative rounded-xl border bg-card/60 overflow-hidden", selected ? "border-primary ring-1 ring-primary/30" : "border-border")}
          onDragOver={(e) => { if (drag.current?.kind === "section") e.preventDefault(); }}
          onDrop={(e) => { if (drag.current?.kind === "section") { e.preventDefault(); commit(moveSection(steps, drag.current.id, step.id, section.id)); endDrag(); } }}>
          {dragKind === "section" && drag.current?.kind === "section" && drag.current.id !== section.id ? (
            <>
              <AsideZone side="start" onDrop={() => { if (drag.current?.kind === "section") commit(placeAside(steps, drag.current.id, section.id, "start")); endDrag(); }} />
              <AsideZone side="end" onDrop={() => { if (drag.current?.kind === "section") commit(placeAside(steps, drag.current.id, section.id, "end")); endDrag(); }} />
            </>
          ) : null}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 cursor-pointer" onClick={() => { setAdding(null); setSel({ kind: "section", id: section.id }); }}>
            <button type="button" draggable aria-label={`${L("fbReorderSection")}: ${sectionTitle(section)}`} className="cursor-grab text-muted-foreground/60 hover:text-foreground focus-visible:outline-none focus-visible:text-primary"
              onDragEnd={endDrag}
              onDragStart={(e) => { startDrag({ kind: "section", id: section.id }); e.dataTransfer?.setData?.("text/plain", section.id); e.stopPropagation(); }}
              onClick={(e) => { e.stopPropagation(); setAdding(null); setSel({ kind: "section", id: section.id }); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp") { e.preventDefault(); commit(nudgeSection(steps, section.id, -1)); }
                if (e.key === "ArrowDown") { e.preventDefault(); commit(nudgeSection(steps, section.id, 1)); }
              }}>
              <GripVertical className="h-4 w-4" aria-hidden />
            </button>
            {section.collapsible ? (
              <button type="button" aria-label={collapsed ? L("fbExpandSection") : L("fbCollapseSection")} aria-expanded={!collapsed} className="text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); update(section.id, { startCollapsed: !section.startCollapsed } as Partial<S>); }}>
                {collapsed ? <ChevronRight className={cn("h-4 w-4", isRTL && "rotate-180")} aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
              </button>
            ) : null}
            <span className="text-sm font-medium flex-1 min-w-0 truncate">
              {(ar ? section.titleAr : section.title) || <span className="text-muted-foreground/60 italic">{L("fbUntitledSection")}</span>}
              {section.system ? <Lock className="inline h-3 w-3 ms-1 text-muted-foreground/70" aria-hidden /> : null}
            </span>
            {allowed.length > 1 ? (
              <div className="flex items-center gap-0.5" role="radiogroup" aria-label={L("fbFieldColumns")} onClick={(e) => e.stopPropagation()}>
                {allowed.map((c) => {
                  const Icon = COL_ICON[c];
                  return (
                    <button key={c} type="button" role="radio" aria-checked={section.columns === c} title={L("fbFieldColumnsN", { n: c })} aria-label={L("fbFieldColumnsN", { n: c })}
                      onClick={() => update(section.id, setSectionColumns(section, c))}
                      className={cn("h-7 w-7 rounded flex items-center justify-center", section.columns === c ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  );
                })}
              </div>
            ) : null}
            {!section.system ? (
              <button type="button" title={L("fbDeleteSection")} aria-label={`${L("fbDeleteSection")}: ${sectionTitle(section)}`}
                onClick={(e) => { e.stopPropagation(); setAdding(null); setSel({ kind: "section", id: section.id }); setDeleting({ sectionId: section.id, target: otherSectionId(section.id) }); }}
                className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-muted">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          {!collapsed ? (
            <div className="p-3">
              {(ar ? section.descriptionAr || section.description : section.description) ? (
                <p className="text-[11px] text-muted-foreground mb-2">{ar ? section.descriptionAr || section.description : section.description}</p>
              ) : null}
              <div className={cn("min-w-0", section.columns > 1 ? `grid ${gridCols(section.columns)} gap-3 [grid-auto-flow:dense]` : "space-y-2")}>
                {section.fields.map((f) => renderField(f, section))}
                {COLS.slice(0, section.columns).map((c) => columnDrop(section, c))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  // ── side panel ──
  const panel = (): React.ReactNode => {
    if (adding) {
      return (
        <PanelShell title={L("fbAddAField")} onClose={() => setAdding(null)} closeLabel={L("fbClose")}>
          <FieldTypePicker fieldTypes={fieldTypes} advanced={advancedFieldTypes} onPick={pickType} labels={labels} />
        </PanelShell>
      );
    }
    if (sel.kind === "field") {
      const f = findField(steps, sel.id);
      if (!f) return <EmptyPanel text={L("fbSelectElement")} />;
      const info = fieldTypeInfo(f.type, fieldTypes);
      const Icon = info?.icon;
      return (
        <PanelShell
          title={<span className="inline-flex items-center gap-1.5">{Icon ? <Icon className="h-4 w-4 text-primary" aria-hidden /> : null}{loc(info?.label, language)}</span>}
          onClose={() => setSel({ kind: "none" })} closeLabel={L("fbClose")}
          action={!f.core ? (
            <button type="button" className="text-muted-foreground hover:text-destructive" title={L("fbDeleteField")} aria-label={L("fbDeleteField")}
              onClick={() => { commit(removeField(steps, f.id)); setSel({ kind: "none" }); }}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          ) : undefined}>
          {f.core ? (
            <p className="mb-3 text-[11px] text-muted-foreground inline-flex items-start gap-1">
              <Lock className="h-3 w-3 mt-0.5 shrink-0" aria-hidden />{lockCore ? L("fbLockedTypeForm", { entity }) : L("fbLockedCore")}
            </p>
          ) : null}
          <SwitchRow label={L("fbFullWidth")} checked={!!f.fullWidth} onChange={(v) => commit(updateField(steps, f.id, { fullWidth: v } as Partial<S["fields"][number]>, lockCore))} />
          <FormFieldInspector key={f.id} field={f} siblings={sectionOfField(steps, f.id)?.fields ?? []} fieldTypes={fieldTypes} advanced={advancedFieldTypes} labels={labels}
            onChange={(patch) => commit(updateField(steps, f.id, patch as Partial<S["fields"][number]>, lockCore))} {...ext} />
        </PanelShell>
      );
    }
    if (sel.kind === "section") {
      const s = findSection(steps, sel.id);
      if (!s) return <EmptyPanel text={L("fbSelectElement")} />;
      if (deleting && deleting.sectionId === s.id) {
        return (
          <PanelShell title={L("fbSection")} onClose={() => { setSel({ kind: "none" }); setDeleting(null); }} closeLabel={L("fbClose")}>
            <div className="space-y-3" role="group" aria-label={L("fbDeleteSection")}>
              <p className="text-xs text-foreground">{L("fbSectionHasFields", { n: s.fields.length })}</p>
              {s.fields.length > 0 && otherSectionId(s.id) ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">{L("fbMoveFieldsTo")}</Label>
                  <Select value={deleting.target} onValueChange={(v) => setDeleting({ ...deleting, target: v })}>
                    <SelectTrigger aria-label={L("fbMoveFieldsTo")} className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{allSections(steps).filter((x) => x.id !== s.id).map((x) => <SelectItem key={x.id} value={x.id}>{sectionTitle(x)}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" size="sm" className="w-full" onClick={() => { commit(deleteSection(steps, s.id, "move", deleting.target)); setDeleting(null); setSel({ kind: "none" }); }}>{L("fbMoveFieldsDelete")}</Button>
                </div>
              ) : null}
              <Button type="button" size="sm" variant="destructive" className="w-full" onClick={() => { commit(deleteSection(steps, s.id, "with-fields")); setDeleting(null); setSel({ kind: "none" }); }}>{L("fbDeleteSectionFields")}</Button>
              <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => setDeleting(null)}>{L("fbCancel")}</Button>
            </div>
          </PanelShell>
        );
      }
      const step = steps.find((x) => x.sections.some((y) => y.id === s.id));
      const capCols = COLS.filter((c) => c <= maxFieldCols(step ? rowCountOf(step.sections, s.id) : 1) && c <= cap);
      return (
        <PanelShell title={L("fbSection")} onClose={() => setSel({ kind: "none" })} closeLabel={L("fbClose")}>
          <div className="space-y-3">
            <TitleInput label={L("fbSectionTitle")} value={(ar ? s.titleAr : s.title) ?? ""} onChange={(v) => update(s.id, (ar ? { titleAr: v } : { title: v }) as Partial<S>)} />
            <TextArea label={L("fbDescription")} value={(ar ? s.descriptionAr : s.description) ?? ""} placeholder={L("fbOptionalHelper")}
              onChange={(v) => update(s.id, (ar ? { descriptionAr: v } : { description: v }) as Partial<S>)} />
            {renderSectionProperties?.(s, (patch) => update(s.id, patch))}
            {capCols.length > 1 ? (
              <div className="space-y-1.5">
                <Label className="text-xs">{L("fbFieldColumns")}</Label>
                <div className="flex gap-2" role="radiogroup" aria-label={L("fbFieldColumns")}>
                  {capCols.map((c) => {
                    const Icon = COL_ICON[c];
                    return (
                      <button key={c} type="button" role="radio" aria-checked={s.columns === c} aria-label={L("fbFieldColumnsN", { n: c })} onClick={() => update(s.id, setSectionColumns(s, c))}
                        className={cn("flex-1 h-9 rounded-lg border flex items-center justify-center", s.columns === c ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted")}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">{L("fbSideBySideTip")}</p>
            <SwitchRow label={L("fbCollapsible")} checked={!!s.collapsible} onChange={(v) => update(s.id, { collapsible: v } as Partial<S>)} />
            {s.collapsible ? <SwitchRow label={L("fbStartsCollapsed")} checked={!!s.startCollapsed} onChange={(v) => update(s.id, { startCollapsed: v } as Partial<S>)} /> : null}
          </div>
        </PanelShell>
      );
    }
    if (sel.kind === "step") {
      const st = steps.find((x) => x.id === sel.id);
      if (!st) return <EmptyPanel text={L("fbSelectElement")} />;
      const close = () => { setSel({ kind: "none" }); setDeletingStep(null); };
      if (deletingStep && deletingStep.stepId === st.id) {
        return (
          <PanelShell title={L("fbDeleteStep")} onClose={close} closeLabel={L("fbClose")}>
            <div className="space-y-3">
              <p className="text-xs text-foreground">{L("fbStepHasSections", { n: st.sections.length })}</p>
              {st.sections.length > 0 && otherStepId(st.id) ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">{L("fbMoveSectionsTo")}</Label>
                  <Select value={deletingStep.target} onValueChange={(v) => setDeletingStep({ ...deletingStep, target: v })}>
                    <SelectTrigger aria-label={L("fbMoveSectionsTo")} className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{steps.filter((x) => x.id !== st.id).map((x) => <SelectItem key={x.id} value={x.id}>{stepTitle(x, steps.indexOf(x))}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" size="sm" className="w-full" onClick={() => deleteStep(st.id, "move", deletingStep.target)}>{L("fbMoveSectionsDelete")}</Button>
                </div>
              ) : null}
              <Button type="button" size="sm" variant="destructive" className="w-full" onClick={() => deleteStep(st.id, "with-sections")}>{L("fbDeleteStepSections")}</Button>
              <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => setDeletingStep(null)}>{L("fbCancel")}</Button>
            </div>
          </PanelShell>
        );
      }
      const Condition = (p: FormBuilderConditionProps) => (ext.renderCondition ? ext.renderCondition(p) : <DefaultStepCondition {...p} />);
      return (
        <PanelShell title={L("fbStep")} onClose={close} closeLabel={L("fbClose")}>
          <TitleInput required label={L("fbStepTitle")} value={(ar ? st.titleAr : st.title) ?? ""} onChange={(v) => commit(updateStep(steps, st.id, ar ? { titleAr: v } : { title: v }))} />
          <div className="mt-3"><TextArea label={L("fbDescription")} value={st.description ?? ""} onChange={(v) => commit(updateStep(steps, st.id, { description: v }))} /></div>
          <div className="space-y-1.5 mt-3">
            <Label className="text-xs">{L("fbIcon")}</Label>
            <StepIconPicker value={st.icon} icons={stepIcons} onChange={(name) => commit(updateStep(steps, st.id, { icon: name }))} labels={labels} />
          </div>
          <div className="mt-3">
            {Condition({ label: L("fbStepShowWhen"), helper: L("fbStepShowWhenHelp"), value: st.showWhen ?? "", onChange: (v) => commit(updateStep(steps, st.id, { showWhen: v })) })}
          </div>
          {steps.length > 1 ? (
            <Button type="button" variant="destructive" size="sm" className="w-full gap-2 mt-4"
              onClick={() => (st.sections.length ? setDeletingStep({ stepId: st.id, target: otherStepId(st.id) }) : deleteStep(st.id, "with-sections"))}>
              <Trash2 className="h-4 w-4" aria-hidden />{L("fbDeleteStep")}
            </Button>
          ) : null}
        </PanelShell>
      );
    }
    return <EmptyPanel text={L("fbSelectElement")} />;
  };

  const deleteStep = (id: string, mode: "move" | "with-sections", target?: string) => {
    const idx = steps.findIndex((s) => s.id === id);
    const next = removeStep(steps, id, mode, target);
    commit(next);
    setStepIdx(Math.max(0, Math.min(idx, next.length - 1)));
    setDeletingStep(null);
    setSel({ kind: "none" });
  };
  const emptyStepWarning = wizard && steps.some((s) => s.sections.length === 0);

  return (
    <div className={cn("sf-form-builder space-y-3", className)} data-sf-form-builder="">
      {wizardToggle ? <WizardToggle checked={wizard} onCheckedChange={(on) => { onChange(setWizard(value, on)); setStepIdx(0); setSel({ kind: "none" }); }} /> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]" onClick={() => setSel({ kind: "none" })}>
        <div className="min-w-0 space-y-3" onClick={(e) => e.stopPropagation()}>
          {wizard ? (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label={L("fbSteps")}>
                {steps.map((st, i) => {
                  const Icon = st.icon ? stepIcons[st.icon] : undefined;
                  return (
                    <button key={st.id} type="button" aria-current={i === stepIdx ? "step" : undefined} draggable data-fb-step={st.id}
                      onDragEnd={endDrag}
                      onDragStart={(e) => { startDrag({ kind: "step", id: st.id }); e.dataTransfer?.setData?.("text/plain", st.id); }}
                      onDragOver={(e) => { if (drag.current?.kind === "step" || drag.current?.kind === "section") e.preventDefault(); }}
                      onDrop={() => {
                        if (drag.current?.kind === "step") commit(reorderStep(steps, drag.current.id, st.id));
                        else if (drag.current?.kind === "section") commit(moveSection(steps, drag.current.id, st.id));
                        endDrag();
                      }}
                      onKeyDown={(e) => {
                        if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                        e.preventDefault();
                        const forward = (e.key === "ArrowRight") !== isRTL;
                        const j = i + (forward ? 1 : -1);
                        if (j < 0 || j >= steps.length) return;
                        commit(reorderStep(steps, st.id, steps[j].id));
                        setStepIdx(j);
                      }}
                      onClick={() => { setStepIdx(i); setAdding(null); setSel({ kind: "step", id: st.id }); }}
                      className={cn("shrink-0 h-8 px-3 rounded-full text-xs border inline-flex items-center gap-1.5",
                        i === stepIdx ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : <span className="h-4 w-4 rounded-full bg-current/10 text-[10px] flex items-center justify-center" aria-hidden>{i + 1}</span>}
                      {stepTitle(st, i)}
                      {st.showWhen ? <span title={L("fbHasShowWhen")} aria-label={L("fbHasShowWhen")} className="text-primary">◇</span> : null}
                      {st.sections.length === 0 ? <span className="text-destructive" title={L("fbStepEmpty")} aria-label={L("fbStepEmpty")}>•</span> : null}
                    </button>
                  );
                })}
                <button type="button" className="shrink-0 h-8 px-3 rounded-full text-xs border border-dashed border-border text-primary inline-flex items-center gap-1"
                  onClick={() => { const r = addStep(steps); commit(r.steps); setStepIdx(steps.length); setAdding(null); setSel({ kind: "step", id: r.step.id }); }}>
                  <Plus className="h-3 w-3" aria-hidden />{L("fbAddStep")}
                </button>
              </div>
            </div>
          ) : null}
          {(wizard ? (curStep ? [curStep] : []) : steps).map((st) => (
            <div key={st.id} className="space-y-3" role={wizard ? "group" : undefined} aria-label={wizard ? stepTitle(st, steps.indexOf(st)) : undefined}>
              {st.sections.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{L("fbNoSectionsInStep")}</div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
                {st.sections.map((sec) => <div key={sec.id} className={cn("min-w-0", rowSpan(rowCountOf(st.sections, sec.id)))}>{renderSection(sec, st)}</div>)}
              </div>
              <button type="button" onClick={() => newSectionIn(st.id)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-primary hover:bg-muted/40">
                <Plus className="h-4 w-4" aria-hidden />{L("fbAddSection")}
              </button>
            </div>
          ))}
          {emptyStepWarning ? <p className="text-[11px] text-destructive" role="alert">{L("fbEmptyStepWarning")}</p> : null}
        </div>
        <div className="lg:sticky lg:top-4 self-start" onClick={(e) => e.stopPropagation()}>
          <div className="rounded-xl border border-border bg-card" data-fb-panel={adding ? "add" : sel.kind}>{panel()}</div>
        </div>
      </div>
    </div>
  );
}

// ── small parts ──
function PanelShell({ title, onClose, closeLabel, action, children }: { title: React.ReactNode; onClose?: () => void; closeLabel: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div role="region" aria-label={typeof title === "string" ? title : undefined}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold flex-1 min-w-0">{title}</h3>
        {action}
        {onClose ? <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={closeLabel} onClick={onClose}><X className="h-4 w-4" aria-hidden /></button> : null}
      </div>
      <div className="p-4 max-h-[calc(100dvh-10rem)] overflow-y-auto">{children}</div>
    </div>
  );
}
function EmptyPanel({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
function AsideZone({ side, onDrop }: { side: "start" | "end"; onDrop: () => void }) {
  const [over, setOver] = React.useState(false);
  return (
    <div data-fb-aside={side} className={cn("absolute inset-y-0 z-20 w-1/4 flex items-center justify-center", side === "start" ? "start-0" : "end-0")}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); onDrop(); }}>
      <div className={cn("h-[80%] w-full mx-1 rounded-lg border-2 border-dashed transition-colors", over ? "border-primary bg-primary/10" : "border-transparent")} />
    </div>
  );
}
function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-2.5 mb-3 last:mb-0">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
function TitleInput({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}{required ? <span className="text-destructive" aria-hidden> *</span> : null}</Label>
      <Input id={id} value={value} required={required} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Textarea id={id} rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function DefaultStepCondition({ label, helper, value, onChange }: FormBuilderConditionProps) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Textarea id={id} rows={2} dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" aria-describedby={`${id}-h`} />
      <p id={`${id}-h`} className="text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
}
function StepIconPicker({ value, icons, onChange, labels }: { value?: string; icons: Readonly<Record<string, LucideIcon>>; onChange: (name: string | undefined) => void; labels?: FormBuilderLabels }) {
  const L = useFbL(labels);
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const names = Object.keys(icons).filter((n) => !query || n.toLowerCase().includes(query));
  const Selected = value ? icons[value] : undefined;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-md border border-border bg-muted/30 flex items-center justify-center text-primary shrink-0" aria-hidden>
          {Selected ? <Selected className="h-4 w-4" /> : <Ban className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="relative flex-1">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="h-9 ps-8 text-sm" placeholder={L("fbSearchIcons")} aria-label={L("fbSearchIcons")} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 p-2 border border-border rounded-md bg-muted/20 max-h-40 overflow-y-auto" role="radiogroup" aria-label={L("fbIcon")}>
        <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(undefined)} title={L("fbNoIcon")} aria-label={L("fbNoIcon")}
          className={cn("h-8 w-8 rounded-md flex items-center justify-center border border-dashed", !value ? "bg-primary/10 text-primary border-primary/50" : "border-border/60 text-muted-foreground hover:bg-muted")}>
          <Ban className="h-4 w-4" aria-hidden />
        </button>
        {names.map((name) => {
          const I = icons[name];
          const active = value === name;
          return (
            <button key={name} type="button" role="radio" aria-checked={active} onClick={() => onChange(name)} title={name} aria-label={name}
              className={cn("h-8 w-8 rounded-md flex items-center justify-center transition-colors", active ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}>
              <I className="h-4 w-4" aria-hidden />
            </button>
          );
        })}
        {names.length === 0 ? <p className="text-[11px] text-muted-foreground py-2 px-1">{L("fbNoMatchingIcons")}</p> : null}
      </div>
    </div>
  );
}
