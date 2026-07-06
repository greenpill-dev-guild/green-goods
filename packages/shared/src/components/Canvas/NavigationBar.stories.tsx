import {
  RiAddLine,
  RiClipboardLine,
  RiFlashlightLine,
  RiLeafLine,
  RiSeedlingLine,
  RiTeamLine,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
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

// Multi-action FAB — collapses to a neutral "+" opener that fans out a speed
// dial. The primary action lives only inside the dial (never duplicated on the
// collapsed button).
const speedDialFab = {
  icon: RiAddLine,
  label: "Create",
  actions: [
    {
      id: "submit-work",
      icon: RiLeafLine,
      label: "Submit work",
      labelId: "app.admin.work.submitWork",
    },
    {
      id: "create-assessment",
      icon: RiClipboardLine,
      label: "Create assessment",
      labelId: "cockpit.hub.action.createAssessment",
    },
    {
      id: "create-hypercert",
      icon: RiSeedlingLine,
      label: "Create hypercert",
      labelId: "cockpit.hub.action.createHypercert",
    },
  ],
  onAction: fn(),
};

const meta = {
  title: "Shared/Canvas/NavigationBar",
  component: NavigationBar,
  tags: ["autodocs", "storybook-ci"],
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
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /hub/i })).toHaveAttribute(
      "data-state",
      "active"
    );
    await userEvent.click(canvas.getByRole("button", { name: /garden/i }));
    await expect(args.onNavigate).toHaveBeenCalledWith("/garden");
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

export const Mobile: Story = {
  args: {
    slots: primarySlots,
    activePath: "/garden",
    onNavigate: fn(),
    fab: submitWorkFab,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

// Multi-action FAB on mobile: a neutral "+" opener that fans out the speed dial.
// Guards the fix for the collapsed button reading "Submit work" and duplicating
// it inside the dial.
export const MobileSpeedDial: Story = {
  args: {
    slots: primarySlots,
    activePath: "/hub",
    onNavigate: fn(),
    fab: speedDialFab,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Collapsed FAB is a neutral "+" opener — it must NOT surface the primary
    // action's label (the bug: "Submit work" showed on the button AND in the dial).
    const opener = canvas.getByRole("button", { name: /open actions/i });
    await expect(opener).toHaveAttribute("aria-haspopup", "menu");
    await expect(opener).not.toHaveTextContent(/submit work/i);
    // Opening the dial reveals each action once (no duplicated primary).
    await userEvent.click(opener);
    await expect(opener).toHaveAttribute("aria-expanded", "true");
    await canvas.findByRole("button", { name: /submit work/i });
    await canvas.findByRole("button", { name: /create hypercert/i });
  },
};

export const StateCatalog: Story = {
  args: {
    slots: primarySlots,
    activePath: "/community",
    onNavigate: fn(),
    fab: submitWorkFab,
  },
  render: (args) => (
    <div className="relative min-h-[420px] p-6">
      <div className="max-w-sm rounded-lg bg-bg-soft p-4 text-sm text-text-sub shadow-[var(--edge-rest)]">
        Desktop dock with Community active and a single-action FAB.
      </div>
      <NavigationBar {...args} />
    </div>
  ),
};
