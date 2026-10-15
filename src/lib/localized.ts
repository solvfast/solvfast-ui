import type { Language } from "../theme/messages";

/** A string, or one string per language. */
export type Localized = string | { en: string; ar: string };
export const loc = (l: Localized | undefined, language: Language): string =>
  l == null ? "" : typeof l === "string" ? l : l[language] ?? l.en;
