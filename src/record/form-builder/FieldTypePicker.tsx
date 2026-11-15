import * as React from "react";
import { Search, Sigma } from "lucide-react";
import { Input } from "../../primitives/input";
import { useLocale } from "../../theme/ThemeProvider";
import { loc } from "../../lib/localized";
import { cn } from "../../lib/cn";
import { FieldPreview } from "../FieldPreview";
import { FORM_FIELD_GROUPS, FORM_FIELD_TYPES, fieldTypeInfo, type FormFieldGroup, type FormFieldTypeInfo } from "./fieldTypes";
import type { FormBuilderField, FormFieldTypeKey } from "./model";
import { fieldChoices, useFbL, type FormBuilderLabels, type FormBuilderSource } from "./FormFieldInspector";

export interface FieldTypePickerProps {
  onPick: (type: FormFieldTypeKey) => void;
  /** The types offered (default: every non-advanced type). */
  fieldTypes?: readonly FormFieldTypeInfo[];
  /** Also offer the structured types (Table, Display Value). */
  advanced?: boolean;
  groups?: readonly FormFieldGroup[];
  /** Focus the search box when shown (default true). */
  autoFocus?: boolean;
  labels?: FormBuilderLabels;
  className?: string;
}

/** "Add a field": search the field types (name and description, both languages), grouped by category; picking one
 *  calls `onPick`. */
export function FieldTypePicker({ onPick, fieldTypes = FORM_FIELD_TYPES, advanced = false, groups = FORM_FIELD_GROUPS, autoFocus = true, labels, className }: FieldTypePickerProps) {
  const L = useFbL(labels);
  const { language } = useLocale();
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const offered = fieldTypes.filter((x) => advanced || !x.advanced);
  const text = (x: FormFieldTypeInfo) => [x.label, x.description].flatMap((l) => (typeof l === "string" ? [l] : [l.en, l.ar])).join(" ").toLowerCase();
  const shown = groups
    .map((g) => ({ group: g, types: offered.filter((x) => x.group === g.id && (!q || text(x).includes(q))) }))
    .filter((g) => g.types.length > 0);
  return (
    <div className={cn("space-y-3", className)} data-fb-type-picker="">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={autoFocus} aria-label={L("fbSearchTypes")} placeholder={L("fbSearchTypes")} className="h-9 ps-9" />
      </div>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">{L("fbNoTypes")}</p>
      ) : (
        <div className="space-y-4">
          {shown.map(({ group, types }) => (
            <div key={group.id} className="space-y-2" role="group" aria-label={loc(group.label, language)}>
              <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground px-0.5">{loc(group.label, language)}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {types.map((x) => {
                  const Icon = x.icon;
                  return (
                    <button key={x.key} type="button" onClick={() => onPick(x.key)} data-fb-type={x.key}
                      className="group/type text-start rounded-lg border border-border/60 bg-card p-3 hover:border-primary hover:bg-primary/5 transition-all flex items-start gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover/type:bg-primary group-hover/type:text-primary-foreground transition-colors">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium leading-tight">{loc(x.label, language)}</span>
                        <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">{loc(x.description, language)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A field as it appears on the builder's canvas: its title (required mark, description) and its control. Decorative
 *  (the card around it is what is selected and dragged). */
export function FormFieldPreview({ field, fieldTypes = FORM_FIELD_TYPES, sources, labels }: {
  field: FormBuilderField; fieldTypes?: readonly FormFieldTypeInfo[]; sources?: readonly FormBuilderSource[]; labels?: FormBuilderLabels;
}) {
  const L = useFbL(labels);
  const { language } = useLocale();
  const ar = language === "ar";
  const title = (ar ? field.titleAr || field.title : field.title).trim() || L("fbUntitledField");
  const description = ar ? field.descriptionAr || field.description : field.description;
  if (field.type === "heading") return <h3 className="text-base font-semibold text-foreground border-b border-border/60 pb-1.5">{title}</h3>;
  const choices = fieldChoices(field, sources, language);
  let control: React.ReactNode;
  if (field.type === "display_value") {
    const s = sources?.find((x) => x.id === field.sourceId);
    control = (
      <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-muted/30 text-sm" aria-hidden>
        <Sigma className="h-3.5 w-3.5 text-primary shrink-0" />
        {field.sourceId ? <span className="text-foreground">{s ? loc(s.label, language) : field.sourceId}</span> : <span className="text-muted-foreground">{L("fbNotBound")}</span>}
      </div>
    );
  } else if (field.type === "table") {
    const cols = field.columns ?? [];
    control = (
      <div className="overflow-x-auto rounded-md border border-border/60" aria-hidden>
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>{cols.map((c) => <th key={c.id} className="px-2 py-1.5 text-start font-medium text-muted-foreground whitespace-nowrap">{(ar ? c.titleAr || c.title : c.title) || loc(fieldTypeInfo(c.type, fieldTypes)?.label, language)}</th>)}</tr>
          </thead>
          <tbody><tr>{cols.map((c) => <td key={c.id} className="px-2 py-2 border-t border-border/50"><span className="block h-5 rounded bg-muted/40" /></td>)}</tr></tbody>
        </table>
      </div>
    );
  } else {
    control = (
      <FieldPreview type={field.type} definition={{
        type: field.type, label: field.title, labelAr: field.titleAr, placeholder: field.placeholder || undefined,
        choices: choices.map((o) => ({ en: o.label, ar: o.labelAr })), linkTarget: field.linkTarget,
      }} />
    );
  }
  return (
    <div className="space-y-2.5" data-fb-preview={field.type}>
      <div className="space-y-1">
        <p className={cn("text-sm font-medium", field.bold && "font-bold")}>
          {title}{field.required ? <span className="text-destructive ms-1" aria-hidden>*</span> : null}
        </p>
        {description && field.type !== "checkbox" ? <p className="text-[11px] text-muted-foreground">{description}</p> : null}
      </div>
      {control}
    </div>
  );
}
