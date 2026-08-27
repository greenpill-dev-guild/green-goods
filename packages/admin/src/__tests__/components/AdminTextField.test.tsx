/**
 * @vitest-environment jsdom
 */

import { AdminTextField } from "@/components/AdminTextField";
import { describe, expect, it } from "vitest";
import { render, screen } from "../test-utils";

describe("AdminTextField", () => {
  it("floats the label when a forwarded ref restores an uncontrolled value", () => {
    const restoreValue = (input: HTMLInputElement | null) => {
      if (input) input.value = "10";
    };

    render(<AdminTextField ref={restoreValue} label="Impact quantity" type="number" />);

    expect(screen.getByRole("spinbutton", { name: "Impact quantity" })).toHaveValue(10);
    expect(screen.getByText("Impact quantity")).toHaveClass("top-2");
    expect(screen.getByText("Impact quantity")).not.toHaveClass("top-1/2");
  });
});
