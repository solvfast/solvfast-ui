/**
 * FrappeProvider — supplies the Frappe client and, when the app has none, a React Query client.
 * - Inside an app's own `QueryClientProvider`: that client (and its cache) is used.
 * - Otherwise one is created here, with Frappe-aware retries (4xx errors such as PermissionError are not retried).
 * `FrappeListView` wraps itself in one when neither is present, so the simplest use needs no provider at all.
 */
import * as React from "react";
import { QueryClient, QueryClientContext, QueryClientProvider } from "@tanstack/react-query";
import { createFrappeClient, FrappeError, type FrappeClient } from "./client";

const FrappeContext = React.createContext<FrappeClient | null>(null);
let sameOrigin: FrappeClient | null = null;

/** The provider's client, or a same-origin client with the default options. */
export function useFrappeClient(): FrappeClient {
  return React.useContext(FrappeContext) ?? (sameOrigin ??= createFrappeClient());
}

/** Retry network and server errors (twice), never client errors (permission, validation, CSRF). */
export const frappeRetry = (failures: number, error: unknown) =>
  !(error instanceof FrappeError && error.status >= 400 && error.status < 500) && failures < 2;

export function createFrappeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: frappeRetry, refetchOnWindowFocus: false } } });
}

export interface FrappeProviderProps {
  /** Default: a same-origin client (session cookie + CSRF from `window.csrf_token`). */
  client?: FrappeClient;
  /** Use this React Query client. Default: the app's, if there is one above; otherwise a new one. */
  queryClient?: QueryClient;
  children: React.ReactNode;
}

export function FrappeProvider({ client, queryClient, children }: FrappeProviderProps) {
  const existing = React.useContext(QueryClientContext);
  const [own] = React.useState(() => queryClient ?? (existing ? undefined : createFrappeQueryClient()));
  const value = React.useMemo(() => client ?? createFrappeClient(), [client]);
  const inner = <FrappeContext.Provider value={value}>{children}</FrappeContext.Provider>;
  return own ? <QueryClientProvider client={own}>{inner}</QueryClientProvider> : inner;
}
