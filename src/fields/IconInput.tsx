/**
 * IconInput — an icon NAME, typed or chosen from a searchable picker (P36e ftypes). Generic: the caller gives the list
 * of names and, optionally, how to draw one (`renderIcon`); this control knows no icon set. Value in / value out: the
 * name ("" when empty).
 *
 * Native reference (Frappe 15.110 `form/controls/icon.js`, `icon_picker/icon_picker.js`):
 * - the field is a Data input (icon.js:1-6) with the placeholder "Choose an icon" (:4); typing a name stores it;
 * - beside it, the selected icon (`folder-normal` drawn when empty, never stored, :56, :94-100); clicking it opens a
 *   popover picker (:19-79) with a "Search for icons..." box (icon_picker.js:19) that filters the icons whose name
 *   contains the text (:65-73); a click or Enter / Space on an icon selects it (:40-53);
 * - read-only (formatters.js:398-405): the icon and its name.
 * Differences: the picker closes after a choice (Desk keeps the popover open until an outside click); the search is
 * case-insensitive (Desk: a case-sensitive `[id*=…]` match; Frappe's names are lower case).
 */
import * as React from "react";
import { Search, Shapes } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Popover, PopoverContent, PopoverTrigger } from "../primitives/popover";
import { FIELD_INVALID, interpolate } from "./FieldShell";

export interface IconInputLabels {
  placeholder?: string;
  search?: string;
  openPicker?: string;
  none?: string;
  noSet?: string;
  /** `{name}` = the selected name. */
  selected?: string;
}

export interface IconInputProps {
  id?: string;
  value: string | null | undefined;
  onChange?: (value: string) => void;
  /** The names offered by the picker (an empty list: the name can only be typed). */
  icons: readonly string[];
  /** Draws one icon; null / undefined → the name alone. */
  renderIcon?: (name: string) => React.ReactNode;
  /** Name drawn beside an empty value (Desk: `folder-normal`); never stored. */
  emptyIcon?: string;
  /** Called when the picker opens (e.g. to re-read the icon set). */
  onOpen?: () => void;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  labels?: IconInputLabels;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

export function IconInput({
  id, value, onChange, icons, renderIcon, emptyIcon, onOpen, readOnly, disabled, invalid, placeholder, labels, className, ...aria
}: IconInputProps) {
  const { t } = useLocale();
  const L = {
    placeholder: placeholder ?? labels?.placeholder ?? t("ftIconChoose"), search: labels?.search ?? t("ftIconSearch"),
    openPicker: labels?.openPicker ?? t("ftIconOpenPicker"), none: labels?.none ?? t("ftIconNone"), noSet: labels?.noSet ?? t("ftIconNoSet"),
    selected: labels?.selected ?? t("ftIconSelected"),
  };
  const [draft, setDraft] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const name = value ?? "";
  const glyph = (n: string) => (n && renderIcon ? renderIcon(n) : null);

  if (readOnly) {
    if (!name) return <div id={id} {...aria} className={cn("min-h-9 py-1.5 text-sm", className)} data-sf-readonly="" />;
    return (
      <div id={id} {...aria} className={cn("flex min-h-9 items-center gap-2 py-1.5 text-sm", className)} data-sf-readonly="" data-icon-value={name}>
        {glyph(name) ?? null}
        <span dir="ltr" className="icon-value">{name}</span>
      </div>
    );
  }

  const commit = (text: string) => {
    const v = text.trim();
    if (v !== name) onChange?.(v);
  };
  const q = query.trim().toLowerCase();
  const shown = q ? icons.filter((n) => n.toLowerCase().includes(q)) : icons;
  const choose = (n: string) => { setDraft(null); setOpen(false); setQuery(""); if (n !== name) onChange?.(n); };
  const current = glyph(name || emptyIcon || "");

  return (
    <div className={cn("sf-field-fill flex h-9 w-full items-center gap-1 rounded-md pe-1 ps-3 focus-within:ring-2 focus-within:ring-ring/60", invalid && FIELD_INVALID, disabled && "opacity-50", className)}>
      <input
        id={id}
        type="text"
        dir="ltr"
        autoComplete="off"
        {...aria}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        placeholder={L.placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
        value={draft ?? name}
        onFocus={() => setDraft(name)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft != null) commit(draft); setDraft(null); }}
        onKeyDown={(e) => { if (e.key === "Enter" && draft != null) { e.preventDefault(); commit(draft); } }}
      />
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) onOpen?.(); else setQuery(""); }}>
        <PopoverTrigger asChild disabled={disabled}>
          <button type="button" className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !name && "opacity-60")}
            aria-label={name ? `${L.openPicker} — ${interpolate(L.selected, { name })}` : L.openPicker} data-icon-trigger="">
            {current ?? <Shapes className="size-4" aria-hidden />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input type="search" dir="ltr" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={L.search} aria-label={L.search}
              className="sf-field-fill h-9 w-full rounded-md pe-3 ps-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/60" />
          </div>
          {!icons.length ? (
            <p className="py-4 text-center text-xs text-muted-foreground">{L.noSet}</p>
          ) : !shown.length ? (
            <p className="py-4 text-center text-xs text-muted-foreground" role="status">{L.none}</p>
          ) : (
            <div className="grid max-h-64 grid-cols-4 gap-1 overflow-y-auto" role="group" aria-label={L.search}>
              {shown.map((n) => (
                <button key={n} type="button" onClick={() => choose(n)} aria-pressed={n === name} title={n} data-icon-option={n}
                  className={cn("flex min-w-0 flex-col items-center gap-1 rounded-md p-1.5 text-[10px] leading-tight text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    n === name && "bg-accent text-foreground")}>
                  <span className="flex size-5 items-center justify-center" aria-hidden>{glyph(n)}</span>
                  <span dir="ltr" className="w-full truncate">{n}</span>
                </button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
