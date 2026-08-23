import { Domain } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { withAdminPrimitiveFrame } from "../../../../shared/.storybook/decorators";
import { ActionDetailMediaTile } from "./ActionDetailPrimitives";

const meta = {
  title: "Admin/Workspaces/Actions/ActionDetailMediaTile",
  component: ActionDetailMediaTile,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  args: {
    alt: "Canopy baseline field evidence",
    domain: Domain.AGRO,
    title: "Canopy baseline",
  },
} satisfies Meta<typeof ActionDetailMediaTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DomainFallback: Story = {};

export const UnknownDomainFallback: Story = {
  args: { domain: null },
};
