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

/** Tags kept (re-created without attributes; `<a>` keeps a safe `href`). Any other element is unwrapped: its text and
 *  allowed descendants are kept. */
const ALLOWED_TAGS = new Set([
  "P", "BR", "DIV", "SPAN", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "UL", "OL", "LI", "H3", "BLOCKQUOTE", "CODE", "A",
]);
/** Elements dropped together with everything inside them (code, styles, embedded documents, foreign content). */
const DROPPED_WITH_CONTENT = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "noscript", "noembed", "noframes",
  "template", "svg", "math", "head", "title", "textarea", "select", "xmp", "plaintext", "base", "link", "meta",
]);
/** `href` schemes kept on links (absolute URLs only; relative links, `javascript:`, `data:`, `vbscript:` … are dropped). */
const SAFE_HREF = /^(https?:|mailto:)/i;

function inertFragment(html: string): DocumentFragment {
  const tpl = document.createElement("template"); // template content is inert: no scripts, no image loads
  tpl.innerHTML = html;
  return tpl.content;
}

function rebuild(from: ParentNode, into: Node, doc: Document) {
  for (const child of Array.from(from.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      into.appendChild(doc.createTextNode(child.nodeValue ?? ""));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue; // comments, processing instructions, CDATA
    const el = child as Element;
    if (DROPPED_WITH_CONTENT.has(el.localName.toLowerCase())) continue;
    const tag = el.namespaceURI === HTML_NS ? el.tagName.toUpperCase() : "";
    if (!ALLOWED_TAGS.has(tag)) {
      rebuild(el, into, doc); // unwrap: keep the (sanitized) content, drop the element
      continue;
    }
    const out = doc.createElement(tag.toLowerCase());
    if (tag === "A") {
      const href = (el.getAttribute("href") ?? "").trim();
      if (SAFE_HREF.test(href)) {
        out.setAttribute("href", href);
        out.setAttribute("target", "_blank");
        out.setAttribute("rel", "noopener noreferrer");
      }
    }
    rebuild(el, out, doc);
    into.appendChild(out);
  }
}

/**
 * Allowlist-sanitize an HTML string in the browser DOM. The output is rebuilt from scratch: text, the allowed tags
 * (no attributes, except an absolute http(s)/mailto `href` on `<a>`, which also gets `target="_blank"` and
 * `rel="noopener noreferrer"`). Disallowed tags are unwrapped (their text kept); script, style, iframe, object, embed,
 * SVG/MathML and similar are removed with their content. Prevents stored XSS before rendering as HTML.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  const out = document.createElement("template");
  rebuild(inertFragment(html), out.content, out.content.ownerDocument ?? document);
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
}

/** Read-only renderer for rich-text HTML (sanitized here, whatever the source). */
export function RichText({ value, className, empty }: RichTextProps) {
  if (htmlIsEmpty(value)) {
    return <div className={cn("sf-rich-text text-sm text-muted-foreground", className)}>{empty ?? "—"}</div>;
  }
  return <div className={cn("sf-rich-text text-sm", className)} dangerouslySetInnerHTML={{ __html: sanitizeHtml(value!) }} />;
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
}, handleRef) {
  const { t } = useLocale();
  const ref = React.useRef<HTMLDivElement>(null);
  // the last caret inside the editor, kept when focus moves to a toolbar control (P35 G15)
  const lastRange = React.useRef<Range | null>(null);
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
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
    onChangeRef.current(sanitizeHtml(el.innerHTML));
  }, []);
  React.useImperativeHandle(handleRef, () => ({
    focus: () => ref.current?.focus(),
    insertText: (text: string) => insertNodes(() => { const f = document.createDocumentFragment(); f.appendChild(document.createTextNode(text)); return f; }),
    insertHtml: (html: string) => insertNodes(() => inertFragment(sanitizeHtml(html))),
    getHtml: () => sanitizeHtml(ref.current?.innerHTML ?? ""),
  }), [insertNodes]);

  // Sync the external value into the DOM (sanitized), but never while the user is editing (would jump the caret).
  React.useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const next = sanitizeHtml(value ?? "");
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value, disabled]);

  if (disabled) {
    return (
      <div className={cn("sf-field-fill rounded-md px-3 py-2", className)} style={{ minHeight }}>
        <RichText value={value} empty={placeholder} />
      </div>
    );
  }

  const emit = () => onChange(sanitizeHtml(ref.current?.innerHTML ?? ""));
  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    emit();
  };

  return (
    <div className={cn("sf-field-fill rounded-md focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/60", className)}>
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
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
        onKeyUp={saveRange}
        onMouseUp={saveRange}
        onBlur={() => { saveRange(); onBlur?.(); }}
        className="sf-rich-text sf-rte-editable px-3 py-2 text-sm outline-none"
        style={{ minHeight }}
      />
    </div>
  );
});
