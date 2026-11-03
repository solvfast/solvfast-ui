/**
 * Minimal allow-list HTML sanitiser for comment bodies (Frappe stores comments as HTML; the server removes form
 * controls but the client must still not trust it). Keeps basic formatting, links, images and `span.mention`.
 */
const TAGS = new Set(["A", "B", "STRONG", "I", "EM", "U", "S", "DEL", "P", "BR", "UL", "OL", "LI", "BLOCKQUOTE", "CODE", "PRE", "SPAN", "DIV", "H1", "H2", "H3", "H4", "IMG"]);
const SAFE_URL = /^(https?:|mailto:|\/|#|data:image\/(png|jpe?g|gif|webp);)/i;

export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (!TAGS.has(child.tagName)) {
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|FORM|INPUT|BUTTON|TEXTAREA|SELECT|LINK|META|SVG)$/.test(child.tagName)) { child.remove(); continue; }
        child.replaceWith(...Array.from(child.childNodes)); // unknown wrapper: keep its text
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const n = attr.name.toLowerCase();
        const keep =
          (child.tagName === "A" && n === "href" && SAFE_URL.test(attr.value.trim())) ||
          (child.tagName === "IMG" && n === "src" && SAFE_URL.test(attr.value.trim())) ||
          (child.tagName === "IMG" && n === "alt") ||
          (child.tagName === "SPAN" && (n === "data-id" || n === "data-is-group" || (n === "class" && attr.value === "mention")));
        if (!keep) child.removeAttribute(attr.name);
      }
      if (child.tagName === "A") { child.setAttribute("rel", "noopener noreferrer"); child.setAttribute("target", "_blank"); }
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

/** Plain text of an HTML fragment (mentions kept as their `@label` text). */
export function htmlToText(html: string): string {
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(`<body>${html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n")}</body>`, "text/html");
  return (doc.body.textContent ?? "").replace(/\n+$/, "");
}
