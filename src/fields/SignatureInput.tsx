/**
 * SignatureInput — a signature drawn on a canvas, stored as a PNG data URL (P36e ftypes). Generic: value in / value out.
 *
 * Native reference (Frappe 15.110 `form/controls/signature.js`, jSignature):
 * - the pad is 200 px high and as wide as the field (:29-41), stroke width 2 (:38);
 * - every finished stroke stores `getData()` (:130-135), jSignature's default export = `canvas.toDataURL()`, a
 *   `data:image/png;base64,…` URL (lib/jSignature.min.js:1221, 1404-1407);
 * - a stored value is drawn back onto the pad as an image (`setData`, :79-101; jSignature.min.js:1245-1269, 1295-1320),
 *   so new strokes add to it;
 * - Reset clears the pad and stores "" (:125-128);
 * - read-only shows the image, or the "missing image" placeholder when empty (:20-27, 70-78, 103-114).
 * Desk's stroke colour is `var(--text-color)`, which a canvas ignores (jSignature.min.js:997 sets `strokeStyle` to it),
 * so Desk's stored PNGs are black ink on a transparent background. This control draws the same black ink and shows the
 * pad and the image on a white "paper" surface in both themes, so a stored signature reads (and prints) the same.
 *
 * DS additions: "Undo" (removes the last stroke; Desk only has Reset), a hint and a status line for assistive
 * technology. Drawing needs a pointer (mouse, pen, touch): a keyboard can reach Undo / Clear but cannot draw — the hint
 * says so. Without canvas support the stored image is still shown and the hint says drawing is unavailable.
 * The drawing is not mirrored in right-to-left layouts (a signature is a picture); the buttons follow the direction.
 */
import * as React from "react";
import { Eraser, PenLine, Undo2 } from "lucide-react";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";
import { Button } from "../primitives/button";
import { FIELD_INVALID } from "./FieldShell";

/** A stored value this control can draw / show: an image data URL (jSignature imports png / jpeg, :1283-1285). */
export const isSignatureDataUrl = (v: unknown): v is string =>
  typeof v === "string" && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/.test(v);

export interface SignatureInputLabels {
  pad?: string;
  hint?: string;
  noCanvas?: string;
  empty?: string;
  signed?: string;
  image?: string;
  invalid?: string;
  undo?: string;
  clear?: string;
}

export interface SignatureInputProps {
  id?: string;
  /** The stored value: a `data:image/png;base64,…` URL, or empty. */
  value: string | null | undefined;
  /** The new value after each stroke, Undo or Clear: a PNG data URL, or "" when the pad is empty (Desk's reset). */
  onChange?: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Pad height in CSS pixels (Desk: 200). */
  height?: number;
  /** Ink colour of new strokes (default black, as Desk's PNGs). */
  ink?: string;
  labels?: SignatureInputLabels;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}

type Point = { x: number; y: number };

function SignatureImage({ value, alt, emptyText, invalidText, className }: { value: string | null | undefined; alt: string; emptyText: string; invalidText: string; className?: string }) {
  if (!value) {
    return (
      <div className={cn("flex h-24 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground", className)} data-signature-empty="">
        <PenLine className="size-4" aria-hidden />{emptyText}
      </div>
    );
  }
  if (!isSignatureDataUrl(value)) return <div className={cn("text-sm text-muted-foreground", className)} data-signature-invalid="">{invalidText}</div>;
  return (
    <div className={cn("w-full rounded-md border border-border bg-white p-1", className)}>
      <img src={value} alt={alt} className="mx-auto block max-h-[200px] max-w-full object-contain" />
    </div>
  );
}

export function SignatureInput({
  id, value, onChange, readOnly, disabled, invalid, height = 200, ink = "#000000", labels, className, ...aria
}: SignatureInputProps) {
  const { t } = useLocale();
  const L = {
    pad: labels?.pad ?? t("ftSignaturePad"), hint: labels?.hint ?? t("ftSignatureHint"), noCanvas: labels?.noCanvas ?? t("ftSignatureNoCanvas"),
    empty: labels?.empty ?? t("ftSignatureEmpty"), signed: labels?.signed ?? t("ftSignatureSigned"), image: labels?.image ?? t("ftSignatureImage"),
    invalid: labels?.invalid ?? t("ftSignatureInvalid"), undo: labels?.undo ?? t("ftSignatureUndo"), clear: labels?.clear ?? t("ftSignatureClear"),
  };
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const strokes = React.useRef<Point[][]>([]);
  const current = React.useRef<Point[] | null>(null);
  const base = React.useRef<HTMLImageElement | null>(null);
  /** The last value this control emitted (not re-imported as a base image). */
  const emitted = React.useRef<string | null>(null);
  const [strokeCount, setStrokeCount] = React.useState(0);
  const [canDraw, setCanDraw] = React.useState(true);
  const hintId = React.useId();
  const editable = !readOnly && !disabled;

  const ctx = React.useCallback(() => {
    const c = canvasRef.current;
    if (!c) return null;
    try { return c.getContext("2d"); } catch { return null; }
  }, []);

  const paintStroke = React.useCallback((g: CanvasRenderingContext2D, pts: Point[]) => {
    if (!pts.length) return;
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 1) g.lineTo(pts[0].x + 0.01, pts[0].y); // a dot
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.stroke();
  }, []);

  const redraw = React.useCallback(() => {
    const c = canvasRef.current;
    const g = ctx();
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    const img = base.current;
    // jSignature draws an imported image at its own size, clipped to the pad (jSignature.min.js:1257-1264)
    if (img && img.complete && img.naturalWidth) g.drawImage(img, 0, 0, Math.min(img.naturalWidth, c.width), Math.min(img.naturalHeight, c.height));
    g.lineWidth = 2;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = ink;
    for (const s of strokes.current) paintStroke(g, s);
  }, [ctx, ink, paintStroke]);

  const emit = React.useCallback(() => {
    const c = canvasRef.current;
    if (!c || !onChange) return;
    const empty = !strokes.current.length && !base.current;
    let next = "";
    if (!empty) { try { next = c.toDataURL("image/png"); } catch { next = ""; } }
    emitted.current = next;
    onChange(next);
  }, [onChange]);

  // size the pad to the field's width (signature.js:29-41: width = the wrapper's width, height 200)
  React.useLayoutEffect(() => {
    const c = canvasRef.current;
    if (!c || !editable) return;
    const fit = () => {
      const w = Math.round(c.clientWidth || c.parentElement?.clientWidth || 0) || 600;
      if (c.width !== w || c.height !== height) { c.width = w; c.height = height; redraw(); }
    };
    fit();
    setCanDraw(!!ctx());
    const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
    if (!RO) return;
    const ro = new RO(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, [editable, height, redraw, ctx]);

  // a value from outside (load, another editor, Clear by the form) is drawn as the base image; strokes start over
  React.useEffect(() => {
    if (!editable) return;
    const v = value ?? "";
    if (v === (emitted.current ?? "") && emitted.current !== null) return;
    emitted.current = v;
    strokes.current = [];
    setStrokeCount(0);
    base.current = null;
    if (isSignatureDataUrl(v) && typeof Image !== "undefined") {
      const img = new Image();
      img.onload = () => { if (base.current === img) redraw(); };
      base.current = img;
      img.src = v;
    }
    redraw();
  }, [value, editable, redraw]);

  const pointAt = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const sx = r.width ? c.width / r.width : 1;
    const sy = r.height ? c.height / r.height : 1;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!editable || !canDraw || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    current.current = [pointAt(e)];
    strokes.current = [...strokes.current, current.current];
    redraw();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!current.current) return;
    current.current.push(pointAt(e));
    redraw();
  };
  const finish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!current.current) return;
    current.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    setStrokeCount(strokes.current.length);
    emit(); // signature.js:130-135: each finished stroke is stored
  };
  const undo = () => {
    if (!strokes.current.length) return;
    strokes.current = strokes.current.slice(0, -1);
    setStrokeCount(strokes.current.length);
    redraw();
    emit();
  };
  const clear = () => {
    strokes.current = [];
    base.current = null;
    setStrokeCount(0);
    redraw();
    emit(); // signature.js:125-128 on_reset_sign → ""
  };

  if (!editable) {
    return (
      <div id={id} role="group" {...aria} className={cn("w-full", className)} data-signature-readonly="">
        <SignatureImage value={value} alt={L.image} emptyText={L.empty} invalidText={L.invalid} />
      </div>
    );
  }

  const hasValue = !!value;
  return (
    <div id={id} role="group" {...aria} aria-describedby={[hintId, aria["aria-describedby"]].filter(Boolean).join(" ")} className={cn("w-full space-y-1.5", className)}>
      <div className={cn("relative w-full overflow-hidden rounded-md border border-border bg-white focus-within:ring-2 focus-within:ring-ring/60", invalid && FIELD_INVALID)}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={L.pad}
          className="block w-full touch-none cursor-crosshair"
          style={{ height }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          data-signature-pad=""
        >
          {L.noCanvas}
        </canvas>
        {!canDraw && isSignatureDataUrl(value) && (
          <img src={value} alt={L.image} className="absolute inset-0 m-auto max-h-full max-w-full object-contain" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p id={hintId} className="min-w-0 flex-1 text-xs text-muted-foreground">{canDraw ? L.hint : L.noCanvas}</p>
        <span className="sr-only" role="status">{hasValue ? L.signed : L.empty}</span>
        <Button type="button" variant="ghost" size="sm" onClick={undo} disabled={!strokeCount} aria-label={L.undo} title={L.undo}>
          <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!hasValue && !strokeCount} aria-label={L.clear} title={L.clear}>
          <Eraser className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
