import * as React from "react";
import {
  ChevronDown, Download, Eye, Filter, GitBranch, Link2, ListChecks, Plus, Rows3, Settings2, ShieldCheck, Sigma, Table2, X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../../primitives/button";
import { Input } from "../../primitives/input";
import { Label } from "../../primitives/label";
import { Switch } from "../../primitives/switch";
import { Textarea } from "../../primitives/textarea";
import { SearchCombobox } from "../../primitives/search-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { ColorInput } from "../../fields/ColorInput";
import { useLocale } from "../../theme/ThemeProvider";
import type { formBuilderEn } from "../../theme/messages-ws/formBuilder";
import { loc, type Localized } from "../../lib/localized";
import { cn } from "../../lib/cn";
import {
  formBuilderId, newOption, newTableColumn, type FieldFilterRule, type FormBuilderField, type FormFieldOption,
  type FormFieldTypeKey, type TableColumn,
} from "./model";
import { FORM_FIELD_TYPES, fieldTypeInfo, tableColumnTypes, type FormFieldTypeInfo } from "./fieldTypes";

export type FormBuilderKey = keyof typeof formBuilderEn;
export type FormBuilderLabels = Partial<Record<FormBuilderKey, Localized>>;

/** A value the app computes (a calculated source): `scalar` (a Display Value, a derived column), `list` (a table's
 *  rows) or `options` (a choice field's live option list; `options()` gives them for the preview and the default). */
export interface FormBuilderSource {
  id: string;
  label: Localized;
  kind: "scalar" | "list" | "options";
  /** Shown beside the source in the picker (its group). */
  group?: Localized;
  options?: () => { value: string; label: Localized }[];
}
/** An object a Record Link may point at: its fields (for link filters and auto-fill) and a few sample records (for
 *  the default value and the preview). */
export interface FormBuilderLinkTarget {
  value: string;
  label: Localized;
  fields?: { value: string; label: Localized }[];
  records?: { id: string; label: string }[];
}
/** The app's own control for a condition (e.g. one that drafts the expression with an assistant). */
export interface FormBuilderConditionProps { label: string; helper: string; value: string; onChange: (v: string) => void }
/** The app's own input for a field's title (e.g. an assisted text input). */
export interface FormBuilderTitleProps { value: string; onChange: (v: string) => void; dir: "rtl" | "ltr"; placeholder: string; "aria-label": string }

/** What the app gives the builder and the inspector (data it owns). */
export interface FormBuilderExtensions {
  /** Objects a Record Link may point at. Absent: "Links to" offers nothing. */
  linkTargets?: readonly FormBuilderLinkTarget[];
  /** Calculated sources (Display Value, table rows, derived columns, live option lists). */
  sources?: readonly FormBuilderSource[];
  renderCondition?: (props: FormBuilderConditionProps) => React.ReactNode;
  renderTitleInput?: (props: FormBuilderTitleProps) => React.ReactNode;
  /** More property sections for a field (rendered after Display). */
  renderFieldProperties?: (field: FormBuilderField, update: (patch: Partial<FormBuilderField>) => void) => React.ReactNode;
}

export function useFbL(labels?: FormBuilderLabels) {
  const { t, language } = useLocale();
  return React.useCallback((key: FormBuilderKey, vars?: Record<string, string | number>) => {
    let s = loc(labels?.[key], language) || t(key);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }, [labels, language, t]);
}

const OPERATORS = [
  { value: "equals", key: "fbOpEquals" }, { value: "not_equals", key: "fbOpNotEquals" }, { value: "contains", key: "fbOpContains" },
  { value: "gt", key: "fbOpGt" }, { value: "lt", key: "fbOpLt" },
] as const;

const isNumeric = (t: string) => t === "number" || t === "decimal" || t === "currency" || t === "percent";

/** The options a choice field shows: its live source's (when bound and given), else its own. */
export function fieldChoices(field: { optionsFrom?: string; options?: FormFieldOption[] }, sources: readonly FormBuilderSource[] | undefined, language: "en" | "ar"): FormFieldOption[] {
  if (field.optionsFrom) {
    const s = sources?.find((x) => x.id === field.optionsFrom);
    if (s?.kind === "options" && s.options) return s.options().map((o) => ({ id: o.value, label: loc(o.label, language) }));
  }
  // Static options are shown — and stored as defaults — by their label as written (as the Field Library does).
  return field.options ?? [];
}

/* ── collapsible property section ── */
function PropSection({ title, icon: Icon, defaultOpen, children }: { title: string; icon: LucideIcon; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const id = React.useId();
  return (
    <div className="border-t border-border/40 pt-2 first:border-t-0 first:pt-0" data-fb-prop-section={title}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} className="flex items-center gap-2 w-full text-start py-1">
        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground flex-1">{title}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? <div id={id} className="pt-2.5 pb-1 space-y-3">{children}</div> : null}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked?: boolean; onChange: (v: boolean) => void }) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id} className="text-xs text-foreground font-normal">{label}</Label>
      <Switch id={id} checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({ label, children, htmlFor }: { label: React.ReactNode; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/** A picker over the app's sources of one kind (with a "None" choice). */
export function SourcePicker({ value, onChange, sources, kind, placeholder, ariaLabel, labels }: {
  value?: string; onChange: (id: string | undefined) => void; sources?: readonly FormBuilderSource[]; kind?: FormBuilderSource["kind"];
  placeholder?: string; ariaLabel: string; labels?: FormBuilderLabels;
}) {
  const L = useFbL(labels);
  const { language } = useLocale();
  const list = (sources ?? []).filter((s) => !kind || s.kind === kind);
  const NONE = "__none__";
  return (
    <SearchCombobox variant="field" aria-label={ariaLabel} value={value || undefined}
      options={[{ value: NONE, label: L("fbNone") }, ...list.map((s) => ({ value: s.id, label: loc(s.label, language), description: s.group ? loc(s.group, language) : undefined }))]}
      onSelect={(v) => onChange(v === NONE ? undefined : v)}
      placeholder={placeholder ?? L("fbPickSource")} searchPlaceholder={L("fbSearch")} emptyText={list.length ? L("fbNoResults") : L("fbNoSources")} className="text-sm" />
  );
}

/* ── type-aware default value ── */
function DefaultValueControl({ field, onChange, sources, linkTargets, labels }: {
  field: FormBuilderField; onChange: (v: string) => void; sources?: readonly FormBuilderSource[]; linkTargets?: readonly FormBuilderLinkTarget[]; labels?: FormBuilderLabels;
}) {
  const L = useFbL(labels);
  const { language } = useLocale();
  const v = field.defaultValue ?? "";
  const t = field.type;
  const aria = L("fbDefaultValue");
  if (t === "checkbox") return <Switch aria-label={aria} checked={v === "true"} onCheckedChange={(c) => onChange(c ? "true" : "false")} />;
  if (t === "dropdown" || t === "radio") {
    return (
      <Select value={v} onValueChange={onChange}>
        <SelectTrigger aria-label={aria} className="h-9 text-sm"><SelectValue placeholder={L("fbNone")} /></SelectTrigger>
        <SelectContent>{fieldChoices(field, sources, language).filter((o) => o.label).map((o) => <SelectItem key={o.id} value={o.label}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  if (t === "multi_select") {
    const sel = v ? v.split("||") : [];
    const opts = fieldChoices(field, sources, language);
    const toggle = (label: string) => onChange((sel.includes(label) ? sel.filter((x) => x !== label) : [...sel, label]).join("||"));
    return (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={aria}>
        {opts.length === 0
          ? <p className="text-[11px] text-muted-foreground">{L("fbAddOptionsFirst")}</p>
          : opts.map((o) => {
            const active = sel.includes(o.label);
            return (
              <button key={o.id} type="button" aria-pressed={active} onClick={() => toggle(o.label)}
                className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-colors",
                  active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border/60 hover:bg-muted")}>
                {o.label}
              </button>
            );
          })}
      </div>
    );
  }
  if (t === "record_link") {
    const recs = linkTargets?.find((x) => x.value === field.linkTarget)?.records ?? [];
    return (
      <Select value={v} onValueChange={onChange} disabled={!field.linkTarget}>
        <SelectTrigger aria-label={aria} className="h-9 text-sm"><SelectValue placeholder={field.linkTarget ? L("fbPickRecord") : L("fbChooseObjectFirst")} /></SelectTrigger>
        <SelectContent>{recs.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  if (t === "rating") {
    return (
      <Select value={v} onValueChange={onChange}>
        <SelectTrigger aria-label={aria} className="h-9 text-sm w-28"><SelectValue placeholder="0" /></SelectTrigger>
        <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} ★</SelectItem>)}</SelectContent>
      </Select>
    );
  }
  if (t === "date") return <Input aria-label={aria} type="date" value={v} onChange={(e) => onChange(e.target.value)} className="h-9 w-44" />;
  if (t === "datetime") return <Input aria-label={aria} type="datetime-local" value={v} onChange={(e) => onChange(e.target.value)} className="h-9 w-56" />;
  if (t === "time") return <Input aria-label={aria} type="time" value={v} onChange={(e) => onChange(e.target.value)} className="h-9 w-32" />;
  if (t === "color") return <ColorInput value={v || null} onChange={(c) => onChange(c ?? "")} className="w-44" aria-label={aria} />;
  if (isNumeric(t) || t === "duration") return <Input aria-label={aria} type="number" value={v} onChange={(e) => onChange(e.target.value)} className="h-9 w-40" placeholder="0" />;
  return <Input aria-label={aria} value={v} onChange={(e) => onChange(e.target.value)} className="h-9" placeholder={L("fbDefaultValue")} />;
}

/* ── options of a choice field / column ── */
function OptionsEditor({ options, onChange, arabic, labels }: { options: FormFieldOption[]; onChange: (o: FormFieldOption[]) => void; arabic: boolean; labels?: FormBuilderLabels }) {
  const L = useFbL(labels);
  const set = (id: string, patch: Partial<FormFieldOption>) => onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  return (
    <div className="space-y-1.5">
      {options.map((o, i) => (
        <div key={o.id} className="flex items-center gap-1.5">
          <Input value={o.label} onChange={(e) => set(o.id, { label: e.target.value })} placeholder={L("fbEnglish")} aria-label={`${L("fbOption")} ${i + 1}`} className="h-8 text-sm" />
          {arabic ? <Input value={o.labelAr ?? ""} onChange={(e) => set(o.id, { labelAr: e.target.value })} placeholder={L("fbArabic")} aria-label={`${L("fbOption")} ${i + 1} — ${L("fbArabic")}`} dir="rtl" className="h-8 text-sm" /> : null}
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" aria-label={`${L("fbRemoveOption")} ${i + 1}`}
            onClick={() => onChange(options.filter((x) => x.id !== o.id))}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-primary" onClick={() => onChange([...options, newOption(`Option ${options.length + 1}`)])}>
        <Plus className="h-3 w-3 me-1" aria-hidden />{L("fbOption")}
      </Button>
    </div>
  );
}

/* ── table columns (one nesting level) ── */
function TableColumnsEditor({ columns, sourced, depth, onChange, types, sources, labels }: {
  columns: TableColumn[]; sourced: boolean; depth: 0 | 1; onChange: (c: TableColumn[]) => void;
  types: readonly FormFieldTypeInfo[]; sources?: readonly FormBuilderSource[]; labels?: FormBuilderLabels;
}) {
  const L = useFbL(labels);
  const { language } = useLocale();
  const ar = language === "ar";
  const base = tableColumnTypes(depth, types);
  const update = (id: string, patch: Partial<TableColumn>) => onChange(columns.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const hasTable = depth === 0 && columns.some((c) => c.type === "table");
  return (
    <div className="space-y-2.5">
      {columns.length === 0 ? <p className="text-[11px] text-muted-foreground">{L("fbNoColumns")}</p> : null}
      {columns.map((c, i) => {
        const allowed = hasTable && c.type !== "table" ? base.filter((x) => x !== "table") : base;
        return (
          <div key={c.id} className="rounded-lg border border-border/70 bg-muted/10 p-2.5 space-y-2" data-fb-column={c.id}>
            <div className="flex items-center gap-1.5">
              <Input value={ar ? c.titleAr ?? "" : c.title} onChange={(e) => update(c.id, ar ? { titleAr: e.target.value } : { title: e.target.value })}
                placeholder={L("fbColumnName")} aria-label={`${L("fbColumnName")} ${i + 1}`} className="h-8 text-sm" dir={ar ? "rtl" : "ltr"} />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" aria-label={L("fbRemoveColumn")}
                onClick={() => onChange(columns.filter((x) => x.id !== c.id))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[11px] text-muted-foreground w-16 shrink-0">{L("fbType")}</Label>
              <Select value={c.type} onValueChange={(v) => update(c.id, { type: v as FormFieldTypeKey, columns: v === "table" ? c.columns ?? [newTableColumn("text")] : undefined })}>
                <SelectTrigger aria-label={`${L("fbType")} ${i + 1}`} className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{allowed.map((k) => <SelectItem key={k} value={k}>{loc(fieldTypeInfo(k, types)?.label, language)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {c.type !== "table" ? (
              <div className="flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground w-16 shrink-0">{L("fbFilledBy")}</Label>
                <div className="flex gap-1" role="radiogroup" aria-label={L("fbFilledBy")}>
                  <button type="button" role="radio" aria-checked={c.kind !== "derived"} onClick={() => update(c.id, { kind: "entered", sourceId: undefined })}
                    className={cn("h-7 px-2.5 rounded text-[11px] border", c.kind !== "derived" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                    {L("fbUserEnters")}
                  </button>
                  <button type="button" role="radio" aria-checked={c.kind === "derived"} onClick={() => update(c.id, { kind: "derived", options: undefined, optionsFrom: undefined })}
                    className={cn("h-7 px-2.5 rounded text-[11px] border", c.kind === "derived" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                    {sourced ? L("fbFromSourceRO") : L("fbDerivedPerRow")}
                  </button>
                </div>
              </div>
            ) : null}
            {c.kind === "derived" && c.type !== "table" ? (
              <Field label={L("fbBoundTo")}>
                <SourcePicker value={c.sourceId} onChange={(id) => update(c.id, { sourceId: id })} sources={sources} kind="scalar" ariaLabel={L("fbBoundTo")} labels={labels} />
              </Field>
            ) : null}
            {c.kind !== "derived" && (c.type === "dropdown" || c.type === "multi_select" || c.type === "radio") ? (
              <div className="space-y-1.5 rounded-md border border-dashed border-border/70 bg-card/50 p-2">
                <Field label={L("fbOptionsFromSource")}>
                  <SourcePicker value={c.optionsFrom} onChange={(id) => update(c.id, { optionsFrom: id })} sources={sources} kind="options" placeholder={L("fbOptionalLiveList")} ariaLabel={L("fbOptionsFromSource")} labels={labels} />
                </Field>
                {!c.optionsFrom ? (
                  <Field label={L("fbOrStatic")}>
                    <OptionsEditor options={c.options ?? []} onChange={(options) => update(c.id, { options })} arabic labels={labels} />
                  </Field>
                ) : null}
              </div>
            ) : null}
            {c.type === "table" && depth === 0 ? (
              <div className="rounded-md border border-dashed border-border/70 bg-card p-2 space-y-2">
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Rows3 className="h-3 w-3" aria-hidden />{L("fbNested")}</p>
                <TableColumnsEditor columns={c.columns ?? []} sourced={false} depth={1} types={types} sources={sources} labels={labels} onChange={(cols) => update(c.id, { columns: cols })} />
              </div>
            ) : null}
          </div>
        );
      })}
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-primary" onClick={() => onChange([...columns, newTableColumn("text")])}>
        <Plus className="h-3 w-3 me-1" aria-hidden />{L("fbAddColumn")}
      </Button>
    </div>
  );
}

/* ── "Limit the records shown": inline rules (never a dialog) ── */
function LinkFilterRules({ target, rules, onChange, onClose, labels }: {
  target?: FormBuilderLinkTarget; rules: FieldFilterRule[]; onChange: (r: FieldFilterRule[]) => void; onClose: () => void; labels?: FormBuilderLabels;
}) {
  const L = useFbL(labels);
  const { language } = useLocale();
  const fields = target?.fields ?? [];
  const update = (id: string, patch: Partial<FieldFilterRule>) => onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div role="region" aria-label={L("fbLimitRecords")} className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">{L("fbOnlyShow", { object: loc(target?.label, language) })}</p>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 -me-1 -mt-0.5" onClick={onClose} aria-label={L("fbCollapse")}><X className="h-3.5 w-3.5" /></Button>
      </div>
      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-background px-4 py-6 text-center"><p className="text-xs text-muted-foreground">{L("fbNoLimits")}</p></div>
      ) : null}
      {rules.map((r, i) => (
        <div key={r.id} className="rounded-lg border border-border/60 bg-background p-3 space-y-2" data-fb-filter={r.id}>
          <div className="flex items-center gap-2">
            <Select value={r.field} onValueChange={(v) => update(r.id, { field: v })}>
              <SelectTrigger aria-label={`${L("fbFilterField")} ${i + 1}`} className="h-8 text-xs flex-1"><SelectValue placeholder={L("fbFilterField")} /></SelectTrigger>
              <SelectContent>{fields.map((f) => <SelectItem key={f.value} value={f.value}>{loc(f.label, language)}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" aria-label={L("fbRemoveFilter")} onClick={() => onChange(rules.filter((x) => x.id !== r.id))}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={r.operator} onValueChange={(v) => update(r.id, { operator: v })}>
              <SelectTrigger aria-label={`${L("fbFilterField")} ${i + 1} operator`} className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{OPERATORS.map((op) => <SelectItem key={op.value} value={op.value}>{L(op.key)}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={r.value} onChange={(e) => update(r.id, { value: e.target.value })} placeholder={L("fbValue")} aria-label={`${L("fbValue")} ${i + 1}`} className="h-8 text-xs flex-1" />
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5 flex-1" disabled={fields.length === 0}
          onClick={() => onChange([...rules, { id: formBuilderId("flt"), field: fields[0]?.value ?? "", operator: "equals", value: "" }])}>
          <Plus className="h-3.5 w-3.5" aria-hidden />{L("fbAddFilter")}
        </Button>
        {rules.length > 0 ? (
          <button type="button" onClick={() => onChange([])} className="text-[11px] text-muted-foreground hover:text-destructive px-1 shrink-0">{L("fbClearAll")}</button>
        ) : null}
      </div>
    </div>
  );
}

function DefaultCondition({ label, helper, value, onChange }: FormBuilderConditionProps) {
  const id = React.useId();
  const L = useFbL();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">{label}</Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" placeholder={L("fbConditionPh")} className="min-h-[52px] font-mono text-xs" aria-describedby={`${id}-h`} />
      <p id={`${id}-h`} className="text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
}

export interface FormFieldInspectorProps extends FormBuilderExtensions {
  field: FormBuilderField;
  /** The other fields of its section (auto-fill reads the record links among them). */
  siblings: readonly FormBuilderField[];
  onChange: (patch: Partial<FormBuilderField>) => void;
  /** The field-type registry (default: every type). */
  fieldTypes?: readonly FormFieldTypeInfo[];
  /** Structured authoring: option Arabic labels and live option sources. */
  advanced?: boolean;
  labels?: FormBuilderLabels;
}

/** A field's properties, in the sections its type takes (Basics, Value from, Table, Choices, Link target, Validation,
 *  Conditions, Auto-fill, Display), then the app's own sections. */
export function FormFieldInspector({
  field, siblings, onChange, fieldTypes = FORM_FIELD_TYPES, advanced = false, labels,
  linkTargets, sources, renderCondition, renderTitleInput, renderFieldProperties,
}: FormFieldInspectorProps) {
  const L = useFbL(labels);
  const { language } = useLocale();
  const ar = language === "ar";
  const dir = ar ? "rtl" : "ltr";
  const caps = (fieldTypeInfo(field.type, fieldTypes) ?? FORM_FIELD_TYPES[0]).caps;
  const [filterOpen, setFilterOpen] = React.useState(false);
  const ids = { title: React.useId(), desc: React.useId(), ph: React.useId(), max: React.useId(), min: React.useId(), maxv: React.useId(), req: React.useId() };
  const Condition = (p: FormBuilderConditionProps) => (renderCondition ? renderCondition(p) : <DefaultCondition key={p.label} {...p} />);

  const linkFields = siblings.filter((f) => f.type === "record_link" && f.id !== field.id);
  const formHasLink = siblings.some((f) => f.type === "record_link");
  const chosenLink = siblings.find((f) => f.id === field.fetchFromField);
  const chosenTarget = linkTargets?.find((x) => x.value === chosenLink?.linkTarget);
  const target = linkTargets?.find((x) => x.value === field.linkTarget);
  const showValidation = caps.unique || caps.maxLength || caps.minMax;
  const showAutofill = caps.autofill && formHasLink;
  const filters = field.linkFilters?.length ?? 0;
  const fieldName = (f: FormBuilderField) => (ar ? f.titleAr || f.title : f.title).trim() || loc(fieldTypeInfo(f.type, fieldTypes)?.label, language);

  return (
    <div data-fb-inspector={field.id}>
      <PropSection title={L("fbBasics")} icon={Settings2} defaultOpen>
        <Field label={L("fbFieldTitle")} htmlFor={ids.title}>
          {renderTitleInput
            ? renderTitleInput({ value: ar ? field.titleAr ?? "" : field.title, onChange: (v) => onChange(ar ? { titleAr: v } : { title: v }), dir, placeholder: L("fbFieldTitlePh"), "aria-label": L("fbFieldTitle") })
            : <Input id={ids.title} value={ar ? field.titleAr ?? "" : field.title} onChange={(e) => onChange(ar ? { titleAr: e.target.value } : { title: e.target.value })} dir={dir} placeholder={L("fbFieldTitlePh")} className="h-9" />}
        </Field>
        {caps.description ? (
          <Field label={L("fbHelper")} htmlFor={ids.desc}>
            <Textarea id={ids.desc} value={ar ? field.descriptionAr ?? "" : field.description ?? ""} onChange={(e) => onChange(ar ? { descriptionAr: e.target.value } : { description: e.target.value })}
              dir={dir} placeholder={L("fbHelperPh")} className="min-h-[52px] text-sm" />
          </Field>
        ) : null}
        {caps.placeholder ? (
          <Field label={field.type === "record_link" ? L("fbSearchHint") : L("fbPlaceholder")} htmlFor={ids.ph}>
            <Input id={ids.ph} value={field.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} placeholder={L("fbPlaceholderPh")} className="h-9" />
          </Field>
        ) : null}
        {caps.required ? (
          <div className="flex items-center justify-between pt-1">
            <Label htmlFor={ids.req} className="text-xs text-foreground">{L("fbRequired")}</Label>
            <Switch id={ids.req} checked={field.required} disabled={!!field.core} onCheckedChange={(v) => onChange({ required: v })} />
          </div>
        ) : null}
        {caps.defaultValue ? (
          <Field label={L("fbDefaultValue")}>
            <DefaultValueControl field={field} onChange={(v) => onChange({ defaultValue: v })} sources={sources} linkTargets={linkTargets} labels={labels} />
          </Field>
        ) : null}
      </PropSection>

      {field.type === "display_value" ? (
        <PropSection title={L("fbValueFrom")} icon={Sigma} defaultOpen>
          <Field label={L("fbCalcSource")}>
            <SourcePicker value={field.sourceId} onChange={(id) => onChange({ sourceId: id })} sources={sources} ariaLabel={L("fbCalcSource")} labels={labels} />
            <p className="text-[11px] text-muted-foreground">{L("fbCalcSourceHelp")}</p>
          </Field>
        </PropSection>
      ) : null}

      {field.type === "table" ? (
        <PropSection title={L("fbTable")} icon={Table2} defaultOpen>
          <Field label={L("fbRowsFrom")}>
            <Select value={typeof field.rowsFrom === "object" ? "source" : "user"} onValueChange={(v) => onChange(v === "source" ? { rowsFrom: { source: "" } } : { rowsFrom: "user" })}>
              <SelectTrigger aria-label={L("fbRowsFrom")} className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">{L("fbRowsUser")}</SelectItem>
                <SelectItem value="source">{L("fbRowsSource")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {typeof field.rowsFrom === "object" ? (
            <Field label={L("fbRowsSourceLabel")}>
              <SourcePicker value={field.rowsFrom.source || undefined} onChange={(id) => onChange({ rowsFrom: { source: id ?? "" } })} sources={sources} kind="list" placeholder={L("fbPickRowsSource")} ariaLabel={L("fbRowsSourceLabel")} labels={labels} />
              <p className="text-[11px] text-muted-foreground">{L("fbRowsSourceHelp")}</p>
            </Field>
          ) : null}
          <div className="space-y-1.5 pt-1">
            <Label className="text-[11px] text-muted-foreground">{L("fbColumns")}</Label>
            <TableColumnsEditor columns={field.columns ?? []} sourced={typeof field.rowsFrom === "object"} depth={0} types={fieldTypes} sources={sources} labels={labels} onChange={(columns) => onChange({ columns })} />
          </div>
        </PropSection>
      ) : null}

      {caps.choices ? (
        <PropSection title={L("fbChoices")} icon={ListChecks}>
          {advanced ? (
            <div className="space-y-1.5 pb-1">
              <Field label={L("fbLiveSource")}>
                <SourcePicker value={field.optionsFrom} onChange={(id) => onChange({ optionsFrom: id })} sources={sources} kind="options" placeholder={L("fbOptionalLiveList")} ariaLabel={L("fbLiveSource")} labels={labels} />
              </Field>
              <p className="text-[11px] text-muted-foreground">{L("fbLiveSourceHelp")}</p>
            </div>
          ) : null}
          <OptionsEditor options={field.options ?? []} onChange={(options) => onChange({ options })} arabic={advanced} labels={labels} />
        </PropSection>
      ) : null}

      {caps.linkTarget ? (
        <PropSection title={L("fbLinkTarget")} icon={Link2}>
          <Field label={L("fbLinksTo")}>
            <SearchCombobox variant="field" aria-label={L("fbLinksTo")} value={field.linkTarget || undefined}
              onSelect={(v) => onChange({ linkTarget: v, linkFilters: [] })}
              options={(linkTargets ?? []).map((o) => ({ value: o.value, label: loc(o.label, language) }))}
              placeholder={L("fbChooseObject")} searchPlaceholder={L("fbSearch")} emptyText={L("fbNoResults")} className="text-sm" />
          </Field>
          {field.linkTarget ? (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">{L("fbLimitRecords")}</Label>
              <Button type="button" variant="outline" size="sm" className="h-9 text-xs gap-1.5 w-full justify-start" onClick={() => setFilterOpen((o) => !o)} aria-expanded={filterOpen}>
                <Filter className="h-3.5 w-3.5" aria-hidden />
                {filters > 0 ? (filters === 1 ? L("fbFilterOne") : L("fbFiltersN", { n: filters })) : L("fbAddFilters")}
                <ChevronDown className={cn("h-3.5 w-3.5 ms-auto transition-transform", filterOpen && "rotate-180")} aria-hidden />
              </Button>
              {filterOpen ? <LinkFilterRules target={target} rules={field.linkFilters ?? []} onChange={(r) => onChange({ linkFilters: r })} onClose={() => setFilterOpen(false)} labels={labels} /> : null}
            </div>
          ) : null}
        </PropSection>
      ) : null}

      {showValidation ? (
        <PropSection title={L("fbValidation")} icon={ShieldCheck}>
          {caps.unique ? (
            <div>
              <ToggleRow label={L("fbUnique")} checked={field.unique} onChange={(v) => onChange({ unique: v })} />
              {field.type === "email" || field.type === "phone" ? (
                <p className="text-[11px] text-muted-foreground mt-1">{field.type === "email" ? L("fbEmailChecked") : L("fbPhoneChecked")}</p>
              ) : null}
            </div>
          ) : null}
          {caps.maxLength ? (
            <Field label={L("fbMaxLength")} htmlFor={ids.max}>
              <Input id={ids.max} type="number" value={field.maxLength ?? ""} onChange={(e) => onChange({ maxLength: e.target.value ? Number(e.target.value) : undefined })} className="h-9 w-32" placeholder={L("fbNoLimit")} />
            </Field>
          ) : null}
          {caps.minMax ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label={L("fbMin")} htmlFor={ids.min}>
                <Input id={ids.min} type="number" value={field.minValue ?? ""} onChange={(e) => onChange({ minValue: e.target.value ? Number(e.target.value) : undefined })} className="h-9" />
              </Field>
              <Field label={L("fbMax")} htmlFor={ids.maxv}>
                <Input id={ids.maxv} type="number" value={field.maxValue ?? ""} onChange={(e) => onChange({ maxValue: e.target.value ? Number(e.target.value) : undefined })} className="h-9" />
              </Field>
            </div>
          ) : null}
        </PropSection>
      ) : null}

      <PropSection title={L("fbConditions")} icon={GitBranch}>
        {Condition({ label: L("fbShowWhen"), helper: L("fbShowWhenHelp"), value: field.showWhen ?? "", onChange: (v) => onChange({ showWhen: v }) })}
        {caps.conditions === "full" ? (
          <>
            {Condition({ label: L("fbRequiredWhen"), helper: L("fbRequiredWhenHelp"), value: field.requiredWhen ?? "", onChange: (v) => onChange({ requiredWhen: v }) })}
            {Condition({ label: L("fbReadOnlyWhen"), helper: L("fbReadOnlyWhenHelp"), value: field.readOnlyWhen ?? "", onChange: (v) => onChange({ readOnlyWhen: v }) })}
          </>
        ) : null}
      </PropSection>

      {showAutofill ? (
        <PropSection title={L("fbAutofill")} icon={Download}>
          <Field label={L("fbAutofillFrom")}>
            <Select value={field.fetchFromField ?? ""} onValueChange={(v) => onChange({ fetchFromField: v, fetchFromSource: undefined })} disabled={linkFields.length === 0}>
              <SelectTrigger aria-label={L("fbAutofillFrom")} className="h-9 text-sm"><SelectValue placeholder={linkFields.length === 0 ? L("fbAddAnotherLink") : L("fbWhichLink")} /></SelectTrigger>
              <SelectContent>{linkFields.map((lf) => <SelectItem key={lf.id} value={lf.id}>{fieldName(lf)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          {field.fetchFromField ? (
            <Field label={L("fbFieldOn", { object: chosenTarget ? loc(chosenTarget.label, language) : L("fbTheLinkedObject") })}>
              <Select value={field.fetchFromSource ?? ""} onValueChange={(v) => onChange({ fetchFromSource: v })} disabled={!chosenTarget?.fields?.length}>
                <SelectTrigger aria-label={L("fbWhichField")} className="h-9 text-sm"><SelectValue placeholder={L("fbWhichField")} /></SelectTrigger>
                <SelectContent>{(chosenTarget?.fields ?? []).map((sf) => <SelectItem key={sf.value} value={sf.value}>{loc(sf.label, language)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          ) : null}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Label className="text-xs text-foreground font-normal">{L("fbOnlyWhenEmpty")}</Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">{L("fbOnlyWhenEmptyHelp")}</p>
            </div>
            <Switch aria-label={L("fbOnlyWhenEmpty")} checked={!!field.fetchOnlyWhenEmpty} onCheckedChange={(v) => onChange({ fetchOnlyWhenEmpty: v })} />
          </div>
        </PropSection>
      ) : null}

      <PropSection title={L("fbDisplay")} icon={Eye}>
        {caps.display === "hidden" ? (
          <ToggleRow label={L("fbHidden")} checked={field.hidden} onChange={(v) => onChange({ hidden: v })} />
        ) : (
          <>
            <ToggleRow label={L("fbInList")} checked={field.inListView} onChange={(v) => onChange({ inListView: v })} />
            <ToggleRow label={L("fbHideInPrint")} checked={field.hideInPrint} onChange={(v) => onChange({ hideInPrint: v })} />
            <ToggleRow label={L("fbEditableClosed")} checked={field.editableWhenClosed} onChange={(v) => onChange({ editableWhenClosed: v })} />
            <ToggleRow label={L("fbUseAsFilter")} checked={field.standardFilter} onChange={(v) => onChange({ standardFilter: v })} />
            <ToggleRow label={L("fbGlobalSearch")} checked={field.globalSearch} onChange={(v) => onChange({ globalSearch: v })} />
            <ToggleRow label={L("fbBold")} checked={field.bold} onChange={(v) => onChange({ bold: v })} />
            <ToggleRow label={L("fbHidden")} checked={field.hidden} onChange={(v) => onChange({ hidden: v })} />
            <ToggleRow label={L("fbReadOnly")} checked={field.readOnly} onChange={(v) => onChange({ readOnly: v })} />
            <ToggleRow label={L("fbTranslatable")} checked={field.translatable} onChange={(v) => onChange({ translatable: v })} />
          </>
        )}
      </PropSection>
      {renderFieldProperties?.(field, onChange)}
    </div>
  );
}
