/** @vitest-environment jsdom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaSheet } from "../../components/Dialog/PwaSheet";

describe("PwaSheet", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.classList.remove("modal-open");
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
});
