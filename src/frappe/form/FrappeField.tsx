/**
 * FrappeField — one DocField as a control, by fieldtype (Desk `make_control`, docs `12` §1–§10), built on the generic
 * controls in src/fields. Value in / value out in Frappe's stored formats.
 *
 * Status (docs `11` §2.5): pass the form's `status` (foundation `usePermissions().displayStatus` + fetch lock); without
 * one the dialog rules apply (hidden → none; read_only / virtual / Read Only → read; else write) plus the control rules
 * (fetch_from lock, empty read fields hidden). "None" renders nothing; "Read" renders the formatted value
 * (`formatValue`, docs `12` §9) — never an input.
 * Writing (docs `12` §1.4): Data-like text writes 500 ms after typing stops and on blur (in a grid: on blur only);
 * numbers, dates, times, selects, links and checks write on change / blur. Data options Email / Phone / URL are checked
 * softly (the field is flagged; the server rejects on save, as in Desk).
 * Stored formats (docs `12` §7): Date `YYYY-MM-DD`, Datetime `YYYY-MM-DD HH:mm:ss` (edited in the browser's zone —
 * UNVERIFIED for sites whose system and user zones differ; read-only display converts through formatValue), Time
 * `HH:mm:ss`, Duration seconds, Rating a 0…1 fraction, Check 0/1. Text Editor stores plain sanitized HTML (Desk wraps it
 * in a `ql-editor` div — a convention, not a contract). Attach / Attach Image upload through `upload_file`
 * (FrappeAttachField). Autocomplete (P35): a suggestion box over `df.options` (lines or a JSON list of strings /
 * `{label, value}`, autocomplete.js parse_options :147-166); a typed value not in the list is cleared unless
 * `ignore_validation` (autocomplete.js validate :132-145); an empty list accepts anything.
 * Fieldtypes without a control (`SUPPORTED_FIELDTYPES` — Signature, Geolocation, Barcode, Icon, custom types) render
 * their raw value READ-ONLY in every status (P35; before 0.7 they were an editable text box) and the form lists them
 * in its issues banner. Not implemented: Code editor (a monospace textarea), Phone country picker.
 */
import * as React from "react";
import { useLocale } from "../../theme/ThemeProvider";
import { cn } from "../../lib/cn";
import { Checkbox } from "../../primitives/checkbox";
import { Textarea } from "../../primitives/textarea";
import { Button } from "../../primitives/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../primitives/select";
import { DateField, DateTimeField } from "../../primitives/date-time-field";
import { RichTextEditor, RichText, sanitizeHtml } from "../../primitives/rich-text-editor";
import { FieldShell, FIELD_INPUT, FIELD_INVALID, interpolate } from "../../fields/FieldShell";
import { NumberInput } from "../../fields/NumberInput";
import { TimeInput } from "../../fields/TimeInput";
import { DurationInput } from "../../fields/DurationInput";
import { FrappeAttachField } from "./FrappeAttachField";
import { LinkInput } from "../../fields/LinkInput";
import type { Suggestion } from "../../fields/autocomplete";
import { SUPPORTED_FIELDTYPES } from "./model/fieldtypes";
import { ReadOnlyValue } from "../../fields/ReadOnlyValue";
import { Rating } from "../../fields/Rating";
import { ColorInput } from "../../fields/ColorInput";
import { numberFormatInfo } from "../../fields/lib/number";
import type { FieldDisplayStatus, FrappeDoc, FrappeDocField, MetaBundle, ValidateLinkResult } from "../contract";
import { controlStatus, ladderStatus } from "./model/status";
import { isEmptyValue, type EffectiveField } from "./model/depends";
import { useFormServices } from "./services";
import { FrappeDynamicLinkField, FrappeLinkField } from "./FrappeLinkField";
import { FrappeChildTable, type TableController } from "./FrappeChildTable";
import { FrappeTableMultiSelect } from "./FrappeTableMultiSelect";
import type { LinkQuery } from "./events";

export interface FrappeFieldProps {
  df: EffectiveField;
  value: unknown;
  onChange: (value: unknown) => void;
  /** The document (or child row) the field belongs to; the form's document for a row. */
  doc?: FrappeDoc;
  parent?: FrappeDoc;
  /** The form's bundle (labels, child metas, reference DocType). */
  bundle?: MetaBundle;
  status?: FieldDisplayStatus;
  /** Only the control (grid cells): no label, description or error line. */
  onlyInput?: boolean;
  /** Flag a required field whose value is empty (Desk's red mandatory marker). Default true. */
  markMissing?: boolean;
  error?: React.ReactNode;
  /** Link: the field's query (`setQuery`), fetch columns and the validation result (for fetch_from). */
  query?: LinkQuery;
  fetchFields?: string[];
  onLinkValidated?: (result: ValidateLinkResult | null) => void;
  formFields?: Map<string, FrappeDocField>;
  /** Table: the rows controller from the form (else the table edits `value` through `onChange`). */
  table?: TableController;
  onButtonClick?: (fieldname: string) => void;
  id?: string;
  className?: string;
}

const TEXTAREA_TYPES = new Set(["Small Text", "Text", "Long Text", "Code", "JSON", "HTML Editor", "Markdown Editor"]);
const MONO_TYPES = new Set(["Code", "JSON", "HTML Editor", "Markdown Editor"]);
const MAXLEN_TYPES = new Set(["Data", "Password", "Read Only"]);
const NUMBER_KIND: Record<string, "int" | "float" | "currency" | "percent"> = { Int: "int", "Long Int": "int", Float: "float", Currency: "currency", Percent: "percent" };

/** Desk's soft Data validators (data.js:280-313; utils.js:455-477). The server is the real gate. */
export function dataOptionInvalid(options: string | undefined, value: unknown): boolean {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) return false;
  if (options === "Email") return v.split(/[,\n]/).map((e) => e.trim()).filter(Boolean).some((e) => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e));
  if (options === "Phone") return !/^([0-9 +_\-,.*#()]){1,20}$/.test(v);
  if (options === "URL") return !(/^[a-z][a-z0-9+.-]*:\/\/[^\s/]+/i.test(v) || v.startsWith("/"));
  return false;
}

/** Text that writes 500 ms after typing stops and on blur (Desk `trigger_change_on_input_event`), or only on blur. */
function DebouncedText({ value, onChange, debounce, multiline, className, ...rest }: {
  value: string; onChange: (v: string) => void; debounce: boolean; multiline?: boolean; className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = (v: string) => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } if (v !== value) onChange(v); };
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const common = {
    value: draft ?? value,
    onFocus: () => setDraft(value),
    onBlur: () => { if (draft != null) flush(draft); setDraft(null); },
  };
  const change = (v: string) => {
    setDraft(v);
    if (!debounce) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; if (v !== value) onChange(v); }, 500);
  };
  if (multiline) {
    return <Textarea {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} {...common} className={className} onChange={(e) => change(e.target.value)} />;
  }
  return <input {...rest} {...common} className={cn(FIELD_INPUT, className)} onChange={(e) => change(e.target.value)} />;
}

const str = (v: unknown) => (v == null ? "" : String(v));

/** autocomplete.js parse_options (:147-166): newline text or a JSON list of strings / {label, value}. */
export function autocompleteOptions(options: unknown, translate: (s: string) => string = (x) => x): Suggestion[] {
  let list: unknown = options;
  if (typeof list === "string" && list.trim().startsWith("[")) { try { list = JSON.parse(list); } catch { list = []; } }
  if (typeof list === "string") list = list.split("\n");
  if (!Array.isArray(list)) return [];
  const out: Suggestion[] = [];
  for (const o of list as unknown[]) {
    if (typeof o === "string") { if (o) out.push({ value: o, label: translate(o) }); continue; }
    if (!o || typeof o !== "object") continue;
    const r = o as { value?: unknown; label?: unknown };
    const value = str(r.value);
    if (value) out.push({ value, label: translate(str(r.label ?? r.value)) });
  }
  return out;
}

function AutocompleteControl({ df, value, onChange, translate, invalid, ...rest }: {
  df: FrappeDocField; value: string; onChange: (v: string) => void; translate: (s: string) => string; invalid?: boolean;
  id?: string; "aria-label"?: string; "aria-describedby"?: string;
}) {
  const options = React.useMemo(() => autocompleteOptions(df.options, translate), [df.options, translate]);
  const search = React.useCallback(async (txt: string) => {
    const q = txt.trim().toLowerCase();
    return q ? options.filter((o) => o.value.toLowerCase().includes(q) || (o.label ?? "").toLowerCase().includes(q)) : options;
  }, [options]);
  const accept = (v: string | null) => {
    const text = v ?? "";
    if (!text || df.ignore_validation || !options.length || options.some((o) => o.value === text)) onChange(text);
    else onChange(""); // validate (:132-145): a value outside the list is dropped
  };
  return (
    <LinkInput {...rest} value={value || null} displayValue={options.find((o) => o.value === value)?.label ?? null}
      onChange={(v) => accept(v)} onCommitText={(t) => accept(t)} search={search} debounceMs={0} invalid={invalid}
      placeholder={df.placeholder ? str(df.placeholder) : undefined} />
  );
}
const num = (v: unknown): number | null => { if (v == null || v === "") return null; const n = Number(v); return Number.isFinite(n) ? n : null; };
const toDsDatetime = (v: unknown) => { const s = str(v); return s ? s.slice(0, 16).replace(" ", "T") : ""; };
const fromDsDatetime = (v: string) => (v ? `${v.replace("T", " ")}:00`.slice(0, 19) : null);

export function FrappeField(props: FrappeFieldProps) {
  const { df, value, onChange, doc, parent, bundle, onlyInput, markMissing = true, error, className } = props;
  const { t } = useLocale();
  const s = useFormServices();
  const autoId = React.useId();
  const id = props.id ?? `sf-ff-${df.fieldname}-${autoId}`;
  const rowDoc: FrappeDoc = doc ?? ({ doctype: bundle?.doctype ?? "", name: "", [df.fieldname]: value } as FrappeDoc);
  const status: FieldDisplayStatus = props.status ?? controlStatus(ladderStatus(df, rowDoc), df, { ...rowDoc, [df.fieldname]: value });
  if (status === "None") return null;

  const label = s.translate(bundle, df.label || df.fieldname);
  const description = df.description ? s.translate(bundle, df.description) : undefined;
  const read = status === "Read";
  const required = !!df.reqd && !read;
  const softInvalid = df.fieldtype === "Data" && dataOptionInvalid(df.options, value);
  const missing = markMissing && required && !onlyInput && isEmptyValue(value) && !["Table", "Table MultiSelect"].includes(df.fieldtype);
  const invalid = softInvalid || missing || !!error;
  const errId = `${id}-msg`;
  const aria = onlyInput ? { "aria-label": label } : {};
  const ft = df.fieldtype;
  const fc = s.formatContext;
  const shell = (control: React.ReactNode, opts: { inline?: boolean; noLabelFor?: boolean } = {}) =>
    onlyInput ? <div className={className}>{control}</div> : (
      <FieldShell label={label} htmlFor={opts.noLabelFor ? undefined : id} labelId={`${id}-label`} required={required} bold={!!df.bold}
        description={description} error={error} describedById={errId} inline={opts.inline} className={className}>
        {control}
      </FieldShell>
    );

  // ---- no control for this fieldtype: the stored value, read-only (reported by the form) ----
  if (!SUPPORTED_FIELDTYPES.has(ft)) {
    const raw = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
    return shell(<ReadOnlyValue id={id} value={raw} multiline data-unsupported-fieldtype={ft} {...(onlyInput ? aria : { "aria-labelledby": `${id}-label` })} />, { noLabelFor: true });
  }

  // ---- display-only fieldtypes ----
  if (ft === "HTML") return <div className={cn("text-sm", className)} dangerouslySetInnerHTML={{ __html: sanitizeHtml(str(df.options)) }} />;
  if (ft === "Heading") return <h4 className={cn("text-sm font-semibold", className)}>{label}</h4>;
  if (ft === "Button") return <div className={className}><Button type="button" variant={df.primary ? "default" : "outline"} size="sm" onClick={() => props.onButtonClick?.(df.fieldname)}>{label}</Button></div>;
  if (ft === "Image") { const src = str(rowDoc[str(df.options)]); return src ? <img src={src} alt={label} className={cn("max-h-48 rounded-md", className)} /> : null; }

  // ---- tables ----
  if (ft === "Table") {
    return shell(
      <FrappeChildTable df={df} bundle={bundle} parent={parent ?? rowDoc} rows={Array.isArray(value) ? (value as FrappeDoc[]) : []}
        onRowsChange={(rows) => onChange(rows)} controller={props.table} status={status} label={label} invalid={missing || !!error} />,
      { noLabelFor: true },
    );
  }
  if (ft === "Table MultiSelect") {
    return shell(
      <FrappeTableMultiSelect id={id} df={df} bundle={bundle} parent={parent ?? rowDoc} rows={Array.isArray(value) ? (value as FrappeDoc[]) : []}
        onRowsChange={(rows) => onChange(rows)} controller={props.table} status={status} query={props.query} invalid={invalid} aria-describedby={error ? errId : undefined} {...aria} />,
    );
  }

  // ---- read-only display ----
  if (read && ft !== "Link" && ft !== "Dynamic Link") {
    if (ft === "Check") return shell(<Checkbox id={id} checked={!!Number(value)} disabled aria-readonly {...aria} />, { inline: true });
    if (ft === "Text Editor") return shell(<RichText value={str(value)} />, { noLabelFor: true });
    if (ft === "Rating") { const max = Number(df.options) || 5; return shell(<Rating id={id} value={(num(value) ?? 0) * max} max={max} onChange={() => {}} readOnly {...aria} aria-labelledby={onlyInput ? undefined : `${id}-label`} />, { noLabelFor: true }); }
    const text = s.formatValue(value, df, rowDoc);
    const isNum = NUMBER_KIND[ft] != null;
    const href = (ft === "Attach" || ft === "Attach Image") && value ? str(value) : undefined;
    return shell(<ReadOnlyValue id={id} value={text} align={isNum ? "end" : "start"} multiline={TEXTAREA_TYPES.has(ft)} href={href} bold={!!df.bold} {...(onlyInput ? aria : { "aria-labelledby": `${id}-label` })} />, { noLabelFor: true });
  }

  const common = { id, "aria-invalid": invalid || undefined, "aria-describedby": error ? errId : undefined, ...aria };

  // ---- links ----
  if (ft === "Link" || ft === "Dynamic Link") {
    const linkProps = {
      df, value: (value as string | null | undefined) ?? null, onChange: (v: string | null) => onChange(v), doc: rowDoc, parent: parent ?? rowDoc,
      referenceDoctype: bundle?.doctype, query: props.query, fetchFields: props.fetchFields, onValidated: props.onLinkValidated,
      formFields: props.formFields, status, invalid, ...common,
      ...(onlyInput || read ? {} : { "aria-labelledby": undefined }),
    };
    return shell(ft === "Link" ? <FrappeLinkField {...linkProps} /> : <FrappeDynamicLinkField {...linkProps} />, { noLabelFor: read });
  }

  // ---- numbers ----
  const kind = NUMBER_KIND[ft];
  if (kind) {
    const dfPrecision = df.precision != null && df.precision !== "" ? Number(df.precision) : null;
    const precision = kind === "int" ? 0
      : kind === "currency" ? dfPrecision ?? fc.currencyPrecision ?? numberFormatInfo(fc.numberFormat).precision
      : dfPrecision ?? fc.floatPrecision ?? null;
    return shell(
      <NumberInput {...common} kind={kind} value={num(value)} onChange={(v) => onChange(v)} precision={precision}
        numberFormat={fc.numberFormat} rounding={fc.roundingMethod} onUnparsable="clear" invalid={invalid} />,
    );
  }

  if (ft === "Attach" || ft === "Attach Image") {
    // Desk attaches to the form's document (in a grid: the parent), attach.js:80-87
    const target = parent ?? rowDoc;
    return shell(
      <FrappeAttachField id={id} df={df} value={str(value) || null} onChange={(v) => onChange(v)} doctype={str(target.doctype) || bundle?.doctype}
        docname={str(target.name)} bundle={bundle} invalid={invalid} aria-describedby={error ? errId : undefined} {...aria} />,
      { noLabelFor: true },
    );
  }
  switch (ft) {
    case "Check":
      return shell(<Checkbox {...common} checked={!!Number(value)} onCheckedChange={(c) => onChange(c === true ? 1 : 0)} />, { inline: true });
    case "Select": {
      const opts = str(df.options).split("\n");
      const EMPTY = "\u0000";
      const cur = str(value);
      return shell(
        <Select value={cur === "" ? EMPTY : cur} onValueChange={(v) => onChange(v === EMPTY ? "" : v)}>
          <SelectTrigger {...common} className={cn(invalid && FIELD_INVALID)}><SelectValue placeholder={df.placeholder ? str(df.placeholder) : undefined} /></SelectTrigger>
          <SelectContent>
            {[...new Set(opts)].map((o) => <SelectItem key={o || EMPTY} value={o === "" ? EMPTY : o}>{o === "" ? " " : s.translate(bundle, o)}</SelectItem>)}
            {cur && !opts.includes(cur) && <SelectItem value={cur}>{cur}</SelectItem>}
          </SelectContent>
        </Select>,
      );
    }
    case "Date":
      // the editable field shows the site's date format, like its read-only display (Desk: both through the user's
      // date_format); the value stays "YYYY-MM-DD" (no Date/timezone conversion on the way in or out)
      return shell(<DateField {...common} value={str(value).slice(0, 10)} onChange={(v) => onChange(v || null)} error={undefined}
        formatDisplay={(v) => s.formatValue(v, df, rowDoc)} />);
    case "Datetime":
      return shell(<DateTimeField {...common} value={toDsDatetime(value)} onChange={(v) => onChange(fromDsDatetime(v))} />);
    case "Time":
      return shell(<TimeInput {...common} value={str(value) || null} onChange={(v) => onChange(v)} onUnparsable="clear" hour12={/a/i.test(str(fc.timeFormat))} invalid={invalid} />);
    case "Duration":
      return shell(<DurationInput {...common} value={num(value)} onChange={(v) => onChange(v)} hideDays={!!df.hide_days} hideSeconds={!!df.hide_seconds} invalid={invalid}
        {...(onlyInput ? {} : { "aria-labelledby": `${id}-label` })} />, { noLabelFor: true });
    case "Rating": {
      const max = Number(df.options) || 5;
      return shell(<Rating id={id} value={(num(value) ?? 0) * max} max={max} required={!!df.reqd} onChange={(v) => onChange(v == null ? 0 : v / max)}
        {...(onlyInput ? aria : { "aria-labelledby": `${id}-label` })} />, { noLabelFor: true });
    }
    case "Color":
      return shell(<ColorInput {...common} value={str(value) || null} onChange={(v) => onChange(v ?? "")} onUnparsable="clear" invalid={invalid} />);
    case "Text Editor":
      return shell(<RichTextEditor id={id} ariaLabel={label} value={str(value)} onChange={(html) => onChange(html)} />, { noLabelFor: true });
    case "Autocomplete":
      return shell(<AutocompleteControl {...common} df={df} value={str(value)} onChange={(v) => onChange(v)} translate={(x) => s.translate(bundle, x)} invalid={invalid} />);
    default:
      break;
  }

  if (TEXTAREA_TYPES.has(ft)) {
    return shell(
      <DebouncedText {...common} multiline debounce={!onlyInput} value={str(value)} onChange={(v) => onChange(v)}
        className={cn(MONO_TYPES.has(ft) && "font-mono", invalid && FIELD_INVALID)} {...(MONO_TYPES.has(ft) ? { dir: "ltr" } : {})} />,
    );
  }
  // Data and the string types without their own control
  const type = ft === "Password" ? "password" : df.options === "Email" ? "email" : df.options === "Phone" || ft === "Phone" ? "tel" : df.options === "URL" ? "url" : "text";
  const maxLength = MAXLEN_TYPES.has(ft) ? Number(df.length) || 140 : undefined;
  return shell(
    <>
      <DebouncedText {...common} type={type} maxLength={maxLength} debounce={!onlyInput} value={str(value)} onChange={(v) => onChange(v)}
        className={cn(invalid && FIELD_INVALID)} {...(type !== "text" ? { dir: "ltr" } : {})} placeholder={df.placeholder ? str(df.placeholder) : undefined} />
      {softInvalid && !onlyInput && <span className="sr-only" role="status">{interpolate(t("formInvalidFormat"), { type: str(df.options) })}</span>}
    </>,
  );
}
