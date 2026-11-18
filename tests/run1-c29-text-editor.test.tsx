/**
 * Run 1 · C-29 (P1, data loss) — the Text Editor keeps what Desk's Text Editor stores. The "desk" sanitizer profile
 * (primitives/rich-text-editor.tsx) keeps headings, tables, images, colours, alignment, direction, Quill's list / code
 * markers and mention spans; it still drops script, event handlers, unsafe URLs and dangerous CSS. FrappeField's Text
 * Editor uses it for editing and reading; the default ("basic") profile is unchanged (tests/merged.test.tsx).
 * jsdom: input is simulated by changing the editing surface's DOM and firing `input` (jsdom has no execCommand) — not
 * browser evidence.
 */
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { RichText, RichTextEditor, sanitizeHtml } from "../src";
import { createFrappeClient } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { createFixtureTransport } from "../src/frappe/testing";
import { FrappeField } from "../src/frappe/form";
import type { FrappeDocField } from "../src/frappe/contract";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

/** Content as Desk 15.110's Text Editor (Quill 2.0.3) stores it. */
const DESK_HTML =
  '<h2>Plan</h2>' +
  '<p class="ql-align-center" style="text-align: center">centred <span style="color: rgb(230, 0, 0); background-color: rgb(255, 255, 0)">red</span> <sub>2</sub><sup>3</sup></p>' +
  '<ol><li data-list="bullet">one</li><li data-list="ordered">two</li></ol>' +
  '<p dir="rtl" class="ql-direction-rtl">مرحبا</p>' +
  '<p><img src="/files/plan.png" alt="plan" width="300" style="display: inline; float: left; margin: 0px 1em 1em 0px"></p>' +
  '<table class="table table-bordered"><tbody><tr><td data-row="row-1a2b" colspan="2">cell</td></tr></tbody></table>' +
  '<pre class="ql-syntax">x = 1</pre><h4>h4</h4><h6>h6</h6><hr>' +
  '<p><a href="/app/todo/T-1">ToDo</a> <a href="https://example.com">site</a> <a href="tel:+100">call</a></p>' +
  '<p><span class="mention" data-id="ann@x.com" data-value="Ann" data-denotation-char="@" data-is-group="false">@Ann</span></p>';

const KEPT = [
  "<h2>Plan</h2>", 'style="text-align: center"', 'class="ql-align-center"', "color: rgb(230, 0, 0)", "background-color: rgb(255, 255, 0)",
  "<sub>2</sub>", "<sup>3</sup>", 'data-list="bullet"', 'data-list="ordered"', 'dir="rtl"', 'class="ql-direction-rtl"',
  'src="/files/plan.png"', 'alt="plan"', 'width="300"', "float: left", 'class="table table-bordered"', 'data-row="row-1a2b"',
  'colspan="2"', '<pre class="ql-syntax">x = 1</pre>', "<h4>h4</h4>", "<h6>h6</h6>", "<hr>", 'href="/app/todo/T-1"',
  'href="https://example.com"', 'href="tel:+100"', 'class="mention"', 'data-id="ann@x.com"', 'data-is-group="false"',
];

describe("C-29 the desk sanitizer profile", () => {
  it("keeps everything Desk's Text Editor stores (headings, colours, alignment, direction, lists, images, tables, code, links, mentions)", () => {
    const out = sanitizeHtml(DESK_HTML, "desk");
    for (const k of KEPT) expect(out, k).toContain(k);
    expect(sanitizeHtml(out, "desk")).toBe(out); // stable when re-sanitized
  });

  it("the default profile is unchanged (no attributes, 18 tags) — the CRM's RichTextEditor sees no change", () => {
    const out = sanitizeHtml(DESK_HTML);
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<table");
    expect(out).not.toContain("style=");
    expect(out).not.toContain("<h2>");
  });

  it("NEGATIVE: scripts, event handlers and unsafe URLs are dropped (href and img src, odd casing, whitespace, entities)", () => {
    const bad = [
      '<img src="x" onerror="alert(1)">',
      '<a href="JaVaScRiPt:alert(1)">a</a>', '<a href=" java\tscript:alert(1)">b</a>', '<a href="&#106;avascript:alert(1)">c</a>',
      '<img src="javascript:alert(1)">', '<img src="data:image/svg+xml;base64,PHN2Zz4=">', '<img src="data:text/html;base64,PGI+">',
      '<img src="/ok.png" srcset="javascript:alert(1) 1x">', '<a href="//evil.example/x">d</a>', '<img src="//evil.example/x.png">',
      "<script>alert(1)</script>", '<iframe src="https://x"></iframe>', "<svg><script>alert(1)</script></svg>",
      '<form action="/x"><input name="q"></form>', '<p onclick="alert(1)" id="x" title="t">t</p>',
    ].join("");
    const out = sanitizeHtml(bad, "desk");
    expect(out).not.toMatch(/javascript|onerror|onclick|srcset|<script|<iframe|<svg|<form|<input|evil\.example|svg\+xml|text\/html|id="x"|title=/i);
    expect(out).toContain('<img src="/ok.png">'); // the safe src stays, srcset goes
  });

  it("NEGATIVE: dangerous or unlisted CSS is dropped, the listed properties stay", () => {
    const out = sanitizeHtml(
      '<p style="color: red; background: url(https://x/t.png); background-image: url(x); width: expression(alert(1)); position: fixed; z-index: 9; top: 0; behavior: url(x.htc); font-size: 18px; color: \\72 ed">x</p>',
      "desk",
    );
    expect(out).toBe('<p style="color: red; font-size: 18px">x</p>');
  });

  it("NEGATIVE: arbitrary classes and data attributes are dropped; Quill's and the mention's stay", () => {
    const out = sanitizeHtml('<p class="ql-indent-1 evil hidden" data-x="1" data-list="bullet">a</p><span class="mention" data-id="u" data-denotation-char="&lt;">x</span>', "desk");
    expect(out).toBe('<p class="ql-indent-1" data-list="bullet">a</p><span class="mention" data-id="u">x</span>');
  });

  it("RichText profile=desk renders the kept content; the default RichText does not", () => {
    const { container } = render(<><div data-t="desk"><RichText value={DESK_HTML} profile="desk" /></div><div data-t="basic"><RichText value={DESK_HTML} /></div></>);
    expect(container.querySelector('[data-t="desk"] img')?.getAttribute("src")).toBe("/files/plan.png");
    expect(container.querySelector('[data-t="desk"] table')).not.toBeNull();
    expect(container.querySelector('[data-t="basic"] img')).toBeNull();
  });
});

describe("C-29 the editor does not lose Desk content", () => {
  it("untouched: no onChange on mount, on a re-render with the same value, or on a new value synced in", () => {
    const log: string[] = [];
    const { rerender } = render(<RichTextEditor value={DESK_HTML} onChange={(h) => log.push(h)} profile="desk" ariaLabel="Body" />);
    rerender(<RichTextEditor value={DESK_HTML} onChange={(h) => log.push(h)} profile="desk" ariaLabel="Body" />);
    rerender(<RichTextEditor value={`${DESK_HTML}<p>more</p>`} onChange={(h) => log.push(h)} profile="desk" ariaLabel="Body" />);
    expect(log).toEqual([]);
  });

  it("after a keystroke the emitted value still holds the images, tables, colours, alignment and links", () => {
    const log: string[] = [];
    render(<RichTextEditor value={DESK_HTML} onChange={(h) => log.push(h)} profile="desk" ariaLabel="Body" />);
    const box = screen.getByRole("textbox", { name: "Body" });
    box.querySelector("h2")!.append(" v2"); // the user types in the heading
    fireEvent.input(box);
    expect(log).toHaveLength(1);
    expect(log[0]).toContain("<h2>Plan v2</h2>");
    for (const k of KEPT.filter((x) => x !== "<h2>Plan</h2>")) expect(log[0], k).toContain(k);
  });
});

describe("C-29 FrappeField Text Editor", () => {
  function mount(value: string, status?: "Read") {
    const transport = createFixtureTransport({ meta: {} });
    const client = createFrappeClient({ transport });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const df = { fieldname: "description", label: "Description", fieldtype: "Text Editor" } as FrappeDocField;
    const log: unknown[] = [];
    function Live() {
      const [v, setV] = React.useState<unknown>(value);
      return <FrappeField df={df} value={v} onChange={(x) => { log.push(x); setV(x); }} status={status} />;
    }
    const utils = render(
      <ThemeProvider defaultTheme="light" defaultLanguage="en" storageKeys={null}>
        <QueryClientProvider client={qc}><FrappeProvider client={client} session={{ user: "Administrator" }}><Live /></FrappeProvider></QueryClientProvider>
      </ThemeProvider>,
    );
    return { ...utils, log };
  }

  it("edit: untouched Desk content is never re-emitted; an edit keeps image, table, colour, alignment and the /app link", () => {
    const { log } = mount(DESK_HTML);
    expect(log).toEqual([]);
    const box = screen.getByRole("textbox", { name: "Description" });
    box.querySelector("h6")!.append("!");
    fireEvent.input(box);
    const out = String(log.at(-1));
    for (const k of ['src="/files/plan.png"', 'class="table table-bordered"', "color: rgb(230, 0, 0)", 'style="text-align: center"', 'href="/app/todo/T-1"', "<h6>h6!</h6>"]) {
      expect(out, k).toContain(k);
    }
  });

  it("read: the stored content is shown with images and tables (desk profile); scripts never reach the page", () => {
    const { container } = mount(`${DESK_HTML}<img src=x onerror="alert(1)"><script>alert(1)</script>`, "Read");
    expect(container.querySelector('img[src="/files/plan.png"]')).not.toBeNull();
    expect(container.querySelector("table td")?.textContent).toBe("cell");
    expect(container.innerHTML).not.toMatch(/onerror|<script/);
  });
});

describe("C-29 review fix: a backslash after the leading slash is not site-relative", () => {
  it("NEGATIVE: /\\evil.example (browsers read it as //evil.example) is dropped from href and img src", () => {
    const out = sanitizeHtml('<a href="/\\evil.example/x">a</a><img src="/\\evil.example/p.png"><a href="/files/ok">b</a>', "desk");
    expect(out).not.toMatch(/evil\.example/);
    expect(out).toContain('href="/files/ok"');
  });
});
