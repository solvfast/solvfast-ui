/**
 * FieldPreview — what a field looks like on the form, drawn on a designer's card: a text box for text, a checkbox for a
 * check, a dropdown for a choice, a drop zone for a file, a map for a location… Decorative only (`aria-hidden`, no
 * focus, no input): the card is what is selected and dragged. Frappe-free: it takes a Frappe fieldtype ("Check") or a
 * Field Library type key ("checkbox").
 */
import * as React from "react";
import {
  Bold, Calendar, ChevronDown, Clock, FileUp, Hash, Image as ImageIcon, Italic, Link2, List, MapPin, PenLine, Search,
  Star, Underline,
} from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import type { FieldDefinition } from "./fieldDefinition";

/** Frappe fieldtype → the Field Library's type key, so both vocabularies draw the same control. */
const FRAPPE_KIND: Record<string, string> = {
  Data: "text", "Small Text": "long_text", Text: "long_text", "Long Text": "long_text", "Text Editor": "rich_text",
  "HTML Editor": "rich_text", "Markdown Editor": "rich_text", Select: "dropdown", Autocomplete: "dropdown",
  "Table MultiSelect": "multi_select", Link: "record_link", "Dynamic Link": "record_link", Check: "checkbox",
  Int: "number", Float: "decimal", Currency: "currency", Percent: "percent", Duration: "duration", Date: "date",
  Datetime: "datetime", Time: "time", Color: "color", Rating: "rating", Attach: "file_upload",
  "Attach Image": "image_upload", Signature: "signature", Geolocation: "map_location", Table: "child_table",
  Phone: "phone", Barcode: "barcode", JSON: "json_data", Code: "json_data", "Read Only": "read_only",
  HTML: "html_content", Icon: "icon", Image: "image_preview",
};

/** The Field Library type key for a Frappe fieldtype or a type key (unchanged). */
export const previewKind = (type?: string): string => (type ? FRAPPE_KIND[type] ?? type : "text");

const box = "flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-border/70 bg-background/40 px-3 text-xs text-muted-foreground";

export interface FieldPreviewProps {
  /** A Frappe fieldtype or a Field Library type key. */
  type?: string;
  /** A field defined on the form: its choices, target and placeholder make the preview concrete. */
  definition?: FieldDefinition;
  className?: string;
}

export function FieldPreview({ type, definition, className }: FieldPreviewProps) {
  const { t, language } = useLocale();
  const kind = previewKind(definition?.type ?? type);
  const placeholder = definition?.placeholder;
  const choices = (definition?.choices ?? []).map((c) => (language === "ar" && c.ar ? c.ar : c.en)).filter(Boolean);
  const input = (text: string, icon?: React.ReactNode, wide = true) => (
    <div className={cn(box, !wide && "max-w-48")}>{icon}<span className="truncate">{placeholder || text}</span></div>
  );

  const body = (() => {
    switch (kind) {
      case "checkbox":
        return <CheckboxMark />;
      case "long_text":
      case "paragraph":
      case "long_form":
      case "json_data":
        return <div className={cn(box, "h-16 items-start py-2")}><span className="truncate">{placeholder || t("fpText")}</span></div>;
      case "rich_text":
      case "markdown":
      case "html_content":
        return (
          <div className="overflow-hidden rounded-md border border-border/70 bg-background/40">
            <div className="flex items-center gap-2 border-b border-border/60 px-2 py-1 text-muted-foreground">
              <Bold className="h-3 w-3" /><Italic className="h-3 w-3" /><Underline className="h-3 w-3" /><List className="h-3 w-3" />
            </div>
            <div className="h-10" />
          </div>
        );
      case "dropdown":
      case "autocomplete":
        return <div className={box}><span className="min-w-0 flex-1 truncate">{choices[0] ?? (placeholder || t("fpSelect"))}</span><ChevronDown className="h-3.5 w-3.5 shrink-0" /></div>;
      case "radio":
        return (
          <div className="space-y-1">
            {(choices.length ? choices.slice(0, 3) : [t("fpOption")]).map((c, i) => (
              <span key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/60" />{c}
              </span>
            ))}
          </div>
        );
      case "multi_select":
        return (
          <div className="flex flex-wrap gap-1.5">
            {(choices.length ? choices.slice(0, 4) : [t("fpOption")]).map((c, i) => (
              <span key={i} className="rounded-full border border-border/70 px-2.5 py-0.5 text-[11px] text-muted-foreground">{c}</span>
            ))}
          </div>
        );
      case "record_link":
      case "dynamic_link":
        return input(definition?.linkTarget ? `${t("fpSearch")} ${definition.linkTarget}…` : `${t("fpSearch")}…`, <Search className="h-3.5 w-3.5 shrink-0" />);
      case "number":
      case "decimal":
        return input("0", <Hash className="h-3.5 w-3.5 shrink-0" />, false);
      case "currency":
        return input("0.00", undefined, false);
      case "percent":
        return <div className={cn(box, "max-w-32 justify-between")}><span>{placeholder || "0"}</span><span>%</span></div>;
      case "duration":
      case "time":
        return input(kind === "time" ? "00:00" : "0h 0m", <Clock className="h-3.5 w-3.5 shrink-0" />, false);
      case "date":
      case "datetime":
        return input(kind === "date" ? t("fpDate") : t("fpDateTime"), <Calendar className="h-3.5 w-3.5 shrink-0" />, false);
      case "email":
        return input("name@example.com");
      case "phone":
        return input("+966 5x xxx xxxx");
      case "web_address":
        return input("https://", <Link2 className="h-3.5 w-3.5 shrink-0" />);
      case "color":
        return <div className={cn(box, "max-w-40")}><span className="h-4 w-4 rounded border border-border bg-primary" /><span>#512195</span></div>;
      case "rating":
        return <div className="flex gap-1 text-muted-foreground/70">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className="h-4 w-4" />)}</div>;
      case "file_upload":
      case "image_upload":
      case "icon":
      case "image_preview":
        return (
          <div className="flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border/60 py-3 text-[11px] text-muted-foreground">
            {kind === "file_upload" ? <FileUp className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            {kind === "file_upload" ? t("fpFile") : t("fpImage")}
          </div>
        );
      case "signature":
        return <div className="flex h-14 flex-col items-center justify-center rounded-md border-2 border-dashed border-border/60 text-[11px] text-muted-foreground"><PenLine className="h-4 w-4" />{t("fpSign")}</div>;
      case "map_location":
        return (
          <div className="relative h-20 overflow-hidden rounded-md border border-border/70 bg-muted/30 bg-[linear-gradient(0deg,hsl(var(--border)/0.5)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:14px_14px]">
            <MapPin className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-primary" />
          </div>
        );
      case "child_table":
        return (
          <div className="overflow-hidden rounded-md border border-border/70 text-[11px] text-muted-foreground">
            <div className="grid grid-cols-3 border-b border-border/60 bg-muted/30">{[1, 2, 3].map((n) => <span key={n} className="px-2 py-1">{t("fpColumn")} {n}</span>)}</div>
            <div className="grid grid-cols-3">{[1, 2, 3].map((n) => <span key={n} className="h-6 border-e border-border/40 last:border-e-0" />)}</div>
          </div>
        );
      case "read_only":
        return <div className={cn(box, "bg-muted/40")}>—</div>;
      default:
        return input(t("fpText"));
    }
  })();

  return <div aria-hidden className={cn("pointer-events-none select-none", className)} data-field-preview={kind}>{body}</div>;
}

/** A check field's box, drawn beside its label on the card. */
export function CheckboxMark({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-flex h-4 w-4 shrink-0 rounded-[4px] border-2 border-muted-foreground/60", className)} data-field-preview="checkbox" />;
}

