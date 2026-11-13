/**
 * FrappeProvider — supplies the Frappe client and, when the app has none, a React Query client.
 * - Inside an app's own `QueryClientProvider`: that client (and its cache) is used.
 * - Otherwise one is created here, with Frappe-aware retries (4xx errors such as PermissionError are not retried).
 * `FrappeListView` wraps itself in one when neither is present, so the simplest use needs no provider at all.
 *
 * 0.4.0: also what Desk has from boot and a React page must supply itself (none of it has a whitelisted 15.110
 * endpoint): the session user and roles (permissions), a translation dictionary (labels), the formatting settings
 * (dates, numbers, currency, time zones) — and the host that shows server messages (msgprint semantics).
 */
import * as React from "react";
import { useLocale } from "../theme/ThemeProvider";
import { QueryClient, QueryClientContext, QueryClientProvider } from "@tanstack/react-query";
import { createFrappeClient, FrappeError, withFrappeApi, type FrappeApi, type FrappeClient } from "./client";
import type { FrappeMessage } from "./contract";
import { FrappeMessagesProvider } from "./feedback/messages";
import type { FrappeBoot } from "./services/boot";
import type { FormatContext } from "./services/format";
import type { FrappeSession } from "./services/permissions";
import type { TranslationDictionary } from "./services/translate";

const FrappeContext = React.createContext<FrappeClient | null>(null);
let sameOrigin: FrappeClient | null = null;

/** The provider's client, or a same-origin client with the default options. */
export function useFrappeClient(): FrappeClient {
  return React.useContext(FrappeContext) ?? (sameOrigin ??= createFrappeClient());
}

/** The provider's client with the 0.4.0 DocumentApi + RecordApi (a 0.3-style custom client is upgraded over its `call`). */
export function useFrappeApi(): FrappeApi {
  const client = useFrappeClient();
  return React.useMemo(() => withFrappeApi(client), [client]);
}

export interface FrappeSettings {
  session?: FrappeSession;
  translations?: TranslationDictionary;
  formatContext?: FormatContext;
  /** New-document user defaults (Desk `frappe.defaults.get_user_defaults`, from boot — `userDefaultsFromBoot`). P35:
   *  FrappeForm, FrappeQuickEntry and FrappeListView's default create apply them unless they are given their own. */
  userDefaults?: Record<string, string | string[]>;
}
const SettingsContext = React.createContext<FrappeSettings>({});
const EMPTY: FormatContext = {};

/** Session, translations and format settings given to the nearest FrappeProvider (none by default). */
export function useFrappeSettings(): FrappeSettings {
  return React.useContext(SettingsContext);
}

/** The FormatContext for `formatValue` from the provider (`formatContext` prop), or {} (Frappe's defaults). */
export function useFormatContext(): FormatContext {
  return React.useContext(SettingsContext).formatContext ?? EMPTY;
}

const NO_RETRY = new Set(["csrf", "session_expired", "too_large"]);
/** Retry network and server errors (twice), never client errors (permission, validation, CSRF, expired session,
 *  too large — whatever the HTTP status they arrived with). */
export const frappeRetry = (failures: number, error: unknown) =>
  !(error instanceof FrappeError && ((error.status >= 400 && error.status < 500) || NO_RETRY.has(error.kind))) && failures < 2;

export function createFrappeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: frappeRetry, refetchOnWindowFocus: false } } });
}

export interface FrappeProviderProps {
  /** Default: a same-origin client (session cookie + CSRF from `window.csrf_token`). */
  client?: FrappeClient;
  /** Use this React Query client. Default: the app's, if there is one above; otherwise a new one. */
  queryClient?: QueryClient;
  /** The logged-in user and roles (Desk: `frappe.session.user`, `frappe.user_roles`). Without roles, permissions are
   *  denied (rule 9: missing information denies) from `docinfo.permissions` (see `buildDocPermissions`). */
  session?: FrappeSession;
  /** Source text → translation for the UI language (Desk: boot `__messages`). 15.110's getdoctype sends none. */
  translations?: TranslationDictionary;
  /** Date / number / currency / time-zone settings (Desk: boot `sysdefaults`, `time_zone`, `:Currency`). */
  formatContext?: FormatContext;
  /**
   * Server messages: "show" (default) shows the `_server_messages` of successful calls made through this client
   * (Desk shows them for every response — the "Saved" alert, …) and hosts `useFrappeMessages`; "host" only hosts
   * `useFrappeMessages`; false renders no host (an outer FrappeProvider's, if any, is used).
   */
  serverMessages?: "show" | "host" | false;
  /**
   * What the page's server render injected (`readFrappeBoot()`): fills `session`, `translations` and `formatContext`
   * when those props are not given, and — when no `client` is given — the default client's CSRF token and comment
   * identity. Explicit props win.
   */
  boot?: FrappeBoot;
  /** New-document user defaults for every form below (P35). Default: `boot.userDefaults` (from `readFrappeBoot()`), else
   *  an outer provider's. `false`: none (forms then use only what they are given — `newDocDefaults.userDefaults`). */
  userDefaults?: Record<string, string | string[]> | false;
  /** Route alert messages (`alert: 1`, e.g. "Saved") elsewhere, e.g. to `toast()` from "@solvfast/ui/toast". Default:
   *  the built-in alert region. */
  onAlert?: (message: FrappeMessage) => void;
  /** Run 1 (A-22): apply the session language (`boot.lang`, Desk `frappe.boot.lang`) to the ThemeProvider above —
   *  direction from Frappe's RTL list (ar, he, fa, ps), chrome Arabic for "ar*", else English. Default true when a
   *  `boot` with a language is given; `false` leaves the language to the app. */
  applyBootLanguage?: boolean;
  /**
   * Run 1 (A-61, Desk request.js:133-140, 430-438): what happens when a request made through this provider's queries or
   * mutations answers "session expired" (401 / `session_expired: 1`) — also for background requests no component shows.
   * "redirect": Desk's `/login?redirect-to=<current path>`; a function: the app's own (e.g. a login dialog). Fired once
   * per burst (several failing requests → one call). Omitted: nothing global (each error state still offers Log in).
   */
  onSessionExpired?: "redirect" | ((error: FrappeError) => void);
  children: React.ReactNode;
}

/** Desk's login redirect (desk.js `redirect_to_login`): `/login?redirect-to=<path + query>`. */
export function loginRedirectUrl(loc: Pick<Location, "pathname" | "search"> = typeof location !== "undefined" ? location : { pathname: "/", search: "" }): string {
  return `/login?redirect-to=${encodeURIComponent(loc.pathname + loc.search)}`;
}

export function FrappeProvider({ client, queryClient, session, translations, formatContext, boot, userDefaults, serverMessages = "show", onAlert, applyBootLanguage = true, onSessionExpired, children }: FrappeProviderProps) {
  // Run 1 A-22: the boot language reaches the ThemeProvider once per value (the user may still switch afterwards)
  const { setLocale } = useLocale();
  const bootLang = boot?.lang;
  React.useEffect(() => { if (applyBootLanguage && bootLang) setLocale(bootLang); }, [applyBootLanguage, bootLang, setLocale]);
  const existing = React.useContext(QueryClientContext);
  const [own] = React.useState(() => queryClient ?? (existing ? undefined : createFrappeQueryClient()));
  // one FrappeApi per client: hooks (useFrappeApi) and the server-message subscription then share the same object,
  // also for a 0.3-style custom client (withFrappeApi wraps it once); it still implements FrappeClient
  const value = React.useMemo(
    () => withFrappeApi(client ?? createFrappeClient(boot ? { csrfToken: boot.csrfToken, session: { user: boot.session.user, fullName: boot.session.fullName } } : {})),
    [client, boot],
  );
  const outer = React.useContext(SettingsContext);
  const settings = React.useMemo(
    () => ({
      session: session ?? boot?.session ?? outer.session,
      translations: translations ?? boot?.translations ?? outer.translations,
      formatContext: formatContext ?? boot?.formatContext ?? outer.formatContext,
      userDefaults: userDefaults === false ? undefined : userDefaults ?? boot?.userDefaults ?? outer.userDefaults,
    }),
    [session, translations, formatContext, boot, outer, userDefaults],
  );
  // Run 1 A-61: a global session-expiry handler over the active query client (queries and mutations), once per burst
  const activeQc = own ?? existing;
  const expiredRef = React.useRef(onSessionExpired);
  expiredRef.current = onSessionExpired;
  React.useEffect(() => {
    if (!onSessionExpired || !activeQc) return;
    let last = 0;
    const seen = (error: unknown) => {
      if (!(error instanceof FrappeError) || error.kind !== "session_expired") return;
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      const h = expiredRef.current;
      if (h === "redirect") { if (typeof window !== "undefined") window.location.assign(loginRedirectUrl()); }
      else h?.(error);
    };
    const offQ = activeQc.getQueryCache().subscribe((e) => { if (e.type === "updated" && e.action.type === "error") seen(e.action.error); });
    const offM = activeQc.getMutationCache().subscribe((e) => { if (e.type === "updated" && e.action.type === "error") seen(e.action.error); });
    return () => { offQ(); offM(); };
  }, [activeQc, !!onSessionExpired]); // eslint-disable-line react-hooks/exhaustive-deps
  const source = serverMessages === "show" ? value : undefined;
  let inner = <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
  if (serverMessages) inner = <FrappeMessagesProvider source={source} onAlert={onAlert}>{inner}</FrappeMessagesProvider>;
  inner = <FrappeContext.Provider value={value}>{inner}</FrappeContext.Provider>;
  return own ? <QueryClientProvider client={own}>{inner}</QueryClientProvider> : inner;
}
