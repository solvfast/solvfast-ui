/**
 * EmptyState — "nothing here yet" for a card, panel, rail section or page (P35; the CRM's `EmptyHint` and rail-card
 * empty boxes). An icon, a title, an optional description and an optional action. Generic: all text is props.
 * `ListView` keeps its own empty rows; use this anywhere else.
 */
import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "../lib/cn";
import { loc, type Localized } from "../lib/localized";
import { useLocale } from "../theme/ThemeProvider";

export interface EmptyStateProps {
  /** The main line ("No contacts yet"). A string or `{ en, ar }`. */
  title: Localized | React.ReactElement;
  /** A second, quieter line. */
  description?: Localized | React.ReactElement;
  /** A lucide-style icon component, or any node. Default: Inbox. `null` hides it. */
  icon?: React.ComponentType<{ className?: string }> | React.ReactElement | null;
  /** E.g. a `<Button size="sm">` to create the first record. */
  action?: React.ReactNode;
  /** "sm" (rail cards, text-xs) or "md" (default, panels and pages). */
  size?: "sm" | "md";
  /** "dashed" (default: dashed border, faint fill) or "plain" (no box — inside a card that already has one). */
  variant?: "dashed" | "plain";
  /** Heading level of the title when it is text (default: none, a `<p>`). */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

const text = (v: Localized | React.ReactElement | undefined, language: "en" | "ar") =>
  v == null ? null : React.isValidElement(v) ? v : loc(v as Localized, language);

export function EmptyState({ title, description, icon = Inbox, action, size = "md", variant = "dashed", headingLevel, className }: EmptyStateProps) {
  const { language } = useLocale();
  const sm = size === "sm";
  const iconEl = icon == null ? null : React.isValidElement(icon) ? (
    <span aria-hidden className="inline-flex text-muted-foreground">{icon}</span>
  ) : (
    React.createElement(icon as React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>, {
      className: cn("text-muted-foreground", sm ? "h-4 w-4" : "h-6 w-6"), "aria-hidden": true,
    })
  );
  const Title = (headingLevel ? `h${headingLevel}` : "p") as "p";
  return (
    <div
      data-sf-empty-state=""
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sm ? "gap-1.5 p-4 text-xs" : "gap-2 p-8 text-sm",
        variant === "dashed" && "rounded-lg border border-dashed border-border/60 bg-muted/20",
        className,
      )}
    >
      {iconEl}
      <Title className={cn(sm ? "text-muted-foreground" : "font-medium text-foreground")}>{text(title, language)}</Title>
      {description != null ? <p className={cn("max-w-prose text-muted-foreground", sm ? "text-[11px]" : "text-xs")}>{text(description, language)}</p> : null}
      {action ? <div className={sm ? "mt-1" : "mt-2"}>{action}</div> : null}
    </div>
  );
}
