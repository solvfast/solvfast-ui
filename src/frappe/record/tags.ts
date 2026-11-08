/**
 * Form-sidebar tags (Frappe 15.110 `ui/tags.js`, `ui/tag_editor.js`, `desk/doctype/tag/tag.py`) — pure helpers + the
 * server methods.
 */

/** tag.py:34-39 `add_tag(tag, dt, dn)` — `write` on the document (update_tags, tag.py:152). */
export const ADD_TAG_METHOD = "frappe.desk.doctype.tag.tag.add_tag";
/** tag.py:52-55 `remove_tag(tag, dt, dn)` — `write` on the document. */
export const REMOVE_TAG_METHOD = "frappe.desk.doctype.tag.tag.remove_tag";
/** tag.py:65-70 `get_tags(doctype, txt)` — existing Tag names containing `txt` (Desk lower-cases it, tag_editor.js:86-95). */
export const GET_TAGS_METHOD = "frappe.desk.doctype.tag.tag.get_tags";

/**
 * docinfo `tags` ("a,b", load.py:387-395) → the pills in Desk's order: `addTags(tags.split(","))` drops blanks and
 * duplicates (tags.js:69-77) and inserts each pill right after the input (:73) — so the LAST tag is drawn first.
 */
export function docTags(tags: string | null | undefined): string[] {
  const out: string[] = [];
  for (const t of String(tags ?? "").split(",")) if (t && !out.includes(t)) out.push(t);
  return out.reverse();
}

/** `frappe.utils.xss_sanitise` (utils/common.js:281-313), applied by tags.js:35 to typed text: script blocks and
 *  alert / confirm / prompt calls removed, then < > " ' / escaped. */
export function sanitizeTag(text: string): string {
  let s = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/confirm\(.*\)|alert\(.*\)|prompt\(.*\)/gi, "");
  const map: Record<string, string> = { "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;", "/": "&#x2F;" };
  for (const [c, e] of Object.entries(map)) s = s.split(c).join(e);
  return s;
}
