/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog, DialogShell } from "../../components/Dialog/ConfirmDialog";

const messages = {
  "app.common.cancel": "Cancel",
  "app.common.close": "Close",
  "app.common.confirm": "Confirm",
};

/** Mirror the viewport the shared dialogs switch on (`PWA_SHEET_MEDIA_QUERY`). */
function stubViewportWidth(widthPx: number) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("max-width: 639px") ? widthPx <= 639 : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function wrap(node: React.ReactElement) {
  return (
    <IntlProvider locale="en" messages={messages}>
      {node}
    </IntlProvider>
  );
}

afterEach(() => {
  stubViewportWidth(1024);
});

describe("ConfirmDialog", () => {
  it("keeps the centered Radix surface at 640px and wider", () => {
    stubViewportWidth(1024);
    render(
      wrap(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} title="Leave page?" />)
    );
    const surface = screen.getByTestId("confirm-dialog");
    expect(surface).toHaveAttribute("data-component", "ConfirmDialog");
    expect(screen.queryByTestId("confirm-dialog-drag-handle")).not.toBeInTheDocument();
    expect(screen.getByTestId("confirm-dialog-close")).toBeInTheDocument();
  });

  it("renders the shared bottom sheet below 640px and routes every action", () => {
    stubViewportWidth(390);
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const onClose = vi.fn();
    render(
      wrap(
        <ConfirmDialog
          isOpen
          onClose={onClose}
          onConfirm={onConfirm}
          onCancel={onCancel}
          title="Delete Draft?"
          description="This cannot be undone."
          confirmLabel="Delete"
          variant="danger"
        />
      )
    );
    const dialog = screen.getByRole("alertdialog", { name: "Delete Draft?" });
    expect(dialog).toHaveAttribute("data-component", "PwaSheet");
    expect(dialog).toHaveAttribute("data-testid", "confirm-dialog");
    expect(dialog).toHaveAccessibleDescription("This cannot be undone.");
    expect(screen.getByTestId("confirm-dialog-drag-handle")).toBeInTheDocument();
    expect(screen.queryByTestId("confirm-dialog-close")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTestId("pwa-sheet-close"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("blocks dismissal of the sheet while loading", () => {
    stubViewportWidth(390);
    const onClose = vi.fn();
    render(
      wrap(
        <ConfirmDialog
          isOpen
          onClose={onClose}
          onConfirm={vi.fn()}
          title="Sending"
          confirmLabel="Send"
          isLoading
        />
      )
    );
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("pwa-sheet-close")).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("confirm-dialog-overlay"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("DialogShell", () => {
  it("renders the shared bottom sheet below 640px with the shell's header", () => {
    stubViewportWidth(390);
    const onOpenChange = vi.fn();
    render(
      wrap(
        <DialogShell
          open
          onOpenChange={onOpenChange}
          title="Withdraw offer"
          description="Tell the garden why."
        >
          <p>Reason field</p>
        </DialogShell>
      )
    );
    const dialog = screen.getByRole("dialog", { name: "Withdraw offer" });
    expect(dialog).toHaveAttribute("data-component", "PwaSheet");
    expect(dialog).toHaveAttribute("data-testid", "dialog-shell");
    expect(dialog).toHaveAccessibleDescription("Tell the garden why.");
    expect(screen.getByText("Reason field").parentElement).toHaveAttribute("data-slot", "body");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("honors preventClose and hideCloseButton on the sheet", () => {
    stubViewportWidth(390);
    const onOpenChange = vi.fn();
    render(
      wrap(
        <DialogShell
          open
          onOpenChange={onOpenChange}
          title="Linking work"
          preventClose
          hideCloseButton
        >
          <p>Working…</p>
        </DialogShell>
      )
    );
    expect(screen.queryByTestId("pwa-sheet-close")).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("dialog-shell-overlay"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("keeps the centered Radix surface at 640px and wider", () => {
    stubViewportWidth(1024);
    render(
      wrap(
        <DialogShell open onOpenChange={vi.fn()} title="Garden profile">
          <p>Fields</p>
        </DialogShell>
      )
    );
    const dialog = screen.getByRole("dialog", { name: "Garden profile" });
    expect(dialog).toHaveAttribute("data-component", "DialogShell");
    expect(screen.queryByTestId("dialog-shell-drag-handle")).not.toBeInTheDocument();
  });
});
