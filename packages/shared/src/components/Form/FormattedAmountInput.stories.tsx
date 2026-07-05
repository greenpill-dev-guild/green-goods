import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { FormattedAmountInput, useFormattedAmountInput } from "./FormattedAmountInput";

const meta: Meta<typeof FormattedAmountInput> = {
  title: "Shared/Form/FormattedAmountInput",
  component: FormattedAmountInput,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The one decimal-amount input behind the funding flows (send, cookie-jar withdraw, donate, claim, endow). The component owns structure + a11y wiring (inputMode=decimal, aria-describedby error region, end slot); visuals come from the consumer's classes so each surface stays pixel-identical. Pair it with `useFormattedAmountInput(value, decimals, maxAmount?)` for the parse/validate pipeline.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormattedAmountInput>;

const DEMO_INPUT_CLASSES =
  "w-full rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20";

function ValidatingDemo({ maxAmount }: { maxAmount?: bigint }) {
  const [value, setValue] = useState("");
  const state = useFormattedAmountInput(value, 18, maxAmount);
  const error = state.formatErrorId
    ? "Enter a valid amount."
    : state.exceeds
      ? "Amount exceeds your balance."
      : null;
  return (
    <div className="max-w-sm">
      <FormattedAmountInput
        value={value}
        onValueChange={setValue}
        placeholder="0.0"
        aria-label="Amount"
        inputClassName={DEMO_INPUT_CLASSES}
        errorClassName="mt-2 text-xs text-error-dark"
        error={error}
        endSlot={
          <button
            type="button"
            onClick={() => setValue("1.5")}
            className="min-h-11 min-w-11 rounded-md border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-xs font-medium text-text-sub-600"
          >
            Max
          </button>
        }
      />
      <p className="mt-3 text-xs text-text-sub-600">
        parsed: {state.parsedAmount === null ? "—" : `${state.parsedAmount} wei`}
      </p>
    </div>
  );
}

/** Live parse/validate pipeline: type an amount, use Max, break the format. */
export const Validating: Story = {
  // storybook-quality-allow state-harness: exercises the real hook + component pair.
  render: () => <ValidatingDemo maxAmount={2_000000000000000000n} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Amount" });
    await expect(input).toHaveAttribute("inputmode", "decimal");

    await userEvent.type(input, "1.5");
    await expect(canvas.getByText(/1500000000000000000 wei/)).toBeVisible();

    await userEvent.clear(input);
    await userEvent.type(input, "1.2.3");
    const error = await canvas.findByRole("alert");
    await expect(error).toHaveTextContent("Enter a valid amount.");
    await expect(input).toHaveAttribute("aria-describedby", error.id);

    await userEvent.clear(input);
    await userEvent.type(input, "3");
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Amount exceeds your balance."
    );
  },
};

/** Error state supplied by the consumer (message selection stays with the flow). */
export const WithError: Story = {
  args: {
    value: "abc",
    onValueChange: () => {},
    "aria-label": "Amount",
    inputClassName: DEMO_INPUT_CLASSES,
    errorClassName: "mt-2 text-xs text-error-dark",
    error: "Enter a valid amount.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("alert")).toHaveTextContent("Enter a valid amount.");
    await expect(canvas.getByRole("textbox", { name: "Amount" })).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  },
};
