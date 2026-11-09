/**
 * P36e — the server-side field validation of `Document._validate` that the simulator's save lacked (SIMULATED).
 * Frappe v15.110, document.py:624-646 runs, in this order, for the document and then every child row:
 *   _validate_mandatory (the simulator's missingMandatory, unchanged) → _validate_data_fields → _validate_selects
 *   (strict mode only, unchanged) → _validate_non_negative → _validate_length.
 * Reproduced here (messages and exception types verbatim):
 *  - _validate_data_fields (base_document.py:922-955): Data options Email (split_emails → validate_email_address,
 *    utils/__init__.py:166-219; skipped when the owner and the value are standard users), Name (validate_name :147-163),
 *    Phone (validate_phone_number :128-144), URL (validate_url :222-249), IBAN (validate_iban :252-286).
 *    NOT reproduced: the Phone FIELDTYPE's validate_phone_number_with_country_code (:101-125) needs the `phonenumbers`
 *    library's numbering plans — a real-site check (validation matrix).
 *  - _validate_non_negative (document.py:656-676): Int / Float / Currency with non_negative and a value < 0.
 *  - _validate_length (base_document.py:981-1014, :1035-1048): varchar columns (Data, Link, Dynamic Link, Select,
 *    Read Only, Color, Icon, Phone, Autocomplete — database/mariadb/database.py:175-206, VARCHAR_LEN 140) longer than
 *    `df.length || 140`; Int / Long Int beyond the column's range.
 */
import { toFrappeError } from "../client";
import type { DocTypeMeta, FrappeDoc, FrappeDocField } from "../contract";

type MetaOf = (doctype: string) => DocTypeMeta | undefined;

const sm = (...messages: Record<string, unknown>[]) => JSON.stringify(messages.map((m) => JSON.stringify(m)));
function throwValidation(exc_type: string, message: string, title?: string): never {
  throw toFrappeError(417, { exc_type, _server_messages: sm({ message, indicator: "red", raise_exception: 1, ...(title ? { title } : {}) }) });
}
const bold = (s: string) => `<strong>${s}</strong>`;
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const STANDARD_USERS = new Set(["Guest", "Administrator"]); // frappe.STANDARD_USERS

// utils/__init__.py:37-44 — Python `re.match` anchors at the start only (an explicit `$` where the pattern has one)
const PHONE_NUMBER_PATTERN = /^([0-9 +_\-,.*#()]){1,20}$/;
const PERSON_NAME_PATTERN = /^[\p{L}\p{N}\p{M}_][\p{L}\p{N}\p{M}_'-]*( [\p{L}\p{N}\p{M}_][\p{L}\p{N}\p{M}_'-]*)*$/u; // Python \w is Unicode-aware
const EMAIL_MATCH_PATTERN = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i;
const MULTI_EMAIL_SPLIT = /[,\n](?=(?:[^"]|"[^"]*")*$)/; // MULTI_EMAIL_STRING_PATTERN

/** split_emails (utils/__init__.py:209-219). */
export function serverSplitEmails(txt: unknown): string[] {
  const s = String(txt ?? "").replace(/[\t\n\r]/g, " ");
  return s.split(MULTI_EMAIL_SPLIT).map((e) => e.trim()).filter(Boolean);
}
/** extract_email_id → email.utils.parseaddr (approximation: the `<…>` part when present, else the whole text). */
const extractEmailId = (e: string) => { const m = /<([^>]*)>/.exec(e); return (m ? m[1] : e).trim(); };

/** validate_email_address(email_str, throw=True) (utils/__init__.py:166-206). */
export function validateEmailAddress(emailStr: unknown): void {
  for (const raw of String(emailStr ?? "").trim().split(",")) {
    const e = raw.trim();
    if (e.includes("undisclosed-recipient")) continue; // _check returns False without throwing
    let ok = !!e;
    if (ok && e.includes(" ") && !e.includes("<")) ok = false;
    else if (ok) { const id = extractEmailId(e); ok = !!id && EMAIL_MATCH_PATTERN.test(id); }
    if (!ok && e) throwValidation("InvalidEmailAddressError", `${escapeHtml(e)} is not a valid Email Address`);
  }
}
/** validate_name(name, throw=True) — empty is not checked. */
export function validateName(v: unknown): void {
  if (!v) return;
  const name = String(v).trim();
  if (!PERSON_NAME_PATTERN.test(name)) throwValidation("InvalidNameError", `${name} is not a valid Name`);
}
/** validate_phone_number(phone, throw=True) — empty is not checked. */
export function validatePhoneNumber(v: unknown): void {
  if (!v) return;
  const phone = String(v).trim();
  if (!PHONE_NUMBER_PATTERN.test(phone)) throwValidation("InvalidPhoneNumberError", `${phone} is not a valid Phone Number`);
}
/** validate_url(txt, throw=True): scheme and (netloc or path), or a "/" relative URL. */
export function validateUrl(v: unknown): void {
  const txt = String(v ?? "");
  if (!txt) return;
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):(\/\/([^/?#]*))?([^?#]*)/.exec(txt); // urlparse: scheme, netloc, path
  const valid = (!!m && !!m[1] && (!!m[3] || !!m[4])) || txt.startsWith("/");
  if (!valid) throwValidation("ValidationError", `'${bold(txt)}' is not a valid URL`);
}
/** validate_iban (utils/__init__.py:252-286): mod-97 over the flipped, letter-encoded IBAN; empty is not checked. */
export function validateIban(v: unknown): void {
  const raw = String(v ?? "");
  if (!raw) return;
  const iban = raw.replace(/ /g, "").toUpperCase();
  const encoded = (iban.slice(4) + iban.slice(0, 4)).split("").map((c) => (c >= "A" && c <= "Z" ? String(9 + c.charCodeAt(0) - 64) : c)).join("");
  let valid = /^[0-9]+$/.test(encoded); // int("".join(encoded)) raises ValueError otherwise
  if (valid) { let rem = 0; for (const ch of encoded) rem = (rem * 10 + Number(ch)) % 97; valid = rem === 1; }
  if (!valid) throwValidation("ValidationError", `'${bold(raw)}' is not a valid IBAN`);
}

const VARCHAR = new Set(["Data", "Link", "Dynamic Link", "Select", "Read Only", "Color", "Icon", "Phone", "Autocomplete"]);
const INT_MAX: Record<string, number> = { int: 2 ** 31 - 1, bigint: Number.MAX_SAFE_INTEGER /* 2**63-1 exceeds JS precision */ };
const LAYOUT_OR_TABLE = new Set(["Section Break", "Column Break", "Tab Break", "HTML", "Button", "Heading", "Fold", "Image", "Table", "Table MultiSelect"]);

function validateOne(meta: DocTypeMeta, doc: FrappeDoc, isChild: boolean, phase: "data" | "rest"): void {
  const fields = meta.fields.filter((f) => !LAYOUT_OR_TABLE.has(f.fieldtype));
  // _validate_data_fields
  if (phase === "data") for (const f of fields) {
    if (f.fieldtype !== "Data") continue;
    const old = (f as FrappeDocField & { oldfieldtype?: string }).oldfieldtype;
    if (old && old !== "Data") continue;
    const data = doc[f.fieldname];
    switch (f.options) {
      case "Email":
        if (STANDARD_USERS.has(String(doc.owner ?? "")) && STANDARD_USERS.has(String(data ?? ""))) break;
        for (const e of serverSplitEmails(data)) validateEmailAddress(e);
        break;
      case "Name": validateName(data); break;
      case "Phone": validatePhoneNumber(data); break;
      case "URL": validateUrl(data); break;
      case "IBAN": validateIban(data); break;
    }
  }
  if (phase === "data") return;
  // _validate_non_negative
  for (const f of fields) {
    if (!f.non_negative || !["Int", "Float", "Currency"].includes(f.fieldtype)) continue;
    const n = Number(doc[f.fieldname]);
    if (Number.isFinite(n) && n < 0) {
      const label = f.label || f.fieldname;
      const msg = isChild
        ? `${bold(meta.name)} Row #${String(doc.idx ?? "")}: Value cannot be negative for ${bold(label)}`
        : `Value cannot be negative for ${meta.name}: ${bold(label)}`;
      throwValidation("NonNegativeError", msg, "Negative Value");
    }
  }
  // _validate_length (single DocTypes store mediumtext: skipped)
  if (meta.issingle) return;
  const reference = isChild ? `${meta.name}, Row ${String(doc.idx ?? "")}` : `${meta.name} ${String(doc.name ?? "")}`;
  for (const f of fields) {
    const v = doc[f.fieldname];
    if (v === null || v === undefined || f.fieldtype === "Check" || f.is_virtual) continue;
    if (VARCHAR.has(f.fieldtype)) {
      const max = Math.trunc(Number(f.length)) || 140;
      const s = String(v);
      if ([...s].length > max) throwValidation("CharacterLengthExceededError", `${reference}: '${bold(f.label || f.fieldname)}' (${s}) will get truncated, as max characters allowed is ${max}`, "Value too big");
    } else if (f.fieldtype === "Int" || f.fieldtype === "Long Int") {
      const type = f.fieldtype === "Long Int" || Math.trunc(Number(f.length)) > 11 ? "bigint" : "int";
      const n = Math.trunc(Number(v)) || 0;
      if (Math.abs(n) > INT_MAX[type]) throwValidation("CharacterLengthExceededError", `${reference}: '${bold(f.label || f.fieldname)}' (${String(v)}) will get truncated, as max characters allowed is ${INT_MAX[type]}`, "Value too big");
    }
  }
}

/**
 * The document then each child row, as `Document._validate` (document.py:624-646). The simulator's save calls phase
 * "data" (_validate_data_fields) after _validate_mandatory, then its strict-mode _validate_selects, then phase "rest"
 * (_validate_non_negative, _validate_length) — for Save / Submit / Update, not Cancel (`_validate` is skipped for
 * cancel, document.py:416-417).
 */
export function validateDocumentFields(meta: DocTypeMeta, doc: FrappeDoc, metaOf: MetaOf, phase: "data" | "rest"): void {
  validateOne(meta, doc, false, phase);
  for (const tf of meta.fields.filter((f) => f.fieldtype === "Table" || f.fieldtype === "Table MultiSelect")) {
    const cm = tf.options ? metaOf(tf.options) : undefined;
    if (!cm) continue;
    for (const row of (doc[tf.fieldname] as FrappeDoc[] | undefined) ?? []) validateOne(cm, row, true, phase);
  }
}
