import { createRoot } from "react-dom/client";
import "@solvfast/ui/full.css";
import "@solvfast/ui/full-base.css";
import "./layout.css"; // the app's own layout CSS (path B apps style their own layout)
import * as React from "react";
import { AppShell, ThemeProvider, useLocale } from "@solvfast/ui";
import { Primitives } from "./showcase/Primitives";
import { ShellPage } from "./showcase/ShellPage";
import { BASE, BRAND, NAV_ITEMS, SWITCHER_SECTIONS, seedNotifications, workspaceLogo } from "./demo/sear-demo";

const params = new URLSearchParams(location.search);

function Page() {
  const { isRTL } = useLocale();
  return <div className="sf-app min-h-screen"><Primitives isAr={isRTL} /></div>;
}

function ShellDemo() {
  const { isRTL } = useLocale();
  const [path, setPath] = React.useState(params.get("path") ?? `${BASE}/overview`);
  const [items, setItems] = React.useState(() => seedNotifications());
  return (
    <AppShell brand={BRAND} items={NAV_ITEMS} currentPath={path} onNavigate={setPath}
      switcher={{ sections: SWITCHER_SECTIONS, currentAppId: "sear-studio", home: { href: "/workspace" }, exit: { href: "/workspace", iconSrc: workspaceLogo } }}
      notifications={{ items, onItemClick: (n) => setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x))), onMarkAllRead: () => setItems((xs) => xs.map((x) => ({ ...x, read: true }))) }}
      mobile={{ exit: { href: "/workspace" } }} collapsedStorageKey="studio_sidebar_collapsed">
      <ShellPage isAr={isRTL} />
    </AppShell>
  );
}
createRoot(document.getElementById("root")!).render(
  <ThemeProvider storageKeys={{ theme: "app_theme", language: "app_lang" }} defaultLanguage="ar">{params.get("view") === "shell" ? <ShellDemo /> : <Page />}</ThemeProvider>,
);
