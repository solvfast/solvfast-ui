/**
 * BarcodeInput — shows a stored barcode (P36e ftypes). PARTIAL: it displays and clears; it cannot create or change a
 * barcode, because the stored value is the SVG a barcode generator drew and this package has none.
 *
 * Native reference (Frappe 15.110 `form/controls/barcode.js`):
 * - the value is the SVG markup JsBarcode draws from the typed text, with `data-barcode-value="<text>"` and
 *   `width="100%"` (:44-57; options from `df.options` JSON, :59-78); typed text is converted on parse (:14-23);
 * - the input shows the `data-barcode-value` text and the area below shows the SVG (:25-42);
 * - the server does not sanitize the markup (model/base_document.py:1117), so this control sanitizes it (`sanitizeSvg`).
 * Here:
 * - an `<svg …>` value: the sanitized SVG and its `data-barcode-value` text;
 * - plain text (e.g. imported data that Desk would convert on its next load, :35-38): the text, with a note that it is
 *   not drawn as a barcode;
 * - editable: the same display, a note that editing needs a barcode generator, and Clear (stores "", as an emptied Desk
 *   input does, :14-23) — no text box, because storing typed text instead of the SVG would not be what Desk stores.
 */
import * as React from "react";
import { Barcode, Eraser } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Button } from "../primitives/button";
import { FIELD_INVALID, interpolate } from "./FieldShell";
import { sanitizeSvg } from "./lib/svg";

export interface ParsedBarcode {
  /** The sanitized SVG markup, or null (no SVG, or nothing safe left). */
  svg: string | null;
  /** The barcode's text: `data-barcode-value` of an SVG value, else the raw text. */
  text: string;
  /** The value looked like SVG (`<svg` prefix, barcode.js:17, 31). */
  isSvg: boolean;
}

/** Split a stored Barcode value into its safe SVG and its text. */
export function parseBarcodeValue(value: unknown): ParsedBarcode {
  const raw = typeof value === "string" ? value : value == null ? "" : String(value);
  const trimmed = raw.trim();
  if (!trimmed.startsWith("<svg")) return { svg: null, text: raw, isSvg: false };
  const svg = sanitizeSvg(trimmed);
  let text = "";
  if (svg) {
    const tpl = document.createElement("template");
    tpl.innerHTML = svg;
    text = tpl.content.firstElementChild?.getAttribute("data-barcode-value") ?? "";
  }
  return { svg, text, isSvg: true };
}

export interface BarcodeInputLabels {
  empty?: string;
  /** Accessible name of the drawn barcode; `{value}` = its text. */
  image?: string;
  notRendered?: string;
  noGenerator?: string;
  unsafe?: string;
  clear?: string;
}

export interface BarcodeInputProps {
  id?: string;
  value: string | null | undefined;
  /** Clear (""). Omit (or readOnly) for a display only. */
  onChange?: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  labels?: BarcodeInputLabels;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

export function BarcodeInput({ id, value, onChange, readOnly, disabled, invalid, labels, className, ...aria }: BarcodeInputProps) {
  const { t } = useLocale();
  const L = {
    empty: labels?.empty ?? t("ftBarcodeEmpty"), image: labels?.image ?? t("ftBarcodeImage"), notRendered: labels?.notRendered ?? t("ftBarcodeNotRendered"),
    noGenerator: labels?.noGenerator ?? t("ftBarcodeNoGenerator"), unsafe: labels?.unsafe ?? t("ftBarcodeUnsafe"), clear: labels?.clear ?? t("ftBarcodeClear"),
  };
  const parsed = React.useMemo(() => parseBarcodeValue(value), [value]);
  const editable = !readOnly && !disabled && !!onChange;
  const empty = !(value ?? "").trim();

  return (
    <div id={id} role="group" {...aria} className={cn("w-full space-y-1.5", className)} data-barcode="">
      <div className={cn("rounded-md", editable && invalid && FIELD_INVALID)}>
        {empty ? (
          <div className="flex h-12 w-full items-center gap-2 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground" data-barcode-empty="">
            <Barcode className="size-4" aria-hidden />{L.empty}
          </div>
        ) : parsed.svg ? (
          <div className="w-full overflow-hidden rounded-md border border-border bg-white p-2 [&>svg]:mx-auto [&>svg]:block [&>svg]:h-auto [&>svg]:max-h-32 [&>svg]:max-w-full"
            role="img" aria-label={interpolate(L.image, { value: parsed.text })} data-barcode-svg=""
            dangerouslySetInnerHTML={{ __html: parsed.svg }} />
        ) : parsed.isSvg ? (
          <p className="text-sm text-muted-foreground" data-barcode-unsafe="">{L.unsafe}</p>
        ) : null}
        {!empty && parsed.text && (
          <div dir="ltr" className="mt-1 break-all text-start font-mono text-sm text-foreground" data-barcode-text="">{parsed.text}</div>
        )}
        {!empty && !parsed.isSvg && <p className="mt-0.5 text-xs text-muted-foreground">{L.notRendered}</p>}
      </div>
      {editable && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground" data-barcode-no-generator="">{L.noGenerator}</p>
          {!empty && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange?.("")} aria-label={L.clear} title={L.clear}>
              <Eraser className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
