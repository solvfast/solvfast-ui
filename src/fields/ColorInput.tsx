/**
 * ColorInput — a `#RRGGBB` colour, value in / value out (null when empty). Desk (docs `12` §10): valid only when it
 * matches `^#[0-9A-F]{6}$` (case-insensitive); anything else is not stored. Typing is written on blur / Enter; the
 * swatch opens the browser's colour picker.
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { FIELD_INVALID } from "./FieldShell";

export const isHexColor = (v: string) => /^#[0-9A-F]{6}$/i.test(v);

export interface ColorInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "type"> {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Text that is not a colour: "keep" it and flag the field (default), or "clear" the value (Desk's behaviour). */
  onUnparsable?: "keep" | "clear";
  invalid?: boolean;
}

export const ColorInput = React.forwardRef<HTMLInputElement, ColorInputProps>(function ColorInput(
  { value, onChange, onUnparsable = "keep", invalid, className, disabled, readOnly, onBlur, onKeyDown, ...rest },
  ref,
) {
  const { t } = useLocale();
  const [draft, setDraft] = React.useState<string | null>(null);
  const [bad, setBad] = React.useState(false);
  const commit = (text: string) => {
    const s = text.trim();
    if (!s) { setBad(false); if (value) onChange(null); return; }
    const withHash = s.startsWith("#") ? s : `#${s}`;
    if (!isHexColor(withHash)) {
      if (onUnparsable === "clear") { setBad(false); if (value) onChange(null); } else setBad(true);
      return;
    }
    setBad(false);
    if (withHash !== value) onChange(withHash);
  };
  const isInvalid = !!invalid || bad;
  const swatch = value && isHexColor(value) ? value : undefined;
  return (
    <div className={cn("sf-field-fill flex h-9 w-full items-center gap-2 rounded-md ps-1.5 focus-within:ring-2 focus-within:ring-ring/60", isInvalid && FIELD_INVALID, disabled && "opacity-50", className)}>
      <label className={cn("relative size-6 shrink-0 overflow-hidden rounded border border-border", !disabled && !readOnly && "cursor-pointer")} style={swatch ? { backgroundColor: swatch } : undefined}>
        <span className="sr-only">{t("formPickColor")}</span>
        <input
          type="color"
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          disabled={disabled || readOnly}
          value={swatch ?? "#000000"}
          onChange={(e) => { setBad(false); setDraft(null); onChange(e.target.value.toUpperCase()); }}
        />
      </label>
      <input
        ref={ref}
        type="text"
        dir="ltr"
        autoComplete="off"
        placeholder="#RRGGBB"
        {...rest}
        disabled={disabled}
        readOnly={readOnly}
        aria-invalid={isInvalid || undefined}
        className="h-full min-w-0 flex-1 bg-transparent pe-3 text-base uppercase outline-none focus-visible:outline-none placeholder:normal-case placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
        value={draft ?? value ?? ""}
        onFocus={() => setDraft(value ?? "")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => { if (draft != null && !readOnly) commit(draft); setDraft(null); onBlur?.(e); }}
        onKeyDown={(e) => { if (e.key === "Enter" && draft != null) commit(draft); onKeyDown?.(e); }}
      />
      {bad && <span className="sr-only" role="alert">{t("formInvalidColor")}</span>}
    </div>
  );
});
