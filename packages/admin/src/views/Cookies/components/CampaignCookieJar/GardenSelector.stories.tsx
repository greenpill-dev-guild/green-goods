import type { Meta, StoryObj } from "@storybook/react";
import { GardenSelector } from "./GardenSelector";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";

const meta: Meta<typeof GardenSelector> = {
  title: "Admin/Workspaces/Cookies/CampaignCookieJar/GardenSelector",
  component: GardenSelector,
  tags: ["autodocs"],
  decorators: campaignCookieJarStoryDecorators,
};

export default meta;
type Story = StoryObj<typeof GardenSelector>;

export const Default: Story = {
  args: {
    gardens: campaignCookieJarCreateFormProps.gardens,
    selectedGardenIds: campaignCookieJarCreateFormProps.selectedGardenIds,
    onToggle: campaignCookieJarCreateFormProps.toggleGarden,
    onSelectMany: campaignCookieJarCreateFormProps.selectGardens,
    onClear: campaignCookieJarCreateFormProps.clearGardens,
    search: campaignCookieJarCreateFormProps.gardenSearch,
    setSearch: campaignCookieJarCreateFormProps.setGardenSearch,
  },
};
