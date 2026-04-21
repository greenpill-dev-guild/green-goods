import type { Address } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity } from "../../../../shared/.storybook/decorators";
import { CreateListingDialog } from "./CreateListingDialog";

const GARDEN_ADDRESS = "0x1234567890AbcdEF1234567890aBcdef12345678" as Address;
const HYPERCERT_ID = 123_456_789n;
const FRACTION_ID = 1n;

const meta: Meta<typeof CreateListingDialog> = {
  title: "Admin/Workflows/Hypercerts/CreateListingDialog",
  component: CreateListingDialog,
  tags: ["autodocs"],
  decorators: [withAdminIdentity],
  parameters: {
    docs: {
      description: {
        component:
          "Real `CreateListingDialog` in its configure phase. `useCreateListing` is wired but inert against the mock wagmi transport — clicking *Sign & List* sets the mutation in flight but never resolves. The in-progress / done / error visual states ride the same `MintProgress`-style step tracker, covered under `Admin/Workflows/Hypercerts/Steps/MintProgress`.",
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
