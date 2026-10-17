/** The App shell page's live demo, full screen (#/demo/app-shell): Sear's shell configuration (the playground's
 *  demo/sear-demo.ts) through the package's AppShell. Navigation inside Sear Studio changes the page; anything that
 *  would leave the app is shown instead of followed. */
import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell, useLocale } from "@ui";
import { BASE, BRAND, NAV_ITEMS, SWITCHER_SECTIONS, seedNotifications, workspaceLogo } from "../../../playground/src/demo/sear-demo";
import { ShellPage } from "../../../playground/src/showcase/ShellPage";

export default function AppShellDemo() {
  const { isRTL } = useLocale();
  const [path, setPath] = React.useState(`${BASE}/overview`);
  const [left, setLeft] = React.useState("");
  const [items, setItems] = React.useState(() => seedNotifications());
  const navigate = (href: string) => (href.startsWith(BASE) ? (setPath(href), setLeft("")) : setLeft(href));
  return (
    <AppShell
      brand={BRAND}
      items={NAV_ITEMS}
      currentPath={path}
      onNavigate={navigate}
      switcher={{ sections: SWITCHER_SECTIONS, currentAppId: "sear-studio", home: { href: "/workspace" }, exit: { href: "/workspace", iconSrc: workspaceLogo } }}
      notifications={{
        items,
        onItemClick: (n) => setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x))),
        onMarkAllRead: () => setItems((xs) => xs.map((x) => ({ ...x, read: true }))),
      }}
      mobile={{ exit: { href: "/workspace" } }}
      collapsedStorageKey={null}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-6 py-2 text-xs text-muted-foreground md:px-8">
        <a href="#/app-shell" target="_top" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />{isRTL ? "العودة إلى المكوّنات" : "Back to the components"}
        </a>
        <span dir="ltr" className="font-mono">currentPath: {path}</span>
        {left && <span dir="ltr" className="font-mono">onNavigate("{left}") — {isRTL ? "يغادر التطبيق؛ يقرّر التطبيق المضيف" : "leaves the app; the host app decides"}</span>}
      </div>
      <ShellPage isAr={isRTL} />
    </AppShell>
  );
}
