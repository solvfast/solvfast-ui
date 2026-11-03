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
   *  approximated from `docinfo.permissions` (see `buildDocPermissions`). */
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
  /** Route alert messages (`alert: 1`, e.g. "Saved") elsewhere, e.g. to `toast()` from "@solvfast/ui/toast". Default:
   *  the built-in alert region. */
  onAlert?: (message: FrappeMessage) => void;
  children: React.ReactNode;
}

export function FrappeProvider({ client, queryClient, session, translations, formatContext, boot, serverMessages = "show", onAlert, children }: FrappeProviderProps) {
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
    }),
    [session, translations, formatContext, boot, outer],
  );
  const source = serverMessages === "show" ? value : undefined;
  let inner = <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
  if (serverMessages) inner = <FrappeMessagesProvider source={source} onAlert={onAlert}>{inner}</FrappeMessagesProvider>;
  inner = <FrappeContext.Provider value={value}>{inner}</FrappeContext.Provider>;
  return own ? <QueryClientProvider client={own}>{inner}</QueryClientProvider> : inner;
}
