import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { RiClipboardLine, RiFlashlightLine, RiSeedlingLine, RiTeamLine } from "@remixicon/react";
import { NavigationBar } from "./NavigationBar";
import type { ToolbarSlot } from "./FloatingToolbar";

const workSlot: ToolbarSlot = {
  id: "hub",
  label: "Hub",
  labelId: "cockpit.nav.hub",
  icon: RiClipboardLine,
  path: "/work",
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

const meta = {
  title: "Cockpit/NavigationBar",
  component: NavigationBar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    slots: {
      control: "object",
      description: "Navigation slots rendered in the floating cockpit navigation bar.",
    },
    activePath: {
      control: "text",
      description: "Currently active route path.",
    },
    onNavigate: {
      description: "Called when a navigation slot is selected.",
    },
  },
} satisfies Meta<typeof NavigationBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    slots: primarySlots,
    activePath: "/work",
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

export const SingleSlot: Story = {
  args: {
    slots: [workSlot, { ...gardenSlot, visible: false }, { ...communitySlot, visible: false }],
    activePath: "/work",
    onNavigate: fn(),
  },
};

export const HiddenActions: Story = {
  args: {
    slots: [workSlot, gardenSlot, communitySlot, { ...actionsSlot, visible: false }],
    activePath: "/garden",
    onNavigate: fn(),
  },
};

export const AllHidden: Story = {
  args: {
    slots: primarySlots.map((slot) => ({ ...slot, visible: false })),
    activePath: "/work",
    onNavigate: fn(),
  },
};

export const Gallery: Story = {
  args: {
    slots: primarySlots,
    activePath: "/work",
    onNavigate: fn(),
  },
  render: () => (
    <div className="flex min-h-screen flex-col gap-12 p-8">
      <section>
        <h3 className="mb-4 text-sm font-semibold text-text-sub">Four slots, Hub active</h3>
        <NavigationBar slots={primarySlots} activePath="/work" onNavigate={fn()} />
      </section>
      <section>
        <h3 className="mb-4 text-sm font-semibold text-text-sub">Community active</h3>
        <NavigationBar slots={primarySlots} activePath="/community" onNavigate={fn()} />
      </section>
      <section>
        <h3 className="mb-4 text-sm font-semibold text-text-sub">Single visible slot</h3>
        <NavigationBar
          slots={[
            workSlot,
            { ...gardenSlot, visible: false },
            { ...communitySlot, visible: false },
          ]}
          activePath="/work"
          onNavigate={fn()}
        />
      </section>
    </div>
  ),
};

export const DarkMode: Story = {
  args: {
    slots: primarySlots,
    activePath: "/actions",
    onNavigate: fn(),
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 min-h-screen p-4">
        <Story />
      </div>
    ),
  ],
};
