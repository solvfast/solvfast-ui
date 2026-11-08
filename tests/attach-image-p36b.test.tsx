/**
 * P36b "attachimage" — Desk's Attach Image / Attach controls (Frappe 15.110 form/controls/attach.js, attach_image.js,
 * file_uploader/FileUploader.vue) and the image_field menu (form/sidebar/user_image.js, form_sidebar.html), on the
 * in-package SIMULATOR (`createFixtureTransport` + `withSimulatedSidebar`; `get_max_file_size` from handlers/form.ts).
 * Request shapes are asserted on `store.calls`; permission decisions are the simulator's approximation — SIMULATED,
 * never a real site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient, type FrappeApi } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { DocInfo, DocPerm, DocTypeMeta, FrappeDoc, MetaBundle } from "../src/frappe/contract";
import { createFixtureTransport, simScenario, type FixtureTransport, type SimulatedPermissions } from "../src/frappe/testing";
import { withSimulatedSidebar } from "../src/frappe/testing/handlers/sidebar";
import { FrappeAttachHost, FrappeField, FrappeFormView, attachSaveAction, attachUploadOptions, fileIdForUrl, type FrappeAttachHostValue } from "../src/frappe/form";
import { AttachInput, parseAttachValue } from "../src/fields";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const T = "2026-11-02 09:00:00.000000";
const ALL = { read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1 } as const;
const PERMS: DocPerm[] = [
  { role: "Visit Writer", permlevel: 0, ...ALL },
  { role: "Visit Reader", permlevel: 0, read: 1 },
];
const VISIT: DocTypeMeta = {
  name: "Site Visit", autoname: "hash", title_field: "subject", image_field: "photo", is_submittable: 1, permissions: PERMS,
  fields: [
    { fieldname: "subject", fieldtype: "Data", label: "Subject" },
    { fieldname: "photo", fieldtype: "Attach Image", label: "Photo", allow_on_submit: 1 },
    { fieldname: "report", fieldtype: "Attach", label: "Report" },
    { fieldname: "items", fieldtype: "Table", label: "Items", options: "Visit Item" },
  ],
};
const ITEM: DocTypeMeta = { name: "Visit Item", istable: 1, permissions: [], fields: [{ fieldname: "pic", fieldtype: "Attach Image", label: "Pic" }] };
const WRITER = simScenario.fullAccess("sara@example.com", ["Visit Writer"], { fullName: "Sara Q" });
const READER = simScenario.readOnly("lina@example.com", ["Visit Reader"], { fullName: "Lina Q" });
const visit = (over: Partial<FrappeDoc> = {}): FrappeDoc => ({ doctype: "Site Visit", name: "SV-1", subject: "Riyadh depot", owner: "sara@example.com", creation: T, modified: T, docstatus: 0, ...over });
const PHOTO = (over: Partial<FrappeDoc> = {}) => ({ doctype: "File", name: "F-PHOTO", file_name: "front.png", file_url: "/private/files/front.png", is_private: 1, attached_to_doctype: "Site Visit", attached_to_name: "SV-1", attached_to_field: "photo", owner: "sara@example.com", modified: T, creation: T, ...over }) as FrappeDoc;
const LIB = { doctype: "File", name: "F-LIB", file_name: "logo-2026.png", file_url: "/files/logo-2026.png", is_private: 0, owner: "Administrator", modified: T, creation: T } as FrappeDoc;

function site(opts: { permissions?: SimulatedPermissions; meta?: Partial<DocTypeMeta>; doc?: Partial<FrappeDoc>; files?: FrappeDoc[]; maxMb?: number } = {}) {
  const base = createFixtureTransport({
    meta: { "Site Visit": [{ ...VISIT, ...opts.meta }], "Visit Item": [ITEM] },
    docs: {
      "Site Visit": [visit(opts.doc)],
      File: opts.files ?? [],
      ...(opts.maxMb != null ? { "System Settings": [{ doctype: "System Settings", name: "System Settings", max_file_size: opts.maxMb, modified: T, creation: T } as FrappeDoc] } : {}),
    },
  }, { permissions: opts.permissions ?? WRITER });
  const t = withSimulatedSidebar(base);
  const client = createFrappeClient({ transport: t, files: t.files });
  return { t, client };
}
type Site = ReturnType<typeof site>;
function mount(s: Site, ui: React.ReactElement, language: "en" | "ar" = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ses = s.t.store.session!;
  const r = render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={s.client} queryClient={qc} session={{ user: ses.user, fullName: ses.fullName, roles: ses.roles }}>
        <ThemeProvider defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
  return { ...r, qc };
}
const calls = (t: FixtureTransport, method: string) => t.store.calls.filter((c) => c.method === method);
const BUNDLE: MetaBundle = { doctype: "Site Visit", meta: VISIT, children: { "Visit Item": ITEM } };
const bundle = BUNDLE;

/**
 * A form host as `FrappeFormView` provides it (Desk's `frm`): the document in state, `save(action)` = savedocs through the
 * client (the real request path), docinfo read from the server.
 */
function FormHarness({ client, field, initial, docinfo, host: spy, grid, bundle = BUNDLE }: {
  client: FrappeApi; field: string; initial: FrappeDoc; docinfo?: DocInfo; host?: (h: FrappeAttachHostValue) => void; grid?: boolean; bundle?: MetaBundle;
}) {
  const [doc, setDoc] = React.useState<FrappeDoc>(initial);
  const ref = React.useRef(doc);
  ref.current = doc;
  const host = React.useMemo<FrappeAttachHostValue>(() => ({
    save: async (action) => { const saved = await client.saveDoc(ref.current, action); ref.current = saved; setDoc(saved); return true; },
    getDoc: () => ref.current,
    getDocInfo: () => docinfo,
  }), [client, docinfo]);
  React.useEffect(() => { spy?.(host); }, [host, spy]);
  const row = grid ? ((doc.items as FrappeDoc[] | undefined)?.[0] ?? null) : null;
  return (
    <FrappeAttachHost value={host}>
      {row ? (
        <FrappeField df={ITEM.fields[0]!} value={row.pic} doc={row} parent={doc} bundle={bundle} status="Write"
          onChange={(v) => { const next = { ...ref.current, items: [{ ...row, pic: v }] }; ref.current = next; setDoc(next); }} />
      ) : (
        <FrappeField df={VISIT.fields.find((f) => f.fieldname === field)!} value={doc[field]} doc={doc} bundle={bundle} status="Write"
          onChange={(v) => { const next = { ...ref.current, [field]: v, __unsaved: 1 as const }; ref.current = next; setDoc(next); }} />
      )}
      <output data-testid="value">{String((row ? row.pic : doc[field]) ?? "")}</output>
    </FrappeAttachHost>
  );
}

async function openUploader() {
  fireEvent.click(screen.getByRole("button", { name: /Attach|إرفاق/ }));
  return screen.findByRole("dialog");
}
function chooseFile(dialog: HTMLElement, name = "front.png", type = "image/png", size = 10) {
  const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File([new Uint8Array(size)], name, { type });
  fireEvent.change(input, { target: { files: [file] } });
  return { input, file };
}
const upload = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
const value = () => screen.getByTestId("value").textContent;

describe("P36b attachimage — the Attach Image control (SIMULATED)", () => {
  it("P36B.attachimage.1 Attach opens Desk's uploader (title Upload; My Device / Library / Link); image/* only; the site's max_file_size is read", async () => {
    const s = site();
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
    const dialog = await openUploader();
    expect(within(dialog).getByRole("heading", { name: "Upload" })).toBeTruthy();
    for (const tab of ["My Device", "Library", "Link"]) expect(within(dialog).getByRole("tab", { name: tab })).toBeTruthy();
    expect(dialog.querySelector('input[type="file"]')!.getAttribute("accept")).toBe("image/*");
    await waitFor(() => expect(calls(s.t, "frappe.core.api.file.get_max_file_size")).toHaveLength(1));
  });

  it("P36B.attachimage.2 upload: upload_file multipart (private by default, folder Home, doctype / docname / fieldname); value = file_url; the form is SAVED (savedocs Save); docinfo re-read", async () => {
    const s = site();
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
    const dialog = await openUploader();
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(1));
    expect(calls(s.t, "upload_file")[0]!.args).toEqual({ file_name: "front.png", is_private: 1, folder: "Home", __size: 10, doctype: "Site Visit", docname: "SV-1", fieldname: "photo" });
    const saved = calls(s.t, "frappe.desk.form.save.savedocs")[0]!.args;
    expect(saved.action).toBe("Save");
    expect(JSON.parse(String(saved.doc)).photo).toBe("/private/files/front.png");
    expect(value()).toBe("/private/files/front.png");
    const file = [...s.t.store.docs.get("File")!.values()][0]!;
    expect(file).toMatchObject({ attached_to_doctype: "Site Visit", attached_to_name: "SV-1", attached_to_field: "photo", is_private: 1 });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("link", { name: "/private/files/front.png" })).toBeTruthy();
  });

  it("P36B.attachimage.3 a file that is not an image is skipped (FileUploader.vue:469-500): no upload_file", async () => {
    const s = site();
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
    const dialog = await openUploader();
    chooseFile(dialog, "report.pdf", "application/pdf");
    expect(within(dialog).getByRole("alert").textContent).toMatch(/report\.pdf/);
    expect(within(dialog).getByRole("button", { name: "Upload" }).hasAttribute("disabled")).toBe(true);
    expect(calls(s.t, "upload_file")).toHaveLength(0);
  });

  it("P36B.attachimage.4 max_file_size (System Settings, MB): a file of exactly the limit is skipped — Desk needs size < max (FileUploader.vue:491); a smaller one uploads", async () => {
    const s = site({ maxMb: 1 });
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
    const dialog = await openUploader();
    await waitFor(() => expect(calls(s.t, "frappe.core.api.file.get_max_file_size")).toHaveLength(1));
    await act(async () => { await Promise.resolve(); });
    chooseFile(dialog, "big.png", "image/png", 1024 * 1024);
    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toMatch(/big\.png/));
    chooseFile(dialog, "ok.png", "image/png", 1024 * 1024 - 1);
    upload(dialog);
    await waitFor(() => expect(calls(s.t, "upload_file")).toHaveLength(1));
    expect(calls(s.t, "upload_file")[0]!.args.file_name).toBe("ok.png");
  });

  it("P36B.attachimage.5 public: the field's make_attachment_public, or the DocType's make_attachments_public, starts the file public (attach.js:84-86); the private switch still applies", async () => {
    expect(attachUploadOptions({ fieldname: "photo", fieldtype: "Attach Image", make_attachment_public: 1 }).defaultPrivate).toBe(false);
    expect(attachUploadOptions({ fieldname: "photo", fieldtype: "Attach Image" }, { ...bundle, meta: { ...VISIT, make_attachments_public: 1 } }).defaultPrivate).toBe(false);
    expect(attachUploadOptions({ fieldname: "photo", fieldtype: "Attach Image" }, bundle).defaultPrivate).toBe(true);
    const s = site({ meta: { make_attachments_public: 1 } });
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} bundle={{ ...BUNDLE, meta: { ...VISIT, make_attachments_public: 1 } }} />);
    const dialog = await openUploader();
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(calls(s.t, "upload_file")).toHaveLength(1));
    expect(calls(s.t, "upload_file")[0]!.args.is_private).toBe(0);
  });

  it("P36B.attachimage.6 Library: upload_file { library_file_name, folder Home, doctype, docname, fieldname } (FileUploader.vue:535-546); the value is that file's URL", async () => {
    const s = site({ files: [LIB] });
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
    const dialog = await openUploader();
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Library" }), { button: 0 });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Search files" }), { target: { value: "logo" } });
    fireEvent.click(await within(dialog).findByRole("option", { name: /logo-2026\.png/ }));
    upload(dialog);
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(1));
    expect(calls(s.t, "upload_file")[0]!.args).toEqual({ library_file_name: "F-LIB", folder: "Home", doctype: "Site Visit", docname: "SV-1", fieldname: "photo" });
    expect(value()).toBe("/files/logo-2026.png");
  });

  it("P36B.attachimage.7 Link: upload_file { file_url, is_private 0, folder Home, doctype, docname, fieldname } (FileUploader.vue:547-559)", async () => {
    const s = site();
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
    const dialog = await openUploader();
    fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Link" }), { button: 0 });
    fireEvent.change(within(dialog).getByLabelText("Web link (URL)"), { target: { value: "https://cdn.example.com/a.png" } });
    upload(dialog);
    await waitFor(() => expect(calls(s.t, "upload_file")).toHaveLength(1));
    expect(calls(s.t, "upload_file")[0]!.args).toEqual({ file_url: "https://cdn.example.com/a.png", is_private: 0, folder: "Home", doctype: "Site Visit", docname: "SV-1", fieldname: "photo" });
    await waitFor(() => expect(value()).toBe("https://cdn.example.com/a.png"));
  });

  it("P36B.attachimage.8 a submitted document is saved with Update (attach.js:141)", async () => {
    expect(attachSaveAction({ docstatus: 1 })).toBe("Update");
    expect(attachSaveAction({ docstatus: 0 })).toBe("Save");
    const s = site({ doc: { docstatus: 1 } });
    const host = vi.fn();
    mount(s, <FormHarness client={s.client} field="photo" initial={visit({ docstatus: 1 })} host={host} />);
    const dialog = await openUploader();
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(1));
    expect(calls(s.t, "frappe.desk.form.save.savedocs")[0]!.args.action).toBe("Update");
  });

  it("P36B.attachimage.9 negative: a reader's upload is refused by the server (403, check_write_permission) — shown on the file; value unchanged; nothing saved", async () => {
    const s = site({ permissions: READER });
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
    const dialog = await openUploader();
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(dialog.querySelector('[data-upload-row="front.png"]')?.getAttribute("data-status")).toBe("failed"));
    expect(calls(s.t, "upload_file")).toHaveLength(1);
    expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(0);
    expect(value()).toBe("");
    expect(s.t.store.docs.get("File")?.size ?? 0).toBe(0);
  });

  it("P36B.attachimage.10 a NEW document uploads attached to its new-… name (attach.js:80-87; handler.py:276-280 checks write on a new doc)", async () => {
    const s = site();
    mount(s, <FrappeField df={VISIT.fields[1]!} value={null} doc={{ doctype: "Site Visit", name: "new-site-visit-abc", __islocal: 1 } as FrappeDoc} bundle={bundle} status="Write" onChange={() => {}} />);
    const dialog = await openUploader();
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(calls(s.t, "upload_file")).toHaveLength(1));
    expect(calls(s.t, "upload_file")[0]!.args).toMatchObject({ doctype: "Site Visit", docname: "new-site-visit-abc", fieldname: "photo" });
    // negative: without create / write on the DocType the server refuses (403)
    cleanup();
    const r = site({ permissions: READER });
    mount(r, <FrappeField df={VISIT.fields[1]!} value={null} doc={{ doctype: "Site Visit", name: "new-site-visit-abc", __islocal: 1 } as FrappeDoc} bundle={bundle} status="Write" onChange={() => {}} />);
    const d2 = await openUploader();
    chooseFile(d2);
    upload(d2);
    await waitFor(() => expect(d2.querySelector('[data-upload-row="front.png"]')?.getAttribute("data-status")).toBe("failed"));
  });

  it("P36B.attachimage.11 Clear: confirmation → remove_attach { fid, dt, dn } for the File of that URL in docinfo → value null → saved (attach.js:36-46)", async () => {
    const s = site({ doc: { photo: "/private/files/front.png" }, files: [PHOTO()] });
    const info = await s.client.getDocInfo("Site Visit", "SV-1");
    s.t.store.calls.length = 0;
    mount(s, <FormHarness client={s.client} field="photo" initial={visit({ photo: "/private/files/front.png" })} docinfo={info} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(await screen.findByRole("alertdialog", { name: "Are you sure you want to delete the attachment?" })).toBeTruthy();
    expect(calls(s.t, "frappe.desk.form.utils.remove_attach")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(1));
    expect(calls(s.t, "frappe.desk.form.utils.remove_attach")[0]!.args).toEqual({ fid: "F-PHOTO", dt: "Site Visit", dn: "SV-1" });
    expect(JSON.parse(String(calls(s.t, "frappe.desk.form.save.savedocs")[0]!.args.doc)).photo).toBeNull();
    expect(s.t.store.docs.get("File")!.has("F-PHOTO")).toBe(false);
    expect(screen.getByRole("button", { name: /Attach/ })).toBeTruthy();
  });

  it("P36B.attachimage.12 Clear with no File of that URL in docinfo: no remove_attach (attachments.js:212-215), still cleared and saved; No keeps everything", async () => {
    const s = site({ doc: { photo: "/files/elsewhere.png" } });
    mount(s, <FormHarness client={s.client} field="photo" initial={visit({ photo: "/files/elsewhere.png" })} docinfo={{ attachments: [] } as unknown as DocInfo} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(await screen.findByRole("button", { name: "No" }));
    expect(value()).toBe("/files/elsewhere.png");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(1));
    expect(calls(s.t, "frappe.desk.form.utils.remove_attach")).toHaveLength(0);
  });

  it("P36B.attachimage.13 negative: remove_attach refused (protected file of a submitted document) — the message is shown and the form is NOT saved", async () => {
    const s = site({ doc: { docstatus: 1, photo: "/private/files/front.png" }, files: [PHOTO()], meta: { protect_attached_files: 1 } });
    const info = await s.client.getDocInfo("Site Visit", "SV-1");
    mount(s, <FormHarness client={s.client} field="photo" initial={visit({ docstatus: 1, photo: "/private/files/front.png" })} docinfo={info} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/protected document/);
    expect(calls(s.t, "frappe.desk.form.utils.remove_attach")).toHaveLength(1);
    expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(0);
    expect(s.t.store.docs.get("File")!.has("F-PHOTO")).toBe(true);
  });

  it("P36B.attachimage.14 Reload File re-sends this session's last local file (attach.js:56-60, 146-150); hidden before any upload", async () => {
    const s = site({ doc: { photo: "/private/files/old.png" } });
    mount(s, <FormHarness client={s.client} field="photo" initial={visit({ photo: "/private/files/old.png" })} />);
    expect(screen.queryByRole("button", { name: "Reload File" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(1));
    const dialog = await openUploader();
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(2));
    fireEvent.click(await screen.findByRole("button", { name: "Reload File" }));
    await waitFor(() => expect(calls(s.t, "upload_file")).toHaveLength(2));
    expect(calls(s.t, "upload_file")[1]!.args).toMatchObject({ file_name: "front.png", fieldname: "photo", is_private: 1 });
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(3));
  });

  it("P36B.attachimage.15 outside a form (no FrappeAttachHost, Desk's control without frm): upload sets the value only; Clear only clears — no save, no remove_attach", async () => {
    const s = site({ files: [PHOTO()] });
    const onChange = vi.fn();
    mount(s, <FrappeField df={VISIT.fields[1]!} value={null} doc={visit()} bundle={bundle} status="Write" onChange={onChange} />);
    const dialog = await openUploader();
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("/private/files/front.png"));
    cleanup();
    const onChange2 = vi.fn();
    mount(s, <FrappeField df={VISIT.fields[1]!} value="/private/files/front.png" doc={visit()} bundle={bundle} status="Write" onChange={onChange2} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(onChange2).toHaveBeenCalledWith(null));
    expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(0);
    expect(calls(s.t, "frappe.desk.form.utils.remove_attach")).toHaveLength(0);
  });

  it("P36B.attachimage.16 a child-table row's Attach Image attaches to the PARENT document with the row field's name; the parent form is saved", async () => {
    const s = site({ doc: { items: [{ doctype: "Visit Item", name: "row-1", parent: "SV-1", parenttype: "Site Visit", parentfield: "items", idx: 1 }] } });
    const initial = visit({ items: [{ doctype: "Visit Item", name: "row-1", parent: "SV-1", parenttype: "Site Visit", parentfield: "items", idx: 1 }] as unknown as FrappeDoc[] });
    mount(s, <FormHarness client={s.client} field="photo" initial={initial} grid />);
    const dialog = await openUploader();
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(1));
    expect(calls(s.t, "upload_file")[0]!.args).toMatchObject({ doctype: "Site Visit", docname: "SV-1", fieldname: "pic" });
  });

  it("P36B.attachimage.17 the image preview: focusing / hovering the link shows the image, 150px, object-fit contain (attach_image.js:156-169); Attach shows none", async () => {
    const s = site();
    mount(s, <FrappeField df={VISIT.fields[1]!} value="/files/front%20v2.png" doc={visit()} bundle={bundle} status="Write" onChange={() => {}} />);
    act(() => screen.getByRole("link", { name: "/files/front%20v2.png" }).focus());
    const img = await screen.findByRole("img", { name: "Preview of front v2.png" });
    expect(img.getAttribute("width")).toBe("150");
    expect((img as HTMLImageElement).style.objectFit).toBe("contain");
    cleanup();
    mount(s, <FrappeField df={VISIT.fields[2]!} value="/files/r.pdf" doc={visit()} bundle={bundle} status="Write" onChange={() => {}} />);
    act(() => screen.getByRole("link", { name: "/files/r.pdf" }).focus());
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("P36B.attachimage.18 read-only: a link to the file (formatters.js:410-413), no Attach / Clear", () => {
    const s = site();
    mount(s, <FrappeField df={VISIT.fields[1]!} value="/files/a.png" doc={visit()} bundle={bundle} status="Read" onChange={() => {}} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/files/a.png");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("P36B.attachimage.19 Arabic: Attach, Clear, Reload File and the confirmation are translated", async () => {
    const s = site();
    mount(s, <FrappeField df={VISIT.fields[1]!} value="/files/a.png" doc={visit()} bundle={bundle} status="Write" onChange={() => {}} />, "ar");
    fireEvent.click(screen.getByRole("button", { name: "مسح" }));
    expect(await screen.findByRole("button", { name: "نعم" })).toBeTruthy();
  });

  it("P36B.attachimage.20 helpers: FILENAME,DATA_URL values (attach.js:99-106); the File of a URL (attachments.js:199-207)", () => {
    expect(parseAttachValue("a,b.png,data:image/png;base64,AAA")).toEqual({ text: "a,b.png", href: "data:image/png;base64,AAA", fileName: "a,b.png" });
    expect(parseAttachValue("/files/x%20y.png")).toEqual({ text: "/files/x%20y.png", href: "/files/x%20y.png", fileName: "x y.png" });
    expect(fileIdForUrl([{ name: "F1", file_url: "/files/a.png" }, { name: "F2", file_url: "/files/b.png" }], "/files/b.png")).toBe("F2");
    expect(fileIdForUrl([], "/files/b.png")).toBeUndefined();
    render(<ThemeProvider storageKeys={null}><AttachInput value="a,b.png,data:image/png;base64,AAA" onAttach={() => {}} /></ThemeProvider>);
    expect(screen.getByRole("link", { name: "a,b.png" }).getAttribute("href")).toBe("data:image/png;base64,AAA");
  });
});

describe("P36b attachimage — the form image (meta.image_field) menu (SIMULATED)", () => {
  const rights = (write: boolean) => ({ levels: [{ read: true, write, create: write, submit: write }], can: (p: string) => p === "read" || write, known: true });
  function view(s: Site, opts: { doc?: FrappeDoc; write?: boolean; meta?: Partial<DocTypeMeta>; docinfo?: DocInfo } = {}) {
    const onSave = vi.fn(async (d: FrappeDoc, action: string) => s.client.saveDoc(d, action as "Save"));
    const b: MetaBundle = { ...bundle, meta: { ...VISIT, ...opts.meta } };
    const r = mount(s, <FrappeFormView bundle={b} doc={opts.doc ?? visit()} docinfo={opts.docinfo} permissions={rights(opts.write ?? true)} onSave={onSave} />);
    return { ...r, onSave };
  }

  it("P36B.attachimage.21 Change → Upload: the image field's uploader (image/*), then value set and the form saved (user_image.js:70-77 → attach.js:65-69, 137-144)", async () => {
    const s = site();
    const { onSave } = view(s);
    fireEvent.keyDown(screen.getByRole("button", { name: /Change/ }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Upload" }));
    expect(screen.queryByRole("menuitem", { name: "Remove" })).toBeNull();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('input[type="file"]')!.getAttribute("accept")).toBe("image/*");
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![0].photo).toBe("/private/files/front.png");
    expect(calls(s.t, "upload_file")[0]!.args).toMatchObject({ doctype: "Site Visit", docname: "SV-1", fieldname: "photo", is_private: 1 });
    await waitFor(() => expect(document.querySelector("[data-form-image]")?.getAttribute("data-form-image")).toBe("/private/files/front.png"));
  });

  it("P36B.attachimage.22 Change → Remove: remove_attach for the File of the image, then the field set to \"\" and saved — no confirmation (user_image.js:79-85)", async () => {
    const s = site({ doc: { photo: "/private/files/front.png" }, files: [PHOTO()] });
    const info = await s.client.getDocInfo("Site Visit", "SV-1");
    const { onSave } = view(s, { doc: visit({ photo: "/private/files/front.png" }), docinfo: info });
    fireEvent.keyDown(screen.getByRole("button", { name: /Change/ }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(calls(s.t, "frappe.desk.form.utils.remove_attach")[0]!.args).toEqual({ fid: "F-PHOTO", dt: "Site Visit", dn: "SV-1" });
    expect(onSave.mock.calls[0]![0].photo).toBe("");
  });

  it("P36B.attachimage.23 negative: no Change menu without write, on a new document, or when the image field is read_only (form_sidebar.js:17-22, 70-73); the image is still shown", () => {
    const s = site();
    view(s, { doc: visit({ photo: "/files/a.png" }), write: false });
    expect(screen.queryByRole("button", { name: /Change/ })).toBeNull();
    expect(document.querySelector("[data-form-image]")?.getAttribute("data-form-image")).toBe("/files/a.png");
    cleanup();
    view(s, { doc: { doctype: "Site Visit", name: "new-site-visit-1", __islocal: 1, docstatus: 0 } as FrappeDoc });
    expect(screen.queryByRole("button", { name: /Change/ })).toBeNull();
    cleanup();
    view(s, { meta: { fields: VISIT.fields.map((f) => (f.fieldname === "photo" ? { ...f, read_only: 1 } : f)) } });
    expect(screen.queryByRole("button", { name: /Change/ })).toBeNull();
  });

  it("P36B.attachimage.24 negative: Remove refused by the server (a reader's stale menu) — shown, nothing saved", async () => {
    const s = site({ permissions: READER, doc: { photo: "/private/files/front.png" }, files: [PHOTO({ owner: "Administrator" })] });
    const info = { attachments: [{ name: "F-PHOTO", file_name: "front.png", file_url: "/private/files/front.png", is_private: 1 }] } as unknown as DocInfo;
    const { onSave } = view(s, { doc: visit({ photo: "/private/files/front.png" }), docinfo: info });
    fireEvent.keyDown(screen.getByRole("button", { name: /Change/ }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/not allowed to delete/i);
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("P36b attachimage — showcase (SIMULATED)", () => {
  it("P36B.attachimage.25 the page is routed under Frappe, labelled SIMULATED, and FrappeForm (FrappeFormView provides the host) saves after an upload", async () => {
    const { PAGES } = await import("../showcase/src/routes");
    const { P36bAttachImagePage } = await import("../showcase/src/pages/p36b-attachimage");
    expect(PAGES.find((p) => p.id === "p36b-attachimage")?.group.id).toBe("frappe");
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><P36bAttachImagePage /></ThemeProvider>);
    expect(screen.getAllByText(/SIMULATED/).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: "/files/depot-front.png" })).toBeTruthy();
    const form = document.querySelector<HTMLElement>('[data-doctype="Site Visit"]')!;
    fireEvent.click(within(form).getByRole("button", { name: /Report Attach/ }));
    const dialog = await screen.findByRole("dialog");
    chooseFile(dialog, "visit.pdf", "application/pdf");
    upload(dialog);
    await waitFor(() => expect(within(form).getByRole("link", { name: /\/files\/visit\.pdf/ })).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/frappe\.desk\.form\.save\.savedocs/)).toBeTruthy(), { timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Integration round: FrappeFormView provides the host; FileUploader options (Optimize, private / public warning,
// thumbnails, Crop, Camera); simulated savedocs relink.
// ---------------------------------------------------------------------------------------------------------------------
type UploadSeen = { filename: string; opts: Record<string, unknown>; file: Blob };
/** Records what the client hands to the files transport (the multipart fields), then lets the simulator answer. */
function recordUploads(s: Site): UploadSeen[] {
  const seen: UploadSeen[] = [];
  const inner = s.t.files.upload.bind(s.t.files);
  s.t.files.upload = async (file, filename, opts) => { seen.push({ file, filename, opts: { ...opts } }); return inner(file, filename, opts); };
  return seen;
}
const rightsAll = { levels: [{ read: true, write: true, create: true, submit: true, cancel: true, amend: true }], can: () => true, known: true };

describe("P36b attachimage — FrappeFormView is the Attach controls' form (SIMULATED)", () => {
  function formView(s: Site, doc: FrappeDoc, docinfo?: DocInfo) {
    const onSave = vi.fn(async (d: FrappeDoc, action: string) => s.client.saveDoc(d, action as "Save"));
    const r = mount(s, <FrappeFormView bundle={BUNDLE} doc={doc} docinfo={docinfo} permissions={rightsAll} onSave={onSave} />);
    const photo = () => document.querySelector<HTMLElement>('[data-attach-field]')!;
    return { ...r, onSave, photo };
  }

  it("P36B.attachimage.26 upload in a FrappeFormView: value set, then the FORM saves through its own pipeline (savedocs Save) — attach.js:137-144", async () => {
    const s = site();
    const { onSave, photo } = formView(s, visit());
    fireEvent.click(within(photo()).getByRole("button", { name: /Photo Attach/ }));
    const dialog = await screen.findByRole("dialog");
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![1]).toBe("Save");
    expect(onSave.mock.calls[0]![0].photo).toBe("/private/files/front.png");
    expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(1);
  });

  it("P36B.attachimage.27 a submitted document (allow_on_submit field) saves with Update; Clear → remove_attach → Update — attach.js:45, 141", async () => {
    const s = site({ doc: { docstatus: 1, photo: "/private/files/front.png" }, files: [PHOTO()] });
    const info = await s.client.getDocInfo("Site Visit", "SV-1");
    const { onSave } = formView(s, visit({ docstatus: 1, photo: "/private/files/front.png" }), info);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]![1]).toBe("Update");
    expect(onSave.mock.calls[0]![0].photo).toBeNull();
    expect(calls(s.t, "frappe.desk.form.utils.remove_attach")[0]!.args).toEqual({ fid: "F-PHOTO", dt: "Site Visit", dn: "SV-1" });
  });

  it("P36B.attachimage.28 negative: attachHost={false} (Quick Entry) — the value is set, nothing is saved", async () => {
    const s = site();
    const onSave = vi.fn(async (d: FrappeDoc) => d);
    mount(s, <FrappeFormView bundle={BUNDLE} doc={visit()} permissions={rightsAll} onSave={onSave} attachHost={false} />);
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-attach-field]')!).getByRole("button", { name: /Photo Attach/ }));
    const dialog = await screen.findByRole("dialog");
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(screen.getByRole("link", { name: "/private/files/front.png" })).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("P36B.attachimage.29 FrappeQuickEntry: an Attach Image there only sets the value (quick_entry.js:127-131 Dialog → controls without frm); no savedocs until Save", async () => {
    const { FrappeQuickEntry } = await import("../src/frappe/form");
    const s = site({ meta: { quick_entry: 1, fields: VISIT.fields.map((f) => (f.fieldname === "subject" ? { ...f, reqd: 1 } : f.fieldname === "photo" ? { ...f, allow_in_quick_entry: 1 } : f)) } });
    mount(s, <FrappeQuickEntry doctype="Site Visit" open onOpenChange={() => {}} onCreated={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Photo Attach/ }));
    await waitFor(() => expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2));
    const dialog = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find((d) => d.querySelector('input[type="file"]'))!;
    chooseFile(dialog);
    upload(dialog);
    await waitFor(() => expect(calls(s.t, "upload_file")).toHaveLength(1));
    expect(calls(s.t, "upload_file")[0]!.args.docname).toMatch(/^new-site-visit-/);
    await waitFor(() => expect(screen.getByRole("link", { name: "/private/files/front.png" })).toBeTruthy());
    expect(calls(s.t, "frappe.desk.form.save.savedocs")).toHaveLength(0);
  });
});

describe("P36b attachimage — the uploader's options (FileUploader.vue / FilePreview.vue) (SIMULATED)", () => {
  it("P36B.attachimage.30 Optimize: offered for images (not SVG), on by default above 200 KB (FileUploader.vue:428-434); sent as optimize (:693-695) only when on", async () => {
    const s = site();
    const seen = recordUploads(s);
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
    let dialog = await openUploader();
    chooseFile(dialog, "big.png", "image/png", 300 * 1024);
    const box = within(dialog).getByRole("checkbox", { name: "big.png: Optimize" }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    upload(dialog);
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]!.opts).toMatchObject({ optimize: true, fieldname: "photo" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Attach/ })).toBeTruthy());
    dialog = await openUploader();
    chooseFile(dialog, "small.png", "image/png", 10);
    expect((within(dialog).getByRole("checkbox", { name: "small.png: Optimize" }) as HTMLInputElement).checked).toBe(false);
    upload(dialog);
    await waitFor(() => expect(seen).toHaveLength(2));
    expect(seen[1]!.opts.optimize).toBeUndefined();
  });

  it("P36B.attachimage.31 the client sends optimize as Desk's multipart field (FileUploader.vue:693-695; handler.py:225-233)", async () => {
    const bodies: FormData[] = [];
    const fake = (async (_url: string, init: RequestInit) => { bodies.push(init.body as FormData); return new Response(JSON.stringify({ message: { doctype: "File", name: "F1", file_url: "/files/a.png" } }), { status: 200 }); }) as unknown as typeof fetch;
    const client = createFrappeClient({ fetch: fake, csrfToken: "t" });
    await client.uploadFile(new Blob(["x"], { type: "image/png" }), "a.png", { doctype: "Site Visit", docname: "SV-1", fieldname: "photo", isPrivate: true, optimize: true });
    await client.uploadFile(new Blob(["x"], { type: "image/png" }), "b.png", { isPrivate: false });
    expect(bodies[0]!.get("optimize")).toBe("true");
    expect(bodies[0]!.get("fieldname")).toBe("photo");
    expect(bodies[0]!.get("is_private")).toBe("1");
    expect(bodies[1]!.has("optimize")).toBe(false);
  });

  it("P36B.attachimage.32 SVG: no Optimize; a non-image row has no thumbnail; an image row has its thumbnail (FilePreview.vue:4-7, 120-129)", async () => {
    const s = site();
    mount(s, <FormHarness client={s.client} field="report" initial={visit()} />);
    const dialog = await openUploader();
    chooseFile(dialog, "logo.svg", "image/svg+xml", 300 * 1024);
    expect(within(dialog).queryByRole("checkbox", { name: /Optimize/ })).toBeNull();
    expect(await within(dialog).findByRole("img", { name: "logo.svg" })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove logo.svg" }));
    chooseFile(dialog, "r.pdf", "application/pdf", 10);
    expect(dialog.querySelector("[data-upload-thumb]")).toBeNull();
  });

  it("P36B.attachimage.33 private / public: a public file carries Desk's warning (FilePreview.vue:70-80); switching back to private removes it; the request follows the switch", async () => {
    const s = site();
    const seen = recordUploads(s);
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
    const dialog = await openUploader();
    chooseFile(dialog);
    expect(dialog.querySelector("[data-public-warning]")).toBeNull();
    const toggle = within(dialog).getByRole("button", { name: "front.png: Private" });
    fireEvent.click(toggle);
    expect(dialog.querySelector("[data-public-warning]")?.textContent).toMatch(/public and can be accessed by anyone/);
    fireEvent.click(toggle); fireEvent.click(toggle);
    upload(dialog);
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]!.opts.isPrivate).toBe(false);
  });

  it("P36B.attachimage.34 one file: the drop zone hides once a file is listed (FileUploader.vue:10) and comes back when it is removed", async () => {
    const s = site();
    mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
    const dialog = await openUploader();
    chooseFile(dialog);
    expect(dialog.querySelector('input[type="file"]')).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove front.png" }));
    expect(dialog.querySelector('input[type="file"]')).toBeTruthy();
  });

  it("P36B.attachimage.35 Crop (JPEG / PNG, FilePreview.vue:51-56, 133-140 → ImageCropper.vue): ratios, keyboard, Crop draws the box from the original and the cropped file is uploaded", async () => {
    const drawn: number[][] = [];
    const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
    const saved = { getContext: proto.getContext, toBlob: proto.toBlob };
    proto.getContext = function () { return { drawImage: (...a: unknown[]) => drawn.push(a.slice(1).map(Number)) }; };
    proto.toBlob = function (this: HTMLCanvasElement, cb: (b: Blob) => void, type: string) { cb(new Blob([new Uint8Array(this.width * this.height % 997 + 1)], { type })); };
    try {
      const s = site();
      const seen = recordUploads(s);
      mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
      const dialog = await openUploader();
      chooseFile(dialog, "front.png", "image/png", 50);
      fireEvent.click(within(dialog).getByRole("button", { name: "Crop front.png" }));
      const img = await within(dialog).findByRole("img", { name: "front.png" }, { timeout: 2000 }).then(() => dialog.querySelector<HTMLImageElement>("[data-image-cropper] img")!);
      Object.defineProperty(img, "naturalWidth", { value: 1000 }); Object.defineProperty(img, "naturalHeight", { value: 500 });
      fireEvent.load(img);
      const area = await within(dialog).findByRole("group", { name: "Crop area" });
      expect(area.getAttribute("data-crop-box")).toBe("100,50,800,400"); // Free: 80% centred
      fireEvent.click(within(dialog).getByRole("button", { name: "1:1" }));
      expect(area.getAttribute("data-crop-box")).toBe("300,50,400,400");
      fireEvent.keyDown(area, { key: "ArrowRight" });
      expect(area.getAttribute("data-crop-box")).toBe("310,50,400,400");
      expect(within(dialog).queryByRole("button", { name: "Upload" })).toBeNull(); // Desk hides the footer while cropping
      fireEvent.click(within(dialog).getByRole("button", { name: "Crop" }));
      expect(drawn[0]).toEqual([310, 50, 400, 400, 0, 0, 400, 400]);
      upload(dialog);
      await waitFor(() => expect(seen).toHaveLength(1));
      expect(seen[0]!.filename).toBe("front.png");
      expect((seen[0]!.file as Blob).type).toBe("image/png");
      expect((seen[0]!.file as Blob).size).toBe(400 * 400 % 997 + 1);
    } finally { proto.getContext = saved.getContext; proto.toBlob = saved.toBlob; }
  });

  it("P36B.attachimage.36 Camera (ui/capture.js): offered where getUserMedia exists; Take Photo → Preview → Submit adds capture_….png; the stream stops; refused → \"Unable to load camera.\" + the device-camera fallback", async () => {
    const stop = vi.fn();
    const nav = navigator as unknown as { mediaDevices?: unknown };
    const savedMedia = nav.mediaDevices;
    const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
    const savedCanvas = { getContext: proto.getContext, toDataURL: proto.toDataURL };
    const savedPlay = HTMLMediaElement.prototype.play;
    let refuse = false;
    const getUserMedia = vi.fn(async (c: unknown) => { void c; if (refuse) throw new Error("NotAllowedError"); return { getTracks: () => [{ stop }] }; });
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    proto.getContext = () => ({ drawImage: () => {} });
    proto.toDataURL = () => "data:image/png;base64,iVBORw0KGgo=";
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    try {
      const s = site();
      const seen = recordUploads(s);
      mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
      const dialog = await openUploader();
      fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "Camera" }), { button: 0 });
      await waitFor(() => expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: "environment" } }));
      expect(within(dialog).getByText("No Images")).toBeTruthy();
      fireEvent.click(await within(dialog).findByRole("button", { name: "Take Photo" }));
      expect(within(dialog).getByText("Total Images: 1")).toBeTruthy();
      fireEvent.click(within(dialog).getByRole("button", { name: "Preview" }));
      expect(stop).toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole("button", { name: "Submit" }));
      const row = await waitFor(() => { const r = dialog.querySelector<HTMLElement>('[data-upload-row^="capture_"]'); if (!r) throw new Error("no row"); return r; });
      expect(row.getAttribute("data-upload-row")).toMatch(/^capture_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}\.png$/);
      upload(dialog);
      await waitFor(() => expect(seen).toHaveLength(1));
      expect((seen[0]!.file as File).type).toBe("image/png");
      cleanup();
      refuse = true;
      mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
      const d2 = await openUploader();
      fireEvent.mouseDown(within(d2).getByRole("tab", { name: "Camera" }), { button: 0 });
      expect((await within(d2).findByRole("alert")).textContent).toBe("Unable to load camera.");
      expect(within(d2).getByRole("button", { name: "Use the device camera" })).toBeTruthy();
      expect(d2.querySelector("[data-camera-fallback]")!.getAttribute("capture")).toBe("environment");
      cleanup();
      Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
      mount(s, <FormHarness client={s.client} field="photo" initial={visit()} />);
      const d3 = await openUploader();
      expect(within(d3).queryByRole("tab", { name: "Camera" })).toBeNull();
    } finally {
      Object.defineProperty(navigator, "mediaDevices", { value: savedMedia, configurable: true });
      proto.getContext = savedCanvas.getContext; proto.toDataURL = savedCanvas.toDataURL;
      HTMLMediaElement.prototype.play = savedPlay;
    }
  });
});

describe("P36b attachimage — simulated savedocs relink (save.py:20-22 → file/utils.py:377-419) (SIMULATED)", () => {
  it("P36B.attachimage.37 a File uploaded against new-… is re-attached to the inserted name; an old (>60 min) or other-field File is not", async () => {
    const s = site();
    const temp = "new-site-visit-abc123";
    const up = await s.client.uploadFile(new Blob(["x"], { type: "image/png" }), "front.png", { doctype: "Site Visit", docname: temp, fieldname: "photo", isPrivate: true });
    const stale = { ...PHOTO({ name: "F-OLD", file_url: "/private/files/report.pdf", attached_to_name: temp, attached_to_field: "report", creation: "2020-01-01 00:00:00.000000" }) };
    const other = { ...PHOTO({ name: "F-OTHER", file_url: "/private/files/front.png", attached_to_name: temp, attached_to_field: "items" }) };
    s.t.store.docs.get("File")!.set("F-OLD", stale as FrappeDoc).set("F-OTHER", other as FrappeDoc);
    const saved = await s.client.saveDoc({ doctype: "Site Visit", name: temp, __islocal: 1, docstatus: 0, subject: "New", photo: up.file_url, report: "/private/files/report.pdf" } as FrappeDoc, "Save");
    expect(saved.name).not.toBe(temp);
    const files = s.t.store.docs.get("File")!;
    expect(files.get(String(up.name))!.attached_to_name).toBe(saved.name);
    expect(files.get("F-OLD")!.attached_to_name).toBe(temp);
    expect(files.get("F-OTHER")!.attached_to_name).toBe(temp);
  });
});
