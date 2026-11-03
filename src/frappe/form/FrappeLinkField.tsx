/**
 * FrappeLinkField / FrappeDynamicLinkField — Desk's Link control over `search_link` and `validate_link`
 * (docs `12` §4, §6). Built on the generic LinkInput.
 *
 *  - Search: debounced 500 ms; `search_link {txt, doctype, reference_doctype, page_length, filters?, query?,
 *    ignore_user_permissions?}`; results show `label` (else the value) and the description when it differs.
 *  - Query resolution order (link.js `set_custom_query`): `link_filters` (JSON `[[dt, field, op, value]]`, `eval:`
 *    values evaluated with doc / parent) merged UNDER the field's query (`setQuery` / `query` prop: object, bare
 *    filters, method path, or a function of (doc, cdt, cdn)); empty filter values dropped unless the key is a Link /
 *    Dynamic Link field of the form; then `filters` (df.filters / prop) merged in. `link_filters` is client-only in
 *    15.110: the server accepts any existing, permitted value.
 *  - Validation: a hand-typed value, a picked value and a set value go through `validate_link(doctype, value,
 *    fetch fields)`; a null `name` CLEARS the field; the canonical name replaces the typed case; fetched values are
 *    handed to `onValidated` (the form writes the fetch targets). Clearing reports `onValidated(null)` (targets → "").
 *    `ignore_link_validation` skips it. A Dynamic Link with no DocType yet searches nothing and clears typed text.
 *  - Titles: a picked result's label is remembered per "DocType::name" and shown for the value (Desk's link-title
 *    cache, scoped to the provider's client and session user — linkTitles.ts). UNVERIFIED: `show_title_field_in_link` targets — without boot this shows a label only when one is known.
 *  - "Create a new X": offered when `canCreate(doctype)` and not `only_select`; the app's `onCreateNew` writes back.
 */
import * as React from "react";
import { Plus } from "lucide-react";
import { useLocale } from "../../theme/ThemeProvider";
import { LinkInput } from "../../fields/LinkInput";
import { ReadOnlyValue } from "../../fields/ReadOnlyValue";
import { interpolate } from "../../fields/FieldShell";
import type { Suggestion, SuggestionAction } from "../../fields/autocomplete";
import type { FieldDisplayStatus, FrappeDoc, FrappeDocField, SearchLinkOptions, ValidateLinkResult } from "../contract";
import { evaluateDepends, type DependsIssue } from "./model/depends";
import { resolveLinkQuery, type LinkQuery } from "./events";
import { useFormServices } from "./services";
import { useLinkTitles } from "./linkTitles";
import { FrappeError } from "../client";
import { useFrappeMessages } from "../feedback/messages";


type FilterDict = Record<string, unknown>;

/** `link_filters` JSON → `{ field: [op, value] }`; `eval:` values evaluated with doc / parent (docs `12` §4.4 step 1). */
export function parseLinkFilters(json: unknown, doc: FrappeDoc | undefined, parent: FrappeDoc | undefined, onIssue?: (i: DependsIssue) => void, fieldname = ""): FilterDict {
  if (typeof json !== "string" || !json.trim()) return {};
  let list: unknown;
  try { list = JSON.parse(json); } catch { return {}; }
  if (!Array.isArray(list)) return {};
  const out: FilterDict = {};
  for (const f of list) {
    if (!Array.isArray(f) || f.length < 4) continue;
    const [, field, op, raw] = f as [string, string, string, unknown];
    let value = raw;
    if (typeof raw === "string" && raw.startsWith("eval:")) {
      const d = doc ?? ({ doctype: "", name: "" } as FrappeDoc);
      value = evaluateDepends(raw, d, parent ?? d, { onIssue }, { doctype: d.doctype, fieldname, property: "link_filters" });
    }
    out[field] = [op, value];
  }
  return out;
}

const isEmptyFilter = (v: unknown) => v == null || v === "";

/** Merge the search filters in Desk's order. Arrays (list-of-tuples filters) are concatenated. */
export function mergeLinkFilters(
  linkFilters: FilterDict,
  queryFilters: FilterDict | unknown[] | undefined,
  extra: FilterDict | unknown[] | undefined,
  target: string,
  keepEmpty: (key: string) => boolean,
): FilterDict | unknown[] | undefined {
  const toTuples = (d: FilterDict) => Object.entries(d).map(([k, v]) => (Array.isArray(v) ? [target, k, v[0], v[1]] : [target, k, "=", v]));
  let merged: FilterDict | unknown[];
  if (Array.isArray(queryFilters)) merged = [...toTuples(linkFilters), ...queryFilters];
  else merged = { ...linkFilters, ...(queryFilters ?? {}) };
  if (!Array.isArray(merged)) for (const k of Object.keys(merged)) if (isEmptyFilter(merged[k]) && !keepEmpty(k)) delete merged[k];
  if (extra) {
    if (Array.isArray(merged) || Array.isArray(extra)) merged = [...(Array.isArray(merged) ? merged : toTuples(merged)), ...(Array.isArray(extra) ? extra : toTuples(extra))];
    else merged = { ...merged, ...extra };
  }
  return Array.isArray(merged) ? (merged.length ? merged : undefined) : Object.keys(merged).length ? merged : undefined;
}

export interface FrappeLinkFieldProps {
  /** The DocField: `options` (target), `link_filters`, `ignore_user_permissions`, `only_select`, `ignore_link_validation`. */
  df?: FrappeDocField;
  /** Target DocType (overrides `df.options`; required without a df). */
  options?: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** The document (or child row) the field belongs to, and the form's document. */
  doc?: FrappeDoc;
  parent?: FrappeDoc;
  /** The form's DocType: search_link `reference_doctype`. */
  referenceDoctype?: string;
  query?: LinkQuery;
  filters?: FilterDict | unknown[];
  /** Source columns of the fetch_from fields that follow this link. */
  fetchFields?: string[];
  onValidated?: (result: ValidateLinkResult | null) => void;
  /** Fields of the form (empty filters on Link / Dynamic Link fields are kept). */
  formFields?: Map<string, FrappeDocField>;
  status?: FieldDisplayStatus;
  invalid?: boolean;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  className?: string;
  onIssue?: (i: DependsIssue) => void;
}

export function FrappeLinkField({
  df, options, value, onChange, doc, parent, referenceDoctype, query, filters, fetchFields, onValidated, formFields, status = "Write",
  invalid, placeholder, id, className, onIssue, ...aria
}: FrappeLinkFieldProps) {
  const { t } = useLocale();
  const s = useFormServices();
  const messages = useFrappeMessages();
  const titles = useLinkTitles();
  const target = options ?? (df?.fieldtype === "Link" ? df.options : undefined) ?? "";
  const [busy, setBusy] = React.useState(false);
  const req = React.useRef(0);
  const latest = React.useRef({ doc, parent, value });
  latest.current = { doc, parent, value };

  const searchOptions = React.useCallback((): SearchLinkOptions => {
    const { doc: d, parent: p } = latest.current;
    const row = d ?? ({ doctype: referenceDoctype ?? "", name: "" } as FrappeDoc);
    const linkFilters = parseLinkFilters(df?.link_filters, d, p ?? d, onIssue ?? s.evaluator.onIssue, df?.fieldname);
    const q = resolveLinkQuery(query, p ?? row, row.doctype, row.name);
    const keepEmpty = (k: string) => { const f = formFields?.get(k); return !!f && (f.fieldtype === "Link" || f.fieldtype === "Dynamic Link"); };
    const extra = filters ?? (df?.filters as FilterDict | unknown[] | undefined);
    const merged = mergeLinkFilters(linkFilters, q.filters, extra, target, keepEmpty);
    return {
      pageLength: s.pageLength,
      ...(referenceDoctype ? { referenceDoctype } : {}),
      ...(merged ? { filters: merged as SearchLinkOptions["filters"] } : {}),
      ...(q.query ? { query: q.query } : {}),
      ...(df?.ignore_user_permissions ? { ignoreUserPermissions: true } : {}),
    };
  }, [df, query, filters, formFields, referenceDoctype, target, s, onIssue]);

  const search = React.useCallback(async (txt: string): Promise<Suggestion[]> => {
    if (!target) return [];
    const res = await s.searchLink(target, txt, searchOptions());
    for (const r of res) if (r.label) titles.remember(target, r.value, r.label);
    return res;
  }, [target, s, searchOptions, titles]);

  const commit = React.useCallback(async (v: string | null) => {
    const id = ++req.current;
    if (!v) { setBusy(false); onChange(null); onValidated?.(null); return; }
    if (!target) { onChange(null); onValidated?.(null); return; }
    onChange(v);
    if (df?.ignore_link_validation) return;
    setBusy(true);
    try {
      const r = await s.validateLink(target, v, fetchFields?.length ? fetchFields : undefined);
      if (id !== req.current) return;
      if (r.name == null) onChange(null);
      else if (r.name !== v) onChange(r.name);
      onValidated?.(r);
    } catch (e) {
      // R1-F11: Desk shows the request error (e.g. the 403 "You do not have Read or Select Permissions" dialog,
      // client.py:443-454); the typed value stays — the server re-validates links on save
      if (id === req.current) messages.show(e instanceof FrappeError && e.messages.length ? e.messages : [{ message: e instanceof Error ? e.message : String(e), indicator: "red" }]);
    } finally {
      if (id === req.current) setBusy(false);
    }
  }, [target, df, fetchFields, onChange, onValidated, s, messages]);

  const title = value ? titles.get(target, value) ?? s.formatContext.linkTitles?.[`${target}::${value}`] : undefined;
  const href = value && target ? s.linkHref(target, value) : undefined;

  if (status === "None") return null;
  if (status === "Read") {
    return <ReadOnlyValue id={id} {...aria} value={title ?? value ?? ""} href={href} onLinkClick={s.onOpenLink && value ? (e) => s.onOpenLink!(target, value, e) : undefined} className={className} />;
  }
  const canCreate = !!target && !df?.only_select && s.canCreate(target) && !!s.onCreateNew;
  const actions = canCreate
    ? (typed: string): SuggestionAction[] => [{
      key: "create",
      icon: <Plus className="size-4" aria-hidden />,
      label: interpolate(t("formCreateNew"), { doctype: s.translate(undefined, target) }),
      onSelect: (txt) => s.onCreateNew!({ doctype: target, typed: txt || typed, df: df ?? { fieldname: "", fieldtype: "Link", options: target }, doc, setValue: (name) => void commit(name) }),
    }]
    : undefined;

  return (
    <LinkInput
      id={id}
      {...aria}
      className={className}
      value={value ?? null}
      displayValue={title}
      onChange={(v, picked) => { if (picked?.label && v) titles.remember(target, v, picked.label); void commit(v); }}
      onCommitText={(text) => void commit(text)}
      search={search}
      debounceMs={500}
      actions={actions}
      href={href}
      onOpenHref={s.onOpenLink && value ? (e) => s.onOpenLink!(target, value, e) : undefined}
      busy={busy}
      invalid={invalid}
      placeholder={placeholder}
    />
  );
}

export interface FrappeDynamicLinkFieldProps extends Omit<FrappeLinkFieldProps, "options"> {
  df: FrappeDocField;
  /** Override the DocType (Desk `df.get_options`). Default: the sibling field named by `df.options`. */
  getOptions?: (doc: FrappeDoc | undefined) => string | undefined;
}

/**
 * Dynamic Link (docs `12` §6): `df.options` names the SIBLING field that holds the DocType (in a grid row, the row's
 * own field). While it is empty the field searches nothing and a typed value is cleared. Changing the type does not
 * clear the value (Desk does not either).
 */
export function FrappeDynamicLinkField({ getOptions, ...props }: FrappeDynamicLinkFieldProps) {
  const target = (getOptions ? getOptions(props.doc) : (props.doc?.[String(props.df.options ?? "")] as string | undefined)) || "";
  return <FrappeLinkField {...props} options={target} />;
}
