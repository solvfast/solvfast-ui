/**
 * Desk's awesome-bar fuzzy ranking. The implementation moved to Core in 0.8.0-dev.9 (S-07: `src/lib/fuzzy.ts`, exported
 * from `@solvfast/ui`); this module keeps the Frappe entry's names (`fuzzyMatch`, `fuzzySearch`, `fillTemplate`,
 * `FuzzyHit`) as re-exports of the same functions.
 */
export { fuzzyMatch, fuzzySearch, fillTemplate } from "../../lib/fuzzy";
export type { FuzzyHit } from "../../lib/fuzzy";
