/**
 * Phase 27.5 — custom `rowKey` regression (SIMULATED: stub transports over the playground's simulated ToDo rows).
 * UI row identity (the list's `rowKey`, used for selection) and the Frappe document `name` (sent to the server) are
 * separate: every bulk action, the selection-bar Export and the workflow menu must send `name`, never the UI key.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as React from "react";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src";
import { FrappeListView, FrappeProvider, createFrappeClient, type FrappeTransport } from "../src/frappe";
import { documentNamesForKeys } from "../src/frappe/FrappeListView";
import type { FrappeFilesTransport } from "../src/frappe/client";
import { WORKFLOW_BULK_METHODS } from "../src/frappe/list/workflowBulk";
import { DOWNLOAD_TEMPLATE_METHOD } from "../src/frappe/list/export";
import { defaultMessages } from "../src/theme/messages";
import { TODO_META, createMockFrappe, type MockFrappe } from "../playground/src/demo/mock-frappe";

beforeAll(() => configure({ asyncUtilTimeout: 4000 }));
afterEach(() => cleanup());

const en = (k: keyof typeof defaultMessages.en) => defaultMessages.en[k];
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr")].filter((tr) => !tr.hasAttribute("aria-hidden") && tr.querySelectorAll("td").length > 1);
const check = (...idx: number[]) => { for (const i of idx) fireEvent.click(screen.getAllByRole("checkbox")[i]); };
const ok = (message: unknown = null) => Promise.resolve({ message });
const PERMS = [{ role: "System Manager", permlevel: 0, read: 1, write: 1, create: 1, delete: 1, print: 1, export: 1 }];
const META = (over: Record<string, unknown> = {}) => ({ ...TODO_META, permissions: PERMS, ...over });
/** A UI key that is NOT the document name. */
const UI_KEY = (r: Record<string, unknown>) => `ui::${String(r.name)}`;

type Extra = (m: string, a: Record<string, unknown>) => Promise<Record<string, unknown>> | undefined;
function mountList(props: Partial<React.ComponentProps<typeof FrappeListView>>, extra?: Extra, meta: Record<string, unknown> = META(), files?: FrappeFilesTransport) {
  const mock: MockFrappe = createMockFrappe();
  const transport: FrappeTransport = async (m, a) => {
    const own = extra?.(m, a);
    if (own) return own as never;
    if (m === "frappe.desk.form.load.getdoctype") return { docs: [meta], user_settings: "{}" } as never;
    return mock.transport(m, a);
  };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}><FrappeProvider client={createFrappeClient({ transport, files })} session={{ user: "u@x.com", roles: ["System Manager"] }}>
        <FrappeListView doctype="ToDo" storage={null} bulk={{}} {...props} />
      </FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
  const sorted = () => mock.rows.slice().sort((a, b) => String(b.modified).localeCompare(String(a.modified))).map((r) => String(r.name));
  return { mock, firstNames: (n: number) => sorted().slice(0, n), sorted };
}

describe("documentNamesForKeys", () => {
  it("resolves UI keys to document names; unknown keys are reported, never passed through", () => {
    const map = new Map([["ui::A", "A"], ["ui::B", "B"]]);
    expect(documentNamesForKeys(["ui::B", "ui::A"], map)).toEqual({ names: ["B", "A"], missing: [] });
    expect(documentNamesForKeys(["ui::A", "ui::Z"], map)).toEqual({ names: ["A"], missing: ["ui::Z"] });
  });
});

describe("FrappeListView with a custom rowKey sends document names (SIMULATED)", () => {
  it("Delete: delete_items gets the names, not the UI keys", async () => {
    const seen: Record<string, unknown>[] = [];
    const { firstNames } = mountList({ rowKey: UI_KEY as never }, (m, a) => (m === "frappe.desk.reportview.delete_items" ? (seen.push(a), ok()) : undefined));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkDelete") }));
    fireEvent.click(await screen.findByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(seen).toHaveLength(1));
    const items = JSON.parse(String(seen[0].items)) as string[];
    expect(items.slice().sort()).toEqual(firstNames(2).slice().sort());
    expect(items.some((x) => x.startsWith("ui::"))).toBe(false);
  });

  it("Clear Assignment and Apply Assignment Rule: names", async () => {
    const clear: Record<string, unknown>[] = []; const rule: Record<string, unknown>[] = [];
    const { firstNames } = mountList({ rowKey: UI_KEY as never }, (m, a) =>
      m === "frappe.desk.form.assign_to.remove_multiple" ? (clear.push(a), ok())
        : m === "frappe.automation.doctype.assignment_rule.assignment_rule.bulk_apply" ? (rule.push(a), ok()) : undefined);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkClearAssignment") }));
    fireEvent.click(await screen.findByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(clear).toHaveLength(1));
    expect((JSON.parse(String(clear[0].names)) as string[]).slice().sort()).toEqual(firstNames(2).slice().sort());
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 3);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkAssignmentRule") }));
    await waitFor(() => expect(rule).toHaveLength(1));
    const docnames = JSON.parse(String(rule[0].docnames)) as string[];
    expect(docnames.every((n) => !n.startsWith("ui::"))).toBe(true);
    expect(docnames).toHaveLength(2);
  });

  it("Assign To: add_multiple gets the names", async () => {
    const seen: Record<string, unknown>[] = [];
    const { firstNames } = mountList({ rowKey: UI_KEY as never }, (m, a) => (m === "frappe.desk.form.assign_to.add_multiple" ? (seen.push(a), ok()) : undefined));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkAssign") }));
    fireEvent.click(await screen.findByRole("option", { name: /omar@example.com/ }));
    fireEvent.click(screen.getByRole("button", { name: defaultMessages.en.recAssignConfirm }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect((JSON.parse(String(seen[0].name)) as string[]).slice().sort()).toEqual(firstNames(2).slice().sort());
  });

  it("Add Tags: add_tags gets the names", async () => {
    const seen: Record<string, unknown>[] = [];
    const { firstNames } = mountList({ rowKey: UI_KEY as never }, (m, a) =>
      m === "frappe.desk.doctype.tag.tag.add_tags" ? (seen.push(a), ok())
        : m === "frappe.desk.search.search_link" && a.doctype === "Tag" ? ok([{ value: "urgent", description: "" }]) : undefined);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkAddTags") }));
    const dialog = await screen.findByRole("dialog", { name: en("listBulkAddTags") });
    const input = within(dialog).getByRole("combobox", { name: en("listBulkTags") });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "urg" } });
    fireEvent.click(await screen.findByRole("option", { name: /urgent/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: en("listBulkAdd") }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect((JSON.parse(String(seen[0].docs)) as string[]).slice().sort()).toEqual(firstNames(2).slice().sort());
  });

  it("selection-bar Export: by_filter on the names", async () => {
    const seen: { method: string; args: Record<string, unknown> }[] = [];
    const files: FrappeFilesTransport = { download: async (method, args) => { seen.push({ method, args }); return { blob: new Blob(["s"]), filename: "x.csv", contentType: "text/csv" }; }, upload: async () => { throw new Error("unused"); } };
    const { firstNames } = mountList({ rowKey: UI_KEY as never }, undefined, META(), files);
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: "Export" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Select All" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Export" }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0].method).toBe(DOWNLOAD_TEMPLATE_METHOD);
    const filters = JSON.parse(String(seen[0].args.export_filters)) as unknown[][];
    expect((filters[0][3] as string[]).slice().sort()).toEqual(firstNames(2).slice().sort());
  });

  it("workflow menu: get_common_transition_actions docs and bulk_workflow_approval docnames are names", async () => {
    const WF = { doctype: "Workflow", name: "WF", document_type: "ToDo", workflow_state_field: "workflow_state", is_active: 1,
      states: [{ state: "Pending", doc_status: "0", allow_edit: "System Manager" }], transitions: [{ state: "Pending", action: "Approve", next_state: "Pending", allowed: "System Manager" }] };
    const common: Record<string, unknown>[] = []; const approved: Record<string, unknown>[] = [];
    const { firstNames } = mountList({ rowKey: UI_KEY as never }, (m, a) =>
      m === WORKFLOW_BULK_METHODS.commonActions ? (common.push(a), ok(["Approve"]))
        : m === WORKFLOW_BULK_METHODS.approve ? (approved.push(a), ok()) : undefined, META({ __workflow_docs: [WF] }));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.keyDown(await screen.findByTestId("sf-bulk-workflow"), { key: "Enter" });
    await waitFor(() => expect(common).toHaveLength(1));
    expect((JSON.parse(String(common[0].docs)) as { name: string }[]).map((d) => d.name).sort()).toEqual(firstNames(2).slice().sort());
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(approved).toHaveLength(1));
    expect((JSON.parse(String(approved[0].docnames)) as string[]).slice().sort()).toEqual(firstNames(2).slice().sort());
  });

  it("a selection kept across pages still resolves to names (rows seen on page 1, action taken on page 2)", async () => {
    const seen: Record<string, unknown>[] = [];
    const { sorted } = mountList({ rowKey: UI_KEY as never }, (m, a) => (m === "frappe.desk.reportview.delete_items" ? (seen.push(a), ok()) : undefined));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1);
    fireEvent.click(screen.getByRole("button", { name: en("nextPage") }));
    await waitFor(() => expect(bodyRows()[0].textContent).not.toContain(sorted()[0]));
    check(1);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkDelete") }));
    fireEvent.click(await screen.findByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(seen).toHaveLength(1));
    const items = JSON.parse(String(seen[0].items)) as string[];
    expect(items).toHaveLength(2);
    expect(items).toContain(sorted()[0]);
    expect(items.some((x) => x.startsWith("ui::"))).toBe(false);
  });

  it("default rowKey (name): unchanged — the keys are the names", async () => {
    const seen: Record<string, unknown>[] = [];
    const { firstNames } = mountList({}, (m, a) => (m === "frappe.desk.reportview.delete_items" ? (seen.push(a), ok()) : undefined));
    await waitFor(() => expect(bodyRows()).toHaveLength(20));
    check(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: en("listBulkDelete") }));
    fireEvent.click(await screen.findByRole("button", { name: en("confirm") }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0].items).toBe(JSON.stringify(firstNames(2)));
    await act(() => Promise.resolve());
  });
});
