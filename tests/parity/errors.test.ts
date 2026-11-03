/**
 * Error-kind mapping and `_server_messages` parsing. Contract: `FrappeErrorKind` mapping comment in
 * src/frappe/contract.ts; native: apps/frappe/frappe/exceptions.py (status codes), frappe/app.py:323-411,
 * frappe/utils/response.py:33-66,178-195, frappe/sessions.py:326-333, public/js/frappe/request.js:129-233,419-499,
 * public/js/frappe/ui/messages.js:151-176.
 *
 * The CLIENT only sees the leaf `exc_type` string, never the class hierarchy, so subclasses of ValidationError must be
 * listed by name (a `DoesNotExistError` is a ValidationError by inheritance but 404, so it must be tested first).
 *
 * PENDING: A1 `FrappeError` classification (`classifyResponse`, `parseServerMessages`, `messagesToDisplay` in ./seam.ts).
 */
import { describe, expect, it } from "vitest";
import type { FrappeErrorKind } from "../../src/frappe/contract";
import { classifyResponse, messagesToDisplay, parseServerMessages } from "./seam";

interface Row {
  name: string;
  status: number;
  body?: unknown;
  contentType?: string;
  kind: FrappeErrorKind;
  src: string;
}
const json = "application/json";
const exc = (exc_type: string, extra: Record<string, unknown> = {}) => ({ exc_type, ...extra });

const rows: Row[] = [
  { name: "PermissionError", status: 403, body: exc("PermissionError"), contentType: json, kind: "permission", src: "exceptions.py:34-35" },
  { name: "DoesNotExistError (a ValidationError subclass, still 404)", status: 404, body: exc("DoesNotExistError"), contentType: json, kind: "not_found", src: "exceptions.py:38-39" },
  { name: "PageDoesNotExistError", status: 404, body: exc("PageDoesNotExistError"), contentType: json, kind: "not_found", src: "exceptions.py:46-47" },
  { name: "DuplicateEntryError (409, via NameError)", status: 409, body: exc("DuplicateEntryError"), contentType: json, kind: "duplicate", src: "exceptions.py:50-51,96" },
  { name: "UniqueValidationError", status: 417, body: exc("UniqueValidationError"), contentType: json, kind: "duplicate", src: "exceptions.py:184" },
  { name: "TimestampMismatchError is 417, NOT 409", status: 417, body: exc("TimestampMismatchError"), contentType: json, kind: "timestamp", src: "exceptions.py:156-157" },
  { name: "MandatoryError", status: 417, body: exc("MandatoryError"), contentType: json, kind: "mandatory", src: "exceptions.py:116" },
  { name: "LinkValidationError", status: 417, body: exc("LinkValidationError"), contentType: json, kind: "link", src: "exceptions.py:144" },
  { name: "CancelledLinkError (subclass of LinkValidationError)", status: 417, body: exc("CancelledLinkError"), contentType: json, kind: "link", src: "exceptions.py:148" },
  { name: "LinkExistsError", status: 417, body: exc("LinkExistsError"), contentType: json, kind: "link", src: "exceptions.py:164" },
  { name: "plain ValidationError", status: 417, body: exc("ValidationError"), contentType: json, kind: "validation", src: "exceptions.py:18-19" },
  { name: "InvalidEmailAddressError", status: 417, body: exc("InvalidEmailAddressError"), contentType: json, kind: "validation", src: "exceptions.py:168" },
  { name: "InvalidNameError", status: 417, body: exc("InvalidNameError"), contentType: json, kind: "validation", src: "exceptions.py:172" },
  { name: "InvalidPhoneNumberError", status: 417, body: exc("InvalidPhoneNumberError"), contentType: json, kind: "validation", src: "exceptions.py:176" },
  { name: "CharacterLengthExceededError", status: 417, body: exc("CharacterLengthExceededError"), contentType: json, kind: "validation", src: "exceptions.py:136" },
  { name: "NonNegativeError", status: 417, body: exc("NonNegativeError"), contentType: json, kind: "validation", src: "exceptions.py:120" },
  { name: "UpdateAfterSubmitError", status: 417, body: exc("UpdateAfterSubmitError"), contentType: json, kind: "validation", src: "exceptions.py:140" },
  { name: "DocstatusTransitionError", status: 417, body: exc("DocstatusTransitionError"), contentType: json, kind: "validation", src: "exceptions.py:152" },
  { name: "CannotChangeConstantError (set_only_once)", status: 417, body: exc("CannotChangeConstantError"), contentType: json, kind: "validation", src: "exceptions.py:132" },
  { name: "WorkflowPermissionError", status: 417, body: exc("WorkflowPermissionError"), contentType: json, kind: "validation", src: "model/workflow.py:25" },
  { name: "unknown exc_type with 417 falls back to validation", status: 417, body: exc("SomeAppSpecificError"), contentType: json, kind: "validation", src: "exceptions.py:19 (status rule)" },
  { name: "FrappeTypeError (pydantic arg validation)", status: 417, body: exc("FrappeTypeError"), contentType: json, kind: "validation", src: "exceptions.py:22-23" },
  { name: "CSRFTokenError", status: 400, body: exc("CSRFTokenError"), contentType: json, kind: "csrf", src: "exceptions.py:75-76; auth.py:83-98" },
  { name: "session_expired:1 beats a 403", status: 403, body: { session_expired: 1, exc_type: "PermissionError" }, contentType: json, kind: "session_expired", src: "sessions.py:326-333; request.js:432-438" },
  { name: "session_expired:1 beats a 200 body", status: 200, body: { session_expired: 1 }, contentType: json, kind: "session_expired", src: "request.js:432" },
  { name: "AuthenticationError 401", status: 401, body: exc("AuthenticationError"), contentType: json, kind: "session_expired", src: "exceptions.py:26-27" },
  { name: "413 non-JSON (Werkzeug HTML)", status: 413, body: "<html>Request Entity Too Large</html>", contentType: "text/html", kind: "too_large", src: "app.py:199-202; request.js:190" },
  { name: "network failure (status 0)", status: 0, kind: "network", src: "request.js:30-39 (offline)" },
  { name: "500 JSON deadlock", status: 500, body: exc("QueryDeadlockError"), contentType: json, kind: "server", src: "app.py:341-354; request.js:235-254" },
  { name: "500 JSON QueryTimeoutError", status: 500, body: exc("QueryTimeoutError"), contentType: json, kind: "server", src: "exceptions.py:244" },
  { name: "502 HTML from the proxy", status: 502, body: "<html>Bad Gateway</html>", contentType: "text/html", kind: "server", src: "request.js:229" },
  { name: "504 HTML timeout", status: 504, body: "<html>Gateway Timeout</html>", contentType: "text/html", kind: "server", src: "request.js:225" },
  { name: "unparseable 500", status: 500, body: "boom", contentType: "text/plain", kind: "server", src: "10 C1 §10" },
  { name: "SessionBootFailed 500", status: 500, body: exc("SessionBootFailed"), contentType: json, kind: "server", src: "exceptions.py:256-257" },
];

describe.skip("classifyResponse: exc_type, then status", () => {
  it.each(rows.map((r) => [r.name, r] as const))("%s", (_n, r) => {
    const info = classifyResponse({ status: r.status, body: r.body, contentType: r.contentType });
    expect(info.kind).toBe(r.kind);
    expect(info.status).toBe(r.status);
    if (r.body && typeof r.body === "object" && "exc_type" in (r.body as object)) {
      expect(info.excType).toBe((r.body as { exc_type: string }).exc_type);
    }
  });

  it("403 with _error_message surfaces that text (getdoc without read permission)", () => {
    const info = classifyResponse({
      status: 403,
      contentType: json,
      body: exc("PermissionError", { _error_message: "Insufficient Permission for ToDo abc" }),
    });
    expect(info.kind).toBe("permission");
    expect(info.messages.map((m) => m.message)).toContain("Insufficient Permission for ToDo abc");
  });

  it("403 without session_expired stays 'permission' (never mistaken for an expired session)", () => {
    expect(classifyResponse({ status: 403, contentType: json, body: exc("PermissionError") }).kind).toBe("permission");
  });

  it("`exception` (last traceback line) is exposed only when the server sent it", () => {
    const withTb = classifyResponse({ status: 500, contentType: json, body: { exc_type: "ValueError", exception: "ValueError: bad" } });
    expect(withTb.exception).toBe("ValueError: bad");
    expect(classifyResponse({ status: 500, contentType: json, body: exc("ValueError") }).exception).toBeUndefined();
  });

  it("messages from _server_messages are attached to the error", () => {
    const raw = JSON.stringify([JSON.stringify({ message: "Row #1: Value missing for: Qty", indicator: "red" })]);
    const info = classifyResponse({ status: 417, contentType: json, body: { exc_type: "MandatoryError", _server_messages: raw } });
    expect(info.messages).toEqual([{ message: "Row #1: Value missing for: Qty", indicator: "red" }]);
  });

  describe("classes with no contract kind (open question 2) — expectations to settle", () => {
    it.todo("NameError 409 (not DuplicateEntryError)");
    it.todo("RateLimitExceededError / TooManyRequestsError 429 (the former is a ValidationError subclass)");
    it.todo("InReadOnlyMode 503 (ValidationError subclass), QueueOverloaded 503, SessionStopped 503");
    it.todo("LinkExpired 410");
    it.todo("InvalidAuthorizationHeader / Prefix / Token: CSRFTokenError subclasses (400) raised for API-key auth, not for CSRF");
  });
});

describe.skip("parseServerMessages (response.py:189 double JSON; request.js:451-465)", () => {
  const wrap = (...msgs: object[]) => JSON.stringify(msgs.map((m) => JSON.stringify(m)));

  it("parses a JSON list of JSON strings", () => {
    expect(parseServerMessages(wrap({ message: "A", indicator: "green" }, { message: "B", title: "T" }))).toEqual([
      { message: "A", indicator: "green" },
      { message: "B", title: "T" },
    ]);
  });
  it("maps raise_exception and alert flags to booleans", () => {
    const [m] = parseServerMessages(wrap({ message: "X", raise_exception: 1, alert: 1 }));
    expect(m.raiseException).toBe(true);
    expect(m.alert).toBe(true);
  });
  it("tolerates undefined, '' and non-JSON by returning []", () => {
    expect(parseServerMessages(undefined)).toEqual([]);
    expect(parseServerMessages("")).toEqual([]);
    expect(parseServerMessages("not json")).toEqual([]);
  });
  it("tolerates a list element that is already an object (frappe.msgprint accepts both)", () => {
    expect(parseServerMessages(JSON.stringify([{ message: "obj" }]))).toEqual([{ message: "obj" }]);
  });
  it("keeps HTML as sent (sanitizing happens at render time, per the contract)", () => {
    expect(parseServerMessages(wrap({ message: "<b>bold</b>" }))[0].message).toBe("<b>bold</b>");
  });
});

describe.skip("messagesToDisplay (messages.js:151-176)", () => {
  it("shows everything when no item raises", () => {
    const ms = [{ message: "A" }, { message: "B" }];
    expect(messagesToDisplay(ms)).toEqual(ms);
  });
  it("if ANY item has raiseException, ONLY those are shown", () => {
    const ms = [{ message: "noise" }, { message: "the error", raiseException: true }, { message: "more noise" }];
    expect(messagesToDisplay(ms)).toEqual([{ message: "the error", raiseException: true }]);
  });
  it("alert items stay in the list (the host routes them to toasts)", () => {
    expect(messagesToDisplay([{ message: "Saved", alert: true, indicator: "green" }])).toHaveLength(1);
  });
});

describe("table sanity (runs now)", () => {
  it("every contract kind is exercised by at least one row", () => {
    const kinds = new Set(rows.map((r) => r.kind));
    for (const k of ["permission", "not_found", "duplicate", "timestamp", "mandatory", "link", "validation", "csrf", "session_expired", "too_large", "network", "server"] as const) {
      expect(kinds.has(k), k).toBe(true);
    }
  });
  it("row names are unique", () => expect(new Set(rows.map((r) => r.name)).size).toBe(rows.length));
});
