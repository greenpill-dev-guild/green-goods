import type { Meta, StoryObj } from "@storybook/react";
import { campaignCookieJarStoryDecorators } from "./CampaignCookieJar.stories.fixtures";
import { ReviewLine } from "./ReviewLine";

const meta: Meta<typeof ReviewLine> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/ReviewLine",
  component: ReviewLine,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof ReviewLine>;

export const Default: Story = {
  args: { label: "Payout", value: "5 USDC" },
};
