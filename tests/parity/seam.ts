/**
 * Seam between the A6 parity tests and the 0.4.0 implementations.
 *
 * STATUS (0.4.0-dev.5): A1 (errors, messages, translate) is wired to the real code below. A3's behaviour engine
 * (depends_on, mandatory) is not merged: those adapters still throw `pending(...)` and their suites stay `describe.skip`.
 * When A3 lands, replace the three adapters at the bottom and flip their `describe.skip`.
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
  DocTypeMeta,
  FrappeDoc,
  FrappeDocField,
  FrappeMessage,
  MetaBundle,
} from "../../src/frappe/contract";
import { FrappeError, parseServerMessages as realParse, toFrappeError, visibleMessages } from "../../src/frappe/client";
import { translateLabel as realTranslate } from "../../src/frappe/services/translate";

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

// ---- A1: wired to the real implementation --------------------------------------------------------------------------

export interface ResponseLike {
  status: number;
  /** Parsed JSON body, or the raw text when the response is not JSON. */
  body?: unknown;
  contentType?: string;
}
/** What `fetchTransport` does with a response (client.ts:218-233): status 0 = fetch rejected; non-JSON text -> `{message}`. */
export const classifyResponse = (r: ResponseLike): FrappeError => {
  if (r.status === 0) return new FrappeError("Network error", 0);
  const data = r.body && typeof r.body === "object" ? (r.body as Record<string, unknown>) : { message: String(r.body ?? "").slice(0, 200) };
  return toFrappeError(r.status, data);
};
export const parseServerMessages = (raw: string | undefined): FrappeMessage[] => realParse(raw);
export const messagesToDisplay = (m: FrappeMessage[]): FrappeMessage[] => visibleMessages(m);
export const translateLabel = (bundle: MetaBundle, text: string): string => realTranslate(bundle, text);

// ---- A3: PENDING (behaviour engine not merged) ------------------------------------------------------------------------

export interface DependsCtx {
  doc: FrappeDoc;
  /** The form's document; for a top-level form `parent === doc`. In a child row `doc` is the row. */
  parent?: FrappeDoc;
  /** `fn:` needs a form (layout.js:775); without one it falls through to plain-name truthiness. */
  hasForm?: boolean;
}
/** Stands for A3's depends-on evaluator. Throws Error("Invalid depends_on expression"). */
export const evaluateDependsOn = (
  _expression: string | boolean | ((doc: FrappeDoc) => unknown),
  _ctx: DependsCtx,
): boolean => pending("A3 evaluateDependsOn");

/** `mandatory_depends_on` when present (its result REPLACES static `reqd`, save.js:271-296), else `!!reqd`. */
export const isFieldRequired = (_df: FrappeDocField, _ctx: DependsCtx): boolean => pending("A3 isFieldRequired");

export interface MandatoryResult {
  ok: boolean;
  title: string;
  /** Plain-text lines; Desk wraps labels in <b>. */
  lines: string[];
  firstFieldname?: string;
}
/** Stands for A3's client-side `check_mandatory` (save.js:120-247). */
export const checkMandatory = (_bundle: MetaBundle, _doc: FrappeDoc): MandatoryResult => pending("A3 checkMandatory");
