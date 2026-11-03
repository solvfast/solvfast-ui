/**
 * The column mapper — Desk's "Map Columns" dialog (`import_preview.js:239-325`): one row per file column with its
 * header and a searchable field picker pre-set to what the SERVER matched (`:246-255`); the options are "Don't Import",
 * then `get_columns_for_picker` (`data_exporter.js:311-357`) as `get_fields_as_options` labels them (`:334-358`). Saving
 * hands the CHANGED columns to `onSubmit`, keyed by FILE column index (`changed_map[i - 1]`, `:310-318`); the caller
 * saves them into `template_options` and asks the server for the preview again (`remapImportColumns`). Nothing is
 * re-mapped here: what a column becomes is the server's answer to that save.
 *
 * Package differences: rendered as a step of the import panel (not a third dialog); a column counts as changed only
 * when its value differs from the pre-set one (Desk records every `change` event, even back to the same value).
 */
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../primitives/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../primitives/popover";
import type { MetaBundle } from "../contract";
import type { ImportPreview } from "./import";
import { useDataImportLabels } from "./ImportPreview";
import { DONT_IMPORT, changedColumnMap, columnMappingValue, fmt, importPickerOptions, type DataImportLabels, type ImportFieldOption } from "./importMapping";

export interface FrappeColumnMappingProps {
  preview: ImportPreview;
  /** The reference DocType's bundle (its child tables give the `<table>.<field>` options). */
  bundle: MetaBundle;
  /** Shown in the heading (Desk: the import file's name). */
  fileName?: string;
  /** Called with the changed entries only, `{ "<file column index>": "<field>" | "Don't Import" }`; not called when nothing changed. */
  onSubmit: (changed: Record<string, string>) => void;
  onCancel: () => void;
  /** The save is in flight (disables the form). */
  busy?: boolean;
  labels?: Partial<DataImportLabels>;
  className?: string;
}

export function FrappeColumnMapping({ preview, bundle, fileName, onSubmit, onCancel, busy, labels, className }: FrappeColumnMappingProps) {
  const L = useDataImportLabels(labels);
  const options = React.useMemo<ImportFieldOption[]>(() => [{ value: DONT_IMPORT, label: L.dontImport, description: DONT_IMPORT, doctype: "" }, ...importPickerOptions(bundle)], [bundle, L.dontImport]);
  const initial = React.useMemo(() => {
    const out: Record<number, string> = {};
    (preview.columns ?? []).forEach((col, i) => { if (i > 0) out[i] = columnMappingValue(col); });
    return out;
  }, [preview]);
  const [values, setValues] = React.useState<Record<number, string>>(initial);
  React.useEffect(() => setValues(initial), [initial]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const changes: Record<number, string> = {};
    for (const [i, v] of Object.entries(values)) if (v !== initial[Number(i)]) changes[Number(i)] = v;
    if (!Object.keys(changes).length) { onCancel(); return; } // Desk: `if (changed.length > 0)` remap; the dialog closes either way
    onSubmit(changedColumnMap(changes));
  };

  return (
    <form onSubmit={submit} className={cn("space-y-3", className)} aria-label={L.mapColumns} data-column-mapping="">
      <p className="text-sm text-muted-foreground">{fmt(L.mapHeading, fileName || "", bundle.meta.name)}</p>
      <div className="divide-y rounded-md border">
        {(preview.columns ?? []).map((col, i) => {
          if (i === 0) return null; // Sr. No
          const header = col.header_title || "";
          return (
            <div key={i} className="grid items-center gap-2 p-2 sm:grid-cols-2" data-map-col={i}>
              <span className={cn("truncate text-sm", !header && "italic text-muted-foreground")}>{header || L.untitledColumn}</span>
              <FieldPicker
                value={values[i] ?? DONT_IMPORT}
                options={options}
                onChange={(v) => setValues((s) => ({ ...s, [i]: v }))}
                ariaLabel={header || `${L.untitledColumn} ${i}`}
                labels={L}
                disabled={busy}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{L.cancel}</Button>
        <Button type="submit" loading={busy}>{busy ? L.savingMapping : L.saveMapping}</Button>
      </div>
    </form>
  );
}

/** A searchable picker (Desk: an Autocomplete) — the package's Popover + Command; the trigger shows the option's label. */
function FieldPicker({ value, options, onChange, ariaLabel, labels: L, disabled }: { value: string; options: ImportFieldOption[]; onChange: (v: string) => void; ariaLabel: string; labels: DataImportLabels; disabled?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-label={ariaLabel} disabled={disabled} className="w-full justify-between font-normal" data-value={value}>
          <span className={cn("truncate", value === DONT_IMPORT && "text-muted-foreground")}>{current?.label ?? value}</span>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={L.searchFields} />
          <CommandList>
            <CommandEmpty>{L.noFields}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.value} keywords={[o.label]} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("me-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} aria-hidden />
                  <div className="min-w-0">
                    <div className="truncate">{o.label}</div>
                    {o.value !== DONT_IMPORT ? <div className="truncate text-xs text-muted-foreground">{o.description}</div> : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
