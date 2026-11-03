/**
 * Server messages may contain HTML (`msgprint` bodies: <b>, <br>, lists, links…). Rendered as React elements from an
 * allow-list — never `dangerouslySetInnerHTML`: unknown tags keep only their text, attributes are dropped except a safe
 * `href` (http(s), mailto, or a site-relative path). Without a DOM parser (SSR) the tags are stripped.
 */
import * as React from "react";

const ALLOWED = new Set(["b", "strong", "i", "em", "u", "s", "br", "p", "div", "span", "ul", "ol", "li", "a", "code", "pre", "small", "table", "thead", "tbody", "tr", "th", "td", "hr"]);
const SAFE_HREF = /^(https?:|mailto:|\/(?!\/))/i;

export function htmlToText(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

function toNodes(node: Node, key: string): React.ReactNode {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map((c, i) => toNodes(c, `${key}.${i}`));
  if (tag === "script" || tag === "style") return null;
  if (!ALLOWED.has(tag)) return <React.Fragment key={key}>{children}</React.Fragment>;
  if (tag === "br" || tag === "hr") return React.createElement(tag, { key });
  if (tag === "a") {
    const href = el.getAttribute("href") ?? "";
    return SAFE_HREF.test(href) ? <a key={key} href={href} rel="noopener noreferrer" className="text-primary underline underline-offset-2">{children}</a> : <React.Fragment key={key}>{children}</React.Fragment>;
  }
  const cls = tag === "ul" ? "list-disc ps-5" : tag === "ol" ? "list-decimal ps-5" : tag === "pre" ? "whitespace-pre-wrap" : undefined;
  return React.createElement(tag, { key, className: cls }, ...children);
}

export function ServerHtml({ html, className }: { html: string; className?: string }) {
  const nodes = React.useMemo(() => {
    if (!/[<&]/.test(html)) return html;
    if (typeof DOMParser === "undefined") return htmlToText(html);
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstChild;
    return root ? Array.from(root.childNodes).map((c, i) => toNodes(c, String(i))) : htmlToText(html);
  }, [html]);
  return <div className={className}>{nodes}</div>;
}
