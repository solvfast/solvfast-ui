/**
 * sanitizeSvg — allowlist sanitizer for stored SVG markup (P36e ftypes). Frappe stores a Barcode field's value as the SVG
 * markup JsBarcode drew (form/controls/barcode.js:14-56) and the server does NOT sanitize it (model/base_document.py:1117
 * skips Barcode in `_sanitize_content`), so whatever is in the database must be cleaned before it is put in the page.
 *
 * The markup is parsed inertly (a `<template>`: no script runs, nothing loads) and REBUILT from scratch: only the SVG
 * shape / text elements below are re-created, with only the presentation attributes below. Everything else is removed —
 * `<script>`, `<foreignObject>`, `<style>`, `<a>`, `<image>`, `<use>` pointing outside the document, event handlers
 * (`on*`), `href` / `xlink:href` (except a local `#id` on `<use>`), and `style` values that load or run anything.
 * Returns null when the markup has no `<svg>` root.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Elements re-created (in the SVG namespace). Any other element is dropped together with its content. */
const ELEMENTS = new Set([
  "svg", "g", "rect", "path", "text", "tspan", "line", "polyline", "polygon", "circle", "ellipse", "title", "desc",
  "defs", "symbol", "use",
]);

/** Attributes kept (lower-cased comparison; the original spelling, e.g. `viewBox`, is re-used). */
const ATTRIBUTES = new Set([
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "viewbox", "preserveaspectratio",
  "d", "points", "transform", "fill", "fill-opacity", "fill-rule", "clip-rule", "stroke", "stroke-width", "stroke-opacity",
  "stroke-linecap", "stroke-linejoin", "opacity", "font-family", "font-size", "font-weight", "font-style", "text-anchor",
  "dominant-baseline", "letter-spacing", "version", "xmlns", "id", "class", "style", "data-barcode-value", "dx", "dy",
]);

/** A `style` value that could load a resource or run code. */
const UNSAFE_STYLE = /url\s*\(|expression\s*\(|javascript:|vbscript:|@import|behavio(u)?r\s*:|-moz-binding|\\/i;
/** Presentation attributes that take a paint server can reference a URL (`fill="url(…)"`). */
const UNSAFE_VALUE = /url\s*\(|javascript:|vbscript:/i;

function rebuild(nodes: ArrayLike<ChildNode>, into: Element, doc: Document) {
  for (const child of Array.from(nodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      into.appendChild(doc.createTextNode(child.nodeValue ?? ""));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue; // comments, CDATA, processing instructions
    const el = child as Element;
    const name = el.localName.toLowerCase();
    if (el.namespaceURI !== SVG_NS || !ELEMENTS.has(name)) continue; // dropped with its content
    const out = doc.createElementNS(SVG_NS, el.localName);
    for (const attr of Array.from(el.attributes)) {
      const an = attr.name.toLowerCase();
      if (an === "href" || an === "xlink:href") {
        if (name === "use" && /^#[A-Za-z0-9_-]+$/.test(attr.value.trim())) out.setAttribute("href", attr.value.trim());
        continue;
      }
      if (!ATTRIBUTES.has(an)) continue;
      if (an === "style" ? UNSAFE_STYLE.test(attr.value) : UNSAFE_VALUE.test(attr.value)) continue;
      out.setAttribute(attr.name, attr.value);
    }
    rebuild(el.childNodes, out, doc);
    into.appendChild(out);
  }
}

export function sanitizeSvg(markup: string | null | undefined): string | null {
  if (!markup || typeof markup !== "string") return null;
  const tpl = document.createElement("template"); // inert parse: no scripts, no loads
  tpl.innerHTML = markup;
  const root = Array.from(tpl.content.children).find((c) => c.namespaceURI === SVG_NS && c.localName.toLowerCase() === "svg");
  if (!root) return null;
  const holder = document.createElement("div");
  const doc = holder.ownerDocument ?? document;
  const wrap = doc.createElementNS(SVG_NS, "g"); // temporary parent; the rebuilt <svg> is taken out of it
  rebuild([root], wrap, doc);
  const svg = wrap.firstElementChild;
  if (!svg) return null;
  holder.appendChild(svg);
  return holder.innerHTML;
}
