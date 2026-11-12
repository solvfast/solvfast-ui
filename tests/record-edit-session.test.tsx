/** RecordEditSession, RecordEditableCard, RecordNotSavedPill, RecordSaveButton and the About cards (0.8.0-dev.2). */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Percent, Phone, TrendingUp } from "lucide-react";
import {
  RecordEditSession, RecordEditableCard, RecordNotSavedPill, RecordSaveButton, useRecordEditSession, RecordInfoTile, RecordInfoRow, RecordScoreRing,
  RecordFieldList, RecordInsightCard, RecordClosedNotice, RecordInteractions, RecordField, RecordFieldGrid, ThemeProvider,
} from "../src";

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  const proto = Element.prototype as unknown as Record<string, unknown>;
  for (const m of ["scrollIntoView", "setPointerCapture", "releasePointerCapture"]) proto[m] ??= () => {};
  proto.hasPointerCapture ??= () => false;
});
afterEach(cleanup);
const wrap = (ui: React.ReactElement, language: "en" | "ar" = "en") => render(<ThemeProvider language={language}>{ui}</ThemeProvider>);

/** A card with one text input; `value` is its draft. */
function Field({ id, label, initial = "", refuse = false, focus }: { id: string; label: string; initial?: string; refuse?: boolean; focus?: () => void }) {
  const [v, setV] = React.useState(initial);
  return (
    <RecordEditableCard cardId={id} label={label} onSave={() => {}} onCancel={() => setV(initial)}
      getPatch={() => (refuse || !v ? (focus?.(), false) : { [id]: v })}
      renderEdit={({ markDirty }) => <input aria-label={`${label} input`} value={v} onChange={(e) => { setV(e.target.value); markDirty(); }} />}>
      <p>{label}: {v}</p>
    </RecordEditableCard>
  );
}
function Guarded({ onLeave }: { onLeave: () => void }) {
  const s = useRecordEditSession();
  return <button onClick={() => s?.guard(onLeave)}>Leave</button>;
}

describe("RecordEditSession — page-level Save", () => {
  const page = (commit: (m: Record<string, unknown>) => boolean | Promise<boolean>, extra: Partial<React.ComponentProps<typeof RecordEditSession>> = {}) => (
    <RecordEditSession pageSave commit={commit} {...extra}>
      <RecordSaveButton /><RecordNotSavedPill />
      <Field id="value" label="Value" initial="1" /><Field id="close" label="Close" initial="2026" />
    </RecordEditSession>
  );

  it("many cards edit at once; one Save merges their patches into one commit; Saved; clean again", async () => {
    const commit = vi.fn(async () => true); const notify = vi.fn(); const onSaved = vi.fn(); const dirty = vi.fn();
    wrap(page(commit, { notify, onSaved, onDirtyChange: dirty }));
    const save = screen.getByRole("button", { name: "Save" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getByLabelText("Value input"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Close input"), { target: { value: "2027" } });
    expect(screen.getByText("Not saved")).toBeTruthy();
    expect(dirty).toHaveBeenLastCalledWith(true);
    fireEvent.click(save);
    await waitFor(() => expect(commit).toHaveBeenCalledTimes(1));
    expect(commit).toHaveBeenCalledWith({ value: "5", close: "2027" });
    await waitFor(() => expect(notify).toHaveBeenCalledWith("saved", "Saved"));
    expect(onSaved).toHaveBeenCalledWith(["Value", "Close"]);
    expect(screen.queryByText("Not saved")).toBeNull();
    expect(screen.queryByLabelText("Value input")).toBeNull();
  });

  it("a refusing region stops the save (focus, no commit); a throwing commit gets the error notice", async () => {
    const focus = vi.fn(); const commit = vi.fn(async () => true);
    const { unmount } = wrap(<RecordEditSession pageSave commit={commit}><RecordSaveButton /><Field id="v" label="V" refuse focus={focus} /></RecordEditSession>);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("V input"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(focus).toHaveBeenCalled());
    expect(commit).not.toHaveBeenCalled();
    unmount();
    const notify = vi.fn();
    wrap(page(async () => { throw new Error("boom"); }, { notify }));
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getByLabelText("Value input"), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("error", "Couldn't save. Try again."));
    expect(screen.getByText("Not saved")).toBeTruthy();
  });

  it("leaving while dirty asks: Keep editing stays, Discard resets and leaves, Save and leave saves then leaves", async () => {
    const commit = vi.fn(async () => true); const leave = vi.fn();
    wrap(<RecordEditSession pageSave commit={commit}><Guarded onLeave={leave} /><RecordNotSavedPill /><Field id="v" label="V" initial="1" /></RecordEditSession>);
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(leave).toHaveBeenCalledTimes(1); // clean: leaves at once
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("V input"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    let dlg = screen.getByRole("alertdialog");
    expect(within(dlg).getByText("You have unsaved changes")).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Keep editing" }));
    expect(leave).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Not saved")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Discard" }));
    expect(leave).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Not saved")).toBeNull();
    expect(screen.getByText("V: 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("V input"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    dlg = screen.getByRole("alertdialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Save and leave" }));
    await waitFor(() => expect(leave).toHaveBeenCalledTimes(3));
    expect(commit).toHaveBeenCalledWith({ v: "3" });
  });

  it("Ctrl/Cmd+S saves", async () => {
    const commit = vi.fn(async () => true);
    wrap(page(commit));
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getByLabelText("Value input"), { target: { value: "7" } });
    await act(async () => { fireEvent.keyDown(window, { key: "s", ctrlKey: true }); });
    await waitFor(() => expect(commit).toHaveBeenCalledWith({ value: "7" }));
  });

  it("a closed record: no Edit, unless the card is editable when closed", () => {
    wrap(<RecordEditSession pageSave closed commit={() => true}>
      <RecordEditableCard cardId="a" label="A" onSave={() => {}} renderEdit={() => null}><p>a</p></RecordEditableCard>
      <RecordEditableCard cardId="b" label="B" editableWhenClosed onSave={() => {}} renderEdit={() => null}><p>b</p></RecordEditableCard>
    </RecordEditSession>);
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });

  it("a host can render its own prompt (renderUnsavedDialog) and gets Arabic text from the provider", () => {
    const leave = vi.fn();
    wrap(<RecordEditSession pageSave commit={() => true} renderUnsavedDialog={(d) => d.open ? (
      <div role="dialog" aria-label={d.title}><p>{d.body}</p><button onClick={d.onDiscard}>{d.discardLabel}</button></div>) : null}>
      <Guarded onLeave={leave} /><Field id="v" label="V" initial="1" />
    </RecordEditSession>, "ar");
    fireEvent.click(screen.getByRole("button", { name: "تعديل" }));
    fireEvent.change(screen.getByLabelText("V input"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    const d = screen.getByRole("dialog", { name: "لديك تغييرات غير محفوظة" });
    fireEvent.click(within(d).getByRole("button", { name: "تجاهل" }));
    expect(leave).toHaveBeenCalled();
  });
});

describe("RecordEditSession — single card", () => {
  it("one card at a time; it saves itself; switching while dirty names the card", () => {
    const saveA = vi.fn();
    wrap(<RecordEditSession>
      <RecordEditableCard cardId="a" label="Profile" onSave={saveA} renderEdit={({ markDirty }) => <input aria-label="a" onChange={markDirty} />}><p>a</p></RecordEditableCard>
      <RecordEditableCard cardId="b" label="Notes" onSave={() => {}} renderEdit={() => <input aria-label="b" />}><p>b</p></RecordEditableCard>
    </RecordEditSession>);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("a"), { target: { value: "x" } });
    expect(save.disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Edit" })); // the other card
    expect(within(screen.getByRole("alertdialog")).getByText("You have unsaved changes in Profile.")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Save" }));
    expect(saveA).toHaveBeenCalled();
    expect(screen.getByLabelText("b")).toBeTruthy();
  });
});

describe("RecordEditableCard without a session", () => {
  it("edits on its own: labelled Edit, Save enabled once dirty, Save / Cancel close it", () => {
    const save = vi.fn();
    wrap(<RecordEditableCard cardId="a" label="Notes" onSave={save} renderEdit={({ markDirty }) => <input aria-label="n" onChange={markDirty} />}><p>read</p></RecordEditableCard>);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const s = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(s.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("n"), { target: { value: "x" } });
    expect(s.disabled).toBe(false);
    fireEvent.click(s);
    expect(save).toHaveBeenCalled();
    expect(screen.getByText("read")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("read")).toBeTruthy();
  });
});

describe("About cards", () => {
  it("info tile, info row (— when empty), field list (empty label), insight card, closed notice", () => {
    const { container } = wrap(<>
      <RecordInfoTile label="Probability" icon={Percent} tone="border-border/60"><span>x</span></RecordInfoTile>
      <RecordInfoRow icon={TrendingUp} label="Expected Value" value="12,500,000 USD" dir="ltr" tone="bg-success/10 text-success" />
      <RecordInfoRow icon={TrendingUp} label="Weighted" value="" />
      <RecordFieldList emptyLabel="— Not provided" items={[{ id: "a", label: "Country", value: "Saudi Arabia" }, { id: "b", label: "Tier" }]} />
      <RecordInsightCard icon={<span>i</span>} title="Deal summary" subtitle="Updated just now"><p>text</p></RecordInsightCard>
      <RecordClosedNotice>This record is closed.</RecordClosedNotice>
    </>);
    expect(container.querySelector("[data-record-tile]")!.className).toBe("rounded-lg border p-3 border-border/60");
    expect(screen.getByText("12,500,000 USD").getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText("— Not provided")).toBeTruthy();
    expect(screen.getByText("Updated just now")).toBeTruthy();
    expect(screen.getByText("This record is closed.").className).toContain("border-amber-300");
  });

  it("score ring: the number, a compact ring at ≤ 64 px, clamped arc", () => {
    const { container } = wrap(<><RecordScoreRing value={75} color="red" size={64} /><RecordScoreRing value={140} color="red" /></>);
    const [small, big] = Array.from(container.querySelectorAll("[data-record-score]"));
    expect(small.textContent).toBe("75%");
    expect(small.querySelectorAll("circle")[1].getAttribute("stroke-width")).toBe("5");
    expect(big.querySelectorAll("circle")[1].getAttribute("stroke-width")).toBe("12");
    expect(Number(big.querySelectorAll("circle")[1].getAttribute("stroke-dashoffset"))).toBeCloseTo(0);
  });

  it("interactions: two columns, at most 4 rows each, a row opens to its body, empty column text, Arabic chrome", () => {
    const row = (i: number) => ({ id: `r${i}`, title: `Call ${i}`, when: "Apr 24", channel: "Phone", preview: "p", body: `body ${i}`, icon: Phone });
    wrap(<RecordInteractions inbound={[1, 2, 3, 4, 5].map(row)} outbound={[]} />, "ar");
    expect(screen.getByText("التفاعلات الأخيرة")).toBeTruthy();
    expect(screen.getByText("لا توجد تفاعلات بعد")).toBeTruthy();
    const inbound = document.querySelector("[data-record-interactions-col='inbound']")!;
    expect(within(inbound as HTMLElement).getAllByRole("button")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /Call 1/ }));
    expect(screen.getByText("body 1")).toBeTruthy();
  });
});

describe("RecordField / RecordFieldGrid", () => {
  it("a small label tied to its control, a red star when required, the two-column grid", () => {
    const { container } = wrap(<RecordFieldGrid><RecordField label="Value (USD)" htmlFor="v" required><input id="v" /></RecordField><RecordField label="Close" htmlFor="c"><input id="c" /></RecordField></RecordFieldGrid>);
    expect(container.firstElementChild!.className).toBe("grid grid-cols-1 md:grid-cols-2 gap-4");
    expect(screen.getByLabelText(/Value \(USD\)/).id).toBe("v");
    const star = container.querySelector("[data-record-field] label span")!;
    expect(star.textContent).toBe("*"); expect(star.className).toContain("text-destructive");
    expect(container.querySelectorAll("label span")).toHaveLength(1);
  });
});
