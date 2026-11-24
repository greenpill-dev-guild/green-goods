import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Meta, StoryObj } from "@storybook/react";
import { withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { MemberIdentity } from "./MemberIdentity";

const address = "0x18c4a9f3b2d1e0f9a8b7c6d5e4f3a2b1c0d9ea67";
const meta = {
  title: "Admin/Workflows/Garden/MemberIdentity",
  component: MemberIdentity,
  tags: ["autodocs"],
  decorators: [withSeededQueryClient([[queryKeys.ens.name(address.toLowerCase()), "rosa.eth"]])],
  args: { address },
} satisfies Meta<typeof MemberIdentity>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-72">
        <Story />
      </div>
    ),
  ],
};
