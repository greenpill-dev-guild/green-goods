import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it } from "vitest";
import { Button } from "../../components/Button";
import { DatePicker } from "../../components/DatePicker/DatePicker";
import { FormInput } from "../../components/Form/FormInput";
import { FormTextarea } from "../../components/Form/FormTextarea";
import { Select, SelectTrigger, SelectValue } from "../../components/Form/Select";
import {
  cardShellVariants,
  controlInputVariants,
  iconButtonVariants,
  selectTriggerVariants,
} from "../../components/Tokens/foundation";

describe("design system foundation", () => {
  it("uses shared text control styling by default", () => {
    render(<FormInput id="foundation-name" label="Name" placeholder="Add a name" />);

    const input = screen.getByLabelText("Name");

    expect(input).toHaveClass("gg-control");
  });

  it("shows and preserves the required state for shared inputs", () => {
    render(<FormInput id="required-field" label="Milestone Value" required />);

    expect(screen.getByLabelText("Milestone Value*")).toBeRequired();
  });

  it("supports the shared textarea styling", () => {
    render(<FormTextarea id="foundation-notes" label="Notes" placeholder="Add notes" />);

    const textarea = screen.getByLabelText("Notes");

    expect(textarea).toHaveClass("gg-control");
    expect(textarea).toHaveClass("gg-control-textarea");
  });

  it("shows and preserves the required state for shared textareas", () => {
    render(<FormTextarea id="required-notes" label="Notes" required />);

    expect(screen.getByLabelText("Notes*")).toBeRequired();
  });

  it("uses the shared control class for custom selects", () => {
    render(
      <Select>
        <SelectTrigger size="sm">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
      </Select>
    );

    const trigger = screen.getByRole("combobox");

    expect(trigger).toHaveClass("gg-control");
    expect(trigger).toHaveClass("gg-control-trigger");
    expect(trigger).toHaveAttribute("data-size", "sm");
  });

  it("uses the shared button class contract", () => {
    render(
      <Button emphasis="secondary" size="sm">
        Refresh
      </Button>
    );

    const button = screen.getByRole("button", { name: "Refresh" });

    expect(button).toHaveClass("gg-button");
    expect(button).toHaveAttribute("data-emphasis", "secondary");
    expect(button).toHaveAttribute("data-size", "sm");
  });

  it("exposes one shared control sizing contract for native inputs and selects", () => {
    expect(controlInputVariants({ size: "sm" })).toContain("min-h-10");
    expect(controlInputVariants({ size: "sm" })).toContain("text-paragraph-md");
    expect(selectTriggerVariants({ size: "sm" })).toContain("min-h-10");
    expect(selectTriggerVariants({ size: "sm" })).toContain("rounded-xl");
  });

  it("exposes a shared icon button size contract", () => {
    expect(iconButtonVariants({ size: "sm" })).toContain("size-10");
    expect(iconButtonVariants({ size: "md" })).toContain("size-11");
    expect(iconButtonVariants({ size: "lg" })).toContain("size-12");
  });

  it("uses one shared card shell contract", () => {
    expect(cardShellVariants()).toContain("rounded-2xl");
    expect(cardShellVariants()).toContain("border-stroke-soft-200");
    expect(cardShellVariants({ interactive: true })).toContain("hover:border-stroke-sub-300");
  });

  // The date picker's arrows are laid across the month title's row and come
  // first in the DOM. When the title was a positioned box it painted over them
  // and took a press on the inner half of each arrow, so the month did not
  // change. There is no layout here to press against: the `ChangingMonth` story
  // does that in a real browser. This holds the cause in the lane every push runs.
  it("keeps the date picker's month title from being a positioned box over its arrows", async () => {
    const user = userEvent.setup();
    // 2025-06-15 16:00:00 UTC: June in every time zone.
    render(<DatePicker id="foundation-date" label="Start date" value={1750003200} />);

    await user.click(document.getElementById("foundation-date") as HTMLButtonElement);

    const popover = document.querySelector<HTMLElement>('[data-component="DatePickerPopover"]');
    expect(popover).not.toBeNull();
    const calendar = within(popover as HTMLElement);
    const arrows = calendar.getByRole("button", { name: "Go to the Previous Month" }).parentElement;
    const title = calendar.getByText("June 2025").parentElement;

    expect(arrows).toHaveClass("absolute");
    expect(title?.className).not.toMatch(/(^|\s)(relative|absolute|fixed|sticky)(\s|$)/);
  });
});
