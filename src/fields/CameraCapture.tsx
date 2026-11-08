/**
 * CameraCapture — the uploader's "Camera" (Frappe 15.110 `public/js/frappe/ui/capture.js`, opened by
 * FileUploader.vue:130-151, 732-746), on `navigator.mediaDevices.getUserMedia`:
 * - live stream (`facingMode: "environment"`, capture.js:65, 152-174); "Take Photo" grabs the frame as PNG
 *   (`get_data_uri`, :14-26, :210-220); "Switch Camera" toggles environment / user (:265-282); a count
 *   "Total Images: n" / "No Images" (:250-263);
 * - "Preview" lists the photos with a remove button each (:177-248); "Capture" goes back to the stream (:284-295);
 *   "Submit" hands them over (:297-307) as `capture_<date_time>.png` files (FileUploader.vue:738-744);
 * - the stream is stopped when leaving it or closing (:309-320);
 * - no camera / refused: "Unable to load camera." (:143-148, 331) and the fallback Desk uses on phones — a file input
 *   with `capture` (`get_file_input`, :28-36, :118-134).
 * Feature detection: `cameraSupported()`; hosts show the source only when it is true (FileUploader.vue:337-339).
 */
import * as React from "react";
import { Camera, SwitchCamera, X } from "lucide-react";
import { Button } from "../primitives/button";
import { cn } from "../lib/cn";
import { useLocale } from "../theme/ThemeProvider";

/** Desk shows "Camera" when `window.navigator.mediaDevices` exists (FileUploader.vue:337-339). */
export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function";
}

/** `capture_<YYYY_MM_DD_HH_mm_ss>.png` (FileUploader.vue:740-742: now_datetime with ":", " ", "-" → "_"). */
export function captureFileName(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `capture_${d.getFullYear()}_${p(d.getMonth() + 1)}_${p(d.getDate())}_${p(d.getHours())}_${p(d.getMinutes())}_${p(d.getSeconds())}.png`;
}

/** A data URL as a File (FileUploader.vue `url_to_file`). */
export function dataUrlToFile(dataUrl: string, name: string, type = "image/png"): File {
  const [, b64 = ""] = dataUrl.split(",");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type });
}

function readDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
}

export interface CameraCaptureProps {
  /** "Submit": the photos as PNG files. */
  onSubmit: (files: File[]) => void;
  className?: string;
}

export function CameraCapture({ onSubmit, className }: CameraCaptureProps) {
  const { t } = useLocale();
  const [mode, setMode] = React.useState<"stream" | "preview">("stream");
  const [facing, setFacing] = React.useState<"environment" | "user">("environment");
  const [images, setImages] = React.useState<string[]>([]);
  const [error, setError] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const video = React.useRef<HTMLVideoElement>(null);
  const stream = React.useRef<MediaStream | null>(null);
  const fallback = React.useRef<HTMLInputElement>(null);

  const stop = () => { stream.current?.getTracks().forEach((tr) => tr.stop()); stream.current = null; setReady(false); };

  React.useEffect(() => {
    if (mode !== "stream") return;
    if (!cameraSupported()) { setError(true); return; }
    let live = true;
    setError(false);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } }).then((s) => {
      if (!live) { s.getTracks().forEach((tr) => tr.stop()); return; }
      stream.current = s;
      const v = video.current;
      if (v) { v.srcObject = s; void Promise.resolve(v.play?.()).catch(() => {}); }
      setReady(true);
    }, () => { if (live) setError(true); });
    return () => { live = false; stop(); };
  }, [mode, facing]);

  const take = () => {
    const v = video.current; if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/png");
    setImages((xs) => [...xs, url]);
  };
  const submit = () => {
    const name = captureFileName();
    onSubmit(images.map((u) => dataUrlToFile(u, name)));
    setImages([]);
  };
  const fromDevice = async (files: FileList | null) => {
    const urls = await Promise.all(Array.from(files ?? []).map(readDataUrl));
    if (urls.length) { setImages((xs) => [...xs, ...urls]); setMode("preview"); }
  };

  const count = <p className="text-center text-xs text-muted-foreground" aria-live="polite">{images.length ? t("formUpTotalImages").replace("{0}", String(images.length)) : t("formUpNoImages")}</p>;
  return (
    <div className={cn("space-y-2", className)} data-camera-capture={mode}>
      {mode === "stream" ? (
        <>
          {error ? (
            <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-center">
              <p role="alert" className="text-xs text-destructive">{t("formUpCameraError")}</p>
              <input ref={fallback} type="file" accept="image/*" multiple capture="environment" className="hidden" tabIndex={-1} aria-hidden data-camera-fallback=""
                onChange={(e) => { void fromDevice(e.target.files); e.target.value = ""; }} />
              <Button type="button" size="sm" variant="outline" onClick={() => fallback.current?.click()}><Camera className="me-1.5 h-4 w-4" aria-hidden />{t("formUpDeviceCamera")}</Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md bg-black">
              <video ref={video} playsInline muted aria-label={t("formUpCamera")} className="aspect-video w-full object-contain" />
            </div>
          )}
          {count}
          <div className="flex flex-wrap justify-end gap-2">
            {!error ? <Button type="button" size="sm" variant="ghost" disabled={!ready} onClick={() => { stop(); setFacing((f) => (f === "environment" ? "user" : "environment")); }}><SwitchCamera className="me-1.5 h-4 w-4" aria-hidden />{t("formUpSwitchCamera")}</Button> : null}
            {images.length ? <Button type="button" size="sm" variant="outline" onClick={() => { stop(); setMode("preview"); }}>{t("formUpPreview")}</Button> : null}
            {!error ? <Button type="button" size="sm" disabled={!ready} onClick={take}>{t("formUpTakePhoto")}</Button> : null}
          </div>
        </>
      ) : (
        <>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((u, i) => (
              <li key={i} className="relative">
                <img src={u} alt={`${i + 1}`} className="aspect-square w-full rounded object-cover" />
                <button type="button" aria-label={t("formUpRemovePhoto").replace("{0}", String(i + 1))} onClick={() => setImages((xs) => xs.filter((_, j) => j !== i))}
                  className="absolute end-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-background/90 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {count}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setMode("stream")}>{t("formUpCapture")}</Button>
            <Button type="button" size="sm" disabled={!images.length} onClick={submit}>{t("formUpSubmit")}</Button>
          </div>
        </>
      )}
    </div>
  );
}
