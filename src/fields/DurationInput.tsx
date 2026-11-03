/**
 * DurationInput — a length of time in seconds (value in / value out, null when empty), edited as days / hours /
 * minutes / seconds boxes (Desk edits Duration through d/h/m/s inputs with min 0, docs `12` §7.6). `hideDays` folds
 * days into hours; `hideSeconds` hides the seconds box. Read-only text: `formatDuration` (`1d 2h 3m 4s`, `0s` empty).
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { FIELD_INVALID } from "./FieldShell";
import { normalizeDigits } from "./lib/number";
import { durationToSeconds, secondsToDuration, type DurationParts } from "./lib/time";

export interface DurationInputProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  hideDays?: boolean;
  hideSeconds?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

type Unit = keyof DurationParts;

export function DurationInput({ value, onChange, hideDays, hideSeconds, disabled, readOnly, invalid, id, className, ...aria }: DurationInputProps) {
  const { t } = useLocale();
  const parts = secondsToDuration(value, { hideDays, hideSeconds });
  const [drafts, setDrafts] = React.useState<Partial<Record<Unit, string>>>({});
  const units: { key: Unit; label: string; short: string }[] = [
    ...(hideDays ? [] : [{ key: "days" as Unit, label: t("formDays"), short: t("formUnitD") }]),
    { key: "hours", label: t("formHours"), short: t("formUnitH") },
    { key: "minutes", label: t("formMinutes"), short: t("formUnitM") },
    ...(hideSeconds ? [] : [{ key: "seconds" as Unit, label: t("formSeconds"), short: t("formUnitS") }]),
  ];

  const write = (unit: Unit, text: string) => {
    const nextDrafts = { ...drafts, [unit]: text };
    setDrafts(nextDrafts);
    const num = (u: Unit) => {
      const raw = nextDrafts[u];
      if (raw === undefined) return value == null ? 0 : parts[u];
      const n = Number(normalizeDigits(raw).trim());
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
    };
    const allEmpty = units.every((u) => (nextDrafts[u.key] ?? (value == null ? "" : String(parts[u.key]))).trim() === "");
    const next = allEmpty ? null : durationToSeconds({ days: num("days"), hours: num("hours"), minutes: num("minutes"), seconds: hideSeconds ? 0 : num("seconds") });
    if (next !== (value ?? null)) onChange(next);
  };

  return (
    <div
      id={id}
      role="group"
      {...aria}
      className={cn("flex flex-wrap items-center gap-2", className)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrafts({}); }}
    >
      {units.map((u) => (
        <label key={u.key} className={cn("sf-field-fill flex h-9 items-center rounded-md focus-within:ring-2 focus-within:ring-ring/60", invalid && FIELD_INVALID, disabled && "opacity-50")}>
          <input
            type="text"
            inputMode="numeric"
            dir="ltr"
            aria-label={u.label}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={invalid || undefined}
            className="h-full w-14 min-w-0 bg-transparent px-2 text-end text-base tabular-nums outline-none focus-visible:outline-none disabled:cursor-not-allowed md:text-sm"
            value={drafts[u.key] ?? (value == null ? "" : String(parts[u.key]))}
            onChange={(e) => { if (/^[0-9٠-٩۰-۹]*$/.test(e.target.value)) write(u.key, e.target.value); }}
          />
          <span className="pe-2 text-xs text-muted-foreground" aria-hidden>{u.short}</span>
        </label>
      ))}
    </div>
  );
}
