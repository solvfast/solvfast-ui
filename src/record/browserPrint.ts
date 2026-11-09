/**
 * printHtmlDocument — prints a composed document (`composePrintDocument`) with the BROWSER's print dialog, where the
 * user prints or chooses "Save as PDF". Nothing is sent anywhere and no file is produced by the page.
 *
 * How: a hidden, same-origin iframe gets the document as `srcdoc`; once it has loaded (and its web fonts, at most
 * 1.5 s) the helper calls `print()` on the frame's window, so only that document prints — never the app around it.
 * The frame is removed on the frame's `afterprint`, or when the next print starts.
 *
 * Why not sandboxed: a sandboxed frame without `allow-modals` cannot print, and `allow-same-origin` + scripts would
 * cancel the sandbox anyway. The guarantee is instead (1) the document is the host's own escaped HTML (see TRUST in
 * printDocument.ts) and (2) `composePrintDocument` puts `script-src 'none'` in the document's Content-Security-Policy,
 * so no inline script or event handler in it can run.
 */

export const PRINT_FRAME_ATTR = "data-sf-print-frame";

export interface PrintHtmlOptions {
  /** The window to print from (tests). Default `window`. */
  win?: Window;
  /** Max wait for the frame's web fonts, ms. Default 1500. */
  fontTimeoutMs?: number;
}

/** Resolves once `print()` was called on the frame (the browser's dialog may still be open). */
export function printHtmlDocument(srcdoc: string, o: PrintHtmlOptions = {}): Promise<void> {
  const w = o.win ?? window;
  const d = w.document;
  d.querySelectorAll(`iframe[${PRINT_FRAME_ATTR}]`).forEach((f) => f.remove());
  const frame = d.createElement("iframe");
  frame.setAttribute(PRINT_FRAME_ATTR, "");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("title", "print");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  return new Promise<void>((resolve, reject) => {
    let done = false;
    frame.addEventListener("load", () => {
      if (done) return;
      const cw = frame.contentWindow;
      if (!cw) { done = true; frame.remove(); reject(new Error("The print frame has no window")); return; }
      cw.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 0), { once: true });
      const fonts = (cw.document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? Promise.resolve();
      const wait = new Promise((r) => setTimeout(r, o.fontTimeoutMs ?? 1500));
      void Promise.race([fonts, wait]).then(() => {
        if (done) return;
        done = true;
        try { cw.focus(); cw.print(); resolve(); } catch (e) { frame.remove(); reject(e); }
      });
    });
    frame.srcdoc = srcdoc;
    d.body.appendChild(frame);
  });
}
