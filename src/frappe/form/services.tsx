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
  /** Whether "Create a new X" is offered (Desk: `frappe.model.can_create`). Default: when `onCreateNew` is given. */
  canCreate(doctype: string): boolean;
  onCreateNew?: (req: CreateNewRequest) => void;
  /** URL of a record (Desk `/app/<slug>/<name>`); undefined hides the open button (e.g. select-only users). */
  linkHref(doctype: string, name: string): string | undefined;
  onOpenLink?: (doctype: string, name: string, e: React.MouseEvent) => void;
  /** Expression evaluation (D-23: interpreter by default). */
  evaluator: EvaluatorOptions;
}

const OverridesContext = React.createContext<Partial<FormServices> | null>(null);

/** Override parts of the form services for everything below. */
export function FrappeFormServices({ value, children }: { value: Partial<FormServices>; children: React.ReactNode }) {
  const outer = React.useContext(OverridesContext);
  const merged = React.useMemo(() => ({ ...outer, ...value }), [outer, value]);
  return <OverridesContext.Provider value={merged}>{children}</OverridesContext.Provider>;
}

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
      canCreate: o?.canCreate ?? (() => !!o?.onCreateNew),
      onCreateNew: o?.onCreateNew,
      linkHref: o?.linkHref ?? ((dt, name) => `/app/${slug(dt)}/${encodeURIComponent(name)}`),
      onOpenLink: o?.onOpenLink,
      evaluator: o?.evaluator ?? {},
    };
  }, [api, fmt, translations, o]);
}
