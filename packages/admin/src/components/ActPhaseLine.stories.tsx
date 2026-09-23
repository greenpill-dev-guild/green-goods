import type { Meta, StoryObj } from "@storybook/react";
import { ActPhaseLine } from "./ActPhaseLine";

const HASH = `0x${"a".repeat(64)}` as const;

const meta: Meta<typeof ActPhaseLine> = {
  title: "Admin/Primitives/ActPhaseLine",
  component: ActPhaseLine,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The one line a single-signature act shows on the row it started from: waiting on the wallet, waiting on the chain, done in the row's own words, or failed with nothing changed.",
      },
    },
  },
  args: {
    chainId: 42161,
    confirmed: "Accepted. The request leaves this list once the index shows it.",
    phase: { status: "signing", key: "row" },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ActPhaseLine>;

export const Signing: Story = {};

export const Confirming: Story = {
  args: { phase: { status: "confirming", key: "row", hash: HASH } },
};

export const Confirmed: Story = {
  args: { phase: { status: "confirmed", key: "row", hash: HASH } },
};

/** A job-queue send kept on this device: not landed, and not a failure. */
export const Queued: Story = {
  args: { phase: { status: "queued", key: "row" } },
};

export const Failed: Story = {
  args: { phase: { status: "failed", key: "row" } },
};
