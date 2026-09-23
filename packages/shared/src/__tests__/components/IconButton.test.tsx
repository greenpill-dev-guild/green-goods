/** @vitest-environment jsdom */

import * as Dialog from "@radix-ui/react-dialog";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IconButton } from "../../components/IconButton";

describe("IconButton", () => {
  it("is a named, non-submitting circle with tertiary emphasis and md size by default", () => {
    render(<IconButton aria-label="Close" icon={<svg data-testid="icon" />} />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(button).toHaveClass("gg-icon-button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-emphasis", "tertiary");
    expect(button).toHaveAttribute("data-size", "md");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("maps emphasis, tone, and size", () => {
    render(
      <IconButton
        aria-label="Remove Photo"
        icon={<svg />}
        emphasis="secondary"
        tone="danger"
        size="compact"
      />
    );
    const button = screen.getByRole("button", { name: "Remove Photo" });
    expect(button).toHaveAttribute("data-emphasis", "secondary");
    expect(button).toHaveAttribute("data-tone", "danger");
    expect(button).toHaveAttribute("data-size", "compact");
  });

  it("stays focusable and inert while loading", () => {
    const onClick = vi.fn();
    render(
      <IconButton
        aria-label="Refresh"
        icon={<svg data-testid="icon" />}
        loading
        onClick={onClick}
      />
    );
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByTestId("icon")).toBeNull();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("pins a badge inside the button and keeps it while loading", () => {
    const { rerender } = render(
      <IconButton
        aria-label="Open Your Work, 3 pending"
        icon={<svg data-testid="icon" />}
        badge={<span data-testid="count">3</span>}
      />
    );
    const button = screen.getByRole("button", { name: "Open Your Work, 3 pending" });
    const count = screen.getByTestId("count");
    expect(button).toContainElement(count);
    expect(count.parentElement).toHaveClass("gg-icon-button-badge");

    rerender(
      <IconButton
        aria-label="Open Your Work, 3 pending"
        icon={<svg data-testid="icon" />}
        badge={<span data-testid="count">3</span>}
        loading
      />
    );
    expect(screen.queryByTestId("icon")).toBeNull();
    expect(screen.getByTestId("count")).toBeInTheDocument();
  });

  it("keeps a consumer aria-busy on a launcher that is not ready", () => {
    render(<IconButton aria-label="Open Your Work" icon={<svg />} disabled aria-busy />);
    const button = screen.getByRole("button", { name: "Open Your Work" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("works as a Radix close through asChild", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Content aria-describedby={undefined}>
            <Dialog.Title>Sheet</Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label="Close" icon={<svg />} />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
