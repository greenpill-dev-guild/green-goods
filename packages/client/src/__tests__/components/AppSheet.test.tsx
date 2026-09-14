/** @vitest-environment jsdom */

import { act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { renderWithProviders, screen } from "../test-utils";

describe("AppSheet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.classList.remove("modal-open");
  });
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove("modal-open");
  });

  it("renders tabs and keeps panel interactions inside the sheet", () => {
    const onClose = vi.fn();
    const onTabChange = vi.fn();
    renderWithProviders(
      <AppSheet
        size="full"
        isOpen
        onClose={onClose}
        header={{ title: "Commitments", description: "Rocinha" }}
        tabs={[
          { id: "open", label: "Open", count: 4 },
          { id: "kept", label: "Kept" },
        ]}
        activeTab="open"
        onTabChange={onTabChange}
      >
        <button type="button">Inside action</button>
      </AppSheet>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Open4" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Kept" }));
    expect(onTabChange).toHaveBeenCalledWith("kept");
    fireEvent.click(screen.getByRole("button", { name: "Inside action" }));
    act(() => vi.runAllTimers());
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(["close button", "overlay", "Escape"])("closes from the %s", (path) => {
    const onClose = vi.fn();
    renderWithProviders(
      <AppSheet size="compact" isOpen onClose={onClose} header={{ title: "Commitments" }}>
        Content
      </AppSheet>
    );
    const overlay = screen.getByTestId("app-sheet-overlay");

    if (path === "close button") fireEvent.click(screen.getByTestId("app-sheet-close"));
    if (path === "overlay") fireEvent.click(overlay);
    if (path === "Escape") fireEvent.keyDown(overlay, { key: "Escape" });
    act(() => vi.runAllTimers());

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes from Escape while focus is inside the dialog", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <AppSheet size="compact" isOpen onClose={onClose} header={{ title: "Commitments" }}>
        Content
      </AppSheet>
    );
    const closeButton = screen.getByTestId("app-sheet-close");
    closeButton.focus();

    fireEvent.keyDown(closeButton, { key: "Escape" });
    act(() => vi.runAllTimers());

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays unmounted while closed", () => {
    renderWithProviders(
      <AppSheet size="compact" isOpen={false} onClose={vi.fn()} header={{ title: "Commitments" }}>
        Content
      </AppSheet>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the document locked until the final overlapping sheet closes", () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const view = renderWithProviders(
      <>
        <AppSheet size="compact" isOpen onClose={firstClose} header={{ title: "First sheet" }}>
          First
        </AppSheet>
        <AppSheet size="compact" isOpen onClose={secondClose} header={{ title: "Second sheet" }}>
          Second
        </AppSheet>
      </>
    );

    expect(document.documentElement).toHaveClass("modal-open");

    view.rerender(
      <>
        <AppSheet
          size="compact"
          isOpen={false}
          onClose={firstClose}
          header={{ title: "First sheet" }}
        >
          First
        </AppSheet>
        <AppSheet size="compact" isOpen onClose={secondClose} header={{ title: "Second sheet" }}>
          Second
        </AppSheet>
      </>
    );

    expect(document.documentElement).toHaveClass("modal-open");

    view.unmount();
    expect(document.documentElement).not.toHaveClass("modal-open");
  });

  it("finishes an interrupted close immediately when the page is hidden", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <AppSheet size="compact" isOpen onClose={onClose} header={{ title: "Commitments" }}>
        Content
      </AppSheet>
    );

    fireEvent.click(screen.getByTestId("app-sheet-close"));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.documentElement).toHaveClass("modal-open");

    act(() => window.dispatchEvent(new Event("pagehide")));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("names its height tier and owns scrolling when it has no tabs", () => {
    renderWithProviders(
      <AppSheet size="tall" isOpen onClose={vi.fn()} header={{ title: "Notifications" }}>
        <p>Content</p>
      </AppSheet>
    );
    const panel = screen.getByTestId("app-sheet");
    expect(panel).toHaveAttribute("data-sheet-size", "tall");
    expect(panel).not.toHaveAttribute("style");
    const region = screen.getByText("Content").parentElement;
    expect(region).toHaveClass("overflow-y-auto");
    expect(region?.querySelector(".overflow-y-auto")).toBeNull();
  });

  it("leaves scrolling to the tab content in a full-height tabbed sheet", () => {
    renderWithProviders(
      <AppSheet
        size="full"
        isOpen
        onClose={vi.fn()}
        header={{ title: "Wallet" }}
        tabs={[{ id: "send", label: "Send" }]}
        activeTab="send"
        onTabChange={vi.fn()}
        contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
      >
        <p>Content</p>
      </AppSheet>
    );
    expect(screen.getByTestId("app-sheet")).toHaveAttribute("data-sheet-size", "full");
    expect(screen.getByRole("tabpanel")).not.toHaveClass("overflow-y-auto");
  });

  it("renders into <body> and counts as an open sheet so the AppBar steps aside", () => {
    useUIStore.setState({ openSheetCount: 0 });
    const view = renderWithProviders(
      <div data-testid="garden-header" style={{ position: "absolute", zIndex: 20 }}>
        <AppSheet size="tall" isOpen onClose={vi.fn()} header={{ title: "Notifications" }}>
          <p>Content</p>
        </AppSheet>
      </div>
    );
    const overlay = screen.getByTestId("app-sheet-overlay");
    expect(overlay.parentElement).toBe(document.body);
    expect(screen.getByTestId("garden-header")).not.toContainElement(overlay);
    expect(useUIStore.getState().openSheetCount).toBe(1);

    view.unmount();
    expect(useUIStore.getState().openSheetCount).toBe(0);
  });

  it("pins its actions in the shared bar under the content, padding the safe area (DL-016)", () => {
    const onDeposit = vi.fn();
    renderWithProviders(
      <AppSheet
        size="full"
        isOpen
        onClose={vi.fn()}
        header={{ title: "Endowment" }}
        actions={{ primary: { label: "Deposit", onClick: onDeposit } }}
      >
        <p>Vault</p>
      </AppSheet>
    );

    const panel = screen.getByTestId("app-sheet");
    const bar = panel.querySelector('[data-component="SheetActions"]');
    expect(bar).toHaveAttribute("data-safe-area");
    expect(bar?.previousElementSibling).toHaveAttribute("data-scroll-edge", "bottom");
    fireEvent.click(screen.getByRole("button", { name: "Deposit" }));
    expect(onDeposit).toHaveBeenCalledOnce();
  });
});
