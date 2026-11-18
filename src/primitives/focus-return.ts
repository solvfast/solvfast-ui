/**
 * Run 1 (B-42 / G28): where focus goes when a dialog closes. Radix returns focus to a `DialogTrigger`; a dialog opened
 * from a menu item or a plain button (no trigger) dropped focus on <body> — keyboard and screen-reader users lost their
 * place (WCAG 2.4.3). The package's dialog contents remember their opener when they open and give focus back to it when
 * they close:
 *  - the element focused when the dialog opened, when it is still in the page;
 *  - for a dialog opened from a menu item (the item is gone by then), the menu's trigger: `DropdownMenuItem` notes it
 *    when an item is chosen (`noteMenuOpener`), and a dialog opening right after takes it (`takeOpener`).
 * A `returnFocus` prop on the content overrides both. Nothing here changes what is rendered.
 */
import * as React from "react";
let noted: { el: HTMLElement; at: number } | null = null;
const NOTE_TTL_MS = 1500;

const usable = (el: Element | null | undefined): el is HTMLElement =>
  !!el && el instanceof HTMLElement && el.isConnected && el !== document.body && el !== document.documentElement;

/** The trigger of the menu holding `el` (the element whose `aria-controls` is the menu's id). */
function menuTrigger(el: Element | null | undefined): Element | null {
  const menu = el?.closest('[role="menu"]');
  if (!menu?.id) return null;
  return Array.from(document.querySelectorAll("[aria-controls]")).find((x) => x.getAttribute("aria-controls") === menu.id) ?? null;
}

/** A menu item was chosen: remember the menu's trigger. */
export function noteMenuOpener(item: Element | null) {
  const trigger = menuTrigger(item);
  if (usable(trigger)) noted = { el: trigger, at: Date.now() };
}

/** The element a dialog that is opening now should give focus back to. */
export function takeOpener(): HTMLElement | null {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  const recent = noted && Date.now() - noted.at < NOTE_TTL_MS && usable(noted.el) ? noted.el : null;
  noted = null;
  if (usable(active) && !active.closest('[role="menu"]')) return active;
  if (recent) return recent;
  if (usable(active)) { // still inside the menu: its trigger
    const trigger = menuTrigger(active);
    if (usable(trigger)) return trigger;
  }
  return null;
}

export type ReturnFocusTarget = HTMLElement | null | React.RefObject<HTMLElement | null> | (() => HTMLElement | null);
const resolve = (t: ReturnFocusTarget | undefined): HTMLElement | null =>
  t == null ? null : typeof t === "function" ? t() : "current" in t ? t.current : t;

/** Props a Radix content spreads: remember the opener on open, give focus back on close. */
export function useReturnFocus(opts: {
  returnFocus?: ReturnFocusTarget;
  onOpenAutoFocus?: (e: Event) => void;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  const opener = React.useRef<HTMLElement | null>(null);
  const { returnFocus, onOpenAutoFocus, onCloseAutoFocus } = opts;
  return {
    onOpenAutoFocus: (e: Event) => { opener.current = takeOpener(); onOpenAutoFocus?.(e); },
    onCloseAutoFocus: (e: Event) => {
      onCloseAutoFocus?.(e);
      if (e.defaultPrevented) return;
      const target = resolve(returnFocus) ?? opener.current;
      opener.current = null;
      if (usable(target)) { e.preventDefault(); target.focus(); }
    },
  };
}
