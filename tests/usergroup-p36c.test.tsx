/**
 * P36c "usergroup" — Desk's "Assign To User Group" (Frappe 15.110 public/js/frappe/form/sidebar/assign_to.js:142-160,
 * 191-197; list bulk Assign To = the same AssignToDialog, bulk_operations.js:225-238) on the in-package SIMULATOR
 * (`createFixtureTransport` + `withSimulatedSidebar`, whose child-table `reportview.get_list` and User Group fixture live in
 * src/frappe/testing/handlers/sidebar.ts). Request shapes are asserted on `store.calls`; permission decisions are the
 * simulator's approximation — SIMULATED, never a real site.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as React from "react";
import { act, cleanup, configure as configureTL, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import todoEn from "./fixtures/real-15.110/todo.en.json";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { AssignDialog, uniqueMembers } from "../src/record";
import { createFrappeClient, FrappeError } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeListView } from "../src/frappe";
import { FrappeBulkActions } from "../src/frappe/list/FrappeBulkActions";
import { FrappeAssignTo, FrappeFormSidebar, userGroupMembersArgs, getUserGroupMembers, userGroupSource, USER_GROUP_MEMBERS_METHOD } from "../src/frappe/record";
import type { DocPerm, DocTypeMeta, FrappeDoc } from "../src/frappe/contract";
import { createFixtureTransport, simScenario, type FixtureTransport, type SimulatedPermissions } from "../src/frappe/testing";
import { childTableList, userGroupFixture, withSimulatedSidebar } from "../src/frappe/testing/handlers/sidebar";
import { defaultMessages } from "../src/theme/messages";
import { UserGroupAssignPage } from "../showcase/src/pages/p36c-usergroup";
import { PAGES } from "../showcase/src/routes";

beforeAll(() => {
  configureTL({ asyncUtilTimeout: 5000 });
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(() => cleanup());

const en = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];
const ar = (k: keyof typeof defaultMessages.ar) => defaultMessages.ar[k];
const T = "2026-11-02 09:00:00.000000";
const docsOf = (x: unknown) => (x as { docs: DocTypeMeta[] }).docs;
const ALL = { read: 1, write: 1, create: 1, delete: 1, share: 1, print: 1, export: 1, report: 1 } as const;
const PERMS: DocPerm[] = [{ role: "System Manager", permlevel: 0, ...ALL }, { role: "Visit Writer", permlevel: 0, ...ALL }];
const VISIT: DocTypeMeta = {
  name: "Site Visit", autoname: "hash", title_field: "subject", permissions: PERMS,
  fields: [{ fieldname: "subject", fieldtype: "Data", label: "Subject", in_list_view: 1 }],
} as DocTypeMeta;
const person = (u: string, enabled = 1) => ({ doctype: "User", name: u, email: u, full_name: `${u.split("@")[0]} Q`, first_name: u.split("@")[0], enabled, user_type: "System User", modified: T, creation: T });
const USERS = [person("sara@example.com"), person("lina@example.com"), person("omar@example.com"), person("nadia@example.com", 0)] as FrappeDoc[];
const BIG = Array.from({ length: 25 }, (_, i) => `u${String(i + 1).padStart(2, "0")}@example.com`);
const GROUPS = {
  // lina twice (a Table MultiSelect row added twice); nadia is a DISABLED user — Desk keeps both
  "Field Team": ["lina@example.com", "omar@example.com", "lina@example.com", "nadia@example.com"],
  "Empty Crew": [],
  "Big Group": BIG,
};
const WRITER = simScenario.fullAccess("sara@example.com", ["Visit Writer"], { fullName: "Sara Q", users: { "lina@example.com": { roles: ["Visit Writer"] }, "omar@example.com": { roles: ["Visit Writer"] }, "nadia@example.com": { roles: ["Visit Writer"] } } });
/** A site whose User Group DocPerms lost the Desk User read (Role Permission Manager): only System Manager reads groups. */
const NO_DESK_READ: DocPerm[] = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1 }];

function site(opts: { permissions?: SimulatedPermissions; groupPerms?: DocPerm[]; visits?: string[] } = {}) {
  const ug = userGroupFixture(GROUPS, { stamp: T, permissions: opts.groupPerms });
  const base = createFixtureTransport({
    meta: { "Site Visit": [VISIT], ToDo: docsOf(todoEn), ...ug.meta },
    docs: {
      User: USERS, ...ug.docs,
      "Site Visit": (opts.visits ?? ["SV-1"]).map((name, i) => ({ doctype: "Site Visit", name, subject: `Visit ${i + 1}`, owner: "sara@example.com", modified: T, creation: T, docstatus: 0 })) as FrappeDoc[],
    },
  }, { permissions: opts.permissions ?? WRITER });
  const t = withSimulatedSidebar(base);
  return { t, client: createFrappeClient({ transport: t, files: t.files }) };
}
type Site = ReturnType<typeof site>;
function mount(s: Site, ui: React.ReactElement, language: "en" | "ar" = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ses = s.t.store.session!;
  return render(
    <QueryClientProvider client={qc}>
      <FrappeProvider client={s.client} queryClient={qc} session={{ user: ses.user, fullName: ses.fullName, roles: ses.roles }}>
        <ThemeProvider defaultLanguage={language} storageKeys={null}>{ui}</ThemeProvider>
      </FrappeProvider>
    </QueryClientProvider>,
  );
}
const calls = (t: FixtureTransport, method: string) => t.store.calls.filter((c) => c.method === method);
const sectionOf = (id: string) => document.querySelector<HTMLElement>(`[data-sidebar-section="${id}"]`)!;
/** The users to assign, as the dialog's pills show them (their remove buttons). */
const pills = (dlg: HTMLElement) => within(dlg).queryAllByRole("button", { name: /^Remove / }).map((b) => b.getAttribute("aria-label")!.replace(/^Remove /, ""));
const groupBox = (dlg: HTMLElement) => within(within(dlg).getByTestId("sf-assign-group")).getByRole("combobox");
async function pickGroup(dlg: HTMLElement, name: string) {
  const box = groupBox(dlg);
  fireEvent.focus(box);
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(`^${name}`) }));
}
async function openSidebarDialog(s: Site, language: "en" | "ar" = "en") {
  mount(s, <FrappeFormSidebar doctype="Site Visit" name="SV-1" />, language);
  await waitFor(() => expect(sectionOf("assign")).toBeTruthy());
  fireEvent.click(within(sectionOf("assign")).getByRole("button", { name: language === "en" ? "Add to ToDo" : ar("sbAssignAdd") }));
  return screen.findByRole("dialog");
}
const MEMBERS_ARGS = { doctype: "User Group Member", parent_doctype: "User Group", filters: JSON.stringify({ parent: "Field Team" }), fields: JSON.stringify(["user"]), limit: 20 };

describe("P36C.usergroup — form sidebar Add to ToDo (assign_to.js:142-160, 191-197)", () => {
  it("P36C.usergroup.1 the field follows Assign To; picking a group reads its members as Desk does and REPLACES the users to assign (deduplicated, Assign to me unticked)", async () => {
    const s = site();
    const dlg = await openSidebarDialog(s);
    const field = within(dlg).getByTestId("sf-assign-group");
    expect(within(field).getByText("Assign To User Group")).toBeTruthy();
    // Desk's order: Assign to me, Assign To, Assign To User Group, then Complete By / Priority, Comment
    const order = [within(dlg).getByText("Assign to me"), within(dlg).getAllByText("Users")[0], within(field).getByText("Assign To User Group"), within(dlg).getByText(en("recAssignDue"))];
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // earlier choice: me + omar
    fireEvent.click(within(dlg).getByRole("checkbox", { name: "Assign to me" }));
    fireEvent.click(await within(dlg).findByRole("option", { name: /omar Q/ }));
    expect(pills(dlg)).toEqual(["Sara Q", "omar@example.com"]); // search_link on User: the value is the label (full name in the description)
    await pickGroup(dlg, "Field Team");
    // the Link's search (search_link on User Group) and Desk's frappe.db.get_list request, exactly
    expect(calls(s.t, "frappe.desk.search.search_link").some((c) => c.args.doctype === "User Group")).toBe(true);
    await waitFor(() => expect(calls(s.t, USER_GROUP_MEMBERS_METHOD).filter((c) => c.args.doctype === "User Group Member")).toHaveLength(1));
    expect(calls(s.t, USER_GROUP_MEMBERS_METHOD).find((c) => c.args.doctype === "User Group Member")!.args).toEqual(MEMBERS_ARGS);
    // replaced (not merged): sara is not a member and drops out; lina once; the disabled nadia kept
    await waitFor(() => expect(pills(dlg)).toEqual(["lina@example.com", "omar@example.com", "nadia@example.com"]));
    expect((within(dlg).getByRole("checkbox", { name: "Assign to me" }) as HTMLElement).getAttribute("aria-checked")).toBe("false");
    expect(within(dlg).getByRole("status").textContent).toBe("3 member(s) of Field Team added to Assign To.");
  }, 20000);

  it("P36C.usergroup.2 Add sends assign_to.add with the expanded list; the server keeps duplicates out and does not filter disabled users", async () => {
    const s = site();
    // lina already holds an open ToDo on SV-1
    s.t.store.todos.set("TD-L", { doctype: "ToDo", name: "TD-L", allocated_to: "lina@example.com", reference_type: "Site Visit", reference_name: "SV-1", status: "Open", description: "x", owner: "sara@example.com", assigned_by: "sara@example.com", modified: T, creation: T });
    const dlg = await openSidebarDialog(s);
    await pickGroup(dlg, "Field Team");
    await waitFor(() => expect(pills(dlg)).toHaveLength(3));
    fireEvent.click(within(dlg).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.assign_to.add")).toHaveLength(1));
    const a = calls(s.t, "frappe.desk.form.assign_to.add")[0].args;
    expect(a).toMatchObject({ doctype: "Site Visit", name: "SV-1", description: "Visit 1" });
    expect(JSON.parse(String(a.assign_to))).toEqual(["lina@example.com", "omar@example.com", "nadia@example.com"]);
    await waitFor(() => expect(screen.queryByTestId("sf-assign-dialog")).toBeNull());
    // assign_to.py:135-137: the duplicate is answered with Desk's msgprint, shown as the server's message
    expect((await screen.findByRole("dialog")).textContent).toMatch(/Already in the following Users ToDo list:\s*lina@example\.com/);
    const open = (u: string) => [...s.t.store.todos.values()].filter((d) => d.allocated_to === u && d.reference_name === "SV-1" && d.status === "Open");
    expect(open("lina@example.com")).toHaveLength(1); // assign_to.py:58-66: duplicate → message, no second ToDo
    expect(open("omar@example.com")).toHaveLength(1);
    expect(open("nadia@example.com")).toHaveLength(1); // the disabled member is assigned too (no enabled filter on this path)
    await waitFor(() => expect(within(sectionOf("assign")).getByText("omar Q")).toBeTruthy());
  }, 20000);

  it("P36C.usergroup.3 empty group: the users to assign are emptied (Desk sets []), Add is disabled, a note says so; clearing the group keeps the list", async () => {
    const s = site();
    const dlg = await openSidebarDialog(s);
    fireEvent.click(await within(dlg).findByRole("option", { name: /omar Q/ }));
    await pickGroup(dlg, "Empty Crew");
    await waitFor(() => expect(within(dlg).getByRole("status").textContent).toBe("Empty Crew has no members."));
    expect(pills(dlg)).toEqual([]);
    expect((within(dlg).getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
    // pick users again, then clear the group: nothing changes (Desk: `if (user_group)`)
    fireEvent.click(within(dlg).getByRole("option", { name: /lina Q/ }));
    const before = calls(s.t, USER_GROUP_MEMBERS_METHOD).length;
    fireEvent.click(within(within(dlg).getByTestId("sf-assign-group")).getByRole("button", { name: en("formClear") }));
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(pills(dlg)).toEqual(["lina@example.com"]);
    expect(calls(s.t, USER_GROUP_MEMBERS_METHOD)).toHaveLength(before);
  }, 20000);

  it("P36C.usergroup.4 Desk's limit: frappe.db.get_list asks for 20 rows, so a 25-member group expands to its first 20", async () => {
    const s = site();
    const dlg = await openSidebarDialog(s);
    await pickGroup(dlg, "Big Group");
    await waitFor(() => expect(pills(dlg)).toHaveLength(20));
    expect(pills(dlg)).toEqual(BIG.slice(0, 20));
    expect(calls(s.t, USER_GROUP_MEMBERS_METHOD).at(-1)!.args.limit).toBe(20);
  }, 20000);

  it("P36C.usergroup.5 Arabic: the field label, the note and RTL", async () => {
    const s = site();
    const dlg = await openSidebarDialog(s, "ar");
    expect(within(dlg).getByText(ar("sbAssignGroup"))).toBeTruthy();
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    await pickGroup(dlg, "Empty Crew");
    await waitFor(() => expect(within(dlg).getByRole("status").textContent).toBe("لا يوجد أعضاء في Empty Crew."));
  }, 20000);

  it("P36C.usergroup.6 `userGroups={false}` hides the field; the group layout's popover never shows it", async () => {
    const s = site();
    const doc = { doctype: "Site Visit", name: "SV-1", subject: "Visit 1", modified: T, creation: T, docstatus: 0 } as FrappeDoc;
    mount(s, <FrappeAssignTo doc={doc} user="sara@example.com" layout="sidebar" userGroups={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Add to ToDo" }));
    const dlg = await screen.findByRole("dialog");
    expect(within(dlg).queryByTestId("sf-assign-group")).toBeNull();
  }, 20000);
});

describe("P36C.usergroup — permissions (SIMULATED server checks)", () => {
  it("P36C.usergroup.7 negative: without read on User Group the group search is refused (403) and the refusal is shown; the members read is refused too", async () => {
    const s = site({ groupPerms: NO_DESK_READ });
    const dlg = await openSidebarDialog(s);
    fireEvent.click(await within(dlg).findByRole("option", { name: /omar Q/ }));
    fireEvent.focus(groupBox(dlg));
    await waitFor(() => expect(within(within(dlg).getByTestId("sf-assign-group")).getByRole("alert").textContent).toMatch(/No permission for User Group/));
    expect(screen.queryByRole("option", { name: /^Field Team/ })).toBeNull();
    expect(pills(dlg)).toEqual(["omar@example.com"]);
    // the read Desk sends for the members: has_child_permission → read on User Group → 403
    const err = await s.t(USER_GROUP_MEMBERS_METHOD, userGroupMembersArgs("Field Team")).catch((e) => e);
    expect(err).toBeInstanceOf(FrappeError);
    expect((err as FrappeError).status).toBe(403);
    expect((err as FrappeError).excType).toBe("PermissionError");
  }, 20000);

  it("P36C.usergroup.8 positive control + parent check: every System User reads groups through Desk User; a parent without that table is refused; Administrator passes", async () => {
    const s = site();
    expect(await getUserGroupMembers(s.client, "Field Team")).toEqual(["lina@example.com", "omar@example.com", "lina@example.com", "nadia@example.com"]);
    const bad = await s.t(USER_GROUP_MEMBERS_METHOD, { ...userGroupMembersArgs("Field Team"), parent_doctype: "Site Visit" }).catch((e) => e);
    expect((bad as FrappeError).status).toBe(403);
    const admin = site({ permissions: { user: "Administrator", roles: ["System Manager"] }, groupPerms: NO_DESK_READ });
    expect(await getUserGroupMembers(admin.client, "Big Group")).toHaveLength(20);
  }, 20000);

  it("P36C.usergroup.9 a refused members read keeps the users to assign and shows the server's message (Core, any host)", async () => {
    const members = () => Promise.reject(new Error("No permission for User Group Member"));
    render(
      <ThemeProvider defaultLanguage="en" storageKeys={null}>
        <AssignDialog open onOpenChange={() => {}} onAssign={() => {}} searchUsers={async () => [{ id: "a@x.com", label: "A" }]}
          groups={{ search: async () => [{ value: "Ops" }], members, debounceMs: 0 }} />
      </ThemeProvider>,
    );
    const dlg = await screen.findByRole("dialog");
    fireEvent.click(await within(dlg).findByRole("option", { name: /^A/ }));
    await pickGroup(dlg, "Ops");
    await waitFor(() => expect(within(within(dlg).getByTestId("sf-assign-group")).getByRole("alert").textContent).toBe("No permission for User Group Member"));
    expect(pills(dlg)).toEqual(["A"]);
  }, 20000);
});

describe("P36C.usergroup — list bulk Assign To (bulk_operations.js:225-238)", () => {
  const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && tr.querySelectorAll("td").length > 1);

  it("P36C.usergroup.10 the Actions menu's Assign To dialog has the group field; add_multiple carries the expanded list for every checked document", async () => {
    const s = site({ visits: ["SV-1", "SV-2"] });
    mount(s, <FrappeListView doctype="Site Visit" rowMeta={false} like={false} storage={null} bulk={{}} />);
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    for (const tr of bodyRows()) fireEvent.click(within(tr).getAllByRole("checkbox")[0]);
    fireEvent.keyDown(await screen.findByTestId("sf-list-actions"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: en("listBulkAssign") }));
    const dlg = await screen.findByTestId("sf-assign-dialog");
    await pickGroup(dlg, "Field Team");
    await waitFor(() => expect(pills(dlg)).toEqual(["lina@example.com", "omar@example.com", "nadia@example.com"]));
    expect(calls(s.t, USER_GROUP_MEMBERS_METHOD).find((c) => c.args.doctype === "User Group Member")!.args).toEqual(MEMBERS_ARGS);
    fireEvent.click(within(dlg).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(calls(s.t, "frappe.desk.form.assign_to.add_multiple")).toHaveLength(1));
    const a = calls(s.t, "frappe.desk.form.assign_to.add_multiple")[0].args;
    expect(a).toMatchObject({ doctype: "Site Visit", bulk_assign: true, re_assign: true });
    expect(JSON.parse(String(a.name)).sort()).toEqual(["SV-1", "SV-2"]);
    expect(JSON.parse(String(a.assign_to))).toEqual(["lina@example.com", "omar@example.com", "nadia@example.com"]);
    for (const n of ["SV-1", "SV-2"]) expect([...s.t.store.todos.values()].filter((d) => d.reference_name === n && d.status === "Open").map((d) => d.allocated_to).sort()).toEqual(["lina@example.com", "nadia@example.com", "omar@example.com"]);
  }, 20000);

  it("P36C.usergroup.11 the bar's popover (FrappeBulkActions, not Desk's layout) has no group field; `bulk.userGroups: false` hides it in the dialog", async () => {
    const s = site({ visits: ["SV-1"] });
    mount(s, <FrappeBulkActions client={s.client} doctype="Site Visit" keys={["SV-1"]} clear={() => {}}
      meta={{ isSubmittable: false, editable: [] } as never} options={{ permissions: { read: true, write: true, delete: true, export: true } as never, only: ["assign"] }} />);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkAssign") }));
    await screen.findByRole("combobox", { name: en("recAssignSearch") });
    expect(screen.queryByText("Assign To User Group")).toBeNull();
    cleanup();
    const s2 = site({ visits: ["SV-1", "SV-2"] });
    mount(s2, <FrappeListView doctype="Site Visit" rowMeta={false} like={false} storage={null} bulk={{ userGroups: false }} />);
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    fireEvent.click(within(bodyRows()[0]).getAllByRole("checkbox")[0]);
    fireEvent.keyDown(await screen.findByTestId("sf-list-actions"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: en("listBulkAssign") }));
    const dlg = await screen.findByTestId("sf-assign-dialog");
    expect(within(dlg).queryByTestId("sf-assign-group")).toBeNull();
  }, 20000);
});

describe("P36C.usergroup — helpers and simulator", () => {
  it("P36C.usergroup.12 userGroupMembersArgs / userGroupSource / uniqueMembers", async () => {
    expect(userGroupMembersArgs("Field Team")).toEqual(MEMBERS_ARGS);
    const s = site();
    const src = userGroupSource(s.client, { userLabel: (u) => (u === "omar@example.com" ? "Omar" : undefined) });
    expect((await src.search("field")).map((g) => g.value)).toEqual(["Field Team"]);
    expect(await src.members("Field Team")).toEqual([
      { id: "lina@example.com", label: "lina@example.com" }, { id: "omar@example.com", label: "Omar" }, { id: "lina@example.com", label: "lina@example.com" }, { id: "nadia@example.com", label: "nadia@example.com" },
    ]);
    expect(uniqueMembers([{ id: "a", label: "a" }, { id: "b", label: "B" }, { id: "a", label: "a" }], [{ id: "a", label: "Ann" }])).toEqual([{ id: "a", label: "Ann", image: undefined }, { id: "b", label: "B" }]);
  }, 20000);

  it("P36C.usergroup.13 childTableList: filters (dict / list / in), fields, unknown field → 417, start / limit", () => {
    const s = site();
    const P = s.t.permissions;
    const rows = (a: Record<string, unknown>) => childTableList(s.t.store, P, { doctype: "User Group Member", parent_doctype: "User Group", ...a }).message as Record<string, unknown>[];
    expect(rows({ filters: { parent: "Field Team" }, fields: ["user", "idx"] })).toEqual([
      { user: "lina@example.com", idx: 1 }, { user: "omar@example.com", idx: 2 }, { user: "lina@example.com", idx: 3 }, { user: "nadia@example.com", idx: 4 },
    ]);
    expect(rows({ filters: [["parent", "=", "Field Team"], ["user", "in", ["omar@example.com", "nadia@example.com"]]], fields: ["user"] })).toEqual([{ user: "omar@example.com" }, { user: "nadia@example.com" }]);
    expect(rows({ filters: { parent: "Big Group" }, fields: ["user"], start: 20, limit: 20 })).toHaveLength(5);
    expect(() => rows({ fields: ["secret"] })).toThrow(/Field not permitted in query: secret/);
  }, 20000);

  it("P36C.usergroup.14 the showcase page is registered and renders the SIMULATED Assign To User Group demo", async () => {
    expect(PAGES.some((p) => p.id === "frappe-assign-user-group")).toBe(true);
    render(<ThemeProvider defaultLanguage="en" storageKeys={null}><UserGroupAssignPage /></ThemeProvider>);
    expect((await screen.findAllByText(/SIMULATED/)).length).toBeGreaterThan(0);
    expect(screen.getByText("Assign To User Group in Add to ToDo")).toBeTruthy();
  }, 20000);
});
