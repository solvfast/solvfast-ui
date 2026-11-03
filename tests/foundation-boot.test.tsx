/**
 * Foundation — readFrappeBoot / FrappeProvider `boot`. The payload below is AUTHORED in the shape the CRM page's
 * server render emits (crm-boot `serve_fast/www/serve_fast.py`); no site was involved.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FrappeProvider, useFormatContext, useFrappeApi, useFrappeSettings } from "../src/frappe/FrappeProvider";
import { formatValue, readFrappeBoot, translateLabel } from "../src/frappe/services";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete (globalThis as Record<string, unknown>).__sf_boot; });

const PAYLOAD = {
  user: "ann@x.com", full_name: "Ann Smith", roles: ["All", "Sales User"], lang: "ar", csrf_token: "tok-123",
  sysdefaults: {
    date_format: "dd-mm-yyyy", time_format: "HH:mm", number_format: "#.###,##", float_precision: "2", currency_precision: "",
    currency: "SAR", rounding_method: "Commercial Rounding", hide_currency_symbol: "No", use_number_format_from_currency: "0", first_day_of_the_week: "Sunday",
  },
  time_zone: { system: "UTC", user: "Asia/Riyadh" },
  currencies: { SAR: { symbol: "﷼", symbol_on_right: 1, number_format: "#,###.##", fraction_units: 100 } },
  translations: { Status: "الحالة", Open: "مفتوح" },
};

describe("readFrappeBoot", () => {
  it("maps the payload to session, csrfToken, formatContext and translations", () => {
    const b = readFrappeBoot(PAYLOAD)!;
    expect(b.session).toEqual({ user: "ann@x.com", fullName: "Ann Smith", roles: ["All", "Sales User"] });
    expect(b).toMatchObject({ lang: "ar", csrfToken: "tok-123", isGuest: false, translations: { Status: "الحالة" } });
    expect(b.formatContext).toMatchObject({
      dateFormat: "dd-mm-yyyy", timeFormat: "HH:mm", numberFormat: "#.###,##", floatPrecision: 2, currency: "SAR",
      roundingMethod: "Commercial Rounding", hideCurrencySymbol: false, useNumberFormatFromCurrency: false,
      timeZone: { system: "UTC", user: "Asia/Riyadh" },
    });
    expect(b.formatContext.currencyPrecision).toBeUndefined(); // "" = not set
    expect(b.sysdefaults.first_day_of_the_week).toBe("Sunday");
    expect(formatValue("Open", { fieldname: "s", fieldtype: "Select" }, undefined, b.formatContext)).toBe("مفتوح");
    expect(formatValue(1234.5, { fieldname: "a", fieldtype: "Currency" }, undefined, b.formatContext)).toBe("1.234,50 ﷼");
    expect(formatValue("2026-11-03 09:00:00", { fieldname: "d", fieldtype: "Datetime" }, undefined, b.formatContext)).toBe("03-11-2026 12:00");
  });

  it("reads window.__sf_boot by default; guest → session only, no token; malformed or absent → undefined", () => {
    expect(readFrappeBoot()).toBeUndefined();
    (globalThis as Record<string, unknown>).__sf_boot = { user: "Guest", csrf_token: "should-not-be-used" };
    expect(readFrappeBoot()).toMatchObject({ session: { user: "Guest", roles: ["Guest"] }, isGuest: true, csrfToken: undefined, formatContext: {} });
    expect(readFrappeBoot("{{ boot_json }}")).toBeUndefined(); // the raw template (Vite dev server)
    expect(readFrappeBoot([1, 2])).toBeUndefined();
    expect(readFrappeBoot({ roles: [] })).toBeUndefined();
  });
});

describe("FrappeProvider boot", () => {
  const wrap = (props: Partial<React.ComponentProps<typeof FrappeProvider>>) => ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}><FrappeProvider {...props}>{children}</FrappeProvider></QueryClientProvider>
  );

  it("fills session, translations and formatContext; explicit props win", () => {
    const boot = readFrappeBoot(PAYLOAD)!;
    const { result } = renderHook(() => ({ settings: useFrappeSettings(), fc: useFormatContext() }), { wrapper: wrap({ boot }) });
    expect(result.current.settings.session?.roles).toEqual(["All", "Sales User"]);
    expect(translateLabel(undefined, "Status", result.current.settings.translations)).toBe("الحالة");
    expect(result.current.fc.dateFormat).toBe("dd-mm-yyyy");
    const own = renderHook(() => useFrappeSettings(), { wrapper: wrap({ boot, session: { user: "x@y" } }) });
    expect(own.result.current.session).toEqual({ user: "x@y" });
  });

  it("the default client sends the boot's CSRF token and comment identity", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message: { name: "CM-1", content: "x", owner: "ann@x.com", creation: "c" } }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => useFrappeApi(), { wrapper: wrap({ boot: readFrappeBoot(PAYLOAD)! }) });
    await result.current.addComment("Lead", "L-1", "x");
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-Frappe-CSRF-Token"]).toBe("tok-123");
    expect(JSON.parse(String(init.body))).toMatchObject({ comment_email: "ann@x.com", comment_by: "Ann Smith" });
  });
});
