/**
 * Data layer. The backend is **Frappe** (NOT Supabase). In the Frontend phase we run in MOCK mode
 * (localStorage), shaping calls to match the architecture API contract so the Backend phase can swap in
 * real whitelisted methods with the same function names + payloads.
 */

export const APP_NAME = "sear_product";

declare global {
  interface Window {
    csrf_token?: string;
  }
}

async function postMethod(method: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`/api/method/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Frappe-CSRF-Token": window.csrf_token || "" },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    let msg = "Request failed";
    try {
      if (data._server_messages) msg = JSON.parse(data._server_messages).map((m: string) => JSON.parse(m).message).join(", ");
    } catch {}
    throw new Error(msg);
  }
  return data;
}

/** Call a real Frappe whitelisted method: POST /api/method/<app>.api.<fn>. Returns `message`. */
export async function callMethod<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await postMethod(`${APP_NAME}.api.${fn}`, args)).message as T;
}

/** Call ANY whitelisted Frappe method by full dotted path (built-ins like `frappe.client.get_list`).
 * Returns `message`. Used by <DataGrid> so list/meta work with no per-app backend. */
export async function frappeCall<T = any>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await postMethod(method, args)).message as T;
}

/** Like `frappeCall` but returns the FULL response — for methods that write a top-level key (e.g.
 * `frappe.desk.form.load.getdoctype` puts meta in `.docs`, not `.message`). */
export async function frappeCallRaw(method: string, args: Record<string, unknown> = {}): Promise<any> {
  return postMethod(method, args);
}

/** Tiny localStorage-backed mock store for the Frontend phase. Replace with `callMethod` in the Backend phase. */
export const mockStore = {
  read<T>(key: string, seed: T): T {
    try {
      const raw = localStorage.getItem(`mock:${key}`);
      if (raw) return JSON.parse(raw) as T;
    } catch {}
    localStorage.setItem(`mock:${key}`, JSON.stringify(seed));
    return seed;
  },
  write<T>(key: string, value: T): T {
    localStorage.setItem(`mock:${key}`, JSON.stringify(value));
    return value;
  },
};
