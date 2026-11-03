/**
 * NumberInput — locale-aware Int / Float / Currency / Percent input. Value in / value out (`number | null`).
 *
 * Desk behaviour kept (docs `12` §2, §8): the model is written on change / blur / Enter, not per keystroke; the text
 * may be simple arithmetic (`2*3+1`, evaluated without `eval`); the user's group separators are stripped and the
 * decimal separator converted; Int truncates (`cint`), the others round to `precision` with the rounding method; the
 * shown text is the value in the number format; Int selects its text on focus. The currency symbol and `%` are NOT
 * part of the input text (Desk shows them only read-only); `prefix` / `suffix` are optional visual adornments.
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { FIELD_INPUT, FIELD_INVALID } from "./FieldShell";
import { formatLocaleNumber, parseLocaleNumber, roundNumber, toInt, type RoundingMethod } from "./lib/number";

export type NumberKind = "int" | "float" | "currency" | "percent";

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type" | "prefix" | "min" | "max"> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  kind?: NumberKind;
  /** Decimal places (Int: ignored). null/undefined: no rounding, the value's own decimals are shown. */
  precision?: number | null;
  /** A System Settings number format, e.g. "#,###.##" (default), "#.###,##", "#,##,###.##". */
  numberFormat?: string | null;
  rounding?: RoundingMethod;
  /** Accept arithmetic like Desk (default true). */
  allowExpressions?: boolean;
  /** Text that is not a number: "keep" it and flag the field (default), or "clear" the value (Desk's behaviour). */
  onUnparsable?: "keep" | "clear";
  /** Out-of-range values are kept and flagged (aria-invalid), never clamped. */
  min?: number;
  max?: number;
  invalid?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /** Select the text on focus (default: true for Int, like Desk). */
  selectOnFocus?: boolean;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value, onChange, kind = "float", precision, numberFormat, rounding, allowExpressions = true, onUnparsable = "keep",
    min, max, invalid, prefix, suffix, selectOnFocus, className, onFocus, onBlur, onKeyDown, disabled, readOnly, ...rest
  },
  ref,
) {
  const { t } = useLocale();
  const effPrecision = kind === "int" ? 0 : precision;
  const format = React.useCallback(
    (v: number | null | undefined) => formatLocaleNumber(v, { format: numberFormat, precision: effPrecision, rounding }),
    [numberFormat, effPrecision, rounding],
  );
  const [draft, setDraft] = React.useState<string | null>(null);
  const [badText, setBadText] = React.useState(false);
  const shown = draft ?? format(value);

  const commit = (text: string) => {
    if (!text.trim()) {
      setBadText(false);
      if (value != null) onChange(null);
      return format(null);
    }
    const parsed = parseLocaleNumber(text, { format: numberFormat, allowExpressions });
    if (parsed == null) {
      if (onUnparsable === "clear") {
        setBadText(false);
        if (value != null) onChange(null);
        return "";
      }
      setBadText(true);
      return text;
    }
    setBadText(false);
    const next = kind === "int" ? toInt(parsed) : roundNumber(parsed, effPrecision, rounding);
    if (next !== value) onChange(next);
    return format(next);
  };

  const outOfRange = value != null && ((min != null && value < min) || (max != null && value > max));
  const isInvalid = !!invalid || badText || outOfRange;
  const errorId = rest.id ? `${rest.id}-error` : undefined;

  const input = (
    <input
      ref={ref}
      type="text"
      inputMode={kind === "int" ? "numeric" : "decimal"}
      autoComplete="off"
      dir="ltr"
      {...rest}
      disabled={disabled}
      readOnly={readOnly}
      aria-invalid={isInvalid || undefined}
      aria-describedby={badText && errorId ? errorId : rest["aria-describedby"]}
      className={cn(FIELD_INPUT, "text-end tabular-nums", isInvalid && FIELD_INVALID, (prefix || suffix) && "border-0 bg-transparent shadow-none focus-visible:outline-none focus-visible:ring-0", !(prefix || suffix) && className)}
      value={shown}
      onFocus={(e) => {
        setDraft(format(value));
        if (selectOnFocus ?? kind === "int") {
          const el = e.currentTarget;
          requestAnimationFrame(() => el.select?.());
        }
        onFocus?.(e);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        if (draft != null && !readOnly) commit(draft);
        setDraft(null);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && draft != null && !readOnly) setDraft(commit(draft));
        if (e.key === "Escape" && draft != null) { setBadText(false); setDraft(format(value)); }
        onKeyDown?.(e);
      }}
    />
  );
  const body = prefix || suffix ? (
    <div className={cn("sf-field-fill flex h-9 w-full items-center rounded-md focus-within:ring-2 focus-within:ring-ring/60", isInvalid && FIELD_INVALID, disabled && "opacity-50", className)}>
      {prefix && <span className="ps-3 text-sm text-muted-foreground" aria-hidden>{prefix}</span>}
      {input}
      {suffix && <span className="pe-3 text-sm text-muted-foreground" aria-hidden>{suffix}</span>}
    </div>
  ) : input;
  return badText && errorId ? (
    <>
      {body}
      <span id={errorId} className="sr-only">{t("formInvalidNumber")}</span>
    </>
  ) : body;
});
