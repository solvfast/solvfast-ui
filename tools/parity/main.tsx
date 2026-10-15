import { createRoot } from "react-dom/client";
import "@/index.css"; // Sear's real Tailwind entry (imports sear-studio.css)
import "@ds/styles/glass/glass.css"; // loaded after it, exactly like Sear's main.tsx
import { ThemeProvider, useLocale } from "@ui";
import { Primitives } from "../../playground/src/showcase/Primitives";

function Page() {
  const { isRTL } = useLocale();
  return (
    // Sear's page content sits inside the `.sear-studio` shell root (StudioShell.tsx:536).
    <div className="sear-studio min-h-screen">
      <Primitives isAr={isRTL} />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<ThemeProvider><Page /></ThemeProvider>);
