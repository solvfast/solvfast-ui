/**
 * Per-doctype client persistence for <DataGrid>: visible columns and saved filters (localStorage).
 * Saved filters stay client-side so there's no backend dependency — keyed by doctype + the current user
 * (best-effort) so different users don't clobber each other on a shared browser.
 */
import type { FilterQuery } from "./filter-engine";

const COLS = (key: string) => `grid:cols:${key}`;
const SAVED = (key: string) => `grid:saved:${key}`;

export function getColumnPrefs(key: string, fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(COLS(key));
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch {}
  return fallback;
}

export function setColumnPrefs(key: string, cols: string[]) {
  try {
    localStorage.setItem(COLS(key), JSON.stringify(cols));
  } catch {}
}

export interface SavedFilter {
  id: string;
  label: string;
  query: FilterQuery;
}

export function getSavedFilters(key: string): SavedFilter[] {
  try {
    const raw = localStorage.getItem(SAVED(key));
    if (raw) return JSON.parse(raw) as SavedFilter[];
  } catch {}
  return [];
}

export function saveFilter(key: string, label: string, query: FilterQuery): SavedFilter[] {
  const list = getSavedFilters(key);
  const id = `f${Date.now()}`;
  const next = [...list.filter((f) => f.label !== label), { id, label, query }];
  try {
    localStorage.setItem(SAVED(key), JSON.stringify(next));
  } catch {}
  return next;
}

export function deleteSavedFilter(key: string, id: string): SavedFilter[] {
  const next = getSavedFilters(key).filter((f) => f.id !== id);
  try {
    localStorage.setItem(SAVED(key), JSON.stringify(next));
  } catch {}
  return next;
}
