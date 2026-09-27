import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { GardenChip } from "@green-goods/shared/components/Canvas/GardenChip";
import {
  RefreshActionProvider,
  useRefreshAction,
} from "@green-goods/shared/components/Canvas/RefreshActionContext";
import { withCanvasFrame } from "../../../../shared/.storybook/decorators";
import { AppBar } from "./AppBar";

const gardens = [
  { id: "g1", name: "Rio Claro Community Garden" },
  { id: "g2", name: "Jardim Botafogo" },
];

const gardenChipElement = (
  <GardenChip
    gardens={gardens}
    selectedGarden={gardens[0]}
    onSelectGarden={fn()}
    onCreateGarden={fn()}
  />
);

const meta = {
  title: "Admin/Shell/AppBar",
  component: AppBar,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Admin fork of the Canvas AppBar (Cockpit M3, finished). 56px transparent bar over the canvas wash: garden switcher pill on the left, 40px round icon buttons with the neutral ink state-layer hover on the right, closing with the 28px profile avatar circle.",
      },
    },
  },
  decorators: [withCanvasFrame({ heightClassName: "min-h-[240px]", workspace: "hub" })],
  args: {
    gardenChip: gardenChipElement,
    onOpenSearch: fn(),
    onOpenSettings: fn(),
    onOpenNotifications: fn(),
    onOpenProfile: fn(),
  },
} satisfies Meta<typeof AppBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /notifications/i }));
    await expect(args.onOpenNotifications).toHaveBeenCalled();
    await expect(canvas.getByRole("button", { name: /profile/i })).toBeInTheDocument();
  },
};

export const SheetContext: Story = {
  args: {
    sheetContext: { label: "Composting rotation — north beds", onBack: fn() },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Composting rotation — north beds")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /back/i })).toBeInTheDocument();
  },
};

const longNamedGardens = [
  { id: "g1", name: "Green Goods Community Garden" },
  { id: "g2", name: "TAS HUB" },
];

function WithRefresh({ children }: { children: ReactNode }) {
  useRefreshAction({ onRefresh: () => {} });
  return <>{children}</>;
}

/** On a phone the chip ends before the refresh and bell and truncates a long
 *  garden name, rather than running under them (D16). Mobile passes no search,
 *  settings, or profile action; those live in the Profile tab. */
export const PhoneLongGardenName: Story = {
  globals: { viewport: { value: "mobile" } },
  args: {
    gardenChip: (
      <GardenChip
        gardens={longNamedGardens}
        selectedGarden={longNamedGardens[0]}
        onSelectGarden={fn()}
        onCreateGarden={fn()}
      />
    ),
    onOpenSearch: undefined,
    onOpenSettings: undefined,
    onOpenProfile: undefined,
  },
  render: (args) => (
    <RefreshActionProvider>
      <WithRefresh>
        <AppBar {...args} />
      </WithRefresh>
    </RefreshActionProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /refresh/i })).toBeVisible();
    const chip = canvasElement.querySelector<HTMLElement>("[data-component='GardenChip']");
    const actions = canvasElement.querySelector<HTMLElement>("[data-slot='actions']");
    if (!chip || !actions) throw new Error("The app bar lost its chip or actions");
    await expect(chip.getBoundingClientRect().right).toBeLessThanOrEqual(
      actions.getBoundingClientRect().left
    );
  },
};
