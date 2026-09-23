import type { Meta, StoryObj } from "@storybook/react";
import { storySettlementOperations } from "@/views/Garden/Pool/poolStorySettlement";
import { SettlementOperationsCard } from "./SettlementOperationsCard";

const meta: Meta<typeof SettlementOperationsCard> = {
  title: "Admin/Community/SettlementOperationsCard",
  component: SettlementOperationsCard,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The settlement module's operations switches on the protocol pool: the pause flag and the gardener-delivery gate, shown from the chain, with the owner-only enable/disable behind an explicit confirmation.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md p-4" data-tone="community">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SettlementOperationsCard>;

export const OwnerDeliveryOff: Story = { args: { operations: storySettlementOperations() } };

export const OwnerDeliveryOn: Story = {
  args: { operations: storySettlementOperations({ gardenerDeliveryEnabled: true }) },
};

export const SafeSubmitted: Story = {
  args: {
    operations: storySettlementOperations({
      gardenerDeliveryEnabled: false,
      lastAct: {
        kind: "set-gardener-delivery",
        phase: "submitted",
        hash: `0x${"1".repeat(64)}`,
      },
    }),
  },
};

export const DeployerReadOnly: Story = {
  args: {
    operations: storySettlementOperations({
      isSettlementOwner: false,
      canConfigureDelivery: false,
      owner: "0x1b9ac97ea62f69521a14cbe6f45eb24ad6612c19",
    }),
  },
};

export const SourcePaused: Story = {
  args: { operations: storySettlementOperations({ sourcePaused: true }) },
};

export const ReadFailed: Story = {
  args: { operations: storySettlementOperations({ isError: true, gardenerDeliveryEnabled: null }) },
};
