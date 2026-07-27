import type { Meta, StoryObj } from "@storybook/react";
import { CampaignCookieJarSubmittedState } from "./CampaignCookieJarCreateStates";
import {
  campaignCookieJarStoryDecorators,
  STORYBOOK_CAMPAIGN_JAR,
} from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof CampaignCookieJarSubmittedState> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/CreateStates",
  component: CampaignCookieJarSubmittedState,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarSubmittedState>;

export const SubmittedNeedsAddress: Story = {
  render: () => (
    <CampaignCookieJarSubmittedState
      hash="safe-tx-queued-1"
      manualInput={STORYBOOK_CAMPAIGN_JAR}
      manualAddress={STORYBOOK_CAMPAIGN_JAR}
      onManualInputChange={() => undefined}
      onUseManualAddress={() => undefined}
      onBackToList={() => undefined}
    />
  ),
};
