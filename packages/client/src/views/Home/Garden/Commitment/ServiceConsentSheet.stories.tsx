import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ServiceConsentSheet } from "./ServiceConsentSheet";
import { serviceAccessStorySnapshot } from "./serviceAccessStoryFixtures";

const meta: Meta<typeof ServiceConsentSheet> = {
  title: "Client/Commitments/ServiceConsentSheet",
  component: ServiceConsentSheet,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    open: true,
    mode: "request",
    snapshot: serviceAccessStorySnapshot(),
    isPending: false,
    onOpenChange: fn(),
    onConfirm: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof ServiceConsentSheet>;
export const ReviewVoucherTerms: Story = {};
export const Sending: Story = { args: { isPending: true } };
export const NoEligibleBuyerGarden: Story = {
  args: { snapshot: { ...serviceAccessStorySnapshot(), eligibleBuyerGardens: [] } },
};
