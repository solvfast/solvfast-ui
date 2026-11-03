/**
 * LinkInput — a text box that searches as you type and stores one value (Frappe-free; FrappeLinkField wraps it).
 *
 * Desk's Link control (docs `12` §4.2) is a text input, not a button: typing searches after a debounce (500 ms by
 * default here, like Desk), the first result is highlighted, Enter / click picks a result, and leaving the box with
 * hand-typed text hands that text to the owner to validate (`onCommitText`; by default it is committed as is).
 * Focusing an empty box lists results at once. Enter refuses to pick a result whose label / value / description does
 * not contain the typed text (Desk's `input_matches_item`). A clear button and an optional open-record link.
 */
import * as React from "react";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { FIELD_INVALID, interpolate } from "./FieldShell";
import { handleListKey, mergeDuplicates, SuggestionList, useSuggestions, type SearchFn, type Suggestion, type SuggestionAction } from "./autocomplete";

export interface LinkInputProps {
  value: string | null | undefined;
  /** Text shown for the value (e.g. a title); default: the value. */
  displayValue?: string | null;
  onChange: (value: string | null, picked?: Suggestion) => void;
  search: SearchFn;
  debounceMs?: number;
  /** Hand-typed text on blur / Enter (when it differs from what is shown). Default: `onChange(text)`. */
  onCommitText?: (text: string) => void;
  /** Rows after the results; a function receives the typed text. */
  actions?: SuggestionAction[] | ((typed: string) => SuggestionAction[]);
  /** Narrow the results client-side (e.g. hide values already chosen). */
  filterOptions?: (options: Suggestion[]) => Suggestion[];
  /** Link to open the chosen record. */
  href?: string;
  onOpenHref?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  clearable?: boolean;
  /** A check is running (e.g. server validation): aria-busy, no new input lost. */
  busy?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  className?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  onBlur?: () => void;
}

const contains = (hay: string | undefined, needle: string) => !!hay && hay.toLowerCase().includes(needle.toLowerCase());

export const LinkInput = React.forwardRef<HTMLInputElement, LinkInputProps>(function LinkInput(
  {
    value, displayValue, onChange, search, debounceMs = 500, onCommitText, actions, filterOptions, href, onOpenHref,
    clearable = true, busy, disabled, readOnly, invalid, placeholder, id, name, className, autoFocus, onBlur, ...aria
  },
  ref,
) {
  const { t } = useLocale();
  const reactId = React.useId();
  const listId = `${id ?? reactId}-list`;
  const [draft, setDraft] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(-1);
  const sugg = useSuggestions(search, debounceMs);
  const shownText = displayValue || value || "";
  const text = draft ?? shownText;
  const options = React.useMemo(() => {
    const merged = mergeDuplicates(sugg.options);
    return filterOptions ? filterOptions(merged) : merged;
  }, [sugg.options, filterOptions]);
  const acts = typeof actions === "function" ? actions(draft ?? "") : actions ?? [];
  const count = options.length + acts.length;
  React.useEffect(() => { setActive(options.length ? 0 : -1); }, [options]);

  const editable = !disabled && !readOnly;
  // a re-pick of the same value still reports it: Desk re-runs Link triggers (and fetches) for an unchanged value
  const pick = (o: Suggestion) => { setDraft(null); sugg.close(); onChange(o.value, o); };
  const runAction = (a: SuggestionAction) => { const typed = draft ?? ""; setDraft(null); sugg.close(); a.onSelect(typed); };
  const commitText = () => {
    if (draft == null || draft === shownText) { setDraft(null); return; }
    const typed = draft.trim();
    setDraft(null);
    if (!typed) { if (value) onChange(null); return; }
    const exact = options.find((o) => o.value === typed || (o.label && o.label === typed));
    if (exact) { onChange(exact.value, exact); return; }
    if (onCommitText) onCommitText(typed); else onChange(typed);
  };

  return (
    <SuggestionList
      open={sugg.open && editable}
      onDismiss={sugg.close}
      listId={listId}
      options={options}
      actions={acts}
      active={active}
      setActive={setActive}
      status={sugg.status}
      onPick={pick}
      onAction={runAction}
      className={className}
      anchor={
        <div className={cn("sf-field-fill flex h-9 w-full items-center rounded-md focus-within:ring-2 focus-within:ring-ring/60", invalid && FIELD_INVALID, disabled && "opacity-50")}>
          <input
            ref={ref}
            id={id}
            name={name}
            type="text"
            role="combobox"
            autoComplete="off"
            autoFocus={autoFocus}
            aria-autocomplete="list"
            aria-expanded={sugg.open && editable}
            aria-controls={listId}
            aria-activedescendant={sugg.open && active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={invalid || undefined}
            aria-busy={busy || undefined}
            {...aria}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none focus-visible:outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
            value={text}
            onFocus={() => { if (editable && !text) sugg.query("", true); }}
            onChange={(e) => { setDraft(e.target.value); sugg.query(e.target.value); }}
            onBlur={() => { sugg.close(); if (editable) commitText(); onBlur?.(); }}
            onKeyDown={(e) => {
              if (!editable) return;
              const handled = handleListKey(e, {
                open: sugg.open, count, active, setActive,
                onOpen: () => sugg.query(draft ?? "", true),
                onClose: () => { sugg.close(); setDraft(null); },
                onEnter: (i) => {
                  if (i < options.length) {
                    const o = options[i];
                    const typed = (draft ?? "").trim();
                    if (typed && !(contains(o.value, typed) || contains(o.label, typed) || contains(o.description, typed))) { sugg.close(); commitText(); return; }
                    pick(o);
                  } else runAction(acts[i - options.length]);
                },
              });
              if (!handled && e.key === "Enter") { e.preventDefault(); sugg.close(); commitText(); }
            }}
          />
          {href && value && draft == null && (
            <a
              href={href}
              onClick={onOpenHref}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={interpolate(t("formOpenRecord"), { name: shownText })}
            >
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </a>
          )}
          {clearable && editable && (value || draft) ? (
            <button
              type="button"
              className="me-1 inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("formClear")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setDraft(null); sugg.close(); if (value) onChange(null); }}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
      }
    />
  );
});
