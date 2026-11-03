/** `fmt("{0} changed {1}", a, b)` — positional placeholders for the message catalogue. */
export const fmt = (template: string, ...args: Array<string | number>): string =>
  template.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));

export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "string" ? e : "");

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** First-strong isolate (U+2068 ... U+2069): the token takes its own direction and cannot reorder the surrounding sentence. */
export const isolate = (s: string): string => (s ? `\u2068${s}\u2069` : s);

const ISOLATES = /[\u2068\u2069]/g;
/** Plain text of a string that may carry bidi isolates (aria-label, title, copy, search, exports). */
export const stripIsolates = (s: string): string => s.replace(ISOLATES, "");
