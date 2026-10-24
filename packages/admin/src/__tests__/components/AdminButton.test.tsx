/**
 * AdminButton and AdminIconButton render the shared family (DL-115): each
 * cockpit variant lands on a shared emphasis and tone, the safe button type
 * stays the default, and a loading button stays focusable.
 *
 * @vitest-environment happy-dom
 */

import { RiAddLine } from "@remixicon/react";
import { describe, expect, it, vi } from "vitest";
import { AdminButton, AdminIconButton } from "@/components/AdminButton";
import { render, screen, userEvent } from "../test-utils";

describe("AdminButton", () => {
  it("maps each action variant onto a shared emphasis and tone", () => {
    const cases = [
      ["filled", "primary", null],
      ["outlined", "secondary", null],
      ["elevated", "secondary", null],
      ["text", "tertiary", null],
      ["danger", "primary", "danger"],
      ["outlinedDanger", "secondary", "danger"],
    ] as const;
    render(
      <>
        {cases.map(([variant]) => (
          <AdminButton key={variant} variant={variant}>
            {variant}
          </AdminButton>
        ))}
        <AdminButton>Default</AdminButton>
      </>
    );

    for (const [variant, emphasis, tone] of cases) {
      const button = screen.getByRole("button", { name: variant });
      expect(button).toHaveClass("gg-button");
      expect(button).toHaveAttribute("data-emphasis", emphasis);
      if (tone) expect(button).toHaveAttribute("data-tone", tone);
      else expect(button).not.toHaveAttribute("data-tone");
    }
    expect(screen.getByRole("button", { name: "Default" })).toHaveAttribute(
      "data-emphasis",
      "primary"
    );
  });

  it("keeps the cockpit's tonal pill for a chosen option, which is a choice", () => {
    render(<AdminButton variant="tonal">Last 30 days</AdminButton>);

    const choice = screen.getByRole("button", { name: "Last 30 days" });
    expect(choice).not.toHaveClass("gg-button");
    expect(choice).toHaveClass("m3-state-layer", "h-8");
    expect(choice).toHaveAttribute("data-component", "AdminButton");
  });

  it("defaults to type=button and stays focusable while loading, ignoring presses", async () => {
    const onClick = vi.fn();
    render(
      <form onSubmit={(event) => event.preventDefault()}>
        <AdminButton onClick={onClick} loading>
          Save
        </AdminButton>
      </form>
    );

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("type", "button");
    expect(save).not.toBeDisabled();
    expect(save).toHaveAttribute("aria-busy", "true");
    expect(save).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(save);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("draws a link as the shared button without giving it a type", () => {
    render(
      <AdminButton asChild variant="outlined" size="sm">
        <a href="/hub">Open Hub</a>
      </AdminButton>
    );

    const link = screen.getByRole("link", { name: "Open Hub" });
    expect(link).toHaveClass("gg-button");
    expect(link).toHaveAttribute("data-emphasis", "secondary");
    expect(link).toHaveAttribute("data-size", "compact");
    expect(link).toHaveAttribute("data-component", "AdminButton");
    expect(link).not.toHaveAttribute("type");
  });
});

describe("AdminIconButton", () => {
  it("maps each variant onto a shared emphasis and keeps the label as name and tooltip", () => {
    const cases = [
      ["standard", "tertiary", null],
      ["accent", "tertiary", null],
      ["tonal", "secondary", null],
      ["filled", "primary", null],
      ["danger", "tertiary", "danger"],
    ] as const;
    render(
      <>
        {cases.map(([variant]) => (
          <AdminIconButton key={variant} variant={variant} label={`Add ${variant}`}>
            <RiAddLine />
          </AdminIconButton>
        ))}
      </>
    );

    for (const [variant, emphasis, tone] of cases) {
      const button = screen.getByRole("button", { name: `Add ${variant}` });
      expect(button).toHaveClass("gg-icon-button");
      expect(button).toHaveAttribute("data-emphasis", emphasis);
      expect(button).toHaveAttribute("title", `Add ${variant}`);
      if (tone) expect(button).toHaveAttribute("data-tone", tone);
      else expect(button).not.toHaveAttribute("data-tone");
    }
  });

  it("draws a link as the shared icon button", () => {
    render(
      <AdminIconButton asChild variant="accent" label="Open on OpenSea">
        <a href="https://opensea.io">
          <RiAddLine />
        </a>
      </AdminIconButton>
    );

    const link = screen.getByRole("link", { name: "Open on OpenSea" });
    expect(link).toHaveClass("gg-icon-button");
    expect(link).toHaveAttribute("data-emphasis", "tertiary");
    expect(link).toHaveAttribute("data-size", "sm");
    expect(link).toHaveAttribute("data-component", "AdminIconButton");
  });
});
