/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaSheet } from "../../components/Dialog/PwaSheet";
import { useUIStore } from "../../stores/useUIStore";

describe("PwaSheet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.classList.remove("modal-open");
    useUIStore.setState({ openSheetCount: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.classList.remove("modal-open");
  });

  it("releases its lock when close starts and finishes closing on page hide", () => {
    const view = render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Work sheet">
        <button type="button">Inside</button>
      </PwaSheet>
    );

    expect(document.documentElement).toHaveClass("modal-open");

    view.rerender(
      <PwaSheet open={false} onClose={vi.fn()} ariaLabel="Work sheet">
        <button type="button">Inside</button>
      </PwaSheet>
    );

    expect(screen.getByRole("dialog")).toHaveAttribute("data-state", "closed");
    expect(document.documentElement).not.toHaveClass("modal-open");

    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("dismisses with Escape from a focused child control", () => {
    const close = vi.fn();
    render(
      <PwaSheet open onClose={close} ariaLabel="Draft">
        <button>Continue</button>
      </PwaSheet>
    );
    const button = screen.getByRole("button", { name: "Continue" });
    button.focus();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
  });
  it("renders the shared header and labels the dialog by its title", () => {
    const close = vi.fn();
    render(
      <PwaSheet
        open
        onClose={close}
        title="Delete Draft?"
        description="This removes the draft from this device."
        closeLabel="Close"
      >
        <button type="button">Delete</button>
      </PwaSheet>
    );
    const dialog = screen.getByRole("dialog", { name: "Delete Draft?" });
    expect(dialog).toHaveAccessibleDescription("This removes the draft from this device.");
    expect(screen.getByTestId("pwa-sheet-drag-handle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" }).parentElement).toHaveAttribute(
      "data-slot",
      "body"
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalledOnce();
  });
  it("keeps every dismissal path closed while preventClose is set", () => {
    const close = vi.fn();
    render(
      <PwaSheet open onClose={close} title="Deleting…" closeLabel="Close" preventClose>
        <button type="button">Wait</button>
      </PwaSheet>
    );
    expect(screen.getByTestId("pwa-sheet-close")).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("pwa-sheet-overlay"));
    expect(close).not.toHaveBeenCalled();
  });
  it("exposes destructive confirmations as an alertdialog", () => {
    render(
      <PwaSheet open onClose={vi.fn()} role="alertdialog" title="Discard draft?" closeLabel="Close">
        <button type="button">Discard</button>
      </PwaSheet>
    );
    expect(screen.getByRole("alertdialog", { name: "Discard draft?" })).toBeInTheDocument();
  });
  it("owns its layout without utility classes on the sheet chrome", () => {
    render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Sheet" panelClassName="consumer-panel">
        <p>Body</p>
      </PwaSheet>
    );
    // Tailwind does not scan packages/shared, so the geometry must come from
    // the [data-component="PwaSheet"] rules in utilities.css, never from
    // classes authored here.
    expect(screen.getByRole("dialog").getAttribute("class")).toBe("consumer-panel");
    expect(screen.getByTestId("pwa-sheet-overlay")).not.toHaveAttribute("class");
    expect(screen.getByTestId("pwa-sheet-drag-handle")).not.toHaveAttribute("class");
  });
  it("returns focus to the element that opened it", () => {
    const opener = document.createElement("button");
    opener.textContent = "Open";
    document.body.append(opener);
    opener.focus();
    expect(opener).toHaveFocus();
    const view = render(
      <PwaSheet open onClose={vi.fn()} title="Sheet" closeLabel="Close">
        <button type="button">Inside</button>
      </PwaSheet>
    );
    expect(screen.getByTestId("pwa-sheet-close")).toHaveFocus();
    view.rerender(
      <PwaSheet open={false} onClose={vi.fn()} title="Sheet" closeLabel="Close">
        <button type="button">Inside</button>
      </PwaSheet>
    );
    expect(opener).toHaveFocus();
    opener.remove();
  });
  it("keeps the page hidden until the last of two overlapping sheets closes", () => {
    const background = document.createElement("main");
    document.body.append(background);
    const first = render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="First">
        <p>First</p>
      </PwaSheet>
    );
    const second = render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Second">
        <p>Second</p>
      </PwaSheet>
    );
    expect(background).toHaveAttribute("aria-hidden", "true");

    // Close the first sheet while the second is still open.
    first.rerender(
      <PwaSheet open={false} onClose={vi.fn()} ariaLabel="First">
        <p>First</p>
      </PwaSheet>
    );
    expect(background).toHaveAttribute("aria-hidden", "true");

    second.rerender(
      <PwaSheet open={false} onClose={vi.fn()} ariaLabel="Second">
        <p>Second</p>
      </PwaSheet>
    );
    expect(background).not.toHaveAttribute("aria-hidden");
    background.remove();
  });
  it("renders into <body> so a page layer can never stack it under app chrome", () => {
    const page = (open: boolean) => (
      <div data-testid="page-layer" style={{ position: "fixed", zIndex: 10 }}>
        <p>Page content beside the sheet</p>
        <PwaSheet open={open} onClose={vi.fn()} ariaLabel="Deep">
          <p>Deep</p>
        </PwaSheet>
      </div>
    );
    const view = render(page(true));
    const overlay = screen.getByTestId("pwa-sheet-overlay");
    expect(overlay.parentElement).toBe(document.body);
    expect(screen.getByTestId("page-layer")).not.toContainElement(overlay);
    expect(view.container).toHaveAttribute("aria-hidden", "true");

    view.rerender(page(false));
    expect(view.container).not.toHaveAttribute("aria-hidden");
  });

  it("names its height tier on the surface, compact by default", () => {
    const view = render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Tier">
        <p>Tier</p>
      </PwaSheet>
    );
    expect(screen.getByTestId("pwa-sheet")).toHaveAttribute("data-sheet-size", "compact");

    view.rerender(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Tier" size="tall">
        <p>Tier</p>
      </PwaSheet>
    );
    expect(screen.getByTestId("pwa-sheet")).toHaveAttribute("data-sheet-size", "tall");
  });

  it("registers as an open sheet only while open, so the AppBar can step aside", () => {
    const sheet = (open: boolean) => (
      <PwaSheet open={open} onClose={vi.fn()} ariaLabel="Presence">
        <p>Presence</p>
      </PwaSheet>
    );
    const view = render(sheet(true));
    expect(useUIStore.getState().openSheetCount).toBe(1);

    view.rerender(sheet(false));
    expect(useUIStore.getState().openSheetCount).toBe(0);

    view.rerender(sheet(true));
    view.unmount();
    expect(useUIStore.getState().openSheetCount).toBe(0);
  });
  it("hides sibling content from assistive tech only while open", () => {
    const sibling = document.createElement("main");
    document.body.append(sibling);
    const view = render(
      <PwaSheet open onClose={vi.fn()} ariaLabel="Sheet">
        <p>Body</p>
      </PwaSheet>
    );
    expect(sibling).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    view.rerender(
      <PwaSheet open={false} onClose={vi.fn()} ariaLabel="Sheet">
        <p>Body</p>
      </PwaSheet>
    );
    expect(sibling).not.toHaveAttribute("aria-hidden");
    sibling.remove();
  });
});
