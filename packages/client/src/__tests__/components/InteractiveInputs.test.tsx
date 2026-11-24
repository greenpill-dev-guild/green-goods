/** @vitest-environment jsdom */

import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { FormInput } from "@/components/Inputs/TextField/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Inputs/Select/Select";
import { renderWithProviders, screen, userEvent } from "../test-utils";

function SelectHarness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState("offer");
  return (
    <Select value={value} onValueChange={setValue} disabled={disabled}>
      <SelectTrigger aria-label="Direction">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="offer">Offer</SelectItem>
        <SelectItem value="request">Request</SelectItem>
      </SelectContent>
    </Select>
  );
}

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("interactive input primitives", () => {
  it("opens Select from the keyboard and applies the chosen option", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SelectHarness />);

    const trigger = screen.getByRole("combobox", { name: "Direction" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("option", { name: "Request" }));

    expect(trigger).toHaveTextContent("Request");
  });

  it("keeps a disabled Select closed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SelectHarness disabled />);

    const trigger = screen.getByRole("combobox", { name: "Direction" });
    expect(trigger).toBeDisabled();
    await user.click(trigger);
    expect(screen.queryByRole("option", { name: "Request" })).not.toBeInTheDocument();
  });

  it("wires FormInput labels, errors, changes, and disabled state", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = renderWithProviders(
      <FormInput
        id="garden-name"
        label="Garden name"
        error="Name is required"
        onChange={onChange}
      />
    );

    const input = screen.getByRole("textbox", { name: "Garden name" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Name is required");
    await user.type(input, "Rocinha");
    expect(onChange).toHaveBeenCalled();

    rerender(<FormInput id="garden-name" label="Garden name" disabled />);
    expect(screen.getByRole("textbox", { name: "Garden name" })).toBeDisabled();
  });
});
