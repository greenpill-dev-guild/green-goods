/**
 * AdminInlineField — unified field-family error anatomy (critique round 3).
 *
 * The inline field previously rode the shared FormField wrapper: Warm-Earth
 * `--error-dark`, a `shake-error` class with no definition in admin CSS, and
 * un-inset supporting text. These pin the M3-family contract instead.
 *
 * @vitest-environment jsdom
 */

import { AdminInlineField } from "@/components/AdminInlineField";
import { describe, expect, it } from "vitest";
import { render, screen } from "../test-utils";

describe("AdminInlineField error anatomy", () => {
  it("renders error on the m3 error role with the family supporting slot", () => {
    const { container } = render(
      <AdminInlineField
        label="Action id"
        value="abc"
        onChange={() => {}}
        error="Enter a numeric id."
        action={<button type="button">Register</button>}
      />
    );

    const input = screen.getByRole("textbox", { name: /Action id/ });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.className).toContain("--m3-error");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Enter a numeric id.");
    expect(alert.className).toContain("--m3-error");
    expect(alert).toHaveClass("px-3");
    expect(input).toHaveAttribute("aria-describedby", alert.id);

    // The label recolors with the field, and nothing rides the retired
    // shared error path.
    expect(screen.getByText("Action id").className).toContain("--m3-error");
    expect(container.innerHTML).not.toContain("shake-error");
    expect(container.innerHTML).not.toContain("error-dark");
  });

  it("keeps the supporting line reserved so an appearing error never shifts the row", () => {
    const { rerender } = render(
      <AdminInlineField
        label="Action id"
        value=""
        onChange={() => {}}
        action={<button type="button">Register</button>}
      />
    );

    const slot = () => document.querySelector("p[id$='-helper-text']");
    expect(slot()).not.toBeNull();
    expect(slot()).toHaveClass("min-h-4");

    rerender(
      <AdminInlineField
        label="Action id"
        value=""
        onChange={() => {}}
        error="Required."
        action={<button type="button">Register</button>}
      />
    );
    expect(slot()).toHaveTextContent("Required.");
  });
});
