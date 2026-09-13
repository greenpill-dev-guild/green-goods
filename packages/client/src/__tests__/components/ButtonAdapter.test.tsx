import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/Actions";

describe("client Button adapter", () => {
  it.each([
    [{ variant: "primary", mode: "filled" }, "primary", undefined],
    [{ variant: "primary", mode: "stroke" }, "secondary", undefined],
    [{ variant: "primary", mode: "lighter" }, "secondary", undefined],
    [{ variant: "primary", mode: "ghost" }, "tertiary", undefined],
    // A dark neutral fill was a second action; it becomes the outlined squircle.
    [{ variant: "neutral", mode: "filled" }, "secondary", undefined],
    [{ variant: "neutral", mode: "stroke" }, "secondary", undefined],
    [{ variant: "neutral", mode: "ghost" }, "tertiary", undefined],
    [{ variant: "error", mode: "filled" }, "primary", "danger"],
    [{ variant: "error", mode: "stroke" }, "secondary", "danger"],
    [{ variant: "error", mode: "ghost" }, "tertiary", "danger"],
  ] as const)("maps %o to %s emphasis", (props, emphasis, tone) => {
    render(<Button label="Action" {...props} />);
    const button = screen.getByRole("button", { name: "Action" });
    expect(button).toHaveAttribute("data-emphasis", emphasis);
    if (tone) expect(button).toHaveAttribute("data-tone", tone);
    else expect(button).not.toHaveAttribute("data-tone");
  });

  it.each([
    ["medium", "md"],
    ["small", "sm"],
    ["xsmall", "compact"],
    ["xxsmall", "compact"],
    ["compact", "compact"],
  ] as const)("maps size %s to %s and ignores shape", (size, expected) => {
    render(<Button label="Action" size={size} shape="pilled" />);
    const button = screen.getByRole("button", { name: "Action" });
    expect(button).toHaveAttribute("data-size", expected);
    expect(button.className).not.toMatch(/gg-button-shape/);
  });

  it("keeps an in-flight button focusable and ignores activation", () => {
    const onClick = vi.fn();
    render(<Button label="Submit Work" isLoading onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Submit Work" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("disables natively and marks aria-disabled when disabled", () => {
    render(<Button label="Join Garden" disabled />);
    const button = screen.getByRole("button", { name: "Join Garden" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
  });
});
