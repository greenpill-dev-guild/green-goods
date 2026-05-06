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
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component: [
          "**GardenChip** — garden context selector in the canvas AppBar. Anatomy aligned",
          "to handoff `screens/review.css` `.rv-pill`:",
          "",
          "- Flat `var(--surface-raised)` background, 1px `var(--outline)/0.10` border",
          "- No shadow (drops `glass-raised` from earlier rounds — keeps the AppBar quiet)",
          "- Tone-tinted leaf icon — `var(--tone-action)` resolves per `[data-tone]` ancestor",
          "- Selected dot mirrors the leaf color so context reads at a glance",
          "",
          "**Accessibility**:",
          "- Leaf icon is decorative (`aria-hidden`) — name is the accessible label",
          "- Multi-garden trigger uses Radix Popover for menu semantics",
          "- Focus ring uses `var(--tone-action, var(--green-800))`",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
          { id: "button-name", enabled: true },
        ],
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

/**
 * Tone matrix — the same chip rendered inside each `[data-tone]` scope so the
 * leaf-icon tinting can be verified at a glance. Hub blue, Garden green,
 * Community amber, Actions clay.
 */
export const ToneMatrix: Story = {
  args: {
    gardens: singleGarden,
    selectedGarden: singleGarden[0],
    onSelectGarden: fn(),
  },
  render: () => (
    <div className="grid grid-cols-2 gap-4 p-4">
      {(["hub", "garden", "community", "actions"] as const).map((tone) => (
        <div key={tone} data-tone={tone} className="rounded-2xl bg-bg-white-0 p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-soft">
            [data-tone="{tone}"]
          </div>
          <GardenChip
            gardens={singleGarden}
            selectedGarden={singleGarden[0]}
            onSelectGarden={fn()}
          />
        </div>
      ))}
    </div>
  ),
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
