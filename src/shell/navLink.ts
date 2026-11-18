/**
 * Run 1 (A-25): navigation targets are links. A plain click navigates in the app (`onNavigate`, the browser's own
 * navigation prevented); Ctrl / ⌘ / Shift / Alt-click and the middle button keep the browser's behaviour (new tab /
 * window, copy link), as Desk's sidebar and awesome bar links do (workspace.js:152-159, awesome_bar.js:120-124).
 */
import type * as React from "react";

/** A click the browser should handle itself (new tab / window, download). */
export const isModifiedClick = (e: React.MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/** Props for an `<a>` whose plain click goes through the app's router. */
export function navLinkProps(href: string | undefined, go: () => void): { href?: string; onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void } {
  return {
    href,
    onClick: (e) => {
      if (e.defaultPrevented || (href && isModifiedClick(e))) return;
      e.preventDefault();
      go();
    },
  };
}
