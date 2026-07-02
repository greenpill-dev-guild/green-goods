/**
 * FormattedAmountInput + useFormattedAmountInput tests
 *
 * @vitest-environment jsdom
 */

import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  FormattedAmountInput,
  useFormattedAmountInput,
} from "../../components/Form/FormattedAmountInput";

describe("useFormattedAmountInput", () => {
  it("reports empty input without an error", () => {
    const { result } = renderHook(() => useFormattedAmountInput("", 18));
    expect(result.current).toEqual({
      parsedAmount: null,
      formatErrorId: null,
      exceeds: false,
      isEmpty: true,
    });
  });

  it("parses a valid decimal to base units", () => {
    const { result } = renderHook(() => useFormattedAmountInput("1.5", 18));
    expect(result.current.parsedAmount).toBe(1_500000000000000000n);
    expect(result.current.formatErrorId).toBeNull();
    expect(result.current.exceeds).toBe(false);
    expect(result.current.isEmpty).toBe(false);
  });

  it("flags a malformed amount with the treasury format-error id", () => {
    const { result } = renderHook(() => useFormattedAmountInput("1.2.3", 18));
    expect(result.current.parsedAmount).toBeNull();
    expect(result.current.formatErrorId).toBe("app.treasury.invalidAmount");
  });

  it("flags too many decimal places for the token", () => {
    const { result } = renderHook(() => useFormattedAmountInput("1.1234567", 6));
    expect(result.current.formatErrorId).toBe("app.treasury.tooManyDecimals");
    expect(result.current.parsedAmount).toBeNull();
  });

  it("marks amounts above maxAmount as exceeding without erroring the format", () => {
    const { result } = renderHook(() => useFormattedAmountInput("2", 18, 1_000000000000000000n));
    expect(result.current.exceeds).toBe(true);
    expect(result.current.formatErrorId).toBeNull();
    expect(result.current.parsedAmount).toBe(2_000000000000000000n);
  });

  it("accepts amounts exactly at maxAmount", () => {
    const { result } = renderHook(() => useFormattedAmountInput("1", 18, 1_000000000000000000n));
    expect(result.current.exceeds).toBe(false);
  });
});

describe("FormattedAmountInput", () => {
  it("renders a decimal input and forwards raw changes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<FormattedAmountInput value="" onValueChange={onValueChange} aria-label="Amount" />);

    const input = screen.getByRole("textbox", { name: "Amount" });
    expect(input).toHaveAttribute("inputmode", "decimal");
    await user.type(input, "5");
    expect(onValueChange).toHaveBeenCalledWith("5");
  });

  it("wires the error region to the input via aria-describedby", () => {
    render(
      <FormattedAmountInput
        value="abc"
        onValueChange={() => {}}
        aria-label="Amount"
        error="Enter a valid amount."
      />
    );

    const input = screen.getByRole("textbox", { name: "Amount" });
    const error = screen.getByRole("alert");
    expect(error).toHaveTextContent("Enter a valid amount.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("renders the end slot beside the input", () => {
    render(
      <FormattedAmountInput
        value=""
        onValueChange={() => {}}
        aria-label="Amount"
        endSlot={<button type="button">Max</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Max" })).toBeInTheDocument();
  });

  it("keeps shared-owned row layout out of Tailwind utility classes", () => {
    render(
      <FormattedAmountInput
        value=""
        onValueChange={() => {}}
        aria-label="Amount"
        endSlot={<button type="button">Max</button>}
      />
    );

    const input = screen.getByRole("textbox", { name: "Amount" });
    const row = input.parentElement as HTMLElement;

    expect(row).toHaveStyle({
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
    });
    expect(row.className).toBe("");
  });
});
