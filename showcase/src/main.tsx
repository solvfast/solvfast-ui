import { createRoot } from "react-dom/client";
import "./index.css";
import "../../styles/glass.css"; // a separate stylesheet after the Tailwind one (path A)
import { ThemeProvider } from "@ui";
import { Toaster } from "@ui/toast";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider storageKeys={{ theme: "sfui-showcase-theme", language: "sfui-showcase-lang" }} defaultTheme="light" defaultLanguage="en">
    <App />
    <Toaster />
  </ThemeProvider>,
);
