import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withAdminIdentity, withRouter } from "../../../../../shared/.storybook/decorators";
import { CommunityEndowmentTab } from "./CommunityEndowmentTab";
import { storyGarden } from "./communityStoryFixtures";

const meta = {
  title: "Admin/Workflows/Community/Endowment",
  component: CommunityEndowmentTab,
  tags: ["autodocs"],
  decorators: [withAdminIdentity, withRouter(["/community/endowment"])],
  parameters: { layout: "padded" },
  args: {
    garden: storyGarden,
    hasVaults: false,
    treasurySeverity: "warn",
    endowmentByAsset: [],
  },
} satisfies Meta<typeof CommunityEndowmentTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MissingVault: Story = {};
const dai = {
  asset: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
  symbol: "DAI",
  decimals: 18,
} as const;
const weth = {
  asset: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  symbol: "WETH",
  decimals: 18,
} as const;

export const Funded: Story = {
  args: {
    hasVaults: true,
    treasurySeverity: "none",
    endowmentByAsset: [{ ...dai, amount: 12_000_000_000_000_000_000n }],
  },
};

/** Each asset keeps its own line; WETH and DAI amounts never add up (D14). */
export const MultiAsset: Story = {
  args: {
    hasVaults: true,
    treasurySeverity: "none",
    endowmentByAsset: [
      { ...weth, amount: 500_000_000_000_000n },
      { ...dai, amount: 12_000_000_000_000_000_000n },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("0.0005 WETH")).toBeVisible();
    await expect(canvas.getByText("12 DAI")).toBeVisible();
  },
};
