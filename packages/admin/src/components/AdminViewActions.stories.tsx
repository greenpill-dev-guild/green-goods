import {
  RiAddLine,
  RiExternalLinkLine,
  RiRefreshLine,
  RiSettings3Line,
  RiUserAddLine,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminViewActions } from "./AdminViewActions";

const meta: Meta<typeof AdminViewActions> = {
  title: "Admin/Primitives/AdminViewActions",
  component: AdminViewActions,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "Desktop view-action row for admin workspaces. It keeps the primary action rightmost and folds lower-priority actions into a Radix overflow menu.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminViewActions>;

const baseActions = [
  {
    id: "refresh",
    label: "Refresh",
    labelId: "app.common.refresh",
    icon: RiRefreshLine,
    onClick: fn(),
    variant: "ghost" as const,
  },
  {
    id: "invite",
    label: "Invite member",
    shortLabel: "Invite",
    labelId: "admin.community.inviteMember",
    icon: RiUserAddLine,
    onClick: fn(),
    variant: "secondary" as const,
  },
  {
    id: "create",
    label: "Create action",
    shortLabel: "Create",
    labelId: "admin.actions.create",
    icon: RiAddLine,
    onClick: fn(),
    variant: "primary" as const,
    primary: true,
  },
];

export const InlineActions: Story = {
  args: {
    items: baseActions,
  },
};

export const Overflow: Story = {
  args: {
    items: [
      {
        id: "open-public",
        label: "Open public page",
        labelId: "admin.garden.openPublic",
        icon: RiExternalLinkLine,
        onClick: fn(),
        variant: "ghost",
      },
      {
        id: "settings",
        label: "Garden settings",
        shortLabel: "Settings",
        labelId: "admin.garden.settings",
        icon: RiSettings3Line,
        onClick: fn(),
        variant: "secondary",
      },
      ...baseActions,
    ],
  },
};

export const DisabledAction: Story = {
  args: {
    items: [
      {
        ...baseActions[1],
        disabled: true,
      },
      baseActions[2],
    ],
  },
};
