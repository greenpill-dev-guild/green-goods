import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { RiClipboardLine, RiSeedlingLine, RiTeamLine } from "@remixicon/react";
import { FloatingToolbar, type ToolbarSlot } from "./FloatingToolbar";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

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

const threeSlots: ToolbarSlot[] = [workSlot, gardenSlot, communitySlot];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Cockpit/FloatingToolbar",
  component: FloatingToolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    slots: {
      control: "object",
      description: "Array of toolbar slots. Hidden slots (visible: false) are excluded entirely.",
    },
    activePath: {
      control: "text",
      description: "The currently active route path, used to highlight the active slot.",
    },
    onNavigate: {
      description: "Callback fired when a toolbar slot is clicked. Receives the slot path.",
    },
  },
} satisfies Meta<typeof FloatingToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Three visible slots with Hub as the active tab. */
export const Default: Story = {
  args: {
    slots: threeSlots,
    activePath: "/work",
    onNavigate: fn(),
  },
};

/** Garden tab highlighted as the active slot. */
export const GardenActive: Story = {
  args: {
    slots: threeSlots,
    activePath: "/garden",
    onNavigate: fn(),
  },
};

/** Only one visible slot (evaluator-only scenario). Mobile bar is hidden. */
export const SingleSlot: Story = {
  args: {
    slots: [workSlot, { ...gardenSlot, visible: false }, { ...communitySlot, visible: false }],
    activePath: "/work",
    onNavigate: fn(),
  },
};

/** All slots hidden — component returns null. */
export const AllHidden: Story = {
  args: {
    slots: threeSlots.map((s) => ({ ...s, visible: false })),
    activePath: "/work",
    onNavigate: fn(),
  },
};

/** All variants side-by-side for visual comparison. */
export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-12 p-8">
      <section>
        <h3 className="mb-4 text-sm font-semibold text-text-sub">3 Slots — Hub Active</h3>
        <div className="relative h-64">
          <FloatingToolbar slots={threeSlots} activePath="/work" onNavigate={fn()} />
        </div>
      </section>
      <section>
        <h3 className="mb-4 text-sm font-semibold text-text-sub">3 Slots — Garden Active</h3>
        <div className="relative h-64">
          <FloatingToolbar slots={threeSlots} activePath="/garden" onNavigate={fn()} />
        </div>
      </section>
      <section>
        <h3 className="mb-4 text-sm font-semibold text-text-sub">Single Slot (evaluator-only)</h3>
        <div className="relative h-64">
          <FloatingToolbar
            slots={[
              workSlot,
              { ...gardenSlot, visible: false },
              { ...communitySlot, visible: false },
            ]}
            activePath="/work"
            onNavigate={fn()}
          />
        </div>
      </section>
    </div>
  ),
};

/** Dark mode rendering for visual verification. */
export const DarkMode: Story = {
  args: {
    slots: threeSlots,
    activePath: "/work",
    onNavigate: fn(),
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4 min-h-screen">
        <Story />
      </div>
    ),
  ],
};
