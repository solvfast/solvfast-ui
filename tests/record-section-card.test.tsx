/** RecordSectionCard (0.8.0-dev.5, P0 T6): the read-only shell of RecordEditableCard. Reference: the CRM's own read-only
 *  record cards (the editable card without its Edit action on a closed record; Organization's hand-drawn read-only card
 *  with the same header). */
import { afterEach, describe, expect, it } from "vitest";
import * as React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { Stethoscope } from "lucide-react";
import { RecordEditableCard, RecordPage, RecordSectionCard, ThemeProvider } from "../src";

afterEach(cleanup);
const wrap = (ui: React.ReactElement, language: "en" | "ar" = "en") => render(<ThemeProvider language={language} storageKeys={null}>{ui}</ThemeProvider>);
const icon = <span className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center"><Stethoscope className="h-4 w-4" /></span>;

describe("RecordSectionCard", () => {
  for (const language of ["en", "ar"] as const) {
    it(`renders exactly as a read-only RecordEditableCard (${language})`, () => {
      const a = wrap(<RecordSectionCard cardId="allergies" label="Allergies" icon={icon} headerExtra={<a href="#x">All</a>}><p>Penicillin</p></RecordSectionCard>, language).container.innerHTML;
      cleanup();
      const b = wrap(<RecordEditableCard cardId="allergies" label="Allergies" icon={icon} headerExtra={<a href="#x">All</a>} readOnly onSave={() => true} renderEdit={() => null}><p>Penicillin</p></RecordEditableCard>, language).container.innerHTML;
      expect(a).toBe(b);
    });
  }
  it("structure: a section with the card surface, a header (icon, h3 title, spacer, extra) and a p-4 body; no Edit, no footer", () => {
    const { container } = wrap(<RecordSectionCard label="Treatments" icon={icon} headerExtra={<button>Open</button>}>body</RecordSectionCard>);
    const section = container.querySelector("section")!;
    expect(section.className).toBe("rounded-xl border border-border bg-card");
    expect(section.getAttribute("data-record-card")).toBe("");
    const [header, body] = Array.from(section.children);
    expect(header.tagName).toBe("HEADER");
    expect(header.className).toBe("flex items-center gap-2 border-b border-border px-4 py-2.5");
    expect(screen.getByRole("heading", { level: 3, name: "Treatments" }).className).toBe("text-sm font-semibold text-foreground");
    expect(body.className).toBe("p-4"); expect(body.textContent).toBe("body");
    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(section.querySelector("footer")).toBeNull();
  });
  it("className and bodyClassName merge", () => {
    const { container } = wrap(<RecordSectionCard label="L" className="mt-2" bodyClassName="space-y-3">x</RecordSectionCard>);
    expect(container.querySelector("section")!.className).toBe("rounded-xl border border-border bg-card mt-2");
    expect(container.querySelector("section > div")!.className).toBe("p-4 space-y-3");
  });
  it("sits in a RecordPage's main column like the other cards (glass by default)", () => {
    const { container } = wrap(<RecordPage><RecordSectionCard label="Notes">n</RecordSectionCard></RecordPage>);
    expect(container.querySelector(".sf-record-page section[data-record-card]")).not.toBeNull();
  });
});
