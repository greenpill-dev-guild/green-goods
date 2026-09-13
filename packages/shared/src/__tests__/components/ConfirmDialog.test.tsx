/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../../components/Dialog/ConfirmDialog";
import { useUIStore } from "../../stores/useUIStore";

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
  it("renders confirmations as compact sheets below 640px", () => {
    stubViewportWidth(390);
    render(
      wrap(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} title="Delete draft?" />)
    );
    expect(screen.getByTestId("confirm-dialog")).toHaveAttribute("data-sheet-size", "compact");
  });

  it("counts every open confirmation once, sheet or centered", () => {
    useUIStore.setState({ openSheetCount: 0 });
    stubViewportWidth(390);
    const sheet = render(
      wrap(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} title="Delete draft?" />)
    );
    expect(useUIStore.getState().openSheetCount).toBe(1);
    sheet.unmount();

    stubViewportWidth(1024);
    const centered = render(
      wrap(<ConfirmDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} title="Delete draft?" />)
    );
    expect(useUIStore.getState().openSheetCount).toBe(1);
    centered.unmount();
    expect(useUIStore.getState().openSheetCount).toBe(0);
  });

  it("renders both presentations' buttons through the shared action bar", () => {
    stubViewportWidth(1024);
    const onCancel = vi.fn();
    const onClose = vi.fn();
    render(
      wrap(
        <ConfirmDialog
          isOpen
          onClose={onClose}
          onConfirm={vi.fn()}
          onCancel={onCancel}
          title="Delete Draft?"
          confirmLabel="Delete"
          variant="danger"
        />
      )
    );
    const bar = screen
      .getByTestId("confirm-dialog")
      .querySelector('[data-component="SheetActions"]');
    expect(bar).not.toBeNull();
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveAttribute("data-action", "primary");
    expect(confirm).toHaveClass("gg-button-danger");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps a loading confirm focusable instead of dropping focus", () => {
    stubViewportWidth(390);
    const onConfirm = vi.fn();
    render(
      wrap(
        <ConfirmDialog
          isOpen
          onClose={vi.fn()}
          onConfirm={onConfirm}
          title="Sending"
          confirmLabel="Send"
          isLoading
        />
      )
    );
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).not.toBeDisabled();
    expect(send).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(send);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });
});
