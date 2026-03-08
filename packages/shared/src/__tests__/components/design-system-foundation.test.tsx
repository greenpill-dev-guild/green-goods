import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormInput } from "../../components/Form/FormInput";
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

    expect(input).toHaveClass("w-full");
    expect(input).toHaveClass("text-base");
    expect(input).toHaveClass("rounded-lg");
    expect(input).toHaveClass("px-4");
  });

  it("supports the shared textarea styling", () => {
    render(<FormTextarea id="foundation-notes" label="Notes" placeholder="Add notes" />);

    const textarea = screen.getByLabelText("Notes");

    expect(textarea).toHaveClass("w-full");
    expect(textarea).toHaveClass("text-base");
    expect(textarea).toHaveClass("px-4");
    expect(textarea).toHaveClass("rounded-lg");
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
