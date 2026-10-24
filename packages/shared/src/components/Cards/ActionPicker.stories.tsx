import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_SOLAR,
  FIXTURE_IMAGE_WASTE,
} from "../../../.storybook/fixtures";
import { type Action, Capital, Domain } from "../../types/domain";
import { ActionPicker, type ActionPickerProps } from "./ActionPicker";

function makeAction(
  id: string,
  title: string,
  domain: Domain,
  media: string[],
  mediaInfo: Action["mediaInfo"]
): Action {
  return {
    id,
    slug: id,
    title,
    description: "",
    domain,
    startTime: 0,
    endTime: 0,
    instructions: "",
    capitals: [Capital.LIVING],
    media,
    createdAt: 0,
    inputs: [],
    mediaInfo,
  };
}

const ACTIONS: Action[] = [
  makeAction("plant", "Planting Event", Domain.AGRO, [FIXTURE_IMAGE_AGROFORESTRY], {
    title: "Evidence",
    required: true,
    minImageCount: 2,
  }),
  makeAction("uptime", "Energy & Uptime Check", Domain.SOLAR, [FIXTURE_IMAGE_SOLAR], {
    title: "Evidence",
    required: true,
  }),
  // No picture of its own: the banner is the domain's gradient.
  makeAction("workshop", "Workshop Delivered", Domain.EDU, [], {
    title: "Evidence",
    required: false,
  }),
  makeAction(
    "sorting",
    "Sorting & Breakdown with a per-category weight for every bag",
    Domain.WASTE,
    [FIXTURE_IMAGE_WASTE],
    { title: "Evidence", required: true, minImageCount: 3 }
  ),
];

/** A picker that holds its own choice, the way Submit Work does. */
function Picker(props: ActionPickerProps) {
  const [value, setValue] = useState(props.value);
  return (
    <ActionPicker
      {...props}
      value={value}
      onChange={(actionId) => {
        setValue(actionId);
        props.onChange(actionId);
      }}
    />
  );
}

const meta: Meta<typeof ActionPicker> = {
  title: "Shared/Cards/ActionPicker",
  component: ActionPicker,
  tags: ["autodocs", "storybook-ci"],
  args: { actions: ACTIONS, value: "uptime", label: "Action", onChange: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "Choosing the action a work answers, one picker on both surfaces: media cards with the action's banner (its photo, or its domain's gradient), the domain on the banner, a one-line title and what the action asks for. One radio group with one tab stop: the arrow keys and Home and End move, Space, Enter or a press chooses, and the chosen card takes the 3px border in the focus role. The installed app lays the cards in a row that scrolls sideways; the cockpit in a grid.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ActionPicker>;

/** The installed app: one row that scrolls sideways, each card 90% of it. */
export const InTheApp: Story = {
  args: { layout: "row" },
  // storybook-quality-allow state-harness: Picker owns the choice while rendering the real ActionPicker.
  render: (args) => (
    <div style={{ width: 390 }} className="overflow-hidden px-4">
      <Picker {...args} className="-mx-4 scroll-px-4 px-4" />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("radiogroup", { name: "Action" });
    const radios = within(group).getAllByRole("radio");
    await expect(radios[1]).toHaveAttribute("aria-checked", "true");
    await expect(radios[1]).toHaveAttribute("tabindex", "0");

    radios[1].focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(radios[2]).toHaveFocus();
    await expect(args.onChange).not.toHaveBeenCalled();
    await userEvent.keyboard(" ");
    await expect(args.onChange).toHaveBeenCalledWith("workshop");
    await expect(radios[2]).toHaveAttribute("aria-checked", "true");
  },
};

/** The cockpit: a grid, two to a row once the flow dialog is wide enough. */
export const InTheCockpit: Story = {
  args: { layout: "grid", value: null },
  parameters: { surface: "admin" },
  // storybook-quality-allow state-harness: Picker owns the choice while rendering the real ActionPicker.
  render: (args) => (
    <div style={{ width: 592 }}>
      <Picker {...args} />
    </div>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const radios = canvas.getAllByRole("radio");
    // Nothing chosen: the first card holds the tab stop.
    await expect(radios[0]).toHaveAttribute("tabindex", "0");

    await userEvent.tab();
    await expect(radios[0]).toHaveFocus();
    await userEvent.keyboard("{End}");
    await expect(radios[3]).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onChange).toHaveBeenCalledWith("sorting");
    await userEvent.click(radios[0]);
    await expect(args.onChange).toHaveBeenLastCalledWith("plant");
  },
};

/** While the actions load, four empty cards hold their place. */
export const Loading: Story = {
  args: { layout: "row", loading: true },
  render: (args) => (
    <div style={{ width: 390 }} className="overflow-hidden px-4">
      <ActionPicker {...args} className="-mx-4 px-4" />
    </div>
  ),
};

/** While Submit Work sends, the cards are turned off. */
export const Disabled: Story = {
  args: { layout: "grid", disabled: true },
  parameters: { surface: "admin" },
  render: (args) => (
    <div style={{ width: 592 }}>
      <ActionPicker {...args} />
    </div>
  ),
};
