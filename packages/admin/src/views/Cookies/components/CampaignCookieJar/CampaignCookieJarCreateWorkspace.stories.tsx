import type { Meta, StoryObj } from "@storybook/react";
import { CampaignCookieJarCreateWorkspace } from "./CampaignCookieJarCreateWorkspace";
import { campaignCookieJarStoryDecorators } from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof CampaignCookieJarCreateWorkspace> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/CreateWorkspace",
  component: CampaignCookieJarCreateWorkspace,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof CampaignCookieJarCreateWorkspace>;

export const Default: Story = {
  render: () => <CampaignCookieJarCreateWorkspace onCancel={() => undefined} />,
};
