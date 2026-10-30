import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { FIXTURE_IMAGE_AGROFORESTRY, FIXTURE_IMAGE_BANNER } from "../../../.storybook/fixtures";
import { GardenChip } from "./GardenChip";

const gardens = [
  { id: "g1", name: "Garden Alpha", bannerImage: FIXTURE_IMAGE_AGROFORESTRY },
  { id: "g2", name: "Jardim Botafogo", bannerImage: FIXTURE_IMAGE_BANNER },
  { id: "g3", name: "Nairobi Greens", bannerImage: "" },
];

const LONG_NAME =
  "The Extraordinarily Long-Named Regenerative Community Garden of Greater Metropolitan Area";
const longNamedGardens = [
  { id: "g-long", name: LONG_NAME, bannerImage: "" },
  { id: "g2", name: "Jardim Botafogo", bannerImage: FIXTURE_IMAGE_BANNER },
];

const MENU = '[data-component="GardenChip"][data-slot="menu"]';

/** Presses the chip and waits for its menu, whose code arrives with that first press. */
async function openMenu(canvasElement: HTMLElement) {
  await userEvent.click(within(canvasElement).getByRole("button"));
  const menu = await waitFor(
    () => {
      const element = document.querySelector<HTMLElement>(MENU);
      if (!element) throw new Error("The garden menu has not opened.");
      return element;
    },
    { timeout: 5_000 }
  );
  return {
    menu,
    options: Array.from(menu.querySelectorAll<HTMLElement>('[data-slot="option"]')),
    createAction: menu.querySelector<HTMLElement>('[data-slot="create-action"]'),
  };
}

const meta = {
  title: "Shared/Canvas/GardenChipMenu",
  // The menu is the chip's own trigger and popover, and the chip loads it with its first press,
  // so every story opens it the way the cockpit does: through the chip, with the chip's props.
  component: GardenChip,
  tags: ["storybook-ci"],
  parameters: {
    surface: "admin",
    docs: {
      description: {
        component:
          "**GardenChipMenu**: the cockpit chip's garden menu (D47, D50), the gardens with the chosen one marked, then a divider and Create Garden. `GardenChip` loads it with the chip's first press, so the installed app, which opens its own switcher, never downloads it. Each story presses the chip and stays open.",
      },
    },
  },
  args: {
    gardens,
    selectedGarden: gardens[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
} satisfies Meta<typeof GardenChip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The first press brings the menu in open. Escape closes it and hands focus back to the chip,
 * and the next press opens it again.
 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const { options, createAction } = await openMenu(canvasElement);
    await expect(options.map((option) => option.textContent)).toEqual(
      gardens.map((garden) => garden.name)
    );
    await expect(options[0]).toHaveAttribute("data-state", "selected");
    await expect(createAction).toHaveTextContent("Create Garden");

    await userEvent.keyboard("{Escape}");
    const chip = within(canvasElement).getByRole("button");
    await waitFor(() => expect(document.querySelector(MENU)).toBeNull());
    await expect(chip).toHaveFocus();

    await userEvent.click(chip);
    await waitFor(() => expect(document.querySelector(MENU)).not.toBeNull());
  },
};

/** Nothing chosen yet: the chip asks for a garden and no row is marked. */
export const NothingChosen: Story = {
  args: { selectedGarden: null },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("button")).toHaveTextContent("Select Garden");
    const { options } = await openMenu(canvasElement);
    await expect(options).toHaveLength(gardens.length);
    for (const option of options) {
      await expect(option).toHaveAttribute("data-state", "unselected");
    }
  },
};

/** Where the steward cannot create a garden, the menu ends with the gardens. */
export const WithoutCreateGarden: Story = {
  args: { showCreateGardenAction: false },
  play: async ({ canvasElement }) => {
    const { options, createAction } = await openMenu(canvasElement);
    await expect(options).toHaveLength(gardens.length);
    await expect(createAction).toBeNull();
  },
};

/** A long name sizes the menu up to the viewport less its margins, and keeps its full title. */
export const LongName: Story = {
  args: { gardens: longNamedGardens, selectedGarden: longNamedGardens[0] },
  play: async ({ canvasElement }) => {
    const { menu, options } = await openMenu(canvasElement);
    await expect(menu.getBoundingClientRect().width).toBeLessThanOrEqual(window.innerWidth - 32);
    await expect(options[0].querySelector("span")).toHaveAttribute("title", LONG_NAME);
  },
};
