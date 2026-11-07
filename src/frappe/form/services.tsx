/**
 * What the Frappe form components need from outside: link search / validation, formatting, translation, number
 * settings, permissions hooks for Link actions. Defaults come from the foundation (FrappeProvider: `useFrappeApi`,
 * `formatValue` + `useFormatContext`, `translateLabel`); `<FrappeFormServices>` overrides any part (tests, apps that
 * route "Create a new X" or open-record links their own way).
 */
import * as React from "react";
import type { FrappeDoc, FrappeDocField, MetaBundle, SearchLinkOptions, SearchResult, ValidateLinkResult } from "../contract";
import { useFormatContext, useFrappeApi, useFrappeSettings } from "../FrappeProvider";
import { formatValue as foundationFormat, type FormatContext } from "../services/format";
import { translateLabel } from "../services/translate";
import type { EvaluatorOptions } from "./model/depends";
import { slug } from "./model/fieldtypes";

/** "Create a new X" from a Link field: the app creates the record (quick entry, a route, a dialog) and calls
 *  `setValue(name)` to write it back (Desk `_from_link`). */
export interface CreateNewRequest {
  doctype: string;
  /** Text typed so far (Desk passes it as `name_field`). */
  typed: string;
  df: FrappeDocField;
  doc?: FrappeDoc;
  setValue: (name: string) => void;
}

export interface FormServices {
  searchLink(doctype: string, txt: string, opts: SearchLinkOptions): Promise<SearchResult[]>;
  validateLink(doctype: string, value: string, fetchFields?: string[]): Promise<ValidateLinkResult>;
  /** Read-only text of a value (`frappe.format`, docs `12` §9). */
  formatValue(value: unknown, df: FrappeDocField, doc?: FrappeDoc): string;
  /** Label translation for a bundle (meta `__messages`, then the provider's dictionary). */
  translate(bundle: MetaBundle | undefined, text: string): string;
  formatContext: FormatContext;
  /** `System Settings.link_field_results_limit` (Desk default 10, clamped 1-50). */
  pageLength: number;
  /** Whether "Create a new X" is offered (Desk: `frappe.model.can_create`, link.js:323-334). Default (P35 F4): the
   *  session's `create` right on the TARGET DocType (its DocPerm rows × the session roles, read from the target's meta
   *  when the Link field is focused; the Administrator user always) — missing information denies (rule 9). Before 0.7
   *  the default was "whenever `onCreateNew` is given". An app override decides alone. */
  canCreate(doctype: string): boolean;
  /** "Create a new X": the app creates the record. Without it, FrappeForm opens `FrappeQuickEntry` for a target that is
   *  quick-entry eligible (`quickEntryFields`) and writes the new name back. */
  onCreateNew?: (req: CreateNewRequest) => void;
  /** URL of a record (Desk `/app/<slug>/<name>`); undefined hides the open button. Default (P35 F4): Desk's URL only
   *  when the session may READ the target DocType (Administrator always; no roles → hidden, rule 9). An app override
   *  decides alone. */
  linkHref(doctype: string, name: string): string | undefined;
  onOpenLink?: (doctype: string, name: string, e: React.MouseEvent) => void;
  /** Expression evaluation (D-23: interpreter by default). */
  evaluator: EvaluatorOptions;
  /** Which of `canCreate` / `linkHref` are the built-in, permission-aware defaults (false = the app overrode it). */
  builtin: { canCreate: boolean; linkHref: boolean };
  /** Set by FrappeForm / FrappeQuickEntry: opens the Quick Entry dialog for a quick-entry eligible target. */
  quickEntry?: (req: CreateNewRequest) => void;
}

const OverridesContext = React.createContext<Partial<FormServices> | null>(null);

/** Override parts of the form services for everything below. */
export function FrappeFormServices({ value, children }: { value: Partial<FormServices>; children: React.ReactNode }) {
  const outer = React.useContext(OverridesContext);
  const merged = React.useMemo(() => ({ ...outer, ...value }), [outer, value]);
  return <OverridesContext.Provider value={merged}>{children}</OverridesContext.Provider>;
}

/** Desk's record URL `/app/<slug>/<name>`. */
export const defaultLinkHref = (doctype: string, name: string) => `/app/${slug(doctype)}/${encodeURIComponent(name)}`;

const clampPage = (n: number) => Math.max(1, Math.min(50, Math.trunc(n) || 10));

export function useFormServices(): FormServices {
  const api = useFrappeApi();
  const fmt = useFormatContext();
  const { translations } = useFrappeSettings();
  const o = React.useContext(OverridesContext);
  return React.useMemo<FormServices>(() => {
    const formatContext = o?.formatContext ?? fmt;
    return {
      searchLink: o?.searchLink ?? ((dt, txt, opts) => api.searchLink(dt, txt, opts)),
      validateLink: o?.validateLink ?? ((dt, v, f) => api.validateLink(dt, v, f)),
      formatValue: o?.formatValue ?? ((v, df, doc) => foundationFormat(v, df, doc, formatContext)),
      translate: o?.translate ?? ((bundle, text) => translateLabel(bundle, text, translations)),
      formatContext,
      pageLength: clampPage(o?.pageLength ?? 10),
      // the built-in rights check needs the target's meta: FrappeLinkField applies it (`builtin`); these are the answers
      // when nothing else is known
      canCreate: o?.canCreate ?? (() => false),
      onCreateNew: o?.onCreateNew,
      linkHref: o?.linkHref ?? defaultLinkHref,
      onOpenLink: o?.onOpenLink,
      evaluator: o?.evaluator ?? {},
      builtin: { canCreate: !o?.canCreate, linkHref: !o?.linkHref },
      quickEntry: o?.quickEntry,
    };
  }, [api, fmt, translations, o]);
}
