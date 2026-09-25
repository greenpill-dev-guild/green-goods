import type { Meta, StoryObj } from "@storybook/react";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";
import { GardenSelector } from "./GardenSelector";

const meta: Meta<typeof GardenSelector> = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/GardenSelector",
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
