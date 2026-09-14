/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DialogShell } from "../../components/Dialog/DialogShell";
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
  it("sizes its narrow-viewport sheet from sheetSize", () => {
    stubViewportWidth(390);
    render(
      wrap(
        <DialogShell open onOpenChange={vi.fn()} title="Withdraw offer" sheetSize="half">
          <p>Reason field</p>
        </DialogShell>
      )
    );
    expect(screen.getByTestId("dialog-shell")).toHaveAttribute("data-sheet-size", "half");
  });

  it("counts the centered surface as an open sheet so the AppBar steps aside", () => {
    stubViewportWidth(1024);
    useUIStore.setState({ openSheetCount: 0 });
    const view = render(
      wrap(
        <DialogShell open onOpenChange={vi.fn()} title="Garden profile">
          <p>Profile</p>
        </DialogShell>
      )
    );
    expect(useUIStore.getState().openSheetCount).toBe(1);

    view.unmount();
    expect(useUIStore.getState().openSheetCount).toBe(0);
  });

  it("passes its actions to the narrow-viewport sheet", () => {
    stubViewportWidth(390);
    render(
      wrap(
        <DialogShell
          open
          onOpenChange={vi.fn()}
          title="Take This Up…"
          actions={{ primary: { label: "Take This Up" }, secondary: { label: "Cancel" } }}
        >
          <p>Who takes this up</p>
        </DialogShell>
      )
    );
    const sheet = screen.getByTestId("dialog-shell");
    expect(sheet.querySelector('[data-component="SheetActions"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Take This Up" })).toBeInTheDocument();
  });

  it("pins the same actions under the centered surface's scrolling body", () => {
    stubViewportWidth(1024);
    const onCancel = vi.fn();
    render(
      wrap(
        <DialogShell
          open
          onOpenChange={vi.fn()}
          title="Commitment kept?"
          actions={{
            primary: { label: "Confirm It Was Kept" },
            secondary: { label: "Not Yet", onClick: onCancel },
          }}
        >
          <p>Evidence</p>
        </DialogShell>
      )
    );
    const surface = screen.getByRole("dialog", { name: "Commitment kept?" });
    const body = surface.querySelector('[data-component="DialogShell"][data-slot="body"]');
    expect(surface).toHaveAttribute("data-has-actions");
    expect(body).toHaveAttribute("data-scroll-edge", "bottom");
    expect(body?.nextElementSibling).toHaveAttribute("data-component", "SheetActions");
    fireEvent.click(screen.getByRole("button", { name: "Not Yet" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
