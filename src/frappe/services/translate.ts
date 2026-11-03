/**
 * translateLabel — Desk's `__(text, null, context)` (translate.js): the key "<text>:<context>" first, then "<text>",
 * else the text unchanged. Desk passes the DocType as the context for field labels (`__(df.label, null, df.parent)`).
 *
 * Source of translations: Frappe 15.110's getdoctype never fills `meta.__messages` (desk/form/meta.py lists the key but
 * no code sets it — the real ar and en fixtures are identical); Desk gets its dictionary from boot. So the dictionary is
 * `meta.__messages` when present, else the app-supplied one (FrappeProvider `translations`, merged into the bundle by
 * `useMetaBundle`, or passed here directly), else none.
 */
import type { MetaBundle } from "../contract";

export type TranslationDictionary = Record<string, string>;

export function translateText(text: string, dictionary: TranslationDictionary | undefined, context?: string | null): string {
  if (!text || typeof text !== "string" || !dictionary) return text;
  return (context ? dictionary[`${text}:${context}`] : undefined) || dictionary[text] || text;
}

/** A label of `bundle`'s DocType (or one of its child tables: pass `context`) in the session language. */
export function translateLabel(bundle: MetaBundle | undefined, text: string, dictionary?: TranslationDictionary, context?: string): string {
  const own = bundle?.meta.__messages;
  const dict = own && Object.keys(own).length ? (dictionary ? { ...dictionary, ...own } : own) : dictionary;
  return translateText(text, dict, context ?? bundle?.doctype);
}

/** The bundle with an app dictionary folded in under its own `__messages` (the server's entries win). */
export function withTranslations(bundle: MetaBundle, dictionary: TranslationDictionary | undefined): MetaBundle {
  if (!dictionary || !Object.keys(dictionary).length) return bundle;
  return { ...bundle, meta: { ...bundle.meta, __messages: { ...dictionary, ...(bundle.meta.__messages ?? {}) } } };
}
