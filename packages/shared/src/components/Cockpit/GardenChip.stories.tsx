import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { GardenChip } from "./GardenChip";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const singleGarden = [{ id: "g1", name: "Jardim Botafogo" }];

const multipleGardens = [
  { id: "g1", name: "Garden Alpha" },
  { id: "g2", name: "Jardim Botafogo" },
  { id: "g3", name: "Nairobi Greens" },
];

const longNameGarden = [
  {
    id: "g-long",
    name: "The Extraordinarily Long-Named Regenerative Community Garden of Greater Metropolitan Area",
  },
  { id: "g2", name: "Jardim Botafogo" },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Cockpit/GardenChip",
  component: GardenChip,
  tags: ["autodocs"],
  argTypes: {
    gardens: {
      control: "object",
      description: "Array of gardens available for selection.",
    },
    selectedGarden: {
      control: "object",
      description: "The currently selected garden, or null for 'All Gardens'.",
    },
    onSelectGarden: {
      description:
        "Callback when a garden is selected. Receives the garden object or null for 'All Gardens'.",
    },
    onCreateGarden: {
      description:
        "Optional callback for the 'Create Garden' action. When provided, a divider and create button appear in the dropdown.",
    },
  },
} satisfies Meta<typeof GardenChip>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Single garden — static label, no dropdown. */
export const SingleGarden: Story = {
  args: {
    gardens: singleGarden,
    selectedGarden: singleGarden[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
};

/** Multiple gardens with dropdown. "Garden Alpha" is selected. */
export const MultiGarden: Story = {
  args: {
    gardens: multipleGardens,
    selectedGarden: multipleGardens[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
};

/** No garden selected — shows "All Gardens" label. */
export const AllGardens: Story = {
  args: {
    gardens: multipleGardens,
    selectedGarden: null,
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
};

/** Garden with a very long name to test truncation behavior. */
export const LongName: Story = {
  args: {
    gardens: longNameGarden,
    selectedGarden: longNameGarden[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
};

/** All variants side-by-side for visual comparison. */
export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-8 p-4">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-sub">Single Garden (static)</h3>
        <GardenChip gardens={singleGarden} selectedGarden={singleGarden[0]} onSelectGarden={fn()} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-sub">
          Multi Garden — "Garden Alpha" selected
        </h3>
        <GardenChip
          gardens={multipleGardens}
          selectedGarden={multipleGardens[0]}
          onSelectGarden={fn()}
          onCreateGarden={fn()}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-sub">Multi Garden — All Gardens</h3>
        <GardenChip
          gardens={multipleGardens}
          selectedGarden={null}
          onSelectGarden={fn()}
          onCreateGarden={fn()}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-sub">Long Name (truncation test)</h3>
        <GardenChip
          gardens={longNameGarden}
          selectedGarden={longNameGarden[0]}
          onSelectGarden={fn()}
          onCreateGarden={fn()}
        />
      </section>
    </div>
  ),
};

/** Dark mode rendering for visual verification. */
export const DarkMode: Story = {
  args: {
    gardens: multipleGardens,
    selectedGarden: multipleGardens[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
