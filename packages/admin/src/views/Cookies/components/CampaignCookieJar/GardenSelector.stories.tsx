import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
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

/**
 * A search that matches no garden says so, and Select Visible has nothing to select. (Selected
 * gardens stay listed whatever the search, so this starts with none selected.)
 */
export const NoMatches: Story = {
  tags: ["storybook-ci"],
  args: {
    ...Default.args,
    selectedGardenIds: [],
    search: "mangrove",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("No gardens match that search.")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Select Visible" })).toBeDisabled();
  },
};
