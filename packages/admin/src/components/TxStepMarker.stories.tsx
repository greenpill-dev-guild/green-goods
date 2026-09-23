import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { TxStepMarker } from "./TxStepMarker";

const meta: Meta<typeof TxStepMarker> = {
  title: "Admin/Primitives/TxStepMarker",
  component: TxStepMarker,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component: [
          "**TxStepMarker** — the circle beside one step of an on-chain act.",
          "A number while it waits, a spinner while it runs, a check once the",
          "chain shows it, a clock where it was left to send later, a cross where",
          "it stopped.",
          "",
          "Used by every multi-signature surface (hypercert minting, pool",
          "setup, seeding commitments) so progress reads the same everywhere.",
          "Decorative: the step's own text carries its state for screen readers.",
        ].join("\n"),
      },
    },
  },
  args: { state: "pending", label: 1, size: "md" },
};

export default meta;
type Story = StoryObj<typeof TxStepMarker>;

export const Pending: Story = {};

export const Active: Story = { args: { state: "active" } };

export const Complete: Story = { args: { state: "complete" } };

/** Left to send later: not done, and not a failure either. */
export const Queued: Story = { args: { state: "queued" } };

export const Failed: Story = { args: { state: "failed" } };

/** Every state side by side, at both sizes. */
export const AllStates: Story = {
  render: () => (
    <div className="space-y-3">
      {(["md", "sm"] as const).map((size) => (
        <div key={size} className="flex items-center gap-3">
          <TxStepMarker state="pending" label={3} size={size} />
          <TxStepMarker state="active" size={size} />
          <TxStepMarker state="complete" size={size} />
          <TxStepMarker state="queued" size={size} />
          <TxStepMarker state="warning" size={size} />
          <TxStepMarker state="failed" size={size} />
        </div>
      ))}
    </div>
  ),
};
