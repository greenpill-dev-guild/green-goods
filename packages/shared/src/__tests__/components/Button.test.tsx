/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../../components/Button";

describe("Button", () => {
  it("emits the emphasis contract with primary and md by default (DL-021, DL-023)", () => {
    render(<Button>Continue</Button>);
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toHaveClass("gg-button");
    expect(button).toHaveAttribute("data-emphasis", "primary");
    expect(button).toHaveAttribute("data-size", "md");
    expect(button).not.toHaveAttribute("data-tone");
    expect(button.className).not.toMatch(/gg-button-(primary|secondary|ghost|danger|size|shape)/);
  });

  it("maps emphasis, tone, and size onto data attributes", () => {
    render(
      <Button emphasis="secondary" tone="danger" size="compact">
        Remove
      </Button>
    );
    const button = screen.getByRole("button", { name: "Remove" });
    expect(button).toHaveAttribute("data-emphasis", "secondary");
    expect(button).toHaveAttribute("data-tone", "danger");
    expect(button).toHaveAttribute("data-size", "compact");
  });

  it("renders leading and trailing icons around the label", () => {
    render(
      <Button leadingIcon={<svg data-testid="lead" />} trailingIcon={<svg data-testid="trail" />}>
        Share
      </Button>
    );
    const button = screen.getByRole("button", { name: "Share" });
    const children = Array.from(button.childNodes);
    expect(children[0]).toBe(screen.getByTestId("lead"));
    expect(children[children.length - 1]).toBe(screen.getByTestId("trail"));
  });

  it("keeps a loading button focusable but inert", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick} leadingIcon={<svg data-testid="lead" />}>
        Send
      </Button>
    );
    const button = screen.getByRole("button", { name: "Send" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByTestId("lead")).toBeNull();
    button.focus();
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps a consumer aria-busy on a button that is waiting but not loading", () => {
    render(
      <Button disabled aria-busy>
        Open
      </Button>
    );
    const button = screen.getByRole("button", { name: "Open" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
  });

  it("never submits a form while loading", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          Save
        </Button>
      </form>
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders a link as a button through asChild", () => {
    render(
      <Button asChild emphasis="secondary" size="lg" className="w-full">
        <a href="/fund">Support This Garden</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Support This Garden" });
    expect(link).toHaveClass("gg-button", "w-full");
    expect(link).toHaveAttribute("data-emphasis", "secondary");
    expect(link).toHaveAttribute("data-size", "lg");
  });

  it("keeps the legacy class contract when a variant is passed", () => {
    const onClick = vi.fn();
    render(
      <Button variant="ghost" size="sm" loading onClick={onClick}>
        Retry
      </Button>
    );
    const button = screen.getByRole("button", { name: "Retry" });
    expect(button).toHaveClass("gg-button", "gg-button-ghost", "gg-button-size-sm");
    expect(button).not.toHaveAttribute("data-emphasis");
    // Legacy loading still disables natively, as admin-reachable internals expect.
    expect(button).toBeDisabled();
  });
});
