import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "../src/theme/ThemeProvider";
import { UnsavedChangesDialog } from "../src/frappe/form";

const open = (props: Partial<React.ComponentProps<typeof UnsavedChangesDialog>> = {}) => {
  const calls = { save: vi.fn(), discard: vi.fn(), stay: vi.fn() };
  render(
    <ThemeProvider defaultLanguage="en">
      <UnsavedChangesDialog open onSave={calls.save} onDiscard={calls.discard} onStay={calls.stay} {...props} />
    </ThemeProvider>,
  );
  return calls;
};

describe("UnsavedChangesDialog — leaving with unsaved changes", () => {
  it("UC.1 offers Save and leave, Discard and Keep editing, each answering once", () => {
    const calls = open();
    expect(screen.getByText("You have unsaved changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save and leave" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect([calls.save.mock.calls.length, calls.discard.mock.calls.length, calls.stay.mock.calls.length]).toEqual([1, 1, 1]);
  });

  it("UC.2 while saving, Discard and Keep editing wait", () => {
    open({ saving: true });
    expect((screen.getByRole("button", { name: "Discard" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Keep editing" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
