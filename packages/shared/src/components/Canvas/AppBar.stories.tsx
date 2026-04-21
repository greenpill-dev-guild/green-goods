import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../.storybook/decorators";
import { AppBar } from "./AppBar";
import { GardenChip } from "./GardenChip";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const gardens = [
  { id: "g1", name: "Garden Alpha" },
  { id: "g2", name: "Jardim Botafogo" },
  { id: "g3", name: "Nairobi Greens" },
];

const gardenChipElement = (
  <GardenChip
    gardens={gardens}
    selectedGarden={gardens[0]}
    onSelectGarden={fn()}
    onCreateGarden={fn()}
  />
);

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Shared/Canvas/AppBar",
  component: AppBar,
  tags: ["autodocs"],
  decorators: [withCanvasFrame({ heightClassName: "min-h-[240px]" })],
  argTypes: {
    gardenChip: {
      control: false,
      description: "ReactNode for the garden chip (left side). Typically a GardenChip component.",
    },
    sheetContext: {
      control: "object",
      description: "When a side sheet is open, replaces the garden chip with a back arrow + label.",
    },
    onOpenSearch: {
      description:
        "Callback for the search button. When provided, the search icon appears (desktop only).",
    },
    onOpenSettings: {
      description: "Callback for the settings button. When provided, the settings icon appears.",
    },
    onOpenNotifications: {
      description:
        "Callback for the notification button. When omitted, the button opens the local popover fallback.",
    },
    onOpenProfile: {
      description: "Callback for the profile button. When provided, the person icon appears.",
    },
  },
} satisfies Meta<typeof AppBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default state: GardenChip on left, search + settings + profile on right. */
export const Default: Story = {
  args: {
    gardenChip: gardenChipElement,
    onOpenSearch: fn(),
    onOpenNotifications: fn(),
    onOpenSettings: fn(),
    onOpenProfile: fn(),
  },
};

/** Detail sheet active: back arrow + label replaces the garden chip. */
export const WithSheetContext: Story = {
  args: {
    gardenChip: gardenChipElement,
    sheetContext: {
      label: "Work Detail",
      onBack: fn(),
    },
    onOpenSearch: fn(),
    onOpenNotifications: fn(),
    onOpenSettings: fn(),
    onOpenProfile: fn(),
  },
};

/** Mobile layout: search is hidden; notifications, settings, and profile remain reachable. */
export const MobileActions: Story = {
  args: {
    gardenChip: gardenChipElement,
    onOpenSearch: fn(),
    onOpenNotifications: fn(),
    onOpenSettings: fn(),
    onOpenProfile: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

/** Agent state catalog for the app bar's primary shell states. */
export const StateCatalog: Story = {
  args: {
    gardenChip: gardenChipElement,
    onOpenSearch: fn(),
    onOpenNotifications: fn(),
    onOpenSettings: fn(),
    onOpenProfile: fn(),
  },
  render: () => (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="mb-3 px-4 text-sm font-semibold text-text-sub">
          Default (garden chip + all actions)
        </h3>
        <AppBar
          gardenChip={gardenChipElement}
          onOpenSearch={fn()}
          onOpenNotifications={fn()}
          onOpenSettings={fn()}
          onOpenProfile={fn()}
        />
      </section>

      <section>
        <h3 className="mb-3 px-4 text-sm font-semibold text-text-sub">
          Sheet Context (back arrow + label)
        </h3>
        <AppBar
          gardenChip={gardenChipElement}
          sheetContext={{ label: "Work Detail", onBack: fn() }}
          onOpenSearch={fn()}
          onOpenNotifications={fn()}
          onOpenSettings={fn()}
          onOpenProfile={fn()}
        />
      </section>

      <section>
        <h3 className="mb-3 px-4 text-sm font-semibold text-text-sub">
          Local notifications popover fallback
        </h3>
        <AppBar gardenChip={gardenChipElement} onOpenSearch={fn()} onOpenSettings={fn()} />
      </section>
    </div>
  ),
};
