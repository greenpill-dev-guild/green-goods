import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../../components/Button";
import { FormInput } from "../../components/Form/FormInput";
import { Select, SelectTrigger, SelectValue } from "../../components/Form/Select";
import { FormTextarea } from "../../components/Form/FormTextarea";
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

  it("supports the shared textarea styling", () => {
    render(<FormTextarea id="foundation-notes" label="Notes" placeholder="Add notes" />);

    const textarea = screen.getByLabelText("Notes");

    expect(textarea).toHaveClass("gg-control");
    expect(textarea).toHaveClass("gg-control-textarea");
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
      <Button variant="secondary" size="sm">
        Refresh
      </Button>
    );

    const button = screen.getByRole("button", { name: "Refresh" });

    expect(button).toHaveClass("gg-button");
    expect(button).toHaveClass("gg-button-secondary");
    expect(button).toHaveClass("gg-button-size-sm");
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
});
