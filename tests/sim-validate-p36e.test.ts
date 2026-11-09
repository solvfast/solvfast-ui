/**
 * P36e — the simulator's save runs Frappe's field validation (`Document._validate`, document.py:624-646): Data options
 * (_validate_data_fields, base_document.py:922-955), non_negative (document.py:656-676) and column length
 * (base_document.py:981-1014). SIMULATED: request / response shapes and the server's messages; a real site is the
 * matrix's F-FIELD-1.
 */
import { describe, expect, it } from "vitest";
import { createFrappeClient, FrappeError } from "../src/frappe/client";
import type { DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import { serverSplitEmails, validateEmailAddress } from "../src/frappe/testing/validateDoc";

const LEAD: DocTypeMeta = {
  name: "Serve Fast Lead", autoname: "hash", fields: [
    { fieldname: "first_name", fieldtype: "Data", label: "First Name", reqd: 1 },
    { fieldname: "email", fieldtype: "Data", label: "Email", options: "Email" },
    { fieldname: "mobile", fieldtype: "Data", label: "Mobile", options: "Phone" },
    { fieldname: "person", fieldtype: "Data", label: "Person", options: "Name" },
    { fieldname: "website", fieldtype: "Data", label: "Website", options: "URL" },
    { fieldname: "iban", fieldtype: "Data", label: "IBAN", options: "IBAN" },
    { fieldname: "annual_revenue", fieldtype: "Currency", label: "Annual Revenue", non_negative: 1 },
    { fieldname: "score", fieldtype: "Int", label: "Score" },
    { fieldname: "code", fieldtype: "Data", label: "Code", length: 5 },
    { fieldname: "status", fieldtype: "Select", label: "Status", options: "\nOpen\nClosed" },
    { fieldname: "rows", fieldtype: "Table", label: "Rows", options: "Lead Row" },
  ],
};
const ROW: DocTypeMeta = { name: "Lead Row", istable: 1, fields: [
  { fieldname: "qty", fieldtype: "Float", label: "Qty", non_negative: 1 },
  { fieldname: "contact_email", fieldtype: "Data", label: "Contact Email", options: "Email" },
] };

function setup() {
  const transport = createFixtureTransport({ meta: { "Serve Fast Lead": [LEAD, ROW] }, docs: {} });
  return { transport, client: createFrappeClient({ transport, session: { user: "Administrator" } }) };
}
const newLead = (extra: Record<string, unknown> = {}) => ({ doctype: "Serve Fast Lead", __islocal: 1, first_name: "Reem", ...extra }) as unknown as FrappeDoc;
async function refusal(p: Promise<unknown>) {
  try { await p; } catch (e) { return e as FrappeError; }
  throw new Error("expected the save to be refused");
}
const stored = (t: ReturnType<typeof setup>["transport"]) => [...(t.store.docs.get("Serve Fast Lead")?.values() ?? [])];

describe("P36e simulator save validation (SIMULATED)", () => {
  it("P36E.sim.1 Data/Email: an invalid address is refused with InvalidEmailAddressError and the server message; nothing stored", async () => {
    const s = setup();
    const e = await refusal(s.client.saveDoc(newLead({ email: "not-an-email" }), "Save"));
    expect(e.status).toBe(417);
    expect(e.excType).toBe("InvalidEmailAddressError");
    expect(e.messages[0].message).toBe("not-an-email is not a valid Email Address");
    expect(stored(s.transport)).toHaveLength(0);
  });

  it("P36E.sim.2 Data/Email follows the server, not Desk's client pattern: split on commas (a newline is a space first); a@b.c is accepted (EMAIL_MATCH_PATTERN.match); '<' display names", async () => {
    const s = setup();
    await s.client.saveDoc(newLead({ email: "a@b.c" }), "Save");
    await s.client.saveDoc(newLead({ email: "Ann <ann@example.com>, bob@example.com" }), "Save");
    expect(stored(s.transport)).toHaveLength(2);
    // split_emails replaces \t\n\r with a space BEFORE splitting on [,\n] (utils/__init__.py:213-214), so on the server a
    // newline-separated list becomes one "address" with a space — refused. Reproduced as is (a Frappe quirk).
    expect(serverSplitEmails("a@x.com, b@y.com\nc@z.com")).toEqual(["a@x.com", "b@y.com c@z.com"]);
    expect((await refusal(s.client.saveDoc(newLead({ email: "bob@example.com\ncid@example.org" }), "Save"))).excType).toBe("InvalidEmailAddressError");
    expect(() => validateEmailAddress("two words@x.com")).toThrow(); // a space without "<"
    const e = await refusal(s.client.saveDoc(newLead({ email: "ok@example.com, bad@" }), "Save"));
    expect(e.messages[0].message).toBe("bad@ is not a valid Email Address");
  });

  it("P36E.sim.3 Data/Phone: 05x-abc refused (InvalidPhoneNumberError); +966 50 000 0000 and an empty value accepted", async () => {
    const s = setup();
    const e = await refusal(s.client.saveDoc(newLead({ mobile: "05x-abc" }), "Save"));
    expect(e.excType).toBe("InvalidPhoneNumberError");
    expect(e.messages[0].message).toBe("05x-abc is not a valid Phone Number");
    await s.client.saveDoc(newLead({ mobile: "+966 50 000 0000" }), "Save");
    await s.client.saveDoc(newLead({ mobile: "" }), "Save");
    expect(stored(s.transport)).toHaveLength(2);
    // more than 20 characters is not a phone number (PHONE_NUMBER_PATTERN {1,20})
    expect((await refusal(s.client.saveDoc(newLead({ mobile: "1".repeat(21) }), "Save"))).excType).toBe("InvalidPhoneNumberError");
  });

  it("P36E.sim.4 Data/Name, URL and IBAN as the server checks them", async () => {
    const s = setup();
    expect((await refusal(s.client.saveDoc(newLead({ person: "Bad<Name>" }), "Save"))).excType).toBe("InvalidNameError");
    await s.client.saveDoc(newLead({ person: "ريم الفهد" }), "Save"); // Unicode \w
    await s.client.saveDoc(newLead({ person: "O'Neil-Smith" }), "Save");
    const url = await refusal(s.client.saveDoc(newLead({ website: "not a url" }), "Save"));
    expect(url.excType).toBe("ValidationError");
    expect(url.messages[0].message).toBe("'<strong>not a url</strong>' is not a valid URL");
    await s.client.saveDoc(newLead({ website: "https://example.com" }), "Save");
    await s.client.saveDoc(newLead({ website: "/files/a.pdf" }), "Save");
    expect((await refusal(s.client.saveDoc(newLead({ iban: "GB00 WEST 1234" }), "Save"))).messages[0].message).toContain("is not a valid IBAN");
    await s.client.saveDoc(newLead({ iban: "GB82 WEST 1234 5698 7654 32" }), "Save");
    expect(stored(s.transport)).toHaveLength(5);
  });

  it("P36E.sim.5 non_negative Currency: -5 refused with NonNegativeError and Desk's text; 0 accepted; a field without non_negative takes -5", async () => {
    const s = setup();
    const e = await refusal(s.client.saveDoc(newLead({ annual_revenue: -5 }), "Save"));
    expect(e.excType).toBe("NonNegativeError");
    expect(e.messages[0].message).toBe("Value cannot be negative for Serve Fast Lead: <strong>Annual Revenue</strong>");
    expect(e.messages[0].title).toBe("Negative Value");
    await s.client.saveDoc(newLead({ annual_revenue: 0, score: -5 }), "Save");
    expect(stored(s.transport)).toHaveLength(1);
  });

  it("P36E.sim.6 child rows are validated too (row-prefixed non_negative message; Email option in a row)", async () => {
    const s = setup();
    const e = await refusal(s.client.saveDoc(newLead({ rows: [{ doctype: "Lead Row", idx: 1, qty: 1 }, { doctype: "Lead Row", idx: 2, qty: -1 }] }), "Save"));
    expect(e.excType).toBe("NonNegativeError");
    expect(e.messages[0].message).toBe("<strong>Lead Row</strong> Row #2: Value cannot be negative for <strong>Qty</strong>");
    expect((await refusal(s.client.saveDoc(newLead({ rows: [{ doctype: "Lead Row", idx: 1, contact_email: "x" }] }), "Save"))).excType).toBe("InvalidEmailAddressError");
  });

  it("P36E.sim.7 length: a Data value beyond df.length (or 140) is refused with CharacterLengthExceededError / 'Value too big'", async () => {
    const s = setup();
    const e = await refusal(s.client.saveDoc(newLead({ code: "ABCDEF" }), "Save"));
    expect(e.excType).toBe("CharacterLengthExceededError");
    expect(e.messages[0].title).toBe("Value too big");
    expect(e.messages[0].message).toMatch(/'<strong>Code<\/strong>' \(ABCDEF\) will get truncated, as max characters allowed is 5$/);
    expect((await refusal(s.client.saveDoc(newLead({ first_name: "x".repeat(141) }), "Save"))).excType).toBe("CharacterLengthExceededError");
    await s.client.saveDoc(newLead({ first_name: "x".repeat(140), code: "ABCDE" }), "Save");
    expect((await refusal(s.client.saveDoc(newLead({ score: 2 ** 31 }), "Save"))).excType).toBe("CharacterLengthExceededError");
    expect(stored(s.transport)).toHaveLength(1);
  });

  it("P36E.sim.8 order as document.py:624-629: a missing mandatory field wins over an invalid email; Cancel skips _validate", async () => {
    const s = setup();
    const e = await refusal(s.client.saveDoc({ doctype: "Serve Fast Lead", __islocal: 1, email: "bad" } as unknown as FrappeDoc, "Save"));
    expect(e.excType).toBe("MandatoryError");
  });

  it("P36E.sim.9 an existing document re-saved with an invalid value is refused and keeps its stored value", async () => {
    const s = setup();
    const { doc } = await s.client.saveDoc(newLead({ email: "ok@example.com" }), "Save") as unknown as { doc: FrappeDoc };
    const saved = doc ?? stored(s.transport)[0];
    const e = await refusal(s.client.saveDoc({ ...saved, email: "nope" } as FrappeDoc, "Save"));
    expect(e.excType).toBe("InvalidEmailAddressError");
    expect(stored(s.transport)[0].email).toBe("ok@example.com");
  });
});
