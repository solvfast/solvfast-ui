/**
 * Attach / Attach Image upload (SIMULATED: a stub files transport). Native reference: Frappe 15.110
 * form/controls/attach.js (set_upload_options 70-93, on_upload_complete 137-144), attach_image.js:22 (image/*),
 * FileUploader.vue (is_private = !make_attachments_public, upload_file multipart).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { createFrappeClient, type FrappeFilesTransport, type UploadFileOptions } from "../src/frappe/client";
import { FrappeProvider } from "../src/frappe/FrappeProvider";
import { FrappeField } from "../src/frappe/form";

beforeAll(() => configure({ asyncUtilTimeout: 4000 }));
afterEach(() => cleanup());

type Upload = { file: Blob; filename: string; opts: UploadFileOptions };
function mount(ui: React.ReactNode, upload: (u: Upload) => Promise<Record<string, unknown>>, lang: "en" | "ar" = "en") {
  const files: FrappeFilesTransport = {
    download: async () => { throw new Error("unused"); },
    upload: (file, filename, opts) => upload({ file, filename, opts }) as never,
  };
  const client = createFrappeClient({ transport: async () => ({}), files });
  return render(
    <ThemeProvider defaultTheme="light" defaultLanguage={lang} storageKeys={null}>
      <QueryClientProvider client={new QueryClient()}><FrappeProvider client={client}>{ui}</FrappeProvider></QueryClientProvider>
    </ThemeProvider>,
  );
}
const IMG = { fieldname: "image", fieldtype: "Attach Image", label: "Image" };
const FILE = { fieldname: "doc_file", fieldtype: "Attach", label: "File" };
const DOC = { doctype: "Customer", name: "CUST-0001" };
/** Desk's flow (attach.js:61-64 → FileUploader): "Attach" opens the uploader; pick the file under "My Device"; "Upload". */
const pick = async (name = "logo.png", type = "image/png") => {
  fireEvent.click(screen.getByRole("button", { name: /Attach|إرفاق/ }));
  const dialog = await screen.findByRole("dialog");
  const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')!;
  const file = new File(["x"], name, { type });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Upload" }));
  return { file, dialog, input };
};

describe("Attach / Attach Image upload (SIMULATED)", () => {
  it("uploads through upload_file attached to the saved document (private by default) and stores file_url", async () => {
    const seen: Upload[] = []; const onChange = vi.fn();
    mount(<FrappeField df={IMG} value={null} doc={DOC as never} onChange={onChange} />, async (u) => { seen.push(u); return { file_url: "/private/files/logo.png" }; });
    expect(screen.getByRole("button", { name: /Attach/ })).toBeTruthy();
    const { file, input } = await pick();
    expect(input.getAttribute("accept")).toBe("image/*");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("/private/files/logo.png"));
    expect(seen[0].file).toBe(file);
    expect(seen[0].filename).toBe("logo.png");
    expect(seen[0].opts).toEqual({ doctype: "Customer", docname: "CUST-0001", fieldname: "image", isPrivate: true });
  });

  it("pending: the uploader row says Uploading… and Upload is busy; a refusal is shown on the file and the value is unchanged", async () => {
    let reject!: (e: unknown) => void; const onChange = vi.fn();
    mount(<FrappeField df={FILE} value={null} doc={DOC as never} onChange={onChange} />, () => new Promise((_, rej) => { reject = rej; }));
    const { dialog, input } = await pick("contract.pdf", "application/pdf");
    expect(input.hasAttribute("accept")).toBe(false);
    await waitFor(() => expect(dialog.querySelector('[data-upload-row="contract.pdf"]')?.getAttribute("data-status")).toBe("uploading"));
    expect(within(dialog).getByRole("button", { name: "Upload" }).getAttribute("aria-busy")).toBe("true");
    await act(async () => { reject(new Error("Not permitted")); });
    await waitFor(() => expect(dialog.querySelector('[data-upload-row="contract.pdf"]')?.getAttribute("data-status")).toBe("failed"));
    expect(within(dialog).getByRole("alert").textContent).toContain("Not permitted");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("an unsaved document uploads attached to its new-… name (attach.js:80-87; savedocs relinks it); a public field / DocType uploads public", async () => {
    const seen: Upload[] = [];
    mount(<FrappeField df={{ ...IMG, make_attachment_public: 1 }} value={null} doc={{ doctype: "Customer", name: "new-customer-1" } as never} onChange={() => {}} />,
      async (u) => { seen.push(u); return { file_url: "/files/logo.png" }; });
    await pick();
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0].opts).toEqual({ doctype: "Customer", docname: "new-customer-1", fieldname: "image", isPrivate: false });
  });

  it("with a value: a link to the file (text = the value, attach.js:112), the image preview on focus (Attach Image) and Clear after confirmation", async () => {
    const onChange = vi.fn();
    mount(<FrappeField df={IMG} value="/private/files/logo%20v2.png" doc={DOC as never} onChange={onChange} />, async () => ({}));
    const link = screen.getByRole("link", { name: "/private/files/logo%20v2.png" });
    expect(link.getAttribute("href")).toBe("/private/files/logo%20v2.png");
    act(() => link.focus());
    const img = await screen.findByRole("img", { name: "Preview of logo v2.png" });
    expect(img.getAttribute("src")).toBe("/private/files/logo%20v2.png");
    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Yes" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  });

  it("Arabic labels", () => {
    mount(<FrappeField df={FILE} value={null} doc={DOC as never} onChange={() => {}} />, async () => ({}), "ar");
    expect(screen.getByRole("button", { name: /إرفاق/ })).toBeTruthy();
  });

  it("read-only: the stored file stays a link, no upload control", () => {
    mount(<FrappeField df={{ ...FILE, read_only: 1 }} value="/files/a.pdf" doc={DOC as never} onChange={() => {}} />, async () => ({}));
    expect(document.querySelector('[data-attach-field]')).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/files/a.pdf");
  });
});
