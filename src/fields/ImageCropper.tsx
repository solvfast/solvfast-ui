/**
 * ImageCropper — the uploader's crop step (Frappe 15.110 `file_uploader/ImageCropper.vue`, cropperjs with
 * `zoomable: false, scalable: false, viewMode: 1`), dependency-free:
 * - the image with a crop box (starts at 80% centred — cropperjs' `autoCropArea`), kept inside the image (viewMode 1);
 * - move by dragging the box, resize by its corner handles; keyboard: arrows move, Shift + arrows resize (10 px steps
 *   of the original image, 1 with Alt);
 * - aspect ratio buttons 1:1 / 4:3 / 16:9 / Free unless the host fixes one (ImageCropper.vue:8-23, 97-116); "Back"
 *   only without a fixed ratio (:26-32);
 * - "Crop" draws the box from the ORIGINAL image onto a canvas and returns a new File with the same name and the
 *   original type (`canvas.toBlob(…, file_type)`, :62-73), plus the box (Desk's `crop_box_data`, so a later crop
 *   starts from the same box on the original file).
 */
import * as React from "react";
import { Button } from "../primitives/button";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";

export interface CropBox { x: number; y: number; width: number; height: number }

export interface ImageCropperProps {
  file: File;
  /** A fixed aspect ratio (width / height); hides the ratio buttons and "Back". */
  aspectRatio?: number;
  /** The previous box (original-image pixels). */
  initialBox?: CropBox | null;
  onCrop: (file: File, box: CropBox) => void;
  onBack?: () => void;
  className?: string;
}

const RATIOS: { key: string; value: number }[] = [{ key: "1:1", value: 1 }, { key: "4:3", value: 4 / 3 }, { key: "16:9", value: 16 / 9 }, { key: "free", value: NaN }];

/** The largest box of `ratio` inside `w × h` scaled by `area`, centred (cropperjs autoCropArea / setAspectRatio). */
export function initialCropBox(w: number, h: number, ratio: number, area = 0.8): CropBox {
  let bw = w, bh = h;
  if (Number.isFinite(ratio) && ratio > 0) { if (w / h > ratio) bw = h * ratio; else bh = w / ratio; }
  bw *= area; bh *= area;
  return { x: (w - bw) / 2, y: (h - bh) / 2, width: bw, height: bh };
}

/** Keep a box inside the image (viewMode 1), at least 1 px. */
export function clampCropBox(b: CropBox, w: number, h: number): CropBox {
  const width = Math.max(1, Math.min(b.width, w)), height = Math.max(1, Math.min(b.height, h));
  return { width, height, x: Math.max(0, Math.min(b.x, w - width)), y: Math.max(0, Math.min(b.y, h - height)) };
}

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
}

type Drag = { mode: "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; box: CropBox; scale: number };

export function ImageCropper({ file, aspectRatio, initialBox, onCrop, onBack, className }: ImageCropperProps) {
  const { t, isRTL } = useLocale();
  const fixed = aspectRatio != null && Number.isFinite(aspectRatio);
  const [src, setSrc] = React.useState<string | null>(null);
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [ratio, setRatio] = React.useState<number>(fixed ? aspectRatio! : NaN);
  const [box, setBox] = React.useState<CropBox | null>(null);
  const img = React.useRef<HTMLImageElement>(null);
  const frame = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<Drag | null>(null);

  React.useEffect(() => { let live = true; void readDataUrl(file).then((u) => { if (live) setSrc(u); }, () => {}); return () => { live = false; }; }, [file]);

  const onLoad = () => {
    const el = img.current; if (!el) return;
    const w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
    if (!w || !h) return;
    setNatural({ w, h });
    setBox(initialBox ? clampCropBox(initialBox, w, h) : initialCropBox(w, h, ratio));
  };
  const pickRatio = (r: number) => { setRatio(r); if (natural) setBox(initialCropBox(natural.w, natural.h, r)); };

  const withRatio = (b: CropBox, anchorHeight = false): CropBox => {
    if (!Number.isFinite(ratio) || ratio <= 0) return b;
    return anchorHeight ? { ...b, width: b.height * ratio } : { ...b, height: b.width / ratio };
  };
  const resize = (b: CropBox, mode: Drag["mode"], dx: number, dy: number): CropBox => {
    let { x, y, width, height } = b;
    if (mode.includes("e")) width += dx; if (mode.includes("w")) { x += dx; width -= dx; }
    if (mode.includes("s")) height += dy; if (mode.includes("n")) { y += dy; height -= dy; }
    width = Math.max(8, width); height = Math.max(8, height);
    let next = withRatio({ x, y, width, height });
    if (mode.includes("n") && Number.isFinite(ratio)) next = { ...next, y: b.y + b.height - next.height };
    if (mode.includes("w")) next = { ...next, x: b.x + b.width - next.width };
    return next;
  };

  const start = (mode: Drag["mode"]) => (e: React.PointerEvent) => {
    if (!box || !natural || !frame.current) return;
    e.preventDefault(); e.stopPropagation();
    const rect = frame.current.getBoundingClientRect();
    drag.current = { mode, startX: e.clientX, startY: e.clientY, box, scale: rect.width ? natural.w / rect.width : 1 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d || !natural) return;
    const dx = (e.clientX - d.startX) * d.scale, dy = (e.clientY - d.startY) * d.scale;
    const next = d.mode === "move" ? { ...d.box, x: d.box.x + dx, y: d.box.y + dy } : resize(d.box, d.mode, dx, dy);
    setBox(clampCropBox(next, natural.w, natural.h));
  };
  const end = () => { drag.current = null; };

  const onKey = (e: React.KeyboardEvent) => {
    if (!box || !natural) return;
    const step = e.altKey ? 1 : 10;
    const keys: Record<string, [number, number]> = { ArrowLeft: [isRTL ? step : -step, 0], ArrowRight: [isRTL ? -step : step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const k = keys[e.key]; if (!k) return;
    e.preventDefault();
    const next = e.shiftKey ? withRatio({ ...box, width: box.width + k[0], height: box.height + k[1] }, k[0] === 0) : { ...box, x: box.x + k[0], y: box.y + k[1] };
    setBox(clampCropBox(next, natural.w, natural.h));
  };

  const crop = () => {
    const el = img.current; if (!el || !box) return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(box.width); canvas.height = Math.round(box.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(el, box.x, box.y, box.width, box.height, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) onCrop(new File([blob], file.name, { type: blob.type || file.type }), box); }, file.type);
  };

  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const handle = (mode: Drag["mode"], pos: string) => (
    <span aria-hidden onPointerDown={start(mode)} data-crop-handle={mode}
      className={cn("absolute h-3 w-3 rounded-sm border border-background bg-primary", pos)} style={{ touchAction: "none" }} />
  );
  return (
    <div className={cn("space-y-3", className)} data-image-cropper="">
      <div ref={frame} className="relative mx-auto w-fit max-w-full select-none" onPointerMove={onMove} onPointerUp={end} onPointerCancel={end}>
        {src ? <img ref={img} src={src} alt={file.name} onLoad={onLoad} draggable={false} className="block max-h-[50vh] max-w-full" /> : <div className="h-40 w-64 animate-pulse rounded bg-muted" />}
        {box && natural ? (
          <div role="group" tabIndex={0} aria-label={t("formUpCropArea")} onKeyDown={onKey} onPointerDown={start("move")} data-crop-box={`${Math.round(box.x)},${Math.round(box.y)},${Math.round(box.width)},${Math.round(box.height)}`}
            className="absolute cursor-move outline outline-2 outline-primary focus-visible:outline-4 focus-visible:outline-ring" style={{ left: pct(box.x, natural.w), top: pct(box.y, natural.h), width: pct(box.width, natural.w), height: pct(box.height, natural.h), boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.45)", touchAction: "none" }}>
            {handle("nw", "-start-1.5 -top-1.5 cursor-nwse-resize")}
            {handle("ne", "-end-1.5 -top-1.5 cursor-nesw-resize")}
            {handle("sw", "-start-1.5 -bottom-1.5 cursor-nesw-resize")}
            {handle("se", "-end-1.5 -bottom-1.5 cursor-nwse-resize")}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!fixed ? (
          <div role="group" aria-label={t("formUpAspect")} className="inline-flex flex-wrap gap-1">
            {RATIOS.map((r) => {
              const active = Number.isNaN(ratio) ? Number.isNaN(r.value) : r.value === ratio;
              return <Button key={r.key} type="button" size="sm" variant={active ? "default" : "outline"} aria-pressed={active} className="h-7 px-2 text-xs" onClick={() => pickRatio(r.value)}>{r.key === "free" ? t("formUpCropFree") : r.key}</Button>;
            })}
          </div>
        ) : <span />}
        <div className="flex gap-2">
          {!fixed && onBack ? <Button type="button" size="sm" variant="ghost" onClick={onBack}>{t("formUpBack")}</Button> : null}
          <Button type="button" size="sm" disabled={!box} onClick={crop}>{t("formUpCrop")}</Button>
        </div>
      </div>
    </div>
  );
}
