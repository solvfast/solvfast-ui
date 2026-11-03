import * as React from "react";
import { Button } from "../primitives/button";
import { Skeleton } from "../primitives/skeleton";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { errorText, escapeHtml } from "./format";
import { htmlToText, sanitizeCommentHtml } from "./sanitize";
import type { MentionOption } from "./types";
import { useAsyncOptions } from "./useAsyncOptions";

export interface CommentDraft { text: string; mentions: MentionOption[] }

/** Plain text + mentions → the HTML Frappe stores (`span.mention[data-id][data-is-group]`, docs 14 A11.2). */
export function draftToHtml(draft: CommentDraft): string {
  let html = escapeHtml(draft.text).replace(/\n/g, "<br>");
  // longest labels first so "@Ann Lee" wins over "@Ann"
  for (const m of [...draft.mentions].sort((a, b) => b.label.length - a.label.length)) {
    const tag = `<span class="mention" data-id="${escapeHtml(m.id)}"${m.isGroup ? ' data-is-group="true"' : ""}>@${escapeHtml(m.label)}</span>`;
    html = html.split(`@${escapeHtml(m.label)}`).join(tag);
  }
  return html;
}

/** An existing comment’s HTML → editable text + the mentions it contains. */
export function htmlToDraft(html: string): CommentDraft {
  const mentions: MentionOption[] = [];
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<body>${sanitizeCommentHtml(html)}</body>`, "text/html");
    doc.querySelectorAll("span.mention").forEach((el) => {
      const id = el.getAttribute("data-id"); const label = (el.textContent ?? "").replace(/^@/, "");
      if (id && label) mentions.push({ id, label, isGroup: el.getAttribute("data-is-group") === "true" });
    });
  }
  return { text: htmlToText(html), mentions };
}

export interface CommentComposerLabels { placeholder?: string; submit?: string; cancel?: string; noMatches?: string; searching?: string; label?: string }

export interface CommentComposerProps {
  /** Receives HTML (mentions as spans) and the raw draft. A rejection keeps the text and shows the message. */
  onSubmit: (html: string, draft: CommentDraft) => void | Promise<unknown>;
  /** Called with the text after `@`. Omit to disable mentions. */
  searchMentions?: (query: string) => Promise<MentionOption[]>;
  /** Edit mode: existing HTML. */
  initialHtml?: string;
  /** Edit mode shows a Cancel button. */
  onCancel?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  rows?: number;
  autoFocus?: boolean;
  labels?: CommentComposerLabels;
  className?: string;
}

const MENTION_AT_END = /(?:^|\s)@([^\s@]*)$/;

/** Comment box with @mentions. Ctrl/Cmd+Enter submits; arrows / Enter / Escape drive the mention list. */
export function CommentComposer({ onSubmit, searchMentions, initialHtml, onCancel, disabled, disabledReason, rows = 3, autoFocus, labels, className }: CommentComposerProps) {
  const { t } = useLocale();
  const L = {
    placeholder: labels?.placeholder ?? t("recCommentPlaceholder"), submit: labels?.submit ?? t("recCommentSubmit"), cancel: labels?.cancel ?? t("recCancel"),
    noMatches: labels?.noMatches ?? t("recMentionNoResults"), label: labels?.label ?? t("recCommentLabel"),
  };
  const initial = React.useMemo(() => (initialHtml != null ? htmlToDraft(initialHtml) : { text: "", mentions: [] }), [initialHtml]);
  const [text, setText] = React.useState(initial.text);
  const [mentions, setMentions] = React.useState<MentionOption[]>(initial.mentions);
  const [query, setQuery] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const listId = React.useId();
  const { options, loading, error: searchError } = useAsyncOptions(searchMentions, query ?? "", query !== null && !!searchMentions, 300);
  React.useEffect(() => setActive(0), [options]);

  const change = (v: string) => {
    setText(v); setError("");
    const m = MENTION_AT_END.exec(v);
    setQuery(m && searchMentions ? m[1] : null);
  };
  const pick = (o: MentionOption) => {
    setText((v) => v.replace(/@([^\s@]*)$/, `@${o.label} `));
    setMentions((m) => (m.some((x) => x.id === o.id) ? m : [...m, o]));
    setQuery(null);
    ref.current?.focus();
  };
  const empty = text.trim() === "";
  const submit = async () => {
    if (empty || busy || disabled) return;
    setBusy(true); setError("");
    const used = mentions.filter((m) => text.includes(`@${m.label}`));
    try {
      await onSubmit(draftToHtml({ text: text.trim(), mentions: used }), { text: text.trim(), mentions: used });
      if (initialHtml == null) { setText(""); setMentions([]); }
    } catch (e) { setError(errorText(e) || "Error"); } finally { setBusy(false); }
  };
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query !== null && (options.length > 0 || loading)) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
      if ((e.key === "Enter" || e.key === "Tab") && options[active] && !e.ctrlKey && !e.metaKey) { e.preventDefault(); pick(options[active]); return; }
    }
    if (e.key === "Escape") { if (query !== null) { e.preventDefault(); setQuery(null); } else if (onCancel) onCancel(); return; }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); }
  };
  const showList = query !== null && !!searchMentions;

  return (
    <div className={cn("rounded-xl border border-border bg-card p-3", className)}>
      <div className="relative">
        <textarea
          ref={ref} value={text} rows={rows} autoFocus={autoFocus} disabled={disabled || busy} onChange={(e) => change(e.target.value)} onKeyDown={onKey}
          placeholder={L.placeholder} aria-label={L.label} title={disabled ? disabledReason : undefined}
          role={showList ? "combobox" : undefined} aria-expanded={showList || undefined} aria-controls={showList ? listId : undefined} aria-autocomplete={showList ? "list" : undefined}
          aria-activedescendant={showList && options[active] ? `${listId}-${active}` : undefined}
          className="w-full resize-y rounded-lg border border-input bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        />
        {showList ? (
          <div id={listId} role="listbox" className="absolute start-0 z-20 mt-1 max-h-48 w-60 overflow-auto rounded-lg border border-border bg-popover p-1 shadow-md">
            {loading ? <Skeleton className="h-7 w-full" /> : null}
            {!loading && searchError ? <p role="alert" className="px-2 py-1.5 text-xs text-destructive">{searchError}</p> : null}
            {!loading && !searchError && options.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">{L.noMatches}</p> : null}
            {!loading && options.map((o, i) => (
              <div key={o.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setActive(i)}
                className={cn("cursor-pointer rounded-md px-2 py-1.5 text-sm", i === active && "bg-accent")}>@{o.label}{o.isGroup ? " ·" : ""}</div>
            ))}
          </div>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-2 flex justify-end gap-2">
        {onCancel ? <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{L.cancel}</Button> : null}
        {/* Desk shows the Comment button only once there is text */}
        {!empty || onCancel ? <Button type="button" size="sm" disabled={empty || busy || disabled} onClick={() => void submit()}>{L.submit}</Button> : null}
      </div>
    </div>
  );
}
