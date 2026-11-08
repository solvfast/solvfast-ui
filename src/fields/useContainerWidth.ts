/**
 * useContainerWidth — the laid-out width (px) of an element, kept current with a ResizeObserver (a window `resize`
 * listener where ResizeObserver is missing). `null` while unknown: not enabled, not mounted, or not laid out yet (width
 * 0 — a hidden tab, jsdom, the server render). Callers treat `null` as "wide" so nothing changes before a real measure.
 */
import * as React from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function useContainerWidth(ref: React.RefObject<HTMLElement>, enabled = true): number | null {
  const [width, setWidth] = React.useState<number | null>(null);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) { setWidth(null); return; }
    const measure = () => {
      const w = el.clientWidth;
      setWidth((prev) => (w > 0 ? (prev === w ? prev : w) : prev));
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref, enabled]);
  return enabled ? width : null;
}
