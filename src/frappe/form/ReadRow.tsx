/**
 * A field as a record page reads it (FrappeFormView `sectionEdit`, a section not opened): an icon tile, the label small,
 * the value under it, "— Not provided" when empty — the CRM reference's read view. The value is FrappeField's own read
 * rendering (`onlyInput`), so links, selects, dates and money read as everywhere else.
 *
 * A row is a `dt` (the label, with the icon tile) and a `dd` (the value) in a `div` group: FrappeFormView puts
 * consecutive rows in one `<dl>`. The tiles take the theme's tokens (primary, success, info, warning, brand orange), so
 * they follow light / dark and the host's palette. The label is upper-case with letter-spacing in Latin scripts only —
 * never in Arabic (it would break the letters' joining).
 */
import type * as React from "react";
import {
  AlignLeft, AtSign, Building2, Calendar, CheckSquare, Clock, Globe, Hash, Image, Layers, Link2, Paperclip, Phone, Star, Type,
  User, Wallet, type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { useLocale } from "../../theme/ThemeProvider";
import type { FrappeDocField } from "../contract";

const TONES = {
  primary: "bg-primary/10 text-primary ring-primary/15",
  success: "bg-success/10 text-success ring-success/20",
  info: "bg-info/10 text-info ring-info/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  orange: "bg-brand-orange/10 text-brand-orange ring-brand-orange/20",
} as const;
export type ReadTone = keyof typeof TONES;

/** The icon and tone a field reads with, from its type (and, for Data and Link, what it holds). */
export function readIcon(df: Pick<FrappeDocField, "fieldtype" | "options" | "fieldname">): { Icon: LucideIcon; tone: ReadTone } {
  const opt = String(df.options ?? "").toLowerCase();
  const name = df.fieldname.toLowerCase();
  switch (df.fieldtype) {
    case "Data":
      if (opt === "email" || name.includes("email")) return { Icon: AtSign, tone: "success" };
      if (opt === "phone" || /phone|mobile/.test(name)) return { Icon: Phone, tone: "orange" };
      if (opt === "url" || /website|url/.test(name)) return { Icon: Globe, tone: "info" };
      return { Icon: Type, tone: "primary" };
    case "Phone": return { Icon: Phone, tone: "orange" };
    case "Link": case "Dynamic Link":
      if (/contact|user|person/.test(opt)) return { Icon: User, tone: "primary" };
      if (/organi[sz]ation|company|customer/.test(opt)) return { Icon: Building2, tone: "info" };
      return { Icon: Link2, tone: "info" };
    case "Date": case "Datetime": return { Icon: Calendar, tone: "warning" };
    case "Time": case "Duration": return { Icon: Clock, tone: "warning" };
    case "Currency": return { Icon: Wallet, tone: "success" };
    case "Int": case "Float": case "Percent": return { Icon: Hash, tone: "primary" };
    case "Select": return { Icon: Layers, tone: "orange" };
    case "Check": return { Icon: CheckSquare, tone: "success" };
    case "Rating": return { Icon: Star, tone: "warning" };
    case "Attach": return { Icon: Paperclip, tone: "info" };
    case "Attach Image": return { Icon: Image, tone: "info" };
    case "Small Text": case "Text": case "Long Text": case "Text Editor": case "Markdown Editor": case "HTML Editor": case "Code":
      return { Icon: AlignLeft, tone: "primary" };
    default: return { Icon: Type, tone: "primary" };
  }
}

/** Long values (text, a picture) take the whole row of a two-to-a-line list. */
export const WIDE_READ_TYPES = new Set(["Small Text", "Text", "Long Text", "Text Editor", "Markdown Editor", "HTML Editor", "Code", "Attach Image", "Geolocation", "Signature"]);

/** Whether a label may be set in capitals with letter-spacing: a Latin-script UI only (not Arabic, not right-to-left). */
export function latinLabels(language: string, isRTL: boolean): boolean {
  return !isRTL && !/^ar(\b|-|_)/i.test(language);
}

export function ReadRow({ df, label, empty, notProvided, children }: {
  df: FrappeDocField; label: string; empty: boolean; notProvided: string; children: React.ReactNode;
}) {
  const { language, isRTL } = useLocale();
  const { Icon, tone } = readIcon(df);
  const latin = latinLabels(language, isRTL);
  return (
    <div className={cn("relative min-w-0 border-b border-border/40 py-2.5 ps-11", WIDE_READ_TYPES.has(df.fieldtype) && "sm:col-span-2")}
      data-read-row={df.fieldname}>
      <dt className={cn("text-muted-foreground", latin ? "text-[11px] uppercase tracking-wide" : "text-xs")} data-read-label>
        <span className={cn("absolute start-0 top-2.5 flex h-8 w-8 items-center justify-center rounded-lg ring-1", TONES[tone])} data-read-tone={tone} aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        {label}
      </dt>
      <dd className="min-w-0 text-sm font-medium text-foreground [&_input]:font-medium">
        {empty ? <span className="text-muted-foreground" data-not-provided>{notProvided}</span> : children}
      </dd>
    </div>
  );
}
