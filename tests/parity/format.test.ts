/**
 * `formatValue` and `translateLabel` — apps/frappe/frappe/public/js/frappe/form/formatters.js:420-438 (dispatch) and the
 * per-fieldtype formatters (Float :55-82, Percent :93-103, Currency :123-162, Date :220-233, Datetime :244-254,
 * Time :274-280, Duration :281-288) + utils/number_format.js:90-177 (`format_number`, `format_currency`),
 * utils/utils.js:1115-1175 (duration), utils/datetime.js (user formats).
 * Cypress: control_data.js "check custom formatters"; control_date.js; datetime.js (format matrix); control_float.js;
 * control_currency.js; rounding.js. Python: test_fmt_money.py (server `fmt_money`).
 *
 * `formatValue` returns a STRING (CONTRACT-0.4.md §2). Desk returns HTML; the strings below are the visible text.
 * Implementation under test (A1): src/frappe/services/format.ts `formatValue`, services/translate.ts `translateLabel`.
 *
 * Numbers assume number_format "#,###.##". Everything not derivable from the cited source is `it.todo`, not guessed.
 */
import { describe, expect, it } from "vitest";
import type { FrappeDocField } from "../../src/frappe/contract";
import { formatValue, type FormatContext } from "../../src/frappe/services/format";
import { fieldOf, loadBundle, translateLabel } from "./seam";

const df = (fieldtype: string, extra: Partial<FrappeDocField> = {}): FrappeDocField => ({ fieldname: "f", fieldtype, ...extra });

const ctx: FormatContext = {
  dateFormat: "dd-mm-yyyy",
  timeFormat: "HH:mm:ss",
  numberFormat: "#,###.##",
  floatPrecision: 3,
  currencyPrecision: 2,
  currency: "USD",
  roundingMethod: "Banker's Rounding (legacy)",
  timeZone: { system: "Asia/Riyadh", user: "Asia/Dubai" }, // +3 / +4, no DST
  currencies: { USD: { symbol: "$" }, SAR: { symbol: "SAR", symbol_on_right: 1 } },
};

describe("formatValue — null / dispatch", () => {
  it("null and undefined -> ''", () => {
    for (const t of ["Data", "Int", "Float", "Currency", "Percent", "Date", "Datetime", "Time"]) {
      expect(formatValue(null, df(t), undefined, ctx), t).toBe("");
    }
  });
  it("unknown fieldtypes fall back to the Data formatter (formatters.js:415-418)", () => {
    expect(formatValue("abc", df("Some Future Type"), undefined, ctx)).toBe("abc");
  });
  it("Data returns the string unchanged (escaping is the renderer's job; never HTML)", () => {
    expect(formatValue("<b>x</b>", df("Data"), undefined, ctx)).toBe("<b>x</b>");
  });
});

describe("formatValue — numbers", () => {
  it("Float: a value without decimals drops them (1.000000 -> 1, formatters.js:67-74)", () => {
    expect(formatValue(1, df("Float"), undefined, ctx)).toBe("1");
    expect(formatValue("1.000000", df("Float"), undefined, ctx)).toBe("1");
  });
  it("Float: groups thousands with the system format and uses float_precision for fractions", () => {
    expect(formatValue(1234.5, df("Float"), undefined, ctx)).toBe("1,234.500");
  });
  it("Float: df.precision wins over float_precision", () => {
    expect(formatValue(1234.5678, df("Float", { precision: "2" }), undefined, ctx)).toBe("1,234.57");
  });
  it("Float: a small df.precision rounds the fraction", () => {
    expect(formatValue(0.125, df("Float", { precision: "1" }), undefined, ctx)).toBe("0.1");
  });
  it("Percent: default precision 2 when neither df.precision nor float_precision is set, '%' suffix, no clamp", () => {
    const c = { ...ctx, floatPrecision: undefined };
    expect(formatValue(45.678, df("Percent"), undefined, c)).toBe("45.68%");
    expect(formatValue(150, df("Percent"), undefined, c)).toBe("150.00%");
  });
  it("Percent: float_precision applies when set", () => {
    expect(formatValue(45.678, df("Percent"), undefined, ctx)).toBe("45.678%");
  });
  it("Int: cint of the value, no grouping in the formatter output", () => {
    expect(formatValue("42", df("Int"), undefined, ctx)).toBe("42");
  });
  it("Currency: symbol, space, grouped number with currency_precision (format_currency, number_format.js:145-163)", () => {
    expect(formatValue(1234.5, df("Currency", { options: "currency" }), { doctype: "X", name: "x", currency: "USD" }, ctx)).toBe("$ 1,234.50");
  });
  it("Currency: symbol_on_right puts the symbol after the number", () => {
    expect(formatValue(1234.5, df("Currency", { options: "currency" }), { doctype: "X", name: "x", currency: "SAR" }, ctx)).toBe("1,234.50 SAR");
  });
  it("Currency: hide_currency_symbol == 'Yes' removes the symbol", () => {
    const c = { ...ctx, hideCurrencySymbol: true };
    expect(formatValue(1234.5, df("Currency", { options: "currency" }), { doctype: "X", name: "x", currency: "USD" }, c)).toBe("1,234.50");
  });
  it("Currency: df.precision 0 is honoured (typeof precision == 'number' branch)", () => {
    expect(formatValue(1234.6, df("Currency", { precision: 0 as unknown as string }), undefined, ctx)).toBe("$ 1,235");
  });
  it.todo("Currency without a resolvable currency field falls back to sysdefaults.currency (meta.js:290-321)");
  it.todo("negative numbers keep the minus attached in RTL (number_format.js:120-125) — assert on a bidi-aware renderer instead");
});

// Duration: native form/formatters.js:281-288 + utils/utils.js:1115-1175 print "1d 2h 3m 4s" / "0s" (A1 added the case;
// these were it.fails while it was missing).
describe("formatValue — dates and durations (user formats; storage formats in, display out)", () => {
  it("Date: system YYYY-MM-DD -> user format (dd-mm-yyyy)", () => {
    expect(formatValue("2026-01-02", df("Date"), undefined, ctx)).toBe("02-01-2026");
  });
  it("Date: invalid -> '' (str_to_user, formatters.js:220-233)", () => {
    expect(formatValue("not-a-date", df("Date"), undefined, ctx)).toBe("");
  });
  it("Datetime: converted system tz -> user tz, microseconds dropped", () => {
    expect(formatValue("2026-01-02 10:00:00.123456", df("Datetime"), undefined, ctx)).toBe("02-01-2026 11:00:00");
  });
  it("Datetime without timezone info configured: plain formatting, no shift", () => {
    expect(formatValue("2026-01-02 10:00:00", df("Datetime"), undefined, { ...ctx, timeZone: undefined })).toBe("02-01-2026 10:00:00");
  });
  it("Time: accepts the unpadded server form '9:30:00' and pads with time_format; NO time-zone conversion", () => {
    expect(formatValue("9:30:00", df("Time"), undefined, ctx)).toBe("09:30:00");
  });
  it("Duration: 93784 s -> '1d 2h 3m 4s' (get_formatted_duration, utils.js:1115-1143)", () => {
    expect(formatValue(93784, df("Duration"), undefined, ctx)).toBe("1d 2h 3m 4s");
  });
  it("Duration: empty/0 -> '0s' (formatters.js:281-288)", () => {
    expect(formatValue(0, df("Duration"), undefined, ctx)).toBe("0s");
    expect(formatValue(null, df("Duration"), undefined, ctx)).toBe("0s");
  });
  it("Duration: hide_days folds days into hours (utils.js:1153-1173)", () => {
    expect(formatValue(93784, df("Duration", { hide_days: 1 }), undefined, ctx)).toBe("26h 3m 4s");
  });
  it("Duration: hide_seconds rounds seconds into minutes", () => {
    expect(formatValue(3690, df("Duration", { hide_seconds: 1 }), undefined, ctx)).toBe("1h 2m"); // 61 min 30 s -> 1h 1m + round(30/60)=1 -> 2m
  });
});

describe("formatValue — links", () => {
  it("Link shows the cached title when the target has show_title_field_in_link, else the name", () => {
    const l = df("Link", { options: "Customer" });
    expect(formatValue("CUST-0001", l, undefined, { ...ctx, linkTitles: { "Customer::CUST-0001": "Acme Co" } })).toBe("Acme Co");
    expect(formatValue("CUST-0002", l, undefined, ctx)).toBe("CUST-0002");
  });
  it("Dynamic Link formats like a Link to doc[df.options] (formatters.js:426-429)", () => {
    const d = df("Dynamic Link", { options: "reference_type" });
    expect(formatValue("abc", d, { doctype: "ToDo", name: "t", reference_type: "User" }, ctx)).toBe("abc");
  });
});

describe("translateLabel (meta.__messages)", () => {
  const b = loadBundle("todo.en.json");
  const withMessages = { ...b, meta: { ...b.meta, __messages: { Status: "الحالة", Priority: "الأولوية" } } };

  it("returns the translation when present", () => expect(translateLabel(withMessages, "Status")).toBe("الحالة"));
  it("returns the input unchanged when absent", () => expect(translateLabel(withMessages, "Unknown label")).toBe("Unknown label"));
  it("without __messages returns the input", () => expect(translateLabel(b, "Status")).toBe("Status"));
  it.todo("context-qualified labels: Desk calls __(label, null, parent doctype); the bundle has no context map to test with");
});

describe("fixture sanity (runs now)", () => {
  it("real ToDo fixture has the labels used above", () => {
    expect(fieldOf(loadBundle("todo.en.json"), "status").label).toBe("Status");
    expect(fieldOf(loadBundle("todo.en.json"), "priority").label).toBe("Priority");
  });
  it.todo("KNOWN FIXTURE DEFECT: the seven tests/fixtures/real-15.110/*.ar.json files are byte-identical to *.en.json and carry __messages = null; re-capture with an uncached FormMeta before using them for Arabic assertions");
});
