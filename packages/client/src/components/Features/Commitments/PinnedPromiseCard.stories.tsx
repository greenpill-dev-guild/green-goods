import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { PinnedPromiseCard } from "./PinnedPromiseCard";

/**
 * The promise a flow is for, named on every step: "Proof for" in the proof flow and
 * "Work for" in Submit Work once a promise is chosen. It follows the step's heading
 * card and pins under the top bar; tapping it opens the promise in a sheet.
 */
const meta: Meta<typeof PinnedPromiseCard> = {
  title: "Client/Commitments/PinnedPromiseCard",
  component: PinnedPromiseCard,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    kind: "proof",
    title: "Repair the north fence panel by the compost bays before the first frost",
    onOpen: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof PinnedPromiseCard>;

export const ProofFor: Story = {
  play: async ({ canvasElement, args }) => {
    const card = within(canvasElement).getByRole("button", {
      name: /^Proof for Repair the north fence panel.*Open the promise$/,
    });
    // A long title clamps at two 20px lines.
    const title = within(card).getByText(/Repair the north fence panel/);
    await expect(title.getBoundingClientRect().height).toBeLessThanOrEqual(40);
    card.click();
    await expect(args.onOpen).toHaveBeenCalledTimes(1);
  },
};

export const WorkFor: Story = {
  args: { kind: "work", title: "Transplant 36 seedlings into the east beds" },
};
