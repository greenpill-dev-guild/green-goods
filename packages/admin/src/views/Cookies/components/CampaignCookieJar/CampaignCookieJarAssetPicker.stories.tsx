import type { Meta, StoryObj } from "@storybook/react";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";
import { CampaignCookieJarAssetPicker } from "./CampaignCookieJarAssetPicker";

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
