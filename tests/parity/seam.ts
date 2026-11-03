/**
 * Seam between the A6 parity tests and the 0.4.0 implementations (which land on other branches).
 *
 * HOW THE LEAD ENABLES THE TESTS
 *   1. Replace the body of each adapter below with a call to the merged implementation (the comment above each one
 *      names the export it stands for).
 *   2. In the test files change `describe.skip` to `describe` (one file at a time).
 * Until then every adapter throws `pending(...)`, so a test that is accidentally un-skipped fails loudly instead of
 * passing vacuously.
 *
 * What is CONTRACT (src/frappe/contract.ts, docs/CONTRACT-0.4.md §2): the types used here and `frappeKeys`.
 * What is PROPOSED by A6 (not in the contract; the Lead decides names/shapes): `evaluateDependsOn`, `isFieldRequired`,
 * `checkMandatory`, `classifyResponse`, `parseServerMessages`, `messagesToDisplay`, `FormatContext`, and the `roles`
 * input of `createPermissions`. They isolate pure logic so it can be tested without a DOM.
 *
 * Not a test file (no `.test.` in the name): vitest does not collect it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  DocInfo,
  DocPermissions,
  DocTypeMeta,
  FieldDisplayStatus,
  FrappeDoc,
  FrappeDocField,
  FrappeErrorInfo,
  FrappeMessage,
  MetaBundle,
} from "../../src/frappe/contract";

export const pending = (what: string): never => {
  throw new Error(`pending implementation: ${what}`);
};

// ---- real metadata fixtures (tests/fixtures/real-15.110, captured read-only from the CRM site) ----------------------

export function loadBundle(file: string): MetaBundle {
  const raw = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "real-15.110", file), "utf8")) as {
    docs: DocTypeMeta[];
  };
  const [meta, ...rest] = raw.docs;
  const children: Record<string, DocTypeMeta> = {};
  for (const c of rest) children[c.name] = c;
  return { doctype: meta.name, meta, children };
}

export const fieldOf = (b: MetaBundle, fieldname: string): FrappeDocField => {
  const df = b.meta.fields.find((f) => f.fieldname === fieldname);
  if (!df) throw new Error(`fixture ${b.doctype} has no field ${fieldname}`);
  return df;
};

/** A small synthetic DocType for cases the real fixtures do not contain (tables with mandatory columns, etc.). */
export function synthetic(name: string, fields: FrappeDocField[], children: Record<string, FrappeDocField[]> = {}): MetaBundle {
  const mk = (n: string, fs: FrappeDocField[], istable: 0 | 1): DocTypeMeta => ({
    name: n,
    istable,
    fields: fs.map((f, i) => ({ idx: i + 1, ...f })),
  });
  return {
    doctype: name,
    meta: mk(name, fields, 0),
    children: Object.fromEntries(Object.entries(children).map(([n, fs]) => [n, mk(n, fs, 1)])),
  };
}

// ---- adapters ---------------------------------------------------------------------------------------------------------

export interface PermissionsInput {
  bundle: MetaBundle;
  doc?: FrappeDoc;
  docinfo?: Pick<DocInfo, "permissions">;
  /** PROPOSED: how roles reach `usePermissions` is unspecified in the contract (open question 4). */
  roles: string[];
}
export interface PermissionsApi {
  levels: DocPermissions;
  can(ptype: keyof DocInfo["permissions"] & string, permlevel?: number): boolean;
  fieldStatus(df: FrappeDocField, doc: FrappeDoc, parent?: FrappeDoc): FieldDisplayStatus;
}
/** Stands for `usePermissions(bundle, doc, docinfo)` (A1), wrapped in `renderHook(...).result.current`. */
export const createPermissions = (_input: PermissionsInput): PermissionsApi => pending("A1 usePermissions");

export interface DependsCtx {
  doc: FrappeDoc;
  /** The form's document; for a top-level form `parent === doc`. In a child row `doc` is the row. */
  parent?: FrappeDoc;
  /** `fn:` needs a form (layout.js:775); without one it falls through to plain-name truthiness. */
  hasForm?: boolean;
}
/** Stands for A3's depends-on evaluator (`model/depends.ts`, brief D-23). Throws Error("Invalid depends_on expression"). */
export const evaluateDependsOn = (
  _expression: string | boolean | ((doc: FrappeDoc) => unknown),
  _ctx: DependsCtx,
): boolean => pending("A3 evaluateDependsOn");

/**
 * Stands for "is this field mandatory right now": `mandatory_depends_on` when present (its result REPLACES static
 * `reqd`, save.js:271-296), else `!!reqd`.
 */
export const isFieldRequired = (_df: FrappeDocField, _ctx: DependsCtx): boolean => pending("A3 isFieldRequired");

export interface MandatoryResult {
  ok: boolean;
  /** "Missing Fields" (save.js:239-244). */
  title: string;
  /** Plain-text lines; Desk wraps labels in <b> (`.bold()`), the package may use markup instead. */
  lines: string[];
  /** Fieldname the form scrolls to / whose tab it activates (first offender). */
  firstFieldname?: string;
}
/** Stands for A3's client-side `check_mandatory` (save.js:120-247). */
export const checkMandatory = (_bundle: MetaBundle, _doc: FrappeDoc): MandatoryResult => pending("A3 checkMandatory");

export interface ResponseLike {
  status: number;
  /** Parsed JSON body, or the raw text when the response is not JSON. */
  body?: unknown;
  contentType?: string;
}
/** Stands for A1's response → `FrappeErrorInfo` classification inside `client.ts` (`new FrappeError(...)`). */
export const classifyResponse = (_r: ResponseLike): FrappeErrorInfo => pending("A1 FrappeError classification");

/** Stands for the `_server_messages` double-JSON parser (B4 §2-3). */
export const parseServerMessages = (_raw: string | undefined): FrappeMessage[] => pending("A1 parseServerMessages");

/** Stands for the msgprint array rule (messages.js:151-172): if any item has `raiseException`, only those are shown. */
export const messagesToDisplay = (_messages: FrappeMessage[]): FrappeMessage[] => pending("A1 useFrappeMessages().show filter");

/**
 * `FormatContext` is named in CONTRACT-0.4.md §2 but NOT defined in contract.ts (open question 3). This is the shape
 * the tests assume, taken from what `frappe.format` reads: boot sysdefaults, time zones, enabled currencies, link titles.
 */
export interface FormatContext {
  sysdefaults: {
    date_format?: string; // "dd-mm-yyyy"
    time_format?: string; // "HH:mm:ss"
    number_format?: string; // "#,###.##"
    float_precision?: string | number;
    currency_precision?: string | number;
    currency?: string;
    rounding_method?: string;
    hide_currency_symbol?: "Yes" | "No";
  };
  timeZone?: { system: string; user: string };
  currencies?: Record<string, { symbol?: string; symbol_on_right?: 0 | 1; number_format?: string; fraction_units?: number }>;
  linkTitles?: Record<string, string>; // "DocType::name" -> title
}
/** Stands for `formatValue` (A1/A2, docs 12 §9). */
export const formatValue = (_value: unknown, _df: FrappeDocField, _doc?: FrappeDoc, _ctx?: FormatContext): string =>
  pending("A1 formatValue");

/** Stands for `translateLabel(bundle, text)`. */
export const translateLabel = (_bundle: MetaBundle, _text: string): string => pending("A1 translateLabel");
