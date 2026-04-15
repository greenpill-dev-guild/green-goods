import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
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
  title: "Canvas/AppBar",
  component: AppBar,
  tags: ["autodocs"],
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
    onOpenSettings: fn(),
    onOpenProfile: fn(),
  },
};

/** Sheet context active: back arrow + "Work Detail" label replaces the garden chip. */
export const WithSheetContext: Story = {
  args: {
    gardenChip: gardenChipElement,
    sheetContext: {
      label: "Work Detail",
      onBack: fn(),
    },
    onOpenSearch: fn(),
    onOpenSettings: fn(),
    onOpenProfile: fn(),
  },
};

/** Mobile layout: no search button (only settings + profile visible). */
export const MinimalMobile: Story = {
  args: {
    gardenChip: gardenChipElement,
    onOpenSettings: fn(),
    onOpenProfile: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

/** All variants side-by-side for visual comparison. */
export const Gallery: Story = {
  args: {
    gardenChip: gardenChipElement,
    onOpenSearch: fn(),
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
          onOpenSettings={fn()}
          onOpenProfile={fn()}
        />
      </section>

      <section>
        <h3 className="mb-3 px-4 text-sm font-semibold text-text-sub">
          Minimal (no search, no profile)
        </h3>
        <AppBar gardenChip={gardenChipElement} onOpenSettings={fn()} />
      </section>
    </div>
  ),
};

/** Dark mode rendering for visual verification. */
export const DarkMode: Story = {
  args: {
    gardenChip: gardenChipElement,
    onOpenSearch: fn(),
    onOpenSettings: fn(),
    onOpenProfile: fn(),
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
