/** Lead pre-work for Phase 26: Import/Export gates (model.js:434-450, permissions.py:600-615) and the client's file primitives. */
import { describe, expect, it, vi } from "vitest";
import { canExport, canImport, readableFields, rolePermissions } from "../src/frappe/services/permissions";
import { createFrappeClient, FrappeError } from "../src/frappe/client";
import type { DocPerm } from "../src/frappe/contract";

const perm = (role: string, rights: Partial<DocPerm>): DocPerm => ({ role, permlevel: 0, read: 1, ...rights } as DocPerm);
const level0 = (perms: DocPerm[], roles: string[]) => rolePermissions(perms, roles).levels[0];

describe("canImport / canExport (DocType-level, as Desk's frappe.model.can_import / can_export)", () => {
  const perms = [perm("Sales User", { export: 1 }), perm("Data Entry", { import: 1 }), perm("Owner Exporter", { if_owner: 1, export: 1 })];
  it("import needs allow_import, then System Manager or the import right; export needs System Manager or the export right", () => {
    expect(canImport({ allow_import: 1 }, ["Data Entry"], level0(perms, ["Data Entry"]))).toBe(true);
    expect(canImport({ allow_import: 0 }, ["Data Entry"], level0(perms, ["Data Entry"]))).toBe(false);
    expect(canImport({ allow_import: 1 }, ["Sales User"], level0(perms, ["Sales User"]))).toBe(false);
    expect(canImport({ allow_import: 1 }, ["System Manager"], level0(perms, ["System Manager"]))).toBe(true);
    expect(canImport({ allow_import: 0 }, ["System Manager"], level0(perms, ["System Manager"]))).toBe(false);
    expect(canExport(["Sales User"], level0(perms, ["Sales User"]))).toBe(true);
    expect(canExport(["Data Entry"], level0(perms, ["Data Entry"]))).toBe(false);
    expect(canExport(["System Manager"], undefined)).toBe(true);
    expect(canExport(["Owner Exporter"], level0(perms, ["Owner Exporter"]))).toBe(true); // if_owner rows count; the server checks each row's owner
  });
  it("read, write, create and delete never imply import or export, and the two never imply each other", () => {
    const rw = [perm("Editor", { write: 1, create: 1, delete: 1 })];
    expect(canImport({ allow_import: 1 }, ["Editor"], level0(rw, ["Editor"]))).toBe(false);
    expect(canExport(["Editor"], level0(rw, ["Editor"]))).toBe(false);
    expect(canExport(["Data Entry"], level0(perms, ["Data Entry"]))).toBe(false);
    expect(canImport({ allow_import: 1 }, ["Sales User"], level0(perms, ["Sales User"]))).toBe(false);
  });
  it("missing information denies: no roles, no meta, no rights", () => {
    expect(canImport({ allow_import: 1 }, undefined, { import: true })).toBe(false);
    expect(canImport(undefined, ["Data Entry"], { import: true })).toBe(false);
    expect(canExport(undefined, { export: true })).toBe(false);
    expect(canExport(["Sales User"], undefined)).toBe(false);
  });
});

describe("readableFields (permlevel)", () => {
  const fields = [{ fieldname: "a", permlevel: 0 }, { fieldname: "b", permlevel: 1 }, { fieldname: "c" }];
  it("keeps the fields whose permlevel the user may read; nothing without level-0 read or without levels", () => {
    expect(readableFields(fields, [{ read: true }, { read: false }]).map((f) => f.fieldname)).toEqual(["a", "c"]);
    expect(readableFields(fields, [{ read: true }, { read: true }]).map((f) => f.fieldname)).toEqual(["a", "b", "c"]);
    expect(readableFields(fields, [{ read: false }, { read: true }])).toEqual([]);
    expect(readableFields(fields, undefined)).toEqual([]);
  });
});

describe("client file primitives: download / uploadFile", () => {
  const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
  it("download: POSTs JSON with the CSRF header and resolves to the streamed file with its filename", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => ({
      ok: true, status: 200, headers: headers({ "content-type": "text/csv", "content-disposition": 'attachment; filename="ToDo.csv"' }),
      blob: async () => new Blob(["a,b\n1,2"], { type: "text/csv" }), text: async () => "", _url: url, _init: init,
    })) as unknown as typeof fetch;
    const api = createFrappeClient({ fetch: fetchMock, csrfToken: "tok" });
    const f = await api.download("frappe.core.doctype.data_import.data_import.download_template", { doctype: "ToDo", file_type: "CSV" });
    expect(f.filename).toBe("ToDo.csv"); expect(f.contentType).toBe("text/csv"); expect(f.blob.size).toBe(7);
    const [url, init] = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("/api/method/frappe.core.doctype.data_import.data_import.download_template");
    expect((init.headers as Record<string, string>)["X-Frappe-CSRF-Token"]).toBe("tok");
    expect(JSON.parse(String(init.body))).toEqual({ doctype: "ToDo", file_type: "CSV" });
  });
  it("download: a JSON refusal (403 PermissionError) is a FrappeError of kind permission, never a file", async () => {
    const fetchMock = (async () => ({
      ok: false, status: 403, headers: headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ exc_type: "PermissionError", _server_messages: JSON.stringify([JSON.stringify({ message: "You are not allowed to export ToDo doctype" })]) }),
    })) as unknown as typeof fetch;
    const api = createFrappeClient({ fetch: fetchMock });
    const err = await api.download("frappe.core.doctype.data_import.data_import.download_template", { doctype: "ToDo" }).catch((e) => e as FrappeError);
    expect(err).toBeInstanceOf(FrappeError); expect((err as FrappeError).kind).toBe("permission"); expect((err as FrappeError).status).toBe(403);
  });
  it("uploadFile: multipart to /api/method/upload_file with Desk's field names; the File doc comes back", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchMock = (async (url: string, init: RequestInit) => { seen = { url, init }; return { ok: true, status: 200, headers: headers({}), text: async () => JSON.stringify({ message: { doctype: "File", name: "F1", file_url: "/private/files/x.csv" } }) }; }) as unknown as typeof fetch;
    const api = createFrappeClient({ fetch: fetchMock, csrfToken: "tok" });
    const doc = await api.uploadFile(new Blob(["x"]), "x.csv", { doctype: "Data Import", docname: "DI-1", fieldname: "import_file", isPrivate: true });
    expect(doc.name).toBe("F1");
    expect(seen!.url).toBe("/api/method/upload_file");
    const form = seen!.init.body as FormData;
    expect(form.get("doctype")).toBe("Data Import"); expect(form.get("docname")).toBe("DI-1"); expect(form.get("fieldname")).toBe("import_file");
    expect(form.get("is_private")).toBe("1"); expect(form.get("folder")).toBe("Home"); expect(form.get("file")).toBeInstanceOf(Blob);
    expect((seen!.init.headers as Record<string, string>)["X-Frappe-CSRF-Token"]).toBe("tok");
  });
  it("a client built on a custom JSON transport refuses file calls instead of guessing", async () => {
    const api = createFrappeClient({ transport: async () => ({}) });
    await expect(api.download("x.y", {})).rejects.toBeInstanceOf(FrappeError);
    await expect(api.uploadFile(new Blob(), "a")).rejects.toBeInstanceOf(FrappeError);
  });
});
