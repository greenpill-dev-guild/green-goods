import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../../shared/.storybook/adminFixtures";
import { withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { STORY_MARIA } from "./poolStoryFixtures";
import { GardenPoolTarget, PoolTarget } from "./PoolTarget";

const meta: Meta<typeof PoolTarget> = {
  title: "Admin/Pool/PoolTarget",
  component: PoolTarget,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Names what a dialog's write changes, under its title: the pool, the one record inside it (a commitment), and who the act concerns (a claimant). The protocol pool is set apart as a warning, because a change there reaches beyond one garden.",
      },
    },
  },
  args: { target: { gardenName: "Aiyeloja Family Garden", isProtocol: false } },
  decorators: [
    (Story) => (
      <div className="max-w-md p-4" data-tone="garden">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PoolTarget>;

/** A garden's own pool. */
export const GardenPool: Story = {};

/** The protocol pool, set apart from every garden's. */
export const ProtocolPool: Story = {
  args: { target: { gardenName: "Green Goods Community Garden", isProtocol: true } },
};

/** A long garden name truncates on one line; the full name stays in the tooltip. */
export const LongGardenName: Story = {
  args: {
    target: {
      gardenName: "Cooperativa Agroecológica de Mujeres Rurales del Valle de Tenza",
      isProtocol: false,
    },
  },
};

/** One commitment inside the pool: what the inspector's dialogs name. */
export const CommitmentRecord: Story = {
  args: { record: "Ride to the market on Saturday" },
};

/** A decline names who asked, beside the commitment. */
export const RequestFrom: Story = {
  args: {
    record: "Ride to the market on Saturday",
    party: {
      label: "Request from",
      value: <AddressDisplay address={STORY_MARIA} interactive={false} />,
    },
  },
};

/** A commitment in the protocol pool keeps the warning, and names the record in it. */
export const ProtocolRecord: Story = {
  args: {
    target: { gardenName: "Green Goods Community Garden", isProtocol: true },
    record: "Repair the tool library's bike trailer",
  },
};

/**
 * The line a surface builds from a garden's address alone (the seed wizard,
 * the inspector): the name comes from the gardens list.
 */
export const FromGardenAddress: Story = {
  decorators: [withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS)],
  render: () => (
    <GardenPoolTarget
      chainId={DEFAULT_CHAIN_ID}
      garden={STORYBOOK_PRIMARY_ADMIN_GARDEN.id as Address}
      isProtocol={false}
      record="Ride to the market on Saturday"
    />
  ),
};
