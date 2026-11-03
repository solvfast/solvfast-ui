/**
 * FieldShell — label, required mark, description and error around one control. Generic (no metadata).
 * The label is bold when `bold` or `required` (Desk: `df.bold || df.reqd`, docs `12` §1.5).
 */
import * as React from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "../lib/cn";
import { Label } from "../primitives/label";

export interface FieldShellProps {
  label?: React.ReactNode;
  /** The control's id; the label targets it. */
  htmlFor?: string;
  /** Id for the label element (for controls named with aria-labelledby). */
  labelId?: string;
  required?: boolean;
  bold?: boolean;
  description?: React.ReactNode;
  /** Error text under the control (also give the control `aria-invalid`). */
  error?: React.ReactNode;
  /** Id of the error/description element, for `aria-describedby`. */
  describedById?: string;
  /** Label after the control, on one line (checkboxes). */
  inline?: boolean;
  hideLabel?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FieldShell({
  label, htmlFor, labelId, required, bold, description, error, describedById, inline, hideLabel, className, children,
}: FieldShellProps) {
  const labelEl = label != null && label !== "" ? (
    <Label id={labelId} htmlFor={htmlFor} className={cn("text-xs", (bold || required) && "font-semibold", hideLabel && "sr-only", inline && "text-sm font-normal")}>
      {label}
      {required && <span className="ms-0.5 text-destructive" aria-hidden>*</span>}
    </Label>
  ) : null;
  return (
    <div className={cn("min-w-0 space-y-1.5", className)} data-sf-field="">
      {inline ? (
        <div className="flex items-center gap-2">{children}{labelEl}</div>
      ) : (
        <>
          {labelEl}
          {children}
        </>
      )}
      {error ? (
        <p id={describedById} className="inline-flex items-center gap-1 text-xs font-medium text-destructive" role="alert">
          <CircleAlert className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : description ? (
        <p id={describedById} className="text-xs leading-snug text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

/** The input-family classes every text-like field control shares (the DS input look). */
export const FIELD_INPUT =
  "sf-field-fill flex h-9 w-full min-w-0 rounded-md px-3 py-1 text-base outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";
/** Applied with `aria-invalid`. */
export const FIELD_INVALID = "ring-1 ring-destructive focus-visible:ring-destructive";

export const interpolate = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
