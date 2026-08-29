/**
 * @vitest-environment jsdom
 */

import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "../test-utils";

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

describe("AdminTextArea", () => {
  it("renders a real textarea with the shared field anatomy", () => {
    render(<AdminTextArea label="Reason" helperText="Members read this" />);

    const control = screen.getByRole("textbox", { name: /Reason/ });
    expect(control.tagName).toBe("TEXTAREA");
    expect(control).toHaveAttribute("rows", "3");
    expect(screen.getByText("Members read this")).toBeInTheDocument();
  });

  it("floats the label on focus and forwards a textarea ref", () => {
    let captured: HTMLTextAreaElement | null = null;
    render(
      <AdminTextArea
        ref={(node) => {
          captured = node;
        }}
        label="Reason"
        rows={5}
        textareaProps={{ maxLength: 120 }}
      />
    );

    const control = screen.getByRole("textbox", { name: /Reason/ });
    expect(captured).toBe(control);
    expect(control).toHaveAttribute("rows", "5");
    expect(control).toHaveAttribute("maxlength", "120");

    expect(screen.getByText("Reason")).toHaveClass("top-1/2");
    fireEvent.focus(control);
    expect(screen.getByText("Reason")).not.toHaveClass("top-1/2");
  });
});
