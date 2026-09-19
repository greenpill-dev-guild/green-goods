/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Chip } from "../../components/Chip";

describe("Chip", () => {
  it("is a non-submitting toggle that announces its pressed state", () => {
    const onClick = vi.fn();
    const view = render(<Chip onClick={onClick}>Offers</Chip>);
    const chip = screen.getByRole("button", { name: "Offers" });
    expect(chip).toHaveClass("gg-chip");
    expect(chip).toHaveAttribute("type", "button");
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip).not.toHaveAttribute("data-size");
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledOnce();

    view.rerender(
      <Chip selected size="sm">
        Offers
      </Chip>
    );
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toHaveAttribute("data-size", "sm");
  });

  it("uses aria-checked inside a radio group and aria-selected as a tab", () => {
    render(
      <>
        <Chip role="radio" selected>
          DAI
        </Chip>
        <Chip role="tab" selected>
          Live
        </Chip>
      </>
    );
    const radio = screen.getByRole("radio", { name: "DAI" });
    expect(radio).toHaveAttribute("aria-checked", "true");
    expect(radio).not.toHaveAttribute("aria-pressed");
    const tab = screen.getByRole("tab", { name: "Live" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(tab).not.toHaveAttribute("aria-pressed");
  });
});
