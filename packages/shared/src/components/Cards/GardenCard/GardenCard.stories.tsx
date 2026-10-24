import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { FIXTURE_IMAGE_BANNER } from "../../../../.storybook/fixtures";
import { MediaCardSkeleton } from "../MediaCard";
import { GardenCard, type GardenCardData, GardenPicker } from "./GardenCard";

const GARDEN: GardenCardData = {
  id: "garden-1",
  name: "Community Permaculture Garden",
  location: "Portland, OR",
  bannerImage: FIXTURE_IMAGE_BANNER,
  // A steward who also gardens is one member (DL-049): three people here.
  gardeners: ["0x1111", "0x2222", "0x3333"],
  stewards: ["0x1111"],
};

const GARDENS: GardenCardData[] = [
  GARDEN,
  {
    id: "garden-2",
    name: "Ìbàdàn Food Forest",
    location: "Ìbàdàn, Oyo State, Nigeria",
    gardeners: ["0x4444", "0x5555"],
    stewards: ["0x6666"],
  },
  {
    id: "garden-3",
    name: "Riverside Cooperative Garden and Seed Library for the East Bank",
    gardeners: ["0x7777"],
    stewards: [],
  },
];

/** A list column at a phone's width, 12px between cards. */
function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-(--gg-list-gap)" style={{ width: 358 }}>
      {children}
    </div>
  );
}

const meta: Meta<typeof GardenCard> = {
  title: "Shared/Cards/GardenCard",
  component: GardenCard,
  tags: ["autodocs", "storybook-ci"],
  args: { garden: GARDEN, onClick: fn() },
  argTypes: { selected: { control: "boolean" } },
  parameters: {
    docs: {
      description: {
        component:
          "A garden in the installed app: the shared media card with the garden's banner (its photo, or its name's gradient), its name on one line, and how many members, then where. Home's list opens a garden from it; Submit Work chooses one with `GardenPicker`, the action picker's radio group.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof GardenCard>;

/** Home's list: each card opens its garden. */
export const HomeList: Story = {
  render: (args) => (
    <Column>
      {GARDENS.map((garden) => (
        <GardenCard key={garden.id} {...args} garden={garden} />
      ))}
    </Column>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("button", { name: /Community Permaculture Garden/ });
    await expect(card).toHaveAccessibleName(/3 members.*Portland, OR/);
    await userEvent.click(card);
    await expect(args.onClick).toHaveBeenCalledTimes(1);
    // A garden with no place says only its members.
    await expect(canvas.getByRole("button", { name: /Riverside/ })).toHaveAccessibleName(
      /1 member$/
    );
  },
};

/** While gardens load, empty cards hold their place. */
export const Loading: Story = {
  render: () => (
    <Column>
      <MediaCardSkeleton mediaShape="banner" />
      <MediaCardSkeleton mediaShape="banner" />
    </Column>
  ),
};

/** A garden picker that holds its own choice, the way Submit Work does. */
function PickerHarness() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div style={{ width: 390 }} className="overflow-hidden px-4">
      <GardenPicker
        gardens={GARDENS}
        value={value}
        onChange={setValue}
        label="Garden"
        layout="row"
        className="-mx-4 scroll-px-4 px-4"
      />
    </div>
  );
}

/** Submit Work: the gardens as the action picker's radio group, in one row that scrolls sideways. */
export const Picker: Story = {
  // storybook-quality-allow state-harness: PickerHarness owns the choice while rendering the real GardenPicker.
  render: () => <PickerHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const radios = canvas.getAllByRole("radio");
    await userEvent.tab();
    await expect(radios[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(radios[1]).toHaveFocus();
    await expect(radios[1]).toHaveAttribute("aria-checked", "false");
    await userEvent.keyboard(" ");
    await expect(radios[1]).toHaveAttribute("aria-checked", "true");
  },
};
