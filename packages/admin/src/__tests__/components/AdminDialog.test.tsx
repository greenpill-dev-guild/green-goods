import { RiSearchLine } from "@remixicon/react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen } from "../test-utils";
import { AdminButton } from "../../components/AdminButton";
import { AdminConfirmDialog, AdminDialog } from "../../components/AdminDialog";

describe("AdminDialog", () => {
  it("renders the standard desktop/mobile contract attributes with pinned actions", () => {
    renderWithProviders(
      <AdminDialog
        open
        onOpenChange={vi.fn()}
        title="Edit domains"
        description="Choose supported work domains"
        actions={
          <>
            <AdminButton variant="text">Cancel</AdminButton>
            <AdminButton>Save</AdminButton>
          </>
        }
      >
        <p>Domain form body</p>
      </AdminDialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Edit domains" });
    expect(dialog).toHaveAttribute("data-component", "AdminDialog");
    expect(dialog).toHaveAttribute("data-variant", "standard");
    expect(dialog).toHaveAttribute("data-mobile", "sheet");
    expect(dialog).toHaveAttribute("aria-describedby");
    expect(dialog.className).toContain("bottom-0");
    expect(dialog.className).toContain("sm:top-1/2");
    expect(dialog.className).toContain("sm:-translate-y-1/2");
    expect(
      document.getElementById(dialog.getAttribute("aria-describedby") ?? "")
    ).toHaveTextContent("Choose supported work domains");
    expect(screen.getByTestId("admin-dialog-body")).toHaveTextContent("Domain form body");
    expect(screen.getByTestId("admin-dialog-actions")).toContainElement(
      screen.getByRole("button", { name: "Save" })
    );
  });

  it("uses the palette variant for command search surfaces", () => {
    renderWithProviders(
      <AdminDialog
        open
        onOpenChange={vi.fn()}
        title="Command palette"
        variant="palette"
        hideCloseButton
        icon={RiSearchLine}
      >
        <input aria-label="Search commands" />
      </AdminDialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Command palette" });
    expect(dialog).toHaveAttribute("data-variant", "palette");
    expect(dialog).toHaveClass("admin-dialog--palette");
    expect(screen.getByLabelText("Search commands")).toBeInTheDocument();
  });

  it("prevents overlay and escape close while a blocking action is pending", () => {
    const onOpenChange = vi.fn();

    renderWithProviders(
      <AdminDialog open onOpenChange={onOpenChange} title="Blocking dialog" preventClose>
        <p>Pending</p>
      </AdminDialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Blocking dialog" });
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("AdminConfirmDialog", () => {
  it("renders confirmation copy and calls confirm without closing through custom footer markup", async () => {
    const onConfirm = vi.fn();

    renderWithProviders(
      <AdminConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Emergency pause"
        description="Pause this vault?"
        confirmLabel="Pause"
        cancelLabel="Cancel"
        variant="danger"
      />
    );

    expect(screen.getByRole("alertdialog", { name: "Emergency pause" })).toBeInTheDocument();
    expect(screen.getByText("Pause this vault?")).toBeInTheDocument();

    screen.getByRole("button", { name: "Pause" }).click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("locks confirmation dialogs while loading", () => {
    renderWithProviders(
      <AdminConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Emergency pause"
        description="Pause this vault?"
        confirmLabel="Pause"
        cancelLabel="Cancel"
        variant="danger"
        isLoading
      />
    );

    expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  });
});
