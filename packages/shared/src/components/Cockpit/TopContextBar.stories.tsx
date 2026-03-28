import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { TopContextBar } from "./TopContextBar";
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

const sampleAvatar = (
  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-base text-xs font-bold text-white">
    AF
  </div>
);

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Cockpit/TopContextBar",
  component: TopContextBar,
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
    userAvatar: {
      control: false,
      description: "ReactNode for the user avatar displayed at the far right.",
    },
  },
} satisfies Meta<typeof TopContextBar>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Default state: GardenChip on left, search + settings + avatar on right. */
export const Default: Story = {
  args: {
    gardenChip: gardenChipElement,
    onOpenSearch: fn(),
    onOpenSettings: fn(),
    userAvatar: sampleAvatar,
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
    userAvatar: sampleAvatar,
  },
};

/** Mobile layout: no search button (only settings + avatar visible). */
export const MinimalMobile: Story = {
  args: {
    gardenChip: gardenChipElement,
    onOpenSettings: fn(),
    userAvatar: sampleAvatar,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

/** All variants side-by-side for visual comparison. */
export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="mb-3 px-4 text-sm font-semibold text-text-sub">
          Default (garden chip + all actions)
        </h3>
        <TopContextBar
          gardenChip={gardenChipElement}
          onOpenSearch={fn()}
          onOpenSettings={fn()}
          userAvatar={sampleAvatar}
        />
      </section>

      <section>
        <h3 className="mb-3 px-4 text-sm font-semibold text-text-sub">
          Sheet Context (back arrow + label)
        </h3>
        <TopContextBar
          gardenChip={gardenChipElement}
          sheetContext={{ label: "Work Detail", onBack: fn() }}
          onOpenSearch={fn()}
          onOpenSettings={fn()}
          userAvatar={sampleAvatar}
        />
      </section>

      <section>
        <h3 className="mb-3 px-4 text-sm font-semibold text-text-sub">
          Minimal (no search, no avatar)
        </h3>
        <TopContextBar gardenChip={gardenChipElement} onOpenSettings={fn()} />
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
    userAvatar: sampleAvatar,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
