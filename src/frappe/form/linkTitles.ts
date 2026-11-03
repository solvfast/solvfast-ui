/**
 * Link titles (Desk `frappe._link_titles`, docs `12` §4.3): the label shown for a Link value, remembered from search
 * results and picks. Desk keeps them for one page session; here they are scoped to the FrappeProvider's client AND the
 * session user (R1-F10), so two providers (or a user switch) never share titles.
 */
import * as React from "react";
import { useFrappeClient, useFrappeSettings } from "../FrappeProvider";

export interface LinkTitleCache {
  get(doctype: string, name: string): string | undefined;
  /** Ignored when the title is empty or equals the name. */
  remember(doctype: string, name: string, title: string): void;
}

const byScope = new WeakMap<object, Map<string, string>>();

/** The title cache of one scope (a client object) for one user. */
export function linkTitleCache(scope: object, user = ""): LinkTitleCache {
  let map = byScope.get(scope);
  if (!map) { map = new Map(); byScope.set(scope, map); }
  const m = map;
  const key = (doctype: string, name: string) => `${user}\u0000${doctype}::${name}`;
  return {
    get: (doctype, name) => m.get(key(doctype, name)),
    remember: (doctype, name, title) => { if (title && title !== name) m.set(key(doctype, name), title); },
  };
}

/** The title cache of the nearest FrappeProvider's client and session user. */
export function useLinkTitles(): LinkTitleCache {
  const client = useFrappeClient();
  const { session } = useFrappeSettings();
  return React.useMemo(() => linkTitleCache(client, session?.user), [client, session?.user]);
}
