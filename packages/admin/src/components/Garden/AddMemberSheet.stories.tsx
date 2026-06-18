import type { Address } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminIdentity } from "../../../../shared/.storybook/decorators";
import { AddMemberSheet } from "./AddMemberSheet";

const meta: Meta<typeof AddMemberSheet> = {
  title: "Admin/Workflows/Garden/AddMemberSheet",
  component: AddMemberSheet,
  tags: ["autodocs"],
  decorators: [withAdminIdentity],
  parameters: {
    docs: {
      description: {
        component:
          "Left-anchored creation sheet for adding gardeners, replacing the centered AddMemberModal for the header Add member action. It opens in one click from any Garden view (declared at the always-mounted workspace shell) and stages MULTIPLE addresses — hex or ENS — into a pending list for a single batched submit; failed writes stay staged for retry. The sheet surface inherits the garden (green) workspace tint. Writes flow through `useGardenOperations`, inert against the Storybook mock transport.",
      },
    },
  },
  args: {
    gardenAddress: "0x1234567890123456789012345678901234567890" as Address,
    onClose: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof AddMemberSheet>;

/** Empty state — the address field plus a paste affordance and a disabled submit. */
export const Default: Story = {};
