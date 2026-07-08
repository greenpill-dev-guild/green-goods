/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "../test-utils";
import userEvent from "@testing-library/user-event";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";

const options = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

describe("AdminChoiceGroup", () => {
  it("renders a compact radio group with checked state", () => {
    render(
      <AdminChoiceGroup
        ariaLabel="Theme"
        value="dark"
        options={options}
        onChange={() => undefined}
        columns={3}
      />
    );

    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(group).toHaveAttribute("data-component", "AdminChoiceGroup");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "false");
  });

  it("selects the next enabled option with arrow keys", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <AdminChoiceGroup
        ariaLabel="Theme"
        value="light"
        options={[
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark", disabled: true },
          { value: "system", label: "System" },
        ]}
        onChange={handleChange}
      />
    );

    screen.getByRole("radio", { name: "Light" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(handleChange).toHaveBeenCalledWith("system");
  });

  it("keeps the first enabled option tabbable when the value is stale", () => {
    render(
      <AdminChoiceGroup
        ariaLabel="Theme"
        value="removed"
        options={options}
        onChange={() => undefined}
      />
    );

    expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("tabindex", "-1");
  });
});
