/**
 * A field as a record page reads it (FrappeFormView `sectionEdit`, a section not opened): an icon tile, the label small
 * and upper-case, the value under it, "— Not provided" when empty — the CRM reference's read view. The value is
 * FrappeField's own read rendering (`onlyInput`), so links, selects, dates and money read as everywhere else.
 */
import type * as React from "react";
import {
  AlignLeft, AtSign, Building2, Calendar, CheckSquare, Clock, Globe, Hash, Image, Layers, Link2, Paperclip, Phone, Star, Type,
  User, Wallet, type LucideIcon,
} from "lucide-react";
import { cn } from "../../lib/cn";
import type { FrappeDocField } from "../contract";

const TONES = {
  violet: "bg-primary/10 text-primary ring-primary/15",
  emerald: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/15 dark:text-emerald-400",
  sky: "bg-sky-500/10 text-sky-600 ring-sky-500/15 dark:text-sky-400",
  amber: "bg-amber-500/10 text-amber-600 ring-amber-500/15 dark:text-amber-400",
  orange: "bg-orange-500/10 text-orange-600 ring-orange-500/15 dark:text-orange-400",
} as const;

/** The icon and tone a field reads with, from its type (and, for Data and Link, what it holds). */
export function readIcon(df: Pick<FrappeDocField, "fieldtype" | "options" | "fieldname">): { Icon: LucideIcon; tone: keyof typeof TONES } {
  const opt = String(df.options ?? "").toLowerCase();
  const name = df.fieldname.toLowerCase();
  switch (df.fieldtype) {
    case "Data":
      if (opt === "email" || name.includes("email")) return { Icon: AtSign, tone: "emerald" };
      if (opt === "phone" || /phone|mobile/.test(name)) return { Icon: Phone, tone: "orange" };
      if (opt === "url" || /website|url/.test(name)) return { Icon: Globe, tone: "sky" };
      return { Icon: Type, tone: "violet" };
    case "Phone": return { Icon: Phone, tone: "orange" };
    case "Link": case "Dynamic Link":
      if (/contact|user|person/.test(opt)) return { Icon: User, tone: "violet" };
      if (/organi[sz]ation|company|customer/.test(opt)) return { Icon: Building2, tone: "sky" };
      return { Icon: Link2, tone: "sky" };
    case "Date": case "Datetime": return { Icon: Calendar, tone: "amber" };
    case "Time": case "Duration": return { Icon: Clock, tone: "amber" };
    case "Currency": return { Icon: Wallet, tone: "emerald" };
    case "Int": case "Float": case "Percent": return { Icon: Hash, tone: "violet" };
    case "Select": return { Icon: Layers, tone: "orange" };
    case "Check": return { Icon: CheckSquare, tone: "emerald" };
    case "Rating": return { Icon: Star, tone: "amber" };
    case "Attach": return { Icon: Paperclip, tone: "sky" };
    case "Attach Image": return { Icon: Image, tone: "sky" };
    case "Small Text": case "Text": case "Long Text": case "Text Editor": case "Markdown Editor": case "HTML Editor": case "Code":
      return { Icon: AlignLeft, tone: "violet" };
    default: return { Icon: Type, tone: "violet" };
  }
}

/** Long values (text, a picture) take the whole row. */
export const WIDE_READ_TYPES = new Set(["Small Text", "Text", "Long Text", "Text Editor", "Markdown Editor", "HTML Editor", "Code", "Attach Image", "Geolocation", "Signature"]);

export function ReadRow({ df, label, empty, notProvided, children }: {
  df: FrappeDocField; label: string; empty: boolean; notProvided: string; children: React.ReactNode;
}) {
  const { Icon, tone } = readIcon(df);
  return (
    <div className={cn("flex min-w-0 items-start gap-3 border-b border-border/40 py-2.5", WIDE_READ_TYPES.has(df.fieldtype) && "sm:col-span-2")}
      data-read-row={df.fieldname}>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1", TONES[tone])} aria-hidden>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="min-w-0 text-sm font-medium text-foreground [&_input]:font-medium">
          {empty ? <span className="text-muted-foreground" data-not-provided>{notProvided}</span> : children}
        </div>
      </div>
    </div>
  );
}
