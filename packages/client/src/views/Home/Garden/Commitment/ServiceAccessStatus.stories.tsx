import type { Meta, StoryObj } from "@storybook/react";
import { ServiceAccessStatus } from "./ServiceAccessStatus";
import { serviceAccessStorySnapshot } from "./serviceAccessStoryFixtures";

const meta: Meta<typeof ServiceAccessStatus> = {
  title: "Client/Commitments/ServiceAccessStatus",
  component: ServiceAccessStatus,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { snapshot: serviceAccessStorySnapshot() },
};
export default meta;
type Story = StoryObj<typeof ServiceAccessStatus>;
export const CanonicalOffer: Story = {};
export const UnknownAssetUnits: Story = {
  args: {
    snapshot: (() => {
      const state = serviceAccessStorySnapshot();
      state.offer!.voucher!.asset = {
        ...state.offer!.voucher!.asset,
        decimals: null,
        symbol: null,
      };
      return state;
    })(),
  },
};
