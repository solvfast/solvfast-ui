import { createRoot } from "react-dom/client";
import "@solvfast/ui/full.css";
import "@solvfast/ui/full-base.css";
import "./layout.css"; // the app's own layout CSS (path B apps style their own layout)
import { ThemeProvider, useLocale } from "@solvfast/ui";
import { Primitives } from "./Primitives";

function Page() {
  const { isRTL } = useLocale();
  return <div className="sf-app min-h-screen"><Primitives isAr={isRTL} /></div>;
}
createRoot(document.getElementById("root")!).render(
  <ThemeProvider storageKeys={{ theme: "app_theme", language: "app_lang" }} defaultLanguage="ar"><Page /></ThemeProvider>,
);
