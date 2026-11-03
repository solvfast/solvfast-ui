/**
 * TagInput — several values as removable pills, with an optional search (Frappe-free; FrappeTableMultiSelect wraps
 * it). Desk's Table MultiSelect (docs `12` §11): results hide values already chosen; after a pick the box is cleared
 * and stays focused; Backspace in the empty box removes the last value; a pill's × removes it; a duplicate or blank
 * entry is dropped silently; a value that fails validation is dropped silently. Pills can open their record.
 */
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { FIELD_INVALID, interpolate } from "./FieldShell";
import { handleListKey, mergeDuplicates, SuggestionList, useSuggestions, type SearchFn, type Suggestion, type SuggestionAction } from "./autocomplete";

export interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Suggestions for the typed text. Without it, typed text is added on Enter / comma. */
  search?: SearchFn;
  debounceMs?: number;
  /** Pill text for a value (e.g. a title). */
  getLabel?: (value: string) => string;
  /** Add hand-typed text (Enter, comma, blur). Default: true when there is no `search`. */
  allowCreate?: boolean;
  /** Returns the value to store (canonical), or null to drop it. May be async (server validation). */
  validate?: (value: string) => string | null | Promise<string | null>;
  actions?: SuggestionAction[] | ((typed: string) => SuggestionAction[]);
  itemHref?: (value: string) => string | undefined;
  onItemClick?: (value: string, e: React.MouseEvent) => void;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

export function TagInput({
  value, onChange, search, debounceMs = 300, getLabel = (v) => v, allowCreate, validate, actions, itemHref, onItemClick,
  disabled, readOnly, invalid, placeholder, id, className, ...aria
}: TagInputProps) {
  const { t } = useLocale();
  const reactId = React.useId();
  const listId = `${id ?? reactId}-list`;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [text, setText] = React.useState("");
  const [active, setActive] = React.useState(-1);
  const [busy, setBusy] = React.useState(false);
  const noSearch: SearchFn = React.useCallback(async () => [], []);
  const sugg = useSuggestions(search ?? noSearch, debounceMs);
  const canCreate = allowCreate ?? !search;
  const editable = !disabled && !readOnly;
  const latest = React.useRef(value);
  latest.current = value;

  const options = React.useMemo(() => mergeDuplicates(sugg.options).filter((o) => !value.includes(o.value)), [sugg.options, value]);
  const acts = typeof actions === "function" ? actions(text) : actions ?? [];
  const count = options.length + acts.length;
  React.useEffect(() => { setActive(options.length ? 0 : -1); }, [options]);

  const add = async (raw: string) => {
    const v = raw.trim();
    if (!v || latest.current.includes(v)) return;
    let canonical: string | null = v;
    if (validate) {
      setBusy(true);
      try { canonical = await validate(v); } catch { canonical = null; } finally { setBusy(false); }
    }
    if (!canonical || latest.current.includes(canonical)) return;
    onChange([...latest.current, canonical]);
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));
  const pick = (o: Suggestion) => { setText(""); sugg.close(); void add(o.value); inputRef.current?.focus(); };

  return (
    <SuggestionList
      open={sugg.open && editable && !!search}
      onDismiss={sugg.close}
      listId={listId}
      options={options}
      actions={acts}
      active={active}
      setActive={setActive}
      status={sugg.status}
      onPick={pick}
      onAction={(a) => { const typed = text; setText(""); sugg.close(); a.onSelect(typed); }}
      className={className}
      anchor={
        <div
          className={cn("sf-field-fill flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md px-1.5 py-1 focus-within:ring-2 focus-within:ring-ring/60", invalid && FIELD_INVALID, disabled && "opacity-50")}
          onClick={() => inputRef.current?.focus()}
        >
          {value.map((v) => {
            const label = getLabel(v);
            const href = itemHref?.(v);
            return (
              <span key={v} className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">
                {href || onItemClick ? (
                  <a href={href} onClick={(e) => onItemClick?.(v, e)} className="truncate hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">{label}</a>
                ) : <span className="truncate">{label}</span>}
                {editable && (
                  <button
                    type="button"
                    className="inline-flex size-4 items-center justify-center rounded-sm hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={interpolate(t("formRemoveItem"), { item: label })}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => { e.stopPropagation(); remove(v); }}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                )}
              </span>
            );
          })}
          {editable && (
            <input
              ref={inputRef}
              id={id}
              type="text"
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={sugg.open && !!search}
              aria-controls={listId}
              aria-activedescendant={sugg.open && active >= 0 ? `${listId}-${active}` : undefined}
              aria-invalid={invalid || undefined}
              aria-busy={busy || undefined}
              {...aria}
              placeholder={value.length ? undefined : placeholder}
              className="h-7 min-w-[6rem] flex-1 bg-transparent px-1.5 text-base outline-none focus-visible:outline-none placeholder:text-muted-foreground md:text-sm"
              value={text}
              onFocus={() => { if (search && !text) sugg.query("", true); }}
              onChange={(e) => {
                const v = e.target.value;
                if (canCreate && v.endsWith(",")) { setText(""); void add(v.slice(0, -1)); return; }
                setText(v);
                if (search) sugg.query(v);
              }}
              onBlur={() => {
                sugg.close();
                if (text.trim() && (canCreate || validate)) void add(text);
                setText("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !text && value.length) { e.preventDefault(); remove(value[value.length - 1]); return; }
                const handled = handleListKey(e, {
                  open: sugg.open && !!search, count, active, setActive,
                  onOpen: () => search && sugg.query(text, true),
                  onClose: () => sugg.close(),
                  onEnter: (i) => (i < options.length ? pick(options[i]) : (() => { const a = acts[i - options.length]; const typed = text; setText(""); sugg.close(); a.onSelect(typed); })()),
                });
                if (!handled && e.key === "Enter" && text.trim() && (canCreate || validate)) {
                  e.preventDefault();
                  const typed = text;
                  setText("");
                  void add(typed);
                }
              }}
            />
          )}
        </div>
      }
    />
  );
}
