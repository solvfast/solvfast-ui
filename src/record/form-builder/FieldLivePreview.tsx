import * as React from "react";
import { Barcode, Check, ChevronDown, ChevronRight, FileUp, Image as ImageIcon, MapPin, PenLine, Plus, Sigma, Star } from "lucide-react";
import { Input } from "../../primitives/input";
import { Textarea } from "../../primitives/textarea";
import { Checkbox } from "../../primitives/checkbox";
import { RadioGroup, RadioGroupItem } from "../../primitives/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { RichTextEditor } from "../../primitives/rich-text-editor";
import { ColorInput } from "../../fields/ColorInput";
import { useLocale } from "../../theme/ThemeProvider";
import { loc } from "../../lib/localized";
import { cn } from "../../lib/cn";
import type { FormBuilderField } from "./model";
import { FORM_FIELD_TYPES, fieldTypeInfo, type FormFieldTypeInfo } from "./fieldTypes";
import { fieldChoices, useFbL, type FormBuilderLabels, type FormBuilderLinkTarget, type FormBuilderSource } from "./FormFieldInspector";

export interface FieldLivePreviewProps {
  field: FormBuilderField;
  fieldTypes?: readonly FormFieldTypeInfo[];
  sources?: readonly FormBuilderSource[];
  linkTargets?: readonly FormBuilderLinkTarget[];
  labels?: FormBuilderLabels;
}

/**
 * A field drawn as its real control, to try on the builder's canvas: type, pick, tick, rate. The values live only in
 * this component (they start from the field's default value and reset when the field's type or default changes); it
 * has no way to change the field or the form — configuration is the inspector's.
 */
export function FieldLivePreview(props: FieldLivePreviewProps) {
  const { field } = props;
  // A new type or default starts the preview over (as the Field Library's canvas did).
  return <LivePreviewBody key={`${field.id}|${field.type}|${field.defaultValue ?? ""}`} {...props} />;
}

function LivePreviewBody({ field, fieldTypes = FORM_FIELD_TYPES, sources, linkTargets, labels }: FieldLivePreviewProps) {
  const L = useFbL(labels);
  const { language } = useLocale();
  const ar = language === "ar";
  const def = field.defaultValue ?? "";
  const [text, setText] = React.useState(def);
  const [multi, setMulti] = React.useState<string[]>(() => (field.type === "multi_select" && def ? def.split("||") : []));
  const [checked, setChecked] = React.useState(def === "true");
  const [rating, setRating] = React.useState(Number(def) || 0);
  const [openRow, setOpenRow] = React.useState<number | null>(null);
  const title = (ar ? field.titleAr || field.title : field.title).trim() || L("fbUntitledField");
  const description = ar ? field.descriptionAr || field.description : field.description;
  const ph = field.placeholder || undefined;
  const t = field.type;
  const choices = fieldChoices(field, sources, language);
  const aria = L("fbPreviewOf", { title });

  if (t === "heading") return <h3 className="text-base font-semibold text-foreground border-b border-border/60 pb-1.5">{title}</h3>;

  const header = (
    <div className="space-y-1">
      <p className={cn("text-sm font-medium", field.bold && "font-bold")}>
        {t === "checkbox" ? (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} aria-label={aria} />
            <span>{title}{field.required ? <span className="text-destructive ms-1" aria-hidden>*</span> : null}</span>
          </label>
        ) : (
          <>{title}{field.required ? <span className="text-destructive ms-1" aria-hidden>*</span> : null}</>
        )}
      </p>
      {description && t !== "checkbox" ? <p className="text-[11px] text-muted-foreground">{description}</p> : null}
    </div>
  );

  let control: React.ReactNode = null;
  if (t === "text" || t === "barcode") {
    control = (
      <div className="flex items-center gap-2">
        <Input aria-label={aria} value={text} onChange={(e) => setText(e.target.value)} placeholder={ph ?? L("fbEnterText")} className="h-9" />
        {t === "barcode" ? <Barcode className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden /> : null}
      </div>
    );
  } else if (t === "long_text") {
    control = <Textarea aria-label={aria} value={text} onChange={(e) => setText(e.target.value)} placeholder={ph ?? `${L("fbEnterText")}…`} className="min-h-[70px]" />;
  } else if (t === "rich_text") {
    control = <RichTextEditor value={text} onChange={setText} ariaLabel={aria} placeholder={ph ?? L("fbStartTyping")} minHeight="150px" />;
  } else if (t === "number" || t === "decimal") {
    control = <Input aria-label={aria} type="number" value={text} onChange={(e) => setText(e.target.value)} placeholder={ph ?? "0"} className="h-9 w-40" />;
  } else if (t === "currency") {
    control = (
      <div className="relative w-44">
        <span className="absolute start-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>$</span>
        <Input aria-label={aria} type="number" value={text} onChange={(e) => setText(e.target.value)} placeholder={ph ?? "0.00"} className="h-9 ps-7" />
      </div>
    );
  } else if (t === "percent") {
    control = (
      <div className="relative w-32">
        <Input aria-label={aria} type="number" value={text} onChange={(e) => setText(e.target.value)} placeholder={ph ?? "0"} className="h-9 pe-7" />
        <span className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>%</span>
      </div>
    );
  } else if (t === "duration") {
    control = (
      <div className="flex items-center gap-2">
        <Input aria-label={aria} type="number" value={text} onChange={(e) => setText(e.target.value)} placeholder={ph ?? "0"} className="h-9 w-24" />
        <span className="text-xs text-muted-foreground">{L("fbMinutes")}</span>
      </div>
    );
  } else if (t === "email") {
    control = <Input aria-label={aria} type="email" value={text} onChange={(e) => setText(e.target.value)} placeholder={ph ?? "name@example.com"} className="h-9" />;
  } else if (t === "phone") {
    control = <Input aria-label={aria} type="tel" value={text} onChange={(e) => setText(e.target.value)} placeholder={ph ?? "+966 55 000 0000"} className="h-9" dir="ltr" />;
  } else if (t === "date" || t === "datetime" || t === "time") {
    control = <Input aria-label={aria} type={t === "datetime" ? "datetime-local" : t} value={text} onChange={(e) => setText(e.target.value)} className={cn("h-9", t === "date" ? "w-44" : t === "time" ? "w-32" : "w-56")} />;
  } else if (t === "color") {
    control = <ColorInput aria-label={aria} value={text || "#512195"} onChange={(c) => setText(c ?? "")} className="w-44" />;
  } else if (t === "rating") {
    control = (
      <div className="flex gap-1" role="radiogroup" aria-label={aria}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}`} onClick={() => setRating(n)}>
            <Star className="h-6 w-6 text-primary" fill={rating >= n ? "currentColor" : "transparent"} aria-hidden />
          </button>
        ))}
      </div>
    );
  } else if (t === "dropdown") {
    control = (
      <Select value={text || undefined} onValueChange={setText}>
        <SelectTrigger aria-label={aria} className="h-9"><SelectValue placeholder={ph ?? L("fbSelectOne")} /></SelectTrigger>
        <SelectContent>
          {choices.length === 0
            ? <div className="px-2 py-3 text-[11px] text-muted-foreground text-center">{L("fbNoOptions")}</div>
            : choices.filter((o) => o.label).map((o) => <SelectItem key={o.id} value={o.label}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  } else if (t === "multi_select") {
    control = choices.length === 0 ? <p className="text-[11px] text-muted-foreground">{L("fbNoOptionsYet")}</p> : (
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={aria}>
        {choices.map((o) => {
          const on = multi.includes(o.label);
          return (
            <button key={o.id} type="button" aria-pressed={on} onClick={() => setMulti((p) => (on ? p.filter((x) => x !== o.label) : [...p, o.label]))}
              className={cn("h-7 px-3 rounded-full text-xs font-medium border transition-colors inline-flex items-center gap-1.5",
                on ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border/60 hover:bg-muted")}>
              {on ? <Check className="h-3 w-3" aria-hidden /> : null}{o.label}
            </button>
          );
        })}
      </div>
    );
  } else if (t === "radio") {
    control = choices.length === 0 ? <p className="text-[11px] text-muted-foreground">{L("fbNoOptionsYet")}</p> : (
      <RadioGroup value={text} onValueChange={setText} aria-label={aria} className="space-y-1.5">
        {choices.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value={o.label} /><span>{o.label}</span></label>
        ))}
      </RadioGroup>
    );
  } else if (t === "record_link") {
    const target = linkTargets?.find((x) => x.value === field.linkTarget);
    const recs = target?.records ?? [];
    control = (
      <Select value={text || undefined} onValueChange={setText}>
        <SelectTrigger aria-label={aria} className="h-9">
          <SelectValue placeholder={field.linkTarget ? ph ?? L("fbSearchObject", { object: loc(target?.label, language) || field.linkTarget }) : L("fbChooseObjectFirst")} />
        </SelectTrigger>
        <SelectContent>
          {recs.length === 0
            ? <div className="px-2 py-3 text-[11px] text-muted-foreground text-center">{L("fbNoRecords")}</div>
            : recs.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  } else if (t === "file_upload" || t === "image_upload") {
    control = (
      <div className="border-2 border-dashed border-border/60 rounded-md p-4 text-center">
        {t === "image_upload" ? <ImageIcon className="h-5 w-5 text-muted-foreground mx-auto mb-1" aria-hidden /> : <FileUp className="h-5 w-5 text-muted-foreground mx-auto mb-1" aria-hidden />}
        <p className="text-xs font-medium">{t === "image_upload" ? L("fbDropImage") : L("fbDropFile")}</p>
      </div>
    );
  } else if (t === "signature") {
    control = <div className="border-2 border-dashed border-border/60 rounded-md h-24 flex flex-col items-center justify-center text-muted-foreground"><PenLine className="h-5 w-5 mb-1" aria-hidden /><p className="text-xs">{L("fbSignHere")}</p></div>;
  } else if (t === "map_location") {
    control = (
      <div className="relative rounded-md border border-border/60 h-32 bg-muted/40 overflow-hidden">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground"><MapPin className="h-6 w-6 text-primary" fill="currentColor" aria-hidden /><p className="text-[11px] mt-1">{L("fbPickLocation")}</p></div>
      </div>
    );
  } else if (t === "display_value") {
    const s = sources?.find((x) => x.id === field.sourceId);
    control = (
      <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-muted/30 text-sm">
        <Sigma className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
        {field.sourceId ? <span className="text-foreground">{s ? loc(s.label, language) : field.sourceId}</span> : <span className="text-muted-foreground">{L("fbNotBound")}</span>}
      </div>
    );
  } else if (t === "table") {
    const cols = field.columns ?? [];
    const nested = cols.find((c) => c.type === "table");
    const sourced = typeof field.rowsFrom === "object";
    const src = sourced ? sources?.find((x) => x.id === (field.rowsFrom as { source: string }).source) : undefined;
    control = (
      <div className="space-y-1.5">
        {sourced ? <p className="text-[11px] text-muted-foreground">{L("fbRowsFromLabel", { source: src ? loc(src.label, language) : L("fbSourceNotSet") })}</p> : null}
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>{nested ? <th className="w-6" /> : null}{cols.filter((c) => c.type !== "table").map((c) => (
                <th key={c.id} className="px-2 py-1.5 text-start font-medium text-muted-foreground whitespace-nowrap">{(ar ? c.titleAr || c.title : c.title) || loc(fieldTypeInfo(c.type, fieldTypes)?.label, language)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[0, 1].map((r) => (
                <React.Fragment key={r}>
                  <tr>
                    {nested ? (
                      <td className="px-1 border-t border-border/50">
                        <button type="button" aria-expanded={openRow === r} aria-label={L("fbRowDetail", { n: r + 1 })} onClick={() => setOpenRow(openRow === r ? null : r)}>
                          {openRow === r ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className={cn("h-3.5 w-3.5", ar && "rotate-180")} aria-hidden />}
                        </button>
                      </td>
                    ) : null}
                    {cols.filter((c) => c.type !== "table").map((c) => (
                      <td key={c.id} className="px-1.5 py-1 border-t border-border/50">
                        {c.kind === "derived" ? <span className="block h-7 rounded bg-muted/40" /> : <Input aria-label={`${aria} ${r + 1}`} className="h-7 text-xs" />}
                      </td>
                    ))}
                  </tr>
                  {nested && openRow === r ? (
                    <tr><td colSpan={cols.length + 1} className="px-3 py-2 border-t border-border/50 bg-muted/20 text-[11px] text-muted-foreground">
                      {(nested.columns ?? []).map((c) => (ar ? c.titleAr || c.title : c.title) || loc(fieldTypeInfo(c.type, fieldTypes)?.label, language)).join(" · ")}
                    </td></tr>
                  ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {!sourced ? <span className="text-[11px] text-primary inline-flex items-center gap-1"><Plus className="h-3 w-3" aria-hidden />{L("fbAddRow")}</span> : null}
      </div>
    );
  }
  return (
    <div className="space-y-2.5" data-fb-preview={t} data-fb-live-preview="">
      {header}
      {control}
    </div>
  );
}
