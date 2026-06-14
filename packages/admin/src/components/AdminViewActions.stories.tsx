import { RiAddLine, RiCheckLine, RiExternalLinkLine, RiMedalLine } from "@remixicon/react";
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
          "Desktop view-action row for admin workspaces — the stable-trio grammar. The workspace's actions render in declaration order on every tab; only the active tab's action carries the filled variant, so button positions never shift while the emphasis moves with the tab.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminViewActions>;

/** The Hub trio with a different tab active per story — positions identical,
 *  only the fill moves. */
function hubTrio(activeId: "submit-work" | "create-assessment" | "create-hypercert" | "none") {
  return [
    {
      id: "submit-work",
      label: "Submit Work",
      labelId: "cockpit.hub.action.submitWork",
      icon: RiAddLine,
      onClick: fn(),
      variant: (activeId === "submit-work" ? "primary" : "secondary") as "primary" | "secondary",
      primary: activeId === "submit-work",
    },
    {
      id: "create-assessment",
      label: "Create Assessment",
      labelId: "cockpit.hub.action.createAssessment",
      icon: RiCheckLine,
      onClick: fn(),
      variant: (activeId === "create-assessment" ? "primary" : "secondary") as
        | "primary"
        | "secondary",
      primary: activeId === "create-assessment",
    },
    {
      id: "create-hypercert",
      label: "Create Hypercert",
      labelId: "cockpit.hub.action.createHypercert",
      icon: RiMedalLine,
      onClick: fn(),
      variant: (activeId === "create-hypercert" ? "primary" : "secondary") as
        | "primary"
        | "secondary",
      primary: activeId === "create-hypercert",
    },
  ];
}

export const WorkTabActive: Story = {
  args: { items: hubTrio("submit-work") },
};

export const CertifyTabActive: Story = {
  args: { items: hubTrio("create-hypercert") },
};

/** Read surfaces (Hub History, Garden Activity…) keep the trio outlined —
 *  no filled action, no FAB on mobile. */
export const ReadSurfaceAllOutlined: Story = {
  args: { items: hubTrio("none") },
};

export const WithGhostLink: Story = {
  args: {
    items: [
      {
        id: "view-public",
        label: "View public",
        labelId: "cockpit.garden.action.viewPublic",
        icon: RiExternalLinkLine,
        onClick: fn(),
        variant: "ghost",
      },
      ...hubTrio("submit-work").slice(0, 2),
    ],
  },
};

export const DisabledAction: Story = {
  args: {
    items: hubTrio("submit-work").map((action) =>
      action.id === "create-assessment" ? { ...action, disabled: true } : action
    ),
  },
};
