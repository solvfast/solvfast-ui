/**
 * P36d "history": the record history (Record Detail's timeline) — Core `Timeline` and `FrappeTimeline` over the
 * in-package SIMULATOR (`createFixtureTransport` with the simulated permission engine). Request shapes are asserted
 * against `transport.store.calls`; every permission rule and failure has a negative control. SIMULATED & tested — never
 * verified against a Frappe site.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient, FrappeError } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeTimeline, buildTimelineItems, deliveryStatusTone, formatVersion, type TimelineContext } from "../src/frappe/record";
import { Timeline, deskRelativeTime, absoluteTime, type TimelineEntry } from "../src/record";
import { historyEn, historyAr } from "../src/theme/messages-ws/history";
import type { DocInfo, DocPerm, DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import type { FrappeTransport } from "../src/frappe/client";
import { BUILTIN_FIXTURE_META, createFixtureTransport, type FixtureTransport, type SimulatedPermissions } from "../src/frappe/testing";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const ALL = { read: 1, write: 1, create: 1, delete: 1, select: 1, report: 1, export: 1, print: 1, email: 1, share: 1 } as const;
const LEAD: DocTypeMeta = {
  name: "Lead", autoname: "hash", title_field: "lead_name", track_changes: 1,
  permissions: [
    { role: "System Manager", permlevel: 0, ...ALL },
    { role: "Sales User", permlevel: 0, read: 1, write: 1, create: 1, email: 1, print: 1, report: 1, select: 1, share: 1 },
  ] as DocPerm[],
  fields: [
    { fieldname: "lead_name", fieldtype: "Data", label: "Lead Name" },
    { fieldname: "status", fieldtype: "Select", label: "Status", options: "Open\nReplied\nQualified" },
    { fieldname: "internal_note", fieldtype: "Data", label: "Internal Note", hidden: 1 },
  ],
} as DocTypeMeta;
const USER_META: DocTypeMeta = { ...BUILTIN_FIXTURE_META.User[0], permissions: [{ role: "System Manager", permlevel: 0, ...ALL }, { role: "Desk User", permlevel: 0, select: 1, read: 1 }] as DocPerm[] };
const T = "2026-11-02 09:00:00.000000";
const users = [["me@x", "Mia Edwards", "/files/mia.png"], ["bob@x", "Bob Ray", null], ["sm@x", "Sam Manager", null], ["cy@x", "Cy Young", null]]
  .map(([name, full_name, user_image]) => ({ doctype: "User", name, email: name, full_name, first_name: full_name, user_type: "System User", enabled: 1, user_image })) as unknown as FrappeDoc[];
const LEAD_DOC = { doctype: "Lead", name: "L-1", lead_name: "Reem", status: "Open", owner: "bob@x", creation: T, modified: T, modified_by: "bob@x", docstatus: 0 } as FrappeDoc;

function site(perm: SimulatedPermissions): FixtureTransport {
  return createFixtureTransport({ meta: { Lead: [LEAD], User: [USER_META] }, docs: { User: users, Lead: [LEAD_DOC] } }, { permissions: perm, now: () => new Date("2026-11-08T10:00:00Z") });
}
const as = (user: string, roles: string[]): SimulatedPermissions => ({ user, roles });
function seedComment(t: FixtureTransport, name: string, owner: string, content: string, extra: Record<string, unknown> = {}) {
  t.store.comments.set(name, { doctype: "Comment", name, comment_type: "Comment", reference_doctype: "Lead", reference_name: "L-1", content, owner, creation: T, comment_email: owner, published: 0, ...extra });
}
function seedTable(t: FixtureTransport, doctype: string, rows: Record<string, unknown>[]) {
  let tb = t.store.docs.get(doctype);
  if (!tb) { tb = new Map(); t.store.docs.set(doctype, tb); }
  for (const r of rows) tb.set(String(r.name), { doctype, ...r } as FrappeDoc);
}
const callsOf = (t: FixtureTransport, method: string) => t.store.calls.filter((c) => c.method === method).map((c) => c.args);
const commentEl = (name: string) => document.getElementById(`comment-${name}`) as HTMLElement;

function mount(transport: FrappeTransport, session: { user: string; roles: string[] }, ui: React.ReactElement, language: "en" | "ar" = "en") {
  const client = createFrappeClient({ transport, session });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const r = render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={client} queryClient={qc} session={session} serverMessages={false}>
        <ThemeProvider defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
  return { ...r, client, qc };
}
const lead = () => ({ ...LEAD_DOC });

// ---- Core Timeline ---------------------------------------------------------------------------------------------------

describe("P36d history — Core Timeline", () => {
  const tEn = (k: keyof typeof historyEn) => historyEn[k];
  const NOW = new Date(2026, 10, 8, 12, 0, 0).getTime();
  const ago = (ms: number) => NOW - ms;
  const MIN = 60_000, H = 60 * MIN, D = 24 * H;

  it("P36D.history.1 deskRelativeTime reproduces pretty_date.js:46-76 (calendar days, then seconds within the day); Arabic strings exist for every key", () => {
    const cases: Array<[number, string]> = [
      [ago(30_000), "just now"], [ago(90_000), "1 minute ago"], [ago(5 * MIN), "5 minutes ago"], [ago(H + 5 * MIN), "1 hour ago"], [ago(3 * H), "3 hours ago"],
      [new Date(2026, 10, 7, 23, 0).getTime(), "yesterday"], [ago(3 * D), "3 days ago"], [ago(8 * D), "1 week ago"], [ago(20 * D), "2 weeks ago"],
      [ago(40 * D), "1 month ago"], [ago(100 * D), "3 months ago"], [ago(400 * D), "1 year ago"], [ago(800 * D), "2 years ago"],
    ];
    for (const [at, want] of cases) expect(deskRelativeTime(at, tEn, NOW)).toBe(want);
    expect(deskRelativeTime(NOW + D, tEn, NOW)).toBe(""); // the future: Desk shows nothing (day_diff < 0)
    expect(deskRelativeTime(ago(3 * D), (k) => historyAr[k], NOW)).toBe("قبل 3 أيام");
    expect(Object.keys(historyAr).sort()).toEqual(Object.keys(historyEn).sort());
    expect(absoluteTime(NOW, "ar")).toMatch(/2026/); // Latin digits in Arabic (ar-u-nu-latn)
  });

  it("P36D.history.2 defaults are unchanged (compact times, kind icons); timeFormat='desk' + showAvatars add Desk wording, the absolute title and avatars", () => {
    const items: TimelineEntry[] = [
      { id: "k1", kind: "comment", at: ago(3 * D), actor: "Ann Lee", actorImage: null, body: "<p>Hello</p>", canEdit: true },
      { id: "c1", kind: "change", at: ago(2 * H), actor: "Bob", summary: "Bob changed Status" },
    ];
    const { rerender } = render(<ThemeProvider defaultLanguage="en" storageKeys={null}><Timeline items={items} now={NOW} /></ThemeProvider>);
    expect(screen.getAllByText(/^(3d|2h) ago$/)).toHaveLength(2);
    expect(document.querySelector("[data-avatar]")).toBeNull();
    rerender(<ThemeProvider defaultLanguage="en" storageKeys={null}><Timeline items={items} now={NOW} timeFormat="desk" showAvatars /></ThemeProvider>);
    expect(screen.getByText("3 days ago")).toBeTruthy();
    expect(screen.getByText("2 hours ago")).toBeTruthy();
    const time = screen.getByText("3 days ago");
    expect(time.tagName).toBe("TIME");
    expect(time.getAttribute("title")).toBe(absoluteTime(ago(3 * D), "en"));
    const av = document.querySelector("#comment-k1 [data-avatar]");
    expect(av?.textContent).toBe("AL"); // initials when there is no image (Desk frappe.avatar abbreviation)
  });

  it("P36D.history.3 card entries: subject, sanitised body, delivery-status pill, attachments (private lock), open + Copy Link", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const items: TimelineEntry[] = [{
      id: "communication-E1", kind: "communication", at: ago(H), actor: "Bob Ray", card: true, subject: "Quote", body: "<p>Hi <b>there</b></p><script>alert(1)</script>",
      status: { label: "Sent", tone: "success" }, href: "/app/communication/E1", attachments: [{ name: "q.pdf", url: "/private/files/q.pdf", isPrivate: true }],
    }];
    render(<ThemeProvider defaultLanguage="en" storageKeys={null}><Timeline items={items} now={NOW} itemLink={(i) => `https://x/l#${i.id}`} /></ThemeProvider>);
    const card = document.getElementById("communication-E1")!;
    expect(card.getAttribute("data-card")).toBe("");
    expect(within(card).getByText("Quote")).toBeTruthy();
    expect(card.querySelector("b")?.textContent).toBe("there");
    expect(card.querySelector("script")).toBeNull();
    expect(within(card).getByText("Sent").className).toContain("text-success");
    expect(within(card).getByRole("link", { name: "q.pdf" }).getAttribute("href")).toBe("/private/files/q.pdf");
    expect(within(card).getByLabelText("Private")).toBeTruthy();
    expect(within(card).getByRole("link", { name: "Open Communication" }).getAttribute("href")).toBe("/app/communication/E1");
    fireEvent.click(within(card).getByRole("button", { name: "Copy Link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://x/l#communication-E1"));
    expect(await within(card).findByText("Copied to clipboard")).toBeTruthy();
  });

  it("P36D.history.4 loading, error and empty states (negative controls: no list while loading or failed)", () => {
    const { rerender } = render(<ThemeProvider defaultLanguage="en" storageKeys={null}><Timeline items={[]} loading /></ThemeProvider>);
    expect(screen.getByRole("status", { name: "Loading…" })).toBeTruthy();
    rerender(<ThemeProvider defaultLanguage="en" storageKeys={null}><Timeline items={[{ id: "x", kind: "created", at: 1, summary: "made" }]} error={<p role="alert">boom</p>} hasMore onLoadMore={() => {}} /></ThemeProvider>);
    expect(screen.getByRole("alert").textContent).toBe("boom");
    expect(screen.queryByText("made")).toBeNull();
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
    rerender(<ThemeProvider defaultLanguage="en" storageKeys={null}><Timeline items={[{ id: "x", kind: "created", at: 1, summary: "made" }]} showFilters /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Comments" }));
    expect(screen.getByText("No activity yet")).toBeTruthy();
  });
});

// ---- docinfo mapping (pure) --------------------------------------------------------------------------------------------

describe("P36d history — docinfo mapping (version_timeline_content_builder.js, form_timeline.js)", () => {
  const t = (k: string) => ({ ...historyEn, recChangedValue: "{0} changed the value of {1}", recFromTo: "{0} from {1} to {2}", recSubmittedThis: "{0} submitted this document", recYou: "You", recCreatedThis: "{0} created this", recModifiedThis: "{0} last edited this" } as Record<string, string>)[k] ?? k;
  const ctx = (o: Partial<TimelineContext> = {}): TimelineContext => ({ user: "me@x", t: t as TimelineContext["t"], fieldLabel: (f) => (f === "status" ? "Status" : null), ...o });

  it("P36D.history.5 Version suffixes: updater_reference text (:14-24), created-by line (:342-353), Impersonated by / [Action taken by] (:354-365)", () => {
    const v = (data: object) => ({ owner: "bob@x", data: JSON.stringify(data) });
    expect(formatVersion(v({ changed: [["status", "Open", "Replied"]], updater_reference: { doctype: "Sales Order", docname: "SO-1" } }), ctx(), "Bob").map((l) => l.summary))
      .toEqual(["Bob changed the value of Status from Open to Replied via Sales Order"]);
    expect(formatVersion(v({ changed: [["status", "Open", "Replied"]], updater_reference: { doctype: "X", label: "by the import" } }), ctx(), "Bob")[0].summary).toBe("Bob changed the value of Status from Open to Replied by the import");
    expect(formatVersion(v({ created_by: "bob@x", updater_reference: { doctype: "Sales Order", docname: "SO-1" } }), ctx(), "Bob").map((l) => l.summary)).toEqual(["Bob created this document via Sales Order"]);
    expect(formatVersion(v({ changed: [["status", "Open", "Replied"]], impersonated_by: "admin@x", audit_user: "Ops" }), ctx({ userName: () => "Admin" }), "Bob")[0].summary)
      .toBe("Bob changed the value of Status from Open to Replied · Impersonated by Admin · [Action taken by Ops]");
    // negative control: an empty updater_reference adds nothing
    expect(formatVersion(v({ changed: [["status", "Open", "Replied"]], updater_reference: {} }), ctx(), "Bob")[0].summary).toBe("Bob changed the value of Status from Open to Replied");
  });

  it("P36D.history.6 communications become cards (body, subject, delivery status, attachments, sender image); automated messages say who was notified; additional_timeline_content with content only", () => {
    const info = {
      attachments: [], comments: [], versions: [], assignments: [], assignment_logs: [], shared: [], views: [], permissions: {},
      user_info: { "bob@x": { fullname: "Bob Ray", image: "/files/bob.png" }, "a@x": { fullname: "Ann" } },
      communications: [{ name: "E1", sender: "bob@x", sender_full_name: "Bob Ray", subject: "Quote", content: "<p>Hi</p>", delivery_status: "Opened", communication_date: T, attachments: JSON.stringify([{ file_url: "/files/a b.pdf", is_private: 0 }]) }],
      automated_messages: [{ name: "N1", communication_type: "Automated Message", recipients: "a@x, b@x", cc: "c@x", bcc: "d@x", content: "<p>Reminder</p>", communication_date: T }],
      additional_timeline_content: [{ creation: T, content: "<b>hook</b>", is_card: 1 }, { creation: T, template: "x", template_data: {} }],
    } as unknown as DocInfo;
    const items = buildTimelineItems({ doctype: "Lead", name: "L-1" } as FrappeDoc, info, ctx({ communicationHref: (n) => `/app/communication/${n}` }));
    const e1 = items.find((i) => i.id === "communication-E1")!;
    expect(e1).toMatchObject({ card: true, body: "<p>Hi</p>", subject: "Quote", status: { label: "Opened", tone: "info" }, actorImage: "/files/bob.png", href: "/app/communication/E1", attachments: [{ name: "a b.pdf", url: "/files/a%20b.pdf", isPrivate: false }] });
    expect(items.find((i) => i.id === "communication-N1")!.subject).toBe("Notification sent to Ann, b@x, c@x...");
    expect(items.filter((i) => i.kind === "custom")).toEqual([expect.objectContaining({ card: true, body: "<b>hook</b>", summary: "hook" })]);
    expect([deliveryStatusTone("Sent"), deliveryStatusTone("Scheduled"), deliveryStatusTone("Read"), deliveryStatusTone("Bounced")]).toEqual(["success", "warning", "info", "danger"]);
  });
});

// ---- FrappeTimeline on the simulator ----------------------------------------------------------------------------------

describe("P36d history — FrappeTimeline over the SIMULATOR (desk/form/load.py, desk/form/utils.py)", () => {
  it("P36D.history.7 reads get_docinfo {doctype, name}; comment with author name + avatar, version before→after from a real save, created / last-edited lines; hidden field skipped", async () => {
    const t = site(as("me@x", ["Sales User"]));
    seedComment(t, "C-BOB", "bob@x", "<p>Call her back</p>");
    // a save through the simulator writes a Version (track_changes; version.py get_diff)
    const api = createFrappeClient({ transport: t, session: t.store.session });
    const saved = await api.call("frappe.client.set_value", { doctype: "Lead", name: "L-1", fieldname: { status: "Replied", internal_note: "secret" } });
    mount(t, { user: "me@x", roles: ["Sales User"] }, <FrappeTimeline doc={(saved.message as FrappeDoc)} user="me@x" timeFormat="desk" showAvatars />);
    await waitFor(() => expect(commentEl("C-BOB")).toBeTruthy());
    expect(callsOf(t, "frappe.desk.form.load.get_docinfo")[0]).toEqual({ doctype: "Lead", name: "L-1" });
    expect(within(commentEl("C-BOB")).getByText("Bob Ray")).toBeTruthy();
    expect(commentEl("C-BOB").querySelector("[data-avatar]")?.textContent).toBe("BR");
    expect(commentEl("C-BOB").querySelector("time")?.getAttribute("title")).toBeTruthy();
    const change = await screen.findByText(/changed the value of/);
    expect(change.textContent).toContain("Status from Open to Replied");
    expect(change.textContent).not.toContain("Internal Note"); // hidden without show_on_timeline (builder :85-96)
    expect(screen.getByText(/Bob Ray created this/)).toBeTruthy();
    expect(screen.getByText(/You last edited this/)).toBeTruthy();
  });

  it("P36D.history.8 add / edit / publish / delete through the server: request shapes; Published marker from docinfo", async () => {
    const t = site(as("sm@x", ["System Manager"]));
    seedComment(t, "C-BOB", "bob@x", "his", { published: 1 });
    mount(t, t.store.session as { user: string; roles: string[] }, <FrappeTimeline doc={lead()} user="sm@x" isSystemManager canDeleteComment allowPublish />);
    await waitFor(() => expect(commentEl("C-BOB")).toBeTruthy());
    expect(commentEl("C-BOB").querySelector("[data-published]")?.textContent).toBe("Published");
    // add
    const ta = screen.getAllByRole("textbox", { name: "Comment" })[0];
    fireEvent.change(ta, { target: { value: "New note" } });
    fireEvent.keyDown(ta, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(callsOf(t, "frappe.desk.form.utils.add_comment")).toHaveLength(1));
    expect(callsOf(t, "frappe.desk.form.utils.add_comment")[0]).toEqual({ reference_doctype: "Lead", reference_name: "L-1", content: "New note", comment_email: "sm@x", comment_by: "Sam Manager" });
    const mine = [...t.store.comments.values()].find((c) => c.content === "New note")!;
    await waitFor(() => expect(commentEl(String(mine.name))).toBeTruthy());
    // edit own
    fireEvent.click(within(commentEl(String(mine.name))).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(commentEl(String(mine.name))).getByRole("textbox"), { target: { value: "Edited note" } });
    fireEvent.click(within(commentEl(String(mine.name))).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsOf(t, "frappe.desk.form.utils.update_comment")).toEqual([{ name: mine.name, content: "Edited note" }]));
    await waitFor(() => expect(commentEl(String(mine.name)).textContent).toContain("Edited note"));
    // unpublish someone else's comment as System Manager
    fireEvent.click(within(commentEl("C-BOB")).getByRole("button", { name: "Unpublish" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Unpublish" }));
    await waitFor(() => expect(callsOf(t, "frappe.desk.form.utils.update_comment_publicity")).toEqual([{ name: "C-BOB", publish: false }]));
    await waitFor(() => expect(commentEl("C-BOB").querySelector("[data-published]")).toBeNull());
    // delete someone else's comment as System Manager
    fireEvent.click(within(commentEl("C-BOB")).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(commentEl("C-BOB")).toBeFalsy());
    expect(callsOf(t, "frappe.client.delete")).toEqual([{ doctype: "Comment", name: "C-BOB" }]);
  });

  it("P36D.history.9 negative control: a Sales User cannot delete (no Comment delete role) or edit another user's comment; the server refuses too", async () => {
    const t = site(as("me@x", ["Sales User"]));
    seedComment(t, "C-BOB", "bob@x", "his");
    seedComment(t, "C-ME", "me@x", "mine");
    mount(t, { user: "me@x", roles: ["Sales User"] }, <FrappeTimeline doc={lead()} user="me@x" isSystemManager={false} canDeleteComment={false} allowPublish />);
    await waitFor(() => expect(commentEl("C-BOB")).toBeTruthy());
    const his = within(commentEl("C-BOB"));
    expect(his.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(his.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(his.queryByRole("button", { name: "Publish" })).toBeNull();
    const mine = within(commentEl("C-ME"));
    expect(mine.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(mine.getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(mine.queryByRole("button", { name: "Delete" })).toBeNull(); // the author needs delete on Comment too (form_timeline.js:614-620)
    const api = createFrappeClient({ transport: t });
    const e = await api.call("frappe.client.delete", { doctype: "Comment", name: "C-BOB" }).catch((x) => x);
    expect((e as FrappeError).kind).toBe("permission");
    expect(t.store.comments.has("C-BOB")).toBe(true);
    const e2 = await api.call("frappe.desk.form.utils.update_comment", { name: "C-BOB", content: "x" }).catch((x) => x);
    expect((e2 as FrappeError).message).toContain("Comment can only be edited by the owner");
  });

  it("P36D.history.10 negative control: a failed get_docinfo shows FrappeErrorState (no list), Retry re-reads and the history appears", async () => {
    const t = site(as("me@x", ["Sales User"]));
    seedComment(t, "C-BOB", "bob@x", "his");
    let fail = true;
    const flaky: FrappeTransport = async (method, args) => {
      if (method === "frappe.desk.form.load.get_docinfo" && fail) throw new FrappeError("Internal Server Error", 500);
      return t(method, args);
    };
    mount(flaky, { user: "me@x", roles: ["Sales User"] }, <FrappeTimeline doc={lead()} user="me@x" />);
    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-kind")).toBe("server");
    expect(commentEl("C-BOB")).toBeFalsy();
    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(commentEl("C-BOB")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("P36D.history.11 negative control: no read → PermissionError state without Retry; nothing listed", async () => {
    const t = site(as("cy@x", ["Website User"]));
    mount(t, { user: "cy@x", roles: ["Website User"] }, <FrappeTimeline doc={lead()} user="cy@x" canComment={false} />);
    const alert = await screen.findByRole("alert");
    expect(alert.getAttribute("data-kind")).toBe("permission");
    expect(within(alert).queryByRole("button", { name: /retry/i })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Comment" })).toBeNull();
  });

  it("P36D.history.12 communications from the server: a card per e-mail with subject / status / attachment; 21 → Load more with get_communications {start: 20, limit: 21}", async () => {
    const t = site(as("me@x", ["Sales User"]));
    const rows = Array.from({ length: 22 }, (_, i) => ({
      name: `E${i}`, communication_type: "Communication", communication_medium: "Email", sender: "bob@x", sender_full_name: "Bob Ray", subject: `Subject ${i}`,
      content: `<p>Body ${i}</p>`, delivery_status: i === 0 ? "Sent" : "", reference_doctype: "Lead", reference_name: "L-1", communication_date: `2026-11-0${i < 10 ? 3 : 2} 10:${String(i).padStart(2, "0")}:00`, creation: T,
    }));
    seedTable(t, "Communication", rows);
    seedTable(t, "File", [{ name: "F1", file_url: "/private/files/offer.pdf", is_private: 1, attached_to_doctype: "Communication", attached_to_name: "E0" }]);
    mount(t, { user: "me@x", roles: ["Sales User"] }, <FrappeTimeline doc={lead()} user="me@x" />);
    await waitFor(() => expect(document.getElementById("communication-E0")).toBeTruthy());
    const e0 = document.getElementById("communication-E0")!;
    expect(within(e0).getByText("Subject 0")).toBeTruthy();
    expect(within(e0).getByText("Body 0")).toBeTruthy();
    expect(within(e0).getByText("Sent")).toBeTruthy();
    expect(within(e0).getByRole("link", { name: "offer.pdf" })).toBeTruthy();
    expect(document.querySelectorAll('[data-kind="communication"]')).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(callsOf(t, "frappe.desk.form.load.get_communications")).toEqual([{ doctype: "Lead", name: "L-1", start: 20, limit: 21 }]));
    await waitFor(() => expect(document.querySelectorAll('[data-kind="communication"]')).toHaveLength(22));
  });

  it("P36D.history.13 @mentions query get_names_for_mentions {search_term}; Copy Link copies the page URL with #comment-<name>; document e-mail line", async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const t = site(as("me@x", ["Sales User"]));
    seedComment(t, "C-BOB", "bob@x", "his");
    mount(t, { user: "me@x", roles: ["Sales User"] }, <FrappeTimeline doc={lead()} user="me@x" copyLinks />);
    await waitFor(() => expect(commentEl("C-BOB")).toBeTruthy());
    fireEvent.click(within(commentEl("C-BOB")).getByRole("button", { name: "Copy Link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${window.location.pathname}${window.location.search}#comment-C-BOB`));
    const ta = screen.getByRole("textbox", { name: "Comment" });
    fireEvent.change(ta, { target: { value: "hi @bo" } });
    await screen.findByRole("option", { name: /Bob Ray/ }, { timeout: 2000 });
    expect(callsOf(t, "frappe.desk.search.get_names_for_mentions").at(-1)).toEqual({ search_term: "bo" });
    cleanup();
    // document_email (load.py:137, 398-404) — the simulator has no incoming e-mail account, so it comes from a given docinfo
    const info = { attachments: [], communications: [], comments: [], versions: [], assignments: [], assignment_logs: [], shared: [], views: [], permissions: { read: 1 }, user_info: {}, document_email: "crm+Lead=L-1@x.com" } as unknown as DocInfo;
    mount(t, { user: "me@x", roles: ["Sales User"] }, <FrappeTimeline doc={lead()} user="me@x" docinfo={info} />);
    const line = await waitFor(() => document.querySelector("[data-document-email]") as HTMLElement);
    expect(line.textContent).toContain("Add to this activity by mailing to");
    fireEvent.click(within(line).getByRole("button", { name: /crm\+Lead=L-1@x\.com/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("crm+Lead=L-1@x.com"));
  });

  it("P36D.history.14 Arabic: Desk relative wording, RTL arrow in the change detail, Arabic chrome", async () => {
    const t = site(as("me@x", ["Sales User"]));
    seedComment(t, "C-BOB", "bob@x", "his");
    const api = createFrappeClient({ transport: t, session: t.store.session });
    const saved = await api.call("frappe.client.set_value", { doctype: "Lead", name: "L-1", fieldname: { status: "Replied", lead_name: "Reem A" } });
    mount(t, { user: "me@x", roles: ["Sales User"] }, <FrappeTimeline doc={saved.message as FrappeDoc} user="me@x" timeFormat="desk" />, "ar");
    await waitFor(() => expect(commentEl("C-BOB")).toBeTruthy());
    expect(commentEl("C-BOB").querySelector("time")?.textContent).toMatch(/^(قبل|أمس|الآن)/);
    const toggle = await waitFor(() => document.querySelector('[data-kind="change"] button[aria-expanded]') as HTMLElement);
    fireEvent.click(toggle);
    expect(document.querySelector('[data-kind="change"] ul')?.textContent).toContain("←");
  });
});
