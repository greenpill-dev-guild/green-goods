import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import {
  RiAddLine,
  RiClipboardLine,
  RiFlashlightLine,
  RiLeafLine,
  RiSeedlingLine,
  RiTeamLine,
} from "@remixicon/react";
import { NavigationBar, type ToolbarSlot } from "./NavigationBar";

const workSlot: ToolbarSlot = {
  id: "hub",
  label: "Hub",
  labelId: "cockpit.nav.hub",
  icon: RiClipboardLine,
  path: "/hub",
  visible: true,
};

const gardenSlot: ToolbarSlot = {
  id: "garden",
  label: "Garden",
  labelId: "cockpit.nav.garden",
  icon: RiSeedlingLine,
  path: "/garden",
  visible: true,
};

const communitySlot: ToolbarSlot = {
  id: "community",
  label: "Community",
  labelId: "cockpit.nav.community",
  icon: RiTeamLine,
  path: "/community",
  visible: true,
};

const actionsSlot: ToolbarSlot = {
  id: "actions",
  label: "Actions",
  labelId: "app.admin.nav.actions",
  icon: RiFlashlightLine,
  path: "/actions",
  visible: true,
};

const primarySlots: ToolbarSlot[] = [workSlot, gardenSlot, communitySlot, actionsSlot];

const submitWorkFab = {
  icon: RiAddLine,
  label: "Create",
  actions: [
    {
      id: "submit-work",
      icon: RiLeafLine,
      label: "Submit work",
      labelId: "app.admin.work.submitWork",
    },
  ],
  onAction: fn(),
};

const meta = {
  title: "Shared/Canvas/NavigationBar",
  component: NavigationBar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Floating canvas navigation dock. Stories cover visible route slots, permission-driven hidden slots, and the optional create FAB.",
      },
    },
  },
  argTypes: {
    slots: {
      control: "object",
      description: "Navigation slots rendered in the floating canvas navigation dock.",
    },
    activePath: {
      control: "text",
      description: "Currently active route path.",
    },
    onNavigate: {
      description: "Called when a navigation slot is selected.",
    },
    fab: {
      control: false,
      description: "Optional create-action FAB shown beside desktop nav or above mobile nav.",
    },
  },
} satisfies Meta<typeof NavigationBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    slots: primarySlots,
    activePath: "/hub",
    onNavigate: fn(),
  },
};

export const CommunityActive: Story = {
  args: {
    slots: primarySlots,
    activePath: "/community",
    onNavigate: fn(),
  },
};

export const SingleVisibleSlotHidden: Story = {
  args: {
    slots: [workSlot, { ...gardenSlot, visible: false }, { ...communitySlot, visible: false }],
    activePath: "/hub",
    onNavigate: fn(),
  },
  render: (args) => (
    <div className="p-8 text-sm text-text-sub">
      NavigationBar intentionally renders nothing when there is only one visible route and no FAB.
      <NavigationBar {...args} />
    </div>
  ),
};

export const HiddenActions: Story = {
  args: {
    slots: [workSlot, gardenSlot, communitySlot, { ...actionsSlot, visible: false }],
    activePath: "/garden",
    onNavigate: fn(),
  },
};

export const WithFab: Story = {
  args: {
    slots: primarySlots,
    activePath: "/hub",
    onNavigate: fn(),
    fab: submitWorkFab,
  },
};
