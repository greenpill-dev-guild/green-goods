import type { MintingState } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { MintingDialog } from "./MintingDialog";

function mintingState(partial: Partial<MintingState> = {}): MintingState {
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

const meta: Meta<typeof MintingDialog> = {
  title: "Admin/Workflows/Hypercerts/MintingDialog",
  component: MintingDialog,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Dialog that wraps `MintProgress` during the mint flow. Opens while the status is active (not idle/confirmed). Cancel/retry buttons render only on failure.",
      },
    },
    layout: "fullscreen",
  },
  args: {
    chainId: 42161,
    onCancel: fn(),
    onRetry: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof MintingDialog>;

export const UploadingMetadata: Story = {
  args: {
    mintingState: mintingState({ status: "uploading_metadata" }),
  },
};

export const AwaitingSignature: Story = {
  args: {
    mintingState: mintingState({ status: "awaiting_signature" }),
  },
};

export const Pending: Story = {
  args: {
    mintingState: mintingState({
      status: "pending",
      txHash: "0xabcdef0000000000000000000000000000000000000000000000000000000000",
    }),
  },
};

export const Failed: Story = {
  args: {
    mintingState: mintingState({
      status: "failed",
      error: "User rejected the request.",
    }),
  },
};

export const Hidden: Story = {
  args: {
    mintingState: mintingState({ status: "idle" }),
  },
  parameters: {
    docs: {
      description: {
        story: "Dialog closes when minting is idle or confirmed.",
      },
    },
  },
};
