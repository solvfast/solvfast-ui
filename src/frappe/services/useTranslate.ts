/**
 * Run 1 (B-61, G58): one translation path for the Frappe layer — Desk's `__(text, null, context)` over the provider's
 * dictionary (`FrappeProvider translations`, boot `__messages`) and the DocType's own `__messages`. Used by the list
 * (labels, Select values, the DocType's name, status words, workflow actions), the exporter and the workflow menus.
 */
import * as React from "react";
import type { MetaBundle } from "../contract";
import { useFrappeSettings } from "../FrappeProvider";
import { translateLabel, translateText } from "./translate";

export type FrappeTranslate = (text: string, context?: string | null) => string;

/** `t(text, context?)`: a label of `bundle`'s DocType (context defaults to the DocType; pass `null` for none). */
export function useFrappeTranslate(bundle?: MetaBundle | null): FrappeTranslate {
  const { translations } = useFrappeSettings();
  return React.useCallback<FrappeTranslate>((text, context) => {
    if (context === null) return translateText(text, { ...(translations ?? {}), ...(bundle?.meta.__messages ?? {}) });
    return translateLabel(bundle ?? undefined, text, translations, context);
  }, [bundle, translations]);
}
