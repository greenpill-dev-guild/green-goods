import type { MintingState } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { MintProgress } from "./MintProgress";

function state(partial: Partial<MintingState> = {}): MintingState {
  return {
    status: "idle",
    metadataCid: null,
    allowlistCid: null,
    merkleRoot: null,
    userOpHash: null,
    txHash: null,
    hypercertId: null,
    error: null,
    poolRegistered: null,
    signalPoolAddress: null,
    ...partial,
  };
}

const meta: Meta<typeof MintProgress> = {
  title: "Admin/Workflows/Hypercerts/Steps/MintProgress",
  component: MintProgress,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Four-step progress indicator: metadata → allowlist → signing → confirming. Visual state (complete/active/failed/pending) is driven by `MintingState.status`.",
      },
    },
  },
  args: {
    chainId: 42161,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MintProgress>;

export const Idle: Story = {
  args: { state: state({ status: "idle" }) },
};

export const UploadingMetadata: Story = {
  args: { state: state({ status: "uploading_metadata" }) },
};

export const Signing: Story = {
  args: { state: state({ status: "awaiting_signature" }) },
};

export const Confirming: Story = {
  args: {
    state: state({
      status: "pending",
      txHash: "0xabcdef0000000000000000000000000000000000000000000000000000000000",
    }),
  },
};

export const Confirmed: Story = {
  args: {
    state: state({
      status: "confirmed",
      hypercertId: "42",
      txHash: "0xabcdef0000000000000000000000000000000000000000000000000000000000",
    }),
  },
};

export const Failed: Story = {
  args: {
    state: state({
      status: "failed",
      error: "Execution reverted: insufficient funds",
    }),
  },
};
