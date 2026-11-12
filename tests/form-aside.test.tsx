/** FrappeFormView `aside`: a record rail next to the form (the CRM record page's 3 + 1 grid). Unit level, no server. */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { User } from "lucide-react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import type { MetaBundle } from "../src/frappe/contract";
import { createFixtureTransport } from "../src/frappe/testing";
import { FrappeFormView } from "../src/frappe/form";
import { RecordRail, RecordRailSection } from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

function mount(node: React.ReactElement) {
  const client = createFrappeClient({ transport: createFixtureTransport({ meta: {}, docs: {} }) });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
      <QueryClientProvider client={qc}>
        <FrappeProvider client={client} session={{ user: "Administrator" }}>{node}</FrappeProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}
const bundle: MetaBundle = { doctype: "Deal", children: {}, meta: { name: "Deal", title_field: "title", fields: [{ fieldname: "title", fieldtype: "Data", label: "Title" }] } };
const doc = { doctype: "Deal", name: "D-1", title: "Annual contract" };

describe("FrappeFormView aside", () => {
  it("without `aside` the form's root is unchanged (no grid)", () => {
    const { container } = mount(<FrappeFormView bundle={bundle} doc={doc} onSave={async (d) => d} guardUnload={false} className="my-form" />);
    expect(container.querySelector("[data-form-layout]")).toBeNull();
    const root = container.querySelector("[data-doctype='Deal']")!;
    expect(root.className).toContain("my-form");
    expect(root.className).not.toContain("lg:col-span-3");
  });

  it("with `aside`: the CRM grid — form 3 columns, the rail the 4th; className goes to the grid", () => {
    const { container } = mount(
      <FrappeFormView bundle={bundle} doc={doc} onSave={async (d) => d} guardUnload={false} className="my-form"
        aside={<RecordRail className="lg:col-span-1 space-y-4" sections={[{ id: "a", label: "Assignment", render: () => <RecordRailSection title="Assignment" icon={User} spec={{ kind: "single" }}>Sara</RecordRailSection> }]} />} />,
    );
    const grid = container.querySelector("[data-form-layout='aside']")!;
    expect(grid.className).toContain("lg:grid-cols-4");
    expect(grid.className).toContain("my-form");
    expect(grid.children[0].getAttribute("data-doctype")).toBe("Deal");
    expect(grid.children[0].className).toContain("lg:col-span-3");
    expect(grid.children[1].matches("aside[data-record-rail]")).toBe(true);
    expect(screen.getByText("Sara")).toBeTruthy();
  });

  it("a function `aside` receives the live form context (the document as edited)", () => {
    mount(<FrappeFormView bundle={bundle} doc={doc} onSave={async (d) => d} guardUnload={false} aside={(ctx) => <p data-testid="ctx">{String(ctx.doc.title)} · {ctx.dirty ? "dirty" : "clean"}</p>} />);
    expect(screen.getByTestId("ctx").textContent).toBe("Annual contract · clean");
  });
});
