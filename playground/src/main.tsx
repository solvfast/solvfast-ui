import * as React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "../../styles/glass.css"; // separate stylesheet after the Tailwind one (path A)
import { AppShell, ThemeProvider, useLocale } from "@ui";
import { Primitives } from "./showcase/Primitives";
import { ShellPage } from "./showcase/ShellPage";
import { FieldLibraryDemo } from "./showcase/FieldLibraryDemo";
import { FrappeDemo } from "./showcase/FrappeDemo";
import { CardsPage } from "./showcase/CardsPage";
import { PartsPage } from "./showcase/PartsPage";
import { ExtrasPage } from "./showcase/ExtrasPage";
import { MergedPage } from "./showcase/MergedPage";
import { BASE, BRAND, NAV_ITEMS, SWITCHER_SECTIONS, seedNotifications, workspaceLogo } from "./demo/sear-demo";

const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "primitives";

function PrimitivesPage() {
  const { isRTL } = useLocale();
  return (
    <div className="sf-app min-h-screen">
      <Primitives isAr={isRTL} />
    </div>
  );
}

/** Sear's shell configuration (demo/sear-demo.ts) through the package's AppShell. */
function ShellDemo() {
  const { isRTL } = useLocale();
  const [path, setPath] = React.useState(params.get("path") ?? `${BASE}/overview`);
  const [items, setItems] = React.useState(() => seedNotifications());
  return (
    <AppShell
      brand={BRAND}
      items={NAV_ITEMS}
      currentPath={path}
      onNavigate={setPath}
      switcher={{ sections: SWITCHER_SECTIONS, currentAppId: "sear-studio", home: { href: "/workspace" }, exit: { href: "/workspace", iconSrc: workspaceLogo } }}
      notifications={{
        items,
        onItemClick: (n) => setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x))),
        onMarkAllRead: () => setItems((xs) => xs.map((x) => ({ ...x, read: true }))),
      }}
      mobile={{ exit: { href: "/workspace" } }}
      collapsedStorageKey="studio_sidebar_collapsed"
    >
      <ShellPage isAr={isRTL} />
    </AppShell>
  );
}

createRoot(document.getElementById("root")!).render(
  // Same storage keys as Sear so the parity harness can drive both apps identically.
  <ThemeProvider storageKeys={{ theme: "app_theme", language: "app_lang" }} defaultLanguage="ar">
    {view === "shell" ? <ShellDemo />
      : view === "list" ? <div className="sf-app min-h-screen"><FieldLibraryDemo variant={params.get("demo") ?? "sear"} /></div>
      : view === "frappe" ? <div className="sf-app min-h-screen"><FrappeDemo variant={params.get("demo") ?? "default"} /></div>
      : view === "cards" ? <div className="sf-app min-h-screen"><CardsPage /></div>
      : view === "parts" ? <div className="sf-app min-h-screen"><PartsPage /></div>
      : view === "extras" ? <div className="sf-app min-h-screen"><ExtrasPage /></div>
      : view === "merged" ? <div className="sf-app min-h-screen"><MergedPage /></div>
      : <PrimitivesPage />}
  </ThemeProvider>,
);
