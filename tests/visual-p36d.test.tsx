// P36d visual — the DS focus and glass contract. The focus token (styles/src/sf-fixes.css) is CSS, so jsdom cannot compute
// it: the source rule is asserted as text and the browser values are recorded by the Playwright focus audit
// (scratchpad p36d/visual/qa/focus-audit.mjs). The primitives are asserted by class: one focus indicator per control,
// never removed.
import { afterEach, describe, expect, it } from "vitest";
import * as React from "react";
import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { Button, Card, DateField, DateTimeField, EditableTitle, Input, MonthInput, TimeField } from "../src";

afterEach(cleanup);
const wrap = (ui: React.ReactElement) => render(<ThemeProvider language="en">{ui}</ThemeProvider>);
const css = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const classes = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/);

describe("P36D.visual focus token", () => {
  it("P36D.visual.1 inside the DS scope the glass engine's focus token is the theme ring, not Sky", () => {
    const fixes = css("styles/src/sf-fixes.css");
    const rule = /\.sf-theme\s*\{\s*--c-focus:\s*hsl\(var\(--ring\)\);\s*\}/;
    expect(fixes).toMatch(rule);
    // appended to glass.css AFTER the engine (whose token block sets `--c-focus: var(--c-sky)`), so it wins at equal specificity
    const extract = css("scripts/extract-css.mjs");
    expect(extract).toMatch(/styles\/src\/sf-fixes\.css/);
    // the outline itself is kept (2px solid, offset 2px): the engine rule is not overridden or removed
    expect(fixes).not.toMatch(/outline:\s*none/);
    expect(fixes).not.toMatch(/--c-focus:\s*transparent/);
  });

  it("P36D.visual.2 the ring token is violet in light and flame in dark (no blue focus colour)", () => {
    const theme = css("styles/theme.css");
    const light = theme.match(/\.sf-theme\s*\{[^}]*?--ring:\s*([^;]+);/s);
    const dark = theme.match(/\.sf-theme\.dark\s*\{[^}]*?--ring:\s*([^;]+);/s);
    expect(light?.[1].trim()).toBe("265 64% 36%");
    expect(dark?.[1].trim()).toBe("14 99% 58%");
  });
});

describe("P36D.visual field triggers: one focus ring", () => {
  // These triggers draw their own `ring-2 ring-ring` with no offset; without `focus-visible:outline-none` the engine's
  // 2px outline (offset 2px) was stacked outside it (a cyan band before this fix, a 4px band after the token fix).
  const oneRing = (el: Element) => {
    const c = classes(el);
    expect(c).toContain("focus-visible:outline-none");
    expect(c).toContain("focus-visible:ring-2");
    expect(c).toContain("focus-visible:ring-ring");
  };
  it("P36D.visual.3 DateField / TimeField / DateTimeField triggers", () => {
    wrap(<><DateField aria-label="D" value="" onChange={() => {}} /><TimeField aria-label="T" value="" onChange={() => {}} /><DateTimeField aria-label="DT" value="" onChange={() => {}} /></>);
    const triggers = screen.getAllByRole("button");
    expect(triggers.length).toBeGreaterThanOrEqual(3);
    for (const t of triggers.filter((b) => classes(b).includes("sf-field-fill"))) oneRing(t);
  });
  it("P36D.visual.4 MonthInput trigger", () => {
    wrap(<MonthInput aria-label="Readiness" value="2026-03" onChange={() => {}} />);
    oneRing(screen.getByRole("button", { name: "Readiness: March 2026" }));
  });
  it("P36D.visual.5 EditableTitle input keeps the field-fill ring and drops the engine outline", () => {
    wrap(<EditableTitle value="Reem" canEdit onSave={() => {}} ariaLabel="Lead name" />);
    fireEvent.click(screen.getByRole("button", { name: /Reem/ }));
    const input = screen.getByRole("textbox", { name: "Lead name" });
    expect(classes(input)).toContain("sf-field-fill");
    expect(classes(input)).toContain("focus-visible:outline-none");
  });
  it("P36D.visual.6 Button and Input keep a visible ring (focus indication is never removed)", () => {
    wrap(<><Button>Save</Button><Input aria-label="Name" /></>);
    const btn = classes(screen.getByRole("button", { name: "Save" })).join(" ");
    expect(btn).toMatch(/focus-visible:ring-2/);
    expect(btn).toMatch(/focus-visible:ring-ring/);
    // Input: the `.sf-field-fill` class carries the ring (theme.css: focus-visible:ring-2 focus-visible:ring-ring/60)
    expect(classes(screen.getByRole("textbox", { name: "Name" }))).toContain("sf-field-fill");
    expect(css("styles/theme.css")).toMatch(/\.sf-field-fill\s*\{[^}]*focus-visible:ring-2 focus-visible:ring-ring\/60/);
  });
});

describe("P36D.visual glass contract", () => {
  it("P36D.visual.7 Card is the DS airy glass pane (the material consumers reuse), no solid bg-card", () => {
    wrap(<Card data-testid="c">x</Card>);
    const c = classes(screen.getByTestId("c"));
    expect(c).toEqual(expect.arrayContaining(["sf-glass-pane", "sf-glass-pane--airy", "rounded-[20px]"]));
    expect(c).not.toContain("bg-card");
  });
});
