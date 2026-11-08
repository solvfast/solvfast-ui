/**
 * P36b "sidebar" — Desk's Form Sidebar (Frappe 15.110 form/sidebar/*.js, form_sidebar.html) on the in-package SIMULATOR
 * (`createFixtureTransport` + `withSimulatedSidebar`, src/frappe/testing/handlers/sidebar.ts). Request shapes are
 * asserted on `store.calls`; permission decisions are the simulator's approximation — SIMULATED, never a real site.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { FormSidebar, FORM_SIDEBAR_SECTIONS } from "../src/record";
import { createFrappeClient, FrappeError } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import {
  FrappeFormSidebar, FrappeAttachments, FrappeDocTags, attachmentsToShow, attachmentUrl, canDeleteAttachment, attachmentLimitReached, attachmentsToRemove, docTags, sanitizeTag,
} from "../src/frappe/record";
import type { AttachmentInfo, DocPerm, DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport, simScenario, type FixtureTransport, type SimulatedPermissions } from "../src/frappe/testing";
import { withSimulatedSidebar } from "../src/frappe/testing/handlers/sidebar";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const T = "2026-11-02 09:00:00.000000";
const NOW = new Date(2026, 10, 3, 10, 0, 0);
const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const ALL = { read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1, share: 1 } as const;
const PERMS: DocPerm[] = [
  { role: "System Manager", permlevel: 0, ...ALL },
  { role: "Note Writer", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1 },
  { role: "Note Reader", permlevel: 0, read: 1 },
];
const NOTE: DocTypeMeta = {
  name: "Site Visit", autoname: "hash", title_field: "subject", is_submittable: 1, permissions: PERMS,
  fields: [{ fieldname: "subject", fieldtype: "Data", label: "Subject" }],
};
const SINGLE: DocTypeMeta = { name: "Visit Settings", issingle: 1, permissions: PERMS, fields: [{ fieldname: "x", fieldtype: "Data", label: "X" }] };
const users = ["sara@example.com", "lina@example.com", "omar@example.com"].map((u) => ({ doctype: "User", name: u, email: u, full_name: `${u.split("@")[0]} Q`, first_name: u.split("@")[0], enabled: 1, user_type: "System User", modified: T, creation: T })) as FrappeDoc[];
const visit = (over: Partial<FrappeDoc> = {}): FrappeDoc => ({ doctype: "Site Visit", name: "SV-1", subject: "Riyadh depot", owner: "lina@example.com", modified_by: "sara@example.com", creation: T, modified: T, docstatus: 0, ...over });
const WRITER = simScenario.fullAccess("sara@example.com", ["Note Writer"], { fullName: "Sara Q", users: { "lina@example.com": { roles: ["Note Reader"] }, "omar@example.com": { roles: ["Note Reader"] } } });
const READER = simScenario.readOnly("lina@example.com", ["Note Reader"], { fullName: "Lina Q" });

function site(opts: { permissions?: SimulatedPermissions; meta?: Partial<DocTypeMeta>; doc?: Partial<FrappeDoc>; files?: Partial<FrappeDoc>[]; handlers?: Record<string, never> } = {}) {
  const base = createFixtureTransport({
    meta: { "Site Visit": [{ ...NOTE, ...opts.meta }], "Visit Settings": [SINGLE], ToDo: docsOf(todoEn) },
    docs: {
      User: users, "Site Visit": [visit(opts.doc)], "Visit Settings": [{ doctype: "Visit Settings", name: "Visit Settings", modified: T, creation: T } as FrappeDoc],
      File: (opts.files ?? []).map((f, i) => ({ doctype: "File", name: `F-${i + 1}`, file_name: `f${i + 1}.pdf`, file_url: `/private/files/f${i + 1}.pdf`, is_private: 1, attached_to_doctype: "Site Visit", attached_to_name: "SV-1", owner: "Administrator", modified: T, creation: T, ...f })) as FrappeDoc[],
    },
  }, { permissions: opts.permissions ?? WRITER, now: () => NOW, handlers: opts.handlers });
  const t = withSimulatedSidebar(base);
  const client = createFrappeClient({ transport: t, files: t.files });
  return { t, client };
}
function mount(s: { t: FixtureTransport; client: ReturnType<typeof createFrappeClient> }, ui: React.ReactElement, language: "en" | "ar" = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ses = s.t.store.session!;
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={s.client} queryClient={qc} session={{ user: ses.user, fullName: ses.fullName, roles: ses.roles }}>
        <ThemeProvider defaultLanguage={language} storageKeys={null as never}>{ui}</ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
}
const calls = (t: FixtureTransport, method: string) => t.store.calls.filter((c) => c.method === method);
const sectionOf = (id: string) => document.querySelector<HTMLElement>(`[data-sidebar-section="${id}"]`)!;

describe("P36B.sidebar — native structure", () => {
  it("P36B.sidebar.1 Desk's order: Assigned To → Attachments → Tags → Share → likes · comments → last edited / created → comments; slots in place", async () => {
    const s = site();
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" now={NOW.getTime()}
      share={<div data-testid="share-slot">share</div>} likes={<span data-testid="likes-slot">♥ 2</span>} comments={<div data-testid="comments-slot">comments</div>} />);
    await screen.findByRole("complementary", { name: "Document sidebar" });
    await waitFor(() => expect(sectionOf("assign")).toBeTruthy());
    const order = [...document.querySelectorAll("[data-form-sidebar] > *")].map((n) => n.getAttribute("data-sidebar-section") ?? n.getAttribute("data-sidebar-slot"));
    expect(order).toEqual(["assign", "attachments", "tags", "share", "stats", "meta", "comments"]);
    expect(within(document.querySelector<HTMLElement>('[data-sidebar-slot="share"]')!).getByTestId("share-slot")).toBeTruthy();
    expect(within(sectionOf("stats")).getByTestId("likes-slot")).toBeTruthy();
    expect(within(sectionOf("comments")).getByTestId("comments-slot")).toBeTruthy();
    expect(within(sectionOf("stats")).getByRole("button", { name: "0 comments" })).toBeTruthy();
    // created / modified as Desk words them (form_sidebar.js:92-113): owner lina, modified by the session user sara
    expect(sectionOf("meta").textContent).toContain("You last edited this");
    expect(sectionOf("meta").textContent).toContain("lina Q created this");
    // one getdoc, no extra get_docinfo: every section shares the seeded docinfo query
    expect(calls(s.t, "frappe.desk.form.load.getdoc")).toHaveLength(1);
    expect(calls(s.t, "frappe.desk.form.load.get_docinfo")).toHaveLength(0);
  });

  it("P36B.sidebar.2 an unsaved document renders nothing; a Single DocType has no Tags; `sections` hides and reorders", async () => {
    const s = site();
    const { container, unmount } = mount(s, <FrappeFormSidebar doctype="Site Visit" name="new-site-visit-1" doc={{ doctype: "Site Visit", name: "new-site-visit-1", __islocal: 1 }} />);
    expect(container.textContent).toBe("");
    unmount();
    const u2 = mount(s, <FrappeFormSidebar doctype="Visit Settings" name="Visit Settings" />);
    await waitFor(() => expect(sectionOf("attachments")).toBeTruthy());
    expect(sectionOf("tags")).toBeNull();
    u2.unmount();
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" sections={["tags", "assign"]} />);
    await waitFor(() => expect(sectionOf("tags")).toBeTruthy());
    const ids = [...document.querySelectorAll("[data-form-sidebar] [data-sidebar-section]")].map((n) => n.getAttribute("data-sidebar-section"));
    expect(ids).toEqual(["tags", "assign"]);
  });

  it("P36B.sidebar.3 loading skeleton, then a load failure with Retry (get_docinfo refused)", async () => {
    const s = site({ permissions: simScenario.restrictedDoctype("omar@example.com", ["Nobody"]) });
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    expect(document.querySelector("[data-form-sidebar]")?.getAttribute("aria-busy")).toBe("true");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeTruthy();
    const before = calls(s.t, "frappe.desk.form.load.getdoc").length;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.load.getdoc").length).toBe(before + 1));
  });

  it("P36B.sidebar.4 Arabic: RTL chrome strings", async () => {
    const s = site();
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />, "ar");
    await screen.findByRole("complementary", { name: "الشريط الجانبي للمستند" });
    await waitFor(() => expect(screen.getByText("المرفقات")).toBeTruthy());
    expect(screen.getByText("الوسوم")).toBeTruthy();
    expect(document.documentElement.dir === "rtl" || document.querySelector("[dir=rtl]")).toBeTruthy();
  });

  it("P36B.sidebar.5 Core FormSidebar: the comment count scrolls to (focuses) the comments slot; hidden / loading / error states", () => {
    const { unmount } = render(<ThemeProvider storageKeys={null as never}><FormSidebar commentCount={3} comments={<textarea aria-label="Comment box" />} /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "3 comments" }));
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Comment box");
    unmount();
    expect(FORM_SIDEBAR_SECTIONS).toEqual(["userActions", "assign", "attachments", "tags", "share", "stats", "meta", "comments"]);
    const h = render(<ThemeProvider storageKeys={null as never}><FormSidebar hidden assign={<p>x</p>} /></ThemeProvider>);
    expect(h.container.textContent).toBe("");
  });
});

describe("P36B.sidebar — Assigned To (assign_to.js)", () => {
  it("P36B.sidebar.6 Add to ToDo: several users + details, Comment prefilled with the title field; assign_to.add shape; rows re-read from docinfo", async () => {
    const s = site();
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(sectionOf("assign")).toBeTruthy());
    fireEvent.click(within(sectionOf("assign")).getByRole("button", { name: "Add to ToDo" }));
    const dlg = await screen.findByRole("dialog");
    expect((within(dlg).getByRole("textbox", { name: /Comment/ }) as HTMLTextAreaElement).value).toBe("Riyadh depot");
    fireEvent.click(await within(dlg).findByRole("option", { name: /lina Q/ }));
    fireEvent.click(within(dlg).getByRole("option", { name: /omar Q/ }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.assign_to.add")).toHaveLength(1));
    const a = calls(s.t, "frappe.desk.form.assign_to.add")[0].args;
    expect(a).toMatchObject({ doctype: "Site Visit", name: "SV-1", description: "Riyadh depot" });
    expect(JSON.parse(String(a.assign_to))).toEqual(["lina@example.com", "omar@example.com"]);
    await waitFor(() => expect(within(sectionOf("assign")).getByText("lina Q")).toBeTruthy());
    expect(within(sectionOf("assign")).getByText("omar Q")).toBeTruthy();
    expect(calls(s.t, "frappe.desk.form.load.get_docinfo").length).toBeGreaterThanOrEqual(1);
  });

  it("P36B.sidebar.7 Done only on the session user's own assignment (assign_to.close); a writer removes others (assign_to.remove)", async () => {
    const s = site();
    await s.t("frappe.desk.form.assign_to.add", { doctype: "Site Visit", name: "SV-1", assign_to: JSON.stringify(["sara@example.com", "omar@example.com"]) });
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(within(sectionOf("assign")).getByText("sara Q")).toBeTruthy());
    expect(within(sectionOf("assign")).queryByRole("button", { name: "Done: omar Q" })).toBeNull();
    fireEvent.click(within(sectionOf("assign")).getByRole("button", { name: "Done: sara Q" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.assign_to.close")).toHaveLength(1));
    expect(calls(s.t, "frappe.desk.form.assign_to.close")[0].args).toEqual({ doctype: "Site Visit", name: "SV-1", assign_to: "sara@example.com" });
    await waitFor(() => expect(within(sectionOf("assign")).queryByText("sara Q")).toBeNull());
    fireEvent.click(within(sectionOf("assign")).getByRole("button", { name: "Remove omar Q" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.assign_to.remove")[0]?.args).toEqual({ doctype: "Site Visit", name: "SV-1", assign_to: "omar@example.com" }));
    await waitFor(() => expect(within(sectionOf("assign")).queryByText("omar Q")).toBeNull());
  });

  it("P36B.sidebar.8 negative: a reader (no write) may still assign (server: read) but cannot remove someone else's assignment", async () => {
    const s = site({ permissions: READER });
    // an open ToDo of omar (assigned by sara), seeded in the store
    s.t.store.todos.set("TD-X", { doctype: "ToDo", name: "TD-X", allocated_to: "omar@example.com", reference_type: "Site Visit", reference_name: "SV-1", status: "Open", description: "x", owner: "sara@example.com", assigned_by: "sara@example.com", modified: T, creation: T });
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(within(sectionOf("assign")).getByText("omar Q")).toBeTruthy());
    expect(within(sectionOf("assign")).queryByRole("button", { name: "Remove omar Q" })).toBeNull();
    expect(within(sectionOf("assign")).getByRole("button", { name: "Add to ToDo" })).toBeTruthy();
  });
});

describe("P36B.sidebar — Attachments (attachments.js, FileUploader.vue)", () => {
  const pickFiles = (dlg: HTMLElement, files: File[]) => fireEvent.change(dlg.querySelector('input[type="file"]')!, { target: { files } });

  it("P36B.sidebar.9 upload: upload_file multipart fields (private by default, Home/Attachments, doctype / docname); the list is re-read; the dialog closes", async () => {
    const s = site();
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(sectionOf("attachments")).toBeTruthy());
    expect(within(sectionOf("attachments")).getByText("No attachments")).toBeTruthy();
    fireEvent.click(within(sectionOf("attachments")).getByRole("button", { name: "Attach a file" }));
    const dlg = await screen.findByRole("dialog");
    pickFiles(dlg, [new File(["a"], "plan.pdf", { type: "application/pdf" }), new File(["b"], "photo.png", { type: "image/png" })]);
    fireEvent.click(within(dlg).getByRole("button", { name: "photo.png: Private" })); // photo made public
    fireEvent.click(within(dlg).getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const up = calls(s.t, "upload_file").map((c) => c.args);
    expect(up).toEqual([
      expect.objectContaining({ file_name: "plan.pdf", is_private: 1, folder: "Home/Attachments", doctype: "Site Visit", docname: "SV-1" }),
      expect.objectContaining({ file_name: "photo.png", is_private: 0, folder: "Home/Attachments", doctype: "Site Visit", docname: "SV-1" }),
    ]);
    await waitFor(() => expect(within(sectionOf("attachments")).getByText("plan.pdf")).toBeTruthy());
    const row = within(sectionOf("attachments")).getByText("photo.png").closest("li")!;
    expect(within(row).getByRole("link", { name: /Public · Open the File record of photo.png/ }).getAttribute("href")).toMatch(/^\/app\/file\//);
    expect([...s.t.store.comments.values()].filter((c) => c.comment_type === "Attachment")).toHaveLength(2); // file.py:126-128
  });

  it("P36B.sidebar.10 negative: a server refusal keeps the dialog open with the message; nothing is listed", async () => {
    const s = site({ handlers: { upload_file: (() => { throw new FrappeError("Not permitted. Size exceeds the maximum allowed file size.", 417); }) as never } });
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(sectionOf("attachments")).toBeTruthy());
    fireEvent.click(within(sectionOf("attachments")).getByRole("button", { name: "Attach a file" }));
    const dlg = await screen.findByRole("dialog");
    pickFiles(dlg, [new File(["a"], "big.zip")]);
    fireEvent.click(within(dlg).getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(within(dlg).getByRole("alert").textContent).toContain("Size exceeds"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(within(sectionOf("attachments")).getByText("No attachments")).toBeTruthy();
  });

  it("P36B.sidebar.11 negative: a reader gets no Attach and no remove; the simulated server refuses both anyway (403)", async () => {
    const s = site({ permissions: READER, files: [{}] });
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(within(sectionOf("attachments")).getByText("f1.pdf")).toBeTruthy());
    expect(within(sectionOf("attachments")).queryByRole("button", { name: "Attach a file" })).toBeNull();
    expect(within(sectionOf("attachments")).queryByRole("button", { name: /Remove/ })).toBeNull();
    await expect(s.t("upload_file", { file_name: "x.txt", doctype: "Site Visit", docname: "SV-1" })).rejects.toMatchObject({ status: 403 });
    await expect(s.t("frappe.desk.form.utils.remove_attach", { fid: "F-1", dt: "Site Visit", dn: "SV-1" })).rejects.toMatchObject({ status: 403 });
  });

  it("P36B.sidebar.12 remove: confirmation, then remove_attach { fid, dt, dn } for EVERY file with that name; docinfo re-read", async () => {
    const s = site({ files: [{ file_name: "dup.pdf" }, { file_name: "dup.pdf", file_url: "/private/files/dup2.pdf" }, { file_name: "keep.pdf" }] });
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(within(sectionOf("attachments")).getByText("keep.pdf")).toBeTruthy());
    expect(within(sectionOf("attachments")).getAllByText("dup.pdf")).toHaveLength(1); // one row per file name
    fireEvent.click(within(sectionOf("attachments")).getByRole("button", { name: "Remove dup.pdf" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm.textContent).toContain("Are you sure you want to delete the attachment?");
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.utils.remove_attach")).toHaveLength(2));
    expect(calls(s.t, "frappe.desk.form.utils.remove_attach").map((c) => c.args).sort((a, b) => String(a.fid).localeCompare(String(b.fid)))).toEqual([
      { fid: "F-1", dt: "Site Visit", dn: "SV-1" }, { fid: "F-2", dt: "Site Visit", dn: "SV-1" },
    ]);
    await waitFor(() => expect(within(sectionOf("attachments")).queryByText("dup.pdf")).toBeNull());
    expect(within(sectionOf("attachments")).getByText("keep.pdf")).toBeTruthy();
  });

  it("P36B.sidebar.13 protect_attached_files: a submitted document offers no remove; the server refuses (Protected File)", async () => {
    const s = site({ meta: { protect_attached_files: 1 } as never, doc: { docstatus: 1 }, files: [{}] });
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(within(sectionOf("attachments")).getByText("f1.pdf")).toBeTruthy());
    expect(within(sectionOf("attachments")).queryByRole("button", { name: /Remove/ })).toBeNull();
    const e = await s.t("frappe.desk.form.utils.remove_attach", { fid: "F-1", dt: "Site Visit", dn: "SV-1" }).catch((x) => x as FrappeError);
    expect((e as FrappeError).message).toContain("protected document");
  });

  it("P36B.sidebar.14 max_attachments: Attach is hidden at the limit; the uploader allows only the remaining count; the server refuses beyond it", async () => {
    const s = site({ meta: { max_attachments: 2 }, files: [{}] });
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(within(sectionOf("attachments")).getByText("f1.pdf")).toBeTruthy());
    fireEvent.click(within(sectionOf("attachments")).getByRole("button", { name: "Attach a file" }));
    const dlg = await screen.findByRole("dialog");
    expect(dlg.textContent).toContain("1 more file(s) can be attached.");
    fireEvent.change(dlg.querySelector('input[type="file"]')!, { target: { files: [new File(["a"], "a.txt"), new File(["b"], "b.txt")] } });
    expect(within(dlg).getAllByText(/\.txt$/)).toHaveLength(1);
    fireEvent.click(within(dlg).getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(within(sectionOf("attachments")).queryByRole("button", { name: "Attach a file" })).toBeNull());
    expect(sectionOf("attachments").textContent).toContain("Maximum attachment limit of 2 has been reached.");
    const e = await s.t("upload_file", { file_name: "c.txt", doctype: "Site Visit", docname: "SV-1" }).catch((x) => x as FrappeError);
    expect((e as FrappeError).message).toContain("Maximum Attachment Limit");
  });

  it("P36B.sidebar.15 Library (get_files_by_search_text → upload_file library_file_name) and Link (upload_file file_url)", async () => {
    const s = site();
    if (!s.t.store.docs.has("File")) s.t.store.docs.set("File", new Map());
    s.t.store.docs.get("File")!.set("LIB-1", { doctype: "File", name: "LIB-1", file_name: "policy.pdf", file_url: "/files/policy.pdf", is_private: 0, owner: "Administrator", modified: T, creation: T } as FrappeDoc);
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(sectionOf("attachments")).toBeTruthy());
    fireEvent.click(within(sectionOf("attachments")).getByRole("button", { name: "Attach a file" }));
    let dlg = await screen.findByRole("dialog");
    fireEvent.mouseDown(within(dlg).getByRole("tab", { name: "Library" }));
    fireEvent.click(within(dlg).getByRole("tab", { name: "Library" }));
    fireEvent.change(await within(dlg).findByRole("textbox", { name: "Search files" }), { target: { value: "poli" } });
    fireEvent.click(await within(dlg).findByRole("option", { name: /policy.pdf/ }, { timeout: 2000 }));
    fireEvent.click(within(dlg).getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls(s.t, "frappe.core.api.file.get_files_by_search_text").at(-1)?.args).toEqual({ text: "poli" });
    expect(calls(s.t, "upload_file")[0].args).toEqual({ library_file_name: "LIB-1", folder: "Home/Attachments", doctype: "Site Visit", docname: "SV-1" });
    await waitFor(() => expect(within(sectionOf("attachments")).getByText("policy.pdf")).toBeTruthy());

    fireEvent.click(within(sectionOf("attachments")).getByRole("button", { name: "Attach a file" }));
    dlg = await screen.findByRole("dialog");
    fireEvent.mouseDown(within(dlg).getByRole("tab", { name: "Link" }));
    fireEvent.click(within(dlg).getByRole("tab", { name: "Link" }));
    const url = await within(dlg).findByLabelText("Web link (URL)");
    fireEvent.change(url, { target: { value: "not a url" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Upload" }));
    expect(within(dlg).getByRole("alert").textContent).toBe("Invalid URL");
    fireEvent.change(url, { target: { value: "https://example.com/brief.pdf" } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Upload" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls(s.t, "upload_file")[1].args).toEqual({ file_url: "https://example.com/brief.pdf", is_private: 0, folder: "Home/Attachments", doctype: "Site Visit", docname: "SV-1" });
    await waitFor(() => expect(within(sectionOf("attachments")).getByText("brief.pdf")).toBeTruthy());
  });

  it("P36B.sidebar.16 Show All: the last 10 rows until clicked, then every row", async () => {
    const s = site({ files: Array.from({ length: 12 }, () => ({})) });
    mount(s, <FrappeAttachments doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(within(sectionOf("attachments")).getAllByRole("listitem")).toHaveLength(10));
    fireEvent.click(screen.getByRole("button", { name: "Show All" }));
    expect(within(sectionOf("attachments")).getAllByRole("listitem")).toHaveLength(12);
  });
});

describe("P36B.sidebar — Tags (ui/tags.js, tag_editor.js, tag.py)", () => {
  it("P36B.sidebar.17 add with suggestions (get_tags) and Enter → add_tag { tag, dt, dn }; remove → remove_tag; docinfo re-read; Desk's order", async () => {
    const s = site({ doc: { _user_tags: ",urgent,north" } });
    s.t.store.docs.set("Tag", new Map([["urgent", { doctype: "Tag", name: "urgent" } as FrappeDoc], ["north", { doctype: "Tag", name: "north" } as FrappeDoc], ["northwest", { doctype: "Tag", name: "northwest" } as FrappeDoc]]));
    mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(within(sectionOf("tags")).getByText("urgent")).toBeTruthy());
    expect([...sectionOf("tags").querySelectorAll("[data-tag]")].map((n) => n.getAttribute("data-tag"))).toEqual(["urgent", "north"]);
    fireEvent.click(within(sectionOf("tags")).getByRole("button", { name: "Add a tag" }));
    const box = await within(sectionOf("tags")).findByRole("combobox", { name: "New tag" });
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "NOR" } });
    await waitFor(() => expect(calls(s.t, "frappe.desk.doctype.tag.tag.get_tags").at(-1)?.args).toEqual({ doctype: "Site Visit", txt: "nor" }), { timeout: 2000 });
    await screen.findByRole("option", { name: "northwest" }, { timeout: 2000 });
    expect(screen.queryByRole("option", { name: "north" })).toBeNull(); // already on the document
    fireEvent.change(box, { target: { value: "audit" } });
    await waitFor(() => expect(calls(s.t, "frappe.desk.doctype.tag.tag.get_tags").at(-1)?.args.txt).toBe("audit"), { timeout: 2000 });
    await waitFor(() => expect(screen.queryByRole("option", { name: "northwest" })).toBeNull());
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(calls(s.t, "frappe.desk.doctype.tag.tag.add_tag")[0]?.args).toEqual({ tag: "audit", dt: "Site Visit", dn: "SV-1" }));
    await waitFor(() => expect(within(sectionOf("tags")).getByText("audit").closest("li")!.getAttribute("aria-busy")).toBeNull());
    expect(s.t.store.docs.get("Site Visit")!.get("SV-1")!._user_tags).toBe(",urgent,north,audit");
    fireEvent.click(within(sectionOf("tags")).getByRole("button", { name: "Remove tag urgent" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.doctype.tag.tag.remove_tag")[0]?.args).toEqual({ tag: "urgent", dt: "Site Visit", dn: "SV-1" }));
    await waitFor(() => expect(within(sectionOf("tags")).queryByText("urgent")).toBeNull());
  });

  it("P36B.sidebar.18 negative: a reader gets no add / remove; the simulated server refuses add_tag (update_tags write check, tag.py:152)", async () => {
    const s = site({ permissions: READER, doc: { _user_tags: ",urgent" } });
    mount(s, <FrappeDocTags doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(within(sectionOf("tags")).getByText("urgent")).toBeTruthy());
    expect(within(sectionOf("tags")).queryByRole("button", { name: "Add a tag" })).toBeNull();
    expect(within(sectionOf("tags")).queryByRole("button", { name: /Remove tag/ })).toBeNull();
    await expect(s.t("frappe.desk.doctype.tag.tag.add_tag", { tag: "x", dt: "Site Visit", dn: "SV-1" })).rejects.toMatchObject({ status: 403 });
    expect(s.t.store.docs.get("Site Visit")!.get("SV-1")!._user_tags).toBe(",urgent");
  });

  it("P36B.sidebar.19 a refused add is undone on screen with the server's message", async () => {
    const s = site({ handlers: { "frappe.desk.doctype.tag.tag.add_tag": (() => { throw new FrappeError("Tag refused by the server", 417); }) as never } });
    mount(s, <FrappeDocTags doctype="Site Visit" name="SV-1" />);
    await waitFor(() => expect(sectionOf("tags")).toBeTruthy());
    fireEvent.click(await within(sectionOf("tags")).findByRole("button", { name: "Add a tag" }));
    const box = await within(sectionOf("tags")).findByRole("combobox", { name: "New tag" });
    fireEvent.change(box, { target: { value: "nope" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(within(sectionOf("tags")).getByRole("alert").textContent).toContain("Tag refused"));
    expect(within(sectionOf("tags")).queryByText("nope")).toBeNull();
  });
});

describe("P36B.sidebar — pure rules", () => {
  const a = (name: string, file_name: string): AttachmentInfo => ({ name, file_name, file_url: `/files/${file_name}`, is_private: 0 });
  it("P36B.sidebar.20 attachmentsToShow / attachmentUrl / canDeleteAttachment / limit / remove-by-name as attachments.js", () => {
    const list = Array.from({ length: 12 }, (_, i) => a(`F${i}`, `f${i}`));
    const shown = attachmentsToShow(list, false);
    expect(shown.hasMore).toBe(true);
    expect(shown.rows.map((r) => r.name)).toEqual(["F11", "F10", "F9", "F8", "F7", "F6", "F5", "F4", "F3", "F2"]);
    expect(attachmentsToShow([a("A", "x"), a("B", "x")], false).rows.map((r) => r.name)).toEqual(["A"]);
    expect(attachmentUrl({ file_url: "", file_name: "a #1.pdf" })).toBe("/files/a%20%231.pdf");
    expect(attachmentUrl({ file_url: "https://x.y/a#b", file_name: "" })).toBe("https://x.y/a#b");
    const w = [{ write: true }], wd = [{ write: true, delete: true }];
    expect(canDeleteAttachment({ docstatus: 1, perms: w })).toBe(true);
    expect(canDeleteAttachment({ protectAttachedFiles: 1, docstatus: 0, perms: w })).toBe(true);
    expect(canDeleteAttachment({ protectAttachedFiles: 1, docstatus: 1, perms: wd })).toBe(false);
    expect(canDeleteAttachment({ protectAttachedFiles: 1, docstatus: 2, perms: w })).toBe(false);
    expect(canDeleteAttachment({ protectAttachedFiles: 1, docstatus: 2, perms: wd })).toBe(true);
    expect(canDeleteAttachment({ perms: [{ read: true }] })).toBe(false);
    expect(attachmentLimitReached(2, 2)).toBe(true);
    expect(attachmentLimitReached(5, 0)).toBe(false);
    expect(attachmentsToRemove([a("A", "x"), a("B", "x"), a("C", "y")], "B").map((r) => r.name)).toEqual(["A", "B"]);
  });
  it("P36B.sidebar.21 docTags (Desk draws the last first, blanks / duplicates dropped) and sanitizeTag (xss_sanitise)", () => {
    expect(docTags("a,b,,a,c")).toEqual(["c", "b", "a"]);
    expect(docTags("")).toEqual([]);
    expect(sanitizeTag("<b>x</b>")).toBe("&lt;b&gt;x&lt;&#x2F;b&gt;");
    expect(sanitizeTag("ok alert(1)")).toBe("ok ");
  });
});

