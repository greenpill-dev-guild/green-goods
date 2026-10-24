/**
 * @vitest-environment happy-dom
 */

import { AdminSelect, AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, userEvent } from "../test-utils";

describe("AdminTextField", () => {
  it("sets the label above the outlined control and the message line below it (F3)", () => {
    render(<AdminTextField label="Garden name" helperText="Shown on the garden's page." />);

    const control = screen.getByRole("textbox", { name: "Garden name" });
    const box = control.closest('[data-region="field-container"]');
    const label = screen.getByText("Garden name");
    // The label is the shared field title, outside the outline, never over the text.
    expect(label.tagName).toBe("LABEL");
    expect(label).toHaveClass("gg-field-label");
    expect(box?.previousElementSibling).toBe(label);
    expect(box).toHaveClass("ring-1", "ring-inset");
    // The message line is the shared one, which reserves the surface's lines.
    expect(screen.getByText("Shown on the garden's page.").parentElement).toHaveClass(
      "gg-field-help",
      "gg-field-message"
    );
    expect(box?.nextElementSibling).toHaveAttribute("data-region", "supporting-line");
  });

  it("shows a placeholder at rest, since no label rests inside the field", () => {
    render(<AdminTextField label="Search" placeholder="Search by title" />);

    const control = screen.getByRole("textbox", { name: "Search" });
    expect(control).toHaveAttribute("placeholder", "Search by title");
    expect(control).toHaveClass("placeholder:text-text-soft");
    expect(control.className).not.toContain("placeholder-transparent");
  });

  it("thickens the outline inside the box on focus and on error, so the field keeps its height", () => {
    render(
      <>
        <AdminTextField label="Name" />
        <AdminTextField label="Email" error="Enter a valid email address." />
      </>
    );

    const name = screen.getByRole("textbox", { name: "Name" });
    const nameBox = name.closest('[data-region="field-container"]');
    fireEvent.focus(name);
    expect(nameBox).toHaveClass("ring-2", "ring-inset");
    expect(nameBox?.className).toContain("--tone-focus-ring");

    const emailBox = screen
      .getByRole("textbox", { name: /Email/ })
      .closest('[data-region="field-container"]');
    expect(emailBox).toHaveClass("ring-2", "ring-inset");
    expect(emailBox?.className).toContain("--m3-error");
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

  it("forwards a textarea ref, its rows and its maxLength", () => {
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

  it("stays quiet when the caller replaces what the steward typed", async () => {
    const user = userEvent.setup();
    // A refreshed charter or another garden's snapshot, adopted while the field stays mounted.
    function Reloading() {
      const [text, setText] = useState("");
      return (
        <>
          <AdminTextArea
            label="What this pool is for"
            value={text}
            onChange={(event) => setText(event.target.value)}
            showCount
            textareaProps={{ maxLength: 12 }}
          />
          <button type="button" onClick={() => setText("Rides, tools")}>
            Reload
          </button>
        </>
      );
    }
    render(<Reloading />);

    await user.type(screen.getByRole("textbox", { name: "What this pool is for" }), "Rides");
    await user.click(screen.getByRole("button", { name: "Reload" }));
    expect(screen.getByText("12 / 12")).toBeInTheDocument();
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

    // The count is what is sent: a trailing space is trimmed away.
    await user.type(field, " ");
    expect(screen.getByText("14 / 12")).toBeInTheDocument();
  });

  it("shows no counter unless the field opts in", () => {
    render(<AdminTextArea label="Reason" textareaProps={{ maxLength: 12 }} />);
    expect(screen.queryByText("0 / 12")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reason" })).not.toHaveAttribute("aria-describedby");
  });
});

describe("AdminSelect", () => {
  it("renders a native select under its label, with the shared field anatomy", () => {
    const onChange = vi.fn();
    render(
      <AdminSelect label="Cycle" value="" onChange={onChange}>
        <option value="">Choose a cycle</option>
        <option value="c1">Season One</option>
      </AdminSelect>
    );

    const control = screen.getByRole("combobox", { name: "Cycle" });
    expect(control.tagName).toBe("SELECT");
    expect(screen.getByText("Cycle")).toHaveClass("gg-field-label");
    expect(control).toHaveClass("py-3", "sm:py-2.5", "leading-5");
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
