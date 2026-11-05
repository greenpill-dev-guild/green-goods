import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { JOURNEY_GARDEN_RECORD } from "../../../../shared/.storybook/clientJourneyFixtures";
import { withAppPage } from "../../../../shared/.storybook/decorators";
import { GardenMembershipCard } from "./GardenMembershipCard";

const meta = {
  title: "Client/Profile/GardenMembershipCard",
  component: GardenMembershipCard,
  tags: ["autodocs", "storybook-ci"],
  decorators: [
    withAppPage,
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
  globals: { viewport: { value: "mobile" } },
  args: {
    garden: JOURNEY_GARDEN_RECORD,
    role: "gardener",
    onHome: true,
    recovering: false,
    onOpen: fn(),
    onLeave: fn(),
  },
} satisfies Meta<typeof GardenMembershipCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveGarden: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: `Leave ${args.garden.name}` }));
    await expect(args.onLeave).toHaveBeenCalledOnce();
    await expect(args.onOpen).not.toHaveBeenCalled();
  },
};
export const AnotherGarden: Story = { args: { onHome: false, role: "steward" } };
export const Owner: Story = { args: { role: "owner" } };
export const PreviousDeparture: Story = {
  args: { role: undefined, onHome: false, recovering: true },
};
