/**
 * TimeInput — a time of day, value in / value out as `HH:mm:ss` (or `HH:mm` with `withSeconds={false}`), null when
 * empty. Typing is free (`9:30`, `930`, `9:30 pm`, Arabic digits, `ص`/`م`); the value is written on blur / Enter, never
 * per keystroke (Desk: Time writes on change, docs `12` §7.4). No time-zone conversion (Desk applies none to Time).
 * A "Now" button sets the current local time.
 */
import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { FIELD_INVALID } from "./FieldShell";
import { formatTimeText, nowTimeParts, parseTimeText, toTimeString } from "./lib/time";

export interface TimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Store and show seconds (default true: Frappe stores `HH:mm:ss`). */
  withSeconds?: boolean;
  /** Show a 12-hour clock with AM/PM (the stored value stays 24-hour). Default false. */
  hour12?: boolean;
  /** Text that is not a time: "keep" it and flag the field (default), or "clear" the value (Desk's behaviour). */
  onUnparsable?: "keep" | "clear";
  showNow?: boolean;
  invalid?: boolean;
}

export const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(function TimeInput(
  { value, onChange, withSeconds = true, hour12 = false, onUnparsable = "keep", showNow = true, invalid, className, disabled, readOnly, onBlur, onKeyDown, onFocus, ...rest },
  ref,
) {
  const { t, language } = useLocale();
  const shownOf = (v: string | null | undefined) => formatTimeText(v, { withSeconds, hour12, language });
  const [draft, setDraft] = React.useState<string | null>(null);
  const [bad, setBad] = React.useState(false);

  const commit = (text: string): string => {
    if (!text.trim()) {
      setBad(false);
      if (value) onChange(null);
      return "";
    }
    const p = parseTimeText(text);
    if (!p) {
      if (onUnparsable === "clear") { setBad(false); if (value) onChange(null); return ""; }
      setBad(true);
      return text;
    }
    setBad(false);
    const next = toTimeString(p, withSeconds);
    if (next !== value) onChange(next);
    return shownOf(next);
  };
  const isInvalid = !!invalid || bad;
  const errorId = rest.id ? `${rest.id}-error` : undefined;

  return (
    <div className={cn("sf-field-fill flex h-9 w-full items-center rounded-md focus-within:ring-2 focus-within:ring-ring/60", isInvalid && FIELD_INVALID, disabled && "opacity-50", className)}>
      <input
        ref={ref}
        type="text"
        inputMode="text"
        autoComplete="off"
        placeholder={withSeconds ? "HH:mm:ss" : "HH:mm"}
        {...rest}
        dir="ltr"
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={isInvalid || undefined}
        aria-describedby={bad && errorId ? errorId : rest["aria-describedby"]}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-start text-base tabular-nums outline-none focus-visible:outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
        value={draft ?? shownOf(value)}
        onFocus={(e) => { setDraft(shownOf(value)); onFocus?.(e); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => { if (draft != null && !readOnly) commit(draft); setDraft(null); onBlur?.(e); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft != null && !readOnly) setDraft(commit(draft));
          if (e.key === "Escape" && draft != null) { setBad(false); setDraft(shownOf(value)); }
          onKeyDown?.(e);
        }}
      />
      {showNow && !disabled && !readOnly ? (
        <button
          type="button"
          className="me-1 inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => { setBad(false); setDraft(null); onChange(toTimeString(nowTimeParts(), withSeconds)); }}
        >
          <Clock className="size-3.5" aria-hidden />
          {t("formNow")}
        </button>
      ) : (
        <Clock className="me-3 size-4 text-muted-foreground" aria-hidden />
      )}
      {bad && errorId && <span id={errorId} className="sr-only">{t("formInvalidTime")}</span>}
    </div>
  );
});
