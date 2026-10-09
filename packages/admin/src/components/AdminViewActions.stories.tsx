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
          "Desktop view-action row for admin workspaces — the stable-trio grammar. Action labels resolve from each item’s message ID in the active locale, with the declared label as the fallback. The workspace's actions render in declaration order on every tab, and its one declared primary sorts rightmost, so button positions never shift. The primary renders filled, except on a review surface such as the Hub, where the whole set renders outlined (DL-043).",
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

/** The Hub is a review surface: its trio renders outlined, and Submit Work,
 *  the declared primary, still sorts rightmost and fills the FAB (DL-043). */
export const HubTrioOutlined: Story = {
  args: {
    items: hubTrio("none").map((action) =>
      action.id === "submit-work" ? { ...action, primary: true } : action
    ),
  },
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
        label: "View Public",
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
