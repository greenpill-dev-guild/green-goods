/**
 * FormField Component Tests
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "../../components/ui/FormField";

describe("FormField", () => {
  it("renders label and children", () => {
    render(
      <FormField label="Garden Name">
        <input data-testid="input" />
      </FormField>
    );

    expect(screen.getByText("Garden Name")).toBeInTheDocument();
    expect(screen.getByTestId("input")).toBeInTheDocument();
  });

  it("associates label with input via htmlFor", () => {
    render(
      <FormField label="Garden Name" htmlFor="garden-name">
        <input id="garden-name" />
      </FormField>
    );

    const label = screen.getByText("Garden Name");
    expect(label).toHaveAttribute("for", "garden-name");
  });

  it("shows required indicator when required is true", () => {
    render(
      <FormField label="Garden Name" required>
        <input />
      </FormField>
    );

    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("does not show required indicator when required is false", () => {
    render(
      <FormField label="Garden Name">
        <input />
      </FormField>
    );

    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });

  it("renders error message with role alert", () => {
    render(
      <FormField label="Garden Name" error="Name is required">
        <input />
      </FormField>
    );

    const errorEl = screen.getByRole("alert");
    expect(errorEl).toHaveTextContent("Name is required");
    expect(errorEl).toHaveClass("text-error-dark");
  });

  it("renders hint when no error is present", () => {
    render(
      <FormField label="Search" hint="Filter by address">
        <input />
      </FormField>
    );

    expect(screen.getByText("Filter by address")).toBeInTheDocument();
  });

  it("hides hint when error is present", () => {
    render(
      <FormField label="Search" hint="Filter by address" error="Invalid">
        <input />
      </FormField>
    );

    expect(screen.queryByText("Filter by address")).not.toBeInTheDocument();
    expect(screen.getByText("Invalid")).toBeInTheDocument();
  });

  it("does not render error element when error is falsy", () => {
    render(
      <FormField label="Garden Name" error="">
        <input />
      </FormField>
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("applies custom className to wrapper", () => {
    const { container } = render(
      <FormField label="Test" className="mt-4">
        <input />
      </FormField>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("mt-4");
    expect(wrapper.className).toContain("space-y-1.5");
  });
});
