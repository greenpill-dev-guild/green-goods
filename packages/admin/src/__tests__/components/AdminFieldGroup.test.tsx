/**
 * AdminFieldGroup — group-shaped field-family anatomy (fieldset+legend or
 * labelled div) sharing the family's --m3-error state and type roles.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import { AdminFieldGroup } from "@/components/AdminFieldGroup";
import { render, screen } from "../test-utils";

describe("AdminFieldGroup", () => {
  it("renders a fieldset with legend, hint, and required marker", () => {
    render(
      <AdminFieldGroup label="Forms of capital" required hint="Pick at least one">
        <input type="checkbox" aria-label="Social" />
      </AdminFieldGroup>
    );

    const group = screen.getByRole("group", { name: /Forms of capital/ });
    expect(group.tagName).toBe("FIELDSET");
    expect(group).toHaveAttribute("data-component", "AdminFieldGroup");
    expect(screen.getByText("Pick at least one")).toHaveClass("body-sm");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders the error row on the family error token and recolors the legend", () => {
    render(
      <AdminFieldGroup label="Forms of capital" error="Select at least one">
        <input type="checkbox" aria-label="Social" />
      </AdminFieldGroup>
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Select at least one");
    expect(alert.className).toContain("--m3-error");
    expect(screen.getByText("Forms of capital").className).toContain("--m3-error");
  });

  it("labels a div group via aria-labelledby for composite widgets", () => {
    render(
      <AdminFieldGroup as="div" label="Media (images)">
        <div>uploader</div>
      </AdminFieldGroup>
    );

    const group = screen.getByRole("group", { name: "Media (images)" });
    expect(group.tagName).toBe("DIV");
  });
});
