import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_BANNER,
  FIXTURE_IMAGE_EDU,
} from "../../../.storybook/fixtures";
import {
  MediaCardPicker,
  type MediaCardPickerOption,
  type MediaCardPickerProps,
} from "./MediaCardPicker";

function Banner({ src }: { src: string }) {
  return <img src={src} alt="" className="h-full w-full object-cover" />;
}

const OPTIONS: MediaCardPickerOption[] = [
  {
    value: "ridge",
    title: "Eastern Ridge",
    media: <Banner src={FIXTURE_IMAGE_BANNER} />,
    details: "24 members",
  },
  {
    value: "river",
    title: "Riverside Commons",
    media: <Banner src={FIXTURE_IMAGE_AGROFORESTRY} />,
    details: "11 members",
    // A card that cannot be chosen now: the arrow keys pass over it.
    disabled: true,
  },
  {
    value: "school",
    title: "School Garden",
    media: <Banner src={FIXTURE_IMAGE_EDU} />,
    details: "6 members",
  },
];

/** A picker that holds its own choice, the way the surfaces do. */
function Harness(props: MediaCardPickerProps) {
  const [value, setValue] = useState(props.value);
  return (
    <MediaCardPicker
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange(next);
      }}
    />
  );
}

const meta: Meta<typeof MediaCardPicker> = {
  title: "Shared/Cards/MediaCardPicker",
  component: MediaCardPicker,
  tags: ["autodocs", "storybook-ci"],
  args: { options: OPTIONS, value: null, label: "Garden", onChange: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "The radio group under the action and garden pickers: media cards with a 104px banner, one tab stop (the chosen card, or the first), the arrow keys and Home and End moving between the cards that can be chosen, and Space, Enter or a press choosing. `row` scrolls sideways with each card 90% of the row; `grid` is one column, then two from 36rem.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MediaCardPicker>;

/** One row that scrolls sideways; the arrow keys skip the card that cannot be chosen. */
export const Row: Story = {
  args: { layout: "row" },
  // storybook-quality-allow state-harness: Harness owns the choice while rendering the real MediaCardPicker.
  render: (args) => (
    <div style={{ width: 390 }} className="overflow-hidden px-4">
      <Harness {...args} className="-mx-4 scroll-px-4 px-4" />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const radios = canvas.getAllByRole("radio");
    await expect(radios[1]).toBeDisabled();
    await userEvent.tab();
    await expect(radios[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(radios[2]).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onChange).toHaveBeenCalledWith("school");
  },
};

/** A grid: one column, then two once the picker is 36rem wide. */
export const Grid: Story = {
  args: { layout: "grid", value: "ridge" },
  render: (args) => (
    <div style={{ width: 592 }}>
      <MediaCardPicker {...args} />
    </div>
  ),
};
