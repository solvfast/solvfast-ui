/**
 * Run 1 (D-28): edit an existing comment WITHOUT losing it. Desk edits a comment in its rich comment control
 * (form_timeline.js:607-675, controls/comment.js): formatting, links, images and mentions survive the edit. The
 * package's plain `CommentComposer` turned the HTML into text (`htmlToDraft`) and back into escaped HTML, silently
 * dropping all of that. This editor is the package's `RichTextEditor` with the "desk" sanitizer profile (C-29 — it keeps
 * `span.mention[data-id][data-is-group]`, images, links, lists, colours …) plus Desk's @mention picker.
 * Ctrl/⌘+Enter saves, Escape cancels (or closes the mention list first). An image-only comment can be saved.
 * Writing a NEW comment stays the plain `CommentComposer` (rich authoring is D-26, not in this change).
 */
import * as React from "react";
import { Button } from "../primitives/button";
import { Popover, PopoverAnchor, PopoverContent } from "../primitives/popover";
import { Skeleton } from "../primitives/skeleton";
import { RichTextEditor, htmlIsEmpty, sanitizeHtml, type RichTextEditorHandle } from "../primitives/rich-text-editor";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, escapeHtml } from "./format";
import type { MentionOption } from "./types";
import type { CommentComposerLabels } from "./CommentComposer";
import { useAsyncOptions } from "./useAsyncOptions";

export interface CommentRichEditorProps {
  /** The comment's stored HTML. */
  initialHtml: string;
  /** Receives the edited HTML (sanitized, "desk" profile). A rejection keeps the editor open with the message. */
  onSubmit: (html: string) => void | Promise<unknown>;
  onCancel: () => void;
  /** Called with the text after `@`. Omit to disable new mentions (existing ones are kept either way). */
  searchMentions?: (query: string) => Promise<MentionOption[]>;
  labels?: CommentComposerLabels;
  autoFocus?: boolean;
  className?: string;
}

const MENTION_AT_END = /(?:^|\s)@([^\s@]*)$/;

/** The mention markup Frappe stores (docs 14 A11.2) — the same as `draftToHtml`. */
const mentionHtml = (o: MentionOption) =>
  `<span class="mention" data-id="${escapeHtml(o.id)}"${o.isGroup ? ' data-is-group="true"' : ""}>@${escapeHtml(o.label)}</span> `;

export function CommentRichEditor({ initialHtml, onSubmit, onCancel, searchMentions, labels, autoFocus, className }: CommentRichEditorProps) {
  const { t } = useLocale();
  const L = { submit: labels?.submit ?? t("recCommentSubmit"), cancel: labels?.cancel ?? t("recCancel"), noMatches: labels?.noMatches ?? t("recMentionNoResults"), label: labels?.label ?? t("recCommentLabel") };
  const initial = React.useMemo(() => sanitizeHtml(initialHtml, "desk"), [initialHtml]);
  const [html, setHtml] = React.useState(initial);
  const [query, setQuery] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const editor = React.useRef<RichTextEditorHandle>(null);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const { options, loading, error: searchError } = useAsyncOptions(searchMentions, query ?? "", query !== null && !!searchMentions, 300);
  React.useEffect(() => setActive(0), [options]);
  React.useEffect(() => { if (autoFocus) editor.current?.focus(); }, [autoFocus]);

  const empty = htmlIsEmpty(html);
  const submit = async () => {
    if (empty || busy) return;
    setBusy(true); setError("");
    try { await onSubmit(editor.current?.getHtml() ?? html); } catch (e) { setError(errorText(e) || "Error"); } finally { setBusy(false); }
  };
  const pick = (o: MentionOption) => {
    editor.current?.replaceBeforeCaret((query ?? "").length + 1, mentionHtml(o));
    setQuery(null);
  };
  const onInputCaret = () => {
    if (!searchMentions) return;
    const sel = window.getSelection();
    const node = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
    if (!node || node.nodeType !== Node.TEXT_NODE) { setQuery(null); return; }
    const before = (node.nodeValue ?? "").slice(0, sel!.getRangeAt(0).startOffset);
    const m = MENTION_AT_END.exec(before);
    setQuery(m ? m[1]! : null);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (query !== null && (options.length > 0 || loading)) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
      if ((e.key === "Enter" || e.key === "Tab") && options[active] && !e.ctrlKey && !e.metaKey) { e.preventDefault(); pick(options[active]!); return; }
    }
    if (e.key === "Escape") { e.preventDefault(); if (query !== null) setQuery(null); else onCancel(); return; }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); }
  };
  const showList = query !== null && !!searchMentions;

  return (
    <div className={cn("rounded-xl border border-border bg-card p-3", className)} data-comment-editor="rich">
      <Popover open={showList} onOpenChange={(o) => { if (!o) setQuery(null); }}>
        <PopoverAnchor asChild>
          <div ref={anchorRef}>
            <RichTextEditor
              ref={editor} value={html} onChange={(h) => { setHtml(h); setError(""); }} profile="desk" ariaLabel={L.label}
              disabled={busy} onKeyDown={onKeyDown} onInputCaret={onInputCaret} minHeight="4rem"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start" className="w-60 p-1"
          onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => { if (anchorRef.current?.contains(e.target as Node)) e.preventDefault(); }}
        >
          <div id={listId} role="listbox" className="max-h-48 overflow-y-auto">
            {loading ? <Skeleton className="h-7 w-full" /> : null}
            {!loading && searchError ? <p role="alert" className="px-2 py-1.5 text-xs text-destructive">{searchError}</p> : null}
            {!loading && !searchError && options.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">{L.noMatches}</p> : null}
            {!loading && options.map((o, i) => (
              <div key={o.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}
                className={cn("cursor-pointer rounded-md px-2 py-1.5 text-sm", i === active && "bg-accent text-accent-foreground")}>@{o.label}{o.isGroup ? " ·" : ""}</div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{L.cancel}</Button>
        <Button type="button" size="sm" disabled={empty || busy} onClick={() => void submit()}>{L.submit}</Button>
      </div>
    </div>
  );
}
