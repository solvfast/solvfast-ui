import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { type Language, type Direction, getDirection, translations } from "@/lib/i18n";

type Theme = "light" | "dark";

interface AppContextValue {
  language: Language;
  direction: Direction;
  theme: Theme;
  setLanguage: (l: Language) => void;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  t: (key: string) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

/* This provider is the SINGLE owner of language, direction and theme.
 *
 * It previously competed with shared/i18n/LanguageProvider, shared/theme/ThemeProvider and
 * sear_studio/contexts/DirectionContext, all of which wrote <html dir>/<html class="dark">
 * independently. Those are now thin adapters over this context, so Radix's DirectionProvider
 * below can no longer go stale while <html dir> flips (which mis-aligned every popper after a
 * language toggle).
 *
 * Canonical storage keys are app_lang/app_theme, but the LEGACY keys are read FIRST: the
 * user-facing toggles used to write bina_lang/bina_theme, so those hold the real preference.
 * All aliases are kept in sync for non-React readers (injected overlays, portable fallbacks).
 */
const LANG_KEY = "app_lang";
const THEME_KEY = "app_theme";
const LEGACY_LANG_KEYS = ["bina_lang"];
const LEGACY_THEME_KEYS = ["bina_theme", "theme"];
const DIR_KEY = "direction";

// House default: Arabic-first + RTL. English/LTR fully supported via the toggle.
const DEFAULT_LANG: Language = "ar";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked storage */
  }
}

function readLang(): Language {
  for (const k of [...LEGACY_LANG_KEYS, LANG_KEY]) {
    const v = read(k);
    if (v === "ar" || v === "en") return v;
  }
  return DEFAULT_LANG;
}
function readTheme(): Theme {
  for (const k of [...LEGACY_THEME_KEYS, THEME_KEY]) {
    const v = read(k);
    if (v === "light" || v === "dark") return v;
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>(readLang);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const direction = getDirection(language);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = language;
    el.dir = direction;
    write(LANG_KEY, language);
    LEGACY_LANG_KEYS.forEach((k) => write(k, language));
    write(DIR_KEY, direction);
  }, [language, direction]);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", theme === "dark");
    // The DS glass engine themes from [data-theme] and falls back to the OS scheme without it.
    el.dataset.theme = theme;
    write(THEME_KEY, theme);
    LEGACY_THEME_KEYS.forEach((k) => write(k, theme));
  }, [theme]);

  // Injected overlays live outside React and ask for a theme flip via this event.
  useEffect(() => {
    const handler = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
    window.addEventListener("bina:toggle-dark", handler);
    return () => window.removeEventListener("bina:toggle-dark", handler);
  }, []);

  const setLanguage = useCallback((l: Language) => setLang(l), []);
  const toggleLanguage = useCallback(() => setLang((l) => (l === "ar" ? "en" : "ar")), []);
  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  const t = useCallback((key: string) => translations[language][key] ?? translations.en[key] ?? key, [language]);

  return (
    <AppContext.Provider value={{ language, direction, theme, setLanguage, toggleLanguage, toggleTheme, t }}>
      {/* Radix primitives (dropdown, tabs, select, tooltip…) read direction from here, not from <html dir>. */}
      <DirectionProvider dir={direction}>{children}</DirectionProvider>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}

/** Non-throwing accessor for components reused outside the provider tree (e.g. AppSwitcher). */
export function useAppSafe() {
  return useContext(AppContext);
}
