import type { Meta, StoryObj } from "@storybook/react";
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
    vaultNetDeposited: 0n,
  },
} satisfies Meta<typeof CommunityEndowmentTab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MissingVault: Story = {};
export const Funded: Story = {
  args: {
    hasVaults: true,
    treasurySeverity: "none",
    vaultNetDeposited: 12_000_000_000_000_000_000n,
  },
};
