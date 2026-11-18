/**
 * Run 1 (A-25): a navigation target — a link when it has an `href` (plain click → `onGo`, the browser's own navigation
 * prevented; Ctrl / ⌘ / middle click → new tab), a button when it has none (an `<a>` without `href` is neither focusable
 * nor a link).
 */
import * as React from "react";
import { navLinkProps } from "./navLink";

type Common = Omit<React.HTMLAttributes<HTMLElement>, "onClick">;
export const NavTarget = React.forwardRef<HTMLElement, Common & { href?: string; onGo: () => void }>(function NavTarget({ href, onGo, ...rest }, ref) {
  if (href) return <a ref={ref as React.Ref<HTMLAnchorElement>} {...rest} {...navLinkProps(href, onGo)} />;
  return <button ref={ref as React.Ref<HTMLButtonElement>} type="button" {...rest} onClick={onGo} />;
});
