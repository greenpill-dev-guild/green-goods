/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "../test-utils";
import { AdminSelectableCard } from "@/components/AdminSelectableCard";

describe("AdminSelectableCard", () => {
  it("renders toggle-style selection with pressed state", () => {
    render(<AdminSelectableCard selected title="Solar" description="Track energy production." />);

    const card = screen.getByRole("button", { name: /solar/i });
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(card).toHaveAttribute("data-selected", "true");
    expect(card).not.toHaveAttribute("aria-checked");
  });

  it("renders radio-style selection with checked state", () => {
    render(
      <div role="radiogroup" aria-label="Theme">
        <AdminSelectableCard
          selected={false}
          selectionRole="radio"
          title="System"
          description="Use the device theme."
        />
      </div>
    );

    const card = screen.getByRole("radio", { name: /system/i });
    expect(card).toHaveAttribute("aria-checked", "false");
    expect(card).not.toHaveAttribute("aria-pressed");
  });
});
