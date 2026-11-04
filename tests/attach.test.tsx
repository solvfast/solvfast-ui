/**
 * Attach / Attach Image upload (SIMULATED: a stub files transport). Native reference: Frappe 15.110
 * form/controls/attach.js (set_upload_options 70-93, on_upload_complete 137-144), attach_image.js:22 (image/*),
 * FileUploader.vue (is_private = !make_attachments_public, upload_file multipart).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const pick = (name = "logo.png", type = "image/png") => {
  const input = document.querySelector<HTMLInputElement>('[data-attach-field] input[type="file"]')!;
  const file = new File(["x"], name, { type });
  fireEvent.change(input, { target: { files: [file] } });
  return file;
};

describe("Attach / Attach Image upload (SIMULATED)", () => {
  it("uploads through upload_file attached to the saved document (private by default) and stores file_url", async () => {
    const seen: Upload[] = []; const onChange = vi.fn();
    mount(<FrappeField df={IMG} value={null} doc={DOC as never} onChange={onChange} />, async (u) => { seen.push(u); return { file_url: "/private/files/logo.png" }; });
    expect(screen.getByRole("button", { name: /Attach/ })).toBeTruthy();
    const input = document.querySelector<HTMLInputElement>('[data-attach-field] input[type="file"]')!;
    expect(input.getAttribute("accept")).toBe("image/*");
    const file = pick();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("/private/files/logo.png"));
    expect(seen[0].file).toBe(file);
    expect(seen[0].filename).toBe("logo.png");
    expect(seen[0].opts).toEqual({ doctype: "Customer", docname: "CUST-0001", fieldname: "image", isPrivate: true });
  });

  it("pending: the button is disabled and says Uploading…; a refusal is shown and the value is unchanged", async () => {
    let reject!: (e: unknown) => void; const onChange = vi.fn();
    mount(<FrappeField df={FILE} value={null} doc={DOC as never} onChange={onChange} />, () => new Promise((_, rej) => { reject = rej; }));
    const input = document.querySelector<HTMLInputElement>('[data-attach-field] input[type="file"]')!;
    expect(input.hasAttribute("accept")).toBe(false);
    pick("contract.pdf", "application/pdf");
    const button = await screen.findByRole("button", { name: /Uploading/ });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    await act(async () => { reject(new Error("Not permitted")); });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("could not be uploaded");
    expect(alert.textContent).toContain("Not permitted");
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Attach/ }).hasAttribute("disabled")).toBe(false);
  });

  it("an unsaved document uploads an unattached file; a public field / DocType uploads public", async () => {
    const seen: Upload[] = [];
    mount(<FrappeField df={{ ...IMG, make_attachment_public: 1 }} value={null} doc={{ doctype: "Customer", name: "new-customer-1" } as never} onChange={() => {}} />,
      async (u) => { seen.push(u); return { file_url: "/files/logo.png" }; });
    pick();
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0].opts).toEqual({ isPrivate: false });
  });

  it("with a value: a link to the file, the image preview (Attach Image) and Clear", () => {
    const onChange = vi.fn();
    mount(<FrappeField df={IMG} value="/private/files/logo%20v2.png" doc={DOC as never} onChange={onChange} />, async () => ({}));
    const link = screen.getByRole("link", { name: "logo v2.png" });
    expect(link.getAttribute("href")).toBe("/private/files/logo%20v2.png");
    expect(document.querySelector('[data-attach-field] img')?.getAttribute("src")).toBe("/private/files/logo%20v2.png");
    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(onChange).toHaveBeenCalledWith(null);
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
