import type { Meta, StoryObj } from "@storybook/react";
import { ReviewLine } from "./ReviewLine";
import { campaignCookieJarStoryDecorators } from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof ReviewLine> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/ReviewLine",
  component: ReviewLine,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof ReviewLine>;

export const Default: Story = {
  args: { label: "Payout", value: "5 USDC" },
};
