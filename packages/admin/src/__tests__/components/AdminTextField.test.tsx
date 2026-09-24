/**
 * @vitest-environment jsdom
 */

import { AdminSelect, AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, userEvent } from "../test-utils";

describe("AdminTextField", () => {
  it("floats the label when a forwarded ref restores an uncontrolled value", () => {
    const restoreValue = (input: HTMLInputElement | null) => {
      if (input) input.value = "10";
    };

    render(<AdminTextField ref={restoreValue} label="Impact quantity" type="number" />);

    expect(screen.getByRole("spinbutton", { name: "Impact quantity" })).toHaveValue(10);
    expect(screen.getByText("Impact quantity")).toHaveClass("top-0.5", "leading-4");
    expect(screen.getByText("Impact quantity")).not.toHaveClass("top-1/2");
  });

  it("keeps focused placeholder text below the floating label slot", () => {
    render(<AdminTextField label="Search" placeholder="Search by title" />);

    const control = screen.getByRole("textbox", { name: "Search" });
    fireEvent.focus(control);

    expect(screen.getByText("Search")).toHaveClass("top-0.5", "leading-4");
    expect(control).toHaveClass("pt-5", "pb-1", "leading-5");
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
    expect(screen.getByText("Reason")).toHaveClass("top-0.5", "leading-4");
    expect(control).toHaveClass("pt-5", "pb-1", "leading-5");
  });
});

/**
 * The character counter (CharacterCounter) is reached through the field that
 * opts into it: `showCount` counts toward the control's own `maxLength`, and
 * the control is described by the count in words.
 */
describe("the character counter", () => {
  it("counts as the steward types, describes the field, and says once that the limit is reached", async () => {
    const user = userEvent.setup();
    render(
      <AdminTextArea
        label="What this pool is for"
        helperText="Members read this."
        showCount
        textareaProps={{ maxLength: 12 }}
      />
    );
    const field = screen.getByRole("textbox", { name: "What this pool is for" });
    const status = screen.getByRole("status");

    expect(screen.getByText("0 / 12")).toHaveAttribute("aria-hidden", "true");
    expect(field).toHaveAccessibleDescription("Members read this. 0 of 12 characters used");

    await user.type(field, "Rides");
    expect(screen.getByText("5 / 12")).toBeInTheDocument();
    expect(field).toHaveAccessibleDescription("Members read this. 5 of 12 characters used");
    expect(status).toBeEmptyDOMElement();

    await user.type(field, ", tools and more");
    expect(field).toHaveValue("Rides, tools");
    expect(screen.getByText("12 / 12")).toBeInTheDocument();
    expect(status).toHaveTextContent("Character limit reached");

    await user.type(field, "{Backspace}");
    expect(screen.getByText("11 / 12")).toBeInTheDocument();
    expect(status).toBeEmptyDOMElement();
  });

  it("describes loaded text at or past the limit, and announces none of it", () => {
    const loaded = (text: string) => (
      <AdminTextArea
        label="What this pool is for"
        value={text}
        onChange={() => {}}
        showCount
        textareaProps={{ maxLength: 12 }}
      />
    );
    const { rerender } = render(loaded("Rides, tools"));
    const field = screen.getByRole("textbox", { name: "What this pool is for" });
    expect(screen.getByText("12 / 12")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    // Written before the limit: an error that says how to fix it, read on focus.
    rerender(loaded("Rides, tools, workshops"));
    expect(screen.getByText("23 / 12")).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(
      "Shorten this to 12 characters or fewer 23 of 12 characters used"
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("counts bytes when a contract does, and says why the text no longer fits", async () => {
    const user = userEvent.setup();
    render(
      <AdminTextField label="Garden name" showCount countBytes inputProps={{ maxLength: 12 }} />
    );
    const field = screen.getByRole("textbox", { name: "Garden name" });

    // 11 characters, 14 bytes: ç, í and é take two each.
    await user.type(field, "Açaí e café");
    expect(field).toHaveValue("Açaí e café");
    expect(screen.getByText("14 / 12")).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Shorten this: accented letters count as two, and some symbols as more"
    );
    // A screen reader hears the unit the count is in.
    expect(field).toHaveAccessibleDescription(/14 of 12 bytes used$/);
  });

  it("shows no counter unless the field opts in", () => {
    render(<AdminTextArea label="Reason" textareaProps={{ maxLength: 12 }} />);
    expect(screen.queryByText("0 / 12")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reason" })).not.toHaveAttribute("aria-describedby");
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
    expect(screen.getByText("Cycle")).toHaveClass("top-0.5", "leading-4");
    expect(screen.getByText("Cycle")).not.toHaveClass("top-1/2");
    expect(control).toHaveClass("pt-5", "pb-1", "leading-5");
    // Option-row colours are not a utility on this control: a Tailwind class
    // would land in @layer utilities and beat the shared rule, putting the
    // cockpit field on a different surface from every other select. The contract
    // lives in theme.css, guarded by shared nativeSelectTheming.guard.test.ts.
    expect(control.className).not.toMatch(/\[&>option\]/);

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
