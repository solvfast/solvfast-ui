/**
 * Fuzzy matching as Frappe Desk's awesome bar does it — a port of frappe/public/js/frappe/ui/toolbar/fuzzy_match.js
 * (v15.110; Forrest Smith's public-domain algorithm, FM:17-180) and of `frappe.search.utils.fuzzy_search` (SU:579-620).
 * Pure TypeScript (no React); it lives in the Frappe layer because it is Desk's ranking.
 */

const SEQUENTIAL_BONUS = 25; // FM:17
const SEPARATOR_BONUS = 30; // FM:18
const CAMEL_BONUS = 30; // FM:19
const FIRST_LETTER_BONUS = 15; // FM:20
const LEADING_LETTER_PENALTY = -5; // FM:22
const MAX_LEADING_LETTER_PENALTY = -15; // FM:23
const UNMATCHED_LETTER_PENALTY = -1; // FM:24
const RECURSION_LIMIT = 10; // FM:35
const MAX_MATCHES = 256; // FM:36

type Out = [boolean, number, number[]];

function recurse(pattern: string, str: string, pi: number, si: number, src: number[] | null, matchesIn: number[], next: number, count: number): Out {
  let matches = matchesIn;
  let score = 0;
  if (++count >= RECURSION_LIMIT) return [false, score, matches]; // FM:67
  if (pi === pattern.length || si === str.length) return [false, score, matches]; // FM:72
  let recursiveMatch = false;
  let bestMatches: number[] = [];
  let bestScore = 0;
  let first = true;
  while (pi < pattern.length && si < str.length) {
    if (pattern[pi].toLowerCase() === str[si].toLowerCase()) { // FM:85
      if (next >= MAX_MATCHES) return [false, score, matches];
      if (first && src) { matches = [...src]; first = false; }
      const [m, rs, rm] = recurse(pattern, str, pi, si + 1, matches, [], next, count);
      if (m) {
        if (!recursiveMatch || rs > bestScore) { bestMatches = [...rm]; bestScore = rs; }
        recursiveMatch = true;
      }
      matches[next++] = si;
      ++pi;
    }
    ++si;
  }
  const matched = pi === pattern.length;
  if (!matched) return [false, score, matches];
  score = 100; // FM:126
  let penalty = LEADING_LETTER_PENALTY * matches[0];
  if (penalty < MAX_LEADING_LETTER_PENALTY) penalty = MAX_LEADING_LETTER_PENALTY;
  score += penalty;
  score += UNMATCHED_LETTER_PENALTY * (str.length - next); // FM:134-135
  for (let i = 0; i < next; i++) {
    const cur = matches[i];
    if (i > 0 && cur === matches[i - 1] + 1) score += SEQUENTIAL_BONUS;
    if (cur > 0) {
      const nb = str[cur - 1];
      const c = str[cur];
      if (nb !== nb.toUpperCase() && c !== c.toLowerCase()) score += CAMEL_BONUS; // FM:153
      if (nb === "_" || nb === " ") score += SEPARATOR_BONUS; // FM:156-158
    } else score += FIRST_LETTER_BONUS; // FM:162
  }
  if (recursiveMatch && bestScore > score) return [true, bestScore, [...bestMatches]]; // FM:167-171
  return [true, score, matches];
}

/** `fuzzy_match(pattern, str)` (FM:33-50): `[matched, score, matchIndices]`. An empty pattern never matches. */
export function fuzzyMatch(pattern: string, str: string): Out {
  return recurse(pattern, str, 0, 0, null, [], 0, 0);
}

export interface FuzzyHit {
  /** 0 = no match (SU:587-592). */
  score: number;
  /** Indices of `text` to mark — the runs Desk wraps in `<mark>` (SU:594-619). */
  marks: number[];
}

/** `frappe.search.utils.fuzzy_search(keywords, item, true)` (SU:579-620) on an already-translated `text`. */
export function fuzzySearch(keywords: string, text: string): FuzzyHit {
  const [, score, matches] = fuzzyMatch(keywords ?? "", text ?? "");
  return score ? { score, marks: [...new Set(matches)].sort((a, b) => a - b) } : { score: 0, marks: [] };
}

/**
 * Fill a "{0}" template with a marked value: the full text and the marks shifted to where "{0}" sits (Desk builds the
 * same label as HTML, e.g. `__("New {0}", [marked])`, SU:167). A template without "{0}" keeps the value's marks off.
 */
export function fillTemplate(template: string, value: string, marks: readonly number[] = []): { text: string; marks: number[] } {
  const at = template.indexOf("{0}");
  if (at < 0) return { text: template, marks: [] };
  return { text: template.slice(0, at) + value + template.slice(at + 3), marks: marks.map((m) => m + at) };
}
