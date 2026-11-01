import type { Garden } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_BANNER,
} from "../../../../shared/.storybook/fixtures";
import { GardenSwitcherSheet } from "./GardenSwitcher";
import type { SwitcherRow } from "./homeGardens";

const garden = (id: string, name: string, location: string, bannerImage = "") =>
  ({ id, name, location, bannerImage }) as Garden;

const TAS_HUB = garden("0x6001", "TAS HUB", "Accra, Ghana", FIXTURE_IMAGE_BANNER);
const COMMUNITY = garden(
  "0x6002",
  "Green Goods Community Garden",
  "Everywhere",
  FIXTURE_IMAGE_AGROFORESTRY
);
const AIYELOJA = garden("0x6003", "Aiyeloja Family Garden", "Ìbàdàn, Nigeria");
const VIDA_VERDE = garden("0x6004", "Vida Verde", "São Paulo, Brazil");

const ROWS: SwitcherRow[] = [
  { garden: TAS_HUB, standing: "steward", active: true },
  { garden: COMMUNITY, standing: "steward", active: false },
  { garden: AIYELOJA, standing: "gardener", active: false },
  { garden: VIDA_VERDE, standing: "awaiting", active: false },
];

/**
 * The garden switcher (DL-125): a half sheet, Your Gardens, that the chip opens with one garden
 * too. One row per garden of the member's with its banner, place and role; the active garden is
 * a tinted row with a ring on its picture and no check mark, so every role keeps one slot. A
 * garden the member asked to join shows Awaiting review and visits instead of switching, and
 * Explore Gardens is last.
 */
const meta: Meta<typeof GardenSwitcherSheet> = {
  title: "Client/Sheets/GardenSwitcherSheet",
  component: GardenSwitcherSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    isOpen: true,
    onClose: fn(),
    rows: ROWS,
    onPick: fn(),
    onVisit: fn(),
    onExplore: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof GardenSwitcherSheet>;

/** Several gardens, one awaiting review: a pick switches, the request visits, Explore is last. */
export const YourGardens: Story = {
  play: async ({ args }) => {
    const sheet = within(await screen.findByRole("dialog", { name: "Your Gardens" }));
    await expect(sheet.getByText("You belong to 3 gardens.")).toBeVisible();
    const rows = sheet.getAllByRole("button").filter((row) => row.dataset.pressable === "row");
    await expect(rows.map((row) => row.textContent)).toEqual([
      "TAS HUBAccra, GhanaSteward",
      "Green Goods Community GardenEverywhereSteward",
      "Aiyeloja Family GardenÌbàdàn, NigeriaGardener",
      "Vida VerdeSão Paulo, BrazilAwaiting review",
      "Explore GardensFind a garden to join",
    ]);
    // Every role ends at the same edge: the active row carries no check mark.
    const roleEdges = rows
      .slice(0, 4)
      .map((row) => Math.round(row.lastElementChild?.getBoundingClientRect().right ?? 0));
    await expect(new Set(roleEdges).size).toBe(1);
    await expect(rows[0]).toHaveAttribute("aria-current", "true");
    await userEvent.click(rows[2]);
    await expect(args.onPick).toHaveBeenCalledWith(AIYELOJA.id);
    await userEvent.click(rows[3]);
    await expect(args.onVisit).toHaveBeenCalledWith(VIDA_VERDE.id);
    await userEvent.click(rows[4]);
    await expect(args.onExplore).toHaveBeenCalledOnce();
  },
};

/** One garden: the chip opens the switcher too, so Explore stays one tap away. */
export const OneGarden: Story = {
  args: { rows: [{ garden: TAS_HUB, standing: "gardener", active: true }] },
  play: async () => {
    const sheet = within(await screen.findByRole("dialog", { name: "Your Gardens" }));
    await expect(sheet.getByText("You belong to 1 garden.")).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Explore Gardens/ })).toBeVisible();
  },
};
