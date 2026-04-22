import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
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
  title: "Shared/Canvas/GardenChip",
  component: GardenChip,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Garden context selector used in the canvas AppBar. Stories cover single-garden, multi-garden, all-gardens, and truncation states.",
      },
    },
  },
  argTypes: {
    gardens: {
      control: "object",
      description: "Array of gardens available for selection.",
    },
    selectedGarden: {
      control: "object",
      description: "The currently selected garden, or null for All Gardens.",
    },
    onSelectGarden: {
      description:
        "Callback when a garden is selected. Receives the garden object or null for All Gardens.",
    },
    onCreateGarden: {
      description:
        "Optional callback for the Create Garden action. When provided, a divider and create button appear in the dropdown.",
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

/** Multiple gardens with dropdown. Garden Alpha is selected. */
export const MultiGarden: Story = {
  args: {
    gardens: multipleGardens,
    selectedGarden: multipleGardens[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /garden alpha/i });
    await expect(trigger).toHaveAttribute("data-component", "GardenChip");
    await userEvent.click(trigger);
    const menu = await within(document.body).findByText("Jardim Botafogo");
    await userEvent.click(menu);
    await expect(args.onSelectGarden).toHaveBeenCalledWith(multipleGardens[1]);
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

/** Agent state catalog for the selector states agents most often need before tests. */
export const StateCatalog: Story = {
  args: {
    gardens: multipleGardens,
    selectedGarden: multipleGardens[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
  render: () => (
    <div className="flex flex-col gap-8 p-4">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-sub">Single Garden (static)</h3>
        <GardenChip gardens={singleGarden} selectedGarden={singleGarden[0]} onSelectGarden={fn()} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-sub">
          Multi Garden - Garden Alpha selected
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
