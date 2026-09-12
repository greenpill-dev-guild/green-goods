/** @vitest-environment jsdom */

import { act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
      <AppSheet isOpen onClose={onClose} header={{ title: "Commitments" }}>
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
      <AppSheet isOpen onClose={onClose} header={{ title: "Commitments" }}>
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
      <AppSheet isOpen={false} onClose={vi.fn()} header={{ title: "Commitments" }}>
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
        <AppSheet isOpen onClose={firstClose} header={{ title: "First sheet" }}>
          First
        </AppSheet>
        <AppSheet isOpen onClose={secondClose} header={{ title: "Second sheet" }}>
          Second
        </AppSheet>
      </>
    );

    expect(document.documentElement).toHaveClass("modal-open");

    view.rerender(
      <>
        <AppSheet isOpen={false} onClose={firstClose} header={{ title: "First sheet" }}>
          First
        </AppSheet>
        <AppSheet isOpen onClose={secondClose} header={{ title: "Second sheet" }}>
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
      <AppSheet isOpen onClose={onClose} header={{ title: "Commitments" }}>
        Content
      </AppSheet>
    );

    fireEvent.click(screen.getByTestId("app-sheet-close"));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.documentElement).not.toHaveClass("modal-open");

    act(() => window.dispatchEvent(new Event("pagehide")));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("sizes to its content and owns scrolling when it has no tabs", () => {
    renderWithProviders(
      <AppSheet isOpen onClose={vi.fn()} header={{ title: "Notifications" }} maxHeight="60vh">
        <p>Content</p>
      </AppSheet>
    );
    const panel = screen.getByTestId("app-sheet");
    expect(panel).toHaveClass("max-h-sheet");
    expect(panel).not.toHaveClass("h-modal");
    expect(panel.style.maxHeight).toBe("60vh");
    const region = screen.getByText("Content").parentElement;
    expect(region).toHaveClass("overflow-y-auto");
    expect(region?.querySelector(".overflow-y-auto")).toBeNull();
  });

  it("fills the workspace height for tabbed sheets and leaves scrolling to the tab content", () => {
    renderWithProviders(
      <AppSheet
        isOpen
        onClose={vi.fn()}
        header={{ title: "Wallet" }}
        tabs={[{ id: "send", label: "Send" }]}
        activeTab="send"
        onTabChange={vi.fn()}
        contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
        maxHeight="95vh"
      >
        <p>Content</p>
      </AppSheet>
    );
    const panel = screen.getByTestId("app-sheet");
    expect(panel).toHaveClass("h-modal");
    expect(panel).not.toHaveClass("max-h-sheet");
    expect(panel.style.maxHeight).toBe("95vh");
    expect(screen.getByRole("tabpanel")).not.toHaveClass("overflow-y-auto");
  });

  it("honors an explicit height override", () => {
    renderWithProviders(
      <AppSheet isOpen onClose={vi.fn()} header={{ title: "Signal" }} height="fixed">
        <p>Content</p>
      </AppSheet>
    );
    expect(screen.getByTestId("app-sheet")).toHaveClass("h-modal");
  });
});
