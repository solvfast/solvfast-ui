import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Strikethrough } from "lucide-react";
import { cn } from "@/lib/utils";

/* Tags + (per-tag) attributes we keep when sanitizing stored HTML. Everything else is unwrapped/stripped. */
const ALLOWED_TAGS = new Set([
  "P", "BR", "DIV", "SPAN", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "UL", "OL", "LI", "H3", "BLOCKQUOTE", "CODE", "A",
]);

/**
 * Whitelist-sanitize an HTML string in the browser DOM. Disallowed tags are unwrapped (their text kept),
 * all attributes are dropped except a safe `href` on `<a>`. Prevents stored-XSS before dangerouslySetInnerHTML.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.parentNode?.removeChild(child);
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      if (!ALLOWED_TAGS.has(el.tagName)) {
        // Unwrap: replace the disallowed element with its children, then keep walking the parent.
        const parent = el.parentNode;
        while (el.firstChild) parent?.insertBefore(el.firstChild, el);
        parent?.removeChild(el);
        return;
      }
      Array.from(el.attributes).forEach((attr) => {
        const keepHref = el.tagName === "A" && attr.name === "href" && /^(https?:|mailto:)/i.test(attr.value.trim());
        if (!keepHref) el.removeAttribute(attr.name);
      });
      if (el.tagName === "A") {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
      walk(el);
    });
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

/** True when the HTML has no visible text and no meaningful elements (so we can store `undefined`). */
export function htmlIsEmpty(html?: string | null): boolean {
  if (!html) return true;
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent ?? "").trim() === "" && !d.querySelector("img, li, hr, br");
}

/** Read-only renderer for sanitized rich-text HTML. */
export function RichText({ value, className, empty }: { value?: string | null; className?: string; empty?: React.ReactNode }) {
  if (htmlIsEmpty(value)) {
    return <div className={cn("rich-text text-sm text-muted-foreground", className)}>{empty ?? "—"}</div>;
  }
  return <div className={cn("rich-text text-sm", className)} dangerouslySetInnerHTML={{ __html: sanitizeHtml(value!) }} />;
}

type Cmd = { icon: typeof Bold; cmd: string; label: string };
const COMMANDS: Cmd[] = [
  { icon: Bold, cmd: "bold", label: "Bold" },
  { icon: Italic, cmd: "italic", label: "Italic" },
  { icon: Underline, cmd: "underline", label: "Underline" },
  { icon: Strikethrough, cmd: "strikeThrough", label: "Strikethrough" },
  { icon: List, cmd: "insertUnorderedList", label: "Bulleted list" },
  { icon: ListOrdered, cmd: "insertOrderedList", label: "Numbered list" },
];

/**
 * Lightweight rich-text editor (contenteditable + execCommand) — no extra deps. Stores sanitized HTML.
 * When `disabled`, renders the read-only <RichText> view instead of an editable surface.
 */
export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  id,
  ariaLabel,
  className,
  minHeight = "5rem",
}: {
  value?: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  className?: string;
  minHeight?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Sync external value into the DOM, but never while the user is editing (would jump the caret).
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const next = value ?? "";
    if (el.innerHTML !== next) el.innerHTML = next;
  }, [value]);

  if (disabled) {
    return (
      <div className={cn("rounded-md border border-input bg-muted/30 px-3 py-2", className)} style={{ minHeight }}>
        <RichText value={value} empty={placeholder} />
      </div>
    );
  }

  const emit = () => onChange(ref.current?.innerHTML ?? "");
  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    emit();
  };

  return (
    <div className={cn("rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1" role="toolbar" aria-label={ariaLabel}>
        {COMMANDS.map(({ icon: Icon, cmd, label }) => (
          <button
            key={cmd}
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd)}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
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
        onBlur={onBlur}
        className="rich-text rte-editable px-3 py-2 text-sm outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}
