import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import {
  withAdminIdentityRole,
  withPendingListing,
} from "../../../../shared/.storybook/decorators";
import { DEV_MOCK_AUTH_ADDRESSES } from "@green-goods/shared/providers/DevAuthProvider";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { CreateListingDialog } from "./CreateListingDialog";

const GARDEN_ADDRESS = "0x1234567890AbcdEF1234567890aBcdef12345678" as Address;
const HYPERCERT_ID = 123_456_789n;
const FRACTION_ID = 1n;

const meta: Meta<typeof CreateListingDialog> = {
  title: "Admin/Workflows/Hypercerts/CreateListingDialog",
  component: CreateListingDialog,
  tags: ["autodocs"],
  decorators: [withAdminIdentityRole("steward")],
  parameters: {
    docs: {
      description: {
        component:
          "Real `CreateListingDialog` in its configure phase. `useCreateListing` is wired but inert against the mock wagmi transport — clicking *Sign & List* sets the mutation in flight but never resolves. The progress tracker also preserves pending wallet submissions: confirmation checking refreshes listings, while Try Again and Sign & List remain unavailable until execution is resolved.",
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    gardenAddress: GARDEN_ADDRESS,
    hypercertId: HYPERCERT_ID,
    fractionId: FRACTION_ID,
  },
};

export default meta;
type Story = StoryObj<typeof CreateListingDialog>;

export const Configure: Story = {};

export const Closed: Story = {
  args: { open: false },
  parameters: {
    docs: {
      description: {
        story: "Dialog closed — verifies nothing renders when `open` is false.",
      },
    },
  },
};

export const Pending: Story = {
  decorators: [
    withPendingListing({
      account: DEV_MOCK_AUTH_ADDRESSES.steward,
      chainId: DEFAULT_CHAIN_ID,
      garden: GARDEN_ADDRESS,
      hypercertId: HYPERCERT_ID.toString(),
      currency: "0x0000000000000000000000000000000000000000",
      signature: "0xab",
      result: { hash: "0xPendingStoryProposal", sponsored: false, confirmation: "pending" },
    }),
  ],
  parameters: {
    docs: {
      description: {
        story:
          "A persisted pending listing. Closing retains the submission; confirmation and wallet-cancellation review remain available without another signature.",
      },
    },
  },
};
