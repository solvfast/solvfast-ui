// From Solvfast PMO frontend/src/components/layouts/PageHeader.tsx (pristine copy + sha256 in upstream/pmo/) — see
// VENDORED.md. PMO's header is the Design System's PageHeader (= Sear's) plus a back button and a details row; same
// markup and classes. Router-free: `onBack` instead of `backTo` + react-router; the label comes from the package
// messages; the arrow follows the reading direction (useLocale). The back button is the package's ghost icon button.
// Inside an AppShell (Sear's pattern: the glass top bar's title IS the page title, pages have no heading of their own)
// a text title goes to the top bar instead of an in-page <h1>.
import * as React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "../lib/cn";
import { loc, type Localized } from "../lib/localized";
import { useLocale } from "../theme/ThemeProvider";
import { Button } from "./button";

/* ---- The shell's page title: PageHeaders publish, AppShell shows it in its top bar ------------------------------ */

interface ShellTitleApi {
  publish: (id: string, title: Localized) => void;
  unpublish: (id: string) => void;
}
/** Provided by AppShell around the page content. Internal (not exported from the package). */
export const ShellTitleContext = React.createContext<ShellTitleApi | null>(null);

const sameTitle = (a: Localized, b: Localized) =>
  typeof a === "string" || typeof b === "string" ? a === b : a.en === b.en && a.ar === b.ar;

/** For AppShell: the title published by the most recently mounted PageHeader (undefined when none), and the API. */
export function useShellTitleHost(): [Localized | undefined, ShellTitleApi] {
  const [stack, setStack] = React.useState<{ id: string; title: Localized }[]>([]);
  const api = React.useMemo<ShellTitleApi>(() => ({
    publish: (id, title) => setStack((s) => {
      const i = s.findIndex((e) => e.id === id);
      if (i < 0) return [...s, { id, title }];
      if (sameTitle(s[i].title, title)) return s;
      const next = s.slice();
      next[i] = { id, title };
      return next;
    }),
    unpublish: (id) => setStack((s) => (s.some((e) => e.id === id) ? s.filter((e) => e.id !== id) : s)),
  }), []);
  return [stack.length ? stack[stack.length - 1].title : undefined, api];
}

const isLocalized = (v: unknown): v is Localized =>
  (typeof v === "string" && v !== "") ||
  (!!v && typeof v === "object" && !React.isValidElement(v) && typeof (v as { en?: unknown }).en === "string" && typeof (v as { ar?: unknown }).ar === "string");

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/* ---- PageHeader ------------------------------------------------------------------------------------------------- */

export interface PageHeaderProps {
  /** The page title: text (`string` or `{ en, ar }`), or any node. Inside an AppShell, text goes to the top bar. */
  title: React.ReactNode | Localized;
  subtitle?: React.ReactNode;
  /** A details row under the title (status, dates, owner…). */
  meta?: React.ReactNode;
  /** End-aligned actions. */
  actions?: React.ReactNode;
  /** Shows a back button at the start (navigate in it, e.g. `() => navigate(-1)`). */
  onBack?: () => void;
  /** The back button's accessible name and tooltip (default: the "back" message — "Back" / "رجوع"). */
  backLabel?: string;
  className?: string;
}

/**
 * Consistent page header. Layout (start → end): [ back ] [ title / subtitle / meta ] …………… [ actions ].
 * Outside an AppShell the title is the page's <h1>. Inside one, a text title becomes the top bar's title (the page's
 * <h1>) while this header is mounted, and the header shows only the back button, subtitle, meta and actions — nothing
 * when none is set. A non-text title (a node) always stays in place. AppShell's own `title` prop still wins.
 */
export function PageHeader({ title, subtitle, meta, actions, onBack, backLabel, className }: PageHeaderProps) {
  const { t, isRTL, language } = useLocale();
  const shell = React.useContext(ShellTitleContext);
  const id = React.useId();
  const text = isLocalized(title) ? title : null;
  const toShell = !!shell && text !== null;
  const key = text === null ? null : typeof text === "string" ? text : `${text.en}\u0001${text.ar}`;
  const latest = React.useRef(text);
  latest.current = text;
  useIsoLayoutEffect(() => {
    if (!shell || key === null || !latest.current) return;
    shell.publish(id, latest.current);
    return () => shell.unpublish(id);
  }, [shell, key, id]);

  const Back = isRTL ? ArrowRight : ArrowLeft;
  const label = backLabel ?? t("back");
  if (toShell && !onBack && !subtitle && !meta && !actions) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-4 md:px-6", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {onBack && (
          <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={onBack} aria-label={label} title={label}>
            <Back className="h-4 w-4" aria-hidden />
          </Button>
        )}
        <div className="min-w-0">
          {!toShell && <h1 className="truncate text-lg font-semibold tracking-tight">{text !== null ? loc(text, language) : (title as React.ReactNode)}</h1>}
          {subtitle && <p className={cn("truncate text-sm text-muted-foreground", !toShell && "mt-0.5")}>{subtitle}</p>}
          {meta && <div className={cn(!(toShell && !subtitle) && "mt-1.5")}>{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
