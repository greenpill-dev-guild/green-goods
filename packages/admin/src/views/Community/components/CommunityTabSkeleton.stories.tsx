import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { CommunityTabSkeleton } from "./CommunityTabSkeleton";

const meta = {
  title: "Admin/Workflows/Community/Loading",
  component: CommunityTabSkeleton,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <IntlProvider locale="en" messages={{ "app.garden.detail.community.loading": "Loading" }}>
        <Story />
      </IntlProvider>
    ),
  ],
  parameters: { layout: "padded" },
  args: { mode: "members" },
} satisfies Meta<typeof CommunityTabSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Members: Story = {};
export const Coordination: Story = { args: { mode: "coordination" } };
export const Endowment: Story = { args: { mode: "endowment" } };
export const Payouts: Story = { args: { mode: "payouts" } };
