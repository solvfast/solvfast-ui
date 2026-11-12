import * as React from "react";
import { ChevronDown, Eye, GitBranch, Link2, ListChecks, Plus, Settings2, ShieldCheck, Shuffle, Download, X, type LucideIcon } from "lucide-react";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import { Label } from "../primitives/label";
import { Switch } from "../primitives/switch";
import { Textarea } from "../primitives/textarea";
import { SearchCombobox } from "../primitives/search-combobox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../primitives/select";
import { loc } from "../lib/localized";
import { cn } from "../lib/cn";
import type { designerEn } from "../theme/messages-ws/designer";
import {
  LINK_OPERATORS, retype, type FieldDefinition, type FieldLinkFilter, type FieldTypeProperty, type FieldTypeRegistry,
} from "./fieldDefinition";

type Key = keyof typeof designerEn;
export interface LinkTargetOption { name: string; app?: string }
export interface LinkTargetField { fieldname: string; label?: string; fieldtype?: string }

export interface FieldInspectorProps {
  definition: FieldDefinition;
  onChange: (next: FieldDefinition) => void;
  registry: FieldTypeRegistry;
  /** The form's other own fields (their keys, as saved or as they will be), for auto-fill and sibling targets. */
  siblings: FieldDefinition[];
  /** The field's name in conditions (its key, or the one its label will give). */
  keyPreview: string;
  linkTargets?: (search: string, childTables: boolean) => Promise<LinkTargetOption[]>;
  linkTargetFields?: (doctype: string) => Promise<LinkTargetField[]>;
  L: (key: Key) => string;
  language: "en" | "ar";
}

const NONE = "__none__";
const whole = (v: string) => (v.replace(/\D/g, "") ? Number(v.replace(/\D/g, "")) : undefined);

function Section({ title, icon: Icon, open: initial, missing, children }: {
  title: string; icon: LucideIcon; open?: boolean; missing?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(!!initial || !!missing);
  return (
    <div className="border-t border-border/50 pt-2 first:border-t-0 first:pt-0">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 py-1 text-start">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}{missing && <span className="ms-0.5 text-destructive">*</span>}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-3 pb-1 pt-2.5">{children}</div>}
    </div>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id} className="text-xs font-normal">{label}</Label>
      <Switch id={id} checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({ id, label, children, hint }: { id?: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A form's own field, edited as a field set's field is in Sayr Studio: the properties its type takes, and no others. */
export function FieldInspector({ definition: def, onChange, registry, siblings, keyPreview, linkTargets, linkTargetFields, L, language }: FieldInspectorProps) {
  const id = React.useId();
  const info = registry.types.find((t) => t.key === def.type);
  const asks = (p: FieldTypeProperty) => !!info?.props.includes(p);
  const set = (patch: Partial<FieldDefinition>) => onChange({ ...def, ...patch });
  const ar = language === "ar";
  const labelMissing = !(def.label ?? "").trim() && !(def.labelAr ?? "").trim();
  const choicesMissing = asks("choices") && !(def.choices ?? []).some((c) => c.en.trim());
  const targetMissing = (asks("doctype_target") || asks("child_target") || asks("sibling_field")) && !def.linkTarget;
  const numeric = asks("bounds");

  const links = siblings.filter((s) => s.type === "record_link" && s.key && s.key !== def.key);
  const siblingChoices = siblings.filter((s) => s.key && s.key !== def.key
    && (def.type === "dynamic_link" ? s.type === "record_link" && s.linkTarget === "DocType" : s.type === "image_upload"));
  const fetchLink = links.find((s) => s.key === def.fetchFrom);
  const [sourceFields, setSourceFields] = React.useState<LinkTargetField[]>([]);
  const [targetFields, setTargetFields] = React.useState<LinkTargetField[]>([]);
  React.useEffect(() => {
    let live = true;
    if (fetchLink?.linkTarget && linkTargetFields) linkTargetFields(fetchLink.linkTarget).then((f) => live && setSourceFields(f), () => live && setSourceFields([]));
    else setSourceFields([]);
    return () => { live = false; };
  }, [fetchLink?.linkTarget, linkTargetFields]);
  React.useEffect(() => {
    let live = true;
    if (asks("doctype_target") && def.linkTarget && linkTargetFields) linkTargetFields(def.linkTarget).then((f) => live && setTargetFields(f), () => live && setTargetFields([]));
    else setTargetFields([]);
    return () => { live = false; };
  }, [def.linkTarget, def.type, linkTargetFields]); // eslint-disable-line react-hooks/exhaustive-deps

  const choices = def.choices ?? [];
  const filters = def.linkFilters ?? [];
  const setFilter = (i: number, patch: Partial<FieldLinkFilter>) => set({ linkFilters: filters.map((f, n) => (n === i ? { ...f, ...patch } : f)) });
  const typeGroups = registry.groups.map((g) => ({ ...g, types: g.types.filter((k) => registry.types.some((t) => t.key === k)) })).filter((g) => g.types.length);
  const typeLabel = (k: string) => loc(registry.types.find((t) => t.key === k)?.label ?? k, language);

  return (
    <div className="space-y-2" data-field-inspector={def.key || keyPreview}>
      <Section title={L("fiBasics")} icon={Settings2} open>
        <Field id={`${id}-type`} label={L("fiType")}>
          <Select value={def.type} onValueChange={(t) => t !== def.type && onChange(retype(def, t))}>
            <SelectTrigger id={`${id}-type`} className="h-9 text-sm" aria-label={L("fiType")}><SelectValue>{typeLabel(def.type)}</SelectValue></SelectTrigger>
            <SelectContent>
              {typeGroups.map((g) => (
                <SelectGroup key={g.group}>
                  <SelectLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">{g.group}</SelectLabel>
                  {g.types.map((k) => <SelectItem key={k} value={k}>{typeLabel(k)}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id={`${id}-label`} label={L("fiLabel")}>
          <Input id={`${id}-label`} value={ar ? def.labelAr ?? "" : def.label} dir={ar ? "rtl" : "ltr"} aria-required
            placeholder={L("fiLabelPlaceholder")} className={cn("h-9", labelMissing && "ring-1 ring-destructive/60")}
            onChange={(e) => set(ar ? { labelAr: e.target.value } : { label: e.target.value })} />
          {labelMissing && <p className="text-[11px] text-destructive">{L("fiRequiredBeforeSave")}</p>}
        </Field>
        {keyPreview && (
          <p className="text-[11px] text-muted-foreground">
            {L("fiKey")}: <code className="rounded bg-muted px-1 font-mono" dir="ltr">{keyPreview}</code>
          </p>
        )}
        <Field id={`${id}-desc`} label={L("fiDescription")}>
          <Textarea id={`${id}-desc`} value={def.description ?? ""} rows={2} className="min-h-[52px] text-sm"
            placeholder={L("fiDescriptionPlaceholder")} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        {asks("placeholder") && (
          <Field id={`${id}-ph`} label={def.type === "record_link" ? L("fiSearchHint") : L("fiPlaceholder")}>
            <Input id={`${id}-ph`} value={def.placeholder ?? ""} className="h-9" onChange={(e) => set({ placeholder: e.target.value })} />
          </Field>
        )}
        <Toggle id={`${id}-reqd`} label={L("fiRequired")} checked={def.required} onChange={(v) => set({ required: v })} />
        {asks("default") && !(def.type === "record_link" && !def.linkTarget) && (
          <Field id={`${id}-default`} label={L("fiDefault")}>
            {def.unique ? <p className="text-[11px] text-muted-foreground">{L("fiUniqueNoDefault")}</p> : (
              <DefaultControl id={`${id}-default`} def={def} numeric={numeric} L={L} onChange={(v) => set({ defaultValue: v || undefined })} />
            )}
          </Field>
        )}
      </Section>

      {asks("choices") && (
        <Section title={L("fiChoices")} icon={ListChecks} missing={choicesMissing}>
          {choicesMissing && <p className="text-[11px] text-destructive">{L("fiRequiredBeforeSave")}</p>}
          {choices.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input value={c.en} aria-label={`${L("fiOption")} ${i + 1}`} placeholder={`${L("fiOption")} ${i + 1}`} className="h-8 text-sm"
                onChange={(e) => set({ choices: choices.map((x, n) => (n === i ? { ...x, en: e.target.value } : x)) })} />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                aria-label={`${L("fdRemove")}: ${c.en || i + 1}`} onClick={() => set({ choices: choices.filter((_, n) => n !== i) })}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-primary" onClick={() => set({ choices: [...choices, { en: "" }] })}>
            <Plus className="me-1 h-3 w-3" />{L("fiOption")}
          </Button>
        </Section>
      )}

      {(asks("doctype_target") || asks("child_target")) && (
        <Section title={L("fiLinkTarget")} icon={Link2} missing={targetMissing}>
          <Field id={`${id}-target`} label={asks("child_target") ? L("fiTableOfRows") : L("fiLinksTo")}>
            <SearchCombobox id={`${id}-target`} variant="field" value={def.linkTarget} invalid={targetMissing}
              placeholder={L("fiChooseRecordType")} searchPlaceholder={L("fiSearch")} emptyText={L("fiNoMatches")}
              queryKey={asks("child_target") ? "child" : "doctype"}
              search={async (q) => (linkTargets ? await linkTargets(q, asks("child_target")) : []).map((t) => ({ value: t.name, label: t.name, description: t.app }))}
              onSelect={(v) => set({ linkTarget: v, linkFilters: undefined, defaultValue: undefined })} />
          </Field>
          {asks("doctype_target") && def.linkTarget && (
            <div className="space-y-2">
              <Label className="text-[11px] text-muted-foreground">{L("fiLimitRecords")}</Label>
              {filters.map((f, i) => (
                <div key={i} className="space-y-1.5 rounded-md border border-border p-2" data-link-filter={i}>
                  <div className="flex items-center gap-1.5">
                    <Select value={f.field || undefined} onValueChange={(v) => setFilter(i, { field: v })}>
                      <SelectTrigger className="h-8 text-xs" aria-label={L("fiFilterField")}><SelectValue placeholder={L("fiFilterField")} /></SelectTrigger>
                      <SelectContent>
                        {targetFields.map((tf) => <SelectItem key={tf.fieldname} value={tf.fieldname}>{tf.label || tf.fieldname}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`${L("fdRemove")}: ${f.field || i + 1}`}
                      onClick={() => set({ linkFilters: filters.filter((_, n) => n !== i) })}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Select value={f.operator} onValueChange={(v) => setFilter(i, { operator: v, value: v === "is" ? "set" : v === "in" || v === "not in" ? [] : "" })}>
                      <SelectTrigger className="h-8 w-28 text-xs" aria-label={L("fiFilterOperator")}><SelectValue /></SelectTrigger>
                      <SelectContent>{(registry.linkOperators ?? LINK_OPERATORS).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                    {f.operator === "is" ? (
                      <Select value={String(f.value ?? "set")} onValueChange={(v) => setFilter(i, { value: v })}>
                        <SelectTrigger className="h-8 text-xs" aria-label={L("fiFilterValue")}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="set">{L("fiIsSet")}</SelectItem>
                          <SelectItem value="not set">{L("fiIsNotSet")}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input className="h-8 text-xs" aria-label={L("fiFilterValue")} placeholder={f.operator === "in" || f.operator === "not in" ? L("fiCommaSeparated") : L("fiFilterValue")}
                        value={Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? "")}
                        onChange={(e) => setFilter(i, { value: f.operator === "in" || f.operator === "not in" ? e.target.value.split(",").map((x) => x.trim()) : e.target.value })} />
                    )}
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="h-8 w-full justify-start gap-1.5 text-xs"
                onClick={() => set({ linkFilters: [...filters, { field: "", operator: "=", value: "" }] })}>
                <Plus className="h-3.5 w-3.5" />{L("fiAddFilter")}
              </Button>
            </div>
          )}
        </Section>
      )}

      {asks("sibling_field") && (
        <Section title={L("fiDecidedBy")} icon={Shuffle} missing={targetMissing}>
          <Field id={`${id}-sibling`} label={def.type === "dynamic_link" ? L("fiDecidingLink") : L("fiImageField")}>
            <Select value={def.linkTarget || undefined} onValueChange={(v) => set({ linkTarget: v })}>
              <SelectTrigger id={`${id}-sibling`} className="h-9 text-sm"><SelectValue placeholder={L("fiPickField")} /></SelectTrigger>
              <SelectContent>
                {siblingChoices.length === 0
                  ? <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">{def.type === "dynamic_link" ? L("fiAddRecordTypeLink") : L("fiAddImageField")}</div>
                  : siblingChoices.map((s) => <SelectItem key={s.key} value={s.key!}>{(ar && s.labelAr) || s.label || s.key}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </Section>
      )}

      {(asks("data_subtype") || asks("max_rating") || asks("precision")) && (
        <Section title={L("fiTypeSettings")} icon={Settings2}>
          {asks("data_subtype") && (
            <Field id={`${id}-sub`} label={L("fiKindOfText")} hint={L("fiFormatChecked")}>
              <Select value={def.dataSubtype || NONE} onValueChange={(v) => set({ dataSubtype: v === NONE ? undefined : v })}>
                <SelectTrigger id={`${id}-sub`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{L("fiPlainText")}</SelectItem>
                  {registry.dataSubtypes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          {asks("max_rating") && (
            <Field id={`${id}-rating`} label={L("fiOutOf")}>
              <Input id={`${id}-rating`} inputMode="numeric" placeholder="5" className="h-9 w-28" value={def.maxRating ?? ""}
                onChange={(e) => set({ maxRating: whole(e.target.value) })} />
            </Field>
          )}
          {asks("precision") && (
            <Field id={`${id}-precision`} label={L("fiDecimalPlaces")}>
              <Select value={def.precision || NONE} onValueChange={(v) => set({ precision: v === NONE ? undefined : v })}>
                <SelectTrigger id={`${id}-precision`} className="h-9 w-28 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{L("fiDefaultPrecision")}</SelectItem>
                  {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
        </Section>
      )}

      {(asks("unique") || asks("max_length") || asks("bounds") || asks("non_negative")) && (
        <Section title={L("fiValidation")} icon={ShieldCheck}>
          {asks("unique") && <Toggle id={`${id}-unique`} label={L("fiUnique")} checked={def.unique} onChange={(v) => set(v ? { unique: true, defaultValue: undefined } : { unique: false })} />}
          {asks("max_length") && (
            <Field id={`${id}-len`} label={L("fiMaxLength")} hint={L("fiMaxLengthHint")}>
              <Input id={`${id}-len`} inputMode="numeric" className="h-9 w-32" placeholder={L("fiNoLimit")} value={def.maxLength ?? ""}
                onChange={(e) => set({ maxLength: whole(e.target.value) })} />
            </Field>
          )}
          {asks("bounds") && (
            <div className="grid grid-cols-2 gap-3">
              <Field id={`${id}-min`} label={L("fiMin")}>
                <Input id={`${id}-min`} type="number" className="h-9" value={def.minValue ?? ""} onChange={(e) => set({ minValue: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </Field>
              <Field id={`${id}-max`} label={L("fiMax")}>
                <Input id={`${id}-max`} type="number" className="h-9" value={def.maxValue ?? ""} onChange={(e) => set({ maxValue: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </Field>
            </div>
          )}
          {asks("non_negative") && <Toggle id={`${id}-nonneg`} label={L("fiNonNegative")} checked={def.nonNegative} onChange={(v) => set({ nonNegative: v })} />}
        </Section>
      )}

      <Section title={L("fiConditions")} icon={GitBranch}>
        {([["showWhen", "fiShowWhen", "fiShowWhenHint"], ["requiredWhen", "fiRequiredWhen", "fiRequiredWhenHint"], ["readOnlyWhen", "fiReadOnlyWhen", "fiReadOnlyWhenHint"]] as const).map(([k, label, hint]) => (
          <Field key={k} id={`${id}-${k}`} label={L(label)} hint={L(hint)}>
            <Textarea id={`${id}-${k}`} dir="ltr" rows={2} className="font-mono text-sm" placeholder={L("fiConditionPlaceholder")}
              value={def[k] ?? ""} onChange={(e) => set({ [k]: e.target.value } as Partial<FieldDefinition>)} />
          </Field>
        ))}
      </Section>

      {asks("autofill") && links.length > 0 && (
        <Section title={L("fiAutofill")} icon={Download}>
          <Field id={`${id}-fetch`} label={L("fiAutofillFrom")}>
            <Select value={def.fetchFrom || NONE} onValueChange={(v) => set(v === NONE ? { fetchFrom: undefined, fetchSource: undefined } : { fetchFrom: v, fetchSource: undefined })}>
              <SelectTrigger id={`${id}-fetch`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{L("fiNone")}</SelectItem>
                {links.map((s) => <SelectItem key={s.key} value={s.key!}>{(ar && s.labelAr) || s.label || s.key}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {def.fetchFrom && (
            <Field id={`${id}-source`} label={L("fiAutofillField")}>
              <Select value={def.fetchSource || NONE} onValueChange={(v) => set({ fetchSource: v === NONE ? undefined : v })}>
                <SelectTrigger id={`${id}-source`} className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{L("fiNone")}</SelectItem>
                  {sourceFields.map((f) => <SelectItem key={f.fieldname} value={f.fieldname}>{f.label || f.fieldname}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Toggle id={`${id}-empty`} label={L("fiOnlyWhenEmpty")} checked={def.fetchOnlyWhenEmpty} onChange={(v) => set({ fetchOnlyWhenEmpty: v })} />
        </Section>
      )}

      <Section title={L("fiDisplay")} icon={Eye}>
        <Toggle id={`${id}-list`} label={L("fiInListView")} checked={def.inListView} onChange={(v) => set({ inListView: v })} />
        <Toggle id={`${id}-filter`} label={L("fiUseAsFilter")} checked={def.useAsFilter} onChange={(v) => set({ useAsFilter: v })} />
        <Toggle id={`${id}-search`} label={L("fiGlobalSearch")} checked={def.globalSearch} onChange={(v) => set({ globalSearch: v })} />
        <Toggle id={`${id}-bold`} label={L("fiBold")} checked={def.bold} onChange={(v) => set({ bold: v })} />
        <Toggle id={`${id}-hidden`} label={L("fiHidden")} checked={def.hidden} onChange={(v) => set({ hidden: v })} />
        <Toggle id={`${id}-ro`} label={L("fiReadOnly")} checked={def.readOnly} onChange={(v) => set({ readOnly: v })} />
        <Toggle id={`${id}-tr`} label={L("fiTranslatable")} checked={def.translatable} onChange={(v) => set({ translatable: v })} />
      </Section>
    </div>
  );
}

function DefaultControl({ id, def, numeric, L, onChange }: { id: string; def: FieldDefinition; numeric: boolean; L: (k: Key) => string; onChange: (v: string) => void }) {
  const v = def.defaultValue ?? "";
  if (def.type === "checkbox") return <Switch id={id} checked={v === "1" || v === "true"} onCheckedChange={(c) => onChange(c ? "1" : "")} />;
  if (def.choices && (def.type === "dropdown" || def.type === "radio" || def.type === "autocomplete")) {
    return (
      <Select value={v || NONE} onValueChange={(x) => onChange(x === NONE ? "" : x)}>
        <SelectTrigger id={id} className="h-9 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{L("fiNone")}</SelectItem>
          {def.choices.filter((c) => c.en.trim()).map((c) => <SelectItem key={c.en} value={c.en}>{c.en}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  if (def.type === "rating") {
    return (
      <Select value={v || NONE} onValueChange={(x) => onChange(x === NONE ? "" : x)}>
        <SelectTrigger id={id} className="h-9 w-28 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{L("fiNone")}</SelectItem>
          {Array.from({ length: def.maxRating || 5 }, (_, i) => String(i + 1)).map((n) => <SelectItem key={n} value={n}>{n} ★</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  const type = def.type === "date" ? "date" : def.type === "datetime" ? "datetime-local" : def.type === "time" ? "time" : def.type === "color" ? "color" : numeric ? "number" : "text";
  return <Input id={id} type={type} value={v} className={cn("h-9", type === "color" && "w-16 p-1")} placeholder={L("fiDefault")} onChange={(e) => onChange(e.target.value)} />;
}
