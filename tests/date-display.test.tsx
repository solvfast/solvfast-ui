/**
 * Phase 27.5 — Date display: an editable Frappe Date field reads the same as its read-only display (the site's
 * `date_format`, Desk's `frappe.datetime.str_to_user` for both the control and the formatter), in English and Arabic,
 * and the stored value stays "YYYY-MM-DD" (no Date / timezone conversion). SIMULATED: no site involved.
 */
import { afterEach, describe, expect, it } from "vitest";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeField } from "../src/frappe/form";
import { DateField } from "../src/primitives/date-time-field";
import type { FormatContext } from "../src/frappe/services/format";

afterEach(() => cleanup());

function mount(ui: React.ReactNode, ctx: FormatContext, lang: "en" | "ar" = "en") {
  const client = createFrappeClient({ transport: async () => ({}) });
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
      <QueryClientProvider client={new QueryClient()}><FrappeProvider client={client} formatContext={ctx}>{ui}</FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
}
const DF = { fieldname: "due", fieldtype: "Date", label: "Due" };

describe("Frappe Date field display (SIMULATED)", () => {
  for (const [fmt, shown] of [["dd-mm-yyyy", "20-11-2026"], ["mm/dd/yyyy", "11/20/2026"], ["yyyy-mm-dd", "2026-11-20"]] as const) {
    it(`editable and read-only both show the site's ${fmt}`, () => {
      mount(<div>
        <FrappeField df={DF} value="2026-11-20" onChange={() => {}} />
        <FrappeField df={{ ...DF, fieldname: "due_ro", label: "Due RO", read_only: 1 }} value="2026-11-20" onChange={() => {}} />
      </div>, { dateFormat: fmt });
      expect(screen.getAllByText(shown)).toHaveLength(2); // the editable trigger and the read-only value, same text
    });
  }

  it("Arabic: the same site format (Latin digits, as Desk), no localized month name in either state", () => {
    mount(<div>
      <FrappeField df={DF} value="2026-11-20" onChange={() => {}} />
      <FrappeField df={{ ...DF, fieldname: "due_ro", read_only: 1 }} value="2026-11-20" onChange={() => {}} />
    </div>, { dateFormat: "dd-mm-yyyy" }, "ar");
    expect(screen.getAllByText("20-11-2026")).toHaveLength(2);
    expect(document.body.textContent).not.toContain("نوفمبر");
  });

  it("the value round-trips unchanged: picking a day emits YYYY-MM-DD, independent of the display format", () => {
    const seen: unknown[] = [];
    mount(<FrappeField df={DF} value="2026-11-20" onChange={(v) => seen.push(v)} />, { dateFormat: "dd-mm-yyyy" });
    fireEvent.click(screen.getByText("20-11-2026"));
    fireEvent.click(screen.getByRole("button", { name: /21/ }) ?? screen.getAllByRole("gridcell", { name: /21/ })[0]);
    expect(seen).toEqual(["2026-11-21"]);
  });

  it("DS DateField without formatDisplay keeps the DS format (non-Frappe consumers unchanged)", () => {
    render(<ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}><DateField value="2026-11-20" onChange={() => {}} /></ThemeProvider>);
    expect(screen.getByText("20 Nov 2026")).toBeTruthy();
  });
});
