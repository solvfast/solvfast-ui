/**
 * P36b "social": Share, Like and Comments of the form sidebar, on the in-package SIMULATOR (`createFixtureTransport`
 * with the simulated permission engine). Request shapes are asserted against `transport.store.calls`, persistence
 * against the simulator's store; every permission rule has a negative control. Simulated & tested — never verified
 * against a Frappe site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient, FrappeError } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeComments, FrappeSidebarLikes, FrappeSidebarShare, mergeShareAnswer, setPermissionArgs, shareAddArgs, likedByOf, nextLikedBy, commentRights } from "../src/frappe/record";
import { ShareDialog, LikedBy } from "../src/record";
import type { DocPerm, DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { BUILTIN_FIXTURE_META, createFixtureTransport, type FixtureOptions, type FixtureTransport, type SimulatedPermissions } from "../src/frappe/testing";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const ALL = { read: 1, write: 1, create: 1, delete: 1, submit: 1, cancel: 1, amend: 1, select: 1, report: 1, export: 1, import: 1, print: 1, email: 1, share: 1 } as const;
const DEAL: DocTypeMeta = {
  name: "Deal", autoname: "hash", title_field: "title",
  permissions: [
    { role: "System Manager", permlevel: 0, ...ALL, submit: 0, cancel: 0, amend: 0 },
    { role: "Sales User", permlevel: 0, read: 1, write: 1, create: 1, share: 1, email: 1, print: 1, report: 1, select: 1 },
    { role: "Sales Sharer", permlevel: 0, read: 1, share: 1, select: 1 },
    { role: "Viewer", permlevel: 0, read: 1, select: 1 },
  ] as DocPerm[],
  fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }],
};
const MEMO: DocTypeMeta = {
  name: "Memo", autoname: "hash", is_submittable: 1, title_field: "title",
  permissions: [{ role: "Sales User", permlevel: 0, read: 1, write: 1, create: 1, submit: 1, share: 1, select: 1 }] as DocPerm[],
  fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }],
};
const USER_META: DocTypeMeta = { ...BUILTIN_FIXTURE_META.User[0], permissions: [{ role: "System Manager", permlevel: 0, ...ALL }, { role: "Desk User", permlevel: 0, select: 1, read: 1 }] as DocPerm[] };
const T = "2026-11-02 09:00:00.000000";
const users = [
  ["me@x", "Mia Edwards"], ["bob@x", "Bob Ray"], ["cy@x", "Cy Young"], ["viewer@x", "Vera View"], ["sm@x", "Sam Manager"], ["sharer@x", "Shay Sharer"], ["web@x", "Wes Portal"],
].map(([name, full_name]) => ({ doctype: "User", name, email: name, full_name, first_name: full_name, user_type: name === "web@x" ? "Website User" : "System User", enabled: 1 })) as unknown as FrappeDoc[];

function site(perm: SimulatedPermissions, opts: Partial<FixtureOptions> = {}, liked: string[] = ["bob@x"]): FixtureTransport {
  const t = createFixtureTransport({
    meta: { Deal: [DEAL], Memo: [MEMO], User: [USER_META] },
    docs: {
      User: users,
      Deal: [{ doctype: "Deal", name: "D-1", title: "Big deal", owner: "me@x", creation: T, modified: T, modified_by: "me@x", docstatus: 0, _liked_by: JSON.stringify(liked) }] as FrappeDoc[],
      Memo: [{ doctype: "Memo", name: "M-1", title: "Memo", owner: "me@x", creation: T, modified: T, modified_by: "me@x", docstatus: 0 }] as FrappeDoc[],
    },
  }, { permissions: perm, now: () => new Date("2026-11-08T10:00:00Z"), ...opts });
  // the Like comments that go with `_liked_by` (like.py:89-91): docinfo.like_logs → user_info of the likers (load.py:496)
  for (const u of liked) t.store.comments.set(`L-${u}`, { doctype: "Comment", name: `L-${u}`, comment_type: "Like", reference_doctype: "Deal", reference_name: "D-1", content: "Liked", owner: u, creation: T });
  return t;
}
const as = (user: string, roles: string[], extra: Partial<SimulatedPermissions> = {}): SimulatedPermissions => ({ user, roles, ...extra });

function mount(t: FixtureTransport, ui: React.ReactElement) {
  const client = createFrappeClient({ transport: t, session: t.store.session });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const r = render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={client} queryClient={qc} session={t.store.session} serverMessages={false}>
        <ThemeProvider defaultLanguage="en" storageKeys={null}>{ui}</ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
  return { ...r, client, qc };
}
const callsOf = (t: FixtureTransport, method: string) => t.store.calls.filter((c) => c.method === method).map((c) => c.args);
const shares = (t: FixtureTransport) => [...(t.store.docs.get("DocShare")?.values() ?? [])] as unknown as Record<string, unknown>[];
const seedShare = (t: FixtureTransport, row: Record<string, unknown>) => {
  let tb = t.store.docs.get("DocShare");
  if (!tb) { tb = new Map(); t.store.docs.set("DocShare", tb); }
  const r = { doctype: "DocShare", name: `SH-${tb.size + 1}`, owner: "me@x", creation: T, share_doctype: "Deal", share_name: "D-1", everyone: 0, read: 1, write: 0, submit: 0, share: 0, user: null, ...row };
  tb.set(String(r.name), r as unknown as FrappeDoc);
};
const box = (name: string) => screen.getByRole("checkbox", { name }) as HTMLButtonElement;
const checked = (name: string) => box(name).getAttribute("aria-checked") === "true";

async function openShare() {
  fireEvent.click(await screen.findByRole("button", { name: "Share this document" }));
  return screen.findByTestId("sf-share-dialog");
}

// ---- Share ----------------------------------------------------------------------------------------------------------

describe("P36b social — Share (frappe/share.py, form/sidebar/share.js)", () => {
  it("P36B.social.1 the sidebar shows docinfo.shared; the dialog reads get_users and lists Everyone first, then the users", async () => {
    const t = site(as("me@x", ["Sales User"]));
    seedShare(t, { user: "bob@x", write: 1 });
    mount(t, <FrappeSidebarShare doctype="Deal" name="D-1" />);
    expect(await screen.findByRole("button", { name: "Shared with Bob Ray" })).toBeTruthy();
    const dialog = await openShare();
    await waitFor(() => expect(dialog.querySelectorAll("[data-share-row]").length).toBe(2));
    expect(callsOf(t, "frappe.share.get_users")).toEqual([{ doctype: "Deal", name: "D-1" }]);
    expect([...dialog.querySelectorAll("[data-share-row]")].map((r) => r.getAttribute("data-share-row"))).toEqual(["everyone", "bob@x"]);
    expect(checked("Bob Ray: Can Read")).toBe(true);
    expect(checked("Bob Ray: Can Write")).toBe(true);
    expect(checked("Everyone: Can Read")).toBe(false);
    // exactly Desk's four rights, nothing invented
    expect(within(dialog).getAllByRole("checkbox", { name: /^Bob Ray: / }).map((c) => c.getAttribute("aria-label"))).toEqual(["Bob Ray: Can Read", "Bob Ray: Can Write", "Bob Ray: Can Submit", "Bob Ray: Can Share"]);
  });

  it("P36B.social.2 add: the request Desk sends (notify 1), the server forces read, the row comes from the answer; Shared comment + Share notification", async () => {
    const t = site(as("me@x", ["Sales User"]));
    mount(t, <FrappeSidebarShare doctype="Deal" name="D-1" />);
    const dialog = await openShare();
    await waitFor(() => expect(within(dialog).queryByRole("status")).toBeNull());
    fireEvent.click(within(dialog).getByRole("combobox", { name: "Share this document with" }));
    fireEvent.click(await screen.findByRole("option", { name: /Cy Young/ }, { timeout: 2000 }));
    // the user search Desk uses: Link to User, System Users, not me (share.js:103-117)
    const search = callsOf(t, "frappe.desk.search.search_link").at(-1)!;
    expect(search.doctype).toBe("User");
    expect(JSON.parse(String(search.filters))).toEqual({ user_type: "System User", name: ["!=", "me@x"] });
    expect(screen.queryByRole("option", { name: /Mia Edwards/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /Wes Portal/ })).toBeNull();
    fireEvent.click(box("Share this document with: Can Write"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(dialog.querySelector('[data-share-row="cy@x"]')).toBeTruthy());
    expect(callsOf(t, "frappe.share.add")).toEqual([{ doctype: "Deal", name: "D-1", user: "cy@x", read: 0, write: 1, submit: 0, share: 0, notify: 1 }]);
    // read was not ticked: the server added it anyway (share.py:44-45) and the dialog shows the server's row
    await waitFor(() => expect(checked("Cy Young: Can Read")).toBe(true));
    expect(checked("Cy Young: Can Write")).toBe(true);
    expect(shares(t)).toEqual([expect.objectContaining({ user: "cy@x", read: 1, write: 1, submit: 0, share: 0, everyone: 0, share_doctype: "Deal", share_name: "D-1" })]);
    expect([...t.store.comments.values()].some((c) => c.comment_type === "Shared" && c.content === "Mia Edwards shared this document with Cy Young")).toBe(true);
    const logs = [...(t.store.docs.get("Notification Log")?.values() ?? [])] as unknown as Record<string, unknown>[];
    expect(logs).toEqual([expect.objectContaining({ type: "Share", for_user: "cy@x", from_user: "me@x", document_type: "Deal", document_name: "D-1" })]);
    // the sidebar follows docinfo (invalidated, re-read)
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(await screen.findByRole("button", { name: "Shared with Cy Young" })).toBeTruthy();
  });

  it("P36B.social.3 un-ticking Can Read removes the share (set_permission read 0, row deleted, Unshared comment) — only after the server answered", async () => {
    const t = site(as("me@x", ["Sales User"]), {});
    seedShare(t, { user: "bob@x", write: 1, share: 1 });
    mount(t, <FrappeSidebarShare doctype="Deal" name="D-1" />);
    const dialog = await openShare();
    await waitFor(() => expect(dialog.querySelector('[data-share-row="bob@x"]')).toBeTruthy());
    fireEvent.click(box("Bob Ray: Can Read"));
    await waitFor(() => expect(dialog.querySelector('[data-share-row="bob@x"]')).toBeNull());
    expect(callsOf(t, "frappe.share.set_permission")).toEqual([{ doctype: "Deal", name: "D-1", user: "bob@x", permission_to: "read", value: 0, everyone: 0 }]);
    expect(shares(t)).toEqual([]);
    expect([...t.store.comments.values()].some((c) => c.comment_type === "Unshared")).toBe(true);
    await waitFor(() => expect(screen.queryByRole("button", { name: /Shared with/ })).toBeNull());
  });

  it("P36B.social.4 Everyone: set_permission with everyone 1 and user \"\"; the cascade comes back from the server (share ⇒ read)", async () => {
    const t = site(as("me@x", ["Sales User"]));
    mount(t, <FrappeSidebarShare doctype="Deal" name="D-1" />);
    const dialog = await openShare();
    await waitFor(() => expect(dialog.querySelector('[data-share-row="everyone"]')).toBeTruthy());
    await waitFor(() => expect(box("Everyone: Can Share").disabled).toBe(false));
    fireEvent.click(box("Everyone: Can Share"));
    await waitFor(() => expect(checked("Everyone: Can Read")).toBe(true));
    expect(checked("Everyone: Can Share")).toBe(true);
    expect(callsOf(t, "frappe.share.set_permission")).toEqual([{ doctype: "Deal", name: "D-1", user: "", permission_to: "share", value: 1, everyone: 1 }]);
    expect(shares(t)).toEqual([expect.objectContaining({ everyone: 1, user: null, read: 1, share: 1 })]);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(await screen.findByRole("button", { name: "Shared with everyone" })).toBeTruthy();
  });

  it("P36B.social.5 negative: without the share right the dialog is read-only (no add row) and the server refuses a direct add", async () => {
    const t = site(as("viewer@x", ["Viewer"]));
    seedShare(t, { user: "bob@x" });
    const { client } = mount(t, <FrappeSidebarShare doctype="Deal" name="D-1" />);
    const dialog = await openShare();
    await waitFor(() => expect(dialog.querySelector('[data-share-row="bob@x"]')).toBeTruthy());
    expect(within(dialog).getByText("You do not have permission to share this document.")).toBeTruthy();
    for (const c of within(dialog).getAllByRole("checkbox")) expect((c as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).queryByRole("combobox")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Add" })).toBeNull();
    fireEvent.click(box("Bob Ray: Can Read"));
    expect(callsOf(t, "frappe.share.set_permission")).toEqual([]);
    const err = await client.call("frappe.share.add", { doctype: "Deal", name: "D-1", user: "cy@x", read: 1, notify: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(FrappeError);
    expect((err as FrappeError).kind).toBe("permission");
    expect((err as FrappeError).message).toContain("No permission to share Deal D-1");
    expect(shares(t).map((s) => s.user)).toEqual(["bob@x"]);
  });

  it("P36B.social.6 negative: a sharer without write cannot grant Can Write (box disabled; the server refuses a direct grant)", async () => {
    const t = site(as("sharer@x", ["Sales Sharer"]));
    seedShare(t, { user: "bob@x" });
    const { client } = mount(t, <FrappeSidebarShare doctype="Deal" name="D-1" />);
    const dialog = await openShare();
    await waitFor(() => expect(dialog.querySelector('[data-share-row="bob@x"]')).toBeTruthy());
    await waitFor(() => expect(box("Bob Ray: Can Read").disabled).toBe(false));
    expect(box("Bob Ray: Can Write").disabled).toBe(true);
    expect(box("Bob Ray: Can Submit").disabled).toBe(true);
    expect(box("Bob Ray: Can Share").disabled).toBe(false);
    expect(box("Share this document with: Can Write").disabled).toBe(true);
    const err = await client.call("frappe.share.set_permission", setPermissionArgs("Deal", "D-1", { user: "bob@x" }, "write", true)).catch((e) => e);
    expect((err as FrappeError).kind).toBe("permission");
    expect((err as FrappeError).message).toContain("You cannot share `write` on Deal `D-1`");
    expect(shares(t)[0]).toEqual(expect.objectContaining({ write: 0 }));
  });

  it("P36B.social.7 a server refusal is shown in the dialog and the box keeps its state (sharing disabled on the site only)", async () => {
    const t = site(as("me@x", ["Sales User"], { disableSharing: true }));
    seedShare(t, { user: "bob@x" });
    mount(t, <FrappeSidebarShare doctype="Deal" name="D-1" />);
    const dialog = await openShare();
    await waitFor(() => expect(dialog.querySelector('[data-share-row="bob@x"]')).toBeTruthy());
    // the client was not told (no sharingDisabled prop) and docinfo.permissions says share: the server decides
    await waitFor(() => expect(box("Bob Ray: Can Share").disabled).toBe(false));
    fireEvent.click(box("Bob Ray: Can Share"));
    expect(await within(dialog).findByRole("alert")).toBeTruthy();
    expect(within(dialog).getByRole("alert").textContent).toContain("No permission to share Deal D-1");
    expect(checked("Bob Ray: Can Share")).toBe(false);
    expect(shares(t)[0]).toEqual(expect.objectContaining({ share: 0 }));
  });

  it("P36B.social.8 sharingDisabled / readOnly make the dialog read-only on the client; the Administrator is exempt (model.js:462-473)", async () => {
    const t = site(as("me@x", ["Sales User"]));
    mount(t, <FrappeSidebarShare doctype="Deal" name="D-1" sharingDisabled />);
    let dialog = await openShare();
    await waitFor(() => expect(dialog.querySelector('[data-share-row="everyone"]')).toBeTruthy());
    expect(within(dialog).queryByRole("button", { name: "Add" })).toBeNull();
    cleanup();
    mount(t, <FrappeSidebarShare doctype="Deal" name="D-1" readOnly />);
    dialog = await openShare();
    await waitFor(() => expect(dialog.querySelector('[data-share-row="everyone"]')).toBeTruthy());
    expect(within(dialog).queryByRole("button", { name: "Add" })).toBeNull();
    cleanup();
    const admin = site({ user: "Administrator", roles: [] });
    mount(admin, <FrappeSidebarShare doctype="Deal" name="D-1" sharingDisabled />);
    dialog = await openShare();
    expect(await within(dialog).findByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("P36B.social.9 DocShare rules of the simulator: submit cascades to write + read on a submittable DocType, is refused on another; unsaved docs have no Share", async () => {
    const t = site(as("me@x", ["Sales User"]));
    const client = createFrappeClient({ transport: t });
    const res = await client.call("frappe.share.set_permission", { doctype: "Memo", name: "M-1", user: "bob@x", permission_to: "submit", value: 1, everyone: 0 });
    expect(res.message).toEqual(expect.objectContaining({ user: "bob@x", read: 1, write: 1, submit: 1, share: 0 }));
    // un-ticking write while submit stays: DocShare.validate puts write back (docshare.py:43-44)
    const again = await client.call("frappe.share.set_permission", { doctype: "Memo", name: "M-1", user: "bob@x", permission_to: "write", value: 0, everyone: 0 });
    expect(again.message).toEqual(expect.objectContaining({ write: 1, submit: 1 }));
    // a System Manager has no submit on a non-submittable DocType: check_share_permission refuses first (share.py:237-244)
    const sm = site(as("sm@x", ["System Manager"]));
    const args = shareAddArgs("Deal", "D-1", "bob@x", { read: true, write: false, submit: true, share: false });
    const refused = await createFrappeClient({ transport: sm }).call("frappe.share.add", args).catch((e) => e);
    expect((refused as FrappeError).message).toContain("You cannot share `submit` on Deal `D-1`");
    // the Administrator passes every permission check; DocShare.check_is_submittable then refuses (docshare.py:63-69)
    const admin = site({ user: "Administrator", roles: [] });
    const err = await createFrappeClient({ transport: admin }).call("frappe.share.add", args).catch((e) => e);
    expect((err as FrappeError).message).toContain("not submittable");
    expect(shares(admin)).toEqual([]);
    mount(t, <FrappeSidebarShare doctype="Deal" name="new-deal-1" />);
    expect(screen.queryByRole("button", { name: "Share this document" })).toBeNull();
  });

  it("P36B.social.10 helpers: merge of add / set_permission answers as share.js does", () => {
    const rows = [{ name: "a", user: "bob@x", read: 1 }, { name: "e", user: null, everyone: 1, read: 1 }];
    expect(mergeShareAnswer(rows, { user: "bob@x" }, null, "set")).toEqual([rows[1]]);
    expect(mergeShareAnswer(rows, { user: null, everyone: true }, { name: "e", user: null, everyone: 1, read: 1, share: 1 }, "set")[1]).toEqual(expect.objectContaining({ share: 1 }));
    expect(mergeShareAnswer(rows, { user: "cy@x" }, { name: "c", user: "cy@x", read: 1 }, "add").map((r) => r.user)).toEqual(["bob@x", null, "cy@x"]);
    expect(mergeShareAnswer(rows, { user: "bob@x" }, { name: "a2", user: "bob@x", read: 1, write: 1 }, "add").map((r) => r.name)).toEqual(["e", "a2"]);
  });

  it("P36B.social.11 Core ShareDialog: no optimistic flip — pending disables the row, a rejection keeps the box and shows the message", async () => {
    let reject!: (e: Error) => void;
    const onSetRight = vi.fn(() => new Promise((_, r) => { reject = r; }));
    render(<ThemeProvider defaultLanguage="en" storageKeys={null}>
      <ShareDialog open onOpenChange={() => {}} docName="D-1" canShare canGrant={{ write: true }} entries={[{ id: "1", user: "bob@x", label: "Bob", read: true }]} onSetRight={onSetRight} onAdd={vi.fn()} searchUsers={async () => []} />
    </ThemeProvider>);
    fireEvent.click(box("Bob: Can Write"));
    expect(onSetRight).toHaveBeenCalledWith(expect.objectContaining({ user: "bob@x" }), "write", true);
    expect(checked("Bob: Can Write")).toBe(false);
    expect(box("Bob: Can Write").disabled).toBe(true);
    await act(async () => { reject(new Error("Not permitted")); });
    expect(screen.getByRole("alert").textContent).toBe("Not permitted");
    expect(checked("Bob: Can Write")).toBe(false);
    expect(box("Bob: Can Write").disabled).toBe(false);
    expect(box("Bob: Can Submit").disabled).toBe(true); // canGrant.submit not given
  });
});

// ---- Like -----------------------------------------------------------------------------------------------------------

describe("P36b social — Like (desk/like.py, ui/like.js, form_sidebar.js)", () => {
  it("P36B.social.12 the heart, the count and who liked the document come from the document's _liked_by", async () => {
    const t = site(as("me@x", ["Sales User"]), {}, ["bob@x", "cy@x"]);
    mount(t, <FrappeSidebarLikes doctype="Deal" name="D-1" />);
    const heart = await screen.findByRole("button", { name: "Like" });
    expect(heart.getAttribute("aria-pressed")).toBe("false");
    const count = screen.getByRole("button", { name: "2 likes — show who liked this" });
    fireEvent.click(count);
    const list = await screen.findByRole("list", { name: "Liked by" });
    await waitFor(() => expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["BRBob Ray", "CYCy Young"]));
  });

  it("P36B.social.13 like: toggle_like {add: Yes}; NOT optimistic (unchanged and disabled while pending); _liked_by + Like comment, modified untouched", async () => {
    const t = site(as("me@x", ["Sales User"]));
    const { qc } = mount(t, <FrappeSidebarLikes doctype="Deal" name="D-1" />);
    const heart = await screen.findByRole("button", { name: "Like" }) as HTMLButtonElement;
    fireEvent.click(heart);
    expect(heart.getAttribute("aria-pressed")).toBe("false");
    expect(heart.disabled).toBe(true);
    await waitFor(() => expect(heart.getAttribute("aria-pressed")).toBe("true"));
    expect(callsOf(t, "frappe.desk.like.toggle_like")).toEqual([{ doctype: "Deal", name: "D-1", add: "Yes" }]);
    const stored = t.store.docs.get("Deal")!.get("D-1")!;
    expect(likedByOf(stored)).toEqual(["bob@x", "me@x"]);
    expect(stored.modified).toBe(T);
    expect([...t.store.comments.values()].filter((c) => c.comment_type === "Like" && c.owner === "me@x")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "2 likes — show who liked this" })).toBeTruthy();
    // the cached document was patched in place (no getdoc re-read), its modified unchanged
    expect(callsOf(t, "frappe.desk.form.load.getdoc")).toHaveLength(1);
    expect((qc.getQueryData(["sf-frappe", "doc", "Deal", "D-1"]) as FrappeDoc)?.modified).toBe(T);
    // unlike
    fireEvent.click(heart);
    await waitFor(() => expect(heart.getAttribute("aria-pressed")).toBe("false"));
    expect(callsOf(t, "frappe.desk.like.toggle_like").at(-1)).toEqual({ doctype: "Deal", name: "D-1", add: "No" });
    expect(likedByOf(t.store.docs.get("Deal")!.get("D-1"))).toEqual(["bob@x"]);
  });

  it("P36B.social.14 negative: a failed toggle leaves the heart and the count as they were and reports the error; Guest / readOnly cannot like", async () => {
    const onError = vi.fn();
    const t = site(as("me@x", ["Sales User"]), { handlers: { "frappe.desk.like.toggle_like": () => { throw new FrappeError("Server down", 500); } } });
    mount(t, <FrappeSidebarLikes doctype="Deal" name="D-1" onError={onError} />);
    const heart = await screen.findByRole("button", { name: "Like" }) as HTMLButtonElement;
    fireEvent.click(heart);
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(heart.getAttribute("aria-pressed")).toBe("false");
    expect(heart.disabled).toBe(false);
    expect(screen.getByRole("button", { name: "1 likes — show who liked this" })).toBeTruthy();
    cleanup();
    mount(site(as("me@x", ["Sales User"])), <FrappeSidebarLikes doctype="Deal" name="D-1" readOnly />);
    expect((await screen.findByRole("button", { name: "Like" }) as HTMLButtonElement).disabled).toBe(true);
    // pure: the next _liked_by never duplicates
    expect(nextLikedBy(["a", "b"], "a", true)).toEqual(["a", "b"]);
    expect(nextLikedBy(["a", "b"], "a", false)).toEqual(["b"]);
  });

  it("P36B.social.15 Core LikedBy: controlled — the heart reflects `liked` only", () => {
    const onToggle = vi.fn(() => new Promise(() => {}));
    render(<ThemeProvider defaultLanguage="en" storageKeys={null}><LikedBy liked={false} users={[]} onToggle={onToggle} /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Like" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "0 likes — show who liked this" }));
    expect(screen.getByText("No likes yet")).toBeTruthy();
  });
});

// ---- Comments -------------------------------------------------------------------------------------------------------

function seedComment(t: FixtureTransport, name: string, owner: string, content: string, creation = T) {
  t.store.comments.set(name, { doctype: "Comment", name, comment_type: "Comment", reference_doctype: "Deal", reference_name: "D-1", content, owner, creation, comment_email: owner, published: 0 });
}
const commentEl = (name: string) => document.getElementById(`comment-${name}`) as HTMLElement;

describe("P36b social — Comments (desk/form/utils.py, form_timeline.js, footer.js)", () => {
  it("P36B.social.16 add with an @mention: add_comment request shape, the mention span, the Mention notification, the comment listed from docinfo", async () => {
    const t = site(as("me@x", ["Sales User"]));
    mount(t, <FrappeComments doctype="Deal" name="D-1" />);
    const ta = await screen.findByRole("textbox", { name: "Comment" });
    fireEvent.change(ta, { target: { value: "Ping @bo" } });
    fireEvent.mouseDown(await screen.findByRole("option", { name: /Bob Ray/ }, { timeout: 2000 }));
    fireEvent.change(ta, { target: { value: (ta as HTMLTextAreaElement).value + "please check" } });
    fireEvent.keyDown(ta, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(callsOf(t, "frappe.desk.form.utils.add_comment")).toHaveLength(1));
    const args = callsOf(t, "frappe.desk.form.utils.add_comment")[0];
    expect(args).toEqual({ reference_doctype: "Deal", reference_name: "D-1", content: 'Ping <span class="mention" data-id="bob@x">@Bob Ray</span> please check', comment_email: "me@x", comment_by: "Mia Edwards" });
    const logs = [...(t.store.docs.get("Notification Log")?.values() ?? [])] as unknown as Record<string, unknown>[];
    expect(logs).toEqual([expect.objectContaining({ type: "Mention", for_user: "bob@x", from_user: "me@x", document_type: "Deal", document_name: "D-1" })]);
    await waitFor(() => expect(document.querySelector('[data-kind="comment"] .mention')?.textContent).toBe("@Bob Ray"));
    expect(likedByOf(undefined)).toEqual([]);
  });

  it("P36B.social.17 who may edit / delete / publish (form_timeline.js:614-663): the author edits and publishes but cannot delete without a Comment delete role", async () => {
    const t = site(as("me@x", ["Sales User"]));
    seedComment(t, "C-ME", "me@x", "mine");
    seedComment(t, "C-BOB", "bob@x", "his", "2026-11-02 08:00:00.000000");
    mount(t, <FrappeComments doctype="Deal" name="D-1" />);
    await waitFor(() => expect(commentEl("C-BOB")).toBeTruthy());
    const mine = within(commentEl("C-ME"));
    expect(mine.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(mine.getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(mine.queryByRole("button", { name: "Delete" })).toBeNull();
    const his = within(commentEl("C-BOB"));
    expect(his.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(his.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(his.queryByRole("button", { name: "Publish" })).toBeNull();
    // negative controls on the server: not the owner → update refused; no delete right → delete refused
    const client = createFrappeClient({ transport: t });
    const e1 = await client.call("frappe.desk.form.utils.update_comment", { name: "C-BOB", content: "x" }).catch((e) => e);
    expect((e1 as FrappeError).message).toContain("Comment can only be edited by the owner");
    const e2 = await client.call("frappe.client.delete", { doctype: "Comment", name: "C-ME" }).catch((e) => e);
    expect((e2 as FrappeError).kind).toBe("permission");
    const e3 = await client.call("frappe.desk.form.utils.update_comment_publicity", { name: "C-BOB", publish: true }).catch((e) => e);
    expect((e3 as FrappeError).message).toContain("can only be updated by the original author or a System Manager");
    expect(t.store.comments.get("C-BOB")!.content).toBe("his");
    expect(t.store.comments.has("C-ME")).toBe(true);
    expect(commentRights({ user: "x", roles: ["Website Manager"] })).toEqual({ isSystemManager: false, canDeleteComment: true });
  });

  it("P36B.social.18 edit: update_comment {name, content}; the text changes only after the server answered", async () => {
    const t = site(as("me@x", ["Sales User"]));
    seedComment(t, "C-ME", "me@x", "first draft");
    mount(t, <FrappeComments doctype="Deal" name="D-1" />);
    await waitFor(() => expect(commentEl("C-ME")).toBeTruthy());
    fireEvent.click(within(commentEl("C-ME")).getByRole("button", { name: "Edit" }));
    const ta = within(commentEl("C-ME")).getByRole("textbox");
    fireEvent.change(ta, { target: { value: "final text" } });
    fireEvent.click(within(commentEl("C-ME")).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(commentEl("C-ME").textContent).toContain("final text"));
    expect(callsOf(t, "frappe.desk.form.utils.update_comment")).toEqual([{ name: "C-ME", content: "final text" }]);
    expect(t.store.comments.get("C-ME")!.content).toBe("final text");
  });

  it("P36B.social.19 a System Manager deletes another user's comment after confirming (frappe.client.delete Comment) and may publish it, but cannot edit it", async () => {
    const t = site(as("sm@x", ["System Manager"]));
    seedComment(t, "C-BOB", "bob@x", "his");
    mount(t, <FrappeComments doctype="Deal" name="D-1" />);
    await waitFor(() => expect(commentEl("C-BOB")).toBeTruthy());
    const his = within(commentEl("C-BOB"));
    expect(his.queryByRole("button", { name: "Edit" })).toBeNull();
    fireEvent.click(his.getByRole("button", { name: "Publish" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm.textContent).toContain("visible to website/portal users");
    fireEvent.click(within(confirm).getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(callsOf(t, "frappe.desk.form.utils.update_comment_publicity")).toEqual([{ name: "C-BOB", publish: true }]));
    expect(t.store.comments.get("C-BOB")!.published).toBe(1);
    fireEvent.click(his.getByRole("button", { name: "Delete" }));
    const dlg = await screen.findByRole("alertdialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(commentEl("C-BOB")).toBeFalsy());
    expect(callsOf(t, "frappe.client.delete")).toEqual([{ doctype: "Comment", name: "C-BOB" }]);
    expect(t.store.comments.has("C-BOB")).toBe(false);
  });

  it("P36B.social.20 add refused by the server (no read) keeps the text and shows the message", async () => {
    const t = site(as("me@x", ["Sales User"]));
    mount(t, <FrappeComments doctype="Deal" name="D-1" />);
    const ta = await screen.findByRole("textbox", { name: "Comment" });
    // the server's rights change after the page loaded (e.g. the role was removed): read is now refused
    t.store.meta.Deal[0] = { ...DEAL, permissions: (DEAL.permissions ?? []).filter((p) => p.role !== "Sales User") };
    fireEvent.change(ta, { target: { value: "hello" } });
    fireEvent.keyDown(ta, { key: "Enter", ctrlKey: true });
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((ta as HTMLTextAreaElement).value).toBe("hello");
    expect([...t.store.comments.values()].filter((c) => c.comment_type === "Comment")).toHaveLength(0);
  });

  it("P36B.social.21 the sidebar counter is docinfo.comments.length and goes to the comment box; readOnly has no box and no actions", async () => {
    const t = site(as("me@x", ["Sales User"]));
    seedComment(t, "C-ME", "me@x", "mine");
    seedComment(t, "C-BOB", "bob@x", "his");
    const onCountClick = vi.fn();
    mount(t, <><FrappeComments doctype="Deal" name="D-1" variant="count" onCountClick={onCountClick} /><FrappeComments doctype="Deal" name="D-1" readOnly /></>);
    const counter = await screen.findByRole("button", { name: "2 comments — go to the comment box" });
    fireEvent.click(counter);
    expect(onCountClick).toHaveBeenCalled();
    await waitFor(() => expect(commentEl("C-ME")).toBeTruthy());
    expect(screen.queryByRole("textbox", { name: "Comment" })).toBeNull();
    expect(within(commentEl("C-ME")).queryByRole("button", { name: "Edit" })).toBeNull();
    expect(within(commentEl("C-ME")).queryByRole("button", { name: "Publish" })).toBeNull();
  });
});
