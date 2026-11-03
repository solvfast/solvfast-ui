/**
 * Foundation — hooks, permissions ladder, translation, formatting, feedback. Metadata = the REAL 15.110 getdoctype
 * captures (tests/fixtures/real-15.110); documents and docinfo are authored in getdoc's shape. The ar dictionary used
 * below is SYNTHETIC: 15.110's getdoctype carries no translations (ar fixtures == en fixtures).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import todoAr from "./fixtures/real-15.110/todo.ar.json";
import contactEn from "./fixtures/real-15.110/contact.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { FrappeError, createFrappeClient, toFrappeError, type FrappeResponse } from "../src/frappe/client";
import { FrappeProvider, useFrappeApi, useFrappeClient } from "../src/frappe/FrappeProvider";
import { frappeKeys, type DocTypeMeta, type FrappeDoc, type FrappeDocField, type MetaBundle } from "../src/frappe/contract";
import { useDoc, useDocAction, useMetaBundle, usePermissions, useSaveDoc } from "../src/frappe/hooks";
import { buildDocPermissions, controlDisplayStatus, fieldDisplayStatus, formatValue, translateLabel } from "../src/frappe/services";
import { FrappeErrorState, useFrappeMessages } from "../src/frappe/feedback";

afterEach(cleanup);

// `as unknown`: the real payload has `__messages: null`, which contract.ts types as `Record | undefined` (reported)
const TODO = (todoEn as unknown as { docs: DocTypeMeta[] }).docs[0];
const bundleOf = (meta: DocTypeMeta, children: Record<string, DocTypeMeta> = {}): MetaBundle => ({ doctype: meta.name, meta, children });
const sm = (...items: Record<string, unknown>[]) => JSON.stringify(items.map((i) => JSON.stringify(i)));

function harness(answer: (method: string, args: Record<string, unknown>) => FrappeResponse | Promise<FrappeResponse>, props: Partial<React.ComponentProps<typeof FrappeProvider>> = {}) {
  const calls: { method: string; args: Record<string, unknown> }[] = [];
  const client = createFrappeClient({ transport: async (method, args) => { calls.push({ method, args }); return answer(method, args); } });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={client} {...props}>{children}</FrappeProvider></QueryClientProvider>
    </ThemeProvider>
  );
  return { calls, client, qc, wrapper };
}

describe("real metadata fixtures", () => {
  it("ar and en captures are identical and carry no __messages (15.110 getdoctype sends no translations)", () => {
    expect(todoAr).toEqual(todoEn);
    expect(TODO.__messages ?? null).toBeNull();
    for (const d of (contactEn as unknown as { docs: DocTypeMeta[] }).docs) expect(d.__messages ?? null).toBeNull();
  });

  it("translateLabel: meta.__messages when present, else the app dictionary (\"label:DocType\" first), else unchanged", () => {
    const b = bundleOf(TODO);
    const status = TODO.fields.find((f) => f.fieldname === "status")!.label!;
    expect(translateLabel(b, status)).toBe(status);
    const dict = { [status]: "الحالة", [`${status}:ToDo`]: "حالة المهمة" }; // SYNTHETIC dictionary
    expect(translateLabel(b, status, dict)).toBe("حالة المهمة");
    expect(translateLabel(b, status, { [status]: "الحالة" })).toBe("الحالة");
    expect(translateLabel(bundleOf({ ...TODO, __messages: { [status]: "من الخادم" } }), status, { [status]: "x" })).toBe("من الخادم");
  });
});

describe("useMetaBundle / useDoc", () => {
  it("useMetaBundle parses the real Contact bundle and folds provider translations into meta.__messages", async () => {
    const { wrapper } = harness(() => contactEn as unknown as FrappeResponse, { translations: { "First Name": "الاسم الأول" } });
    const { result } = renderHook(() => useMetaBundle("Contact"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Object.keys(result.current.data!.children)).toContain("Contact Email");
    expect(translateLabel(result.current.data!, "First Name")).toBe("الاسم الأول");
  });

  it("useDoc: one getdoc request seeds docinfo; a missing doc is not_found", async () => {
    const doc = { doctype: "ToDo", name: "TD-1", status: "Open", modified: "2026-11-03 10:00:00" };
    const { calls, qc, wrapper } = harness((method, args) => {
      if (method.endsWith("getdoc")) return args.name === "TD-1" ? { docs: [doc], docinfo: { comments: [], permissions: { read: 1, write: 1 } } } : { docs: [] };
      throw new Error(`unexpected ${method}`);
    });
    const { result } = renderHook(() => useDoc("ToDo", "TD-1"), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.doc).toEqual(doc);
    expect(result.current.data!.docinfo.permissions).toEqual({ read: 1, write: 1 });
    expect(calls.map((c) => c.method)).toEqual(["frappe.desk.form.load.getdoc"]);
    expect(qc.getQueryData(frappeKeys.docinfo("ToDo", "TD-1"))).toBeDefined();
    const missing = renderHook(() => useDoc("ToDo", "nope"), { wrapper });
    await waitFor(() => expect(missing.result.current.error).toBeInstanceOf(FrappeError));
    expect(missing.result.current.error!.kind).toBe("not_found");
  });

  it("useSaveDoc sets the doc under the server's name and invalidates docinfo / list / count; delete removes keys", async () => {
    const { qc, wrapper } = harness((method, args) => {
      if (method.endsWith("savedocs")) { const d = JSON.parse(args.doc as string); return { docs: [{ ...d, name: "TD-9", __islocal: undefined, localname: d.name, modified: "2026-11-03 11:00:00" }] }; }
      if (method === "frappe.client.delete") return {};
      return { docinfo: {} };
    });
    qc.setQueryData(frappeKeys.list("ToDo"), ["stale"]);
    const inv = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => ({ save: useSaveDoc(), act: useDocAction() }), { wrapper });
    await act(() => result.current.save.mutateAsync({ doc: { doctype: "ToDo", name: "new-todo-1", __islocal: 1, description: "x" }, action: "Save" }));
    expect(qc.getQueryData<FrappeDoc>(frappeKeys.doc("ToDo", "TD-9"))).toMatchObject({ name: "TD-9", localname: "new-todo-1" });
    const keys = inv.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toEqual(expect.arrayContaining([JSON.stringify(frappeKeys.docinfo("ToDo", "TD-9")), JSON.stringify(frappeKeys.list("ToDo")), JSON.stringify(frappeKeys.count("ToDo"))]));
    await act(() => result.current.act.remove.mutateAsync({ doctype: "ToDo", name: "TD-9" }));
    expect(qc.getQueryData(frappeKeys.doc("ToDo", "TD-9"))).toBeUndefined();
  });
});

describe("provider", () => {
  it("a 0.3-style custom client is upgraded once: hooks and the message host share the same FrappeApi", async () => {
    const legacy = {
      call: async () => ({ message: 1, _server_messages: sm({ message: "Hello from legacy", alert: 1 }) }),
      getMeta: async () => ({ name: "X", fields: [] }), getList: async () => [], getCount: async () => 0, searchLink: async () => [],
    };
    const qc = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><QueryClientProvider client={qc}><FrappeProvider client={legacy}>{children}</FrappeProvider></QueryClientProvider></ThemeProvider>
    );
    const { result } = renderHook(() => ({ api: useFrappeApi(), client: useFrappeClient() }), { wrapper });
    expect(result.current.api).toBe(result.current.client);
    await act(() => result.current.api.deleteDoc("X", "1"));
    expect(await screen.findByText("Hello from legacy")).toBeTruthy();
  });
});

describe("permissions: the display-status ladder (docs 11 §2.5)", () => {
  const df = (p: Partial<FrappeDocField>): FrappeDocField => ({ fieldname: "f", fieldtype: "Data", ...p });
  const W = [{ read: true, write: true }, { read: true }];
  const saved = { doctype: "X", name: "X-1", docstatus: 0 } as FrappeDoc;

  it("each step", () => {
    expect(fieldDisplayStatus(df({}), saved, W)).toBe("Write");
    expect(fieldDisplayStatus(df({ permlevel: 1 }), saved, W)).toBe("Read");
    expect(fieldDisplayStatus(df({ permlevel: 2 }), saved, W)).toBe("None");
    expect(fieldDisplayStatus(df({ disabled: 1 }), saved, W)).toBe("Read");
    expect(fieldDisplayStatus(df({ hidden: 1 }), saved, W)).toBe("None");
    expect(fieldDisplayStatus(df({ hidden_due_to_dependency: 1 }), saved, W)).toBe("None");
    expect(fieldDisplayStatus(df({}), { ...saved, docstatus: 1 }, W)).toBe("Read");
    expect(fieldDisplayStatus(df({ allow_on_submit: 1 }), { ...saved, docstatus: 1 }, W)).toBe("Write");
    expect(fieldDisplayStatus(df({ allow_on_submit: 1 }), { ...saved, docstatus: 2 }, W)).toBe("Read");
    expect(fieldDisplayStatus(df({ read_only: 1 }), saved, W)).toBe("Read");
    expect(fieldDisplayStatus(df({ fieldtype: "Read Only" }), saved, W)).toBe("Read");
    expect(fieldDisplayStatus(df({ set_only_once: 1 }), saved, W)).toBe("Read");
    expect(fieldDisplayStatus(df({ set_only_once: 1 }), { ...saved, __islocal: 1 }, W)).toBe("Write");
    expect(fieldDisplayStatus(df({ read_only: 1 }), undefined, undefined)).toBe("Read");
  });

  it("boolean flags count (Desk sets hidden_due_to_dependency = true): hidden, read_only, allow_on_submit, set_only_once", () => {
    const b = (p: Record<string, unknown>) => df(p as Partial<FrappeDocField>);
    expect(fieldDisplayStatus(b({ hidden_due_to_dependency: true }), saved, W)).toBe("None");
    expect(fieldDisplayStatus(b({ hidden_due_to_dependency: false }), saved, W)).toBe("Write");
    expect(fieldDisplayStatus(b({ hidden: true }), saved, W)).toBe("None");
    expect(fieldDisplayStatus(b({ read_only: true }), saved, W)).toBe("Read");
    expect(fieldDisplayStatus(b({ allow_on_submit: true }), { ...saved, docstatus: 1 }, W)).toBe("Write");
    expect(fieldDisplayStatus(b({ hidden_due_to_dependency: true }), undefined, undefined)).toBe("None");
    expect(fieldDisplayStatus(b({ read_only: true }), undefined, undefined)).toBe("Read");
    expect(formatValue(true, { fieldname: "c", fieldtype: "Check" })).toBe("Yes");
  });

  it("control rules: blank Read → None (not HTML/Button), Read table → Read cells", () => {
    expect(controlDisplayStatus("Read", df({}), "")).toBe("None");
    expect(controlDisplayStatus("Read", df({ fieldtype: "HTML" }), "")).toBe("Read");
    expect(controlDisplayStatus("Read", df({}), 0)).toBe("Read");
    expect(controlDisplayStatus("Write", df({}), "x", { gridStatus: "Read" })).toBe("Read");
    expect(controlDisplayStatus("Write", df({ allow_on_submit: 1 }), "x", { gridStatus: "Read" })).toBe("Write");
  });

  it("roles × real ToDo DocPerm rows, docinfo overlay, owner rule; approximation without roles", () => {
    const doc = { doctype: "ToDo", name: "TD-1", owner: "a@x", docstatus: 0 } as FrappeDoc;
    const withRoles = buildDocPermissions({ meta: TODO, doc, docinfo: { permissions: { read: 1, write: 0 } } as never, session: { user: "a@x", roles: ["All", "Desk User"] } });
    expect(withRoles[0].write).toBe(false); // docinfo said no write
    expect(withRoles[0].read).toBe(true);
    const noRoles = buildDocPermissions({ meta: TODO, doc, docinfo: { permissions: { read: 1, write: 1, delete: 0 } } as never });
    expect(noRoles[0]).toMatchObject({ read: true, write: true, delete: false });
    expect(buildDocPermissions({ meta: TODO, doc: { doctype: "ToDo", name: "new-todo-1", __islocal: 1 } })[0]).toMatchObject({ read: true, write: true, create: true });
  });

  it("usePermissions: workflow state without an allow_edit role shrinks to read-only", () => {
    const meta: DocTypeMeta = {
      name: "Deal", permissions: [{ role: "Sales User", permlevel: 0, read: 1, write: 1, cancel: 1 }], fields: [{ fieldname: "amount", fieldtype: "Currency" }, { fieldname: "workflow_state", fieldtype: "Link" }],
      __workflow_docs: [{ doctype: "Workflow", name: "W", document_type: "Deal", workflow_state_field: "workflow_state", states: [{ state: "Approved", doc_status: "0", allow_edit: "Sales Manager" }], transitions: [] }],
    };
    const doc = { doctype: "Deal", name: "D-1", owner: "u@x", docstatus: 0, workflow_state: "Approved", amount: 5 } as FrappeDoc;
    const { wrapper } = harness(() => ({}), { session: { user: "u@x", roles: ["Sales User"] } });
    const { result } = renderHook(() => usePermissions(bundleOf(meta), doc, { permissions: { read: 1, write: 1, cancel: 1 } } as never), { wrapper });
    expect(result.current.workflowReadOnly).toBe(true);
    expect(result.current.can("write")).toBe(false);
    expect(result.current.can("cancel")).toBe(true);
    expect(result.current.fieldStatus(meta.fields[0], doc)).toBe("Read");
  });
});

describe("formatValue (docs 12 §9)", () => {
  const f = (fieldtype: string, p: Partial<FrappeDocField> = {}): FrappeDocField => ({ fieldname: "v", fieldtype, ...p });
  it("numbers", () => {
    expect(formatValue(1234.5, f("Float"))).toBe("1,234.500");
    expect(formatValue(1234, f("Float"))).toBe("1,234");
    expect(formatValue(1.25, f("Float", { precision: "1" }))).toBe("1.3");
    expect(formatValue(1234567.891, f("Float"), undefined, { numberFormat: "#.###,##", floatPrecision: 2 })).toBe("1.234.567,89");
    expect(formatValue(1234567, f("Float"), undefined, { numberFormat: "#,##,###.##" })).toBe("12,34,567");
    expect(formatValue(1234, f("Int"))).toBe("1234");
    expect(formatValue(2048, f("Int", { options: "File Size" }))).toBe("2.00K");
    expect(formatValue(12.5, f("Percent"))).toBe("12.50%");
    expect(formatValue(null, f("Float"))).toBe("");
    expect(formatValue(undefined, f("Currency"))).toBe("");
  });
  it("currency: precision chain, symbol, side, hidden", () => {
    expect(formatValue(1500, f("Currency"))).toBe("USD 1,500.00");
    const ctx = { currency: "SAR", currencies: { SAR: { symbol: "﷼", symbol_on_right: 1 as const }, EUR: { symbol: "€" } } };
    expect(formatValue(1500, f("Currency"), undefined, ctx)).toBe("1,500.00 ﷼");
    expect(formatValue(9.5, f("Currency", { options: "currency" }), { doctype: "X", name: "1", currency: "EUR" }, ctx)).toBe("€ 9.50");
    expect(formatValue(9.5, f("Currency", { precision: "0" }), undefined, { ...ctx, hideCurrencySymbol: true })).toBe("10");
  });
  it("dates, times, zones", () => {
    expect(formatValue("2026-11-03", f("Date"), undefined, { dateFormat: "dd-mm-yyyy" })).toBe("03-11-2026");
    expect(formatValue("2026-11-03 09:05:07.123456", f("Datetime"), undefined, { dateFormat: "mm/dd/yyyy", timeFormat: "HH:mm" })).toBe("11/03/2026 09:05");
    expect(formatValue("2026-11-03 09:00:00", f("Datetime"), undefined, { timeZone: { system: "UTC", user: "Asia/Riyadh" } })).toBe("2026-11-03 12:00:00");
    expect(formatValue("9:30:00", f("Time"), undefined, { timeFormat: "HH:mm" })).toBe("09:30");
    expect(formatValue("garbage", f("Date"))).toBe("");
  });
  it("check, select, link, data", () => {
    expect(formatValue(1, f("Check"), undefined, { checkLabels: { yes: "نعم", no: "لا" } })).toBe("نعم");
    expect(formatValue("Open", f("Select"), undefined, { translate: (s) => (s === "Open" ? "مفتوح" : s) })).toBe("مفتوح");
    expect(formatValue("CUST-1", f("Link", { options: "Customer" }), undefined, { linkTitles: { "Customer::CUST-1": "Acme" } })).toBe("Acme");
    expect(formatValue("a@x", f("Dynamic Link", { options: "ref_type" }), { doctype: "T", name: "1", ref_type: "User" }, { linkTitles: { "User::a@x": "Ann" } })).toBe("Ann");
    expect(formatValue("GB82WEST12345698765432", f("Data", { options: "IBAN" }))).toBe("GB82 WEST 1234 5698 7654 32");
    expect(formatValue(null, f("Data"))).toBe("");
  });
});

describe("feedback", () => {
  const wrap = (ui: React.ReactNode, lang: "en" | "ar" = "en") => render(<ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);

  it("FrappeErrorState: title by kind, server messages as sent (sanitized), Retry", () => {
    const onRetry = vi.fn();
    const e = toFrappeError(417, { exc_type: "MandatoryError", _server_messages: sm({ message: "Value missing for <b>Subject</b><script>alert(1)</script>", raise_exception: 1 }) });
    wrap(<FrappeErrorState error={e} onRetry={onRetry} />);
    expect(screen.getByRole("alert").dataset.kind).toBe("mandatory");
    expect(screen.getByText("Missing required values")).toBeTruthy();
    expect(screen.getByText("Subject").tagName).toBe("B");
    expect(document.querySelector("script")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("FrappeErrorState in Arabic; session_expired offers Log in", () => {
    wrap(<FrappeErrorState error={new FrappeError("x", 401)} />, "ar");
    expect(screen.getByText("انتهت صلاحية جلستك")).toBeTruthy();
    expect(screen.getByRole("link", { name: "تسجيل الدخول" }).getAttribute("href")).toMatch(/^\/login\?redirect-to=/);
  });

  it("server messages: successful responses show alerts and the dialog; raise_exception filter applies", async () => {
    const { client, wrapper } = harness(() => ({ message: 1, _server_messages: sm({ message: "Saved", alert: 1, indicator: "green" }) }));
    function Probe() {
      const m = useFrappeMessages();
      return <button onClick={() => m.show([{ message: "info" }, { message: "Boom <b>here</b>", raiseException: true, title: "Error" }])}>show</button>;
    }
    render(<Probe />, { wrapper });
    await act(() => client.call("x", {}));
    expect(await screen.findByText("Saved")).toBeTruthy();
    fireEvent.click(screen.getByText("show"));
    expect(await screen.findByText("here")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).not.toContain("info");
    expect(screen.getByRole("dialog").textContent).toContain("Error");
  });
});
