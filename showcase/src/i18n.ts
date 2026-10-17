import { useLocale } from "@ui";

/** Showcase text in both languages. */
export type L = { en: string; ar: string };
export const l = (en: string, ar: string): L => ({ en, ar });

/** `tr(text)` → the string for the current language. */
export function useTr() {
  const { language } = useLocale();
  return (text: L | string) => (typeof text === "string" ? text : text[language]);
}
