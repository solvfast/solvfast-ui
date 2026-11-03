/**
 * ReadOnlyValue — how a field shows when it cannot be edited (Desk's `.control-value`, docs `12` §1.2): the formatted
 * value as text, never an input. Numbers align to the end; multi-line text keeps its line breaks; a link opens the
 * record. Generic: the caller formats the value.
 */
import * as React from "react";
import { cn } from "../lib/cn";

export interface ReadOnlyValueProps {
  /** The formatted value (text or nodes). Empty → `emptyText`. */
  value?: React.ReactNode;
  emptyText?: React.ReactNode;
  align?: "start" | "end";
  multiline?: boolean;
  /** Render the value as a link. */
  href?: string;
  onLinkClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  bold?: boolean;
  id?: string;
  className?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}

const isEmpty = (v: React.ReactNode) => v == null || v === "" || v === false;

export function ReadOnlyValue({ value, emptyText = "", align = "start", multiline, href, onLinkClick, bold, id, className, ...aria }: ReadOnlyValueProps) {
  const empty = isEmpty(value);
  const content = empty ? <span className="text-muted-foreground">{emptyText}</span>
    : href ? <a href={href} onClick={onLinkClick} className="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">{value}</a>
    : value;
  return (
    <div
      id={id}
      data-sf-readonly=""
      {...aria}
      className={cn(
        "min-h-9 w-full min-w-0 break-words py-1.5 text-sm text-foreground",
        align === "end" ? "text-end tabular-nums" : "text-start",
        multiline && "whitespace-pre-wrap",
        bold && "font-semibold",
        className,
      )}
    >
      {content}
    </div>
  );
}
