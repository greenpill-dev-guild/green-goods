import type { Meta, StoryObj } from "@storybook/react";
import { CampaignCookieJarAssetPicker } from "./CampaignCookieJarAssetPicker";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof CampaignCookieJarAssetPicker> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/AssetPicker",
  component: CampaignCookieJarAssetPicker,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarAssetPicker>;

export const Default: Story = {
  render: () => (
    <CampaignCookieJarAssetPicker
      assets={campaignCookieJarCreateFormProps.payoutAssets}
      selectedAssetId={campaignCookieJarCreateFormProps.selectedAssetId}
      onSelect={campaignCookieJarCreateFormProps.setSelectedAssetId}
    />
  ),
};
