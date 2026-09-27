import {
  COMMITMENT_COMPOSER_DEFAULTS,
  useCommitmentComposerForm,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentComposerForm";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";
import { SeedAmountField, type SeedAmountFieldProps } from "./SeedAmountField";

type StoryArgs = Omit<SeedAmountFieldProps, "form">;

/** The field reads and writes the real composer form, as the reward section does. */
function SeedAmountFieldWithForm(args: StoryArgs) {
  const form = useCommitmentComposerForm({
    ...COMMITMENT_COMPOSER_DEFAULTS,
    considerationAmount: args.value,
  });
  const stored = form.watch("considerationAmount");
  return (
    <div className="space-y-2">
      <SeedAmountField {...args} form={form} value={stored} />
      <p className="body-xs text-text-soft" data-testid="stored-base-units">
        Stored: {stored || "nothing"}
      </p>
    </div>
  );
}

const meta: Meta<StoryArgs> = {
  title: "Admin/Pool/SeedAmountField",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The declared reward's amount, typed in the token's own units and stored as the base units the contract records. It waits, and says why, while the token's units are unknown.",
      },
    },
  },
  args: {
    value: "",
    units: { status: "ready", decimals: 18, symbol: "G$" },
    disabled: false,
  },
  render: (args) => <SeedAmountFieldWithForm {...args} />,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** A stored 10 G$ reads as 10, not as 10 followed by eighteen zeros. */
export const GDollarPrefilled: Story = {
  args: { value: "10000000000000000000" },
};

/** A six-decimal token, like USDC: typing 2.5 stores 2500000. */
export const SixDecimalToken: Story = {
  args: { units: { status: "ready", decimals: 6, symbol: "USDC" } },
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByLabelText(/amount/i), "2.5");
  },
};

export const NoTokenYet: Story = {
  args: { units: { status: "waiting", reason: "noToken" } },
};

export const ReadingToken: Story = {
  args: { units: { status: "waiting", reason: "loading" } },
};

export const TokenUnreadable: Story = {
  args: { units: { status: "waiting", reason: "unreadable" } },
};

/** More decimals than the token has: said in place, and nothing is stored. */
export const TooManyDecimals: Story = {
  args: { units: { status: "ready", decimals: 6, symbol: "USDC" } },
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByLabelText(/amount/i), "1.1234567");
  },
};
