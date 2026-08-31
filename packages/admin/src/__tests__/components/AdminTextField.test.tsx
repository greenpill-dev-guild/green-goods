/**
 * @vitest-environment jsdom
 */

import { AdminSelect, AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import { describe, expect, it, vi } from "vitest";
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

describe("AdminSelect", () => {
  it("renders a native select with the shared field anatomy and a permanently floated label", () => {
    const onChange = vi.fn();
    render(
      <AdminSelect label="Cycle" value="" onChange={onChange}>
        <option value="">Choose a cycle</option>
        <option value="c1">Season One</option>
      </AdminSelect>
    );

    const control = screen.getByRole("combobox", { name: "Cycle" });
    expect(control.tagName).toBe("SELECT");
    // A native select always displays its selected option's text, so the
    // label can never rest in the centered position without overlapping it.
    expect(screen.getByText("Cycle")).toHaveClass("top-2");
    expect(screen.getByText("Cycle")).not.toHaveClass("top-1/2");

    fireEvent.change(control, { target: { value: "c1" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("carries the error role, disabled state, selectProps, and a select ref", () => {
    let captured: HTMLSelectElement | null = null;
    render(
      <AdminSelect
        ref={(node) => {
          captured = node;
        }}
        label="Action"
        value="a1"
        onChange={() => {}}
        error="Pick an action"
        selectProps={{ "data-component": "SeedRequirementAction" }}
      >
        <option value="a1">Turn soil</option>
      </AdminSelect>
    );

    const control = screen.getByRole("combobox", { name: /Action/ });
    expect(captured).toBe(control);
    expect(control).toHaveAttribute("aria-invalid", "true");
    expect(control).toHaveAttribute("data-component", "SeedRequirementAction");
    expect(screen.getByRole("alert")).toHaveTextContent("Pick an action");

    render(
      <AdminSelect label="Disabled" value="" onChange={() => {}} disabled>
        <option value="">None</option>
      </AdminSelect>
    );
    expect(screen.getByRole("combobox", { name: "Disabled" })).toBeDisabled();
  });
});
