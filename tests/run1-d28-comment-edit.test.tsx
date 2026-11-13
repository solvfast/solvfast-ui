/**
 * Run 1 · D-28 (P1, data loss) — editing a comment keeps its formatting, links, images and mentions (Desk edits in its
 * rich comment control, form_timeline.js:607-675). Before: HTML → plain text → escaped HTML. jsdom: typing is simulated
 * by changing the contenteditable's DOM and firing `input`; the caret is set with the Selection API — not browser
 * evidence.
 */
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { CommentRichEditor, Timeline, type TimelineItem } from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);

const NOW = Date.UTC(2026, 10, 13, 12);
const RICH = '<p><b>bold</b> <i>it</i> <a href="https://example.com/x">link</a> <a href="/app/todo/T-1">todo</a></p>'
  + '<ol><li data-list="bullet">one</li></ol><p><img src="/files/shot.png" alt="shot"></p>'
  + '<p>cc <span class="mention" data-id="bob@x.com">@Bob</span></p>';
const wrap = (ui: React.ReactNode, lang: "en" | "ar" = "en") => render(<ThemeProvider defaultLanguage={lang} storageKeys={null}>{ui}</ThemeProvider>);
const item = (body: string, extra: Partial<TimelineItem> = {}): TimelineItem => ({ id: "c1", kind: "comment", at: NOW - 3600_000, actor: "Ann", body, canEdit: true, ...extra });
const typeInto = (box: HTMLElement, text: string) => { box.appendChild(document.createTextNode(text)); fireEvent.input(box); };

describe("D-28 rich comment edit", () => {
  it("editing a formatted comment keeps bold, italic, links (absolute and /app), lists, images and the mention", async () => {
    const edit = vi.fn().mockResolvedValue(undefined);
    wrap(<Timeline items={[item(RICH)]} onEditComment={edit} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const box = within(document.getElementById("comment-c1")!).getByRole("textbox");
    expect(box.querySelector("img")?.getAttribute("src")).toBe("/files/shot.png");
    typeInto(box, " — edited");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(edit).toHaveBeenCalled());
    const html = String(edit.mock.calls[0][1]);
    for (const k of ["<b>bold</b>", "<i>it</i>", 'href="https://example.com/x"', 'href="/app/todo/T-1"', 'data-list="bullet"', 'src="/files/shot.png"',
      'class="mention"', 'data-id="bob@x.com"', "— edited"]) expect(html, k).toContain(k);
  });

  it("an image-only comment can be edited and saved (not 'empty')", async () => {
    const edit = vi.fn().mockResolvedValue(undefined);
    wrap(<Timeline items={[item('<p><img src="/files/only.png"></p>')]} onEditComment={edit} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(edit).toHaveBeenCalled());
    expect(String(edit.mock.calls[0][1])).toContain('src="/files/only.png"');
  });

  it("NEGATIVE: unsafe markup in a stored comment never reaches the editor nor the saved value", async () => {
    const edit = vi.fn().mockResolvedValue(undefined);
    wrap(<Timeline items={[item('<p>ok<img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a></p><script>alert(1)</script>')]} onEditComment={edit} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const box = within(document.getElementById("comment-c1")!).getByRole("textbox");
    expect(box.innerHTML).not.toMatch(/onerror|javascript|<script/);
    typeInto(box, "!");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(edit).toHaveBeenCalled());
    expect(String(edit.mock.calls[0][1])).not.toMatch(/onerror|javascript|<script/);
  });

  it("a server refusal keeps the editor open with the message; Cancel and Escape leave without saving", async () => {
    const edit = vi.fn().mockRejectedValue(new Error("Not permitted"));
    wrap(<Timeline items={[item(RICH)]} onEditComment={edit} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Not permitted"));
    expect(document.querySelector("[data-comment-editor=rich]")).not.toBeNull();
    fireEvent.keyDown(within(document.getElementById("comment-c1")!).getByRole("textbox"), { key: "Escape" });
    expect(document.querySelector("[data-comment-editor=rich]")).toBeNull();
    expect(edit).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+Enter saves", async () => {
    const edit = vi.fn().mockResolvedValue(undefined);
    wrap(<Timeline items={[item("<p>x</p>")]} onEditComment={edit} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.keyDown(within(document.getElementById("comment-c1")!).getByRole("textbox"), { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(edit).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }), "<p>x</p>"));
  });

  it("@ in the editor offers mentions; picking one inserts Desk's mention span at the caret", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    wrap(<CommentRichEditor initialHtml="<p>hi</p>" onSubmit={onSubmit} onCancel={() => {}} searchMentions={async () => [{ id: "ann@x.com", label: "Ann" }]} />);
    const box = screen.getByRole("textbox");
    const text = box.querySelector("p")!.firstChild as Text;
    text.nodeValue = "hi @An";
    const sel = window.getSelection()!; const r = document.createRange(); r.setStart(text, 6); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
    fireEvent.input(box);
    fireEvent.mouseDown(await screen.findByRole("option", { name: "@Ann" }));
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(String(onSubmit.mock.calls[0][0])).toMatch(/^<p>hi <span class="mention" data-id="ann@x.com">@Ann<\/span>/);
  });

  it("a plain-text comment (bodyFormat text) keeps the plain composer", () => {
    wrap(<Timeline items={[item("plain words", { bodyFormat: "text" })]} onEditComment={() => {}} now={NOW} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("plain words");
    expect(document.querySelector("[data-comment-editor=rich]")).toBeNull();
  });

  it("Arabic: the editor's buttons are labelled from the catalogue", () => {
    wrap(<Timeline items={[item("<p>x</p>")]} onEditComment={() => {}} now={NOW} />, "ar");
    fireEvent.click(screen.getAllByRole("button").find((b) => b.getAttribute("aria-label") && /تعديل/.test(b.getAttribute("aria-label")!))!);
    expect(document.querySelector("[data-comment-editor=rich]")).not.toBeNull();
    expect(screen.getByRole("toolbar").getAttribute("aria-label")).not.toBe("Text formatting");
  });
});
