import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminTextArea, AdminTextField } from "./AdminTextField";
import { CharacterCounter } from "./CharacterCounter";

// A pool's purpose as a steward might write it: 528 characters, past the 420 limit.
const PURPOSE =
  "Neighbours in Rocinha offer help and ask for it: rides to the clinic, tools from the library on Rua Um, workshops in the community kitchen, and garden work on the terraces above the school. Commitments are kept in the open and confirmed by the person they were made to, so everyone can see what was promised and what was done. Offers and requests count the same. Nobody is paid in advance, and a commitment that is not kept simply expires, without a penalty, so the next neighbour can pick it up and carry it through the season.";

// 68 characters, 73 UTF-8 bytes: the accents and the dash take more than one each.
const GARDEN_NAME = "Jardim Agroecológico da Associação de Moradores da Rocinha — Cachopa";

/** The counter where it ships: the end of a field's supporting row, counting as the steward types. */
function CountedPurpose({
  count,
  max,
  disabled,
}: {
  count: number;
  max: number;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(PURPOSE.slice(0, count));
  return (
    <div className="max-w-xl">
      <AdminTextArea
        label="What this pool is for"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={5}
        disabled={disabled}
        showCount
        textareaProps={{ maxLength: max }}
      />
    </div>
  );
}

const meta: Meta<typeof CharacterCounter> = {
  title: "Admin/Primitives/CharacterCounter",
  component: CharacterCounter,
  tags: ["autodocs", "storybook-ci"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "The M3 character counter, \"324 / 420\" at the end of a text field's supporting row. A field opts in with `showCount` and counts toward its control's own `maxLength`, so the field stops where the counter ends. Past the limit, which only text loaded from before it or bytes can reach, the field shows an error saying how to shorten it. The numbers are hidden from assistive tech: the control is described by the count in words, and a polite status says once that an edit reached the limit.",
      },
    },
  },
  args: { id: "story-count", count: 0, max: 420, disabled: false },
  // The field sets these from its own state; the controls cannot.
  argTypes: {
    id: { control: false },
    error: { control: false },
    edited: { control: false },
  },
  // Keyed on the args so a change in the controls starts the field again.
  render: (args) => (
    <CountedPurpose
      key={`${args.count}/${args.max}`}
      count={args.count}
      max={args.max}
      disabled={args.disabled}
    />
  ),
};

export default meta;
type Story = StoryObj<typeof CharacterCounter>;

/** Nothing written yet: the counter already says how much room there is. */
export const Empty: Story = {};

/** A long purpose with room for a few more words. */
export const NearTheLimit: Story = { args: { count: 388 } };

/**
 * At the limit the field takes no more, and the status says so once. Runs in
 * browser mode, where real layout applies (jsdom has none): the count ends on
 * the same inset as the text above it, at the end of the supporting row.
 */
export const AtTheLimit: Story = {
  args: { count: 420 },
  play: async ({ canvasElement }) => {
    const field = within(canvasElement).getByRole("textbox", { name: "What this pool is for" });
    const counter = canvasElement.querySelector<HTMLElement>('[data-component="CharacterCounter"]');
    await expect(counter).not.toBeNull();
    if (!counter) return;
    await expect(within(counter).getByText("420 / 420")).toBeVisible();
    const fieldRight = field.getBoundingClientRect().right;
    await expect(Math.abs(counter.getBoundingClientRect().right - fieldRight)).toBeLessThan(1);
  },
};

/**
 * A purpose written before the limit loads in full. The count takes the error
 * color and the field says how to shorten it, without announcing it: nobody
 * has typed yet.
 */
export const PastTheLimit: Story = { args: { count: PURPOSE.length } };

/**
 * A garden name, which the contract measures in UTF-8 bytes (`countBytes`).
 * This one fits 72 characters but not 72 bytes, so the field says why.
 */
export const CountingBytes: Story = {
  args: { max: 72 },
  // The name is the count here.
  argTypes: { count: { control: false } },
  render: (args) => (
    <div className="max-w-xl">
      <AdminTextField
        label="Garden name"
        defaultValue={GARDEN_NAME}
        disabled={args.disabled}
        showCount
        countBytes
        inputProps={{ maxLength: args.max }}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("73 / 72")).toBeVisible();
    await expect(canvas.getByRole("textbox", { name: "Garden name" })).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  },
};
