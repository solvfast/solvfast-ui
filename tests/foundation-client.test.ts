/**
 * Foundation — errors and transport (client.ts). Bodies are built in the shapes Frappe 15.110 sends (docs 10 §C1-C2:
 * `_server_messages` = JSON list of JSON strings, `exc_type`, `exception` = last traceback line, `_error_message`,
 * top-level `session_expired: 1`, Werkzeug's HTML 413). No network, no site.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { FrappeError, createFrappeClient, frappeErrorKind, parseServerMessages, toFrappeError, visibleMessages } from "../src/frappe/client";
import { frappeRetry } from "../src/frappe/FrappeProvider";

const respond = (body: unknown, status = 200, contentType = "application/json") =>
  vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "Content-Type": contentType } }));
const sm = (...items: Record<string, unknown>[]) => JSON.stringify(items.map((i) => JSON.stringify(i)));

afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as Record<string, unknown>).csrf_token;
  delete (globalThis as Record<string, unknown>).frappe;
});

describe("FrappeError: kind mapping (contract.ts)", () => {
  it.each([
    ["PermissionError", 403, "permission"],
    ["DoesNotExistError", 404, "not_found"],
    ["DuplicateEntryError", 409, "duplicate"],
    ["UniqueValidationError", 417, "duplicate"],
    ["TimestampMismatchError", 417, "timestamp"],
    ["MandatoryError", 417, "mandatory"],
    ["LinkValidationError", 417, "link"],
    ["CancelledLinkError", 417, "link"],
    ["LinkExistsError", 417, "link"],
    ["CharacterLengthExceededError", 417, "validation"],
    ["ValidationError", 417, "validation"],
    ["FrappeTypeError", 417, "validation"],
    ["CSRFTokenError", 400, "csrf"],
    ["AuthenticationError", 401, "session_expired"],
    ["QueryDeadlockError", 500, "server"],
    ["NameError", 409, "server"],
  ] as const)("%s (%i) → %s", (exc, status, kind) => {
    expect(toFrappeError(status, { exc_type: exc }).kind).toBe(kind);
  });

  it("by status when there is no exception class; 0.3 constructor still works and gets a kind", () => {
    expect(new FrappeError("x", 0).kind).toBe("network");
    expect(new FrappeError("x", 403).kind).toBe("permission");
    expect(new FrappeError("x", 413).kind).toBe("too_large");
    expect(new FrappeError("x", 502).kind).toBe("server");
    expect(new FrappeError("x", 417, "ValidationError")).toMatchObject({ kind: "validation", messages: [], exception: undefined });
    expect(frappeErrorKind(200, undefined, { session_expired: 1 })).toBe("session_expired");
  });
});

describe("_server_messages → FrappeMessage[]", () => {
  it("parses the double-JSON list with title, indicator, raise_exception and alert", () => {
    const raw = sm(
      { message: "Saved", indicator: "green", alert: 1 },
      { message: "Error: <b>Value missing</b> for Subject", title: "Message", indicator: "red", raise_exception: 1, __frappe_exc_id: "x" },
      { message: "Toast", toast: true },
    );
    expect(parseServerMessages(raw)).toEqual([
      { message: "Saved", indicator: "green", alert: true },
      { message: "Error: <b>Value missing</b> for Subject", title: "Message", indicator: "red", raiseException: true },
      { message: "Toast", alert: true },
    ]);
  });

  it("plain strings, as_list arrays and junk are tolerated; empty messages dropped", () => {
    expect(parseServerMessages(JSON.stringify(["plain text", JSON.stringify({ message: ["a", "b"], as_list: 1 }), JSON.stringify({ message: "" })])))
      .toEqual([{ message: "plain text" }, { message: "a\nb" }]);
    expect(parseServerMessages(undefined)).toEqual([]);
    expect(parseServerMessages("not json")).toEqual([{ message: "not json" }]);
  });

  it("msgprint array rule: when any message raises, only those are visible", () => {
    const list = parseServerMessages(sm({ message: "info" }, { message: "boom", raise_exception: 1 }));
    expect(visibleMessages(list).map((m) => m.message)).toEqual(["boom"]);
    expect(visibleMessages([{ message: "a" }])).toEqual([{ message: "a" }]);
  });
});

describe("error bodies → readable FrappeError", () => {
  it("417 mandatory: messages kept, readable text from the raising messages, exception line kept", () => {
    const e = toFrappeError(417, {
      exc_type: "MandatoryError",
      exception: "frappe.exceptions.MandatoryError: [ToDo, TD-1]: description",
      _server_messages: sm({ message: "Note", indicator: "blue" }, { message: "Error: Value missing for ToDo: <strong>Description</strong>", title: "Message", raise_exception: 1, indicator: "red" }),
    });
    expect(e).toMatchObject({ status: 417, kind: "mandatory", excType: "MandatoryError", message: "Error: Value missing for ToDo: Description", exception: "frappe.exceptions.MandatoryError: [ToDo, TD-1]: description" });
    expect(e.messages).toHaveLength(2);
  });

  it("403 getdoc: `_error_message` wins (Desk's 403 handler shows it instead of the server messages)", () => {
    const e = toFrappeError(403, { exc_type: "PermissionError", _error_message: "Insufficient Permission for <strong>ToDo TD-9</strong>", _server_messages: sm({ message: "No permission for ToDo" }) });
    expect(e.message).toBe("Insufficient Permission for ToDo TD-9");
    expect(e.messages.map((m) => m.message)).toEqual(["No permission for ToDo"]);
  });

  it("no messages → `_error_message`, then the exception line without its class, then exc_type, then HTTP status", () => {
    expect(toFrappeError(417, { exc_type: "ValidationError", _error_message: "Custom" }).message).toBe("Custom");
    expect(toFrappeError(417, { exc_type: "ValidationError", exception: "frappe.exceptions.ValidationError: Date is invalid" }).message).toBe("Date is invalid");
    expect(toFrappeError(500, { exc_type: "QueryDeadlockError" }).message).toBe("QueryDeadlockError");
    expect(toFrappeError(500, {}).message).toBe("HTTP 500");
  });
});

describe("HTTP transport", () => {
  it("`session_expired: 1` in the body is an expired session whatever the status — even on a 200 (request.js cleanup)", async () => {
    vi.stubGlobal("fetch", respond({ message: [], session_expired: 1 }, 200));
    const e = await createFrappeClient().call("frappe.client.get_list", {}).catch((x) => x);
    expect(e).toBeInstanceOf(FrappeError);
    expect(e).toMatchObject({ kind: "session_expired", status: 401 });
    expect(frappeRetry(0, e)).toBe(false);
    vi.stubGlobal("fetch", respond({ exc_type: "PermissionError", session_expired: 1 }, 403));
    expect(await createFrappeClient().call("m", {}).catch((x) => x.kind)).toBe("session_expired");
  });

  it("413 from Werkzeug (HTML, not JSON) → too_large, never retried", async () => {
    vi.stubGlobal("fetch", respond("<html><title>413 Request Entity Too Large</title></html>", 413, "text/html"));
    const e = await createFrappeClient().call("upload_file", {}).catch((x) => x);
    expect(e).toMatchObject({ kind: "too_large", status: 413 });
    expect(frappeRetry(0, e)).toBe(false);
  });

  it("network failure → kind network (retried); CSRF error → csrf (not retried)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const e = await createFrappeClient().call("m", {}).catch((x) => x);
    expect(e).toMatchObject({ kind: "network", status: 0 });
    expect(frappeRetry(0, e)).toBe(true);
    vi.stubGlobal("fetch", respond({ exc_type: "CSRFTokenError", _server_messages: sm({ message: "Invalid Request", title: "Message" }) }, 400));
    const c = await createFrappeClient().call("m", {}).catch((x) => x);
    expect(c).toMatchObject({ kind: "csrf", message: "Invalid Request" });
    expect(frappeRetry(0, c)).toBe(false);
  });

  it.each([["None"], [""], ["  "]])("default CSRF resolver: window.csrf_token = %j counts as missing (no header)", async (token) => {
    const fetch = respond({ message: 1 });
    vi.stubGlobal("fetch", fetch);
    (globalThis as Record<string, unknown>).csrf_token = token;
    await createFrappeClient().call("m", {});
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect("X-Frappe-CSRF-Token" in (init.headers as Record<string, string>)).toBe(false);
  });

  it("default CSRF resolver falls back to window.frappe.csrf_token when window.csrf_token is \"None\"", async () => {
    const fetch = respond({ message: 1 });
    vi.stubGlobal("fetch", fetch);
    (globalThis as Record<string, unknown>).csrf_token = "None";
    (globalThis as Record<string, unknown>).frappe = { csrf_token: "real-token" };
    await createFrappeClient().call("m", {});
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)["X-Frappe-CSRF-Token"]).toBe("real-token");
  });
});
