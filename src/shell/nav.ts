/** Navigation model shared by the Sidebar, Navbar title and MobileNav. Pure TS; routing is the consumer's. */
import type { ComponentType } from "react";
import type { Language } from "../theme/messages";

/** A string, or one string per language. */
export type Localized = string | { en: string; ar: string };
export const loc = (l: Localized | undefined, language: Language): string =>
  l == null ? "" : typeof l === "string" ? l : l[language] ?? l.en;

export interface NavItem {
  /** Stable id (React key). */
  id: string;
  label: Localized;
  icon?: ComponentType<{ className?: string }>;
  /** Where the item navigates (handed to `onNavigate`). A parent's href is used when the rail is collapsed. */
  href?: string;
  children?: NavItem[];
  /** Hrefs under which this item must NOT read as active, even though they are nested under its href
   *  (a sibling owns that sub-tree) — Sear's `exclude`. */
  exclude?: string[];
}

/** Exact match or nested under (`/a` is active for `/a/b`, not for `/ab`). */
export const pathMatches = (currentPath: string, href?: string): boolean =>
  !!href && (currentPath === href || currentPath.startsWith(href.endsWith("/") ? href : `${href}/`));

export type IsActive = (item: NavItem, currentPath: string) => boolean;

/** Default active rule (Sear's): own href or any descendant matches, unless an `exclude` path matches. */
export const defaultIsActive: IsActive = (item, currentPath) => {
  if (item.exclude?.some((ex) => pathMatches(currentPath, ex))) return false;
  return pathMatches(currentPath, item.href) || !!item.children?.some((c) => defaultIsActive(c, currentPath));
};

/** The deepest item whose href matches — the page title (Sear's TopBar rule). */
export function deepestActive(items: NavItem[], currentPath: string): NavItem | undefined {
  const flat: NavItem[] = [];
  const walk = (list: NavItem[]) => list.forEach((i) => { flat.push(i); if (i.children) walk(i.children); });
  walk(items);
  return flat
    .filter((i) => pathMatches(currentPath, i.href))
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];
}
