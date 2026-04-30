/**
 * TimeFilterControl Component Tests
 *
 * Tests the time period filter select used in the Work Dashboard.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimeFilterControl } from "../../views/Home/WorkDashboard/TimeFilterControl";

const wrap = (node: ReactNode) => createElement(IntlProvider, { locale: "en", messages: {} }, node);

describe("TimeFilterControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a select element with all time options", () => {
    render(wrap(createElement(TimeFilterControl, { value: "month", onChange: vi.fn() })));

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.textContent)).toEqual(["Day", "Week", "Month", "Year"]);
  });

  it("reflects the current value", () => {
    render(wrap(createElement(TimeFilterControl, { value: "week", onChange: vi.fn() })));

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("week");
  });

  it("calls onChange when a new option is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(wrap(createElement(TimeFilterControl, { value: "month", onChange })));

    await user.selectOptions(screen.getByRole("combobox"), "day");
    expect(onChange).toHaveBeenCalledWith("day");
  });

  it("can change to year filter", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(wrap(createElement(TimeFilterControl, { value: "month", onChange })));

    await user.selectOptions(screen.getByRole("combobox"), "year");
    expect(onChange).toHaveBeenCalledWith("year");
  });
});
