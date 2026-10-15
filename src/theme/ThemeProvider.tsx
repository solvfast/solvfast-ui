import * as React from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { defaultMessages, type Language, type Messages } from "./messages";

export type Theme = "light" | "dark";
export type Direction = "ltr" | "rtl";

/** localStorage keys, read in order (first hit wins) and all written on change. */
export interface StorageKeys {
  theme?: string | string[];
  language?: string | string[];
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Initial theme when nothing is stored. Default: the OS `prefers-color-scheme`. */
  defaultTheme?: Theme;
  /** Initial language when nothing is stored. Default: "en". */
  defaultLanguage?: Language;
  /** Controlled theme / language (pair with the change callbacks). */
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  language?: Language;
  onLanguageChange?: (language: Language) => void;
  /** Persistence keys. Default `{ theme: "sf-theme", language: "sf-lang" }`; pass `null` to disable. */
  storageKeys?: StorageKeys | null;
  /**
   * "document" (default): classes and attributes go on <html>, so every portal inherits the tokens.
   * "element": they go on a wrapper <div> instead, and popups render into a portal host inside it.
   */
  scope?: "document" | "element";
  /** Extra class names for the element-scope wrapper. */
  className?: string;
  /** Override or extend the package's chrome strings (merged per language). */
  messages?: { [L in Language]?: Partial<Messages> };
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  language: Language;
  direction: Direction;
  isRTL: boolean;
  setLanguage: (l: Language) => void;
  toggleLanguage: () => void;
  t: (key: keyof Messages) => string;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);
const PortalContainerContext = React.createContext<HTMLElement | null>(null);

const DEFAULT_KEYS = { theme: "sf-theme", language: "sf-lang" };
const asList = (k?: string | string[]) => (k == null ? [] : Array.isArray(k) ? k : [k]);
const store = {
  read(keys: string[]): string | null {
    try {
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v != null) return v;
      }
    } catch {
      /* storage unavailable (private mode, sandbox) */
    }
    return null;
  },
  write(keys: string[], value: string) {
    try {
      for (const k of keys) localStorage.setItem(k, value);
    } catch {
      /* ignore */
    }
  },
};

function systemTheme(): Theme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({
  children,
  defaultTheme,
  defaultLanguage = "en",
  theme: themeProp,
  onThemeChange,
  language: languageProp,
  onLanguageChange,
  storageKeys = DEFAULT_KEYS,
  scope = "document",
  className,
  messages,
}: ThemeProviderProps) {
  const themeKeys = storageKeys ? asList(storageKeys.theme ?? DEFAULT_KEYS.theme) : [];
  const langKeys = storageKeys ? asList(storageKeys.language ?? DEFAULT_KEYS.language) : [];

  const [themeState, setThemeState] = React.useState<Theme>(() => {
    const v = store.read(themeKeys);
    return v === "dark" || v === "light" ? v : defaultTheme ?? systemTheme();
  });
  const [langState, setLangState] = React.useState<Language>(() => {
    const v = store.read(langKeys);
    return v === "ar" || v === "en" ? v : defaultLanguage;
  });
  const theme = themeProp ?? themeState;
  const language = languageProp ?? langState;
  const direction: Direction = language === "ar" ? "rtl" : "ltr";

  const setTheme = React.useCallback(
    (t: Theme) => {
      if (themeProp === undefined) setThemeState(t);
      store.write(themeKeys, t);
      onThemeChange?.(t);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [themeProp, onThemeChange, themeKeys.join("|")],
  );
  const setLanguage = React.useCallback(
    (l: Language) => {
      if (languageProp === undefined) setLangState(l);
      store.write(langKeys, l);
      onLanguageChange?.(l);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [languageProp, onLanguageChange, langKeys.join("|")],
  );

  // document scope: apply to <html> (and undo on unmount so the page is left as it was found)
  React.useLayoutEffect(() => {
    if (scope !== "document") return;
    const html = document.documentElement;
    const prev = { cls: html.className, theme: html.getAttribute("data-theme"), lang: html.getAttribute("lang"), dir: html.getAttribute("dir") };
    html.classList.add("sf-theme");
    html.classList.toggle("dark", theme === "dark");
    html.setAttribute("data-theme", theme);
    html.setAttribute("lang", language);
    html.setAttribute("dir", direction);
    return () => {
      html.className = prev.cls;
      for (const [attr, v] of [["data-theme", prev.theme], ["lang", prev.lang], ["dir", prev.dir]] as const) {
        if (v == null) html.removeAttribute(attr);
        else html.setAttribute(attr, v);
      }
    };
  }, [scope, theme, language, direction]);

  const merged = React.useMemo(() => ({ ...defaultMessages[language], ...(messages?.[language] ?? {}) }), [language, messages]);
  const value = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
      language,
      direction,
      isRTL: direction === "rtl",
      setLanguage,
      toggleLanguage: () => setLanguage(language === "ar" ? "en" : "ar"),
      t: (key) => merged[key] ?? String(key),
    }),
    [theme, setTheme, language, direction, setLanguage, merged],
  );

  const [portalHost, setPortalHost] = React.useState<HTMLElement | null>(null);
  const content = <DirectionProvider dir={direction}>{children}</DirectionProvider>;

  if (scope === "element") {
    return (
      <ThemeContext.Provider value={value}>
        <div className={["sf-theme", theme === "dark" ? "dark" : "", className ?? ""].join(" ").trim()} data-theme={theme} lang={language} dir={direction}>
          <PortalContainerContext.Provider value={portalHost}>{content}</PortalContainerContext.Provider>
          <div ref={setPortalHost} data-sf-portal-host="" />
        </div>
      </ThemeContext.Provider>
    );
  }
  return <ThemeContext.Provider value={value}>{content}</ThemeContext.Provider>;
}

/** Fallback used when a component renders outside <ThemeProvider>: reads <html> and never throws. */
function fallback(): ThemeContextValue {
  const html = typeof document !== "undefined" ? document.documentElement : null;
  const language: Language = html?.getAttribute("lang") === "ar" ? "ar" : "en";
  const theme: Theme = html?.classList.contains("dark") ? "dark" : "light";
  const direction: Direction = language === "ar" ? "rtl" : "ltr";
  const noop = () => {};
  return {
    theme, setTheme: noop, toggleTheme: noop,
    language, direction, isRTL: direction === "rtl", setLanguage: noop, toggleLanguage: noop,
    t: (key) => defaultMessages[language][key] ?? String(key),
  };
}

function useThemeContext(): ThemeContextValue {
  return React.useContext(ThemeContext) ?? fallback();
}

/** Theme state and setters. Safe outside a provider (read-only fallback). */
export function useTheme() {
  const { theme, setTheme, toggleTheme } = useThemeContext();
  return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
}

/** Language, direction and the package's translated chrome strings. Safe outside a provider. */
export function useLocale() {
  const { language, direction, isRTL, setLanguage, toggleLanguage, t } = useThemeContext();
  return { language, direction, isRTL, setLanguage, toggleLanguage, t };
}

/** Where popups should portal to: the element-scope host, or undefined (document.body). */
export function usePortalContainer(): HTMLElement | undefined {
  return React.useContext(PortalContainerContext) ?? undefined;
}
