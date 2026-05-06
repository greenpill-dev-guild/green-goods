import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../Button";
import { TxInlineFeedback } from "./TxInlineFeedback";

const meta: Meta<typeof TxInlineFeedback> = {
  title: "Shared/Feedback/TxInlineFeedback",
  component: TxInlineFeedback,
  tags: ["autodocs"],
  argTypes: {
    severity: {
      control: "select",
      options: ["error", "warning", "info"],
    },
    visible: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof TxInlineFeedback>;

export const Info: Story = {
  args: {
    visible: true,
    severity: "info",
    title: "Awaiting wallet confirmation",
    message: "Approve the transaction in your wallet to continue.",
  },
};

export const Warning: Story = {
  args: {
    visible: true,
    severity: "warning",
    title: "Allowance may be insufficient",
    message: "You may need to approve spending before the transaction can be submitted.",
  },
};

export const Error: Story = {
  args: {
    visible: true,
    severity: "error",
    title: "Transaction failed",
    message: "The latest simulation reverted. Review the inputs and try again.",
    action: (
      <Button size="sm" variant="secondary">
        Retry simulation
      </Button>
    ),
  },
};

export const HiddenReserve: Story = {
  args: {
    visible: false,
    severity: "info",
    title: "Hidden",
    message: "Reserved layout space for future inline feedback.",
  },
};
