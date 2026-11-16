import type { Meta, StoryObj } from "@storybook/react";
import { withAdminIdentity } from "../../../../shared/.storybook/decorators";
import { HypercertEvidence } from "./HypercertEvidence";

const meta: Meta<typeof HypercertEvidence> = {
  title: "Admin/Workflows/Garden/HypercertEvidence",
  component: HypercertEvidence,
  decorators: [withAdminIdentity],
  args: { attestations: [], isLoading: false, hasError: false },
};

export default meta;
type Story = StoryObj<typeof HypercertEvidence>;

export const Loading: Story = {
  args: { isLoading: true },
};

export const Unavailable: Story = {
  args: { hasError: true },
};

export const NoVisibleEvidence: Story = {};
