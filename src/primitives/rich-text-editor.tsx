// From Solvfast PMO frontend/src/components/ui/rich-text-editor.tsx (pristine copy + sha256 in upstream/pmo/) — see VENDORED.md.
// Same API (RichText, RichTextEditor, sanitizeHtml, htmlIsEmpty) and markup; field look from the package (sf-field-fill,
// as Input/Textarea), toolbar labels from the package messages, PMO's `.rich-text` CSS as `sf-rich-text`
// (styles/src/sf-components.css).
// SECURITY (fixed relative to PMO): PMO's sanitizer unwrapped a disallowed element but never visited the children it
// moved up, so `<font><img src=x onerror=…></font>` or `<section><a href="javascript:…">` came out intact;
// htmlIsEmpty parsed the raw value into a live <div> (an <img onerror> fires there); and the editor wrote the raw
// value into the page. Here the sanitizer REBUILDS the content from an allowlist (nothing from the input is kept
// except text and the allowed tags it re-creates), every parse is inert (<template>), and the editor only ever
// writes and emits sanitized HTML.
import * as React from "react";
import { Bold, Italic, Underline, List, ListOrdered, Strikethrough } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import type { Messages } from "../theme/messages";

const HTML_NS = "http://www.w3.org/1999/xhtml";

/**
 * What a sanitizer profile keeps. Both profiles REBUILD the content from an allowlist: nothing from the input is kept
 * except text and the allowed tags / attributes they re-create.
 *  - `"basic"` (the default; unchanged since 0.4): 18 formatting tags, NO attributes, except an absolute http(s) / mailto
 *    `href` on `<a>`.
 *  - `"desk"` (Run 1, C-29): what Desk's Text Editor (Quill 2, text_editor.js) stores and Frappe's server allowlist keeps
 *    (utils/html_utils.py) — headings, tables, images, code blocks, sub / sup, hr; inline `style` limited to a list of
 *    typography / colour / alignment / box properties (no `url()`, `expression`, escapes or positioning); `class` limited
 *    to Quill's `ql-*`, Bootstrap's `table` / `table-bordered` and `mention`; `dir`; `align`; Quill's `data-list`,
 *    `data-row`, `data-language`; the mention span's `data-id` / `data-value` / `data-denotation-char` /
 *    `data-is-group`; `img` `src` (http(s), site-relative `/…`, `data:image/png|jpeg|gif|webp`), `alt`, `width`,
 *    `height`; `td` / `th` `colspan` / `rowspan`; `<a>` `href` (http(s), mailto, tel, site-relative `/…`, `#…`).
 *    Content outside it (scripts, iframes, forms, event handlers, other attributes, `srcset`, SVG data URLs,
 *    protocol-relative `//host` URLs) is still dropped — on display and on the first edit.
 */
export type SanitizeProfile = "basic" | "desk";

const BASIC_TAGS = new Set([
  "P", "BR", "DIV", "SPAN", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "UL", "OL", "LI", "H3", "BLOCKQUOTE", "CODE", "A",
]);
const DESK_TAGS = new Set([
  ...BASIC_TAGS, "DEL", "INS", "SUB", "SUP", "SMALL", "MARK", "H1", "H2", "H4", "H5", "H6", "PRE", "HR", "IMG",
  "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD", "CAPTION", "COLGROUP", "COL",
]);
/** Elements dropped together with everything inside them (code, styles, embedded documents, foreign content). */
const DROPPED_WITH_CONTENT = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "noscript", "noembed", "noframes",
  "template", "svg", "math", "head", "title", "textarea", "select", "xmp", "plaintext", "base", "link", "meta",
]);
/** `href` schemes kept on links by "basic" (absolute URLs only). */
const SAFE_HREF = /^(https?:|mailto:)/i;
/** "desk": also tel:, site-relative paths (not protocol-relative `//`) and fragments. */
const DESK_HREF = /^(https?:|mailto:|tel:|\/(?!\/)|#)/i;
const DESK_SRC = /^(https?:|\/(?!\/)|data:image\/(png|jpeg|jpg|gif|webp);base64,)/i;
const DESK_CLASS = /^(ql-[a-z0-9-]+|table|table-bordered|mention)$/;
const DESK_STYLE_PROPS = new Set([
  "color", "background-color", "font-size", "font-family", "font-weight", "font-style", "text-align", "direction",
  "text-decoration", "text-decoration-line", "vertical-align", "line-height", "white-space", "width", "height",
  "max-width", "float", "display", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "border", "border-color", "border-style",
  "border-width", "border-collapse", "list-style-type",
]);
/** A style value is kept only when it uses these characters and none of the dangerous constructs. */
const STYLE_VALUE = /^[#\w\s.,%()'"+-]*$/;
const STYLE_DANGER = /(url|expression|image-set|element|var)\s*\(|javascript:|@import|\\/i;
const DIMENSION = /^\d{1,5}(%|px)?$/;
const CELL_SPAN = /^\d{1,3}$/;
const DATA_TOKEN = /^[\w-]{1,64}$/;

/** Remove whitespace and control characters a browser ignores inside a URL scheme (`java\tscript:`). */
const urlOf = (v: string) => v.replace(/[\u0000-\u0020\u007f-\u009f]/g, "");

function cleanStyle(style: string): string {
  const out: string[] = [];
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim().replace(/\s*!important$/i, "");
    if (!DESK_STYLE_PROPS.has(prop) || !value || STYLE_DANGER.test(value) || !STYLE_VALUE.test(value)) continue;
    out.push(`${prop}: ${value}`);
  }
  return out.join("; ");
}

/** The attributes a "desk" element keeps. */
function deskAttributes(el: Element, out: Element) {
  const tag = el.tagName.toUpperCase();
  for (const attr of Array.from(el.attributes)) {
    const n = attr.name.toLowerCase();
    const v = attr.value.trim();
    if (n === "style") {
      const css = cleanStyle(v);
      if (css) out.setAttribute("style", css);
    } else if (n === "class") {
      const keep = v.split(/\s+/).filter((c) => DESK_CLASS.test(c));
      if (keep.length) out.setAttribute("class", keep.join(" "));
    } else if (n === "dir") {
      if (/^(ltr|rtl|auto)$/i.test(v)) out.setAttribute("dir", v.toLowerCase());
    } else if (n === "align") {
      if (/^(left|right|center|justify)$/i.test(v)) out.setAttribute("align", v.toLowerCase());
    } else if (n === "data-list") {
      if (/^(bullet|ordered|checked|unchecked)$/.test(v)) out.setAttribute(n, v);
    } else if (n === "data-row" || n === "data-language") {
      if (DATA_TOKEN.test(v)) out.setAttribute(n, v);
    } else if (tag === "SPAN" && (n === "data-id" || n === "data-value")) {
      out.setAttribute(n, attr.value);
    } else if (tag === "SPAN" && n === "data-denotation-char") {
      if (v === "@" || v === "#") out.setAttribute(n, v);
    } else if (tag === "SPAN" && n === "data-is-group") {
      if (/^(true|false)$/.test(v)) out.setAttribute(n, v);
    } else if (tag === "A" && n === "href") {
      if (DESK_HREF.test(urlOf(v))) out.setAttribute("href", v);
    } else if (tag === "IMG" && n === "src") {
      if (DESK_SRC.test(urlOf(v))) out.setAttribute("src", v);
    } else if (tag === "IMG" && n === "alt") {
      out.setAttribute("alt", attr.value);
    } else if ((tag === "IMG" || tag === "TABLE" || tag === "COL" || tag === "TD" || tag === "TH") && (n === "width" || n === "height")) {
      if (DIMENSION.test(v)) out.setAttribute(n, v);
    } else if ((tag === "TD" || tag === "TH") && (n === "colspan" || n === "rowspan")) {
      if (CELL_SPAN.test(v)) out.setAttribute(n, v);
    }
  }
  if (tag === "A" && out.hasAttribute("href")) {
    out.setAttribute("target", "_blank");
    out.setAttribute("rel", "noopener noreferrer");
  }
}

function inertFragment(html: string): DocumentFragment {
  const tpl = document.createElement("template"); // template content is inert: no scripts, no image loads
  tpl.innerHTML = html;
  return tpl.content;
}

function rebuild(from: ParentNode, into: Node, doc: Document, profile: SanitizeProfile) {
  const allowed = profile === "desk" ? DESK_TAGS : BASIC_TAGS;
  for (const child of Array.from(from.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      into.appendChild(doc.createTextNode(child.nodeValue ?? ""));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue; // comments, processing instructions, CDATA
    const el = child as Element;
    if (DROPPED_WITH_CONTENT.has(el.localName.toLowerCase())) continue;
    const tag = el.namespaceURI === HTML_NS ? el.tagName.toUpperCase() : "";
    if (!allowed.has(tag)) {
      rebuild(el, into, doc, profile); // unwrap: keep the (sanitized) content, drop the element
      continue;
    }
    const out = doc.createElement(tag.toLowerCase());
    if (profile === "desk") deskAttributes(el, out);
    else if (tag === "A") {
      const href = (el.getAttribute("href") ?? "").trim();
      if (SAFE_HREF.test(href)) {
        out.setAttribute("href", href);
        out.setAttribute("target", "_blank");
        out.setAttribute("rel", "noopener noreferrer");
      }
    }
    rebuild(el, out, doc, profile);
    into.appendChild(out);
  }
}

/**
 * Allowlist-sanitize an HTML string in the browser DOM. The output is rebuilt from scratch: text and the allowed tags
 * of the profile (default `"basic"`: no attributes, except an absolute http(s)/mailto `href` on `<a>`, which also gets
 * `target="_blank"` and `rel="noopener noreferrer"`; `"desk"`: see `SanitizeProfile`). Disallowed tags are unwrapped
 * (their text kept); script, style, iframe, object, embed, SVG/MathML and similar are removed with their content.
 * Prevents stored XSS before rendering as HTML.
 */
export function sanitizeHtml(html: string, profile: SanitizeProfile = "basic"): string {
  if (!html) return "";
  const out = document.createElement("template");
  rebuild(inertFragment(html), out.content, out.content.ownerDocument ?? document, profile);
  return out.innerHTML;
}

/** True when the HTML has no visible text and no meaningful elements (so the app can store `undefined`). Parses inertly. */
export function htmlIsEmpty(html?: string | null): boolean {
  if (!html) return true;
  const d = inertFragment(html);
  return (d.textContent ?? "").trim() === "" && !d.querySelector("img, li, hr, br");
}

export interface RichTextProps {
  value?: string | null;
  className?: string;
  /** Shown when the value is empty (default "—"). */
  empty?: React.ReactNode;
  /** What the sanitizer keeps (default "basic"); "desk" for content Desk's Text Editor wrote (C-29). */
  profile?: SanitizeProfile;
}

/** Read-only renderer for rich-text HTML (sanitized here, whatever the source). */
export function RichText({ value, className, empty, profile = "basic" }: RichTextProps) {
  if (htmlIsEmpty(value)) {
    return <div className={cn("sf-rich-text text-sm text-muted-foreground", className)}>{empty ?? "—"}</div>;
  }
  return <div className={cn("sf-rich-text text-sm", className)} dangerouslySetInnerHTML={{ __html: sanitizeHtml(value!, profile) }} />;
}

type Cmd = { icon: typeof Bold; cmd: string; label: keyof Messages };
const COMMANDS: Cmd[] = [
  { icon: Bold, cmd: "bold", label: "bold" },
  { icon: Italic, cmd: "italic", label: "italic" },
  { icon: Underline, cmd: "underline", label: "underline" },
  { icon: Strikethrough, cmd: "strikeThrough", label: "strikethrough" },
  { icon: List, cmd: "insertUnorderedList", label: "bulletedList" },
  { icon: ListOrdered, cmd: "insertOrderedList", label: "numberedList" },
];

export interface RichTextEditorProps {
  value?: string;
  /** Receives sanitized HTML. */
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  /** Names the editing surface and the toolbar ("Text formatting" when omitted). */
  ariaLabel?: string;
  className?: string;
  minHeight?: string;
  /** P35 (G15): extra controls at the end of the toolbar (e.g. "Insert template", "Generate"). Use the handle (ref) to
   *  insert their result at the caret. */
  toolbarEnd?: React.ReactNode;
  /** What the editor keeps of its value and emits (default "basic"). "desk" (C-29) keeps what Desk's Text Editor stores
   *  (headings, tables, images, colours, alignment, direction, mention spans …), so editing Desk content does not strip
   *  it. The editor never emits on mount or when the value is synced in: only a user edit (or the handle) emits. */
  profile?: SanitizeProfile;
  /** Keys pressed in the editing surface, before the editor handles them (e.g. a mention list's arrows / Enter). */
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Called after every user input with the editor element (e.g. to look at the text before the caret). */
  onInputCaret?: (el: HTMLDivElement) => void;
  /** Run 1 (C-08): the editing surface is invalid (aria-invalid + the error ring), required (aria-required) and described
   *  by this element id. */
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
}

/** P35 (G15): the editor's imperative handle (`ref`). Inserted HTML is sanitized like everything the editor emits. */
export interface RichTextEditorHandle {
  focus: () => void;
  /** Insert plain text at the caret (or at the end when the editor never had a caret), then emit `onChange`. */
  insertText: (text: string) => void;
  /** Insert HTML at the caret (sanitized), then emit `onChange`. */
  insertHtml: (html: string) => void;
  /** The current content, sanitized. */
  getHtml: () => string;
  /** Replace the `count` characters before the caret (inside the caret's text node) with sanitized HTML, then emit
   *  `onChange` — e.g. "@ann" → a mention span. Does nothing without a caret in a text node. */
  replaceBeforeCaret: (count: number, html: string) => void;
}

/**
 * Lightweight rich-text editor (contenteditable + execCommand) — no extra dependencies. Emits sanitized HTML.
 * When `disabled`, renders the read-only <RichText> view instead of an editable surface.
 */
export const RichTextEditor = React.forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  id,
  ariaLabel,
  className,
  minHeight = "5rem",
  toolbarEnd,
  profile = "basic",
  onKeyDown,
  onInputCaret,
  invalid,
  required,
  describedBy,
}, handleRef) {
  const { t } = useLocale();
  const ref = React.useRef<HTMLDivElement>(null);
  // the last caret inside the editor, kept when focus moves to a toolbar control (P35 G15)
  const lastRange = React.useRef<Range | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  const profileRef = React.useRef(profile);
  profileRef.current = profile;
  const saveRange = () => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && sel.rangeCount && ref.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) lastRange.current = sel.getRangeAt(0).cloneRange();
  };
  const insertNodes = React.useCallback((make: () => DocumentFragment) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    let range = lastRange.current && el.contains(lastRange.current.commonAncestorContainer) ? lastRange.current : null;
    if (!range) { range = document.createRange(); range.selectNodeContents(el); range.collapse(false); }
    range.deleteContents();
    const frag = make();
    const last = frag.lastChild;
    range.insertNode(frag);
    if (last) {
      const after = document.createRange(); after.setStartAfter(last); after.collapse(true);
      const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(after);
      lastRange.current = after.cloneRange();
    }
    onChangeRef.current(sanitizeHtml(el.innerHTML, profileRef.current));
  }, []);
  React.useImperativeHandle(handleRef, () => ({
    focus: () => ref.current?.focus(),
    insertText: (text: string) => insertNodes(() => { const f = document.createDocumentFragment(); f.appendChild(document.createTextNode(text)); return f; }),
    insertHtml: (html: string) => insertNodes(() => inertFragment(sanitizeHtml(html, profileRef.current))),
    getHtml: () => sanitizeHtml(ref.current?.innerHTML ?? "", profileRef.current),
    replaceBeforeCaret: (count: number, html: string) => {
      const el = ref.current;
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      if (!el || !sel || !sel.rangeCount) return;
      const caret = sel.getRangeAt(0);
      const node = caret.startContainer;
      if (node.nodeType !== Node.TEXT_NODE || !el.contains(node) || caret.startOffset < count) return;
      const r = document.createRange();
      r.setStart(node, caret.startOffset - count);
      r.setEnd(node, caret.startOffset);
      lastRange.current = r;
      insertNodes(() => inertFragment(sanitizeHtml(html, profileRef.current)));
    },
  }), [insertNodes]);

  // Sync the external value into the DOM (sanitized), but never while the user is editing (would jump the caret).
  React.useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const next = sanitizeHtml(value ?? "", profile);
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value, disabled, profile]);

  if (disabled) {
    return (
      <div className={cn("sf-field-fill rounded-md px-3 py-2", className)} style={{ minHeight }}>
        <RichText value={value} empty={placeholder} profile={profile} />
      </div>
    );
  }

  const emit = () => onChange(sanitizeHtml(ref.current?.innerHTML ?? "", profile));
  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    emit();
  };

  return (
    <div className={cn("sf-field-fill rounded-md focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/60", invalid && "ring-1 ring-destructive", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1" role="toolbar" aria-label={ariaLabel ?? t("textFormatting")}>
        {COMMANDS.map(({ icon: Icon, cmd, label }) => (
          <button
            key={cmd}
            type="button"
            aria-label={t(label)}
            title={t(label)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd)}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        ))}
        {toolbarEnd != null ? <div className="ms-auto flex items-center gap-0.5" data-toolbar-end="">{toolbarEnd}</div> : null}
      </div>
      <div
        ref={ref}
        id={id}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => { emit(); if (ref.current) onInputCaret?.(ref.current); }}
        onKeyDown={onKeyDown}
        onKeyUp={saveRange}
        onMouseUp={saveRange}
        onBlur={() => { saveRange(); onBlur?.(); }}
        className="sf-rich-text sf-rte-editable px-3 py-2 text-sm outline-none"
        style={{ minHeight }}
      />
    </div>
  );
});
