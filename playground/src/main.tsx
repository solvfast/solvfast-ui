import { createRoot } from "react-dom/client";
import "./index.css";
import "../../styles/glass.css"; // separate stylesheet after the Tailwind one (path A)
import { ThemeProvider, useLocale } from "@ui";
import { Primitives } from "./showcase/Primitives";

function Page() {
  const { isRTL } = useLocale();
  return (
    <div className="sf-app min-h-screen">
      <Primitives isAr={isRTL} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  // Same storage keys as Sear so the parity harness can drive both apps identically.
  <ThemeProvider storageKeys={{ theme: "app_theme", language: "app_lang" }} defaultLanguage="ar">
    <Page />
  </ThemeProvider>,
);
