import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { Layers } from "lucide-react";
import "@/index.css"; // Sear's real Tailwind entry (imports sear-studio.css)
import "@ds/styles/glass/glass.css"; // loaded after it, exactly like Sear's main.tsx
import { ThemeProvider, useLocale } from "@ui";
import { StudioShell } from "@/sear_studio_app/StudioShell";
import { NAV_ITEMS } from "@/sear_studio_app/SearStudioLayout";
import { SEAR_STUDIO_BASE } from "@sear/lib/searStudioBase";
import searStudioLogo from "@/assets/applogos/apps/sear.png";
import { Primitives } from "../../playground/src/showcase/Primitives";
import { ShellPage } from "../../playground/src/showcase/ShellPage";

const params = new URLSearchParams(location.search);
const view = params.get("view") ?? "primitives";

function PrimitivesPage() {
  const { isRTL } = useLocale();
  return (
    // Sear's page content sits inside the `.sear-studio` shell root (StudioShell.tsx:536).
    <div className="sear-studio min-h-screen">
      <Primitives isAr={isRTL} />
    </div>
  );
}

/** Sear's REAL shell with the exact props SearStudioLayout.tsx passes. */
function SearShell() {
  const { isRTL } = useLocale();
  return (
    <MemoryRouter initialEntries={[params.get("path") ?? `${SEAR_STUDIO_BASE}/overview`]}>
      <StudioShell
        brandLabel="Sayr Studio"
        brandIcon={Layers}
        brandLogoSrc={searStudioLogo}
        brandLogoClassName="w-14 h-14"
        brandLabelClassName="text-brand-violet"
        navItems={NAV_ITEMS}
        basePath={SEAR_STUDIO_BASE}
        currentAppName="Sayr Studio"
      >
        <ShellPage isAr={isRTL} />
      </StudioShell>
    </MemoryRouter>
  );
}

createRoot(document.getElementById("root")!).render(<ThemeProvider>{view === "shell" ? <SearShell /> : <PrimitivesPage />}</ThemeProvider>);
