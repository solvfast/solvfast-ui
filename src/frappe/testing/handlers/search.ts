/**
 * SIMULATED handlers added by the P36 batch-2 "search" workstream. Each handler cites the Frappe 15.110 source of its
 * response shape. Request/response-shape stand-ins for tests and the Showcase — never evidence of server behaviour.
 */
import type { FixtureContext, FixtureContextHandler, FixtureStore } from "../fixtureTransport";
import type { DocTypeMeta, FrappeDoc, FrappeDocField } from "../../contract";

type Row = Record<string, unknown>;
const TABLES = new Set(["Table", "Table MultiSelect"]);
const NO_VALUE = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Heading", "Fold", "Button", "Image", "Page Break", "Table", "Table MultiSelect"]);
const truthy = (v: unknown) => v === 1 || v === true || v === "1";

/** `meta.get_global_search_fields()` (meta.py:217-223): `in_global_search` value fields, + "Name" when the DocType has
 *  `show_name_in_global_search`. */
function globalSearchFields(meta: DocTypeMeta | undefined): FrappeDocField[] {
  if (!meta) return [];
  const fields = (meta.fields ?? []).filter((f) => truthy(f.in_global_search) && !NO_VALUE.has(String(f.fieldtype)));
  if (truthy(meta.show_name_in_global_search)) fields.push({ fieldname: "name", fieldtype: "Data", label: "Name" } as FrappeDocField);
  return fields;
}

/** `get_formatted_value` (GS:347-359): "{label} : {value}", HTML stripped (Text / Text Editor whitespace collapsed). */
function formatted(value: unknown, f: FrappeDocField): string {
  let v = String(value);
  if (f.fieldtype === "Text" || f.fieldtype === "Text Editor") v = v.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).join(" ");
  return `${f.label ?? f.fieldname} : ${v.replace(/<[^>]*>/g, "")}`;
}

/** The `__global_search.content` of a document (GS:242-271): skipped when cancelled, disabled or not enabled. */
function contentOf(doc: FrappeDoc, store: FixtureStore): string {
  const meta = store.meta[doc.doctype]?.[0];
  if (!meta) return "";
  const has = (fn: string) => (meta.fields ?? []).some((f) => f.fieldname === fn);
  if (Number(doc.docstatus ?? 0) > 1 || (has("enabled") && !truthy(doc.enabled)) || truthy(doc.disabled)) return "";
  const parts = globalSearchFields(meta).filter((f) => !TABLES.has(String(f.fieldtype)) && doc[f.fieldname]).map((f) => formatted(doc[f.fieldname], f));
  for (const tf of (meta.fields ?? []).filter((f) => TABLES.has(String(f.fieldtype)))) {
    const childMeta = store.meta[String(tf.options)]?.[0];
    for (const d of (Array.isArray(doc[tf.fieldname]) ? (doc[tf.fieldname] as Row[]) : [])) {
      parts.push(...globalSearchFields(childMeta).filter((f) => d[f.fieldname]).map((f) => formatted(d[f.fieldname], f)));
    }
  }
  return parts.join(" ||| ");
}

/**
 * Global Search Settings → the searchable DocTypes in priority (`idx`) order (`get_doctypes_for_global_search`,
 * global_search_settings.py:46-51). SIMPLIFIED: when the store has no "Global Search Settings" single, every non-table,
 * non-single DocType with a global-search field (GS:35-63's `get_doctypes_with_global_search`) — a site's Settings come
 * from the `global_search_doctypes` hooks instead (hooks.py:376-393).
 */
function searchableDoctypes(store: FixtureStore): string[] {
  const settings = store.docs.get("Global Search Settings")?.get("Global Search Settings") as Row | undefined;
  const rows = settings?.allowed_in_global_search;
  if (Array.isArray(rows)) {
    return [...(rows as Row[])].sort((a, b) => Number(a.idx ?? 0) - Number(b.idx ?? 0)).map((r) => String(r.document_type ?? "")).filter(Boolean);
  }
  return Object.values(store.meta).map((m) => m[0]).filter((m) => m && !truthy(m.istable) && !truthy(m.issingle) && globalSearchFields(m).length).map((m) => m.name);
}

/** `frappe.get_user().get_can_read()` (utils/user.py:130-183, 204-208): read / write / create right or a DocShare,
 *  minus "User Cannot Search" (`read_only`) DocTypes. Without the permission engine: every DocType. */
function canRead(doctype: string, store: FixtureStore, ctx: FixtureContext): boolean {
  const meta = store.meta[doctype]?.[0];
  if (!meta) return false;
  if (truthy((meta as Row).read_only)) return false;
  const p = ctx.permissions;
  if (!p) return true;
  return (["read", "write", "create"] as const).some((pt) => p.hasPermission(doctype, pt));
}

/**
 * `MATCH(content) AGAINST('+{word}*' IN BOOLEAN MODE)` (GS:491-509; query_builder/custom.py:44-48). SIMPLIFIED (no
 * MyISAM relevance, stopwords or minimum word length): the first term is required (a whole word, or a prefix when it is
 * the only / last term), later terms are optional, the last one a prefix; rank = matched content words / content words.
 */
function rankOf(content: string, word: string): number {
  const terms = word.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;
  const words = content.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  const hit = (t: string, i: number) => words.filter((w) => (i === terms.length - 1 ? w.startsWith(t) : w === t)).length;
  const first = hit(terms[0], 0);
  if (!first) return 0;
  const total = terms.reduce((n, t, i) => n + hit(t, i), 0);
  return Math.round((total / Math.max(words.length, 1)) * 1e6) / 1e6;
}

export const searchHandlers: Record<string, FixtureContextHandler> = {
  /**
   * `frappe.utils.global_search.search(text, start=0, limit=20, doctype="")` — frappe/utils/global_search.py:465-526:
   * allowed = Global Search Settings ∩ `get_can_read()` (GS:482; DocType level only — no row-level check, as on the
   * server); [] when none is allowed or `doctype` is not (GS:483-484); for each distinct "&"-separated word (GS:486-489)
   * the rows of `doctype` (or every allowed DocType) with rank > 0, rank desc, `limit`, offset `start` when > 0
   * (GS:491-509); rows of all words concatenated (GS:511); then grouped by allowed DocType (GS:513-524 iterates a Python
   * SET — order not guaranteed on a site; Settings order here); `image` only for DocTypes with an `image_field`
   * (GS:517-520). Each row = { doctype, name, content, rank[, image] }.
   */
  "frappe.utils.global_search.search": (a, store, ctx) => {
    const text = String(a.text ?? "");
    const start = Math.max(0, parseInt(String(a.start ?? 0), 10) || 0);
    const limit = Math.max(0, parseInt(String(a.limit ?? 20), 10) || 20);
    const doctype = String(a.doctype ?? "");
    const allowed = searchableDoctypes(store).filter((dt) => canRead(dt, store, ctx));
    if (!allowed.length || (doctype && !allowed.includes(doctype))) return { message: [] };
    const results: Row[] = [];
    for (const raw of new Set(text.split("&"))) {
      const word = raw.trim();
      if (!word) continue;
      const scope = doctype ? [doctype] : allowed;
      const rows: Row[] = [];
      for (const dt of scope) {
        for (const doc of store.docs.get(dt)?.values() ?? []) {
          const content = contentOf(doc as FrappeDoc, store);
          if (!content) continue;
          const rank = rankOf(content, word);
          if (rank > 0) rows.push({ doctype: dt, name: doc.name, content, rank });
        }
      }
      rows.sort((x, y) => Number(y.rank) - Number(x.rank));
      results.push(...rows.slice(start, start + limit));
    }
    const out: Row[] = [];
    for (const dt of allowed) {
      const imageField = store.meta[dt]?.[0]?.image_field;
      for (const r of results) {
        if (r.doctype !== dt || !(Number(r.rank) > 0)) continue;
        if (imageField) {
          const v = (store.docs.get(dt)?.get(String(r.name)) as Row | undefined)?.[imageField];
          r.image = v === undefined || v === "" ? null : v;
        }
        out.push(r);
      }
    }
    return { message: out };
  },
};
