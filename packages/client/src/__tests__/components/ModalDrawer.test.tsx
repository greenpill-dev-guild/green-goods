/** @vitest-environment jsdom */

import { act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModalDrawer } from "@/components/Dialogs/ModalDrawer";
import { renderWithProviders, screen } from "../test-utils";

describe("ModalDrawer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.classList.remove("modal-open");
  });
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove("modal-open");
  });

  it("renders tabs and keeps panel interactions inside the drawer", () => {
    const onClose = vi.fn();
    const onTabChange = vi.fn();
    renderWithProviders(
      <ModalDrawer
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
      </ModalDrawer>
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
      <ModalDrawer isOpen onClose={onClose} header={{ title: "Commitments" }}>
        Content
      </ModalDrawer>
    );
    const overlay = screen.getByTestId("modal-drawer-overlay");

    if (path === "close button") fireEvent.click(screen.getByTestId("modal-drawer-close"));
    if (path === "overlay") fireEvent.click(overlay);
    if (path === "Escape") fireEvent.keyDown(overlay, { key: "Escape" });
    act(() => vi.runAllTimers());

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes from Escape while focus is inside the dialog", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <ModalDrawer isOpen onClose={onClose} header={{ title: "Commitments" }}>
        Content
      </ModalDrawer>
    );
    const closeButton = screen.getByTestId("modal-drawer-close");
    closeButton.focus();

    fireEvent.keyDown(closeButton, { key: "Escape" });
    act(() => vi.runAllTimers());

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays unmounted while closed", () => {
    renderWithProviders(
      <ModalDrawer isOpen={false} onClose={vi.fn()} header={{ title: "Commitments" }}>
        Content
      </ModalDrawer>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the document locked until the final overlapping drawer closes", () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const view = renderWithProviders(
      <>
        <ModalDrawer isOpen onClose={firstClose} header={{ title: "First drawer" }}>
          First
        </ModalDrawer>
        <ModalDrawer isOpen onClose={secondClose} header={{ title: "Second drawer" }}>
          Second
        </ModalDrawer>
      </>
    );

    expect(document.documentElement).toHaveClass("modal-open");

    view.rerender(
      <>
        <ModalDrawer isOpen={false} onClose={firstClose} header={{ title: "First drawer" }}>
          First
        </ModalDrawer>
        <ModalDrawer isOpen onClose={secondClose} header={{ title: "Second drawer" }}>
          Second
        </ModalDrawer>
      </>
    );

    expect(document.documentElement).toHaveClass("modal-open");

    view.unmount();
    expect(document.documentElement).not.toHaveClass("modal-open");
  });

  it("finishes an interrupted close immediately when the page is hidden", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <ModalDrawer isOpen onClose={onClose} header={{ title: "Commitments" }}>
        Content
      </ModalDrawer>
    );

    fireEvent.click(screen.getByTestId("modal-drawer-close"));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.documentElement).not.toHaveClass("modal-open");

    act(() => window.dispatchEvent(new Event("pagehide")));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
