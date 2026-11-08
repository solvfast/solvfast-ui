/**
 * LinkInput — a text box that searches as you type and stores one value (Frappe-free; FrappeLinkField wraps it).
 *
 * Desk's Link control (docs `12` §4.2) is a text input, not a button: typing searches after a debounce (500 ms by
 * default here, like Desk), the first result is highlighted, Enter / click picks a result, and leaving the box with
 * hand-typed text hands that text to the owner to validate (`onCommitText`; by default it is committed as is).
 * Focusing an empty box lists results at once. Enter refuses to pick a result whose label / value / description does
 * not contain the typed text (Desk's `input_matches_item`). A clear button and an optional open-record link.
 *
 * P36b — opt-in "select-like" behaviour for pickers over a known list (defaults unchanged):
 *  - `openOnClickWhenFilled`: a click / tap on the box opens the FULL list (search "") even when it shows a value —
 *    the shown text is selected so typing replaces it and filters; Escape restores; picking replaces the value. Enter on
 *    a closed box opens the list; Home / End move to the first / last row while the list is open and nothing is typed;
 *    a chevron shows the box opens a list (pointer toggle; keyboard users have ArrowDown / Enter / Space).
 *    P36c: Space on a filled, closed box with nothing typed opens the full list (Desk Select / native <select>);
 *    once the list is open or text is typed, Space types. Every keyboard open (Enter / ArrowDown / Space) selects the
 *    shown text, like a click, so typing replaces it (before P36c Enter / ArrowDown left the caret after the label).
 *    Arrows wrap at both ends (Awesomplete next() / previous(), as Desk's Link). No Ctrl+N / Ctrl+P bindings (cmdk's,
 *    not Desk's).
 *  - Height: the box is the DS field height (`sf-field-fill` + `h-9`, 36 px), like Input / Select / DateField.
 *  - `selectedIndicator`: the current value's row carries a check mark and `aria-selected="true"`.
 *  - `selectedValue`, `emptyText`, `searchPlaceholder`, `keepValueWhenEmptied`: see the props.
 */
import * as React from "react";
import { ArrowUpRight, ChevronDown, X } from "lucide-react";
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
  /** P36b: a click / tap on the box opens the full list even when it already shows a value (like a select). The value
   *  is kept until another row is picked; typing filters; Escape restores. Also: Enter on a closed box opens the list,
   *  so does a plain Space on a filled closed box with nothing typed (P36c; Space types once the list is open or text
   *  is typed); a keyboard open selects the shown text like a click (P36c); Home / End jump to the first / last row
   *  while nothing is typed, and a chevron is shown. Default false (Desk:
   *  only an empty box lists results on focus). */
  openOnClickWhenFilled?: boolean;
  /** P36b: mark the current value's row with a check mark and `aria-selected="true"` (the highlighted row is then
   *  announced via `aria-activedescendant` only). Default false (`aria-selected` marks the highlighted row, as Desk). */
  selectedIndicator?: boolean;
  /** P36b: the value whose row `selectedIndicator` marks, when it differs from `value` — e.g. a "None" row shown as
   *  `displayValue` while `value` is null. Default: `value`. */
  selectedValue?: string | null;
  /** P36b: text of the "no results" row. Default: the `noResults` chrome string. */
  emptyText?: React.ReactNode;
  /** P36b: placeholder while the list is open and the box is empty (e.g. "Search lifecycles…"). Default: `placeholder`. */
  searchPlaceholder?: string;
  /** P36b: an emptied box that is left (blur / Enter) restores the shown value instead of clearing it; clearing is
   *  then only the × button or a row that means "none". Default false (Desk: an emptied Link is cleared). */
  keepValueWhenEmptied?: boolean;
  /** P36d: the input's `maxlength` (Desk's Link: `df.length || 140`, data.js:229-238). Default none. */
  maxLength?: number;
  /** P36d: paste on the input (e.g. Desk's "Data Clipped" warning, data.js:19-62). */
  onPaste?: React.ClipboardEventHandler<HTMLInputElement>;
}

const contains = (hay: string | undefined, needle: string) => !!hay && hay.toLowerCase().includes(needle.toLowerCase());

export const LinkInput = React.forwardRef<HTMLInputElement, LinkInputProps>(function LinkInput(
  {
    value, displayValue, onChange, search, debounceMs = 500, onCommitText, actions, filterOptions, href, onOpenHref,
    clearable = true, busy, disabled, readOnly, invalid, placeholder, id, name, className, autoFocus, onBlur,
    openOnClickWhenFilled = false, selectedIndicator = false, selectedValue, emptyText, searchPlaceholder, keepValueWhenEmptied = false,
    maxLength, onPaste,
    ...aria
  },
  ref,
) {
  const { t } = useLocale();
  const reactId = React.useId();
  const listId = `${id ?? reactId}-list`;
  const [draft, setDraft] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(-1);
  const sugg = useSuggestions(search, debounceMs);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const setRefs = React.useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (typeof ref === "function") ref(el); else if (ref) ref.current = el;
  }, [ref]);
  const selectLike = openOnClickWhenFilled;
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
    if (!typed) { if (value && !keepValueWhenEmptied) onChange(null); return; }
    const exact = options.find((o) => o.value === typed || (o.label && o.label === typed));
    if (exact) { onChange(exact.value, exact); return; }
    if (onCommitText) onCommitText(typed); else onChange(typed);
  };

  /** P36b: the full list (search ""), the shown text selected so typing replaces it. */
  const openFull = (selectText: boolean) => {
    setDraft(null);
    sugg.query("", true);
    if (selectText) {
      const el = inputRef.current;
      if (el && el.value) { try { el.select(); } catch { /* not selectable */ } }
    }
  };

  return (
    <SuggestionList
      selectedValue={selectedIndicator ? (selectedValue !== undefined ? selectedValue : (value ?? null)) : undefined}
      emptyText={emptyText}
      scrollActiveIntoView={selectLike || selectedIndicator}
      // Escape restores the shown value (the popover's own Escape listener closes the list first in a browser)
      onEscape={selectLike ? () => setDraft(null) : undefined}
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
            ref={setRefs}
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
            maxLength={maxLength}
            onPaste={onPaste}
            placeholder={searchPlaceholder && sugg.open && editable ? searchPlaceholder : placeholder}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none focus-visible:outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
            value={text}
            onFocus={() => { if (editable && !text) sugg.query("", true); }}
            onClick={selectLike ? () => { if (editable && !sugg.open) openFull(true); } : undefined}
            onChange={(e) => { setDraft(e.target.value); sugg.query(e.target.value); }}
            onBlur={() => { sugg.close(); if (editable) commitText(); onBlur?.(); }}
            onKeyDown={(e) => {
              if (!editable) return;
              if (selectLike) {
                // an IME composition's Enter / arrows belong to the IME
                if (e.nativeEvent.isComposing) return;
                // P36c: every keyboard open (Enter / ArrowDown / Space) selects the shown text, like a click, so typing
                // replaces it and searches afresh (the SearchableSelect it replaces reopened into an empty search box);
                // before, Enter / ArrowDown left the caret after the label and typing appended to it ("Enterprise dealsSMB").
                if ((e.key === "Enter" || e.key === "ArrowDown") && !sugg.open && draft == null) { e.preventDefault(); openFull(true); return; }
                // P36c: a plain Space on a FILLED, closed box that shows the picked value (nothing typed) opens the full
                // list instead of appending a space to the label. Desk's Select (a native <select>, select.js:2) opens
                // on Space; Desk's Link also ends up opening its list on Space, but only after inserting the space and
                // searching for "<label> " (awesomplete.js:70 input → link.js:265 search_link → awesomplete.js:166/333).
                // Space types normally everywhere else: list open, text typed, empty box, a modifier held, default mode.
                if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && !sugg.open && draft == null && shownText) {
                  e.preventDefault();
                  openFull(true);
                  return;
                }
                if ((e.key === "Home" || e.key === "End") && sugg.open && !draft && count > 0) {
                  e.preventDefault();
                  setActive(e.key === "Home" ? 0 : count - 1);
                  return;
                }
              }
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
          {selectLike && !readOnly ? (
            // decorative: the box itself is the control (keyboard: ArrowDown / Enter); a pointer toggles the list
            <span
              aria-hidden
              data-link-chevron=""
              className={cn("me-1 inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground", editable && "cursor-pointer")}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!editable) return;
                if (sugg.open) { sugg.close(); setDraft(null); return; }
                inputRef.current?.focus();
                openFull(true);
              }}
            >
              <ChevronDown className="size-4 opacity-60" />
            </span>
          ) : null}
        </div>
      }
    />
  );
});
