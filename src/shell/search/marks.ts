/** Marked text runs (the `<mark>` runs Desk builds as HTML, search_utils.js:594-619) — Core, framework-free. */
export interface TextSegment { text: string; mark: boolean }

/** Split `text` into marked / unmarked runs (the `<mark>` runs of SU:600-619), for rendering without HTML strings. */
export function markSegments(text: string, marks?: readonly number[]): TextSegment[] {
  if (!marks?.length) return text ? [{ text, mark: false }] : [];
  const set = new Set(marks);
  const out: TextSegment[] = [];
  for (let i = 0; i < text.length; i++) {
    const mark = set.has(i);
    const last = out[out.length - 1];
    if (last && last.mark === mark) last.text += text[i];
    else out.push({ text: text[i], mark });
  }
  return out;
}
