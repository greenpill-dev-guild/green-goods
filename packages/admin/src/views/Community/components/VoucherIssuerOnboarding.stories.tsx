import type { Meta, StoryObj } from "@storybook/react";
import { VoucherIssuerOnboarding } from "./VoucherIssuerOnboarding";
import { voucherIssuerStoryRoute } from "./voucherIssuerStoryFixtures";

const meta: Meta<typeof VoucherIssuerOnboarding> = {
  title: "Admin/Community/VoucherIssuerOnboarding",
  component: VoucherIssuerOnboarding,
  tags: ["autodocs"],
  args: { canPrepare: true },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4" data-tone="community">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;
export const AwaitingLiveInputs: Story = {};
export const FictionalMember: Story = {
  args: { routes: [voucherIssuerStoryRoute()], rehearsal: true },
};
export const ReadOnly: Story = {
  args: { canPrepare: false, routes: [voucherIssuerStoryRoute()], rehearsal: true },
};
const incomplete = voucherIssuerStoryRoute();
incomplete.assets[0]!.service.capacityConfirmed = false;
export const UnconfirmedCapacity: Story = { args: { routes: [incomplete], rehearsal: true } };
